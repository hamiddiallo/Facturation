'use server';

import { createClient } from '@supabase/supabase-js';
// import { createSupabaseServerClient } from '@/lib/supabaseServer';
import { InvoiceData, InvoiceType } from '@/lib/types';
import { z } from 'zod';
import { normalizeText } from '@/lib/textUtils';
import { getCounterName, formatBaseInvoiceNumber } from '@/lib/counter';
import { requireAuth, getServerSession } from '@/lib/serverAuth';

// Helper to get Supabase Admin client (bypasses RLS)
const getSupabaseAdmin = () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    if (!url || !serviceRole) {
        console.error('CRITICAL: Supabase URL or Service Role Key is missing in ENV');
    }
    return createClient(url, serviceRole);
};


const ArticleSchema = z.object({
    designation: z.string().min(1),
    quantity: z.number().min(0),
    unit: z.string().nullable().optional(),
    price: z.number().min(0),
    totalPrice: z.number()
});

const InvoiceSchema = z.object({
    client: z.object({
        nom: z.string().min(2),
        adresse: z.string().nullable().optional()
    }),
    numeroFacture: z.string(),
    dateFacture: z.string(),
    type: z.nativeEnum(InvoiceType),
    articles: z.array(ArticleSchema),
    amountPaid: z.number().nullable().optional()
});

export async function getNextSequenceCloudAction(dateStr: string | Date = new Date()): Promise<number> {
    await requireAuth();
    const supabase = getSupabaseAdmin();
    const counterName = getCounterName(dateStr);

    const { data, error } = await supabase
        .from('counters')
        .select('last_sequence')
        .eq('name', counterName)
        .maybeSingle();

    if (error) {
        console.error('Action getNextSequenceCloud error:', error);
        throw new Error(`Échec lecture compteur: ${error.message}`);
    }

    return data ? data.last_sequence + 1 : 1;
}

export async function generateInvoiceNumberAtomicAction(dateStr: string | Date = new Date()): Promise<number> {
    await requireAuth();
    const supabase = getSupabaseAdmin();
    const counterName = getCounterName(dateStr);

    const { data, error } = await supabase.rpc('get_next_invoice_sequence', {
        counter_name: counterName
    });

    if (error) {
        console.error('Action generateInvoiceNumberAtomic error:', error);
        throw new Error(`Échec génération numéro: ${error.message}`);
    }

    return data;
}

export async function saveInvoiceCloudAction(invoice: InvoiceData, companyId: string, totalAmount: number): Promise<string | null> {
    const { user } = await requireAuth();
    const supabase = getSupabaseAdmin();

    const validated = InvoiceSchema.safeParse({
        ...invoice,
        client: {
            nom: normalizeText(invoice.client.nom),
            adresse: normalizeText(invoice.client.adresse)
        },
        articles: invoice.articles.map(art => ({
            ...art,
            designation: normalizeText(art.designation)
        }))
    });

    if (!validated.success) {
        console.error('Validation Error:', validated.error);
        return null;
    }
    const clean = validated.data;

    try {
        // --- DÉTECTION PAR NUMÉRO (Permet le clonage en changeant le numéro) ---
        const { data: existingInv } = await supabase
            .from('invoices')
            .select('id, user_id')
            .eq('number', clean.numeroFacture)
            .maybeSingle();

        // Sécurité: Si la facture existe déjà, vérifier que l'utilisateur en est le propriétaire
        if (existingInv && existingInv.user_id !== user.id) {
            const { profile } = await requireAuth();
            if (profile?.role !== 'admin') {
                throw new Error('Action non autorisée');
            }
        }

        // Formattage des articles pour le JSONB Supabase
        const jsonArticles = clean.articles.map(art => ({
            designation: art.designation,
            quantity: art.quantity,
            unit: art.unit,
            price: art.price,
            total_price: art.totalPrice
        }));

        // --- B. EXTRACTION DU COMPTEUR POUR MISE À JOUR ATOMIQUE ---
        let counterName = null;
        let newSequence = null;

        if (!existingInv) { // Seulement en création
            const sequenceMatch = clean.numeroFacture.match(/-(\d+)$/);
            if (sequenceMatch) {
                newSequence = parseInt(sequenceMatch[1], 10);

                const [day, month, year] = clean.dateFacture.split('/');
                if (day && month && year) {
                    const dateObj = new Date(`${year}-${month}-${day}`);
                    counterName = getCounterName(dateObj);
                } else {
                    counterName = getCounterName(new Date());
                }
            }
        }

        // Appel de la fonction RPC atomique
        const { data: invoiceId, error: rpcError } = await supabase.rpc('upsert_full_invoice', {
            p_user_id: user.id, // Utiliser l'ID de la session serveur
            p_company_id: companyId,
            p_id: existingInv?.id || null,
            p_number: clean.numeroFacture,
            p_type: clean.type,
            p_date: new Date().toISOString().split('T')[0], // Format YYYY-MM-DD
            p_client_name: clean.client.nom,
            p_client_address: clean.client.adresse || '',
            p_amount_paid: clean.amountPaid || 0,
            p_total_amount: totalAmount,
            p_articles: jsonArticles,
            p_counter_name: counterName,
            p_new_sequence: newSequence
        });

        if (rpcError) throw rpcError;

        return invoiceId;
    } catch (error: any) {
        console.error('Action saveInvoiceCloud error:', error.message);
        return null;
    }
}

export async function getInvoicesCloudAction(page: number = 0, pageSize: number = 20): Promise<any[]> {
    const session = await getServerSession();
    if (!session) return [];

    const { user, profile } = session;
    const supabase = getSupabaseAdmin();

    const from = page * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
        .from('invoices')
        .select(`
            *,
            companies (display_name),
            invoice_items (*)
        `);

    // Isolation des données : Les admins voient tout, les users voient les leurs
    if (profile?.role !== 'admin') {
        query = query.eq('user_id', user.id);
    }

    const { data, error } = await query
        .order('created_at', { ascending: false })
        .range(from, to);

    if (error) {
        console.error('Action getInvoicesCloud error:', error.message);
        return [];
    }
    return data || [];
}

export async function deleteInvoiceCloudAction(id: string): Promise<boolean> {
    const { user, profile } = await requireAuth();
    const supabase = getSupabaseAdmin();

    let query = supabase.from('invoices').delete().eq('id', id);

    // Isolation des données : Un utilisateur ne peut supprimer que ses propres factures
    if (profile?.role !== 'admin') {
        query = query.eq('user_id', user.id);
    }

    const { error } = await query;

    return !error;
}

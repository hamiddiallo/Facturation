'use server';

import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { InvoiceData, InvoiceType } from '@/lib/types';
import { z } from 'zod';
import { normalizeText } from '@/lib/textUtils';
import { getCounterName, formatBaseInvoiceNumber } from '@/lib/counter';
import { verifyServerSession } from '@/lib/adminActions';

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
    const session = await verifyServerSession();
    if (!session) throw new Error('Non autorisé');

    const counterName = getCounterName(dateStr);

    const { data, error } = await supabaseAdmin
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
    const session = await verifyServerSession();
    if (!session) throw new Error('Non autorisé');

    const counterName = getCounterName(dateStr);

    const { data, error } = await supabaseAdmin.rpc('get_next_invoice_sequence', {
        counter_name: counterName
    });

    if (error) {
        console.error('Action generateInvoiceNumberAtomic error:', error);
        throw new Error(`Échec génération numéro: ${error.message}`);
    }

    return data;
}

export async function saveInvoiceCloudAction(invoice: InvoiceData, companyId: string, totalAmount: number): Promise<string | null> {
    const session = await verifyServerSession();
    if (!session) return null;

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
        const { data: existingInv } = await supabaseAdmin
            .from('invoices')
            .select('id')
            .eq('user_id', session.id)
            .eq('number', clean.numeroFacture)
            .maybeSingle();

        // Formattage des articles pour le JSONB Supabase
        const jsonArticles = clean.articles.map(art => ({
            designation: art.designation,
            quantity: art.quantity,
            unit: art.unit,
            price: art.price,
            total_price: art.totalPrice
        }));

        // --- B. EXTRACTION DU COMPTEUR POUR MISE À JOUR ATOMIQUE ---
        // On doit deviner quel compteur et quelle séquence mettre à jour
        // Format typique : FAC-260125-0005 ou MLF-260125-0005
        let counterName = null;
        let newSequence = null;

        if (!existingInv) { // Seulement en création
            // 1. Essayer d'extraire la séquence (derniers chiffres)
            const sequenceMatch = clean.numeroFacture.match(/-(\d+)$/);
            if (sequenceMatch) {
                newSequence = parseInt(sequenceMatch[1], 10);

                // 2. Déterminer le nom du compteur basé sur la date de la facture
                // (On suppose que le numéro respecte la date de la facture)
                // Attention: clean.dateFacture est au format local "JJ/MM/AAAA" d'après InvoiceForm
                // Nous devons le convertir en objet Date pour getCounterName
                const [day, month, year] = clean.dateFacture.split('/');
                if (day && month && year) {
                    // "25/01/2026" -> new Date("2026-01-25")
                    const dateObj = new Date(`${year}-${month}-${day}`);
                    counterName = getCounterName(dateObj);
                } else {
                    // Fallback si format date invalide : on utilise aujourd'hui
                    counterName = getCounterName(new Date());
                }
            }
        }

        // Appel de la fonction RPC atomique
        const { data: invoiceId, error: rpcError } = await supabaseAdmin.rpc('upsert_full_invoice', {
            p_user_id: session.id,
            p_company_id: companyId,
            p_id: existingInv?.id || null, // Détecté par le numéro
            p_number: clean.numeroFacture,
            p_type: clean.type,
            p_date: new Date().toISOString().split('T')[0], // Format YYYY-MM-DD
            p_client_name: clean.client.nom,
            p_client_address: clean.client.adresse || '',
            p_amount_paid: clean.amountPaid || 0,
            p_total_amount: totalAmount,
            p_articles: jsonArticles,
            p_counter_name: counterName,   // Nouveau param (peut être null)
            p_new_sequence: newSequence    // Nouveau param (peut être null)
        });

        if (rpcError) throw rpcError;

        return invoiceId;
    } catch (error: any) {
        console.error('Action saveInvoiceCloud error:', error.message);
        return null;
    }
}

export async function getInvoicesCloudAction(page: number = 0, pageSize: number = 20): Promise<any[]> {
    const session = await verifyServerSession();
    if (!session) return [];

    const from = page * pageSize;
    const to = from + pageSize - 1;

    const { data, error } = await supabaseAdmin
        .from('invoices')
        .select(`
            *,
            companies (display_name),
            invoice_items (*)
        `)
        .eq('user_id', session.id)
        .order('created_at', { ascending: false })
        .range(from, to);

    if (error) return [];
    return data || [];
}

export async function deleteInvoiceCloudAction(id: string): Promise<boolean> {
    const session = await verifyServerSession();
    if (!session) return false;

    const { error } = await supabaseAdmin
        .from('invoices')
        .delete()
        .eq('id', id)
        .eq('user_id', session.id);

    return !error;
}

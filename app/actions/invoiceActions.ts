'use server';

import { createClient } from '@supabase/supabase-js';
// import { createSupabaseServerClient } from '@/lib/supabaseServer';
import { InvoiceData, InvoiceType } from '@/lib/types';
import { z } from 'zod';
import { normalizeText } from '@/lib/textUtils';
import { getCounterName, formatBaseInvoiceNumber } from '@/lib/counter';
import { requireAuth, getServerSession } from '@/lib/serverAuth';
import {
    initializeWeeklyMap,
    aggregateInvoicesByWeek,
    calculateFinancialMetrics
} from '@/lib/dashboardUtils';

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

        // Conversion DD/MM/YYYY -> YYYY-MM-DD pour le backend
        const [d, m, y] = clean.dateFacture.split('/');
        const isoDate = `${y}-${m}-${d}`;

        // Appel de la fonction RPC atomique
        const { data: invoiceId, error: rpcError } = await supabase.rpc('upsert_full_invoice', {
            p_user_id: user.id, // Utiliser l'ID de la session serveur
            p_company_id: companyId,
            p_id: existingInv?.id || null,
            p_number: clean.numeroFacture,
            p_type: clean.type,
            p_date: isoDate,
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

export async function getDashboardStatsAction(): Promise<any> {
    const session = await getServerSession();
    if (!session) return null;

    const { user, profile } = session;
    const supabase = getSupabaseAdmin();
    const isAdmin = profile?.role === 'admin';

    // 1. Totaux globaux (Calculés à partir d'une sélection standard pour compatibilité)
    let statsQuery = supabase.from('invoices').select('total_amount, amount_paid');
    if (!isAdmin) statsQuery = statsQuery.eq('user_id', user.id);
    const { data: globalData, error: globalError } = await statsQuery;
    if (globalError) throw globalError;

    const totalInvoices = globalData?.length || 0;
    const totalCA = globalData?.reduce((sum, inv) => sum + Number(inv.total_amount || 0), 0) || 0;
    const totalPaid = globalData?.reduce((sum, inv) => sum + Number(inv.amount_paid || 0), 0) || 0;
    const totalOutstanding = totalCA - totalPaid;
    const { averageBasket, recoveryRate } = calculateFinancialMetrics(totalCA, totalInvoices, totalPaid);

    // 2. Évolution Hebdomadaire (5 dernières semaines uniquement)
    const now = new Date();
    const fiveWeeksAgo = new Date(now.getTime() - (5 * 7 * 24 * 60 * 60 * 1000));

    let trendQuery = supabase
        .from('invoices')
        .select('total_amount, created_at, date')
        .gte('date', fiveWeeksAgo.toISOString().split('T')[0]);
    if (!isAdmin) trendQuery = trendQuery.eq('user_id', user.id);

    const { data: trendInvoices } = await trendQuery;

    const weeklyMap = initializeWeeklyMap(now);
    const monthlyStats = aggregateInvoicesByWeek(trendInvoices || [], weeklyMap);

    // 3. Top Clients (Toujours besoin des noms, mais on peut limiter)
    let clientQuery = supabase.from('invoices').select('client_name, total_amount');
    if (!isAdmin) clientQuery = clientQuery.eq('user_id', user.id);
    // Note: Pour de très gros volumes, ceci devrait être un RPC group by
    const { data: allInvoicesForClients } = await clientQuery;

    const clientMap = new Map<string, number>();
    allInvoicesForClients?.forEach(inv => {
        clientMap.set(inv.client_name, (clientMap.get(inv.client_name) || 0) + Number(inv.total_amount || 0));
    });
    const topClients = Array.from(clientMap.entries())
        .map(([name, ca]) => ({ name, ca }))
        .sort((a, b) => b.ca - a.ca)
        .slice(0, 5);
    const uniqueClients = clientMap.size;

    // 4. Statistiques Articles
    let itemQuery = supabase.from('invoice_items').select('designation, quantity, unit');
    if (!isAdmin) {
        // Limitation aux articles de l'utilisateur
        const { data: userInvoices } = await supabase.from('invoices').select('id').eq('user_id', user.id);
        const ids = userInvoices?.map(i => i.id) || [];
        itemQuery = itemQuery.in('invoice_id', ids);
    }
    const { data: items } = await itemQuery;

    const articleMap = new Map<string, { designation: string, quantity: number, unit: string }>();
    items?.forEach(it => {
        const key = `${it.designation}|${it.unit || ''}`;
        const current = articleMap.get(key) || { designation: it.designation, quantity: 0, unit: it.unit || '-' };
        current.quantity += it.quantity;
        articleMap.set(key, current);
    });
    const uniqueArticlesList = Array.from(articleMap.values()).sort((a, b) => b.quantity - a.quantity);

    // 5. Comptes divers
    let companyQuery = supabase.from('companies').select('id', { count: 'exact', head: true });
    if (!isAdmin) companyQuery = companyQuery.eq('user_id', user.id);
    const { count: companiesCount } = await companyQuery;

    let usersCount = 0;
    if (isAdmin) {
        const { count } = await supabase.from('profiles').select('id', { count: 'exact', head: true });
        usersCount = count || 0;
    }

    return {
        totalInvoices,
        uniqueClients,
        uniqueArticles: uniqueArticlesList.length,
        uniqueArticlesList,
        companiesCount: companiesCount || 0,
        usersCount,
        totalCA,
        totalOutstanding,
        averageBasket,
        recoveryRate,
        topClients,
        monthlyStats: Array.from(weeklyMap.values())
    };
}

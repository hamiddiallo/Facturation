import { supabase } from './supabase';
import { Company, InvoiceData, Article, InvoiceType } from './types';
import { authService } from './authService';
import { z } from 'zod';
import { normalizeText, normalizeEmail } from './textUtils';
import { formatBaseInvoiceNumber, adaptInvoiceNumber, getCounterName } from './counter';

// Convertit une ligne Supabase (snake_case) vers le type Company (camelCase)
const mapCompany = (data: any): Company => ({
    id: data.id,
    name: data.name,
    displayName: data.display_name,
    businessType: data.business_type,
    address: data.address,
    nif: data.nif,
    phone: data.phone,
    email: data.email,
    hasStyledLogo: data.has_styled_logo,
    registrationNumbers: data.registration_numbers,
    sealImage: data.seal_image,
    isDefault: data.is_default || false,
    templateId: data.template_id || 'template_standard',
    markupPercentage: data.markup_percentage || 0
});

// --- SCHEMAS DE VALIDATION ---
const CompanySchema = z.object({
    name: z.string().min(2),
    displayName: z.string().min(2),
    businessType: z.string().nullable().optional(),
    address: z.string().nullable().optional(),
    nif: z.string().nullable().optional(),
    phone: z.string().nullable().optional(),
    email: z.string().email().or(z.literal('')).nullable().optional(),
    hasStyledLogo: z.boolean().nullable().optional(),
    registrationNumbers: z.string().nullable().optional(),
    sealImage: z.string().nullable().optional(),
    isDefault: z.boolean().optional(),
    templateId: z.string().nullable().optional(),
    markupPercentage: z.number().min(0).max(100).nullable().optional()
});

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

export const getCompanies = async (): Promise<Company[]> => {
    const user = authService.getCurrentUser();
    if (!user) {
        console.warn('getCompanies: Aucun utilisateur en session locale');
        return [];
    }

    const { data, error } = await supabase
        .from('companies')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

    if (error) {
        console.error('Erreur getCompanies:', error.message);
        return [];
    }

    return (data || []).map(mapCompany);
};

export const createCompany = async (company: Omit<Company, 'id'>): Promise<Company | null> => {
    // Validation & Normalisation
    const validated = CompanySchema.safeParse({
        ...company,
        name: normalizeText(company.name),
        displayName: normalizeText(company.displayName),
        address: company.address ? normalizeText(company.address) : company.address,
        email: company.email ? normalizeEmail(company.email) : company.email,
        nif: company.nif ? normalizeText(company.nif) : company.nif,
        registrationNumbers: company.registrationNumbers ? normalizeText(company.registrationNumbers) : company.registrationNumbers
    });
    if (!validated.success) {
        console.error('Validation createCompany échouée:', validated.error.message);
        return null;
    }

    const clean = validated.data;
    const user = authService.getCurrentUser();
    if (!user) return null;

    const { data, error } = await supabase
        .from('companies')
        .insert([{
            user_id: user.id,
            name: clean.name,
            display_name: clean.displayName,
            business_type: clean.businessType,
            address: clean.address,
            nif: clean.nif,
            phone: clean.phone,
            email: clean.email,
            has_styled_logo: clean.hasStyledLogo,
            registration_numbers: clean.registrationNumbers,
            seal_image: clean.sealImage,
            is_default: clean.isDefault || false,
            template_id: clean.templateId || 'template_standard',
            markup_percentage: clean.markupPercentage || 0
        }])
        .select()
        .single();

    if (error) {
        console.error('Erreur createCompany:', error.message);
        return null;
    }

    return mapCompany(data);
};

export const updateCompany = async (id: string, company: Partial<Company>): Promise<Company | null> => {
    // Validation partielle & Normalisation
    const filteredUpdates: any = {};
    if (company.name !== undefined) filteredUpdates.name = normalizeText(company.name);
    if (company.displayName !== undefined) filteredUpdates.displayName = normalizeText(company.displayName);
    if (company.address !== undefined) filteredUpdates.address = company.address ? normalizeText(company.address) : company.address;
    if (company.email !== undefined) filteredUpdates.email = company.email ? normalizeEmail(company.email) : company.email;
    if (company.nif !== undefined) filteredUpdates.nif = company.nif ? normalizeText(company.nif) : company.nif;
    if (company.registrationNumbers !== undefined) filteredUpdates.registrationNumbers = company.registrationNumbers ? normalizeText(company.registrationNumbers) : company.registrationNumbers;

    // On copie le reste des champs
    Object.keys(company).forEach(key => {
        if (!(key in filteredUpdates)) {
            (filteredUpdates as any)[key] = (company as any)[key];
        }
    });

    const validated = CompanySchema.partial().safeParse(filteredUpdates);
    if (!validated.success) {
        console.error('Validation updateCompany échouée:', validated.error.message);
        return null;
    }

    const clean = validated.data;
    const updates: any = {};
    if (clean.name !== undefined) updates.name = clean.name;
    if (clean.displayName !== undefined) updates.display_name = clean.displayName;
    if (clean.businessType !== undefined) updates.business_type = clean.businessType;
    if (clean.address !== undefined) updates.address = clean.address;
    if (clean.nif !== undefined) updates.nif = clean.nif;
    if (clean.phone !== undefined) updates.phone = clean.phone;
    if (clean.email !== undefined) updates.email = clean.email;
    if (clean.hasStyledLogo !== undefined) updates.has_styled_logo = clean.hasStyledLogo;
    if (clean.registrationNumbers !== undefined) updates.registration_numbers = clean.registrationNumbers;
    if (clean.sealImage !== undefined) updates.seal_image = clean.sealImage;
    if (clean.isDefault !== undefined) updates.is_default = clean.isDefault;
    if (clean.templateId !== undefined) updates.template_id = clean.templateId;
    if (clean.markupPercentage !== undefined) updates.markup_percentage = clean.markupPercentage;

    const user = authService.getCurrentUser();
    if (!user) return null;

    const { data, error } = await supabase
        .from('companies')
        .update(updates)
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();

    if (error) {
        console.error('Erreur updateCompany:', error.message);
        return null;
    }

    return mapCompany(data);
};

export const setDefaultCompany = async (companyId: string): Promise<boolean> => {
    const user = authService.getCurrentUser();
    if (!user) return false;

    // 1. Décocher toutes les autres
    await supabase.from('companies').update({ is_default: false }).eq('user_id', user.id);

    // 2. Cocher la nouvelle
    const { error } = await supabase.from('companies').update({ is_default: true }).eq('id', companyId);

    if (error) {
        console.error('Erreur setDefaultCompany:', error.message);
        return false;
    }
    return true;
};

export const deleteCompany = async (id: string): Promise<boolean> => {
    const user = authService.getCurrentUser();
    if (!user) return false;

    const { error } = await supabase
        .from('companies')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

    if (error) {
        console.error('Erreur deleteCompany:', error);
        return false;
    }

    return true;
};

// --- SERVICES FACTURES ---

// getCounterName moved to lib/counter.ts for better organization

export const saveInvoiceCloud = async (invoice: InvoiceData, companyId: string, totalAmount: number): Promise<string | null> => {
    // Validation & Normalisation
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
        const errorDetails = validated.error.issues.map((e: any) => `${e.path.join('.')}: ${e.message}`).join(', ');
        console.error('Validation saveInvoiceCloud échouée:', errorDetails);
        throw new Error(`Données invalides: ${errorDetails}`);
    }

    const clean = validated.data;
    const user = authService.getCurrentUser();
    if (!user) return null;

    try {
        // --- DÉTECTION CRÉATION vs MISE À JOUR ---
        // Vérifier si une facture avec ce numéro existe déjà
        const { data: existingInv, error: searchError } = await supabase
            .from('invoices')
            .select('id')
            .eq('user_id', user.id)
            .eq('number', clean.numeroFacture)
            .maybeSingle();

        if (searchError) throw searchError;

        let invoiceId: string;
        let finalInvoiceNumber = clean.numeroFacture;

        if (existingInv) {
            // MODE UPDATE - Facture existe déjà
            console.log('[saveInvoiceCloud] Mise à jour facture existante:', clean.numeroFacture);
            invoiceId = existingInv.id;

            // Mettre à jour l'en-tête
            const { error: updateError } = await supabase
                .from('invoices')
                .update({
                    company_id: companyId,
                    type: clean.type,
                    date: new Date().toISOString(),
                    client_name: clean.client.nom,
                    client_address: clean.client.adresse,
                    amount_paid: clean.amountPaid || 0,
                    total_amount: totalAmount
                })
                .eq('id', invoiceId);

            if (updateError) throw updateError;

            // Supprimer les anciens articles
            const { error: deleteError } = await supabase
                .from('invoice_items')
                .delete()
                .eq('invoice_id', invoiceId);

            if (deleteError) throw deleteError;

        } else {
            // MODE CREATE - Nouvelle facture
            console.log('[saveInvoiceCloud] Création nouvelle facture');

            // Transaction atomique pour incrémenter le compteur
            const counterName = getCounterName(new Date());
            const { data: newSeq, error: rpcError } = await supabase.rpc('get_next_invoice_sequence', {
                counter_name: counterName
            });

            if (rpcError) {
                console.error('[saveInvoiceCloud] Erreur transaction atomique:', rpcError);
                throw new Error(`Échec génération numéro atomique: ${rpcError.message}`);
            }

            // Générer le numéro avec la séquence atomique
            const atomicNumber = formatBaseInvoiceNumber(newSeq, new Date());

            // Vérifier si le numéro fourni correspond au numéro atomique
            if (clean.numeroFacture && clean.numeroFacture !== atomicNumber) {
                console.warn(`[saveInvoiceCloud] Numéro changé (accès concurrent): ${clean.numeroFacture} → ${atomicNumber}`);
            }

            // Utiliser le numéro atomique pour garantir l'unicité
            finalInvoiceNumber = atomicNumber;

            const { data: invData, error: invError } = await supabase
                .from('invoices')
                .insert([{
                    user_id: user.id,
                    company_id: companyId,
                    number: finalInvoiceNumber,
                    type: clean.type,
                    date: new Date().toISOString(),
                    client_name: clean.client.nom,
                    client_address: clean.client.adresse,
                    amount_paid: clean.amountPaid || 0,
                    total_amount: totalAmount
                }])
                .select()
                .single();

            if (invError) throw invError;
            invoiceId = invData.id;

            console.log('[saveInvoiceCloud] Facture créée avec numéro:', finalInvoiceNumber);
        }

        // 3. Insérer les nouveaux articles (déjà normalisés dans clean)
        const itemsToInsert = clean.articles.map(art => ({
            invoice_id: invoiceId,
            designation: art.designation,
            quantity: art.quantity,
            unit: art.unit,
            price: art.price,
            total_price: art.totalPrice
        }));

        const { error: itemsError } = await supabase
            .from('invoice_items')
            .insert(itemsToInsert);

        if (itemsError) throw itemsError;

        return invoiceId;

    } catch (error: any) {
        console.error('Erreur saveInvoiceCloud:', error.message || error);
        return null;
    }
};

export const getInvoicesCloud = async (page: number = 0, pageSize: number = 20): Promise<any[]> => {
    const user = authService.getCurrentUser();
    if (!user) return [];

    const from = page * pageSize;
    const to = from + pageSize - 1;

    const { data, error } = await supabase
        .from('invoices')
        .select(`
            *,
            companies (display_name),
            invoice_items (*)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .range(from, to);

    if (error) {
        console.error('Erreur getInvoicesCloud:', error);
        return [];
    }

    return data || [];
};

/**
 * Génère atomiquement le prochain numéro de séquence pour une facture
 * Utilise une fonction SQL pour garantir l'unicité même en cas d'accès concurrent
 * @param dateStr - Date pour déterminer le scope du compteur (YYMMDD)
 * @returns Le numéro de séquence généré
 * @throws Error si la génération échoue
 */
export const generateInvoiceNumberAtomic = async (dateStr: string | Date = new Date()): Promise<number> => {
    const counterName = getCounterName(dateStr);

    try {
        // Appel de la fonction SQL atomique
        const { data, error } = await supabase.rpc('get_next_invoice_sequence', {
            counter_name: counterName
        });

        if (error) {
            console.error('[generateInvoiceNumberAtomic] Erreur SQL:', error);
            throw new Error(`Échec génération numéro: ${error.message}`);
        }

        if (data === null || data === undefined) {
            throw new Error('La fonction SQL n\'a retourné aucune valeur');
        }

        console.log(`[generateInvoiceNumberAtomic] Séquence générée: ${data} pour ${counterName}`);
        return data;
    } catch (error: any) {
        console.error('[generateInvoiceNumberAtomic] Erreur critique:', error);
        throw error;
    }
};

/**
 * Récupère le prochain numéro de séquence SANS l'incrémenter (pour preview)
 * @param dateStr - Date pour déterminer le scope du compteur
 * @returns Le prochain numéro qui SERA utilisé
 * @throws Error si la lecture échoue
 */
export const getNextSequenceCloud = async (dateStr: string | Date = new Date()): Promise<number> => {
    const counterName = getCounterName(dateStr);

    const { data, error } = await supabase
        .from('counters')
        .select('last_sequence')
        .eq('name', counterName)
        .maybeSingle();

    if (error) {
        console.error('[getNextSequenceCloud] Erreur lecture compteur:', error);
        throw new Error(`Échec lecture compteur: ${error.message}`);
    }

    // Si le compteur n'existe pas encore, le prochain sera 1
    // Si le compteur existe, le prochain sera last_sequence + 1
    const nextSeq = data ? data.last_sequence + 1 : 1;

    console.log(`[getNextSequenceCloud] Preview: ${nextSeq} pour ${counterName}`);
    return nextSeq;
};

export const deleteInvoiceCloud = async (id: string): Promise<boolean> => {
    const user = authService.getCurrentUser();
    if (!user) return false;

    const { error } = await supabase
        .from('invoices')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

    if (error) {
        console.error('Erreur deleteInvoiceCloud:', error);
        return false;
    }
    return true;
};


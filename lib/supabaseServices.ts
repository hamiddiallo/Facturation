import { supabase } from './supabase';
import { Company, InvoiceData, Article, InvoiceType } from './types';
import { authService } from './authService';
import { z } from 'zod';
import { normalizeText, normalizeEmail } from './textUtils';

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

    const { data, error } = await supabase
        .from('companies')
        .update(updates)
        .eq('id', id)
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
    const { error } = await supabase
        .from('companies')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Erreur deleteCompany:', error);
        return false;
    }

    return true;
};

// --- SERVICES FACTURES ---

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
        console.error('Validation saveInvoiceCloud échouée:', validated.error.message);
        return null;
    }

    const clean = validated.data;
    const user = authService.getCurrentUser();
    if (!user) return null;

    try {
        // 1. Vérifier si une facture avec ce numéro existe déjà pour cet utilisateur
        const { data: existingInv, error: searchError } = await supabase
            .from('invoices')
            .select('id')
            .eq('user_id', user.id)
            .eq('number', clean.numeroFacture)
            .maybeSingle();

        if (searchError) throw searchError;

        let invoiceId: string;

        if (existingInv) {
            // MODE UPDATE
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
            // MODE INSERT
            const { data: invData, error: invError } = await supabase
                .from('invoices')
                .insert([{
                    user_id: user.id,
                    company_id: companyId,
                    number: clean.numeroFacture,
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

export const getInvoicesCloud = async (): Promise<any[]> => {
    const { data, error } = await supabase
        .from('invoices')
        .select(`
            *,
            companies (display_name),
            invoice_items (*)
        `)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Erreur getInvoicesCloud:', error);
        return [];
    }

    return data || [];
};

export const getNextSequenceCloud = async (): Promise<number> => {
    // On cible le compteur nommé 'global' partagé par tous
    const { data, error } = await supabase
        .from('counters')
        .select('last_sequence')
        .eq('name', 'global')
        .single();

    let nextSeq = 1;
    if (data) {
        nextSeq = data.last_sequence + 1;
        await supabase
            .from('counters')
            .update({
                last_sequence: nextSeq,
                updated_at: new Date().toISOString()
            })
            .eq('name', 'global');
    } else {
        // Au cas où le compteur n'est pas encore initialisé
        await supabase.from('counters').insert({ name: 'global', last_sequence: 1 });
    }

    return nextSeq;
};

export const deleteInvoiceCloud = async (id: string): Promise<boolean> => {
    const { error } = await supabase
        .from('invoices')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Erreur deleteInvoiceCloud:', error);
        return false;
    }
    return true;
};


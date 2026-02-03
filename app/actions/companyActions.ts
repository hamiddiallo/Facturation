'use server';

import { createClient } from '@supabase/supabase-js';
// import { createSupabaseServerClient } from '@/lib/supabaseServer';
import { Company } from '@/lib/types';
import { z } from 'zod';
import { normalizeText, normalizeEmail } from '@/lib/textUtils';
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

export async function getCompaniesAction(): Promise<Company[]> {
    const session = await getServerSession();
    if (!session) return []; // Retour silencieux si non authentifié

    const { user, profile } = session;
    const supabase = getSupabaseAdmin();

    let query = supabase
        .from('companies')
        .select('*');

    // Isolation des données : Les admins voient tout, les users voient les leurs
    if (profile?.role !== 'admin') {
        query = query.eq('user_id', user.id);
    }

    const { data, error } = await query.order('created_at', { ascending: true });

    if (error) {
        console.error('Action getCompanies error:', error.message);
        return [];
    }

    return (data || []).map(mapCompany);
}

export async function createCompanyAction(company: Omit<Company, 'id'>): Promise<Company | null> {
    const { user } = await requireAuth();

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
        console.error('Validation Error:', validated.error);
        return null;
    }
    const clean = validated.data;

    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
        .from('companies')
        .insert([{
            user_id: user.id, // Toujours lier au profil actuel
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
        console.error('Action createCompany error:', error.message);
        return null;
    }
    return mapCompany(data);
}

export async function updateCompanyAction(id: string, company: Partial<Company>): Promise<Company | null> {
    const { user, profile } = await requireAuth();
    const supabase = getSupabaseAdmin();

    // Vérifier la propriété avant mise à jour
    const { data: existing } = await supabase.from('companies').select('user_id').eq('id', id).single();
    if (!existing || (existing.user_id !== user.id && profile?.role !== 'admin')) {
        throw new Error('Action non autorisée');
    }

    const updates: any = {};
    if (company.name !== undefined) updates.name = normalizeText(company.name);
    if (company.displayName !== undefined) updates.display_name = normalizeText(company.displayName);
    if (company.businessType !== undefined) updates.business_type = company.businessType;
    if (company.address !== undefined) updates.address = normalizeText(company.address);
    if (company.nif !== undefined) updates.nif = normalizeText(company.nif);
    if (company.phone !== undefined) updates.phone = normalizeText(company.phone);
    if (company.email !== undefined) updates.email = normalizeEmail(company.email);
    if (company.hasStyledLogo !== undefined) updates.has_styled_logo = company.hasStyledLogo;
    if (company.registrationNumbers !== undefined) updates.registration_numbers = normalizeText(company.registrationNumbers);
    if (company.sealImage !== undefined) updates.seal_image = company.sealImage;
    if (company.isDefault !== undefined) updates.is_default = company.isDefault;
    if (company.templateId !== undefined) updates.template_id = company.templateId;
    if (company.markupPercentage !== undefined) updates.markup_percentage = company.markupPercentage;

    const { data, error } = await supabase
        .from('companies')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

    if (error) return null;
    return mapCompany(data);
}

export async function deleteCompanyAction(id: string): Promise<boolean> {
    const { user, profile } = await requireAuth();
    const supabase = getSupabaseAdmin();

    let query = supabase.from('companies').delete().eq('id', id);

    if (profile?.role !== 'admin') {
        query = query.eq('user_id', user.id);
    }

    const { error } = await query;
    return !error;
}

export async function setDefaultCompanyAction(companyId: string): Promise<boolean> {
    const { user, profile } = await requireAuth();
    const supabase = getSupabaseAdmin();

    try {
        const { data: targetCompany, error: fetchError } = await supabase
            .from('companies')
            .select('user_id')
            .eq('id', companyId)
            .single();

        if (fetchError || !targetCompany) return false;

        // Sécurité: Un utilisateur ne peut modifier que ses propres préférences
        if (targetCompany.user_id !== user.id && profile?.role !== 'admin') {
            console.error('Unauthorized attempt to set default company');
            return false;
        }

        const userId = targetCompany.user_id;

        // Décocher toutes les entreprises de cet utilisateur
        const { error: resetError } = await supabase
            .from('companies')
            .update({ is_default: false })
            .eq('user_id', userId);

        if (resetError) return false;

        // Cocher la nouvelle entreprise par défaut
        const { error: setError } = await supabase
            .from('companies')
            .update({ is_default: true })
            .eq('id', companyId);

        return !setError;
    } catch (error: any) {
        console.error('Unexpected error in setDefaultCompanyAction:', error);
        return false;
    }
}

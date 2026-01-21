'use server';

import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { Company } from '@/lib/types';
import { z } from 'zod';
import { normalizeText, normalizeEmail } from '@/lib/textUtils';
import { verifyServerSession } from '@/lib/adminActions';

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
    const session = await verifyServerSession();
    if (!session) return [];

    const { data, error } = await supabaseAdmin
        .from('companies')
        .select('*')
        .eq('user_id', session.id)
        .order('created_at', { ascending: true });

    if (error) {
        console.error('Action getCompanies error:', error.message);
        return [];
    }

    return (data || []).map(mapCompany);
}

export async function createCompanyAction(company: Omit<Company, 'id'>): Promise<Company | null> {
    const session = await verifyServerSession();
    if (!session) return null;

    const validated = CompanySchema.safeParse({
        ...company,
        name: normalizeText(company.name),
        displayName: normalizeText(company.displayName),
        address: company.address ? normalizeText(company.address) : company.address,
        email: company.email ? normalizeEmail(company.email) : company.email,
        nif: company.nif ? normalizeText(company.nif) : company.nif,
        registrationNumbers: company.registrationNumbers ? normalizeText(company.registrationNumbers) : company.registrationNumbers
    });

    if (!validated.success) return null;
    const clean = validated.data;

    const { data, error } = await supabaseAdmin
        .from('companies')
        .insert([{
            user_id: session.id,
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

    if (error) return null;
    return mapCompany(data);
}

export async function updateCompanyAction(id: string, company: Partial<Company>): Promise<Company | null> {
    const session = await verifyServerSession();
    if (!session) return null;

    const updates: any = {};
    if (company.name !== undefined) updates.name = normalizeText(company.name);
    if (company.displayName !== undefined) updates.display_name = normalizeText(company.displayName);
    if (company.businessType !== undefined) updates.business_type = company.businessType;
    if (company.address !== undefined) updates.address = company.address ? normalizeText(company.address) : company.address;
    if (company.nif !== undefined) updates.nif = company.nif;
    if (company.phone !== undefined) updates.phone = company.phone;
    if (company.email !== undefined) updates.email = company.email ? normalizeEmail(company.email) : company.email;
    if (company.hasStyledLogo !== undefined) updates.has_styled_logo = company.hasStyledLogo;
    if (company.registrationNumbers !== undefined) updates.registration_numbers = company.registrationNumbers;
    if (company.sealImage !== undefined) updates.seal_image = company.sealImage;
    if (company.isDefault !== undefined) updates.is_default = company.isDefault;
    if (company.templateId !== undefined) updates.template_id = company.templateId;
    if (company.markupPercentage !== undefined) updates.markup_percentage = company.markupPercentage;

    const { data, error } = await supabaseAdmin
        .from('companies')
        .update(updates)
        .eq('id', id)
        .eq('user_id', session.id)
        .select()
        .single();

    if (error) return null;
    return mapCompany(data);
}

export async function deleteCompanyAction(id: string): Promise<boolean> {
    const session = await verifyServerSession();
    if (!session) return false;

    const { error } = await supabaseAdmin
        .from('companies')
        .delete()
        .eq('id', id)
        .eq('user_id', session.id);

    return !error;
}

export async function setDefaultCompanyAction(companyId: string): Promise<boolean> {
    const session = await verifyServerSession();
    if (!session) return false;

    // 1. Décocher toutes les autres
    await supabaseAdmin.from('companies').update({ is_default: false }).eq('user_id', session.id);

    // 2. Cocher la nouvelle
    const { error } = await supabaseAdmin.from('companies').update({ is_default: true }).eq('id', companyId).eq('user_id', session.id);

    return !error;
}

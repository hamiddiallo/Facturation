'use server';

import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { normalizeText, normalizeEmail } from './textUtils';
import { rateLimit } from './rateLimit';
import { requireAdmin, requireAuth, getServerSession } from './serverAuth';

// --- UTILITAIRES ---
const getSupabaseAdmin = () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    if (!url || !serviceRole) {
        console.error('CRITICAL: Supabase URL or Service Role Key is missing in ENV');
    }
    return createClient(url, serviceRole);
};


// Helper pour transformer les erreurs Zod en string lisible
const formatZodError = (error: z.ZodError): string => {
    return error.issues.map((err: any) => err.message).join('. ');
};

// --- SCHEMAS DE VALIDATION ---
const LoginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(5)
});

// Politique de sécurité : 8 caractères, 1 Maj, 1 Min, 1 Chiffre, 1 Spécial
const PasswordPolicy = z.string()
    .min(8, "Au moins 8 caractères")
    .regex(/[A-Z]/, "Au moins une majuscule")
    .regex(/[a-z]/, "Au moins une minuscule")
    .regex(/[0-9]/, "Au moins un chiffre")
    .regex(/[^A-Za-z0-9]/, "Au moins un caractère spécial");

const CreateUserSchema = z.object({
    email: z.string().email(),
    password: PasswordPolicy,
    fullName: z.string().min(2),
    role: z.enum(['admin', 'user'])
});

const UpdateUserSchema = z.object({
    fullName: z.string().min(2).optional(),
    email: z.string().email().optional(),
    role: z.enum(['admin', 'user']).optional(),
    status: z.enum(['active', 'inactive']).optional(),
    password: PasswordPolicy.optional(),
    avatar_url: z.string().nullable().optional()
});


export async function adminCreateUser(email: string, pass: string, fullName: string, role: string = 'user') {
    await requireAdmin();

    // Validation & Normalisation
    const validated = CreateUserSchema.safeParse({
        email: normalizeEmail(email),
        password: pass,
        fullName: normalizeText(fullName),
        role
    });

    if (!validated.success) {
        return { success: false, error: formatZodError(validated.error) };
    }

    // Rate Limiting : 10 créations / minute
    if (!rateLimit('admin_create_user', { max: 10, windowMs: 1000 * 60 })) {
        return { success: false, error: 'Trop de créations en peu de temps. Veuillez patienter.' };
    }

    const { email: cleanEmail, fullName: cleanName, password: cleanPass } = validated.data;
    const supabaseAdmin = getSupabaseAdmin();

    try {
        // Créer l'utilisateur via Supabase Auth Admin API
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email: cleanEmail,
            password: cleanPass,
            email_confirm: true, // Auto-confirmer l'email
            user_metadata: {
                full_name: cleanName,
                role: role
            }
        });

        if (authError) {
            if (authError.message.includes('already registered')) {
                return { success: false, error: 'Cet email est déjà utilisé.' };
            }
            throw authError;
        }

        // Le trigger handle_new_user créera automatiquement le profil
        if (role === 'admin') {
            await supabaseAdmin
                .from('profiles')
                .update({ role: 'admin' })
                .eq('id', authData.user.id);
        }

        return { success: true, userId: authData.user.id };
    } catch (err: any) {
        console.error('Erreur adminCreateUser:', err.message);
        return { success: false, error: 'Une erreur est survenue lors de la création.' };
    }
}

export async function adminDeleteUser(userId: string) {
    await requireAdmin();

    const supabaseAdmin = getSupabaseAdmin();

    try {
        // 1. Supprimer de auth.users
        const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);

        if (authError) {
            console.error('Erreur suppression auth.users:', authError.message);
        }

        // 2. Supprimer le profil
        const { error: profileError } = await supabaseAdmin
            .from('profiles')
            .delete()
            .eq('id', userId);

        if (profileError) throw profileError;

        return { success: true };
    } catch (err: any) {
        console.error('Erreur adminDeleteUser:', err.message);
        return { success: false, error: 'Erreur lors de la suppression.' };
    }
}

export async function adminListUsers() {
    const session = await getServerSession();
    if (!session || session.profile?.role !== 'admin') {
        return []; // Retour silencieux si non admin ou non authentifié
    }

    const supabaseAdmin = getSupabaseAdmin();
    const { data: profiles, error } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) throw error;
    return profiles;
}

export async function adminUpdateProfile(userId: string, data: { fullName?: string, email?: string, role?: string, status?: string, password?: string, avatar_url?: string }) {
    const { user, profile } = await requireAuth();

    // Sécurité: Seul l'utilisateur lui-même ou un admin peut modifier le profil
    if (userId !== user.id && profile?.role !== 'admin') {
        throw new Error('Action non autorisée');
    }

    // Validation & Normalisation
    const validated = UpdateUserSchema.safeParse({
        ...data,
        fullName: data.fullName ? normalizeText(data.fullName) : undefined,
        email: data.email ? normalizeEmail(data.email) : undefined
    });

    if (!validated.success) {
        return { success: false, error: formatZodError(validated.error) };
    }

    const cleanData = validated.data;
    const supabaseAdmin = getSupabaseAdmin();
    const updates: any = {
        updated_at: new Date().toISOString()
    };

    if (cleanData.fullName !== undefined) updates.full_name = cleanData.fullName;
    if (cleanData.email !== undefined) updates.email = cleanData.email;
    if (cleanData.role !== undefined && profile?.role === 'admin') updates.role = cleanData.role; // Seul admin peut changer le rôle
    if (cleanData.status !== undefined && profile?.role === 'admin') updates.status = cleanData.status; // Seul admin peut changer le statut
    if (cleanData.avatar_url !== undefined) updates.avatar_url = cleanData.avatar_url;

    try {
        // 1. Mettre à jour auth.users si email ou password change
        if (cleanData.email || cleanData.password) {
            const authUpdates: any = {};
            if (cleanData.email) authUpdates.email = cleanData.email;
            if (cleanData.password) authUpdates.password = cleanData.password;

            const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
                userId,
                authUpdates
            );

            if (authError) {
                console.error('Erreur mise à jour auth.users:', authError.message);
            }
        }

        // 2. Mettre à jour le profil
        const { error } = await supabaseAdmin
            .from('profiles')
            .update(updates)
            .eq('id', userId);

        if (error) {
            if (error.code === '23505') return { success: false, error: 'Cet email appartient déjà à un autre compte.' };
            throw error;
        }

        return { success: true };
    } catch (err: any) {
        console.error('Erreur adminUpdateProfile:', err.message);
        return { success: false, error: 'Erreur lors de la mise à jour.' };
    }
}

export async function uploadAvatarAction(formData: FormData) {
    const { user, profile } = await requireAuth();

    const file = formData.get('file') as File;
    const userId = formData.get('userId') as string;

    if (!file || !userId) throw new Error('Données manquantes');

    // Sécurité: Seul l'utilisateur ou un admin peut uploader l'avatar
    if (userId !== user.id && profile?.role !== 'admin') {
        throw new Error('Action non autorisée');
    }

    const supabaseAdmin = getSupabaseAdmin();
    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}_${Date.now()}.${fileExt}`;

    try {
        const { data, error } = await supabaseAdmin.storage
            .from('avatars')
            .upload(fileName, file, {
                contentType: file.type,
                upsert: true
            });

        if (error) throw error;

        const { data: urlData } = supabaseAdmin.storage
            .from('avatars')
            .getPublicUrl(fileName);

        return { success: true, publicUrl: urlData.publicUrl };
    } catch (e: any) {
        console.error('Erreur upload serveur:', e.message);
        throw e;
    }
}

export async function getProfileById(userId: string) {
    await requireAuth();

    const supabaseAdmin = getSupabaseAdmin();
    const { data: profile, error } = await supabaseAdmin
        .from('profiles')
        .select('id, email, full_name, role, status, avatar_url')
        .eq('id', userId)
        .single();

    if (error) throw error;
    return profile;
}

/**
 * Version silencieuse pour le boot de l'application (ne lève pas d'erreur si non authentifié)
 */
export async function getCurrentUserAction() {
    try {
        const { getServerSession } = await import('./serverAuth');
        const session = await getServerSession();
        return session?.profile || null;
    } catch (e) {
        return null;
    }
}



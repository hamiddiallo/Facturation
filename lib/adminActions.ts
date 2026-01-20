'use server';

import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { normalizeText, normalizeEmail } from './textUtils';
import { rateLimit } from './rateLimit';

// --- UTILITAIRES ---
const SESSION_COOKIE_NAME = 'facturation_auth_token';

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

export async function verifyCredentials(email: string, pass: string) {
    // Validation
    const validated = LoginSchema.safeParse({ email: normalizeEmail(email), password: pass });
    if (!validated.success) return { success: false, error: 'Format invalide.' };

    // Rate Limiting : 5 tentatives max / 5 minutes par email
    if (!rateLimit(`login_${validated.data.email}`, { max: 5, windowMs: 1000 * 60 * 5 })) {
        return { success: false, error: 'Trop de tentatives. Réessayez dans 5 minutes.' };
    }

    const supabaseAdmin = getSupabaseAdmin();

    try {
        // 1. Chercher le profil par email
        const { data: profile, error } = await supabaseAdmin
            .from('profiles')
            .select('*')
            .eq('email', email)
            .single();

        if (error || !profile) {
            // Ne logger en erreur que si ce n'est pas un simple "non trouvé" (PGRST116)
            if (error && error.code !== 'PGRST116') {
                console.error('Erreur SQL imprévue lors du login:', error.message);
            }
            return { success: false, error: 'Identifiants incorrects.' };
        }

        // 2. Vérifier le mot de passe
        const isMatch = await bcrypt.compare(pass, profile.password_hash);


        if (!isMatch) {
            return { success: false, error: 'Identifiants incorrects.' };
        }

        if (profile.status !== 'active') {
            return { success: false, error: 'Compte désactivé.' };
        }

        const user = {
            id: profile.id,
            email: profile.email,
            full_name: profile.full_name || '',
            role: profile.role,
            status: profile.status,
            avatar_url: profile.avatar_url
        };

        // 3. Définir le cookie de session (Sécurisé & HttpOnly)
        const cookieStore = await cookies();
        cookieStore.set(SESSION_COOKIE_NAME, JSON.stringify(user), {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 7, // 1 semaine
            path: '/'
        });

        // 4. Retourner les infos (SANS le password_hash)
        return {
            success: true,
            user
        };
    } catch (e: any) {
        console.error('Erreur fatale auth:', e?.message || e);
        return { success: false, error: 'Erreur technique serveur.' };
    }
}

export async function adminCreateUser(email: string, pass: string, fullName: string, role: string = 'user') {
    // Sécurité : Réservé aux admins
    const session = await verifyServerSession('admin');
    if (!session) return { success: false, error: 'Accès non autorisé.' };

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
        // 1. Hachage manuel
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(cleanPass, salt);

        // 2. Insertion directe dans VOTRE table profiles uniquement
        const { data, error } = await supabaseAdmin
            .from('profiles')
            .insert([{
                email: cleanEmail,
                password_hash: passwordHash,
                full_name: cleanName,
                role: role,
                status: 'active'
            }])
            .select()
            .single();

        if (error) {
            if (error.code === '23505') return { success: false, error: 'Cet email est déjà utilisé.' };
            throw error;
        }

        return { success: true, userId: data.id };
    } catch (err: any) {
        console.error('Erreur adminCreateUser:', err.message);
        return { success: false, error: 'Une erreur est survenue lors de la création.' };
    }
}

export async function adminDeleteUser(userId: string) {
    // Sécurité : Réservé aux admins
    const session = await verifyServerSession('admin');
    if (!session) throw new Error('Accès non autorisé.');

    const supabaseAdmin = getSupabaseAdmin();
    const { error } = await supabaseAdmin
        .from('profiles')
        .delete()
        .eq('id', userId);
    if (error) throw error;
    return { success: true };
}

export async function adminListUsers() {
    // Sécurité : Réservé aux admins
    const session = await verifyServerSession('admin');
    if (!session) throw new Error('Accès non autorisé.');

    const supabaseAdmin = getSupabaseAdmin();
    const { data: profiles, error } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) throw error;
    return profiles;
}

export async function adminUpdateProfile(userId: string, data: { fullName?: string, email?: string, role?: string, status?: string, password?: string, avatar_url?: string }) {
    // Sécurité : Réservé aux admins
    const session = await verifyServerSession('admin');
    if (!session) return { success: false, error: 'Accès non autorisé.' };

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
    if (cleanData.role !== undefined) updates.role = cleanData.role;
    if (cleanData.status !== undefined) updates.status = cleanData.status;
    if (cleanData.avatar_url !== undefined) updates.avatar_url = cleanData.avatar_url;

    if (cleanData.password) {
        const salt = await bcrypt.genSalt(10);
        updates.password_hash = await bcrypt.hash(cleanData.password, salt);
    }

    try {
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
    const file = formData.get('file') as File;
    const userId = formData.get('userId') as string;

    // Sécurité : Doit être l'utilisateur lui-même ou un admin
    const session = await verifyServerSession();
    if (!session || (session.id !== userId && session.role !== 'admin')) {
        throw new Error('Accès non autorisé.');
    }

    if (!file || !userId) throw new Error('Données manquantes');

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
    const supabaseAdmin = getSupabaseAdmin();
    const { data: profile, error } = await supabaseAdmin
        .from('profiles')
        .select('id, email, full_name, role, status, avatar_url')
        .eq('id', userId)
        .single();

    if (error) throw error;
    return profile;
}

export async function logoutAction() {
    const cookieStore = await cookies();
    cookieStore.delete(SESSION_COOKIE_NAME);
    return { success: true };
}

/**
 * Vérifie la session sur le serveur et retourne l'utilisateur.
 * À utiliser au début de chaque action sensible.
 */
export async function verifyServerSession(requiredRole?: 'admin' | 'user') {
    const cookieStore = await cookies();
    const session = cookieStore.get(SESSION_COOKIE_NAME);

    if (!session?.value) return null;

    try {
        const user = JSON.parse(session.value);
        if (requiredRole && user.role !== requiredRole && user.role !== 'admin') {
            return null;
        }
        return user;
    } catch {
        return null;
    }
}

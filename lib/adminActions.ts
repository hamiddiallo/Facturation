'use server';

import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { normalizeText, normalizeEmail } from './textUtils';
import { rateLimit } from './rateLimit';

// Client standard avec clé service pour gestion directe de la table profiles
const getSupabaseAdmin = () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    if (!url || !serviceRole) {
        console.error('CRITICAL: Supabase URL or Service Role Key is missing in ENV');
    }
    return createClient(url, serviceRole);
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
    password: PasswordPolicy.optional()
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

        // 3. Retourner les infos (SANS le password_hash)
        return {
            success: true,
            user: {
                id: profile.id,
                email: profile.email,
                full_name: profile.full_name || '',
                role: profile.role,
                status: profile.status
            }
        };
    } catch (e: any) {
        console.error('Erreur fatale auth:', e?.message || e);
        return { success: false, error: 'Erreur technique serveur.' };
    }
}

export async function adminCreateUser(email: string, pass: string, fullName: string, role: string = 'user') {
    // Validation & Normalisation
    const validated = CreateUserSchema.safeParse({
        email: normalizeEmail(email),
        password: pass,
        fullName: normalizeText(fullName),
        role
    });
    if (!validated.success) throw new Error('Données invalides : ' + validated.error.message);

    // Rate Limiting : 10 créations / minute
    if (!rateLimit('admin_create_user', { max: 10, windowMs: 1000 * 60 })) {
        throw new Error('Trop de créations en peu de temps. Veuillez patienter.');
    }

    const { email: cleanEmail, fullName: cleanName, password: cleanPass } = validated.data;
    const supabaseAdmin = getSupabaseAdmin();

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

    if (error) throw error;
    return { success: true, userId: data.id };
}

export async function adminDeleteUser(userId: string) {
    const supabaseAdmin = getSupabaseAdmin();
    const { error } = await supabaseAdmin
        .from('profiles')
        .delete()
        .eq('id', userId);
    if (error) throw error;
    return { success: true };
}

export async function adminListUsers() {
    const supabaseAdmin = getSupabaseAdmin();
    const { data: profiles, error } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) throw error;
    return profiles;
}

export async function adminUpdateProfile(userId: string, data: { fullName?: string, email?: string, role?: string, status?: string, password?: string }) {
    // Validation & Normalisation
    const validated = UpdateUserSchema.safeParse({
        ...data,
        fullName: data.fullName ? normalizeText(data.fullName) : undefined,
        email: data.email ? normalizeEmail(data.email) : undefined
    });
    if (!validated.success) throw new Error('Données invalides : ' + validated.error.message);

    const cleanData = validated.data;
    const supabaseAdmin = getSupabaseAdmin();
    const updates: any = {
        updated_at: new Date().toISOString()
    };

    if (cleanData.fullName !== undefined) updates.full_name = cleanData.fullName;
    if (cleanData.email !== undefined) updates.email = cleanData.email;
    if (cleanData.role !== undefined) updates.role = cleanData.role;
    if (cleanData.status !== undefined) updates.status = cleanData.status;

    if (cleanData.password) {
        const salt = await bcrypt.genSalt(10);
        updates.password_hash = await bcrypt.hash(cleanData.password, salt);
    }

    const { error } = await supabaseAdmin
        .from('profiles')
        .update(updates)
        .eq('id', userId);

    if (error) throw error;
    return { success: true };
}

export async function getProfileById(userId: string) {
    const supabaseAdmin = getSupabaseAdmin();
    const { data: profile, error } = await supabaseAdmin
        .from('profiles')
        .select('id, email, full_name, role, status')
        .eq('id', userId)
        .single();

    if (error) throw error;
    return profile;
}

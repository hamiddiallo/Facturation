'use server';

import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { normalizeText, normalizeEmail } from './textUtils';
import { rateLimit } from './rateLimit';
import { requireAdmin, requireAuth, getServerSession } from './serverAuth';

export type Role = 'admin' | 'user';
export type Status = 'active' | 'inactive';

export type ProfileRow = {
    id: string;
    email: string;
    full_name: string | null;
    role: Role;
    status: Status;
    avatar_url: string | null;
};

type UpdateProfileInput = {
    fullName?: string;
    email?: string;
    role?: Role;
    status?: Status;
    password?: string;
    avatar_url?: string;
};

type ActionResult = {
    success: boolean;
    error?: string;
};

type CreateUserResult = ActionResult & {
    userId?: string;
};

type UploadAvatarResult = ActionResult & {
    publicUrl?: string;
};

const getSupabaseAdmin = () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    if (!url || !serviceRole) {
        throw new Error('CRITICAL: Supabase URL or Service Role Key is missing in ENV');
    }
    return createClient(url, serviceRole);
};

const formatZodError = (error: z.ZodError): string => {
    return error.issues.map((issue) => issue.message).join('. ');
};

// Politique de sécurité : 8 caractères, 1 Maj, 1 Min, 1 Chiffre, 1 Spécial
const PasswordPolicy = z.string()
    .min(8, 'Au moins 8 caractères')
    .regex(/[A-Z]/, 'Au moins une majuscule')
    .regex(/[a-z]/, 'Au moins une minuscule')
    .regex(/[0-9]/, 'Au moins un chiffre')
    .regex(/[^A-Za-z0-9]/, 'Au moins un caractère spécial');

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

export async function adminCreateUser(email: string, pass: string, fullName: string, role: Role = 'user'): Promise<CreateUserResult> {
    await requireAdmin();

    const validated = CreateUserSchema.safeParse({
        email: normalizeEmail(email),
        password: pass,
        fullName: normalizeText(fullName),
        role
    });

    if (!validated.success) {
        return { success: false, error: formatZodError(validated.error) };
    }

    // Rate limiting : 10 créations / minute
    if (!rateLimit('admin_create_user', { max: 10, windowMs: 60_000 })) {
        return { success: false, error: 'Trop de créations en peu de temps. Veuillez patienter.' };
    }

    const { email: cleanEmail, fullName: cleanName, password: cleanPass, role: cleanRole } = validated.data;
    const supabaseAdmin = getSupabaseAdmin();

    try {
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email: cleanEmail,
            password: cleanPass,
            email_confirm: true,
            app_metadata: {
                role: cleanRole
            },
            user_metadata: {
                full_name: cleanName,
                role: cleanRole
            }
        });

        if (authError) {
            if (authError.message.includes('already registered')) {
                return { success: false, error: 'Cet email est déjà utilisé.' };
            }
            throw authError;
        }

        if (cleanRole === 'admin') {
            await supabaseAdmin
                .from('profiles')
                .update({ role: 'admin' })
                .eq('id', authData.user.id);
        }

        return { success: true, userId: authData.user.id };
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Erreur inconnue';
        console.error('Erreur adminCreateUser:', message);
        return { success: false, error: 'Une erreur est survenue lors de la création.' };
    }
}

export async function adminDeleteUser(userId: string): Promise<ActionResult> {
    await requireAdmin();
    const supabaseAdmin = getSupabaseAdmin();

    try {
        const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);
        if (authError) {
            console.error('Erreur suppression auth.users:', authError.message);
        }

        const { error: profileError } = await supabaseAdmin
            .from('profiles')
            .delete()
            .eq('id', userId);

        if (profileError) throw profileError;
        return { success: true };
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Erreur inconnue';
        console.error('Erreur adminDeleteUser:', message);
        return { success: false, error: 'Erreur lors de la suppression.' };
    }
}

export async function adminListUsers(): Promise<ProfileRow[]> {
    const session = await getServerSession();
    if (!session || session.profile?.role !== 'admin') {
        return [];
    }

    const supabaseAdmin = getSupabaseAdmin();
    const { data: profiles, error } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) throw error;
    return (profiles as ProfileRow[] | null) || [];
}

export async function adminUpdateProfile(userId: string, data: UpdateProfileInput): Promise<ActionResult> {
    const { user, profile } = await requireAuth();

    // Seul l'utilisateur lui-même ou un admin peut modifier ce profil
    if (userId !== user.id && profile?.role !== 'admin') {
        throw new Error('Action non autorisée');
    }

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

    const updates: {
        updated_at: string;
        full_name?: string;
        email?: string;
        role?: Role;
        status?: Status;
        avatar_url?: string | null;
    } = {
        updated_at: new Date().toISOString()
    };

    if (cleanData.fullName !== undefined) updates.full_name = cleanData.fullName;
    if (cleanData.email !== undefined) updates.email = cleanData.email;
    if (cleanData.role !== undefined && profile?.role === 'admin') updates.role = cleanData.role;
    if (cleanData.status !== undefined && profile?.role === 'admin') updates.status = cleanData.status;
    if (cleanData.avatar_url !== undefined) updates.avatar_url = cleanData.avatar_url;

    try {
        if (
            cleanData.email ||
            cleanData.password ||
            cleanData.role !== undefined ||
            cleanData.fullName !== undefined
        ) {
            const authUpdates: {
                email?: string;
                password?: string;
                user_metadata?: Record<string, unknown>;
                app_metadata?: Record<string, unknown>;
            } = {};
            if (cleanData.email) authUpdates.email = cleanData.email;
            if (cleanData.password) authUpdates.password = cleanData.password;
            if (cleanData.role !== undefined || cleanData.fullName !== undefined) {
                const { data: authUserData, error: getAuthUserError } = await supabaseAdmin.auth.admin.getUserById(userId);
                if (getAuthUserError) {
                    console.error('Erreur lecture auth.users pour sync metadata:', getAuthUserError.message);
                }

                const nextUserMetadata: Record<string, unknown> = {
                    ...(authUserData?.user?.user_metadata || {})
                };
                const nextAppMetadata: Record<string, unknown> = {
                    ...(authUserData?.user?.app_metadata || {})
                };

                if (cleanData.fullName !== undefined) {
                    nextUserMetadata.full_name = cleanData.fullName;
                }

                if (cleanData.role !== undefined) {
                    nextUserMetadata.role = cleanData.role;
                    nextAppMetadata.role = cleanData.role;
                }

                authUpdates.user_metadata = nextUserMetadata;
                authUpdates.app_metadata = nextAppMetadata;
            }

            const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(userId, authUpdates);
            if (authError) {
                console.error('Erreur mise à jour auth.users:', authError.message);
            }
        }

        const { error } = await supabaseAdmin
            .from('profiles')
            .update(updates)
            .eq('id', userId);

        if (error) {
            if (error.code === '23505') {
                return { success: false, error: 'Cet email appartient déjà à un autre compte.' };
            }
            throw error;
        }

        return { success: true };
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Erreur lors de la mise à jour.';
        console.error('Erreur adminUpdateProfile:', message);
        return { success: false, error: message };
    }
}

export async function uploadAvatarAction(formData: FormData): Promise<UploadAvatarResult> {
    const { user, profile } = await requireAuth();

    const file = formData.get('file');
    const userId = formData.get('userId');

    if (!(file instanceof File) || typeof userId !== 'string' || userId.length === 0) {
        throw new Error('Données manquantes');
    }

    if (userId !== user.id && profile?.role !== 'admin') {
        throw new Error('Action non autorisée');
    }

    const supabaseAdmin = getSupabaseAdmin();
    const fileExt = file.name.split('.').pop() || 'jpg';
    const fileName = `${userId}_${Date.now()}.${fileExt}`;

    try {
        const { error } = await supabaseAdmin.storage
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
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Erreur upload serveur';
        console.error('Erreur upload serveur:', message);
        throw e;
    }
}

export async function getProfileById(userId: string): Promise<ProfileRow | null> {
    const { user, profile: sessionProfile } = await requireAuth();
    if (userId !== user.id && sessionProfile?.role !== 'admin') {
        throw new Error('Action non autorisée');
    }

    const supabaseAdmin = getSupabaseAdmin();
    const { data: profile, error } = await supabaseAdmin
        .from('profiles')
        .select('id, email, full_name, role, status, avatar_url')
        .eq('id', userId)
        .single();

    if (error) throw error;
    return (profile as ProfileRow) || null;
}

/**
 * Version silencieuse pour le boot de l'application (ne lève pas d'erreur si non authentifié)
 */
export async function getCurrentUserAction(): Promise<ProfileRow | null> {
    try {
        const { getServerSession: getSession } = await import('./serverAuth');
        const session = await getSession();
        if (!session?.profile) return null;
        return session.profile as ProfileRow;
    } catch {
        return null;
    }
}

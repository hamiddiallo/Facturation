import { createSupabaseServerClient } from './supabaseServer';
import { createClient } from '@supabase/supabase-js';

/**
 * Utilité pour récupérer l'utilisateur et son profil côté serveur.
 * Utilise les cookies pour valider la session Supabase Auth.
 */
export async function getServerSession() {
    const supabaseClient = await createSupabaseServerClient();

    // 1. Récupérer l'utilisateur authentifié
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();

    if (authError || !user) {
        return null;
    }

    // 2. Récupérer son profil pour connaître son rôle
    // On utilise le service role ici pour être sûr de lire le profil même si RLS est strict
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    const supabaseAdmin = createClient(url, serviceRole);

    const { data: profile, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

    if (profileError || !profile) {
        console.error('Error fetching server profile:', profileError);
        return { user, profile: null };
    }

    return { user, profile };
}

/**
 * Protège une Server Action en vérifiant l'authentification.
 * @throws Error si non authentifié ou suspendu
 */
export async function requireAuth() {
    const session = await getServerSession();

    if (!session || !session.user) {
        throw new Error('Non authentifié');
    }

    if (session.profile?.status === 'suspended') {
        throw new Error('Compte suspendu');
    }

    return session;
}

/**
 * Protège une Server Action en vérifiant le rôle administrateur.
 * @throws Error si non admin
 */
export async function requireAdmin() {
    const session = await requireAuth();

    if (session.profile?.role !== 'admin') {
        throw new Error('Accès réservé aux administrateurs');
    }

    return session;
}

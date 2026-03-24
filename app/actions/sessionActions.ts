'use server';

import { createSupabaseServerClient } from '@/lib/supabaseServer';
import { createClient } from '@supabase/supabase-js';

/**
 * Vérifie la validité de la session côté serveur via les cookies httpOnly.
 * getUser() valide le JWT auprès des serveurs Supabase — aucune lecture localStorage.
 * Returns { valid: true, userId } or { valid: false }
 */
export async function checkSessionAction(): Promise<{ valid: boolean; userId?: string }> {
    try {
        const supabase = await createSupabaseServerClient();
        // getUser() makes a network call to Supabase to verify the JWT via httpOnly cookies
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error || !user) return { valid: false };

        // Fail-closed: a valid JWT is not enough if profile is missing/inactive.
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
        const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
        if (!url || !serviceRole) return { valid: false };

        const supabaseAdmin = createClient(url, serviceRole);
        const { data: profile, error: profileError } = await supabaseAdmin
            .from('profiles')
            .select('id, role, status')
            .eq('id', user.id)
            .single();

        if (profileError || !profile || profile.status !== 'active') {
            return { valid: false };
        }

        // Session compromise guard:
        // if JWT role claim exists and diverges from DB role, invalidate session.
        const appRole = user.app_metadata?.role;
        const userRole = user.user_metadata?.role;
        const tokenRole = typeof appRole === 'string'
            ? appRole
            : typeof userRole === 'string'
                ? userRole
                : null;

        if (tokenRole && tokenRole !== profile.role) {
            return { valid: false };
        }

        return { valid: true, userId: user.id };
    } catch {
        return { valid: false };
    }
}

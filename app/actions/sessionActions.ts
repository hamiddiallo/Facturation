'use server';

import { createSupabaseServerClient } from '@/lib/supabaseServer';
import { createClient } from '@supabase/supabase-js';

/**
 * Vérifie la validité de la session côté serveur via les cookies httpOnly.
 * getUser() valide le JWT auprès des serveurs Supabase — aucune lecture localStorage.
 * Returns { valid: true, userId } or { valid: false }
 */
type SessionCheckResult =
    | { valid: true; userId: string; role: string; status: string }
    | { valid: false; transient?: boolean; reason?: string };

function isTransientAuthFailure(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error || '');
    return /fetch|network|timeout|ECONN|ENOTFOUND|Failed to fetch|connection/i.test(message);
}

export async function checkSessionAction(): Promise<SessionCheckResult> {
    try {
        const supabase = await createSupabaseServerClient();
        // getUser() makes a network call to Supabase to verify the JWT via httpOnly cookies
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error) return { valid: false, transient: isTransientAuthFailure(error), reason: 'auth_get_user_error' };
        if (!user) return { valid: false, reason: 'no_user' };

        // Fail-closed: a valid JWT is not enough if profile is missing/inactive.
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
        const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
        if (!url || !serviceRole) return { valid: false, reason: 'missing_env' };

        const supabaseAdmin = createClient(url, serviceRole);
        const { data: profile, error: profileError } = await supabaseAdmin
            .from('profiles')
            .select('id, role, status')
            .eq('id', user.id)
            .single();

        if (profileError || !profile || profile.status !== 'active') {
            if (profileError && isTransientAuthFailure(profileError)) {
                return { valid: false, transient: true };
            }
            return { valid: false, reason: 'profile_missing_or_inactive' };
        }

        // Session compromise guard:
        // if JWT role claim exists and diverges from DB role, invalidate session.
        // IMPORTANT: only trust server-managed app_metadata claims.
        const tokenRole = typeof user.app_metadata?.role === 'string'
            ? user.app_metadata.role
            : null;

        // Invalidate only potential privilege escalation attempts.
        if (tokenRole === 'admin' && profile.role !== 'admin') {
            return { valid: false, reason: 'privilege_mismatch' };
        }

        return { valid: true, userId: user.id, role: profile.role, status: profile.status };
    } catch (error) {
        return { valid: false, transient: isTransientAuthFailure(error), reason: 'unexpected_exception' };
    }
}

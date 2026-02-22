'use server';

import { createSupabaseServerClient } from '@/lib/supabaseServer';

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
        return { valid: true, userId: user.id };
    } catch {
        return { valid: false };
    }
}

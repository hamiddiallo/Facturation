import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseServiceKey) {
    if (typeof window === 'undefined') {
        console.warn('Supabase Admin: URL or Service Role Key is missing. Check your environment variables.');
    }
}

/**
 * Client Supabase avec les privilèges admin (service_role).
 * À UTILISER EXCLUSIVEMENT CÔTÉ SERVEUR.
 * Ce client bypass le RLS (Row Level Security).
 */
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

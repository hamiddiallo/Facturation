'use client';

import { supabase } from './supabase';

export interface UserProfile {
    id: string;
    email: string;
    full_name: string;
    role: string;
    status: string;
    avatar_url?: string;
}

export const authService = {
    // Login avec Supabase Auth
    async login(email: string, password: string): Promise<{ success: boolean; error?: string; user?: UserProfile }> {
        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password
            });

            if (error) throw error;

            // Récupérer le profil complet directement via le client (RLS s'applique)
            // On évite la Server Action ici car le cookie de session n'est pas encore synchronisé
            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', data.user.id)
                .single();

            if (profileError || !profile || profile.status !== 'active') {
                await supabase.auth.signOut({ scope: 'local' });
                if (typeof window !== 'undefined') {
                    try {
                        await fetch('/auth/logout?reason=inactive', {
                            method: 'POST',
                            credentials: 'include',
                            cache: 'no-store',
                            keepalive: true
                        });
                    } catch {
                        // Ignore: le fallback client gardera l'utilisateur sur l'écran de login.
                    }
                }
                return { success: false, error: 'Compte inactif ou inaccessible' };
            }

            return { success: true, user: profile as UserProfile };
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : 'Identifiants incorrects';
            return { success: false, error: message };
        }
    },

    // Déconnexion robuste
    async logout() {
        try {
            // On lance le signOut mais on ne bloque pas forcément l'exécution totale
            // si l'API est trop lente, car on nettoie le local quoi qu'il arrive
            await supabase.auth.signOut();
        } catch (e) {
            console.error('Logout API error:', e);
        } finally {
            // Nettoyer systématiquement le localStorage
            if (typeof window !== 'undefined') {
                localStorage.removeItem('app_user_session');
                // Optionnel: vider tous les cookies sb-* si nécessaire
            }
        }
    },

    // Récupérer l'utilisateur actuel
    // ⚠️ Utilise getUser() (validation réseau) et NON getSession() (cache local)
    // getSession() ne détecte PAS les tokens révoqués/compromis car il lit uniquement
    // le localStorage/mémoire sans aucun appel serveur.
    async getCurrentUser(): Promise<UserProfile | null> {
        try {
            const { data: { user }, error: authError } = await supabase.auth.getUser();
            if (authError || !user) return null;

            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single();

            if (profileError || !profile || profile.status !== 'active') {
                return null;
            }

            // --- VÉRIFICATION DE COMPROMISSION (ROLE MISMATCH) ---
            // Si le token (JWT) prétend avoir un rôle X mais que la DB a un rôle Y,
            // la session est compromise (ex: admin rétrogradé en user_simple, ou JWT falsifié).
            // IMPORTANT: on ne fait confiance qu'à app_metadata (claim serveur).
            // user_metadata est modifiable côté utilisateur et peut être désynchronisé.
            const tokenRole = typeof user.app_metadata?.role === 'string'
                ? user.app_metadata.role
                : null;

            // On invalide seulement les cas de sur-privilège (token admin mais DB non-admin).
            // Cela protège contre l'élévation de privilège tout en tolérant un claim "user"
            // ancien lorsque le profil DB est admin.
            if (tokenRole === 'admin' && profile.role !== 'admin') {
                console.warn(`[Security] Privilege mismatch detected! Token: ${tokenRole}, DB: ${profile.role}`);
                return null;
            }

            return profile as UserProfile;
        } catch (error) {
            console.error('Error fetching current user:', error);
            return null;
        }
    },

    // Récupérer la session Supabase
    async getSession() {
        const { data: { session } } = await supabase.auth.getSession();
        return session;
    },

    // Vérification de validité via appel réseau (valide le JWT auprès de Supabase)
    // getUser() est plus fiable que getSession() pour détecter les tokens révoqués
    async isSessionValid(): Promise<boolean> {
        const { data: { user }, error } = await supabase.auth.getUser();
        return !error && !!user;
    }
};

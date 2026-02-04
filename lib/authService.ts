'use client';

import { supabase } from './supabase';
import { getProfileById, getCurrentUserAction } from './adminActions';

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
                await supabase.auth.signOut();
                return { success: false, error: 'Compte inactif ou inaccessible' };
            }

            return { success: true, user: profile as UserProfile };
        } catch (e: any) {
            return { success: false, error: e.message || 'Identifiants incorrects' };
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
    async getCurrentUser(): Promise<UserProfile | null> {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return null;

            // Fetch du profil via le client pour éviter les erreurs de synchro cookies au rafraîchissement
            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', session.user.id)
                .single();

            if (profileError || !profile || profile.status !== 'active') {
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

    // Vérification rapide de validité (sans appel réseau si possible)
    async isSessionValid(): Promise<boolean> {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return false;

        // Vérifier si le token expire dans moins de 10 secondes
        const expiresAt = session.expires_at || 0;
        const now = Math.floor(Date.now() / 1000);
        return (expiresAt - now) > 10;
    }
};

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

    // Déconnexion
    async logout() {
        await supabase.auth.signOut();
        // Nettoyer aussi le legacy localStorage au cas où
        if (typeof window !== 'undefined') {
            localStorage.removeItem('app_user_session');
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
    }
};

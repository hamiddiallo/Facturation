'use client';

import { verifyCredentials } from './adminActions';

export interface UserProfile {
    id: string;
    email: string;
    full_name: string;
    role: string;
    status: string;
}

const SESSION_KEY = 'app_user_session';

export const authService = {
    // Connexion via Action Serveur (Bypass RLS & Sécurisé)
    async login(email: string, pass: string): Promise<{ success: boolean; error?: string }> {
        try {
            // On appelle l'action serveur qui utilise la Service Role Key
            const result = await verifyCredentials(email, pass);

            if (result.success && result.user) {
                localStorage.setItem(SESSION_KEY, JSON.stringify(result.user));
                return { success: true };
            } else {
                return { success: false, error: result.error || 'Identifiants invalides.' };
            }
        } catch (e) {
            return { success: false, error: 'Serveur injoignable ou erreur technique.' };
        }
    },

    // Déconnexion
    logout() {
        localStorage.removeItem(SESSION_KEY);
        window.location.href = '/login';
    },

    // Récupérer l'utilisateur actuel
    getCurrentUser(): UserProfile | null {
        if (typeof window === 'undefined') return null;
        const data = localStorage.getItem(SESSION_KEY);
        if (!data) return null;
        try {
            return JSON.parse(data);
        } catch {
            return null;
        }
    },

    // Rafraîchir les infos de session depuis la DB
    async refreshSession(): Promise<UserProfile | null> {
        if (typeof window === 'undefined') return null;
        const current = this.getCurrentUser();
        if (!current) return null;

        try {
            const { getProfileById } = await import('./adminActions');
            const freshProfile = await getProfileById(current.id);

            if (freshProfile) {
                localStorage.setItem(SESSION_KEY, JSON.stringify(freshProfile));
                return freshProfile;
            }
        } catch (e) {
            console.error('Erreur rafraîchissement session:', e);
        }
        return current;
    }
};

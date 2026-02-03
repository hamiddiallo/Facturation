'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { authService, UserProfile } from '@/lib/authService';
import { supabase } from '@/lib/supabase';

const AuthContext = createContext<{
    profile: UserProfile | null;
    loading: boolean;
    signOut: () => void;
}>({
    profile: null,
    loading: true,
    signOut: () => { },
});

export const useAuth = () => useContext(AuthContext);

export default function AuthProvider({ children }: { children: React.ReactNode }) {
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        // Vérification initiale
        authService.getCurrentUser().then(user => {
            setProfile(user);
            setLoading(false);

            if (!user && pathname !== '/login') {
                router.push('/login');
            }
        });

        // Écouter les changements d'état d'authentification
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, session) => {
                console.log('Auth event:', event, 'Session:', session ? 'exists' : 'null');

                // Ignorer INITIAL_SESSION car il se déclenche toujours au démarrage
                if (event === 'INITIAL_SESSION') {
                    return;
                }

                if (event === 'SIGNED_OUT') {
                    // Mettre à jour l'état local et rediriger immédiatement
                    setProfile(null);
                    localStorage.removeItem('app_user_session');
                    if (pathname !== '/login') {
                        router.push('/login');
                    }
                } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
                    // ... (reste inchangé)
                    try {
                        const user = await authService.getCurrentUser();
                        if (user) {
                            setProfile(user);
                        }
                    } catch (error) {
                        console.error('Erreur récupération profil:', error);
                    }
                }
            }
        );

        return () => subscription.unsubscribe();
    }, [pathname, router]);

    const signOut = async () => {
        try {
            await authService.logout();
        } catch (error) {
            console.error('Erreur lors de la déconnexion:', error);
        } finally {
            // Force le nettoyage et la redirection même en cas d'erreur API
            setProfile(null);
            if (typeof window !== 'undefined') {
                localStorage.removeItem('app_user_session');
            }
            router.refresh(); // Vider le cache du routeur
            router.push('/login');
        }
    };

    if (loading && pathname !== '/login') {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#f7fafc' }}>
                <p>Chargement de votre espace de travail...</p>
            </div>
        );
    }

    return (
        <AuthContext.Provider value={{ profile, loading, signOut }}>
            {children}
        </AuthContext.Provider>
    );
}

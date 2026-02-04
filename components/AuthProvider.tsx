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

                if (event === 'INITIAL_SESSION') return;

                if (event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
                    setProfile(null);
                    if (pathname !== '/login') router.push('/login');
                } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
                    const user = await authService.getCurrentUser();
                    setProfile(user);
                    if (!user && pathname !== '/login') router.push('/login');
                }
            }
        );

        // Watchdog : Vérification proactive toutes les 2 minutes
        const watchdog = setInterval(async () => {
            if (pathname === '/login') return;
            const isValid = await authService.isSessionValid();
            if (!isValid) {
                console.warn('Session expirée détectée par le Watchdog');
                setProfile(null);
                router.push('/login');
            }
        }, 120000); // 2 minutes

        return () => {
            subscription.unsubscribe();
            clearInterval(watchdog);
        };
    }, [pathname, router]);

    const signOut = async () => {
        console.log('🚪 Déclenchement déconnexion Master...');

        // 1. Mise à jour immédiate de l'état local (UI instantanée)
        setProfile(null);
        if (typeof window !== 'undefined') {
            localStorage.removeItem('app_user_session');
        }

        try {
            // 2. Tentative de déconnexion API (timeout 5s)
            // On utilise Promise.race pour ne pas bloquer l'utilisateur si le réseau est lent
            await Promise.race([
                authService.logout(),
                new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT_API_LOGOUT')), 5000))
            ]);
            console.log('✅ Déconnexion API réussie.');
        } catch (error: any) {
            if (error.message === 'TIMEOUT_API_LOGOUT') {
                console.warn('ℹ️ Déconnexion API trop lente (5s+) : Session locale nettoyée par précaution.');
            } else {
                console.warn('⚠️ Erreur déconnexion API (ignorée car locale OK):', error);
            }
        } finally {
            // 3. Redirection finale
            console.log('🏠 Redirection vers /login...');
            router.refresh();
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

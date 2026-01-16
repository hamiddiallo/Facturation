'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { authService, UserProfile } from '@/lib/authService';

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
        const checkAuth = async () => {
            // 1. Récupérer l'utilisateur local
            let currentUser = authService.getCurrentUser();

            if (currentUser) {
                // 2. Vérifier et rafraîchir en temps réel avec la DB
                try {
                    const freshProfile = await authService.refreshSession();

                    if (!freshProfile || freshProfile.status !== 'active') {
                        // Utilisateur supprimé ou désactivé -> Déconnexion immédiate
                        signOut();
                        return;
                    }

                    currentUser = freshProfile;
                } catch (e) {
                    console.error('Erreur vérification profil:', e);
                }
            }

            setProfile(currentUser);
            setLoading(false);

            if (!currentUser && pathname !== '/login') {
                router.push('/login');
            }
        };

        checkAuth();
    }, [pathname, router]);

    const signOut = () => {
        authService.logout();
        router.push('/login');
    };

    if (loading && pathname !== '/login') {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#f7fafc' }}>
                <p>Chargement de votre espace sécurisé (Profiles-Only)...</p>
            </div>
        );
    }

    return (
        <AuthContext.Provider value={{ profile, loading, signOut }}>
            {children}
        </AuthContext.Provider>
    );
}

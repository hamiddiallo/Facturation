'use client';

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { authService, UserProfile } from '@/lib/authService';
import { supabase } from '@/lib/supabase';
import { checkSessionAction } from '@/app/actions/sessionActions';

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
    // Ref so long-lived callbacks always read the current pathname
    const pathnameRef = useRef(pathname);
    pathnameRef.current = pathname;

    // ─── Effect 1: Auth subscription + Watchdog (mounted ONCE) ─────────────────
    useEffect(() => {
        let isMounted = true;

        const FETCH_TIMEOUT_MS = 6000;

        /**
         * Fetch profile with a timeout to prevent infinite loading screen.
         * If Supabase is slow/unreachable the app falls back to login instead of hanging.
         */
        const fetchProfile = async (): Promise<UserProfile | null> => {
            try {
                const timeout = new Promise<null>(resolve =>
                    setTimeout(() => resolve(null), FETCH_TIMEOUT_MS)
                );
                return await Promise.race([authService.getCurrentUser(), timeout]);
            } catch {
                return null;
            }
        };

        // ── Auth state listener (INITIAL_SESSION is the primary auth check) ────
        // INITIAL_SESSION fires immediately on mount from localStorage — no network.
        // Using it avoids a separate getCurrentUser() call with fragile timeouts.
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, session) => {
                if (!isMounted) return;
                console.log('Auth event:', event, session ? '(session)' : '(no session)');

                if (event === 'INITIAL_SESSION') {
                    if (session) {
                        // Valid session found locally — fetch profile (one network call)
                        const user = await fetchProfile();
                        if (!isMounted) return;
                        setProfile(user);
                        setLoading(false);
                        if (!user && pathnameRef.current !== '/login') {
                            router.replace('/login');
                        }
                    } else {
                        // No session at all
                        setProfile(null);
                        setLoading(false);
                        if (pathnameRef.current !== '/login') router.replace('/login');
                    }
                    return;
                }

                if (event === 'SIGNED_OUT') {
                    setProfile(null);
                    setLoading(false);
                    if (pathnameRef.current !== '/login') router.replace('/login');
                } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
                    const user = await fetchProfile();
                    if (!isMounted) return;
                    setProfile(user);
                    setLoading(false);
                    if (!user && pathnameRef.current !== '/login') router.replace('/login');
                } else if (event === 'USER_UPDATED') {
                    // Only refresh profile — do NOT sign out
                    const user = await fetchProfile();
                    if (isMounted) setProfile(user);
                }
            }
        );

        // ── Session check helper (used by watchdog + visibility listener) ──────
        // Verification goes through the server via httpOnly cookies, not localStorage
        const checkSession = async () => {
            if (pathnameRef.current === '/login') return;

            // Skip when offline — httpOnly cookie session remains valid locally
            if (typeof navigator !== 'undefined' && !navigator.onLine) {
                console.info('Session check: device offline, skipping.');
                return;
            }

            // Server-side check via httpOnly cookie (not localStorage)
            const result = await checkSessionAction();
            if (!result.valid) {
                console.warn('Session check: server reports session invalid.');
                // Attempt a client-side token refresh before giving up
                const { error } = await supabase.auth.refreshSession();
                if (error) {
                    console.error('Session check: silent refresh failed, redirecting.', error);
                    if (isMounted) { setProfile(null); router.replace('/login'); }
                } else {
                    console.info('Session check: token refreshed silently.');
                }
            }
        };

        // ── Watchdog: every 5 minutes, offline-safe ────────────────────────────
        const watchdog = setInterval(checkSession, 5 * 60 * 1000);

        // ── Visibility change: fires when user returns to the app ─────────────
        // Primary fix for "idle then crash/freeze" in standalone PWA mode
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                checkSession();
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            isMounted = false;
            subscription.unsubscribe();
            clearInterval(watchdog);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Intentionally empty — pathnameRef tracks current route

    // ─── Effect 2: Routing guard ───────────────────────────────────────────────
    useEffect(() => {
        if (!loading && !profile && pathname !== '/login') {
            router.replace('/login');
        }
    }, [loading, profile, pathname, router]);

    // ─── Sign out ─────────────────────────────────────────────────────────────
    const signOut = async () => {
        console.log('🚪 Déconnexion...');

        setProfile(null);
        if (typeof window !== 'undefined') {
            localStorage.removeItem('app_user_session');
        }

        try {
            await Promise.race([
                authService.logout(),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('TIMEOUT_API_LOGOUT')), 5000)
                )
            ]);
            console.log('✅ Déconnexion API réussie.');
        } catch (error: any) {
            console.warn('⚠️ Erreur déconnexion:', error.message);
        } finally {
            // No router.refresh() — it freezes standalone PWA on slow networks
            router.replace('/login');
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

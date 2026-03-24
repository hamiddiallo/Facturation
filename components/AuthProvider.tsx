'use client';

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import type { Session } from '@supabase/supabase-js';
import { authService, UserProfile } from '@/lib/authService';
import { supabase } from '@/lib/supabase';
import { checkSessionAction } from '@/app/actions/sessionActions';
import { clearInvoiceData } from '@/lib/storage';

const AuthContext = createContext<{
    profile: UserProfile | null;
    loading: boolean;
    signOut: () => Promise<void>;
    refreshProfile: () => Promise<void>;
}>({
    profile: null,
    loading: true,
    signOut: () => Promise.resolve(),
    refreshProfile: () => Promise.resolve(),
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
    const profileRef = useRef<UserProfile | null>(profile);
    profileRef.current = profile;
    const isCheckingSessionRef = useRef(false);

    const clearLocalSessionState = useCallback(() => {
        if (typeof window === 'undefined') return;
        localStorage.removeItem('app_user_session');
        clearInvoiceData();
    }, []);

    const redirectToLogin = useCallback(() => {
        setProfile(null);
        setLoading(false);
        if (pathnameRef.current !== '/login') {
            router.replace('/login');
        }
    }, [router]);

    const forceLogoutDueSessionIssue = useCallback(async () => {
        clearLocalSessionState();
        setProfile(null);
        setLoading(false);
        try {
            await supabase.auth.signOut({ scope: 'local' });
        } catch {
            // Local signout best-effort only.
        } finally {
            if (pathnameRef.current !== '/login') {
                router.replace('/login');
            }
        }
    }, [clearLocalSessionState, router]);

    const hasRoleDrift = useCallback((nextProfile: UserProfile | null) => {
        const currentRole = profileRef.current?.role;
        const nextRole = nextProfile?.role;
        return Boolean(currentRole && nextRole && currentRole !== nextRole);
    }, []);

    const hasSessionRoleMismatch = useCallback((session: Session | null, nextProfile: UserProfile | null) => {
        const appRole = session?.user?.app_metadata?.role;
        const userRole = session?.user?.user_metadata?.role;
        const tokenRole = typeof appRole === 'string'
            ? appRole
            : typeof userRole === 'string'
                ? userRole
                : null;

        return Boolean(tokenRole && nextProfile?.role && tokenRole !== nextProfile.role);
    }, []);

    const refreshProfile = async () => {
        try {
            const freshProfile = await authService.getCurrentUser();
            setProfile(freshProfile);
        } catch (e) {
            console.error("Error refreshing profile:", e);
        }
    };

    useEffect(() => {
        let isMounted = true;

        const FETCH_TIMEOUT_MS = 6000;

        /**
         * Fetch profile with a timeout to prevent infinite loading screen.
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

        // ── Auth state listener ─────────────────────────────────────────────
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, session) => {
                if (!isMounted) return;
                console.log('Auth event:', event, session ? '(session)' : '(no session)');

                if (event === 'INITIAL_SESSION') {
                    if (session) {
                        const user = await fetchProfile();
                        if (!isMounted) return;
                        if (!user) {
                            await forceLogoutDueSessionIssue();
                            return;
                        }
                        if (hasRoleDrift(user) || hasSessionRoleMismatch(session, user)) {
                            await forceLogoutDueSessionIssue();
                            return;
                        }
                        setProfile(user);
                        setLoading(false);
                    } else {
                        clearLocalSessionState();
                        redirectToLogin();
                    }
                    return;
                }

                if (event === 'SIGNED_OUT') {
                    clearLocalSessionState();
                    redirectToLogin();
                } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
                    const user = await fetchProfile();
                    if (!isMounted) return;
                    if (!user) {
                        await forceLogoutDueSessionIssue();
                        return;
                    }
                    if (hasRoleDrift(user) || hasSessionRoleMismatch(session, user)) {
                        await forceLogoutDueSessionIssue();
                        return;
                    }
                    setProfile(user);
                    setLoading(false);
                } else if (event === 'USER_UPDATED') {
                    const user = await fetchProfile();
                    if (!isMounted) return;
                    if (!user) {
                        await forceLogoutDueSessionIssue();
                        return;
                    }
                    if (hasRoleDrift(user) || hasSessionRoleMismatch(session, user)) {
                        await forceLogoutDueSessionIssue();
                        return;
                    }
                    setProfile(user);
                }
            }
        );

        const checkSession = async () => {
            if (pathnameRef.current === '/login') return;
            if (typeof navigator !== 'undefined' && !navigator.onLine) return;
            if (isCheckingSessionRef.current) return;

            isCheckingSessionRef.current = true;
            try {
                const result = await checkSessionAction();
                if (!result.valid) {
                    const { data: refreshedData, error } = await supabase.auth.refreshSession();
                    if (error) {
                        if (isMounted) {
                            await forceLogoutDueSessionIssue();
                        }
                    } else {
                        const refreshedUser = await fetchProfile();
                        if (!refreshedUser && isMounted) {
                            await forceLogoutDueSessionIssue();
                        } else if (refreshedUser && isMounted) {
                            if (
                                hasRoleDrift(refreshedUser) ||
                                hasSessionRoleMismatch(refreshedData.session, refreshedUser)
                            ) {
                                await forceLogoutDueSessionIssue();
                                return;
                            }
                            setProfile(refreshedUser);
                        }
                    }
                }
            } catch (error) {
                console.error('Session watchdog error:', error);
            } finally {
                isCheckingSessionRef.current = false;
            }
        };

        const watchdog = setInterval(checkSession, 5 * 60 * 1000);

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
    }, [clearLocalSessionState, forceLogoutDueSessionIssue, hasRoleDrift, hasSessionRoleMismatch, redirectToLogin]);

    useEffect(() => {
        const handleSessionInvalid = () => {
            if (pathnameRef.current === '/login') return;
            void forceLogoutDueSessionIssue();
        };

        window.addEventListener('app:session-invalid', handleSessionInvalid);
        return () => window.removeEventListener('app:session-invalid', handleSessionInvalid);
    }, [forceLogoutDueSessionIssue]);

    // ─── Routing guard ────────────────────────────────────────────────────────
    useEffect(() => {
        if (!loading && !profile && pathname !== '/login') {
            router.replace('/login');
        }
    }, [loading, profile, pathname, router]);

    const signOut = async () => {
        setProfile(null);
        setLoading(false);
        clearLocalSessionState();
        try {
            await Promise.race([
                authService.logout(),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('TIMEOUT_API_LOGOUT')), 5000)
                )
            ]);
        } catch (error) {
            console.warn('SignOut error:', error);
        } finally {
            if (pathnameRef.current !== '/login') {
                router.replace('/login');
            }
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
        <AuthContext.Provider value={{ profile, loading, signOut, refreshProfile }}>
            {children}
        </AuthContext.Provider>
    );
}

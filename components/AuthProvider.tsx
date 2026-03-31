'use client';

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { authService, UserProfile } from '@/lib/authService';
import { supabase } from '@/lib/supabase';
import { checkSessionAction } from '@/app/actions/sessionActions';
import { clearInvoiceData } from '@/lib/storage';

const ROLE_SNAPSHOT_KEY = 'app_auth_role_snapshot';

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
    const isLoggingOutRef = useRef(false);

    const clearLocalSessionState = useCallback(() => {
        if (typeof window === 'undefined') return;
        localStorage.removeItem('app_user_session');
        localStorage.removeItem(ROLE_SNAPSHOT_KEY);
        clearInvoiceData();
    }, []);

    const hasRoleSnapshotMismatch = useCallback((nextRole: string | undefined): boolean => {
        if (typeof window === 'undefined' || !nextRole) return false;
        const snapshotRole = localStorage.getItem(ROLE_SNAPSHOT_KEY);
        if (!snapshotRole) {
            localStorage.setItem(ROLE_SNAPSHOT_KEY, nextRole);
            return false;
        }
        return snapshotRole !== nextRole;
    }, []);

    const persistRoleSnapshot = useCallback((role: string | undefined) => {
        if (typeof window === 'undefined' || !role) return;
        localStorage.setItem(ROLE_SNAPSHOT_KEY, role);
    }, []);

    const isTransientAuthError = useCallback((error: unknown): boolean => {
        const message = error instanceof Error ? error.message : String(error || '');
        return /fetch|network|timeout|ECONN|ENOTFOUND|Failed to fetch|connection/i.test(message);
    }, []);

    const redirectToLogin = useCallback(() => {
        isLoggingOutRef.current = false;
        setProfile(null);
        setLoading(false);
        if (!pathnameRef.current.startsWith('/login')) {
            console.info('[AuthFlow] redirectToLogin -> /login?force_login=1');
            router.replace('/login?force_login=1');
        }
    }, [router]);

    const redirectToServerLogout = useCallback((reason: string) => {
        const loginTarget = '/login?logged_out=1';
        if (typeof window === 'undefined') {
            router.replace(loginTarget);
            isLoggingOutRef.current = false;
            return;
        }

        // En offline, impossible de garantir l'invalidation distante: on bascule
        // immédiatement vers login et on réautorise une tentative ultérieure.
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
            router.replace(loginTarget);
            isLoggingOutRef.current = false;
            return;
        }

        const params = new URLSearchParams({ reason });
        const logoutEndpoint = `/auth/logout?${params.toString()}`;
        console.info(`[AuthFlow] redirectToServerLogout reason=${reason} endpoint=${logoutEndpoint}`);

        void (async () => {
            try {
                await Promise.race([
                    fetch(logoutEndpoint, {
                        method: 'POST',
                        credentials: 'include',
                        cache: 'no-store',
                        keepalive: true
                    }),
                    new Promise((resolve) => setTimeout(resolve, 1200))
                ]);
            } catch (error) {
                console.warn('[AuthFlow] logout POST failed', error);
            } finally {
                // Navigation locale explicite: évite les comportements d'interprétation de Location
                // en standalone iOS.
                window.location.replace(loginTarget);
            }
        })();

        // Filet de sécurité si la navigation est bloquée sur un webview mobile.
        window.setTimeout(() => {
            if (!window.location.pathname.startsWith('/login')) {
                isLoggingOutRef.current = false;
                router.replace(loginTarget);
            }
        }, 2500);
    }, [router]);

    const forceLogoutDueSessionIssue = useCallback(async () => {
        if (isLoggingOutRef.current) return;
        isLoggingOutRef.current = true;
        console.warn('[AuthFlow] forceLogoutDueSessionIssue triggered');

        clearLocalSessionState();
        setProfile(null);
        setLoading(false);
        try {
            await supabase.auth.signOut({ scope: 'local' });
        } catch {
            // Local signout best-effort only.
        } finally {
            // Navigation hard pour purger correctement les cookies de session côté serveur.
            redirectToServerLogout('session_issue');
        }
    }, [clearLocalSessionState, redirectToServerLogout]);

    // Détecte si le rôle DB a changé entre deux chargements de profil
    // (ex : admin rétrogradé à 'user' par un autre admin pendant la session)
    const hasRoleDrift = useCallback((nextProfile: UserProfile | null) => {
        const currentRole = profileRef.current?.role;
        const nextRole = nextProfile?.role;
        return Boolean(currentRole && nextRole && currentRole !== nextRole);
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
                const profileResult = await Promise.race([authService.getCurrentUser(), timeout]);
                if (!profileResult) return null;
                return profileResult;
            } catch {
                return null;
            }
        };

        const resolveProfileSafely = async (sessionExists: boolean): Promise<UserProfile | null> => {
            const first = await fetchProfile();
            if (first) return first;

            // Une coupure réseau brève en standalone ne doit pas forcer un logout.
            if (typeof navigator !== 'undefined' && !navigator.onLine) {
                return profileRef.current;
            }

            await new Promise((resolve) => setTimeout(resolve, 650));
            const second = await fetchProfile();
            if (second) return second;

            if (sessionExists && profileRef.current) {
                try {
                    const validation = await checkSessionAction();
                    if (validation.valid || validation.transient) {
                        return profileRef.current;
                    }
                    console.warn('[AuthFlow] resolveProfileSafely validation failed', validation);
                } catch {
                    return profileRef.current;
                }
            }

            console.warn('[AuthFlow] resolveProfileSafely returned null');
            return null;
        };

        // ── Auth state listener ─────────────────────────────────────────────
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, session) => {
                if (!isMounted) return;
                console.log('Auth event:', event, session ? '(session)' : '(no session)');

                if (event === 'INITIAL_SESSION') {
                    if (session) {
                        const user = await resolveProfileSafely(Boolean(session));
                        if (!isMounted) return;
                        if (!user) {
                            await forceLogoutDueSessionIssue();
                            return;
                        }
                        if (hasRoleDrift(user) || hasRoleSnapshotMismatch(user.role)) {
                            console.warn(
                                `[AuthFlow] role drift snapshot mismatch on INITIAL_SESSION current=${profileRef.current?.role ?? 'none'} next=${user.role}`
                            );
                            await forceLogoutDueSessionIssue();
                            return;
                        }
                        persistRoleSnapshot(user.role);
                        setProfile(user);
                        setLoading(false);
                    } else {
                        clearLocalSessionState();
                        redirectToLogin();
                    }
                    return;
                }

                if (event === 'SIGNED_OUT') {
                    isLoggingOutRef.current = false;
                    clearLocalSessionState();
                    redirectToLogin();
                } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
                    const user = await resolveProfileSafely(Boolean(session));
                    if (!isMounted) return;
                    if (!user) {
                        await forceLogoutDueSessionIssue();
                        return;
                    }
                    if (hasRoleDrift(user) || hasRoleSnapshotMismatch(user.role)) {
                        console.warn(
                            `[AuthFlow] role drift snapshot mismatch on ${event} current=${profileRef.current?.role ?? 'none'} next=${user.role}`
                        );
                        await forceLogoutDueSessionIssue();
                        return;
                    }
                    persistRoleSnapshot(user.role);
                    setProfile(user);
                    setLoading(false);
                } else if (event === 'USER_UPDATED') {
                    const user = await resolveProfileSafely(Boolean(session));
                    if (!isMounted) return;
                    if (!user) {
                        await forceLogoutDueSessionIssue();
                        return;
                    }
                    if (hasRoleDrift(user) || hasRoleSnapshotMismatch(user.role)) {
                        console.warn(
                            `[AuthFlow] role drift snapshot mismatch on USER_UPDATED current=${profileRef.current?.role ?? 'none'} next=${user.role}`
                        );
                        await forceLogoutDueSessionIssue();
                        return;
                    }
                    persistRoleSnapshot(user.role);
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
                if (result.valid) {
                    if (hasRoleSnapshotMismatch(result.role)) {
                        console.warn(
                            `[AuthFlow] watchdog role snapshot mismatch current=${profileRef.current?.role ?? 'none'} server=${result.role}`
                        );
                        if (isMounted) {
                            await forceLogoutDueSessionIssue();
                        }
                        return;
                    }
                    persistRoleSnapshot(result.role);
                }
                if (!result.valid) {
                    if (result.transient) return;

                    console.warn('[AuthFlow] watchdog invalid session detected', result);
                    const { error } = await supabase.auth.refreshSession();
                    if (error) {
                        if (isTransientAuthError(error)) {
                            return;
                        }
                        if (isMounted) {
                            await forceLogoutDueSessionIssue();
                        }
                    } else {
                        const refreshedUser = await fetchProfile();
                        if (!refreshedUser && isMounted) {
                            await forceLogoutDueSessionIssue();
                        } else if (refreshedUser && isMounted) {
                            if (hasRoleDrift(refreshedUser)) {
                                await forceLogoutDueSessionIssue();
                                return;
                            }
                            if (hasRoleSnapshotMismatch(refreshedUser.role)) {
                                console.warn(
                                    `[AuthFlow] refreshed profile snapshot mismatch current=${profileRef.current?.role ?? 'none'} next=${refreshedUser.role}`
                                );
                                await forceLogoutDueSessionIssue();
                                return;
                            }
                            persistRoleSnapshot(refreshedUser.role);
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
    }, [clearLocalSessionState, forceLogoutDueSessionIssue, hasRoleDrift, hasRoleSnapshotMismatch, isTransientAuthError, persistRoleSnapshot, redirectToLogin]);

    useEffect(() => {
        const handleSessionInvalid = () => {
            if (pathnameRef.current === '/login') return;
            void forceLogoutDueSessionIssue();
        };

        window.addEventListener('app:session-invalid', handleSessionInvalid);
        return () => window.removeEventListener('app:session-invalid', handleSessionInvalid);
    }, [forceLogoutDueSessionIssue]);

    useEffect(() => {
        if (pathname.startsWith('/login')) return;

        let cancelled = false;
        const validateOnRouteChange = async () => {
            try {
                const result = await checkSessionAction();
                if (cancelled) return;

                if (result.valid) {
                    if (hasRoleSnapshotMismatch(result.role)) {
                        console.warn(
                            `[AuthFlow] route-change role snapshot mismatch current=${profileRef.current?.role ?? 'none'} server=${result.role} path=${pathname}`
                        );
                        await forceLogoutDueSessionIssue();
                        return;
                    }
                    persistRoleSnapshot(result.role);
                    return;
                }

                if (result.transient) return;

                console.warn('[AuthFlow] route-change invalid session detected', result, pathname);
                await forceLogoutDueSessionIssue();
            } catch (error) {
                console.error('[AuthFlow] route-change session check error', error);
            }
        };

        void validateOnRouteChange();

        return () => {
            cancelled = true;
        };
    }, [forceLogoutDueSessionIssue, hasRoleSnapshotMismatch, pathname, persistRoleSnapshot]);

    // ─── Routing guard ────────────────────────────────────────────────────────
    useEffect(() => {
        if (!loading && !profile && !pathname.startsWith('/login')) {
            router.replace('/login?force_login=1');
        }
    }, [loading, profile, pathname, router]);

    const signOut = async () => {
        if (isLoggingOutRef.current) return;
        isLoggingOutRef.current = true;

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
            redirectToServerLogout('manual');
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

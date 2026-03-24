'use client';

import { useEffect } from 'react';

const RECOVERY_FLAG = 'runtime_recovery_attempt_at';
const RECOVERY_WINDOW_MS = 30_000;

const RUNTIME_ERROR_PATTERNS = [
    /ChunkLoadError/i,
    /Loading chunk [\d]+ failed/i,
    /Failed to fetch dynamically imported module/i,
    /Importing a module script failed/i
];

function shouldRecover(message: string): boolean {
    return RUNTIME_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}

async function clearBrowserCaches(): Promise<void> {
    if (typeof window === 'undefined' || !('caches' in window)) return;
    const keys = await window.caches.keys();
    await Promise.all(keys.map((key) => window.caches.delete(key)));
}

function readLastAttempt(): number {
    const raw = sessionStorage.getItem(RECOVERY_FLAG);
    const parsed = raw ? Number.parseInt(raw, 10) : 0;
    return Number.isFinite(parsed) ? parsed : 0;
}

function markAttempt(now: number): void {
    sessionStorage.setItem(RECOVERY_FLAG, `${now}`);
}

export default function RuntimeRecovery() {
    useEffect(() => {
        const recoverFromRuntimeFailure = async (reason: string) => {
            const now = Date.now();
            const lastAttempt = readLastAttempt();

            console.error('Runtime recovery triggered:', reason);

            // Si un rechargement a déjà été tenté récemment, on purge les caches
            // avant de rediriger proprement vers l'entrée principale.
            if (lastAttempt > 0 && now - lastAttempt < RECOVERY_WINDOW_MS) {
                sessionStorage.removeItem(RECOVERY_FLAG);
                try {
                    await clearBrowserCaches();
                } finally {
                    window.location.replace('/?recovery=1');
                }
                return;
            }

            markAttempt(now);
            window.location.reload();
        };

        const onError = (event: ErrorEvent) => {
            const message = event?.message || event?.error?.message || '';
            if (!message || !shouldRecover(message)) return;
            void recoverFromRuntimeFailure(message);
        };

        const onUnhandledRejection = (event: PromiseRejectionEvent) => {
            const reasonText = typeof event.reason === 'string'
                ? event.reason
                : event.reason?.message || '';
            if (!reasonText || !shouldRecover(reasonText)) return;
            void recoverFromRuntimeFailure(reasonText);
        };

        window.addEventListener('error', onError);
        window.addEventListener('unhandledrejection', onUnhandledRejection);
        return () => {
            window.removeEventListener('error', onError);
            window.removeEventListener('unhandledrejection', onUnhandledRejection);
        };
    }, []);

    return null;
}

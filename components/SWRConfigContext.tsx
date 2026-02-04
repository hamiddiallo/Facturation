'use client';

import React from 'react';
import { SWRConfig } from 'swr';

export default function SWRConfigContext({ children }: { children: React.ReactNode }) {
    return (
        <SWRConfig
            value={{
                fetcher: async (key: string | [string, ...any[]]) => {
                    // Si la clé est une fonction (cas direct d'importation de service)
                    if (typeof key === 'function') {
                        return await (key as any)();
                    }

                    // On peut étendre ici pour gérer des URLs API si besoin
                    return null;
                },
                revalidateOnFocus: false,
                dedupingInterval: 10000,
                onError: (error) => {
                    // Si on reçoit une erreur 401 ou 403, cela signifie probablement que la session est morte
                    // On force un rafraîchissement global pour que AuthProvider redirige
                    if (error?.status === 401 || error?.status === 403 || error?.code === 'refresh_token_not_found') {
                        console.error('Erreur de session critique détectée via SWR:', error);
                        if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
                            window.location.href = '/login';
                        }
                    }
                },
                onErrorRetry: (error, key, config, revalidate, { retryCount }) => {
                    // Ne pas réessayer si c'est une erreur d'authentification
                    if (error?.status === 401 || error?.status === 403) return;

                    // Ne pas réessayer si c'est une erreur 404
                    if (error?.status === 404) return;

                    // Limiter à 5 tentatives
                    if (retryCount >= 5) return;

                    // Backoff exponentiel : 1s, 2s, 4s, 8s, 16s...
                    const timeout = Math.pow(2, retryCount) * 1000;
                    setTimeout(() => revalidate({ retryCount }), timeout);
                }
            }}
        >
            {children}
        </SWRConfig>
    );
}

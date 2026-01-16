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
                onErrorRetry: (error, key, config, revalidate, { retryCount }) => {
                    // Ne pas réessayer si c'est une erreur 404 ou 403 (identifiants incorrects par ex)
                    if (error?.status === 404 || error?.status === 403) return;

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

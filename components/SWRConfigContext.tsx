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
                revalidateOnFocus: false, // Éviter trop de requêtes quand on change d'onglet
                dedupingInterval: 10000, // Déduplication des requêtes identiques pendant 10s
            }}
        >
            {children}
        </SWRConfig>
    );
}

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useSWRConfig } from 'swr';
import styles from './PullToRefreshStandalone.module.css';

const TRIGGER_DISTANCE = 72;
const MAX_PULL_DISTANCE = 120;

function isStandaloneMode(): boolean {
    if (typeof window === 'undefined') return false;
    return (
        window.matchMedia('(display-mode: standalone)').matches ||
        Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone)
    );
}

function isInteractiveTarget(target: EventTarget | null): boolean {
    if (!(target instanceof Element)) return false;
    return Boolean(target.closest('input, textarea, select, button, a, [contenteditable="true"], [data-no-pull-refresh]'));
}

export default function PullToRefreshStandalone() {
    const pathname = usePathname();
    const router = useRouter();
    const { mutate } = useSWRConfig();

    const [pullDistance, setPullDistance] = useState(0);
    const [isReady, setIsReady] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const startYRef = useRef<number | null>(null);
    const pullingRef = useRef(false);
    const readyRef = useRef(false);
    const refreshingRef = useRef(false);

    const disabled = pathname === '/login' || pathname === '/preview';

    const indicatorStyle = useMemo(() => {
        const visible = isRefreshing || pullDistance > 0;
        const y = isRefreshing
            ? 14
            : Math.max(-64, Math.min(14, pullDistance - 64));

        return {
            transform: `translate(-50%, ${y}px)`,
            opacity: visible ? 1 : 0
        };
    }, [isRefreshing, pullDistance]);

    useEffect(() => {
        if (disabled || !isStandaloneMode()) return;

        const resetPullState = () => {
            pullingRef.current = false;
            startYRef.current = null;
            readyRef.current = false;
            setPullDistance(0);
            setIsReady(false);
        };

        const triggerRefresh = async () => {
            if (refreshingRef.current) return;
            refreshingRef.current = true;
            setIsRefreshing(true);

            try {
                // Revalidation SWR globale + refresh App Router
                await mutate(() => true, undefined, { revalidate: true });
                router.refresh();
                await new Promise((resolve) => setTimeout(resolve, 450));
            } finally {
                setIsRefreshing(false);
                refreshingRef.current = false;
            }
        };

        const onTouchStart = (event: TouchEvent) => {
            if (refreshingRef.current) return;
            if (event.touches.length !== 1) return;
            if (window.scrollY > 0) return;
            if (isInteractiveTarget(event.target)) return;

            startYRef.current = event.touches[0].clientY;
            pullingRef.current = true;
            readyRef.current = false;
            setIsReady(false);
        };

        const onTouchMove = (event: TouchEvent) => {
            if (!pullingRef.current || startYRef.current === null) return;
            if (event.touches.length !== 1) return;

            const delta = event.touches[0].clientY - startYRef.current;
            if (delta <= 0) {
                setPullDistance(0);
                setIsReady(false);
                readyRef.current = false;
                return;
            }

            // En standalone on gère nous-même le geste.
            event.preventDefault();

            const nextDistance = Math.min(delta * 0.55, MAX_PULL_DISTANCE);
            const nextReady = nextDistance >= TRIGGER_DISTANCE;
            readyRef.current = nextReady;
            setPullDistance(nextDistance);
            setIsReady(nextReady);
        };

        const onTouchEnd = () => {
            const shouldRefresh = pullingRef.current && readyRef.current && !refreshingRef.current;
            resetPullState();
            if (shouldRefresh) {
                void triggerRefresh();
            }
        };

        window.addEventListener('touchstart', onTouchStart, { passive: true });
        window.addEventListener('touchmove', onTouchMove, { passive: false });
        window.addEventListener('touchend', onTouchEnd, { passive: true });
        window.addEventListener('touchcancel', onTouchEnd, { passive: true });

        return () => {
            window.removeEventListener('touchstart', onTouchStart);
            window.removeEventListener('touchmove', onTouchMove);
            window.removeEventListener('touchend', onTouchEnd);
            window.removeEventListener('touchcancel', onTouchEnd);
        };
    }, [disabled, mutate, router]);

    return (
        <div className={styles.container} style={indicatorStyle} aria-hidden="true">
            <div className={styles.chip}>
                <span className={`${styles.spinner} ${(isReady || isRefreshing) ? styles.spinning : ''}`} />
                <span>
                    {isRefreshing
                        ? 'Actualisation...'
                        : isReady
                            ? 'Relâchez pour actualiser'
                            : 'Tirez pour actualiser'}
                </span>
            </div>
        </div>
    );
}

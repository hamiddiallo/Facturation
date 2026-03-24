'use client';

import React, { useEffect, useState, useCallback } from 'react';
import confetti from 'canvas-confetti';
import { weeklyMessages } from '@/lib/messages';
import styles from './WeeklyCelebration.module.css';

interface CelebrationState {
    weekId: string;
    shown: boolean;
}

export default function WeeklyCelebration() {
    const [isVisible, setIsVisible] = useState(false);
    const [message] = useState(() => {
        return weeklyMessages[Math.floor(Math.random() * weeklyMessages.length)].text;
    });

    // Détermine l'ID de la semaine actuelle (Année-Semaine)
    const getWeekId = () => {
        const d = new Date();
        const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
        date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
        const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
        const weekNo = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
        return `${date.getUTCFullYear()}-${weekNo}`;
    };

    const triggerConfetti = useCallback(() => {
        const reducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (reducedMotion) return () => { };

        const isStandalone = typeof window !== 'undefined'
            && (window.matchMedia('(display-mode: standalone)').matches
                || Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone));
        const duration = isStandalone ? 2500 : 5000;
        const animationEnd = Date.now() + duration;
        const defaults = { startVelocity: 45, spread: 360, ticks: 100, zIndex: 10000 };

        const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

        // FEU D'ARTIFICE (Multiple explosions)
        const interval = window.setInterval(() => {
            const timeLeft = animationEnd - Date.now();
            if (timeLeft <= 0) return window.clearInterval(interval);

            confetti({
                ...defaults,
                particleCount: 80,
                origin: { x: randomInRange(0.1, 0.9), y: randomInRange(0.2, 0.5) },
                colors: ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff']
            });
        }, 300);
        return () => window.clearInterval(interval);
    }, []);

    useEffect(() => {
        let rafId: number | null = null;
        let stopConfetti: (() => void) | null = null;
        const currentWeekId = getWeekId();
        const storedState = localStorage.getItem('weekly_celebration_state');
        let state: CelebrationState;

        if (storedState) {
            state = JSON.parse(storedState);
            // Si c'est une nouvelle semaine, réinitialiser
            if (state.weekId !== currentWeekId) {
                state = {
                    weekId: currentWeekId,
                    shown: false
                };
            }
        } else {
            // Première fois
            state = {
                weekId: currentWeekId,
                shown: false
            };
        }

        // Sauvegarder l'état (éventuellement mis à jour)
        localStorage.setItem('weekly_celebration_state', JSON.stringify(state));

        if (!state.shown) {
            // Première visite de la semaine
            rafId = window.requestAnimationFrame(() => {
                setIsVisible(true);
            });
            stopConfetti = triggerConfetti();

            // Marquer comme montré
            state.shown = true;
            localStorage.setItem('weekly_celebration_state', JSON.stringify(state));
        }

        return () => {
            if (rafId !== null) {
                window.cancelAnimationFrame(rafId);
            }
            if (stopConfetti) stopConfetti();
        };
    }, [triggerConfetti]);

    if (!isVisible) return null;

    return (
        <div className={styles.overlay}>
            <div className={styles.modal}>
                <span className={styles.icon}>🎉</span>
                <h2 className={styles.title}>C&apos;est la fête !</h2>
                <p className={styles.message}>{message}</p>
                <button
                    className={styles.closeButton}
                    onClick={() => setIsVisible(false)}
                >
                    Merci, au travail ! 🚀
                </button>
            </div>
        </div>
    );
}

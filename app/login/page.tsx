'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { authService } from '@/lib/authService';
import styles from './page.module.css';

export default function LoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMessage(null);
        // Connexion 100% Manuelle via Profiles
        const result = await authService.login(email, password);

        if (result.success) {
            router.push('/');
        } else {
            setMessage({ type: 'error', text: result.error || 'Erreur de connexion' });
            setLoading(false);
        }
    };

    return (
        <div className={styles.container}>
            <div className={styles.card}>
                <div className={styles.header}>
                    <h1 className={styles.title}>Connexion</h1>
                    <p className={styles.subtitle}>Espace de facturation (Profiles-Master)</p>
                </div>

                <form onSubmit={handleLogin} className={styles.form}>
                    <div className={styles.formGroup}>
                        <label className={styles.label}>Email</label>
                        <input
                            type="email"
                            className={styles.input}
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            placeholder="votre@email.com"
                        />
                    </div>

                    <div className={styles.formGroup}>
                        <label className={styles.label}>Mot de passe</label>
                        <input
                            type="password"
                            className={styles.input}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            placeholder="••••••••"
                        />
                    </div>

                    {message && (
                        <div className={`${styles.message} ${message.type === 'error' ? styles.error : styles.success}`}>
                            {message.text}
                        </div>
                    )}

                    <button type="submit" className={styles.button} disabled={loading}>
                        {loading ? 'Authentification...' : 'Se connecter'}
                    </button>
                </form>

                <div className={styles.footer}>
                    <p>Système 100% privé & sécurisé</p>
                </div>
            </div>
        </div>
    );
}

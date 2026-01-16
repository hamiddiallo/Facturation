'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { adminUpdateProfile } from '@/lib/adminActions';
import { authService } from '@/lib/authService';
import styles from './page.module.css';

export default function ProfilePage() {
    const { profile, loading: authLoading } = useAuth();
    const router = useRouter();

    const [formData, setFormData] = useState({
        fullName: '',
        email: '',
        password: '',
        confirmPassword: ''
    });

    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<{ msg: string; isError: boolean } | null>(null);

    useEffect(() => {
        if (!authLoading && !profile) {
            router.push('/login');
        } else if (profile) {
            setFormData(prev => ({
                ...prev,
                fullName: profile.full_name || '',
                email: profile.email || ''
            }));
        }
    }, [authLoading, profile, router]);

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();

        if (formData.password && formData.password !== formData.confirmPassword) {
            showStatus('Les mots de passe ne correspondent pas.', true);
            return;
        }

        setLoading(true);
        try {
            if (!profile?.id) throw new Error('Utilisateur non identifié');

            await adminUpdateProfile(profile.id, {
                fullName: formData.fullName,
                email: formData.email,
                password: formData.password || undefined
            });

            // Rafraîchir la session locale
            await authService.refreshSession();

            showStatus('Profil mis à jour avec succès !');
            setFormData(prev => ({ ...prev, password: '', confirmPassword: '' }));
        } catch (err: any) {
            showStatus(err.message || 'Erreur lors de la mise à jour.', true);
        } finally {
            setLoading(false);
        }
    };

    const showStatus = (msg: string, isError = false) => {
        setStatus({ msg, isError });
        setTimeout(() => setStatus(null), 5000);
    };

    if (authLoading || !profile) {
        return (
            <div className={styles.page}>
                <div className={styles.container}>Chargement du profil...</div>
            </div>
        );
    }

    return (
        <div className={styles.page}>
            <div className={styles.container}>
                <header className={styles.header}>
                    <h1>👤 Mon Profil</h1>
                    <button onClick={() => router.push('/')} className={styles.input} style={{ width: 'auto', cursor: 'pointer' }}>
                        Retour
                    </button>
                </header>

                <div className={styles.content}>
                    {status && (
                        <div className={`${styles.notif} ${status.isError ? styles.error : styles.success}`}>
                            {status.msg}
                        </div>
                    )}

                    <form onSubmit={handleUpdate} className={styles.formGrid}>
                        <h3 className={styles.sectionTitle}>Informations Personnelles</h3>

                        <div className={styles.formGroup}>
                            <label>Nom Complet</label>
                            <input
                                className={styles.input}
                                value={formData.fullName}
                                onChange={e => setFormData({ ...formData, fullName: e.target.value })}
                                required
                                placeholder="Votre nom complet"
                            />
                        </div>

                        <div className={styles.formGroup}>
                            <label>Adresse Email</label>
                            <input
                                className={styles.input}
                                type="email"
                                value={formData.email}
                                onChange={e => setFormData({ ...formData, email: e.target.value })}
                                required
                                placeholder="votre@email.com"
                            />
                        </div>

                        <div className={styles.infoBox}>
                            <span>ℹ️</span>
                            Rôle actuel : <strong>{profile.role?.toUpperCase()}</strong>
                        </div>

                        <h3 className={styles.sectionTitle} style={{ marginTop: '1rem' }}>Sécurité</h3>
                        <p style={{ color: '#718096', fontSize: '0.85rem', marginBottom: '1rem' }}>
                            Laissez vide pour conserver votre mot de passe actuel.
                        </p>

                        <div className={styles.formGroup}>
                            <label>Nouveau mot de passe</label>
                            <input
                                className={styles.input}
                                type="password"
                                value={formData.password}
                                onChange={e => setFormData({ ...formData, password: e.target.value })}
                                placeholder="••••••••"
                            />
                        </div>

                        <div className={styles.formGroup}>
                            <label>Confirmer le mot de passe</label>
                            <input
                                className={styles.input}
                                type="password"
                                value={formData.confirmPassword}
                                onChange={e => setFormData({ ...formData, confirmPassword: e.target.value })}
                                placeholder="••••••••"
                            />
                        </div>

                        <button type="submit" className={styles.saveButton} disabled={loading}>
                            {loading ? 'Mise à jour...' : 'Enregistrer les modifications'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}

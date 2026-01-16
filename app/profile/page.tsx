'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { adminUpdateProfile, uploadAvatarAction } from '@/lib/adminActions';
import { authService } from '@/lib/authService';
import PasswordStrength from '@/components/PasswordStrength';
import imageCompression from 'browser-image-compression';
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
    const [isPasswordValid, setIsPasswordValid] = useState(true);

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

        if (formData.password && !isPasswordValid) {
            showStatus('Le mot de passe ne respecte pas les critères de sécurité.', true);
            return;
        }

        setLoading(true);
        try {
            if (!profile?.id) throw new Error('Utilisateur non identifié');

            const res = await adminUpdateProfile(profile.id, {
                fullName: formData.fullName,
                email: formData.email,
                password: formData.password || undefined
            });

            if (!res.success) {
                showStatus(res.error || 'Erreur lors de la mise à jour.', true);
                return;
            }

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

    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !profile?.id) return;

        setLoading(true);
        try {
            // 1. Compression
            const options = {
                maxSizeMB: 0.15,
                maxWidthOrHeight: 400,
                useWebWorker: true,
            };
            const compressedFile = await imageCompression(file, options);

            // 2. Upload via Server Action
            const formData = new FormData();
            formData.append('file', compressedFile);
            formData.append('userId', profile.id);

            const result = await uploadAvatarAction(formData);
            if (!result?.success || !result.publicUrl) throw new Error("Échec de l'envoi");

            // 3. Update Profile
            const updateRes = await adminUpdateProfile(profile.id, { avatar_url: result.publicUrl });
            if (!updateRes.success) {
                showStatus(updateRes.error || "Erreur lors de la mise à jour du profil", true);
                return;
            }
            await authService.refreshSession();

            showStatus('Photo de profil mise à jour !');
        } catch (err: any) {
            showStatus(err.message || "Erreur lors de l'envoi", true);
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

                    <div className={styles.avatarSection}>
                        <div className={styles.avatarWrapper}>
                            {profile.avatar_url ? (
                                <img src={profile.avatar_url} alt="Avatar" className={styles.avatar} />
                            ) : (
                                <div className={styles.avatarPlaceholder}>
                                    {profile.full_name?.[0]?.toUpperCase() || 'U'}
                                </div>
                            )}
                        </div>
                        <div>
                            <label htmlFor="avatar-upload" className={styles.avatarInputLabel}>
                                {loading ? 'Envoi...' : 'Changer la photo'}
                            </label>
                            <input
                                id="avatar-upload"
                                type="file"
                                accept="image/*"
                                onChange={handleAvatarUpload}
                                className={styles.avatarInput}
                                disabled={loading}
                            />
                        </div>
                    </div>

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
                            <PasswordStrength
                                password={formData.password}
                                onValidate={setIsPasswordValid}
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

                        <button
                            type="submit"
                            className={styles.saveButton}
                            disabled={loading || (!!formData.password && !isPasswordValid)}
                        >
                            {loading ? 'Mise à jour...' : 'Enregistrer les modifications'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}

'use client';

import React, { useState, useEffect } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { useRouter } from 'next/navigation';
import imageCompression from 'browser-image-compression';
import { Company } from '@/lib/types';
import {
    getCompanies,
    updateCompany as updateCompanyCloud,
    createCompany as createCompanyCloud,
    deleteCompany as deleteCompanyCloud,
    setDefaultCompany as setDefaultCompanyCloud
} from '@/lib/supabaseServices';
import { adminCreateUser, adminDeleteUser, adminListUsers, adminUpdateProfile } from '@/lib/adminActions';
import { useAuth } from '@/components/AuthProvider';
import styles from './page.module.css';

type MainTab = 'companies' | 'users';

export default function SettingsPage() {
    const router = useRouter();
    const { profile, loading: authLoading } = useAuth();
    const { mutate } = useSWRConfig();

    // SWR Data Fetching
    const { data: companies = [], isLoading: isLoadingCompanies } = useSWR('companies', getCompanies);
    const { data: users = [], isLoading: isLoadingUsers } = useSWR(profile?.role === 'admin' ? 'users' : null, adminListUsers);

    // Global State
    const [mainTab, setMainTab] = useState<MainTab>('companies');
    const [internalLoading, setInternalLoading] = useState(false);
    const [saveStatus, setSaveStatus] = useState<{ msg: string, isError: boolean } | null>(null);

    // Filter loading state
    const loading = authLoading || (mainTab === 'companies' ? isLoadingCompanies : isLoadingUsers) || internalLoading;

    // Companies State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCompany, setEditingCompany] = useState<Company | null>(null);

    // Users State
    const [newUser, setNewUser] = useState({
        email: '',
        password: '',
        fullName: '',
        role: 'user' as 'admin' | 'user'
    });
    const [editingUser, setEditingUser] = useState<any | null>(null);
    const [isUserModalOpen, setIsUserModalOpen] = useState(false);

    useEffect(() => {
        if (!authLoading && profile) {
            // Protection admin-only pour la page settings
            if (profile.role !== 'admin') {
                router.push('/');
                return;
            }
        } else if (!authLoading && !profile) {
            router.push('/login');
        }
    }, [authLoading, profile, router]);

    // --- Actions Entreprises ---
    const openCreateModal = () => {
        setEditingCompany({
            id: '',
            name: '',
            displayName: '',
            businessType: '',
            address: '',
            phone: '',
            email: '',
            isDefault: false,
            templateId: 'template_standard'
        });
        setIsModalOpen(true);
    };

    const openEditModal = (company: Company) => {
        setEditingCompany({ ...company });
        setIsModalOpen(true);
    };

    const handleModalInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        if (!editingCompany) return;
        const { name, value } = e.target;
        setEditingCompany({ ...editingCompany, [name]: value });
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !editingCompany) return;

        try {
            const options = {
                maxSizeMB: 0.2, // On vise 200KB max pour les logos/cachets
                maxWidthOrHeight: 800,
                useWebWorker: true,
            };

            setInternalLoading(true);
            const compressedFile = await imageCompression(file, options);

            const reader = new FileReader();
            reader.onloadend = () => {
                setEditingCompany({ ...editingCompany, sealImage: reader.result as string });
                setInternalLoading(false);
            };
            reader.readAsDataURL(compressedFile);
        } catch (error) {
            console.error('Erreur compression image:', error);
            setInternalLoading(false);
            setStatus('Erreur lors de la compression de l\'image.', true);
        }
    };

    const handleSaveCompany = async () => {
        if (!editingCompany) return;
        setInternalLoading(true);

        try {
            if (editingCompany.id) {
                // Update
                const updated = await updateCompanyCloud(editingCompany.id, editingCompany);
                if (updated) setStatus('Entreprise mise à jour !');
            } else {
                // Create
                const created = await createCompanyCloud(editingCompany);
                if (created) setStatus('Nouvelle entreprise ajoutée !');
            }
            mutate('companies');
            setIsModalOpen(false);
        } catch (err) {
            setStatus('Erreur lors de la sauvegarde.', true);
        } finally {
            setInternalLoading(false);
        }
    };

    const handleDeleteCompany = async (id: string) => {
        if (!confirm('Supprimer cette entreprise définitivement ?')) return;
        setInternalLoading(true);
        const success = await deleteCompanyCloud(id);
        if (success) {
            setStatus('Entreprise supprimée.');
            mutate('companies');
        }
        setInternalLoading(false);
    };

    const handleSetDefault = async (id: string) => {
        setInternalLoading(true);
        const success = await setDefaultCompanyCloud(id);
        if (success) {
            setStatus('Entreprise par défaut mise à jour !');
            mutate('companies');
        }
        setInternalLoading(false);
    };

    // --- Actions Utilisateurs ---
    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        setInternalLoading(true);
        try {
            await adminCreateUser(newUser.email, newUser.password, newUser.fullName, newUser.role);
            setNewUser({ email: '', password: '', fullName: '', role: 'user' });
            mutate('users');
            setStatus('Utilisateur créé avec succès !');
        } catch (err: any) {
            setStatus('Erreur: ' + err.message, true);
        } finally {
            setInternalLoading(false);
        }
    };

    const handleDeleteUser = async (id: string) => {
        if (!confirm('Révoquer cet utilisateur ?')) return;
        setInternalLoading(true);
        try {
            await adminDeleteUser(id);
            mutate('users');
            setStatus('Utilisateur révoqué.');
        } catch (err: any) {
            setStatus('Erreur: ' + err.message, true);
        } finally {
            setInternalLoading(false);
        }
    };

    const openEditUserModal = (user: any) => {
        setEditingUser({
            id: user.id,
            fullName: user.full_name,
            email: user.email,
            role: user.role,
            status: user.status,
            password: '' // Vide par défaut, optionnel
        });
        setIsUserModalOpen(true);
    };

    const handleUpdateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingUser) return;

        setInternalLoading(true);
        try {
            await adminUpdateProfile(editingUser.id, {
                fullName: editingUser.fullName,
                email: editingUser.email,
                role: editingUser.role,
                status: editingUser.status,
                password: editingUser.password || undefined
            });

            setIsUserModalOpen(false);
            setEditingUser(null);
            mutate('users');
            setStatus('Utilisateur modifié avec succès !');
        } catch (err: any) {
            setStatus('Erreur: ' + err.message, true);
        } finally {
            setInternalLoading(false);
        }
    };



    const setStatus = (msg: string, isError = false) => {
        setSaveStatus({ msg, isError });
        setTimeout(() => setSaveStatus(null), 3000);
    };

    if (authLoading || (loading && companies.length === 0 && mainTab === 'companies')) {
        return <div className={styles.page}><div className={styles.container}>Vérification des accès Master...</div></div>;
    }

    return (
        <div className={styles.page}>
            <div className={styles.container}>
                <header className={styles.header}>
                    <h1>⚙️ Paramètres Projet</h1>
                    <button onClick={() => router.push('/')} className={styles.backButton}>
                        <span>←</span> Retour au Facturier
                    </button>
                </header>

                <div className={styles.content}>
                    <div className={styles.mainTabs}>
                        <button
                            className={`${styles.mainTabButton} ${mainTab === 'companies' ? styles.mainTabActive : ''}`}
                            onClick={() => setMainTab('companies')}
                        >
                            🏢 Entreprises
                        </button>
                        {profile?.role === 'admin' && (
                            <button
                                className={`${styles.mainTabButton} ${mainTab === 'users' ? styles.mainTabActive : ''}`}
                                onClick={() => setMainTab('users')}
                            >
                                👥 Utilisateurs
                            </button>
                        )}
                    </div>

                    <div className={styles.tabContent}>
                        {saveStatus && (
                            <div className={`${styles.notif} ${saveStatus.isError ? styles.error : styles.success}`}>
                                {saveStatus.msg}
                            </div>
                        )}

                        {/* ONGLET ENTREPRISES (VUE TABLEAU) */}
                        {mainTab === 'companies' && (
                            <div className={styles.companySection}>
                                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1.5rem' }}>
                                    <button className={styles.saveButton} onClick={openCreateModal}>
                                        + Ajouter une entreprise
                                    </button>
                                </div>

                                <div className={styles.companyTableWrapper}>
                                    <table className={styles.companyTable}>
                                        <thead>
                                            <tr>
                                                <th>Nom d'affichage</th>
                                                <th>Activité</th>
                                                <th>Téléphone</th>
                                                <th>Défaut</th>
                                                <th style={{ textAlign: 'right' }}>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {[...companies]
                                                .sort((a, b) => (b.isDefault ? 1 : 0) - (a.isDefault ? 1 : 0))
                                                .map(c => (
                                                    <tr key={c.id} className={styles.companyRow}>
                                                        <td style={{ fontWeight: 600 }}>{c.displayName}</td>
                                                        <td style={{ color: '#718096' }}>{c.businessType}</td>
                                                        <td style={{ fontSize: '0.9rem' }}>{c.phone}</td>
                                                        <td>
                                                            {c.isDefault ? (
                                                                <span className={styles.defaultBadge}>🎯 Principale</span>
                                                            ) : (
                                                                <button
                                                                    className={styles.actionBtn}
                                                                    onClick={() => handleSetDefault(c.id)}
                                                                    title="Définir comme entreprise par défaut"
                                                                >
                                                                    Fixer
                                                                </button>
                                                            )}
                                                        </td>
                                                        <td className={styles.actionCell}>
                                                            <button
                                                                className={`${styles.actionBtn} ${styles.primary}`}
                                                                onClick={() => openEditModal(c)}
                                                                title="Modifier"
                                                            >
                                                                📝
                                                            </button>
                                                            <button
                                                                className={`${styles.actionBtn} ${styles.danger}`}
                                                                onClick={() => handleDeleteCompany(c.id)}
                                                                title="Supprimer"
                                                            >
                                                                🗑️
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* ONGLET UTILISATEURS */}
                        {mainTab === 'users' && profile?.role === 'admin' && (
                            <div className={styles.userSection}>
                                <div className={styles.createUserBox}>
                                    <h3 style={{ marginTop: 0, marginBottom: '1.5rem' }}>Nouveau Collaborateur</h3>
                                    <form className={styles.userFormGrid} onSubmit={handleCreateUser}>
                                        <div className={styles.formGroup}>
                                            <label>Nom Complet</label>
                                            <input
                                                className={styles.input}
                                                value={newUser.fullName}
                                                onChange={e => setNewUser({ ...newUser, fullName: e.target.value })}
                                                required
                                            />
                                        </div>
                                        <div className={styles.formGroup}>
                                            <label>Email</label>
                                            <input
                                                className={styles.input}
                                                type="email"
                                                value={newUser.email}
                                                onChange={e => setNewUser({ ...newUser, email: e.target.value })}
                                                required
                                            />
                                        </div>
                                        <div className={styles.formGroup}>
                                            <label>Mot de passe</label>
                                            <input
                                                className={styles.input}
                                                type="password"
                                                value={newUser.password}
                                                onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                                                required
                                            />
                                        </div>
                                        <button type="submit" className={styles.saveButton} style={{ padding: '0.75rem 1.5rem' }}>
                                            Créer Accès
                                        </button>
                                    </form>
                                </div>

                                <div className={styles.userTableWrapper}>
                                    <table className={styles.userTable}>
                                        <thead>
                                            <tr>
                                                <th style={{ padding: '1rem' }}>Membre</th>
                                                <th style={{ padding: '1rem' }}>Email</th>
                                                <th style={{ padding: '1rem' }}>Rôle</th>
                                                <th style={{ padding: '1rem' }}>Statut</th>
                                                <th style={{ padding: '1rem', textAlign: 'right' }}>Action</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {users.map(u => (
                                                <tr key={u.id}>
                                                    <td style={{ padding: '1rem', fontWeight: 600 }}>{u.full_name}</td>
                                                    <td style={{ padding: '1rem', color: '#718096' }}>{u.email}</td>
                                                    <td style={{ padding: '1rem' }}>
                                                        <span className={`${styles.badge} ${u.role === 'admin' ? styles.adminBadge : styles.userBadge}`}>
                                                            {u.role}
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: '1rem' }} className={u.status === 'active' ? styles.statusActive : styles.statusInactive}>
                                                        {u.status === 'active' ? '● Actif' : '● Inactif'}
                                                    </td>
                                                    <td style={{ padding: '1rem', textAlign: 'right' }}>
                                                        {u.id !== profile?.id && (
                                                            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                                                                <button
                                                                    className={styles.actionBtn}
                                                                    style={{ color: '#2d3748' }}
                                                                    onClick={() => openEditUserModal(u)}
                                                                    title="Modifier"
                                                                >
                                                                    ✏️
                                                                </button>
                                                                <button
                                                                    className={styles.actionBtn}
                                                                    style={{ color: '#e53e3e' }}
                                                                    onClick={() => handleDeleteUser(u.id)}
                                                                    title="Supprimer"
                                                                >
                                                                    🗑️
                                                                </button>
                                                            </div>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* MODAL AJOUT / EDIT ENTREPRISE */}
            {isModalOpen && editingCompany && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modal}>
                        <div className={styles.modalHeader}>
                            <h2>{editingCompany.id ? 'Modifier l\'entreprise' : 'Nouvelle Entreprise'}</h2>
                            <button className={styles.closeBtn} onClick={() => setIsModalOpen(false)}>×</button>
                        </div>
                        <div className={styles.modalBody}>
                            <div className={styles.form}>
                                <div className={styles.responsiveRow}>
                                    <div className={styles.formGroup}>
                                        <label>Nom d'affichage</label>
                                        <input
                                            type="text"
                                            name="displayName"
                                            value={editingCompany.displayName}
                                            onChange={handleModalInputChange}
                                            className={styles.input}
                                            placeholder="Ex: Mon Entreprise SARL"
                                        />
                                    </div>
                                    <div className={styles.formGroup}>
                                        <label>Activité</label>
                                        <input
                                            type="text"
                                            name="businessType"
                                            value={editingCompany.businessType}
                                            onChange={handleModalInputChange}
                                            className={styles.input}
                                            placeholder="Ex: Commerce"
                                        />
                                    </div>
                                </div>

                                <div className={styles.formGroup}>
                                    <label>Adresse complète</label>
                                    <textarea
                                        name="address"
                                        value={editingCompany.address}
                                        onChange={handleModalInputChange}
                                        className={`${styles.input} ${styles.textarea}`}
                                        placeholder="Sise au quartier..."
                                    />
                                </div>

                                <div className={styles.responsiveRow}>
                                    <div className={styles.formGroup}>
                                        <label>NIF / RCCM</label>
                                        <input
                                            type="text"
                                            name="nif"
                                            value={editingCompany.nif || ''}
                                            onChange={handleModalInputChange}
                                            className={styles.input}
                                        />
                                    </div>
                                    <div className={styles.formGroup}>
                                        <label>Téléphone</label>
                                        <input
                                            type="text"
                                            name="phone"
                                            value={editingCompany.phone}
                                            onChange={handleModalInputChange}
                                            className={styles.input}
                                        />
                                    </div>
                                </div>

                                <div className={styles.formGroup}>
                                    <label>Modèle de design de facture</label>
                                    <div className={styles.templateGrid}>
                                        <div
                                            className={`${styles.templateOption} ${editingCompany.templateId === 'template_standard' ? styles.templateOptionSelected : ''}`}
                                            onClick={() => setEditingCompany({ ...editingCompany, templateId: 'template_standard' })}
                                        >
                                            <img src="/templates/template_standard.png" alt="Standard" className={styles.templatePreview} />
                                            <span className={styles.templateLabel}>Modèle 1</span>
                                        </div>
                                        <div
                                            className={`${styles.templateOption} ${editingCompany.templateId === 'template_modern' ? styles.templateOptionSelected : ''}`}
                                            onClick={() => setEditingCompany({ ...editingCompany, templateId: 'template_modern' })}
                                        >
                                            <img src="/templates/template_modern.png" alt="Modern" className={styles.templatePreview} />
                                            <span className={styles.templateLabel}>Modèle 2</span>
                                        </div>
                                        <div
                                            className={`${styles.templateOption} ${editingCompany.templateId === 'template_classic' ? styles.templateOptionSelected : ''}`}
                                            onClick={() => setEditingCompany({ ...editingCompany, templateId: 'template_classic' })}
                                        >
                                            <img src="/templates/template_classic.png" alt="Classic" className={styles.templatePreview} />
                                            <span className={styles.templateLabel}>Modèle 3</span>
                                        </div>
                                    </div>
                                </div>

                                <div className={styles.sealSection}>
                                    <label style={{ display: 'block', marginBottom: '1rem', fontWeight: 600 }}>Signature / Cachet (Optionnel)</label>
                                    {editingCompany.sealImage && (
                                        <img src={editingCompany.sealImage} alt="Preview" className={styles.sealPreview} />
                                    )}
                                    <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem' }}>
                                        <label className={styles.uploadButton}>
                                            📷 {editingCompany.sealImage ? 'Changer' : 'Uploader'}
                                            <input type="file" accept="image/*" onChange={handleFileUpload} style={{ display: 'none' }} />
                                        </label>
                                        {editingCompany.sealImage && (
                                            <button
                                                onClick={() => setEditingCompany({ ...editingCompany, sealImage: undefined })}
                                                style={{ background: 'transparent', color: '#e53e3e', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                                            >
                                                Retirer
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className={styles.modalFooter}>
                            <button className={styles.cancelButton} onClick={() => setIsModalOpen(false)}>Annuler</button>
                            <button className={styles.saveButton} onClick={handleSaveCompany} disabled={internalLoading}>
                                {internalLoading ? 'Chargement...' : 'Enregistrer'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL ÉDITION UTILISATEUR */}
            {isUserModalOpen && editingUser && (
                <div className={styles.modalOverlay} onClick={() => setIsUserModalOpen(false)}>
                    <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <h2>✏️ Modifier l'utilisateur</h2>
                            <button onClick={() => setIsUserModalOpen(false)} className={styles.closeBtn}>✕</button>
                        </div>

                        <form onSubmit={handleUpdateUser}>
                            <div className={styles.modalBody}>
                                <div className={styles.userFormGrid}>
                                    <div className={styles.formGroup}>
                                        <label>Nom Complet</label>
                                        <input
                                            className={styles.input}
                                            value={editingUser.fullName}
                                            onChange={(e) => setEditingUser({ ...editingUser, fullName: e.target.value })}
                                            required
                                        />
                                    </div>

                                    <div className={styles.formGroup}>
                                        <label>Email</label>
                                        <input
                                            className={styles.input}
                                            type="email"
                                            value={editingUser.email}
                                            onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                                            required
                                        />
                                    </div>

                                    <div className={styles.formGroup}>
                                        <label>Rôle</label>
                                        <select
                                            className={styles.input}
                                            value={editingUser.role}
                                            onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value })}
                                        >
                                            <option value="user">User</option>
                                            <option value="admin">Admin</option>
                                        </select>
                                    </div>

                                    <div className={styles.formGroup}>
                                        <label>Statut</label>
                                        <select
                                            className={styles.input}
                                            value={editingUser.status}
                                            onChange={(e) => setEditingUser({ ...editingUser, status: e.target.value })}
                                        >
                                            <option value="active">Actif</option>
                                            <option value="inactive">Inactif</option>
                                        </select>
                                    </div>

                                    <div className={styles.formGroup}>
                                        <label>Nouveau mot de passe (optionnel)</label>
                                        <input
                                            className={styles.input}
                                            type="password"
                                            value={editingUser.password}
                                            onChange={(e) => setEditingUser({ ...editingUser, password: e.target.value })}
                                            placeholder="Laisser vide pour ne pas changer"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className={styles.modalFooter}>
                                <button type="button" onClick={() => setIsUserModalOpen(false)} className={styles.cancelButton}>
                                    Annuler
                                </button>
                                <button type="submit" className={styles.saveButton}>
                                    Enregistrer
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

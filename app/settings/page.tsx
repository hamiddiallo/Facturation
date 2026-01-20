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
import { adminCreateUser, adminDeleteUser, adminListUsers, adminUpdateProfile, uploadAvatarAction } from '@/lib/adminActions';
import { useAuth } from '@/components/AuthProvider';
import PasswordStrength from '@/components/PasswordStrength';
import { toast } from 'sonner';
import ConfirmationDialog from '@/components/ConfirmationDialog';
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
    const [isNewUserPasswordValid, setIsNewUserPasswordValid] = useState(false);
    const [isEditingUserPasswordValid, setIsEditingUserPasswordValid] = useState(true);

    // Confirmation Modals State
    const [companyToDelete, setCompanyToDelete] = useState<string | null>(null);
    const [userToDelete, setUserToDelete] = useState<string | null>(null);

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
            templateId: 'template_standard',
            markupPercentage: 0
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

        let updates: any = { [name]: value };

        // Auto-generate unique ID from Display Name (only for NEW companies)
        if (name === 'displayName' && !editingCompany.id) {
            const slug = value.toLowerCase()
                .trim()
                .normalize('NFD') // Supprime les accents
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/[^a-z0-9]/g, '_') // Remplace spécial par _
                .replace(/_+/g, '_') // Évite les doubles __
                .replace(/^_|_$/g, ''); // Nettoie début/fin
            updates.name = slug;
        }

        if (name === 'markupPercentage') {
            setEditingCompany({ ...editingCompany, ...updates, [name]: value });
        } else {
            setEditingCompany({ ...editingCompany, ...updates });
        }
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
            toast.error('Erreur de compression', {
                description: 'Impossible de compresser l\'image sélectionnée.'
            });
        }
    };

    const handleSaveCompany = async () => {
        if (!editingCompany) return;
        setInternalLoading(true);

        try {
            // Ensure markupPercentage is a number
            const companyData = {
                ...editingCompany,
                markupPercentage: typeof editingCompany.markupPercentage === 'string'
                    ? parseFloat(editingCompany.markupPercentage) || 0
                    : editingCompany.markupPercentage || 0
            };

            if (editingCompany.id) {
                // Update
                const updated = await updateCompanyCloud(editingCompany.id, companyData);
                if (updated) toast.success('Entreprise mise à jour !');
            } else {
                // Create
                const created = await createCompanyCloud(companyData);
                if (created) toast.success('Nouvelle entreprise ajoutée !');
            }
            mutate('companies');
            setIsModalOpen(false);
        } catch (err) {
            toast.error('Erreur de sauvegarde');
        } finally {
            setInternalLoading(false);
        }
    };

    const handleDeleteCompany = (id: string) => {
        setCompanyToDelete(id);
    };

    const confirmDeleteCompany = async () => {
        if (!companyToDelete) return;
        setInternalLoading(true);
        const success = await deleteCompanyCloud(companyToDelete);
        if (success) {
            toast.success('Entreprise supprimée.');
            mutate('companies');
        }
        setCompanyToDelete(null);
        setInternalLoading(false);
    };

    const handleSetDefault = async (id: string) => {
        setInternalLoading(true);
        const success = await setDefaultCompanyCloud(id);
        if (success) {
            toast.success('Entreprise par défaut mise à jour !');
            mutate('companies');
        }
        setInternalLoading(false);
    };

    // --- Actions Utilisateurs ---
    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isNewUserPasswordValid) {
            toast.warning('Mot de passe invalide', {
                description: 'Le mot de passe ne respecte pas les critères.'
            });
            return;
        }
        setInternalLoading(true);
        try {
            const res = await adminCreateUser(newUser.email, newUser.password, newUser.fullName, newUser.role);
            if (!res.success) {
                toast.error('Erreur', { description: res.error });
                return;
            }
            setNewUser({ email: '', password: '', fullName: '', role: 'user' });
            mutate('users');
            toast.success('Utilisateur créé avec succès !');
        } catch (err: any) {
            toast.error('Erreur', { description: err.message });
        } finally {
            setInternalLoading(false);
        }
    };

    const handleDeleteUser = (id: string) => {
        setUserToDelete(id);
    };

    const confirmDeleteUser = async () => {
        if (!userToDelete) return;
        setInternalLoading(true);
        try {
            await adminDeleteUser(userToDelete);
            mutate('users');
            toast.success('Utilisateur révoqué.');
        } catch (err: any) {
            toast.error('Erreur', { description: err.message });
        } finally {
            setUserToDelete(null);
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
            avatar_url: user.avatar_url,
            password: '' // Vide par défaut, optionnel
        });
        setIsUserModalOpen(true);
    };

    const handleUserAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !editingUser) return;

        try {
            const options = {
                maxSizeMB: 0.15,
                maxWidthOrHeight: 400,
                useWebWorker: true,
            };

            setInternalLoading(true);
            const compressedFile = await imageCompression(file, options);

            const formData = new FormData();
            formData.append('file', compressedFile);
            formData.append('userId', editingUser.id);

            const result = await uploadAvatarAction(formData);

            if (result?.success && result.publicUrl) {
                setEditingUser({ ...editingUser, avatar_url: result.publicUrl });
                toast.info('Photo préparée', { description: 'Enregistrez pour confirmer le changement.' });
            }
        } catch (error) {
            console.error('Erreur upload avatar:', error);
            toast.error('Erreur de photo', { description: 'Erreur lors de l\'envoi de la photo.' });
        } finally {
            setInternalLoading(false);
        }
    };

    const handleUpdateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingUser) return;

        if (editingUser.password && !isEditingUserPasswordValid) {
            toast.warning('Mot de passe invalide', {
                description: 'Le nouveau mot de passe ne respecte pas les critères.'
            });
            return;
        }

        setInternalLoading(true);
        try {
            const res = await adminUpdateProfile(editingUser.id, {
                fullName: editingUser.fullName,
                email: editingUser.email,
                role: editingUser.role,
                status: editingUser.status,
                avatar_url: editingUser.avatar_url,
                password: editingUser.password || undefined
            });

            if (!res.success) {
                toast.error('Erreur', { description: res.error });
                return;
            }

            setIsUserModalOpen(false);
            setEditingUser(null);
            mutate('users');
            toast.success('Utilisateur modifié avec succès !');
        } catch (err: any) {
            toast.error('Erreur', { description: err.message });
        } finally {
            setInternalLoading(false);
        }
    };



    const setStatus = (msg: string, isError = false) => {
        if (isError) toast.error(msg);
        else toast.success(msg);
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
                    <p style={{ fontSize: '0.8rem', color: '#718096', marginBottom: '1rem' }}>Les champs marqués d'un astérisque (*) sont obligatoires.</p>
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
                        {/* Status notification area removed in favor of Sonner Toasts */}

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
                                            <label>Nom Complet *</label>
                                            <input
                                                className={styles.input}
                                                value={newUser.fullName}
                                                onChange={e => setNewUser({ ...newUser, fullName: e.target.value })}
                                                required
                                            />
                                        </div>
                                        <div className={styles.formGroup}>
                                            <label>Email *</label>
                                            <input
                                                className={styles.input}
                                                type="email"
                                                value={newUser.email}
                                                onChange={e => setNewUser({ ...newUser, email: e.target.value })}
                                                required
                                            />
                                        </div>
                                        <div className={styles.formGroup}>
                                            <label>Mot de passe *</label>
                                            <input
                                                className={styles.input}
                                                type="password"
                                                value={newUser.password}
                                                onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                                                required
                                            />
                                            <PasswordStrength
                                                password={newUser.password}
                                                onValidate={setIsNewUserPasswordValid}
                                            />
                                        </div>
                                        <button
                                            type="submit"
                                            className={styles.saveButton}
                                            style={{ padding: '0.75rem 1.5rem' }}
                                            disabled={loading || !isNewUserPasswordValid}
                                        >
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
                                                    <td style={{ padding: '1rem' }}>
                                                        <div className={styles.userThumbSection}>
                                                            {u.avatar_url ? (
                                                                <img src={u.avatar_url} alt="" className={styles.userThumb} />
                                                            ) : (
                                                                <div className={styles.userThumbPlaceholder}>
                                                                    {u.full_name?.[0]?.toUpperCase() || 'U'}
                                                                </div>
                                                            )}
                                                            <span style={{ fontWeight: 600 }}>{u.full_name}</span>
                                                        </div>
                                                    </td>
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
                                        <label>Nom d'affichage *</label>
                                        <input
                                            type="text"
                                            name="displayName"
                                            value={editingCompany.displayName}
                                            onChange={handleModalInputChange}
                                            className={styles.input}
                                            placeholder="Ex: Mon Entreprise SARL"
                                            autoFocus={!editingCompany.id}
                                            required
                                        />
                                    </div>
                                    <div className={styles.formGroup}>
                                        <label>Activité *</label>
                                        <input
                                            type="text"
                                            name="businessType"
                                            value={editingCompany.businessType}
                                            onChange={handleModalInputChange}
                                            className={styles.input}
                                            placeholder="Ex: Commerce"
                                            required
                                        />
                                    </div>
                                </div>

                                <div className={styles.formGroup}>
                                    <label>Adresse complète *</label>
                                    <textarea
                                        name="address"
                                        value={editingCompany.address}
                                        onChange={handleModalInputChange}
                                        className={`${styles.input} ${styles.textarea}`}
                                        placeholder="Sise au quartier..."
                                        required
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
                                        <label>Téléphone *</label>
                                        <input
                                            type="text"
                                            name="phone"
                                            value={editingCompany.phone}
                                            onChange={handleModalInputChange}
                                            className={styles.input}
                                            required
                                        />
                                    </div>
                                </div>

                                <div className={styles.responsiveRow}>
                                    <div className={styles.formGroup}>
                                        <label>Majoration (%)</label>
                                        <input
                                            type="number"
                                            name="markupPercentage"
                                            value={editingCompany.markupPercentage}
                                            onChange={handleModalInputChange}
                                            className={styles.input}
                                            min="0"
                                            max="100"
                                            step="0.1"
                                            placeholder="0"
                                        />
                                        <small style={{ color: '#718096', fontSize: '0.75rem', marginTop: '0.25rem', display: 'block' }}>
                                            Pourcentage de majoration appliqué aux prix (arrondi au multiple de 500 le plus proche)
                                        </small>
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
                                        <div
                                            className={`${styles.templateOption} ${editingCompany.templateId === 'template_moderne_blue' ? styles.templateOptionSelected : ''}`}
                                            onClick={() => setEditingCompany({ ...editingCompany, templateId: 'template_moderne_blue' })}
                                        >
                                            <img src="/templates/template_moderne_blue.png" alt="Moderne Blue" className={styles.templatePreview} />
                                            <span className={styles.templateLabel}>Modèle 4</span>
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
                                                onClick={() => setEditingCompany({ ...editingCompany, sealImage: null })}
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
                                <div className={styles.avatarSection} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '2rem', gap: '1rem' }}>
                                    <div className={styles.userThumbPlaceholder} style={{ width: '80px', height: '80px', fontSize: '2rem', borderRadius: '50%' }}>
                                        {editingUser.avatar_url ? (
                                            <img src={editingUser.avatar_url} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                                        ) : (
                                            editingUser.fullName?.[0]?.toUpperCase() || 'U'
                                        )}
                                    </div>
                                    <label className={styles.uploadButton} style={{ fontSize: '0.85rem' }}>
                                        📷 Changer la photo
                                        <input type="file" accept="image/*" onChange={handleUserAvatarUpload} style={{ display: 'none' }} />
                                    </label>
                                </div>
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
                                        <PasswordStrength
                                            password={editingUser.password}
                                            onValidate={setIsEditingUserPasswordValid}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className={styles.modalFooter}>
                                <button type="button" onClick={() => setIsUserModalOpen(false)} className={styles.cancelButton}>
                                    Annuler
                                </button>
                                <button
                                    type="submit"
                                    className={styles.saveButton}
                                    disabled={internalLoading || (!!editingUser.password && !isEditingUserPasswordValid)}
                                >
                                    Enregistrer
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <ConfirmationDialog
                isOpen={!!companyToDelete}
                onClose={() => setCompanyToDelete(null)}
                onConfirm={confirmDeleteCompany}
                title="Supprimer l'entreprise"
                message="Voulez-vous vraiment supprimer cette entreprise ? Toutes les données associées seront perdues."
                confirmLabel="Oui, supprimer"
                cancelLabel="Annuler"
                type="danger"
            />

            <ConfirmationDialog
                isOpen={!!userToDelete}
                onClose={() => setUserToDelete(null)}
                onConfirm={confirmDeleteUser}
                title="Révoquer l'utilisateur"
                message="Voulez-vous vraiment révoquer l'accès de cet utilisateur ? Il ne pourra plus se connecter."
                confirmLabel="Oui, révoquer"
                cancelLabel="Annuler"
                type="danger"
            />
        </div>
    );
}

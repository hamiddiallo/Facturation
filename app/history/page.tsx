'use client';

import React, { useState } from 'react';
import useSWR from 'swr';
import { useRouter } from 'next/navigation';
import { getInvoicesCloud, deleteInvoiceCloud } from '@/lib/supabaseServices';
import { saveInvoiceData } from '@/lib/storage';
import { InvoiceType } from '@/lib/types';
import { toast } from 'sonner';
import Skeleton from '@/components/Skeleton';
import ConfirmationDialog from '@/components/ConfirmationDialog';
import styles from './page.module.css';

type DateMode = 'any' | 'exact' | 'interval';

export default function HistoryPage() {
    const router = useRouter();

    const [currentPage, setCurrentPage] = useState(0);
    const pageSize = 20;

    // SWR Data Fetching - Key includes page to trigger re-fetch
    const { data: invoices = [], isLoading: isLoadingInvoices, mutate } = useSWR(['invoices', currentPage], () => getInvoicesCloud(currentPage, pageSize));

    const [internalLoading, setInternalLoading] = useState(false);
    const loading = isLoadingInvoices || internalLoading;

    // Filter States
    const [clientSearch, setClientSearch] = useState('');
    const [dateMode, setDateMode] = useState<DateMode>('any');
    const [exactDate, setExactDate] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    // Confirmation Modal States
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [invoiceToDelete, setInvoiceToDelete] = useState<string | null>(null);


    const handleLoadToForm = (inv: any, target: '/' | '/preview') => {
        const articles = inv.invoice_items.map((it: any) => ({
            designation: it.designation,
            quantity: it.quantity,
            unit: it.unit,
            price: it.price,
            totalPrice: it.total_price
        }));

        const totalFacture = articles.reduce((sum: number, it: any) => sum + it.totalPrice, 0);

        saveInvoiceData({
            client: {
                nom: inv.client_name,
                adresse: inv.client_address
            },
            numeroFacture: inv.number,
            articles: articles,
            dateFacture: inv.date.split('T')[0],
            selectedCompany: {
                id: inv.company_id,
                displayName: inv.companies?.display_name || 'Entreprise inconnue',
                name: '',
                businessType: '',
                address: '',
                phone: '',
                email: '',
                isDefault: false
            },
            amountPaid: inv.amount_paid,
            type: inv.type as InvoiceType,
            totalFacture
        });

        router.push(target);
    };

    const handleDelete = (id: string) => {
        setInvoiceToDelete(id);
        setIsDeleteDialogOpen(true);
    };

    const confirmDelete = async () => {
        if (!invoiceToDelete) return;

        // Configuration de la mutation optimiste
        const updatedInvoices = invoices.filter((inv: any) => inv.id !== invoiceToDelete);

        try {
            // Déclencher la mutation avec les données optimistes
            await mutate(
                deleteInvoiceCloud(invoiceToDelete).then(success => {
                    if (!success) throw new Error('Delete failed');
                    toast.success('Facture supprimée avec succès');
                    return updatedInvoices;
                }),
                {
                    optimisticData: updatedInvoices,
                    rollbackOnError: true,
                    populateCache: true,
                    revalidate: true // On force la revalidation après pour être sûr du compteur de pagination
                }
            );
        } catch (err) {
            console.error('Erreur suppression:', err);
            toast.error('Échec de la suppression', {
                description: 'La facture n\'a pas pu être supprimée du serveur.'
            });
        } finally {
            setInvoiceToDelete(null);
        }
    };

    const getTypeBadgeClass = (type: string) => {
        switch (type) {
            case 'PROFORMA': return styles.badgeProforma;
            case 'DEFINITIVE': return styles.badgeDefinitive;
            case 'SIMPLE': return styles.badgeSimple;
            case 'BON_LIVRAISON': return styles.badgeBL;
            default: return '';
        }
    };

    // --- LOGIQUE FILTRAGE ---
    const filteredInvoices = invoices.filter(inv => {
        const matchClient = inv.client_name.toLowerCase().includes(clientSearch.toLowerCase());
        let matchDate = true;
        const invDate = inv.date.split('T')[0];

        if (dateMode === 'exact' && exactDate) {
            matchDate = invDate === exactDate;
        } else if (dateMode === 'interval') {
            if (startDate && endDate) {
                matchDate = invDate >= startDate && invDate <= endDate;
            } else if (startDate) {
                matchDate = invDate >= startDate;
            } else if (endDate) {
                matchDate = invDate <= endDate;
            }
        }
        return matchClient && matchDate;
    });

    return (
        <div className={styles.page}>
            <div className={styles.container}>
                <header className={styles.header}>
                    <h1>📜 Historique des Factures</h1>
                    <button onClick={() => router.push('/')} className={styles.backButton}>
                        Retour au générateur
                    </button>
                </header>

                <div className={styles.searchPanel}>
                    <div className={styles.filterGroup}>
                        <label>Rechercher un client</label>
                        <input
                            type="text"
                            placeholder="Mamadou Saïdou..."
                            value={clientSearch}
                            onChange={(e) => setClientSearch(e.target.value)}
                            className={styles.input}
                        />
                    </div>

                    <div className={styles.filterGroup}>
                        <label>Mode de recherche par date</label>
                        <select
                            value={dateMode}
                            onChange={(e) => setDateMode(e.target.value as DateMode)}
                            className={styles.input}
                        >
                            <option value="any">Toute date</option>
                            <option value="exact">Date exacte</option>
                            <option value="interval">Intervalle de dates</option>
                        </select>
                    </div>

                    {dateMode === 'exact' && (
                        <div className={styles.filterGroup}>
                            <label>Date précise</label>
                            <input
                                type="date"
                                value={exactDate}
                                onChange={(e) => setExactDate(e.target.value)}
                                className={styles.input}
                            />
                        </div>
                    )}

                    {dateMode === 'interval' && (
                        <>
                            <div className={styles.filterGroup}>
                                <label>Depuis le</label>
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className={styles.input}
                                />
                            </div>
                            <div className={styles.filterGroup}>
                                <label>Jusqu'au</label>
                                <input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className={styles.input}
                                />
                            </div>
                        </>
                    )}
                </div>

                <div className={styles.tableContainer}>
                    {loading && invoices.length === 0 ? (
                        <div style={{ padding: '1rem' }}>
                            {[...Array(5)].map((_, i) => (
                                <Skeleton key={i} height="60px" className={styles.tableSkeleton} />
                            ))}
                        </div>
                    ) : (
                        <>
                            <div className={styles.tableCounter}>
                                <strong>{filteredInvoices.length}</strong> facture(s) trouvée(s)
                            </div>
                            {filteredInvoices.length === 0 ? (
                                <div className={styles.emptyState}>
                                    <p>Aucun résultat pour ces filtres.</p>
                                </div>
                            ) : (
                                <table className={styles.table}>
                                    <thead>
                                        <tr>
                                            <th>Date</th>
                                            <th>Entreprise</th>
                                            <th>N° Facture</th>
                                            <th>Type</th>
                                            <th>Client</th>
                                            <th>Montant Total</th>
                                            <th style={{ textAlign: 'right' }}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredInvoices.map((inv) => (
                                            <tr key={inv.id}>
                                                <td>{new Date(inv.date).toLocaleDateString('fr-FR')}</td>
                                                <td>{inv.companies?.display_name}</td>
                                                <td><strong>{inv.number}</strong></td>
                                                <td>
                                                    <span className={`${styles.badge} ${getTypeBadgeClass(inv.type)}`}>
                                                        {inv.type}
                                                    </span>
                                                </td>
                                                <td>{inv.client_name}</td>
                                                <td>{inv.total_amount.toLocaleString()} GNF</td>
                                                <td className={styles.actionCell}>
                                                    <button
                                                        className={styles.actionBtn}
                                                        onClick={() => handleLoadToForm(inv, '/')}
                                                        title="Modifier"
                                                    >
                                                        ✏️
                                                    </button>
                                                    <button
                                                        className={styles.actionBtn}
                                                        onClick={() => handleLoadToForm(inv, '/preview')}
                                                        title="Voir PDF"
                                                    >
                                                        📄
                                                    </button>
                                                    <button
                                                        className={`${styles.actionBtn} ${styles.deleteBtn}`}
                                                        onClick={() => handleDelete(inv.id)}
                                                        title="Supprimer"
                                                    >
                                                        🗑️
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}

                            <div className={styles.pagination}>
                                <button
                                    onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                                    disabled={currentPage === 0 || loading}
                                    className={styles.pageBtn}
                                >
                                    ← Précédente
                                </button>
                                <span className={styles.pageIndicator}>Page {currentPage + 1}</span>
                                <button
                                    onClick={() => setCurrentPage(p => p + 1)}
                                    disabled={invoices.length < pageSize || loading}
                                    className={styles.pageBtn}
                                >
                                    Suivante →
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>

            <ConfirmationDialog
                isOpen={isDeleteDialogOpen}
                onClose={() => setIsDeleteDialogOpen(false)}
                onConfirm={confirmDelete}
                title="Supprimer la facture"
                message="Voulez-vous vraiment supprimer cette facture définitivement ? Cette action est irréversible."
                confirmLabel="Oui, supprimer"
                cancelLabel="Annuler"
                type="danger"
            />
        </div>
    );
}

'use client';

import React, { useState } from 'react';
import useSWR from 'swr';
import { useRouter } from 'next/navigation';
import { getInvoicesCloud, deleteInvoiceCloud } from '@/lib/supabaseServices';
import { saveInvoiceData } from '@/lib/storage';
import { InvoiceType } from '@/lib/types';
import styles from './page.module.css';

type DateMode = 'any' | 'exact' | 'interval';

export default function HistoryPage() {
    const router = useRouter();

    // SWR Data Fetching
    const { data: invoices = [], isLoading: isLoadingInvoices, mutate } = useSWR('invoices', getInvoicesCloud);

    const [internalLoading, setInternalLoading] = useState(false);
    const loading = isLoadingInvoices || internalLoading;

    // Filter States
    const [clientSearch, setClientSearch] = useState('');
    const [dateMode, setDateMode] = useState<DateMode>('any');
    const [exactDate, setExactDate] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');


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

    const handleDelete = async (id: string) => {
        if (!confirm('Supprimer cette facture définitivement ?')) return;
        setInternalLoading(true);
        try {
            const success = await deleteInvoiceCloud(id);
            if (success) {
                mutate();
            } else {
                alert('Erreur lors de la suppression.');
            }
        } catch (err) {
            console.error('Erreur suppression:', err);
        } finally {
            setInternalLoading(false);
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
                        <p style={{ textAlign: 'center', padding: '2rem' }}>Chargement de l'historique...</p>
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
                                                        title="Ré-imprimer"
                                                    >
                                                        👁️
                                                    </button>
                                                    <button
                                                        className={`${styles.actionBtn} ${styles.danger}`}
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
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

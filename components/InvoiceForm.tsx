'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import useSWR from 'swr';
import { useRouter } from 'next/navigation';
import { Company, Article, InvoiceData, InvoiceType } from '@/lib/types';
import { saveInvoiceData, getInvoiceData, clearInvoiceData } from '@/lib/storage';
import { useAuth } from './AuthProvider';
import { getCompanies, saveInvoiceCloud } from '@/lib/supabaseServices';
import { getNextSequenceNumber, formatBaseInvoiceNumber } from '@/lib/counter';
import { toast } from 'sonner';
import ConfirmationDialog from './ConfirmationDialog';
import ArticleList from './ArticleList';
import styles from './InvoiceForm.module.css';

export default function InvoiceForm() {
    const router = useRouter();
    const { profile, signOut } = useAuth();

    // SWR Data Fetching
    const { data: companies = [] } = useSWR('companies', getCompanies);

    const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
    const [clientNom, setClientNom] = useState('');
    const [clientAdresse, setClientAdresse] = useState('');
    const [invoiceNumber, setInvoiceNumber] = useState('');
    const [invoiceDate, setInvoiceDate] = useState(
        new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    );
    const [articles, setArticles] = useState<Article[]>([
        { designation: '', quantity: 1, unit: '', price: 0, totalPrice: 0, delivered: false },
    ]);
    const [amountPaid, setAmountPaid] = useState<number | string>(0);
    const [invoiceType, setInvoiceType] = useState<InvoiceType>(InvoiceType.PROFORMA);
    const [showResetConfirm, setShowResetConfirm] = useState(false);

    // Initial sequence
    useEffect(() => {
        if (!invoiceNumber) {
            const seq = getNextSequenceNumber();
            setInvoiceNumber(formatBaseInvoiceNumber(seq));
        }
    }, [invoiceNumber]);

    // Load data
    useEffect(() => {
        if (companies.length > 0 && !selectedCompany) {
            const data = getInvoiceData();
            if (data) {
                setClientNom(data.client.nom);
                setClientAdresse(data.client.adresse || '');
                setInvoiceNumber(data.numeroFacture);
                setInvoiceDate(data.dateFacture);
                setArticles(data.articles.map(a => ({ ...a, delivered: a.delivered ?? false })));
                setAmountPaid(data.amountPaid || 0);
                setInvoiceType(data.type || InvoiceType.PROFORMA);

                const currentCompany = companies.find(c => c.id === data.selectedCompany.id) || companies.find(c => c.isDefault) || companies[0];
                setSelectedCompany(currentCompany || null);
            } else {
                const defaultComp = companies.find(c => c.isDefault) || companies[0];
                setSelectedCompany(defaultComp);
            }
        }
    }, [companies, selectedCompany]);

    const handleClearData = () => {
        setShowResetConfirm(true);
    };

    const confirmClearData = () => {
        clearInvoiceData();
        setClientNom('');
        setClientAdresse('');
        setArticles([{ designation: '', quantity: 1, unit: '', price: 0, totalPrice: 0, delivered: false }]);
        setAmountPaid('');
        setInvoiceType(InvoiceType.PROFORMA);
        const seq = getNextSequenceNumber();
        setInvoiceNumber(formatBaseInvoiceNumber(seq));
        toast.success('Formulaire réinitialisé avec succès');
    };

    const handleUpdateAllArticles = useCallback((updatedArticles: Article[]) => {
        setArticles(updatedArticles);
    }, []);

    const onAddArticle = useCallback(() => {
        if (articles.length >= 20) {
            toast.warning("Limite de 20 articles atteinte", {
                description: "Pour garantir un affichage optimal sur une seule page A4, vous ne pouvez pas ajouter plus d'articles."
            });
            return;
        }
        setArticles(prev => [...prev, { designation: '', quantity: 1, unit: '', price: 0, totalPrice: 0, delivered: false }]);
    }, [articles.length]);

    const onRemoveArticle = useCallback((idx: number) => {
        setArticles(prev => prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev);
    }, []);

    const onUpdateArticle = useCallback((idx: number, art: Article) => {
        setArticles(prev => {
            const newArts = [...prev];
            newArts[idx] = art;
            return newArts;
        });
    }, []);

    const totalFacture = useMemo(() => articles.reduce((sum, article) => sum + article.totalPrice, 0), [articles]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedCompany) {
            toast.error("Entreprise manquante", {
                description: "Veuillez configurer au moins une entreprise dans les paramètres."
            });
            return;
        }

        const invoiceData: InvoiceData = {
            client: { nom: clientNom, adresse: clientAdresse },
            numeroFacture: invoiceNumber,
            dateFacture: invoiceDate,
            articles,
            totalFacture,
            selectedCompany: selectedCompany!,
            amountPaid: Number(amountPaid) || 0,
            type: invoiceType,
        };

        saveInvoiceData(invoiceData);
        saveInvoiceCloud(invoiceData, selectedCompany.id, totalFacture);
        router.push('/preview');
    };

    return (
        <form className={styles.form} onSubmit={handleSubmit}>

            <div className={styles.formGrid}>
                {/* SECTION CLIENT */}
                <div className={styles.section}>
                    <h2 className={styles.sectionTitle}>🤝 Client</h2>
                    <div className={styles.field}>
                        <label className={styles.label}>Nom du client *</label>
                        <input
                            type="text"
                            value={clientNom}
                            onChange={(e) => setClientNom(e.target.value)}
                            className={styles.input}
                            required
                            placeholder="Mamadou Saïdou Diallo"
                        />
                    </div>
                    <div className={styles.field} style={{ marginTop: '1rem' }}>
                        <label className={styles.label}>Adresse du client *</label>
                        <input
                            type="text"
                            value={clientAdresse}
                            onChange={(e) => setClientAdresse(e.target.value)}
                            className={styles.input}
                            required
                            placeholder="Kounsitel (Guinée)"
                        />
                    </div>
                </div>

                {/* SECTION DOCUMENT */}
                <div className={styles.section}>
                    <h2 className={styles.sectionTitle}>📄 Document</h2>
                    <div className={styles.docGrid}>
                        <div className={styles.field}>
                            <label className={styles.label}>Type</label>
                            <select
                                value={invoiceType}
                                onChange={(e) => setInvoiceType(e.target.value as InvoiceType)}
                                className={styles.input}
                            >
                                <option value={InvoiceType.PROFORMA}>Proforma</option>
                                <option value={InvoiceType.DEFINITIVE}>Définitive</option>
                                <option value={InvoiceType.BON_LIVRAISON}>Livraison</option>
                                <option value={InvoiceType.SIMPLE}>Simple</option>
                            </select>
                        </div>
                        <div className={styles.field}>
                            <label className={styles.label}>N° Facture</label>
                            <div className={styles.inputGroup}>
                                <input
                                    type="text"
                                    value={invoiceNumber}
                                    onChange={(e) => setInvoiceNumber(e.target.value)}
                                    className={styles.input}
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setInvoiceNumber(formatBaseInvoiceNumber(getNextSequenceNumber()))}
                                    className={styles.suggestButton}
                                >
                                    🎲
                                </button>
                            </div>
                        </div>
                        <div className={styles.field}>
                            <label className={styles.label}>Date</label>
                            <input
                                type="text"
                                value={invoiceDate}
                                onChange={(e) => setInvoiceDate(e.target.value)}
                                className={styles.input}
                                placeholder="JJ/MM/AAAA"
                            />
                        </div>
                    </div>
                </div>
            </div>

            <ArticleList
                articles={articles}
                onAddArticle={onAddArticle}
                onRemoveArticle={onRemoveArticle}
                onUpdateArticle={onUpdateArticle}
                onUpdateAllArticles={handleUpdateAllArticles}
                amountPaid={amountPaid}
                onAmountPaidChange={setAmountPaid}
            />

            <div className={styles.submitContainer}>
                <button type="button" onClick={handleClearData} className={styles.clearButton}>
                    🗑️ Réinitialiser
                </button>
                <button type="submit" className={styles.submitButton}>
                    Finaliser et Prévisualiser →
                </button>
            </div>

            <ConfirmationDialog
                isOpen={showResetConfirm}
                onClose={() => setShowResetConfirm(false)}
                onConfirm={confirmClearData}
                title="Réinitialiser le formulaire"
                message="Êtes-vous sûr de vouloir effacer toutes les données saisies ? Cette action est irréversible."
                confirmLabel="Oui, effacer"
                cancelLabel="Annuler"
                type="danger"
            />
        </form>
    );
}

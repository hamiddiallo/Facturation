'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import useSWR from 'swr';
import { useRouter } from 'next/navigation';
import { Company, Article, InvoiceData, InvoiceType } from '@/lib/types';
import { saveInvoiceData, getInvoiceData, clearInvoiceData } from '@/lib/storage';
import { useAuth } from './AuthProvider';
import { getCompanies, saveInvoiceCloud, getNextSequenceCloud } from '@/lib/supabaseServices';
import { formatBaseInvoiceNumber } from '@/lib/counter';
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
    const invoiceNumberRef = useRef<HTMLInputElement>(null);
    const [articles, setArticles] = useState<Article[]>([
        { designation: '', quantity: 1, unit: '', price: 0, totalPrice: 0, delivered: false },
    ]);
    const [amountPaid, setAmountPaid] = useState<number | string>(0);
    const [invoiceType, setInvoiceType] = useState<InvoiceType>(InvoiceType.PROFORMA);
    const [showResetConfirm, setShowResetConfirm] = useState(false);
    const [generatedNumber, setGeneratedNumber] = useState<string>('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Initial sequence from Cloud
    // Removed automatic number loading - user must click dice button

    // Load data (separate from initialization to avoid conflict)
    useEffect(() => {
        if (companies.length > 0 && !selectedCompany) {
            const data = getInvoiceData();
            if (data) {
                setClientNom(data.client.nom);
                setClientAdresse(data.client.adresse || '');
                // Only override invoice number if we have saved data
                if (data.numeroFacture) {
                    setInvoiceNumber(data.numeroFacture);
                }
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
        setInvoiceNumber('');
        setGeneratedNumber(''); // Reset pour permettre nouvelle réservation
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

    const handleGenerateNumber = async () => {
        try {
            // Lire le prochain numéro disponible (counter + 1)
            const nextSeq = await getNextSequenceCloud();
            const formatted = formatBaseInvoiceNumber(nextSeq);
            setInvoiceNumber(formatted);
            toast.success("Numéro suggéré", {
                description: `${formatted} - Prochain numéro disponible`
            });
        } catch (error) {
            console.error(error);
            toast.error("Échec de lecture du compteur", {
                description: "Vérifiez votre connexion internet."
            });
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedCompany) {
            toast.error("Entreprise manquante", {
                description: "Veuillez configurer au moins une entreprise dans les paramètres."
            });
            return;
        }

        if (!invoiceNumber || invoiceNumber.trim() === '') {
            toast.error("Numéro de facture manquant", {
                description: "Veuillez saisir un numéro de facture ou utiliser le bouton 🎲 pour en générer un."
            });
            invoiceNumberRef.current?.focus();
            return;
        }

        const invoiceData: InvoiceData = {
            client: { nom: clientNom, adresse: clientAdresse },
            numeroFacture: invoiceNumber, // Numéro réservé par le bouton dé
            dateFacture: invoiceDate,
            articles,
            totalFacture,
            selectedCompany: selectedCompany!,
            amountPaid: Number(amountPaid) || 0,
            type: invoiceType,
        };

        const performSave = async () => {
            setIsSubmitting(true);
            const toastId = toast.loading("Sauvegarde en cours...");

            try {
                // Sauvegarde locale (immédiate)
                saveInvoiceData(invoiceData);

                // Sauvegarde cloud (doit être attendue pour garantir l'incrément)
                const result = await saveInvoiceCloud(
                    invoiceData,
                    selectedCompany.id,
                    totalFacture
                );

                if (!result) {
                    throw new Error("Échec de la sauvegarde Cloud");
                }


                // Clear state pour la prochaine facture
                setGeneratedNumber('');
                toast.success("Facture enregistrée", { id: toastId });
                router.push('/preview');
            } catch (error) {
                console.error(error);
                toast.error("Erreur lors de la sauvegarde", {
                    id: toastId,
                    description: "Vérifiez votre connexion internet."
                });
                setIsSubmitting(false);
            }
        };

        performSave();
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
                            <label className={styles.label}>N° Facture *</label>
                            <div className={styles.inputGroup}>
                                <input
                                    ref={invoiceNumberRef}
                                    type="text"
                                    value={invoiceNumber}
                                    onChange={(e) => setInvoiceNumber(e.target.value)}
                                    className={styles.input}
                                    placeholder="Ex: FAC-2501-0001"
                                // readOnly={true} // Débloqué pour édition manuelle
                                />
                                <button
                                    type="button"
                                    onClick={handleGenerateNumber}
                                    className={styles.suggestButton}
                                    title="Générer le prochain numéro"
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
                <button type="submit" className={styles.submitButton} disabled={isSubmitting}>
                    {isSubmitting ? 'Finalisation...' : 'Finaliser et Prévisualiser →'}
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

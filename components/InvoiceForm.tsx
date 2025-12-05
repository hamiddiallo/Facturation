'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Company, Article, InvoiceData } from '@/lib/types';
import { saveInvoiceData, getInvoiceData, clearInvoiceData } from '@/lib/storage';
import { companies } from '@/lib/companies';
import CompanySelector from './CompanySelector';
import ArticleList from './ArticleList';
import styles from './InvoiceForm.module.css';

export default function InvoiceForm() {
    const router = useRouter();
    const [selectedCompany, setSelectedCompany] = useState<Company | null>(companies[0]);
    const [clientName, setClientName] = useState('');
    const [clientAddress, setClientAddress] = useState('');
    const [invoiceNumber, setInvoiceNumber] = useState('');
    const [invoiceDate, setInvoiceDate] = useState(
        new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    );
    const [articles, setArticles] = useState<Article[]>([
        { designation: '', quantity: 1, unit: '', price: 0, totalPrice: 0, delivered: false },
    ]);
    const [amountPaid, setAmountPaid] = useState<number>(0);

    // Load data from localStorage on mount
    useEffect(() => {
        const savedData = getInvoiceData();
        if (savedData) {
            setSelectedCompany(savedData.selectedCompany);
            setClientName(savedData.client.nom);
            setClientAddress(savedData.client.adresse);
            setInvoiceNumber(savedData.numeroFacture);
            setInvoiceDate(savedData.dateFacture);
            // Ensure all articles have delivered property
            const normalizedArticles = savedData.articles.map(article => ({
                ...article,
                delivered: article.delivered ?? false
            }));
            setArticles(normalizedArticles);
            setAmountPaid(savedData.amountPaid || 0);
        }
    }, []);

    const handleClearData = () => {
        if (confirm('Êtes-vous sûr de vouloir effacer toutes les données ?')) {
            clearInvoiceData();
            // Reset form
            setSelectedCompany(companies[0]);
            setClientName('');
            setClientAddress('');
            setInvoiceNumber('');
            setInvoiceDate(new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }));
            setArticles([{ designation: '', quantity: 1, unit: '', price: 0, totalPrice: 0, delivered: false }]);
            setAmountPaid(0);
        }
    };

    const handleAddArticle = () => {
        setArticles([...articles, { designation: '', quantity: 1, unit: '', price: 0, totalPrice: 0, delivered: false }]);
    };

    const handleRemoveArticle = (index: number) => {
        if (articles.length > 1) {
            setArticles(articles.filter((_, i) => i !== index));
        }
    };

    const handleUpdateArticle = (index: number, article: Article) => {
        const newArticles = [...articles];
        newArticles[index] = article;
        setArticles(newArticles);
    };

    const handleUpdateAllArticles = (updatedArticles: Article[]) => {
        setArticles(updatedArticles);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();



        const totalFacture = articles.reduce((sum, article) => sum + article.totalPrice, 0);

        const invoiceData: InvoiceData = {
            client: {
                nom: clientName,
                adresse: clientAddress,
            },
            numeroFacture: invoiceNumber,
            dateFacture: invoiceDate,
            articles,
            totalFacture,
            selectedCompany: selectedCompany || companies[0],
            amountPaid,
        };

        saveInvoiceData(invoiceData);
        router.push('/preview');
    };

    return (
        <form onSubmit={handleSubmit} className={styles.form}>
            {/* Welcome Animation Section */}
            <div className={styles.welcomeSection}>
                <div className={styles.floatingIcons}>
                    <span className={styles.icon} style={{ animationDelay: '0s' }}>🧾</span>
                    <span className={styles.icon} style={{ animationDelay: '1s' }}>💰</span>
                    <span className={styles.icon} style={{ animationDelay: '2s' }}>📊</span>
                    <span className={styles.icon} style={{ animationDelay: '3s' }}>📝</span>
                </div>
                <h1 className={styles.welcomeTitle}>
                    Générateur de Factures <span className={styles.highlight}>Pro</span>
                </h1>
            </div>

            <div className={styles.section}>
                <h2 className={styles.sectionTitle}>Informations du client</h2>
                <div className={styles.grid}>
                    <div className={styles.field}>
                        <label htmlFor="clientName" className={styles.label}>
                            Nom du client *
                        </label>
                        <input
                            type="text"
                            id="clientName"
                            value={clientName}
                            onChange={(e) => setClientName(e.target.value)}
                            className={styles.input}
                            required
                            placeholder="Mr Mamadou Saïdou Diallo"
                        />
                    </div>
                    <div className={styles.field}>
                        <label htmlFor="clientAddress" className={styles.label}>
                            Adresse du client *
                        </label>
                        <input
                            type="text"
                            id="clientAddress"
                            value={clientAddress}
                            onChange={(e) => setClientAddress(e.target.value)}
                            className={styles.input}
                            required
                            placeholder="Kounsitel (Guinée)"
                        />
                    </div>
                </div>
            </div>

            <div className={styles.section}>
                <h2 className={styles.sectionTitle}>Informations de la facture</h2>
                <div className={styles.grid}>
                    <div className={styles.field}>
                        <label htmlFor="invoiceNumber" className={styles.label}>
                            Numéro de facture *
                        </label>
                        <div className={styles.inputGroup}>
                            <input
                                type="text"
                                id="invoiceNumber"
                                value={invoiceNumber}
                                onChange={(e) => setInvoiceNumber(e.target.value)}
                                className={styles.input}
                                style={{ flex: 1 }}
                                required
                                placeholder="000xk215"
                            />
                            <button
                                type="button"
                                onClick={() => {
                                    const date = new Date();
                                    const year = date.getFullYear().toString().slice(-2);
                                    const month = (date.getMonth() + 1).toString().padStart(2, '0');
                                    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
                                    setInvoiceNumber(`FAC-${year}${month}-${random}`);
                                }}
                                className={styles.suggestButton}
                                title="Générer un numéro"
                            >
                                🎲
                            </button>
                        </div>
                    </div>
                    <div className={styles.field}>
                        <label htmlFor="invoiceDate" className={styles.label}>
                            Date de la facture *
                        </label>
                        <input
                            type="text"
                            id="invoiceDate"
                            value={invoiceDate}
                            onChange={(e) => setInvoiceDate(e.target.value)}
                            className={styles.input}
                            required
                            placeholder="JJ/MM/AAAA"
                        />
                    </div>
                    <div className={styles.field}>
                        <label htmlFor="amountPaid" className={styles.label}>
                            Montant payé (GNF)
                        </label>
                        <input
                            type="number"
                            id="amountPaid"
                            value={amountPaid}
                            onChange={(e) => setAmountPaid(Number(e.target.value) || 0)}
                            className={styles.input}
                            min="0"
                            placeholder="0"
                        />
                    </div>
                </div>
            </div>

            <ArticleList
                articles={articles}
                onAddArticle={handleAddArticle}
                onRemoveArticle={handleRemoveArticle}
                onUpdateArticle={handleUpdateArticle}
                onUpdateAllArticles={handleUpdateAllArticles}
            />

            <div className={styles.submitContainer}>
                <button type="button" onClick={handleClearData} className={styles.clearButton}>
                    🗑️ Effacer tout
                </button>
                <button type="submit" className={styles.submitButton}>
                    Générer la facture →
                </button>
            </div>
        </form>
    );
}

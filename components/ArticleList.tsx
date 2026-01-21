import React, { memo } from 'react';
import { Article } from '@/lib/types';
import styles from './ArticleList.module.css';

interface ArticleListProps {
    articles: Article[];
    onUpdateArticle: (index: number, article: Article) => void;
    onUpdateAllArticles: (articles: Article[]) => void;
    onRemoveArticle: (index: number) => void;
    onAddArticle: () => void;
    amountPaid: number | string;
    onAmountPaidChange: (amount: number | string) => void;
}

const ArticleList = memo(({
    articles,
    onUpdateArticle,
    onUpdateAllArticles,
    onRemoveArticle,
    onAddArticle,
    amountPaid,
    onAmountPaidChange,
}: ArticleListProps) => {
    const handleFieldChange = (index: number, field: keyof Article, value: string | number) => {
        const article = { ...articles[index] };

        if (field === 'designation' || field === 'unit') {
            article[field] = value as string;
        } else if (field === 'quantity' || field === 'price') {
            const numValue = value === '' ? '' : (parseFloat(value.toString()) || 0);
            article[field] = numValue as any;
            article.totalPrice = (Number(article.quantity) || 0) * (Number(article.price) || 0);
        }

        onUpdateArticle(index, article);
    };

    const handleToggleAllDelivered = () => {
        const allDelivered = articles.every(article => article.delivered);
        const newDeliveredState = !allDelivered;

        // Update all articles at once
        const updatedArticles = articles.map(article => ({
            ...article,
            delivered: newDeliveredState
        }));
        onUpdateAllArticles(updatedArticles);
    };

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h3 className={styles.title}>Articles</h3>
                <button
                    type="button"
                    onClick={onAddArticle}
                    className={`${styles.addButton} ${articles.length >= 20 ? styles.limitReached : ''}`}
                    title={articles.length >= 20 ? "Cliquez pour plus d'infos sur la limite" : "Ajouter un article"}
                >
                    + Ajouter un article {articles.length >= 20 && "(Limite atteinte)"}
                </button>
            </div>

            <div className={styles.tableWrapper}>
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th>Nº</th>
                            <th style={{ textAlign: 'center' }}>
                                Livré
                                <br />
                                <button
                                    type="button"
                                    onClick={handleToggleAllDelivered}
                                    className={styles.toggleAllButton}
                                    title={articles.every(a => a.delivered) ? "Tout décocher" : "Tout sélectionner"}
                                >
                                    {articles.every(a => a.delivered) ? '☑' : '☐'}
                                </button>
                            </th>
                            <th className={styles.designationCell}>Désignation</th>
                            <th>Quantité</th>
                            <th className={styles.unitCell}>Unité</th>
                            <th>Prix Unitaire (GNF)</th>
                            <th>Prix Total (GNF)</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {articles.map((article, index) => (
                            <tr key={index}>
                                <td className={styles.numberCell}>{index + 1}</td>
                                <td className={styles.checkboxCell}>
                                    <input
                                        type="checkbox"
                                        checked={article.delivered || false}
                                        onChange={(e) => {
                                            const updatedArticle = { ...article, delivered: e.target.checked };
                                            onUpdateArticle(index, updatedArticle);
                                        }}
                                        className={styles.checkbox}
                                        title="Article livré"
                                    />
                                </td>
                                <td className={styles.designationCell}>
                                    <input
                                        type="text"
                                        value={article.designation}
                                        onChange={(e) => handleFieldChange(index, 'designation', e.target.value)}
                                        placeholder="Description de l'article"
                                        className={styles.input}
                                        required
                                    />
                                </td>
                                <td>
                                    <input
                                        type="number"
                                        value={article.quantity}
                                        onChange={(e) => handleFieldChange(index, 'quantity', e.target.value)}
                                        min="1"
                                        className={styles.inputNumber}
                                        required
                                    />
                                </td>
                                <td className={styles.unitCell}>
                                    <input
                                        type="text"
                                        value={article.unit || ''}
                                        onChange={(e) => handleFieldChange(index, 'unit', e.target.value)}
                                        placeholder="Unité"
                                        className={styles.inputSmall}
                                    />
                                </td>
                                <td>
                                    <input
                                        type="number"
                                        value={article.price}
                                        onChange={(e) => handleFieldChange(index, 'price', e.target.value)}
                                        min="0"
                                        className={styles.inputNumber}
                                        required
                                    />
                                </td>
                                <td className={styles.totalCell}>
                                    {article.totalPrice.toLocaleString()} GNF
                                </td>
                                <td>
                                    <button
                                        type="button"
                                        onClick={() => onRemoveArticle(index)}
                                        className={styles.removeButton}
                                        disabled={articles.length === 1}
                                    >
                                        ✕
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className={styles.footerSummary}>
                <div className={styles.totalBlock}>
                    <strong>Total: </strong>
                    <span className={styles.totalAmount}>
                        {articles.reduce((sum, article) => sum + article.totalPrice, 0).toLocaleString()} GNF
                    </span>
                </div>
                <div className={styles.acompteBlock}>
                    <label>Acompte :</label>
                    <input
                        type="number"
                        value={amountPaid}
                        onChange={(e) => onAmountPaidChange(e.target.value === '' ? '' : e.target.value)}
                        className={styles.inputLocal}
                        placeholder="0"
                    />
                    <span>GNF</span>
                </div>
            </div>
        </div>
    );
});

export default ArticleList;

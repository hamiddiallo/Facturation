'use client';

import { Article } from '@/lib/types';
import styles from './ArticleList.module.css';

interface ArticleListProps {
    articles: Article[];
    onUpdateArticle: (index: number, article: Article) => void;
    onRemoveArticle: (index: number) => void;
    onAddArticle: () => void;
}

export default function ArticleList({
    articles,
    onUpdateArticle,
    onRemoveArticle,
    onAddArticle,
}: ArticleListProps) {
    const handleFieldChange = (index: number, field: keyof Article, value: string | number) => {
        const article = { ...articles[index] };

        if (field === 'designation' || field === 'unit') {
            article[field] = value as string;
        } else if (field === 'quantity' || field === 'price') {
            const numValue = typeof value === 'string' ? parseFloat(value) || 0 : value;
            article[field] = numValue;
            article.totalPrice = article.quantity * article.price;
        }

        onUpdateArticle(index, article);
    };

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h3 className={styles.title}>Articles</h3>
                <button type="button" onClick={onAddArticle} className={styles.addButton}>
                    + Ajouter un article
                </button>
            </div>

            <div className={styles.tableWrapper}>
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th>Nº</th>
                            <th>Désignation</th>
                            <th>Quantité</th>
                            <th>Unité</th>
                            <th>Prix Unitaire (GNF)</th>
                            <th>Prix Total (GNF)</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {articles.map((article, index) => (
                            <tr key={index}>
                                <td className={styles.numberCell}>{index + 1}</td>
                                <td>
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
                                <td>
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

            <div className={styles.total}>
                <strong>Total: </strong>
                <span className={styles.totalAmount}>
                    {articles.reduce((sum, article) => sum + article.totalPrice, 0).toLocaleString()} GNF
                </span>
            </div>
        </div>
    );
}

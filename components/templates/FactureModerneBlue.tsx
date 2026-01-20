import React from 'react';
import { InvoiceData } from '@/lib/types';
import { numberToWords } from '@/lib/numberToWords';
import { calculateAdjustedPrice } from '@/lib/priceCalculations';
import { getInvoiceTitle } from '@/lib/textUtils';
import styles from './FactureModerneBlue.module.css';

interface FactureModerneBlueProps {
    data: InvoiceData;
    showDelivered?: boolean;
}

export default function FactureModerneBlue({ data, showDelivered = true }: FactureModerneBlueProps) {
    const markupPercentage = data.selectedCompany.markupPercentage || 0;

    // Calculate total with markup
    const totalWithMarkup = data.articles.reduce((sum, article) => {
        const adjustedPrice = calculateAdjustedPrice(article.price, markupPercentage);
        return sum + (adjustedPrice * article.quantity);
    }, 0);

    // Use centralized numberToWords utility
    const amountInWords = numberToWords(totalWithMarkup);

    return (
        <div className={styles.container}>
            {/* Header */}
            <div className={styles.header}>
                <div className={styles.companyInfo}>
                    <h1 className={styles.companyName}>{data.selectedCompany.displayName}</h1>
                    <div className={styles.companyDetails}>
                        {data.selectedCompany.address && (
                            <div>📍 {data.selectedCompany.address}</div>
                        )}
                        {data.selectedCompany.phone && (
                            <div>📞 {data.selectedCompany.phone}</div>
                        )}
                    </div>
                </div>
                <div className={styles.invoiceTitle}>{getInvoiceTitle(data.type)}</div>
            </div>

            {/* Invoice Meta */}
            <div className={styles.invoiceMeta}>
                <div className={styles.metaItem}>
                    <div className={styles.metaLabel}>Numéro</div>
                    <div className={styles.metaValue}>#{data.numeroFacture}</div>
                </div>
                <div className={styles.metaItem}>
                    <div className={styles.metaLabel}>Date d'émission</div>
                    <div className={styles.metaValue}>{data.dateFacture}</div>
                </div>
                <div className={styles.metaItem}>
                    <div className={styles.metaLabel}>Devise</div>
                    <div className={styles.metaValue}>GNF</div>
                </div>
            </div>

            {/* Client Box */}
            <div className={styles.clientBox}>
                <div className={styles.clientInfoRow}>
                    <span className={styles.clientLabel}>Facture à :</span>
                    <span className={styles.clientName}>{data.client.nom}</span>
                    {data.client.adresse && (
                        <span className={styles.clientAddressSeparator}> - </span>
                    )}
                    {data.client.adresse && (
                        <span className={styles.clientAddress}>{data.client.adresse}</span>
                    )}
                </div>
            </div>

            {/* Articles Table */}
            <table className={styles.table}>
                <thead className={styles.tableHeader}>
                    <tr>
                        <th>N°</th>
                        {showDelivered && <th>Livré</th>}
                        <th>Désignation</th>
                        <th>Quantité</th>
                        <th>Unité</th>
                        <th>Prix Unitaire</th>
                        <th>Total</th>
                    </tr>
                </thead>
                <tbody>
                    {data.articles.map((article, index) => {
                        const adjustedPrice = calculateAdjustedPrice(article.price, markupPercentage);
                        const total = adjustedPrice * article.quantity;

                        return (
                            <tr key={index} className={styles.tableRow}>
                                <td>{String(index + 1).padStart(2, '0')}</td>
                                {showDelivered && (
                                    <td>
                                        {article.delivered ? (
                                            <span className={styles.deliveryStatus}>✓</span>
                                        ) : (
                                            <span className={`${styles.deliveryStatus} ${styles.deliveryStatusPending}`}>-</span>
                                        )}
                                    </td>
                                )}
                                <td>{article.designation}</td>
                                <td>{article.quantity}</td>
                                <td>{article.unit || '-'}</td>
                                <td>{adjustedPrice.toLocaleString('fr-FR')}</td>
                                <td>{total.toLocaleString('fr-FR')}</td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>

            {/* Total */}
            <div className={styles.totalSection}>
                <div className={styles.totalBox}>
                    <span className={styles.totalLabel}>Total Net</span>
                    <span className={styles.totalAmount}>{totalWithMarkup.toLocaleString('fr-FR')} FG</span>
                </div>
            </div>

            {/* Amount in Words */}
            <div className={styles.amountInWords}>
                Arrêté la présente facture à la somme de : <strong>{amountInWords} GNF</strong>
            </div>

            {/* Signatures */}
            <div className={styles.signatures}>
                <div className={styles.signatureBlock}>
                    <div className={styles.signatureLabel}>Le Directeur Général</div>
                    <div className={styles.signatureSpace}>
                        {data.selectedCompany.sealImage && (
                            <img
                                src={data.selectedCompany.sealImage}
                                alt="Cachet"
                                style={{ maxWidth: '180px', maxHeight: '100px', objectFit: 'contain' }}
                            />
                        )}
                    </div>
                    <div className={styles.signatureLine}></div>
                </div>
                <div className={styles.signatureBlock}>
                    <div className={styles.signatureLabel}>Le client</div>
                    <div className={styles.signatureSpace}></div>
                    <div className={styles.signatureLine}></div>
                </div>
            </div>
        </div>
    );
}

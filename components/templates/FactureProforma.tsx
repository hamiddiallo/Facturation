import { InvoiceData } from '@/lib/types';
import { numberToWords } from '@/lib/numberToWords';
import { calculateAdjustedPrice } from '@/lib/priceCalculations';
import { getInvoiceTitle } from '@/lib/textUtils';
import styles from './FactureProforma.module.css';

interface FactureProformaProps {
    data: InvoiceData;
    showDelivered?: boolean;
}

export default function FactureProforma({ data, showDelivered = true }: FactureProformaProps) {
    const company = data.selectedCompany;
    const isModern = company.templateId === 'template_modern';
    const isClassic = company.templateId === 'template_classic';

    const totalAmount = data.articles.reduce((sum, article) => {
        const adjustedPrice = calculateAdjustedPrice(article.price, data.selectedCompany.markupPercentage || 0);
        return sum + (adjustedPrice * article.quantity);
    }, 0);

    const amountInWords = numberToWords(totalAmount);

    return (
        <div className={isModern ? styles.fadyContainer : styles.invoice} style={isModern ? { width: '210mm', minHeight: '297mm', padding: '15mm', margin: '0 auto', background: 'white' } : {}}>
            {isModern ? (
                // --- DESIGN MODERN (PREMIUM BLUE) ---
                <>
                    {/* Header */}
                    <div className={styles.fadyHeader}>
                        <div className={styles.headerCenter}>
                            <h1 className={styles.fadyTitle}>{company.displayName}</h1>
                            <p className={styles.fadySubtitle}>Import - Export - Alimentation Générale</p>
                            <p className={styles.fadyPhone}>Tél : {company.phone}</p>
                        </div>
                        {company.sealImage && (
                            <div className={styles.cachetBox} style={{ border: 'none' }}>
                                <img src={company.sealImage} alt="Cachet" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                            </div>
                        )}
                    </div>

                    <hr className={styles.blueLine} />

                    {/* Invoice Info */}
                    <div className={styles.invoiceInfoBar}>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <span className={styles.factureTitle}>{getInvoiceTitle(data.type)} Nº</span>
                            <span className={styles.factureTitle} style={{ color: '#ff3333' }}>
                                {data.numeroFacture}
                            </span>
                        </div>
                        <div className={styles.fadyDate}>
                            {company.address.split(',')[0] || 'Labé'}, le {data.dateFacture}
                        </div>
                    </div>

                    {/* Client Info */}
                    <div className={styles.clientBox}>
                        <span className={styles.clientLabel}>Nom et Adresse du Client :</span>
                        <span className={styles.clientValue}>
                            {data.client.nom} {data.client.adresse ? `- ${data.client.adresse}` : ''}
                        </span>
                    </div>

                    {/* Table */}
                    <table className={styles.fadyTable}>
                        <thead>
                            <tr>
                                <th style={{ width: '5%' }}>Nº</th>
                                <th style={{ width: '8%' }}>Qté</th>
                                {showDelivered && <th style={{ width: '8%' }}>Livré</th>}
                                <th>Désignation</th>
                                <th style={{ width: '20%' }}>P. Unitaire</th>
                                <th style={{ width: '20%' }}>Montant GNF</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.articles.map((article, index) => {
                                const adjustedPrice = calculateAdjustedPrice(article.price, data.selectedCompany.markupPercentage || 0);
                                const adjustedTotal = adjustedPrice * article.quantity;
                                return (
                                    <tr key={index}>
                                        <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{index + 1}</td>
                                        <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{article.quantity}</td>
                                        {showDelivered && <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{article.delivered ? '✓' : '—'}</td>}
                                        <td>{article.designation}</td>
                                        <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                                            {adjustedPrice.toLocaleString('fr-FR')}
                                        </td>
                                        <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                                            {adjustedTotal.toLocaleString('fr-FR')}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>

                    {/* Total Box */}
                    <div className={styles.totalRow}>
                        <div className={styles.totalLabelBox}>TOTAL</div>
                        <div className={styles.totalValueBox}>
                            {totalAmount.toLocaleString('fr-FR')}
                        </div>
                    </div>

                    {/* Arrêté text */}
                    <div className={styles.arreteText}>
                        Arrêtée la présente facture à la somme de : {amountInWords.toUpperCase()} GNF
                    </div>

                    {/* NB Text */}
                    <div className={styles.nbText}>
                        NB : Toutes marchandises achetées et livrées ne seront échangées ni retournées
                    </div>

                    <footer className={styles.footer}>
                        <div className={styles.piedPage}>
                            <div className={styles.signature}>
                                <div style={{ marginBottom: '0.5rem' }}>SIGNATURE GÉRANT</div>
                                {company.sealImage && (
                                    <img src={company.sealImage} alt="Cachet" style={{ maxWidth: '120px', maxHeight: '80px', objectFit: 'contain' }} />
                                )}
                            </div>
                            <div className={styles.signature}>SIGNATURE CLIENT</div>
                        </div>
                    </footer>
                </>
            ) : (
                // --- ANCIEN DESIGN (STANDARD) ---
                <>
                    <div className={styles.middle}>
                        <section className={styles.entreprise}>
                            {isClassic ? (
                                <h2 className={styles.companyName}>{company.displayName}</h2>
                            ) : (
                                <h4 className={styles.companyNameSimple}>{company.displayName}</h4>
                            )}
                            <p>{company.businessType}</p>
                            <p>{company.address}</p>
                            {company.nif && <p>NIF:{company.nif}</p>}
                            {company.registrationNumbers && <p>{company.registrationNumbers}</p>}
                            <p>{company.phone}</p>
                            {company.email && <p>{company.email}</p>}
                        </section>

                        <section className={styles.client}>
                            <div className={styles.dates}>
                                <p>Date : {data.dateFacture}</p>
                                <h4>Facture N° {data.numeroFacture}</h4>
                            </div>
                            <p>Nom et Adresse du client:</p>
                            <h4>{data.client.nom}</h4>
                            <p>{data.client.adresse}</p>
                        </section>
                    </div>

                    <section className={styles.details}>
                        <p>Facture Proforma</p>
                    </section>

                    <table className={styles.table}>
                        <thead>
                            <tr className={styles.tableHead}>
                                <th>Nº</th>
                                {showDelivered && <th>Livré</th>}
                                <th>Désignation</th>
                                <th>Quantite</th>
                                <th>Unité</th>
                                <th>Prix Unitaire</th>
                                <th>Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.articles.map((article, index) => {
                                const adjustedPrice = calculateAdjustedPrice(article.price, data.selectedCompany.markupPercentage || 0);
                                const adjustedTotal = adjustedPrice * article.quantity;
                                return (
                                    <tr key={index}>
                                        <td>{index + 1}</td>
                                        {showDelivered && <td style={{ textAlign: 'center' }}>{article.delivered ? '✓' : '—'}</td>}
                                        <td>{article.designation}</td>
                                        <td>{article.quantity}</td>
                                        <td>{article.unit || '—'}</td>
                                        <td>{adjustedPrice.toLocaleString()}GNF</td>
                                        <td>{adjustedTotal.toLocaleString()}GNF</td>
                                    </tr>
                                )
                            })}
                            <tr>
                                <td colSpan={showDelivered ? 6 : 5}><strong>Total:</strong></td>
                                <td><strong>{totalAmount.toLocaleString()} GNF</strong></td>
                            </tr>
                            {data.amountPaid !== undefined && data.amountPaid > 0 && (
                                <>
                                    <tr>
                                        <td colSpan={showDelivered ? 6 : 5}><strong>Payé:</strong></td>
                                        <td><strong>{data.amountPaid.toLocaleString()} GNF</strong></td>
                                    </tr>
                                    <tr>
                                        <td colSpan={showDelivered ? 6 : 5}><strong>Reste à payer:</strong></td>
                                        <td><strong>{Math.max(0, totalAmount - data.amountPaid).toLocaleString()} GNF</strong></td>
                                    </tr>
                                </>
                            )}
                        </tbody>
                    </table>

                    <div className={styles.arrete}>
                        <p>
                            Arrêté la présente facture à la somme de :{' '}
                            <strong>{amountInWords} GNF</strong>
                        </p>
                    </div>

                    <footer className={styles.footer}>
                        <div className={styles.piedPage}>
                            <div className={styles.gauche}>
                                <div style={{ marginBottom: '1rem' }}>Le Directeur Général</div>
                                {company.sealImage && (
                                    <img src={company.sealImage} alt="Cachet" style={{ maxWidth: '150px', maxHeight: '100px', objectFit: 'contain' }} />
                                )}
                            </div>
                            <div className={styles.droite}>Le client</div>
                        </div>
                    </footer>
                </>
            )}
        </div>
    );
}

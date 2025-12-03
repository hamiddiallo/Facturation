import { InvoiceData } from '@/lib/types';
import { numberToWords } from '@/lib/numberToWords';
import { calculateAdjustedPrice } from '@/lib/priceCalculations';
import styles from './FactureProforma.module.css';

interface FactureProformaProps {
    data: InvoiceData;
}

export default function FactureProforma({ data }: FactureProformaProps) {
    const company = data.selectedCompany;
    const isThiernodjo = company.id === 'thiernodjo';

    return (
        <div className={styles.invoice}>
            {/* Title at top for THIERNODJO */}
            {isThiernodjo && (
                <div className={styles.titleSection}>
                    <h1 className={styles.invoiceTitle}>Facture Proforma</h1>
                    <hr className={styles.titleLine} />
                </div>
            )}

            <div className={styles.middle}>
                <section className={styles.entreprise}>
                    {company.hasStyledLogo ? (
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
                    {!isThiernodjo && (
                        <div className={styles.dates}>
                            <p>Date : {data.dateFacture}</p>
                            <h4>Facture N° {data.numeroFacture}</h4>

                        </div>
                    )}
                    <p>Nom et Adresse du client:</p>
                    <h4>{data.client.nom}</h4>
                    <p>{data.client.adresse}</p>
                    {isThiernodjo && (
                        <div className={styles.thiernodjoDate}>
                            <p>Date: {data.dateFacture}</p>
                        </div>
                    )}
                </section>
            </div>

            {/* Details section only for non-THIERNODJO */}
            {!isThiernodjo && (
                <section className={styles.details}>
                    <p>Facture Proforma</p>
                </section>
            )}

            <table className={styles.table}>
                <thead>
                    <tr className={styles.tableHead}>
                        <th>Nº</th>
                        <th>Désignation</th>
                        <th>Quantite</th>
                        {!isThiernodjo && <th>Unité</th>}
                        <th>Prix Unitaire</th>
                        <th>Total</th>
                    </tr>
                </thead>
                <tbody>
                    {data.articles.map((article, index) => {
                        const adjustedPrice = calculateAdjustedPrice(article.price, data.selectedCompany.id);
                        const adjustedTotal = adjustedPrice * article.quantity;
                        return (
                            <tr key={index}>
                                <td>{index + 1}</td>
                                <td>{article.designation}</td>
                                <td>{article.quantity}</td>
                                {!isThiernodjo && <td>{article.unit || '—'}</td>}
                                <td>{adjustedPrice.toLocaleString()}GNF</td>
                                <td>{adjustedTotal.toLocaleString()}GNF</td>
                            </tr>
                        )
                    })}
                    <tr>
                        <td colSpan={isThiernodjo ? 4 : 5}><strong>Total:</strong></td>
                        <td><strong>{data.articles.reduce((sum, article) => {
                            const adjustedPrice = calculateAdjustedPrice(article.price, data.selectedCompany.id);
                            return sum + (adjustedPrice * article.quantity);
                        }, 0).toLocaleString()} GNF</strong></td>
                    </tr>
                </tbody>
            </table>

            <div className={styles.arrete}>
                <p>
                    Arrêté la présente facture à la somme de :{' '}
                    <strong>{numberToWords(data.articles.reduce((sum, article) => {
                        const adjustedPrice = calculateAdjustedPrice(article.price, data.selectedCompany.id);
                        return sum + (adjustedPrice * article.quantity);
                    }, 0))} GNF</strong>
                </p>
            </div>

            <footer className={styles.footer}>
                <div className={styles.piedPage}>
                    <div className={styles.gauche}>Le Directeur Général</div>
                    <div className={styles.droite}>Le client</div>
                </div>
            </footer>
        </div>
    );
}

import { InvoiceData } from '@/lib/types';
import { calculateAdjustedPrice } from '@/lib/priceCalculations';
import styles from './BonLivraison.module.css';

interface BonLivraisonProps {
    data: InvoiceData;
}

export default function BonLivraison({ data }: BonLivraisonProps) {
    const company = data.selectedCompany;
    const isThiernodjo = company.id === 'thiernodjo';

    return (
        <div className={styles.invoice}>
            {/* Title at top for THIERNODJO */}
            {isThiernodjo && (
                <div className={styles.titleSection}>
                    <h1 className={styles.invoiceTitle}>Bon de Livraison</h1>
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
                            <h4>Bon de Livraison Numéro {data.numeroFacture}</h4>
                        </div>
                    )}
                    <p>Client:</p>
                    <h4>{data.client.nom}</h4>
                    <p>Adresse: {data.client.adresse}</p>
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
                    <p>Bon de Livraison</p>
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
                        <th>Prix Total</th>
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
                </tbody>
            </table>

            <table className={styles.footPage}>
                <tbody>
                    <tr>
                        <td><span className={styles.span}>Signature du Gérant</span></td>
                        <td>Fait à Labé le : {data.dateFacture}</td>
                        <td><span className={styles.span}>Signature du client</span></td>
                    </tr>
                </tbody>
            </table>
        </div>
    );
}

'use client';

import { Company } from '@/lib/types';
import styles from './CompanySelector.module.css';

interface CompanySelectorProps {
    companies: Company[];
    selectedCompany: Company | null;
    onSelect: (company: Company) => void;
}

export default function CompanySelector({ companies, selectedCompany, onSelect }: CompanySelectorProps) {
    return (
        <div className={styles.container}>
            <h2 className={styles.title}>Sélectionnez votre entreprise</h2>
            <div className={styles.grid}>
                {companies.map((company) => (
                    <div
                        key={company.id}
                        className={`${styles.card} ${selectedCompany?.id === company.id ? styles.selected : ''}`}
                        onClick={() => onSelect(company)}
                    >
                        <div className={styles.radio}>
                            <input
                                type="radio"
                                name="company"
                                checked={selectedCompany?.id === company.id}
                                onChange={() => onSelect(company)}
                                className={styles.radioInput}
                            />
                        </div>
                        <h3 className={styles.companyName}>{company.displayName}</h3>
                        <p className={styles.businessType}>{company.businessType}</p>
                        <p className={styles.address}>{company.address}</p>
                        <p className={styles.contact}>{company.phone}</p>
                        {company.email && <p className={styles.email}>{company.email}</p>}
                    </div>
                ))}
            </div>
        </div>
    );
}

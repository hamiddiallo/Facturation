'use client';

import { companies } from '@/lib/companies';
import { Company } from '@/lib/types';
import styles from './CompanySelector.module.css';

interface CompanySelectorProps {
    selectedCompany: Company | null;
    onSelectCompany: (company: Company) => void;
}

export default function CompanySelector({ selectedCompany, onSelectCompany }: CompanySelectorProps) {
    return (
        <div className={styles.container}>
            <h2 className={styles.title}>Sélectionnez votre entreprise</h2>
            <div className={styles.grid}>
                {companies.map((company) => (
                    <div
                        key={company.id}
                        className={`${styles.card} ${selectedCompany?.id === company.id ? styles.selected : ''}`}
                        onClick={() => onSelectCompany(company)}
                    >
                        <div className={styles.radio}>
                            <input
                                type="radio"
                                name="company"
                                checked={selectedCompany?.id === company.id}
                                onChange={() => onSelectCompany(company)}
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

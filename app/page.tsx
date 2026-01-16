'use client';

import InvoiceForm from '@/components/InvoiceForm';
import styles from './page.module.css';
import { useAuth } from '@/components/AuthProvider';

export default function Home() {
  const { profile } = useAuth();

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Générateur de Factures</h1>
        <p className={styles.greeting}>
          Bonjour Mr {profile?.full_name?.split(' ')[0] || 'Mouctar'} ! Prêt à facturer ?
        </p>
        <p className={styles.subtitle}>
          Créez vos factures professionnelles en quelques clics
        </p>
      </header>
      <main className={styles.main}>
        <InvoiceForm />
      </main>
    </div>
  );
}

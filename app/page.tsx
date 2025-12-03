import InvoiceForm from '@/components/InvoiceForm';
import styles from './page.module.css';

export default function Home() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Générateur de Factures</h1>
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

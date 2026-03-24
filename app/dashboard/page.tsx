'use client';

import React, { useCallback, useEffect, useState } from 'react';
import useSWR from 'swr';
import { useRouter } from 'next/navigation';
import { getDashboardStats } from '@/lib/supabaseServices';
import { useAuth } from '@/components/AuthProvider';
import Modal from '@/components/Modal';
import styles from './page.module.css';
import { Eye, EyeOff } from 'lucide-react';
import type { DashboardStats } from '@/app/actions/invoiceActions';

type StatCardProps = {
    label: string;
    value: React.ReactNode;
    icon: string;
    extraClass?: string;
    onAction?: () => void;
    isLoading?: boolean;
};

type WeeklyTrendChartProps = {
    stats: DashboardStats | null | undefined;
    formatCurrency: (amount: number) => string;
    showAmounts: boolean;
};

type TopClientsListProps = {
    stats: DashboardStats | null | undefined;
    formatCurrency: (amount: number) => string;
    showAmounts: boolean;
};

type MaskedAmountProps = {
    amount: string;
    withToggle?: boolean;
    showAmounts: boolean;
    onToggle: (e: React.MouseEvent<HTMLButtonElement>) => void;
};

const StatCard = React.memo(function StatCard({
    label,
    value,
    icon,
    extraClass,
    onAction,
    isLoading
}: StatCardProps) {
    return (
        <div
            className={`${styles.card} ${extraClass ? styles[extraClass] : ''}`}
            onClick={onAction}
        >
            <div className={styles.cardHeader}>
                <span className={styles.cardLabel}>{label}</span>
                <div className={styles.iconWrapper}>{icon}</div>
            </div>
            <div className={styles.cardValue}>{isLoading ? '...' : value}</div>
            {onAction && (
                <div className={styles.footerActions}>
                    <span className={styles.arrowIcon}>→</span>
                </div>
            )}
        </div>
    );
});

const WeeklyTrendChart = React.memo(function WeeklyTrendChart({
    stats,
    formatCurrency,
    showAmounts
}: WeeklyTrendChartProps) {
    const monthlyStats = stats?.monthlyStats || [];
    if (monthlyStats.length === 0) {
        return <div style={{ margin: 'auto', color: 'var(--text-secondary)' }}>Données insuffisantes</div>;
    }

    const maxCA = Math.max(...monthlyStats.map((ms) => Number(ms.ca) || 0), 1);
    const chartData = monthlyStats.map((m) => ({
        label: m.label,
        ca: Number(m.ca) || 0,
        height: Number(m.ca) > 0 ? Math.max((Number(m.ca) / maxCA) * 100, 4) : 0
    }));

    return (
        <div className={styles.chartContainer} style={{ flexWrap: 'nowrap' }}>
            {chartData.map((m) => (
                <div key={m.label} className={styles.barWrapper}>
                    <span className={styles.barValue}>{showAmounts ? formatCurrency(m.ca) : '••••'}</span>
                    <div className={styles.barArea}>
                        <div
                            className={styles.bar}
                            style={{ height: `${m.height}%` }}
                            title={showAmounts ? `${m.label}: ${formatCurrency(m.ca)}` : m.label}
                        />
                    </div>
                    <span className={styles.barLabel}>{m.label}</span>
                </div>
            ))}
        </div>
    );
});

const TopClientsList = React.memo(function TopClientsList({
    stats,
    formatCurrency,
    showAmounts
}: TopClientsListProps) {
    return (
        <div className={styles.clientList}>
            {stats?.topClients?.map((client) => (
                <div key={client.name} className={styles.clientItem}>
                    <span className={styles.clientName}>{client.name}</span>
                    <span className={styles.clientCA}>{showAmounts ? formatCurrency(client.ca) : '••••••••'}</span>
                </div>
            ))}
            {(!stats?.topClients || stats.topClients.length === 0) && (
                <div style={{ color: 'var(--text-secondary)', textAlign: 'center' }}>Aucun client répertorié</div>
            )}
        </div>
    );
});

const MaskedAmount = React.memo(function MaskedAmount({
    amount,
    withToggle = false,
    showAmounts,
    onToggle
}: MaskedAmountProps) {
    return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.75rem' }}>
            {showAmounts ? amount : '••••••••'}
            {withToggle && (
                <button
                    onClick={onToggle}
                    style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        padding: 0,
                        color: 'inherit',
                        opacity: 0.7
                    }}
                    title={showAmounts ? 'Masquer les montants' : 'Afficher les montants'}
                >
                    {showAmounts ? <EyeOff size={24} /> : <Eye size={24} />}
                </button>
            )}
        </span>
    );
});

export default function DashboardPage() {
    const router = useRouter();
    const { profile, loading: authLoading } = useAuth();
    const [isArticlesModalOpen, setIsArticlesModalOpen] = useState(false);
    const [showAmounts, setShowAmounts] = useState(false);

    useEffect(() => {
        if (!authLoading && profile && profile.role !== 'admin') {
            router.push('/');
        }
    }, [profile, authLoading, router]);

    const { data: stats, isLoading, error } = useSWR<DashboardStats | null>(
        profile?.role === 'admin' ? 'dashboard_stats' : null,
        getDashboardStats,
        {
            refreshInterval: 60000,
            revalidateOnFocus: false
        }
    );

    const formatCurrency = useCallback((amount: number) => {
        return new Intl.NumberFormat('fr-FR', {
            style: 'currency',
            currency: 'GNF',
            maximumFractionDigits: 0
        }).format(amount);
    }, []);

    const toggleAmounts = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
        e.stopPropagation();
        e.preventDefault();
        setShowAmounts((prev) => !prev);
    }, []);

    if (authLoading || (profile && profile.role !== 'admin')) {
        return (
            <div className={styles.container} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                Chargement...
            </div>
        );
    }

    if (error) {
        return (
            <div className={styles.container}>
                <div className={styles.header}>
                    <h1 className={styles.title}>Erreur</h1>
                    <p className={styles.subtitle}>Échec du chargement des statistiques. Veuillez vérifier votre connexion.</p>
                </div>
            </div>
        );
    }

    const isAdmin = profile?.role === 'admin';

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h1 className={styles.title}>Dashboard</h1>
                <p className={styles.subtitle}>Bienvenue, {profile?.full_name}. Voici l&apos;état de votre activité.</p>
            </div>

            <div className={styles.statsGrid}>
                <StatCard
                    label="Chiffre d&apos;Affaires"
                    value={
                        <MaskedAmount
                            amount={formatCurrency(stats?.totalCA || 0)}
                            withToggle
                            showAmounts={showAmounts}
                            onToggle={toggleAmounts}
                        />
                    }
                    icon="💰"
                    onAction={() => router.push('/history')}
                    extraClass="caCard"
                    isLoading={isLoading}
                />

                <StatCard
                    label="Panier Moyen"
                    value={
                        <MaskedAmount
                            amount={formatCurrency(stats?.averageBasket || 0)}
                            showAmounts={showAmounts}
                            onToggle={toggleAmounts}
                        />
                    }
                    icon="🛒"
                    isLoading={isLoading}
                />

                <StatCard
                    label="Total Factures"
                    value={stats?.totalInvoices || 0}
                    icon="📄"
                    onAction={() => router.push('/history')}
                    isLoading={isLoading}
                />
                <StatCard
                    label="Articles Uniques"
                    value={stats?.uniqueArticles || 0}
                    icon="📦"
                    onAction={() => setIsArticlesModalOpen(true)}
                    isLoading={isLoading}
                />

                <StatCard
                    label="Entreprises"
                    value={stats?.companiesCount || 0}
                    icon="🏢"
                    onAction={() => router.push('/settings')}
                    isLoading={isLoading}
                />
                {isAdmin && (
                    <StatCard
                        label="Utilisateurs"
                        value={stats?.usersCount || 0}
                        icon="👥"
                        onAction={() => router.push('/settings?tab=users')}
                        isLoading={isLoading}
                    />
                )}
            </div>

            <div className={styles.mainView}>
                <div className={styles.trendSection}>
                    <div className={styles.sectionTitle}>📈 Évolution Hebdomadaire (CA)</div>
                    <WeeklyTrendChart stats={stats} formatCurrency={formatCurrency} showAmounts={showAmounts} />
                </div>

                <div className={styles.topClientsSection}>
                    <div className={styles.sectionTitle}>🏆 Top 5 Clients</div>
                    <TopClientsList stats={stats} formatCurrency={formatCurrency} showAmounts={showAmounts} />
                </div>
            </div>

            <div className={styles.card} style={{ marginBottom: '2rem' }}>
                <span className={styles.cardLabel}>Précision des données</span>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.5rem' }}>
                    Les montants affichés correspondent au Chiffre d&apos;Affaires total généré.
                    Les tendances sont calculées sur une base hebdomadaire glissante sur les 5 dernières semaines.
                </p>
            </div>

            <Modal
                isOpen={isArticlesModalOpen}
                onClose={() => setIsArticlesModalOpen(false)}
                title="Liste des Articles"
                maxWidth="600px"
            >
                <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: 'var(--bg-body)', borderBottom: '2px solid var(--border-color)' }}>
                                <th style={{ textAlign: 'left', padding: '1rem', color: 'var(--text-secondary)' }}>Désignation</th>
                                <th style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-secondary)' }}>Unité</th>
                                <th style={{ textAlign: 'right', padding: '1rem', color: 'var(--text-secondary)' }}>Quantité Totale</th>
                            </tr>
                        </thead>
                        <tbody>
                            {stats?.uniqueArticlesList?.map((article) => (
                                <tr key={`${article.designation}-${article.unit}`} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                    <td style={{ padding: '1rem', fontWeight: 600 }}>{article.designation}</td>
                                    <td style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{article.unit}</td>
                                    <td style={{ padding: '1rem', textAlign: 'right', fontFamily: 'monospace', fontWeight: 'bold' }}>{article.quantity}</td>
                                </tr>
                            ))}
                            {(!stats?.uniqueArticlesList || stats.uniqueArticlesList.length === 0) && (
                                <tr>
                                    <td colSpan={3} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                                        Aucun article trouvé.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Modal>
        </div>
    );
}

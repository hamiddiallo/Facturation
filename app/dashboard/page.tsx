'use client';

import React, { useState, useEffect } from 'react';
import useSWR from 'swr';
import { useRouter } from 'next/navigation';
import { getDashboardStats } from '@/lib/supabaseServices';
import { useAuth } from '@/components/AuthProvider';
import Modal from '@/components/Modal';
import styles from './page.module.css';
import { Eye, EyeOff } from 'lucide-react';

// Composants Mémoïsés pour la performance
const StatCard = React.memo(({ label, value, icon, target, extraClass, onClick, isLoading, router }: any) => (
    <div
        className={`${styles.card} ${extraClass ? styles[extraClass] : ''}`}
        onClick={() => {
            if (onClick) onClick();
            else if (target) router.push(target);
        }}
    >
        <div className={styles.cardHeader}>
            <span className={styles.cardLabel}>{label}</span>
            <div className={styles.iconWrapper}>{icon}</div>
        </div>
        <div className={styles.cardValue}>{isLoading ? '...' : value}</div>
        {(target || onClick) && (
            <div className={styles.footerActions}>
                <span className={styles.arrowIcon}>→</span>
            </div>
        )}
    </div>
));
StatCard.displayName = 'StatCard';

const WeeklyTrendChart = React.memo(({ stats, formatCurrency, showAmounts }: any) => {
    const chartData = React.useMemo(() => {
        if (!stats?.monthlyStats) return [];
        const maxCA = Math.max(...(stats.monthlyStats.map((ms: any) => Number(ms.ca)) || [0]), 1);
        return stats.monthlyStats.map((m: any) => ({
            ...m,
            height: Number(m.ca) > 0 ? Math.max((Number(m.ca) / maxCA) * 100, 4) : 0
        }));
    }, [stats?.monthlyStats]);

    if (!stats?.monthlyStats || stats.monthlyStats.length === 0) {
        return <div style={{ margin: 'auto', color: 'var(--text-secondary)' }}>Données insuffisantes</div>;
    }

    return (
        <div className={styles.chartContainer} style={{ flexWrap: 'nowrap' }}>
            {chartData.map((m: any, i: number) => (
                <div key={i} className={styles.barWrapper}>
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
WeeklyTrendChart.displayName = 'WeeklyTrendChart';

const TopClientsList = React.memo(({ stats, formatCurrency, showAmounts }: any) => (
    <div className={styles.clientList}>
        {stats?.topClients?.map((c: any, i: number) => (
            <div key={i} className={styles.clientItem}>
                <span className={styles.clientName}>{c.name}</span>
                <span className={styles.clientCA}>{showAmounts ? formatCurrency(c.ca) : '••••••••'}</span>
            </div>
        ))}
        {(!stats?.topClients || stats.topClients.length === 0) && (
            <div style={{ color: 'var(--text-secondary)', textAlign: 'center' }}>Aucun client répertorié</div>
        )}
    </div>
));
TopClientsList.displayName = 'TopClientsList';

export default function DashboardPage() {
    const router = useRouter();
    const { profile, loading: authLoading } = useAuth();
    const [isArticlesModalOpen, setIsArticlesModalOpen] = useState(false);

    useEffect(() => {
        if (!authLoading && profile && profile.role !== 'admin') {
            router.push('/');
        }
    }, [profile, authLoading, router]);

    const { data: stats, isLoading, error } = useSWR(
        profile?.role === 'admin' ? 'dashboard_stats' : null,
        getDashboardStats,
        {
            refreshInterval: 60000, // Augmenté à 1 minute pour réduire la charge
            revalidateOnFocus: false, // Éviter les re-validations inutiles
        }
    );

    const formatCurrency = React.useCallback((amount: number) => {
        return new Intl.NumberFormat('fr-FR', {
            style: 'currency',
            currency: 'GNF',
            maximumFractionDigits: 0,
        }).format(amount);
    }, []);

    const [showAmounts, setShowAmounts] = useState(false);

    const toggleAmounts = (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        setShowAmounts(prev => !prev);
    };

    const MaskedAmount = ({ amount, withToggle = false }: { amount: string, withToggle?: boolean }) => (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.75rem' }}>
            {showAmounts ? amount : '••••••••'}
            {withToggle && (
                <button
                    onClick={toggleAmounts}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 0, color: 'inherit', opacity: 0.7 }}
                    title={showAmounts ? "Masquer les montants" : "Afficher les montants"}
                >
                    {showAmounts ? <EyeOff size={24} /> : <Eye size={24} />}
                </button>
            )}
        </span>
    );

    if (authLoading || (profile && profile.role !== 'admin')) {
        return <div className={styles.container} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Chargement...</div>;
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
                <p className={styles.subtitle}>Bienvenue, {profile?.full_name}. Voici l'état de votre activité.</p>
            </div>

            <div className={styles.statsGrid}>
                {/* Financier Principal */}
                <StatCard
                    label="Chiffre d'Affaires"
                    value={<MaskedAmount amount={formatCurrency(stats?.totalCA || 0)} withToggle />}
                    icon="💰"
                    target="/history"
                    extraClass="caCard"
                    router={router}
                    isLoading={isLoading}
                />

                {/* Métriques de Performance */}
                <StatCard
                    label="Panier Moyen"
                    value={<MaskedAmount amount={formatCurrency(stats?.averageBasket || 0)} />}
                    icon="🛒"
                    isLoading={isLoading}
                />

                {/* Documents & Activité */}
                <StatCard
                    label="Total Factures"
                    value={stats?.totalInvoices || 0}
                    icon="📄"
                    target="/history"
                    router={router}
                    isLoading={isLoading}
                />
                <StatCard
                    label="Articles Uniques"
                    value={stats?.uniqueArticles || 0}
                    icon="📦"
                    onClick={() => setIsArticlesModalOpen(true)}
                    isLoading={isLoading}
                />

                {/* Administration */}
                <StatCard
                    label="Entreprises"
                    value={stats?.companiesCount || 0}
                    icon="🏢"
                    target="/settings"
                    router={router}
                    isLoading={isLoading}
                />
                {isAdmin && (
                    <StatCard
                        label="Utilisateurs"
                        value={stats?.usersCount || 0}
                        icon="👥"
                        target="/settings?tab=users"
                        router={router}
                        isLoading={isLoading}
                    />
                )}
            </div>

            <div className={styles.mainView}>
                {/* Évolution Hebdomadaire */}
                <div className={styles.trendSection}>
                    <div className={styles.sectionTitle}>📈 Évolution Hebdomadaire (CA)</div>
                    <WeeklyTrendChart stats={stats} formatCurrency={formatCurrency} showAmounts={showAmounts} />
                </div>

                {/* Top Clients */}
                <div className={styles.topClientsSection}>
                    <div className={styles.sectionTitle}>🏆 Top 5 Clients</div>
                    <TopClientsList stats={stats} formatCurrency={formatCurrency} showAmounts={showAmounts} />
                </div>
            </div>

            <div className={styles.card} style={{ marginBottom: '2rem' }}>
                <span className={styles.cardLabel}>Précision des données</span>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.5rem' }}>
                    Les montants affichés correspondent au Chiffre d'Affaires total généré. Les tendances sont calculées sur une base hebdomadaire glissante sur les 5 dernières semaines.
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
                            {stats?.uniqueArticlesList?.map((art: any, i: number) => (
                                <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                    <td style={{ padding: '1rem', fontWeight: 600 }}>{art.designation}</td>
                                    <td style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{art.unit}</td>
                                    <td style={{ padding: '1rem', textAlign: 'right', fontFamily: 'monospace', fontWeight: 'bold' }}>{art.quantity}</td>
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

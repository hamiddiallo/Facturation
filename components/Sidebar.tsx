'use client';

import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from './AuthProvider';
import styles from './Sidebar.module.css';

export default function Sidebar() {
    const pathname = usePathname();
    const router = useRouter();
    const { profile, signOut } = useAuth();
    const [isOpen, setIsOpen] = useState(false);

    const toggleSidebar = () => setIsOpen(!isOpen);
    const closeSidebar = () => setIsOpen(false);

    const navItems = [
        { label: 'Facturer', path: '/', icon: '📝' },
        { label: 'Historique', path: '/history', icon: '📜' },
        { label: 'Profil', path: '/profile', icon: '👤' },
        { label: 'Paramètres', path: '/settings', icon: '⚙️', adminOnly: true },
    ];

    // Filtrer les éléments de navigation selon le rôle
    const filteredNavItems = navItems.filter(item =>
        !item.adminOnly || profile?.role === 'admin'
    );

    if (pathname === '/login' || pathname === '/preview') return null;

    return (
        <>
            {/* Mobile Header */}
            <header className={styles.mobileHeader}>
                <button className={styles.burgerBtn} onClick={toggleSidebar}>
                    {isOpen ? '✕' : '☰'}
                </button>
                <div className={styles.mobileLogo}>Générateur Master</div>
                <button onClick={() => signOut()} className={styles.mobileLogoutBtn} title="Déconnexion">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                        <polyline points="16 17 21 12 16 7"></polyline>
                        <line x1="21" y1="12" x2="9" y2="12"></line>
                    </svg>
                </button>
            </header>

            {/* Overlay */}
            <div
                className={`${styles.overlay} ${isOpen ? styles.overlayOpen : ''}`}
                onClick={closeSidebar}
            />

            {/* Sidebar */}
            <aside className={`${styles.sidebar} ${isOpen ? styles.sidebarOpen : ''}`}>
                <div className={styles.logoSection}>
                    <span className={styles.logoIcon}>💎</span>
                    <h1 className={styles.logoTitle}>MASTER</h1>
                </div>

                <nav className={styles.navSection}>
                    {filteredNavItems.map((item) => (
                        <Link
                            key={item.path}
                            href={item.path}
                            className={`${styles.navLink} ${pathname === item.path ? styles.activeLink : ''}`}
                            onClick={closeSidebar}
                        >
                            <span>{item.icon}</span>
                            <span>{item.label}</span>
                        </Link>
                    ))}
                </nav>

                <div className={styles.userSection}>
                    <div className={styles.userAvatar}>
                        {profile?.avatar_url ? (
                            <img src={profile.avatar_url} alt="Profile" className={styles.avatarImg} />
                        ) : (
                            <div className={styles.avatarInitial}>
                                {profile?.full_name?.[0]?.toUpperCase() || 'U'}
                            </div>
                        )}
                    </div>
                    <div className={styles.userInfo}>
                        <span className={styles.userName}>{profile?.full_name || 'Utilisateur'}</span>
                        <span className={styles.userRole}>{profile?.role || 'Membre'}</span>
                    </div>
                    <button className={styles.logoutBtn} onClick={() => signOut()}>
                        🚪 Quitter
                    </button>
                </div>
            </aside>
        </>
    );
}

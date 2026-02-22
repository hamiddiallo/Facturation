'use client';

import React from 'react';

interface ErrorBoundaryState {
    hasError: boolean;
    errorMessage: string;
}

export default class ErrorBoundary extends React.Component<
    { children: React.ReactNode },
    ErrorBoundaryState
> {
    constructor(props: { children: React.ReactNode }) {
        super(props);
        this.state = { hasError: false, errorMessage: '' };
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { hasError: true, errorMessage: error?.message || 'Erreur inconnue' };
    }

    componentDidCatch(error: Error, info: React.ErrorInfo) {
        console.error('🚨 ErrorBoundary caught:', error, info.componentStack);
    }

    handleReload = () => {
        // Full hard reload — safe in standalone mode and restores all JS state
        if (typeof window !== 'undefined') {
            window.location.reload();
        }
    };

    render() {
        if (this.state.hasError) {
            return (
                <div style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    justifyContent: 'center', height: '100vh', background: '#f7fafc',
                    padding: '2rem', textAlign: 'center', gap: '1.5rem'
                }}>
                    <div style={{ fontSize: '3rem' }}>⚠️</div>
                    <div>
                        <h2 style={{ margin: 0, color: '#1e293b', fontWeight: 800 }}>
                            Une erreur s&apos;est produite
                        </h2>
                        <p style={{ color: '#64748b', marginTop: '0.5rem', fontSize: '0.9rem' }}>
                            L&apos;application a rencontré un problème inattendu.
                        </p>
                    </div>
                    <button
                        onClick={this.handleReload}
                        style={{
                            background: '#3b82f6', color: '#fff', border: 'none',
                            borderRadius: '0.75rem', padding: '0.85rem 2rem',
                            fontSize: '1rem', fontWeight: 700, cursor: 'pointer',
                            boxShadow: '0 4px 12px rgba(59,130,246,0.35)'
                        }}
                    >
                        🔄 Recharger l&apos;application
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}

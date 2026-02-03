'use client';

import { useState } from 'react';
import { createBackup, restoreBackup } from '@/lib/backupActions';
import { toast } from 'sonner';

export default function BackupManager() {
    const [loading, setLoading] = useState(false);

    const handleBackup = async () => {
        setLoading(true);
        try {
            const result = await createBackup();

            if (result.success) {
                toast.success(`Backup créé avec succès !`, {
                    description: `${result.stats?.profiles_count} profils, ${result.stats?.companies_count} entreprises, ${result.stats?.invoices_count} factures`
                });
            } else {
                toast.error('Erreur lors du backup', {
                    description: result.error
                });
            }
        } catch (error: any) {
            toast.error('Erreur', { description: error.message });
        } finally {
            setLoading(false);
        }
    };

    const handleRestore = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setLoading(true);
        try {
            const content = await file.text();
            const result = await restoreBackup(content);

            if (result.success) {
                toast.success('Données restaurées avec succès !', {
                    description: `${result.restored?.profiles_count} profils, ${result.restored?.companies_count} entreprises`
                });
            } else {
                toast.error('Erreur lors de la restauration', {
                    description: result.error
                });
            }
        } catch (error: any) {
            toast.error('Erreur', { description: error.message });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ padding: '20px', background: '#f7fafc', borderRadius: '8px' }}>
            <h3 style={{ marginBottom: '16px', fontSize: '18px', fontWeight: 'bold' }}>
                💾 Gestion des Backups
            </h3>

            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <button
                    onClick={handleBackup}
                    disabled={loading}
                    style={{
                        padding: '10px 20px',
                        background: '#3b82f6',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: loading ? 'not-allowed' : 'pointer',
                        opacity: loading ? 0.6 : 1
                    }}
                >
                    {loading ? 'En cours...' : '📥 Créer un Backup'}
                </button>

                <label
                    style={{
                        padding: '10px 20px',
                        background: '#10b981',
                        color: 'white',
                        borderRadius: '6px',
                        cursor: loading ? 'not-allowed' : 'pointer',
                        opacity: loading ? 0.6 : 1,
                        display: 'inline-block'
                    }}
                >
                    📤 Restaurer un Backup
                    <input
                        type="file"
                        accept=".json"
                        onChange={handleRestore}
                        disabled={loading}
                        style={{ display: 'none' }}
                    />
                </label>
            </div>

            <p style={{ marginTop: '12px', fontSize: '14px', color: '#6b7280' }}>
                💡 Les backups sont sauvegardés dans le dossier <code>/backups</code>
            </p>
        </div>
    );
}

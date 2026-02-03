'use server';

import { createClient } from '@supabase/supabase-js';
import { writeFile } from 'fs/promises';
import { join } from 'path';

const getSupabaseAdmin = () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    return createClient(url, serviceRole);
};

export async function createBackup() {
    const supabase = getSupabaseAdmin();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    try {
        // Récupérer toutes les données
        const [profiles, companies, invoices, sequences] = await Promise.all([
            supabase.from('profiles').select('*'),
            supabase.from('companies').select('*'),
            supabase.from('invoices').select('*'),
            supabase.from('invoice_sequences').select('*')
        ]);

        const backup = {
            timestamp,
            version: '1.0',
            data: {
                profiles: profiles.data || [],
                companies: companies.data || [],
                invoices: invoices.data || [],
                sequences: sequences.data || []
            },
            stats: {
                profiles_count: profiles.data?.length || 0,
                companies_count: companies.data?.length || 0,
                invoices_count: invoices.data?.length || 0,
                sequences_count: sequences.data?.length || 0
            }
        };

        // Sauvegarder dans /backups
        const backupPath = join(process.cwd(), 'backups', `backup-${timestamp}.json`);
        await writeFile(backupPath, JSON.stringify(backup, null, 2));

        return {
            success: true,
            path: backupPath,
            stats: backup.stats
        };
    } catch (error: any) {
        console.error('Erreur backup:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

export async function restoreBackup(backupData: string) {
    const supabase = getSupabaseAdmin();

    try {
        const backup = JSON.parse(backupData);

        // Restaurer dans l'ordre (dépendances)
        if (backup.data.profiles?.length > 0) {
            await supabase.from('profiles').insert(backup.data.profiles);
        }

        if (backup.data.companies?.length > 0) {
            await supabase.from('companies').insert(backup.data.companies);
        }

        if (backup.data.invoices?.length > 0) {
            await supabase.from('invoices').insert(backup.data.invoices);
        }

        if (backup.data.sequences?.length > 0) {
            await supabase.from('invoice_sequences').insert(backup.data.sequences);
        }

        return {
            success: true,
            restored: backup.stats
        };
    } catch (error: any) {
        console.error('Erreur restauration:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

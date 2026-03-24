'use server';

import { createClient } from '@supabase/supabase-js';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { z } from 'zod';
import { requireAdmin } from './serverAuth';

const getSupabaseAdmin = () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    if (!url || !serviceRole) {
        throw new Error('Supabase ENV manquante');
    }
    return createClient(url, serviceRole);
};

const rowSchema = z.record(z.string(), z.unknown());
const backupSchema = z.object({
    timestamp: z.string(),
    version: z.string(),
    data: z.object({
        profiles: z.array(rowSchema).default([]),
        companies: z.array(rowSchema).default([]),
        invoices: z.array(rowSchema).default([]),
        invoice_items: z.array(rowSchema).default([]),
        counters: z.array(rowSchema).default([])
    }),
    stats: z.object({
        profiles_count: z.number().default(0),
        companies_count: z.number().default(0),
        invoices_count: z.number().default(0),
        invoice_items_count: z.number().default(0),
        counters_count: z.number().default(0)
    }).optional()
});

export async function createBackup() {
    await requireAdmin();
    const supabase = getSupabaseAdmin();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    try {
        const [profiles, companies, invoices, invoiceItems, counters] = await Promise.all([
            supabase.from('profiles').select('*'),
            supabase.from('companies').select('*'),
            supabase.from('invoices').select('*'),
            supabase.from('invoice_items').select('*'),
            supabase.from('counters').select('*')
        ]);

        const errors = [profiles.error, companies.error, invoices.error, invoiceItems.error, counters.error]
            .filter(Boolean)
            .map(err => err?.message)
            .join(' | ');
        if (errors) {
            throw new Error(errors);
        }

        const backup = {
            timestamp,
            version: '1.0',
            data: {
                profiles: profiles.data || [],
                companies: companies.data || [],
                invoices: invoices.data || [],
                invoice_items: invoiceItems.data || [],
                counters: counters.data || []
            },
            stats: {
                profiles_count: profiles.data?.length || 0,
                companies_count: companies.data?.length || 0,
                invoices_count: invoices.data?.length || 0,
                invoice_items_count: invoiceItems.data?.length || 0,
                counters_count: counters.data?.length || 0
            }
        };

        const backupsDir = join(process.cwd(), 'backups');
        await mkdir(backupsDir, { recursive: true });
        const backupPath = join(backupsDir, `backup-${timestamp}.json`);
        await writeFile(backupPath, JSON.stringify(backup, null, 2));

        return {
            success: true,
            path: backupPath,
            stats: backup.stats
        };
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Erreur inconnue';
        console.error('Erreur backup:', error);
        return {
            success: false,
            error: message
        };
    }
}

export async function restoreBackup(backupData: string) {
    await requireAdmin();
    const supabase = getSupabaseAdmin();

    try {
        const parsed = JSON.parse(backupData);
        const validated = backupSchema.safeParse(parsed);
        if (!validated.success) {
            throw new Error('Format de backup invalide');
        }
        const backup = validated.data;

        if (backup.data.profiles?.length > 0) {
            const { error } = await supabase.from('profiles').upsert(backup.data.profiles, { onConflict: 'id' });
            if (error) throw error;
        }

        if (backup.data.companies?.length > 0) {
            const { error } = await supabase.from('companies').upsert(backup.data.companies, { onConflict: 'id' });
            if (error) throw error;
        }

        if (backup.data.invoices?.length > 0) {
            const { error } = await supabase.from('invoices').upsert(backup.data.invoices, { onConflict: 'id' });
            if (error) throw error;
        }

        if (backup.data.invoice_items?.length > 0) {
            const { error } = await supabase.from('invoice_items').upsert(backup.data.invoice_items, { onConflict: 'id' });
            if (error) throw error;
        }

        if (backup.data.counters?.length > 0) {
            const { error } = await supabase.from('counters').upsert(backup.data.counters, { onConflict: 'name' });
            if (error) throw error;
        }

        return {
            success: true,
            restored: {
                profiles_count: backup.data.profiles.length,
                companies_count: backup.data.companies.length,
                invoices_count: backup.data.invoices.length,
                invoice_items_count: backup.data.invoice_items.length,
                counters_count: backup.data.counters.length
            }
        };
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Erreur inconnue';
        console.error('Erreur restauration:', error);
        return {
            success: false,
            error: message
        };
    }
}

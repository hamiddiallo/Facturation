import { Company, InvoiceData } from './types';
import {
    getCompaniesAction,
    createCompanyAction,
    updateCompanyAction,
    deleteCompanyAction,
    setDefaultCompanyAction
} from '@/app/actions/companyActions';
import {
    getInvoicesCloudAction,
    saveInvoiceCloudAction,
    deleteInvoiceCloudAction,
    getNextSequenceCloudAction,
    generateInvoiceNumberAtomicAction,
    getDashboardStatsAction
} from '@/app/actions/invoiceActions';

/**
 * Ce fichier sert de bridge entre le frontend (Client Components) et les Server Actions.
 * Toutes les opérations passent par le serveur (supabaseAdmin) pour bypasser le RLS activé.
 * L'authentification est vérifiée via les cookies session côté serveur.
 */

export const getCompanies = async (): Promise<Company[]> => {
    return await getCompaniesAction();
};

export const createCompany = async (company: Omit<Company, 'id'>): Promise<Company | null> => {
    return await createCompanyAction(company);
};

export const updateCompany = async (id: string, company: Partial<Company>): Promise<Company | null> => {
    return await updateCompanyAction(id, company);
};

export const setDefaultCompany = async (companyId: string): Promise<boolean> => {
    return await setDefaultCompanyAction(companyId);
};

export const deleteCompany = async (id: string): Promise<boolean> => {
    return await deleteCompanyAction(id);
};

// --- SERVICES FACTURES ---

export const saveInvoiceCloud = async (invoice: InvoiceData, companyId: string, totalAmount: number): Promise<string | null> => {
    // Plus besoin de gérer le userId ici, c'est géré par requireAuth() dans l'action serveur
    return await saveInvoiceCloudAction(invoice, companyId, totalAmount);
};

export const getInvoicesCloud = async (page: number = 0, pageSize: number = 20): Promise<any[]> => {
    return await getInvoicesCloudAction(page, pageSize);
};

export const generateInvoiceNumberAtomic = async (dateStr: string | Date = new Date()): Promise<number> => {
    return await generateInvoiceNumberAtomicAction(dateStr);
};

export const getNextSequenceCloud = async (dateStr: string | Date = new Date()): Promise<number> => {
    return await getNextSequenceCloudAction(dateStr);
};

export const deleteInvoiceCloud = async (id: string): Promise<boolean> => {
    return await deleteInvoiceCloudAction(id);
};

export const getDashboardStats = async (): Promise<any> => {
    return await getDashboardStatsAction();
};

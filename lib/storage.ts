import { InvoiceData } from './types';

const STORAGE_KEY = 'invoiceData';

export const saveInvoiceData = (data: InvoiceData): void => {
    if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }
};

export const getInvoiceData = (): InvoiceData | null => {
    if (typeof window !== 'undefined') {
        const data = localStorage.getItem(STORAGE_KEY);
        return data ? JSON.parse(data) : null;
    }
    return null;
};

export const clearInvoiceData = (): void => {
    if (typeof window !== 'undefined') {
        localStorage.removeItem(STORAGE_KEY);
    }
};

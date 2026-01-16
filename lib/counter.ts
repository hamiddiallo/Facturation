import { InvoiceType, Company } from './types';

const GLOBAL_COUNTER_KEY = 'global_invoice_counter';

/**
 * Extrait les initiales du nom d'entreprise pour le préfixe de facture
 * Exemples:
 * - "ETS MLF" → "MLF"
 * - "MOUCTAR & FRÈRES" → "MF"
 * - "LES BOUTIQUES THIERNODJO & FRERE" → "BTF"
 */
export const getCompanyPrefix = (company: Company): string => {
    const name = company.displayName || company.name;

    // Mots à ignorer lors de l'extraction des initiales
    const ignoredWords = ['LES', 'LE', 'LA', 'ET', '&', 'FRERE', 'FRÈRES', 'SARL', 'SA', 'SAS'];

    // Diviser le nom en mots et filtrer les mots ignorés
    const words = name
        .toUpperCase()
        .split(/[\s\-]+/) // Séparer par espaces ou tirets
        .filter(word => word.length > 0 && !ignoredWords.includes(word));

    // Extraire la première lettre de chaque mot significatif
    const initials = words.map(word => word[0]).join('');

    // Si on a des initiales, les retourner, sinon utiliser les 3 premières lettres du nom
    return initials.length > 0 ? initials : name.slice(0, 3).toUpperCase();
};

export const getTypePrefix = (type: InvoiceType): string => {
    switch (type) {
        case InvoiceType.DEFINITIVE: return 'DEF';
        case InvoiceType.PROFORMA: return 'PRO';
        case InvoiceType.BON_LIVRAISON: return 'BL';
        case InvoiceType.SIMPLE: return 'FAC';
        default: return 'FAC';
    }
};

export const getNextSequenceNumber = (): number => {
    if (typeof window === 'undefined') return 1;
    const stored = localStorage.getItem(GLOBAL_COUNTER_KEY);
    return stored ? parseInt(stored, 10) + 1 : 1;
};

export const saveLastSequenceNumber = (num: number): void => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(GLOBAL_COUNTER_KEY, num.toString());
};

/**
 * Formats a generic number for the form (e.g., FAC-2501-0001)
 */
export const formatBaseInvoiceNumber = (sequence: number): string => {
    const date = new Date();
    const yy = date.getFullYear().toString().slice(-2);
    const mm = (date.getMonth() + 1).toString().padStart(2, '0');
    const seq = sequence.toString().padStart(4, '0');
    return `FAC-${yy}${mm}-${seq}`;
};

/**
 * Adapts a generic number to a specific company/type format
 * e.g., FAC-2501-0001 -> MLFDEF-2501-0001
 */
export const adaptInvoiceNumber = (baseNumber: string, company: Company, type: InvoiceType): string => {
    if (!baseNumber.startsWith('FAC-')) return baseNumber;

    const companyPrefix = getCompanyPrefix(company);
    const typePrefix = getTypePrefix(type);

    return baseNumber.replace('FAC-', `${companyPrefix}${typePrefix}-`);
};

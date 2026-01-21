import { InvoiceType, Company } from './types';

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


/**
 * Generate counter name based on date (format: invoice_YYMMDD)
 * @param dateStr - Date to generate counter name for
 * @returns Counter name string
 */
export const getCounterName = (dateStr: string | Date = new Date()): string => {
    const d = new Date(dateStr);
    const yy = d.getFullYear().toString().slice(-2);
    const mm = (d.getMonth() + 1).toString().padStart(2, '0');
    const dd = d.getDate().toString().padStart(2, '0');
    return `invoice_${yy}${mm}${dd}`;
};

/**
 * Formats a generic number for the form (e.g., FAC-2501-0001)
 */
export const formatBaseInvoiceNumber = (sequence: number, dateStr: string | Date = new Date()): string => {
    const date = new Date(dateStr);
    const yy = date.getFullYear().toString().slice(-2);
    const mm = (date.getMonth() + 1).toString().padStart(2, '0');
    const dd = date.getDate().toString().padStart(2, '0');
    const seq = sequence.toString().padStart(4, '0');
    return `FAC-${yy}${mm}${dd}-${seq}`;
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

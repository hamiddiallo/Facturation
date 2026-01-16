import { Company } from './types';
import { companies as defaultCompanies } from './companies';

const COMPANIES_STORAGE_KEY = 'custom_companies_data';

export const getStoredCompanies = (): Company[] => {
    if (typeof window === 'undefined') return defaultCompanies;

    const stored = localStorage.getItem(COMPANIES_STORAGE_KEY);
    if (!stored) return defaultCompanies;

    try {
        const customData: Company[] = JSON.parse(stored);
        // On fusionne les données par défaut avec les personnalisations pour garder les nouveaux ID si ajoutés dans le code
        return defaultCompanies.map(def => {
            const custom = customData.find(c => c.id === def.id);
            return custom ? { ...def, ...custom } : def;
        });
    } catch (e) {
        console.error('Erreur lors du chargement des entreprises:', e);
        return defaultCompanies;
    }
};

export const saveCompanies = (companies: Company[]): void => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(COMPANIES_STORAGE_KEY, JSON.stringify(companies));
};

export const updateCompany = (updatedCompany: Company): void => {
    const current = getStoredCompanies();
    const next = current.map(c => c.id === updatedCompany.id ? updatedCompany : c);
    saveCompanies(next);
};

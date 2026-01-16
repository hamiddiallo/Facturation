import { Company } from './types';

// Company data based on the invoice templates
export const companies: Company[] = [
    {
        id: 'ets-mlf',
        name: 'ETS MLF',
        displayName: 'ETS MLF',
        businessType: 'COMMERCE GENERALE',
        address: 'sise au grand marché central de labé',
        nif: '393097985',
        registrationNumbers: 'NºFORMALITÉ/RCCM/GN.TCC.2024.07709 NºENTREPRISE/RCCM/GN.TCC.2024.A.06830',
        phone: '(+224) 620 037 778',
        email: 'mouctardh45@gmail.com',
        hasStyledLogo: true, // Has the big 3D styled logo
        isDefault: true,
        templateId: 'template_standard'
    },
    {
        id: 'mouctar',
        name: 'MOUCTAR & FRÈRES',
        displayName: 'MOUCTAR & FRÈRES',
        businessType: 'Commerce Generale',
        address: 'sise au grand marché centrale de labe',
        phone: '(+224) 620 037 778',
        email: 'mouctardh45@gmail.com',
        hasStyledLogo: false, // Simple text, no styled logo
        isDefault: false,
        templateId: 'template_standard'
    },
    {
        id: 'thiernodjo',
        name: 'LES BOUTIQUES THIERNODJO & FRERE',
        displayName: 'LES BOUTIQUES THIERNODJO & FRERE',
        businessType: 'Commerce Generale',
        address: 'sise au grand marché centrale de labé',
        phone: '622 227 115 / 626 121 245',
        email: '',
        hasStyledLogo: false, // Simple text, no styled logo
        isDefault: false,
        templateId: 'template_standard'
    },
];

export const getCompanyById = (id: string): Company | undefined => {
    return companies.find(company => company.id === id);
};

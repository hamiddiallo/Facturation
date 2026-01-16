// TypeScript interfaces for the invoice application

export interface Company {
  id: string;
  name: string;
  displayName: string;
  businessType: string;
  address: string;
  nif?: string;
  registrationNumbers?: string;
  phone: string;
  email: string;
  hasStyledLogo?: boolean; // True for ETS MLF with 3D logo, false for simple text
  sealImage?: string | null; // Base64 signature or seal image
  isDefault: boolean;
  templateId?: string;
}

export interface Client {
  nom: string;
  adresse: string;
}

export interface Article {
  designation: string;
  quantity: number;
  unit?: string;
  price: number;
  totalPrice: number;
  delivered?: boolean; // Track delivery status
}

export interface InvoiceData {
  client: Client;
  numeroFacture: string;
  dateFacture: string;
  echeance?: string;
  articles: Article[];
  totalFacture: number;
  selectedCompany: Company;
  amountPaid?: number; // Amount already paid
  type: InvoiceType;
}

export enum InvoiceType {
  PROFORMA = 'proforma',
  DEFINITIVE = 'definitive',
  BON_LIVRAISON = 'bon_livraison',
  SIMPLE = 'simple'
}

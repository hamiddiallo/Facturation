# 🧾 Générateur de Factures Pro

Application web moderne pour créer et partager des factures professionnelles en Guinée.

## ✨ Fonctionnalités

- 📝 **Création de factures** : Proforma, Définitive, Simple, Bon de Livraison
- 💾 **Sauvegarde automatique** : Les données sont conservées dans le navigateur
- 📱 **Partage mobile** : Génération et partage de PDF via WhatsApp, email, etc.
- 🖨️ **Impression** : Optimisée pour format A4
- 📊 **Gestion d'articles** : Ajout/suppression dynamique avec calcul automatique
- 🔢 **Conversion en lettres** : Montants convertis en français
- 📲 **Responsive** : Adapté mobile, tablette et desktop
- 🎨 **Interface moderne** : Animations et design professionnel

## 🚀 Démarrage Rapide

### Prérequis
- Node.js 20+ 
- npm ou yarn

### Installation

```bash
# Cloner le projet
git clone <votre-repo>
cd Facture

# Installer les dépendances
npm install

# Lancer en développement
npm run dev
```

Ouvrir [http://localhost:3000](http://localhost:3000)

### Build de Production

```bash
npm run build
npm start
```

## 📁 Structure du Projet

```
Facture/
├── app/                    # Pages Next.js
│   ├── page.tsx           # Page d'accueil (formulaire)
│   └── preview/           # Page de prévisualisation
├── components/            # Composants React
│   ├── templates/         # Templates de factures
│   ├── InvoiceForm.tsx    # Formulaire principal
│   └── ArticleList.tsx    # Gestion des articles
├── lib/                   # Utilitaires
│   ├── types.ts          # Types TypeScript
│   ├── companies.ts      # Données des entreprises
│   ├── storage.ts        # LocalStorage
│   └── numberToWords.ts  # Conversion nombres → lettres
└── public/               # Assets statiques
```

## 🏢 Entreprises Supportées

- **ETS MLF** : Logo 3D stylisé
- **MOUCTAR & FRÈRES** : Commerce général
- **LES BOUTIQUES THIERNODJO & FRERE** : Commerce général

## 🎯 Utilisation

1. **Remplir le formulaire** : Client, articles, date
2. **Générer** : Cliquer sur "Générer la facture"
3. **Choisir le type** : Proforma, Définitive, Simple, Bon de Livraison
4. **Partager ou Imprimer** :
   - 📱 Mobile : Bouton "Partager PDF"
   - 💻 Desktop : Bouton "Imprimer"

## 🛠️ Technologies

- **Framework** : Next.js 16 (Turbopack)
- **Language** : TypeScript
- **Styling** : CSS Modules
- **PDF** : html2pdf.js
- **Partage** : Web Share API

## 📱 Fonctionnalités Mobile

- Zoom automatique de la facture
- Bouton de partage fixé en bas
- Sélecteur de type horizontal scrollable
- Interface tactile optimisée

## 🔧 Configuration

### Ajouter une Entreprise

Modifier `lib/companies.ts` :

```typescript
{
  id: 'mon-entreprise',
  name: 'MON ENTREPRISE',
  displayName: 'MON ENTREPRISE',
  businessType: 'Commerce Generale',
  address: 'Adresse complète',
  phone: '+224 XXX XXX XXX',
  email: 'contact@exemple.com',
  hasStyledLogo: false
}
```

## 📦 Déploiement sur Vercel

```bash
# Installer Vercel CLI
npm i -g vercel

# Déployer
vercel
```

Ou via l'interface : [vercel.com/new](https://vercel.com/new)

## 📝 Licence

Projet privé - Tous droits réservés

## 👨‍💻 Auteur

Développé pour la gestion de factures en Guinée

---

**Version** : 1.0.0  
**Dernière mise à jour** :janvier 2026

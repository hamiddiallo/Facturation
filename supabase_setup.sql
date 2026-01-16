-- ======================================================
-- CONFIGURATION SUPABASE : 100% PROFILES (PAS D'AUTH SYSTEME)
-- ======================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. TABLES (Tout est dans Public, pas de lien avec auth.users)

-- PROFILES : Source unique de vérité (Données + Authentification)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL, -- Authentification manuelle
    full_name TEXT,
    role TEXT DEFAULT 'user' NOT NULL,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- COMPANIES
CREATE TABLE IF NOT EXISTS public.companies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    display_name TEXT NOT NULL,
    business_type TEXT,
    address TEXT,
    phone TEXT,
    email TEXT,
    nif TEXT,
    registration_numbers TEXT,
    has_styled_logo BOOLEAN DEFAULT FALSE,
    seal_image TEXT,
    is_default BOOLEAN DEFAULT FALSE,
    template_id TEXT DEFAULT 'template_standard',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- INVOICES
CREATE TABLE IF NOT EXISTS public.invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
    number TEXT NOT NULL,
    type TEXT NOT NULL,
    date DATE NOT NULL,
    client_name TEXT NOT NULL,
    client_address TEXT,
    amount_paid NUMERIC DEFAULT 0,
    total_amount NUMERIC NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- INVOICE_ITEMS
CREATE TABLE IF NOT EXISTS public.invoice_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID REFERENCES public.invoices(id) ON DELETE CASCADE NOT NULL,
    designation TEXT NOT NULL,
    quantity NUMERIC NOT NULL,
    unit TEXT,
    price NUMERIC NOT NULL,
    total_price NUMERIC NOT NULL
);

-- COUNTERS
CREATE TABLE IF NOT EXISTS public.counters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT UNIQUE NOT NULL, 
    last_sequence INTEGER DEFAULT 0 NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- 3. SECURITÉ (Note: Dans un système Profiles-Only sans auth.users, la RLS Supabase 
-- devient difficile à utiliser via auth.uid(). On utilise une approche simplifiée 
-- ou on désactive RLS pour gérer la sécurité dans le code applicatif.)
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.counters DISABLE ROW LEVEL SECURITY;

-- 5. INDEXES POUR LA PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON public.invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_number ON public.invoices(number);
CREATE INDEX IF NOT EXISTS idx_companies_user_id ON public.companies(user_id);

-- 6. ÉTAT ET INITIALISATION
INSERT INTO public.counters (name, last_sequence) 
VALUES ('global', 0)
ON CONFLICT (name) DO NOTHING;

-- 5. CRÉATION ADMIN (Profiles-Only avec hash bcrypt 'hamid')
INSERT INTO public.profiles (email, password_hash, full_name, role, status) 
VALUES (
    'hamid@gmail.com', 
    '$2b$10$39woBXbvURb5v/DMmwYU7.44MOzuUdgpDsPdi3EKhlEODyxs1KAbG', 
    'Hamid Admin', 
    'admin', 
    'active'
)
ON CONFLICT (email) DO NOTHING;
-- 6. INSERTION DES ENTREPRISE PAR DÉFAUT
DO $$ 
DECLARE 
    v_user_id UUID;
BEGIN
    -- Récupérer l'ID de l'admin
    SELECT id INTO v_user_id FROM public.profiles WHERE email = 'hamid@gmail.com' LIMIT 1;

    IF v_user_id IS NOT NULL THEN
        -- 1. ETS MLF
        INSERT INTO public.companies (user_id, name, display_name, business_type, address, phone, email)
        VALUES (v_user_id, 'ETS MLF', 'ETS MLF', 'COMMERCE GENERALE', 'sise au grand marché central de labé', '(+224) 620 037 778', 'mouctardh45@gmail.com')
        ON CONFLICT DO NOTHING;

        -- 2. MOUCTAR & FRÈRES
        INSERT INTO public.companies (user_id, name, display_name, business_type, address, phone, email)
        VALUES (v_user_id, 'MOUCTAR & FRÈRES', 'MOUCTAR & FRÈRES', 'Commerce Generale', 'sise au grand marché centrale de labe', '(+224) 620 037 778', 'mouctardh45@gmail.com')
        ON CONFLICT DO NOTHING;

        -- 3. LES BOUTIQUES THIERNODJO & FRERE
        INSERT INTO public.companies (user_id, name, display_name, business_type, address, phone, email)
        VALUES (v_user_id, 'LES BOUTIQUES THIERNODJO & FRERE', 'LES BOUTIQUES THIERNODJO & FRERE', 'Commerce Generale', 'sise au grand marché centrale de labé', '622 227 115 / 626 121 245', '')
        ON CONFLICT DO NOTHING;
    END IF;
END $$;

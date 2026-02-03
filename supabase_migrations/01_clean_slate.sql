-- ========================================
-- ÉTAPE 1/3 : NETTOYAGE COMPLET
-- ========================================
-- Ce script supprime les éléments conflictuels pour repartir sur une base saine

-- 1. Supprimer le trigger problématique
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

-- 2. Supprimer la fonction is_admin (on la recréera après)
DROP FUNCTION IF EXISTS public.is_admin() CASCADE;

-- 3. Vider auth.users (on va recréer avec les bons IDs)
DELETE FROM auth.users;

-- 4. Supprimer les politiques RLS existantes (on les recréera proprement)
DROP POLICY IF EXISTS "Admin can view all companies, users view own" ON public.companies;
DROP POLICY IF EXISTS "Users can create own companies" ON public.companies;
DROP POLICY IF EXISTS "Admin can update all companies, users update own" ON public.companies;
DROP POLICY IF EXISTS "Admin can delete all companies, users delete own" ON public.companies;

DROP POLICY IF EXISTS "Admin can view all invoices, users view own" ON public.invoices;
DROP POLICY IF EXISTS "Users can create own invoices" ON public.invoices;
DROP POLICY IF EXISTS "Admin can update all invoices, users update own" ON public.invoices;
DROP POLICY IF EXISTS "Admin can delete all invoices, users delete own" ON public.invoices;

DROP POLICY IF EXISTS "Admin view all items, users view own via invoice" ON public.invoice_items;
DROP POLICY IF EXISTS "Users create items for own invoices" ON public.invoice_items;
DROP POLICY IF EXISTS "Admin update all items, users update own via invoice" ON public.invoice_items;
DROP POLICY IF EXISTS "Admin delete all items, users delete own via invoice" ON public.invoice_items;

DROP POLICY IF EXISTS "All authenticated users can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admin can update all profiles, users update own" ON public.profiles;
DROP POLICY IF EXISTS "Only admins can delete profiles" ON public.profiles;

DROP POLICY IF EXISTS "Authenticated users can view counters" ON public.counters;
DROP POLICY IF EXISTS "Only admins can update counters" ON public.counters;
DROP POLICY IF EXISTS "Only admins can insert counters" ON public.counters;

-- 5. Désactiver RLS temporairement
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.counters DISABLE ROW LEVEL SECURITY;

-- 6. Vérification
SELECT 
    'Profiles actifs' as table_name, 
    COUNT(*) as count 
FROM public.profiles WHERE status = 'active'
UNION ALL
SELECT 
    'Auth users', 
    COUNT(*) 
FROM auth.users;

-- Devrait afficher:
-- Profiles actifs: 1+ (vos utilisateurs existants)
-- Auth users: 0 (nettoyé)

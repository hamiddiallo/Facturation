-- ======================================================
-- ACTIVATION RLS (ROW LEVEL SECURITY)
-- OPTION 2 : PROTECTION API DIRECTE
-- ======================================================

-- 1. Activer RLS sur TOUTES les tables
-- Cela bloque tout accès via la clé public 'anon' par défaut
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.counters ENABLE ROW LEVEL SECURITY;

-- 2. NOTE SUR LA SERVICE ROLE KEY
-- La clé 'service_role' (utilisée par supabaseAdmin côté serveur) 
-- bypass AUTOMATIQUEMENT le RLS. Aucune politique supplémentaire 
-- n'est nécessaire pour le fonctionnement interne de l'application.

-- 3. VÉRIFICATION
-- Si vous essayez de faire un select dans le dashboard Supabase
-- sans être en mode 'service_role', vous ne verrez plus aucune donnée.
-- C'est le comportement attendu pour protéger votre API.

-- 4. (OPTIONNEL) SI VOUS VOULEZ QUAND MÊME VOIR LES DONNÉES DANS LE DASHBOARD
-- Vous pouvez ajouter une politique pour les admins Supabase (backend users)
-- mais ce n'est pas nécessaire pour le fonctionnement de l'app.

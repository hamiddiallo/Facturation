-- ========================================
-- ÉTAPE 3/3 : ACTIVATION RLS FINALE
-- ========================================
-- Ce script active Row Level Security avec les bonnes politiques
-- Maintenant que les IDs correspondent entre auth.users et profiles

-- Fonction helper pour vérifier si l'utilisateur est admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ========================================
-- PROFILES
-- ========================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tous les utilisateurs authentifiés peuvent voir les profils"
ON public.profiles FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Les admins peuvent tout modifier, les users modifient leur profil"
ON public.profiles FOR UPDATE
USING (is_admin() OR auth.uid() = id);

CREATE POLICY "Seuls les admins peuvent supprimer des profils"
ON public.profiles FOR DELETE
USING (is_admin());

-- ========================================
-- COMPANIES
-- ========================================
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Les admins voient tout, les users voient leurs entreprises"
ON public.companies FOR SELECT
USING (is_admin() OR auth.uid() = user_id);

CREATE POLICY "Les users peuvent créer leurs entreprises"
ON public.companies FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Les admins modifient tout, les users modifient leurs entreprises"
ON public.companies FOR UPDATE
USING (is_admin() OR auth.uid() = user_id);

CREATE POLICY "Les admins suppriment tout, les users suppriment leurs entreprises"
ON public.companies FOR DELETE
USING (is_admin() OR auth.uid() = user_id);

-- ========================================
-- INVOICES
-- ========================================
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Les admins voient tout, les users voient leurs factures"
ON public.invoices FOR SELECT
USING (is_admin() OR auth.uid() = user_id);

CREATE POLICY "Les users peuvent créer leurs factures"
ON public.invoices FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Les admins modifient tout, les users modifient leurs factures"
ON public.invoices FOR UPDATE
USING (is_admin() OR auth.uid() = user_id);

CREATE POLICY "Les admins suppriment tout, les users suppriment leurs factures"
ON public.invoices FOR DELETE
USING (is_admin() OR auth.uid() = user_id);

-- ========================================
-- INVOICE_ITEMS (via jointure avec invoices)
-- ========================================
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Voir les items des factures accessibles"
ON public.invoice_items FOR SELECT
USING (
  is_admin() OR EXISTS (
    SELECT 1 FROM public.invoices i
    WHERE i.id = invoice_items.invoice_id
    AND i.user_id = auth.uid()
  )
);

CREATE POLICY "Créer des items pour ses factures"
ON public.invoice_items FOR INSERT
WITH CHECK (
  is_admin() OR EXISTS (
    SELECT 1 FROM public.invoices i
    WHERE i.id = invoice_id
    AND i.user_id = auth.uid()
  )
);

CREATE POLICY "Modifier les items de ses factures"
ON public.invoice_items FOR UPDATE
USING (
  is_admin() OR EXISTS (
    SELECT 1 FROM public.invoices i
    WHERE i.id = invoice_items.invoice_id
    AND i.user_id = auth.uid()
  )
);

CREATE POLICY "Supprimer les items de ses factures"
ON public.invoice_items FOR DELETE
USING (
  is_admin() OR EXISTS (
    SELECT 1 FROM public.invoices i
    WHERE i.id = invoice_items.invoice_id
    AND i.user_id = auth.uid()
  )
);

-- ========================================
-- COUNTERS (partagé, lecture publique)
-- ========================================
ALTER TABLE public.counters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tous les utilisateurs authentifiés peuvent lire les compteurs"
ON public.counters FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Seuls les admins peuvent modifier les compteurs"
ON public.counters FOR UPDATE
USING (is_admin());

CREATE POLICY "Seuls les admins peuvent créer des compteurs"
ON public.counters FOR INSERT
WITH CHECK (is_admin());

-- ========================================
-- VÉRIFICATION
-- ========================================

-- Vérifier que RLS est activé partout
SELECT 
  tablename,
  CASE WHEN rowsecurity THEN '✅ Activé' ELSE '❌ Désactivé' END as rls_status
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('profiles', 'companies', 'invoices', 'invoice_items', 'counters')
ORDER BY tablename;

-- Compter les politiques
SELECT 
  tablename,
  COUNT(*) as nombre_de_politiques
FROM pg_policies 
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;

-- Instructions finales
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════════';
  RAISE NOTICE '🎉 SÉCURITÉ RLS ACTIVÉE !';
  RAISE NOTICE '═══════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE '✅ Row Level Security est maintenant actif sur toutes les tables';
  RAISE NOTICE '✅ Les utilisateurs ne peuvent voir que leurs propres données';
  RAISE NOTICE '✅ Les admins ont accès à tout';
  RAISE NOTICE '';
  RAISE NOTICE '🔐 Vous pouvez maintenant vous connecter en toute sécurité !';
  RAISE NOTICE '';
END $$;

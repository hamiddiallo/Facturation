-- ========================================
-- OPTIMISATION DES PERFORMANCES SQL
-- ========================================

-- 1. Optimiser is_admin() pour lire depuis le JWT
-- Cela évite un lookup dans la table profiles à chaque vérification RLS
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  -- Lecture directe des app_metadata du JWT (très rapide)
  RETURN (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 2. Trigger pour synchroniser le rôle dans auth.users.raw_app_meta_data
-- Cela permet à Supabase d'inclure le rôle dans le JWT lors du login/refresh
CREATE OR REPLACE FUNCTION public.sync_role_to_auth()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE auth.users
  SET raw_app_meta_data = 
    COALESCE(raw_app_meta_data, '{}'::jsonb) || 
    jsonb_build_object('role', NEW.role)
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_sync_role_to_auth ON public.profiles;
CREATE TRIGGER tr_sync_role_to_auth
  AFTER UPDATE OF role OR INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.sync_role_to_auth();

-- 3. Synchronisation initiale pour les utilisateurs existants
DO $$
DECLARE
  profile_record RECORD;
BEGIN
  FOR profile_record IN SELECT id, role FROM public.profiles LOOP
    UPDATE auth.users
    SET raw_app_meta_data = 
      COALESCE(raw_app_meta_data, '{}'::jsonb) || 
      jsonb_build_object('role', profile_record.role)
    WHERE id = profile_record.id;
  END LOOP;
END $$;

-- 4. Ajout d'index de performance
-- Index sur les user_id pour accélérer les filtrages RLS
CREATE INDEX IF NOT EXISTS idx_companies_user_id ON public.companies(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON public.invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON public.invoices(created_at DESC);

-- Index sur les colonnes de jointure/recherche fréquentes
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON public.invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- Rapport de succès
DO $$
BEGIN
  RAISE NOTICE '🚀 Optimisations SQL terminées avec succès';
END $$;

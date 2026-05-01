-- ========================================
-- REPARATION AUTH : IDENTITIES MANQUANTES
-- ========================================
-- Symptome observe :
-- - supabase.auth.admin.listUsers() => 500 "Database error finding users"
-- - supabase.auth.admin.getUserById() => 500 "Database error loading user"
-- - signInWithPassword() => 500 "Database error querying schema"
--
-- Cause probable :
-- La migration a insere directement dans auth.users sans creer les lignes
-- correspondantes dans auth.identities. Supabase Auth s'appuie sur ces lignes
-- pour charger les utilisateurs email.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. S'assurer que chaque auth.users email possede une identite email.
INSERT INTO auth.identities (
  provider_id,
  user_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
)
SELECT
  u.id::text AS provider_id,
  u.id AS user_id,
  jsonb_build_object(
    'sub', u.id::text,
    'email', u.email,
    'email_verified', u.email_confirmed_at IS NOT NULL,
    'phone_verified', false
  ) AS identity_data,
  'email' AS provider,
  COALESCE(u.last_sign_in_at, u.created_at, NOW()) AS last_sign_in_at,
  COALESCE(u.created_at, NOW()) AS created_at,
  NOW() AS updated_at
FROM auth.users u
WHERE u.email IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM auth.identities i
    WHERE i.user_id = u.id
      AND i.provider = 'email'
  )
ON CONFLICT (provider_id, provider) DO UPDATE
SET
  user_id = EXCLUDED.user_id,
  identity_data = EXCLUDED.identity_data,
  updated_at = NOW();

-- 2. Corriger le trigger pour les futurs utilisateurs Auth.
-- profiles.password_hash est NOT NULL, donc le trigger doit fournir une valeur.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    email,
    password_hash,
    full_name,
    role,
    status
  )
  VALUES (
    NEW.id,
    NEW.email,
    'AUTH_MANAGED',
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Utilisateur'),
    COALESCE(NEW.raw_user_meta_data->>'role', 'user'),
    'active'
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    full_name = COALESCE(public.profiles.full_name, EXCLUDED.full_name),
    role = COALESCE(public.profiles.role, EXCLUDED.role),
    status = COALESCE(public.profiles.status, EXCLUDED.status),
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Verification rapide a lancer dans le SQL editor.
SELECT
  (SELECT COUNT(*) FROM auth.users WHERE email IS NOT NULL) AS auth_email_users,
  (SELECT COUNT(*) FROM auth.identities WHERE provider = 'email') AS email_identities,
  (SELECT COUNT(*)
   FROM auth.users u
   WHERE u.email IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM auth.identities i
       WHERE i.user_id = u.id
         AND i.provider = 'email'
     )) AS missing_email_identities;

-- ========================================
-- RECONSTRUCTION AUTH DEPUIS PROFILES
-- ========================================
-- A utiliser si 06_repair_auth_identities.sql ne suffit pas.
-- Ce script reconstruit auth.users et auth.identities depuis public.profiles
-- en conservant les memes UUID, pour ne pas casser companies/invoices.
--
-- Mot de passe temporaire pour tous les comptes reconstruits :
-- TempPass2026!

CREATE EXTENSION IF NOT EXISTS pgcrypto;

BEGIN;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

DELETE FROM auth.identities
WHERE user_id IN (
  SELECT id FROM public.profiles WHERE status = 'active'
);

DELETE FROM auth.users
WHERE id IN (
  SELECT id FROM public.profiles WHERE status = 'active'
);

INSERT INTO auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  confirmation_sent_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  is_sso_user,
  is_anonymous
)
SELECT
  p.id,
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  p.email,
  crypt('TempPass2026!', gen_salt('bf')),
  NOW(),
  NOW(),
  jsonb_build_object(
    'provider', 'email',
    'providers', jsonb_build_array('email'),
    'role', p.role
  ),
  jsonb_build_object(
    'full_name', p.full_name,
    'role', p.role,
    'email_verified', true
  ),
  COALESCE(p.created_at, NOW()),
  NOW(),
  false,
  false
FROM public.profiles p
WHERE p.status = 'active';

INSERT INTO auth.identities (
  id,
  provider_id,
  user_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid(),
  p.id::text,
  p.id,
  jsonb_build_object(
    'sub', p.id::text,
    'email', p.email,
    'email_verified', true,
    'phone_verified', false
  ),
  'email',
  NOW(),
  COALESCE(p.created_at, NOW()),
  NOW()
FROM public.profiles p
WHERE p.status = 'active';

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

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

COMMIT;

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

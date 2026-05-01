-- ========================================
-- DIAGNOSTIC AUTH SUPABASE
-- ========================================
-- A executer dans le SQL Editor Supabase.
-- Le resultat aide a identifier pourquoi GoTrue renvoie encore des erreurs 500.

SELECT
  'auth.users count' AS check_name,
  COUNT(*)::text AS value
FROM auth.users
UNION ALL
SELECT
  'auth.identities count',
  COUNT(*)::text
FROM auth.identities
UNION ALL
SELECT
  'email identities count',
  COUNT(*)::text
FROM auth.identities
WHERE provider = 'email'
UNION ALL
SELECT
  'profiles active count',
  COUNT(*)::text
FROM public.profiles
WHERE status = 'active';

SELECT
  p.id AS profile_id,
  p.email AS profile_email,
  p.role AS profile_role,
  p.status AS profile_status,
  u.id AS auth_user_id,
  u.email AS auth_email,
  u.aud,
  u.role AS auth_role,
  u.instance_id,
  u.encrypted_password IS NOT NULL AS has_password,
  u.email_confirmed_at IS NOT NULL AS email_confirmed,
  u.raw_app_meta_data,
  u.raw_user_meta_data,
  COUNT(i.user_id) FILTER (WHERE i.provider = 'email') AS email_identity_count,
  jsonb_agg(
    jsonb_build_object(
      'identity_id', i.id,
      'provider_id', i.provider_id,
      'provider', i.provider,
      'user_id', i.user_id,
      'identity_data', i.identity_data
    )
  ) FILTER (WHERE i.user_id IS NOT NULL) AS identities
FROM public.profiles p
LEFT JOIN auth.users u ON u.id = p.id
LEFT JOIN auth.identities i ON i.user_id = p.id
GROUP BY p.id, p.email, p.role, p.status, u.id, u.email, u.aud, u.role,
  u.instance_id, u.encrypted_password, u.email_confirmed_at,
  u.raw_app_meta_data, u.raw_user_meta_data
ORDER BY p.email;

SELECT
  u.id,
  u.email,
  CASE
    WHEN u.email IS NULL THEN 'auth.users.email is NULL'
    WHEN u.aud IS DISTINCT FROM 'authenticated' THEN 'auth.users.aud is not authenticated'
    WHEN u.role IS DISTINCT FROM 'authenticated' THEN 'auth.users.role is not authenticated'
    WHEN u.encrypted_password IS NULL THEN 'auth.users.encrypted_password is NULL'
    WHEN NOT EXISTS (
      SELECT 1 FROM auth.identities i
      WHERE i.user_id = u.id AND i.provider = 'email'
    ) THEN 'missing email identity'
    ELSE 'looks ok'
  END AS auth_row_status
FROM auth.users u
ORDER BY u.email;

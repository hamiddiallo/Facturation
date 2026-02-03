-- ========================================
-- ÉTAPE 2/3 : MIGRATION PROPRE VERS SUPABASE AUTH
-- ========================================
-- Ce script migre les utilisateurs de public.profiles vers auth.users
-- EN PRÉSERVANT LES IDs (critique pour les foreign keys)

-- S'assurer que pgcrypto est disponible
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Migration avec préservation des IDs
DO $$
DECLARE
  profile_record RECORD;
  temp_password TEXT := 'TempPass2026!'; -- Mot de passe temporaire
  v_encrypted_pw TEXT;
BEGIN
  -- Générer le hash une seule fois (plus efficace)
  v_encrypted_pw := crypt(temp_password, gen_salt('bf'));
  
  RAISE NOTICE '🔄 Début de la migration...';
  
  FOR profile_record IN 
    SELECT id, email, full_name, role, status
    FROM public.profiles 
    WHERE status = 'active'
    ORDER BY email
  LOOP
    BEGIN
      -- Créer dans auth.users avec LE MÊME ID que profiles
      INSERT INTO auth.users (
        id,                          -- ⚠️ CRITIQUE: Même ID que profiles
        instance_id,
        email,
        encrypted_password,
        email_confirmed_at,
        raw_user_meta_data,
        raw_app_meta_data,
        created_at,
        updated_at,
        confirmation_sent_at,
        aud,
        role
      ) VALUES (
        profile_record.id,           -- ✅ Préservation de l'ID
        '00000000-0000-0000-0000-000000000000',
        profile_record.email,
        v_encrypted_pw,              -- Hash bcrypt du mot de passe temporaire
        NOW(),                       -- Email confirmé immédiatement
        jsonb_build_object(
          'full_name', profile_record.full_name,
          'role', profile_record.role
        ),
        jsonb_build_object(
          'provider', 'email',
          'providers', ARRAY['email']
        ),
        NOW(),
        NOW(),
        NOW(),
        'authenticated',
        'authenticated'
      );
      
      RAISE NOTICE '✅ Migré: % (ID: %)', profile_record.email, profile_record.id;
      
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '❌ Échec pour %: %', profile_record.email, SQLERRM;
    END;
  END LOOP;
  
  RAISE NOTICE '🎉 Migration terminée!';
END $$;

-- Créer le trigger pour les FUTURS utilisateurs
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Insérer dans profiles avec le même ID que auth.users
  INSERT INTO public.profiles (
    id, 
    email, 
    full_name, 
    role, 
    status
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Utilisateur'),
    COALESCE(NEW.raw_user_meta_data->>'role', 'user'),
    'active'
  )
  ON CONFLICT (id) DO NOTHING; -- Ne rien faire si existe déjà
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attacher le trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Vérification finale
SELECT 
  (SELECT COUNT(*) FROM auth.users) as auth_users_count,
  (SELECT COUNT(*) FROM public.profiles WHERE status = 'active') as active_profiles_count,
  CASE 
    WHEN (SELECT COUNT(*) FROM auth.users) = (SELECT COUNT(*) FROM public.profiles WHERE status = 'active')
    THEN '✅ MIGRATION RÉUSSIE - Les comptes correspondent'
    ELSE '⚠️ ATTENTION - Nombre de comptes différent'
  END as status;

-- Afficher les utilisateurs migrés
SELECT 
  au.id,
  au.email,
  au.email_confirmed_at IS NOT NULL as email_confirmed,
  p.full_name,
  p.role
FROM auth.users au
JOIN public.profiles p ON au.id = p.id
ORDER BY au.email;

-- Instructions pour l'utilisateur
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════════';
  RAISE NOTICE '🎯 MIGRATION TERMINÉE !';
  RAISE NOTICE '═══════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE '📧 Tous les utilisateurs ont été migrés vers Supabase Auth';
  RAISE NOTICE '🔑 Mot de passe temporaire : TempPass2026!';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️ IMPORTANT : Vous devez maintenant :';
  RAISE NOTICE '1. Vous connecter avec votre email + TempPass2026!';
  RAISE NOTICE '2. Changer votre mot de passe via le Dashboard Supabase';
  RAISE NOTICE '   (Authentication > Users > Votre utilisateur > Reset Password)';
  RAISE NOTICE '';
  RAISE NOTICE '3. Exécuter le script 03_enable_rls_final.sql pour activer la sécurité';
  RAISE NOTICE '';
END $$;

-- ========================================
-- RESET BASE VIDE : AUTH + DONNEES INITIALES
-- ========================================
-- A executer dans le SQL Editor Supabase quand la base peut etre remise a plat.
-- Cree un admin Supabase Auth coherent + son profile public avec le meme UUID.
--
-- Identifiant temporaire :
-- email: hamid@gmail.com
-- password: TempPass2026!

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

BEGIN;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS tr_sync_role_to_auth ON public.profiles;

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL DEFAULT 'AUTH_MANAGED',
  full_name TEXT,
  role TEXT DEFAULT 'user' NOT NULL,
  status TEXT DEFAULT 'active',
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

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
  markup_percentage NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

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
  template_id TEXT DEFAULT 'template_standard',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.invoice_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE CASCADE NOT NULL,
  designation TEXT NOT NULL,
  quantity NUMERIC NOT NULL,
  unit TEXT,
  price NUMERIC NOT NULL,
  total_price NUMERIC NOT NULL
);

CREATE TABLE IF NOT EXISTS public.counters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,
  last_sequence INTEGER DEFAULT 0 NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

TRUNCATE TABLE public.invoice_items RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.invoices RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.companies RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.counters RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.profiles RESTART IDENTITY CASCADE;

DELETE FROM auth.identities;
DELETE FROM auth.sessions;
DELETE FROM auth.refresh_tokens;
DELETE FROM auth.users;

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

CREATE OR REPLACE FUNCTION public.sync_role_to_auth()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE auth.users
  SET
    raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', NEW.role),
    raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('role', NEW.role)
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER tr_sync_role_to_auth
  AFTER UPDATE OF role, status OR INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.sync_role_to_auth();

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'admin'
      AND status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

DO $$
DECLARE
  admin_id UUID := gen_random_uuid();
BEGIN
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
  VALUES (
    admin_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'hamid@gmail.com',
    crypt('TempPass2026!', gen_salt('bf')),
    NOW(),
    NOW(),
    jsonb_build_object(
      'provider', 'email',
      'providers', jsonb_build_array('email'),
      'role', 'admin'
    ),
    jsonb_build_object(
      'full_name', 'Hamid Admin',
      'role', 'admin',
      'email_verified', true
    ),
    NOW(),
    NOW(),
    false,
    false
  );

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
  VALUES (
    gen_random_uuid(),
    admin_id::text,
    admin_id,
    jsonb_build_object(
      'sub', admin_id::text,
      'email', 'hamid@gmail.com',
      'email_verified', true,
      'phone_verified', false
    ),
    'email',
    NOW(),
    NOW(),
    NOW()
  );

  INSERT INTO public.profiles (
    id,
    email,
    password_hash,
    full_name,
    role,
    status
  )
  VALUES (
    admin_id,
    'hamid@gmail.com',
    'AUTH_MANAGED',
    'Hamid Admin',
    'admin',
    'active'
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.companies (
    user_id,
    name,
    display_name,
    business_type,
    address,
    phone,
    email,
    markup_percentage
  )
  VALUES
    (
      admin_id,
      'ETS MLF',
      'ETS MLF',
      'COMMERCE GENERALE',
      'sise au grand marche central de labe',
      '(+224) 620 037 778',
      'mouctardh45@gmail.com',
      0
    ),
    (
      admin_id,
      'MOUCTAR & FRERES',
      'MOUCTAR & FRERES',
      'Commerce Generale',
      'sise au grand marche centrale de labe',
      '(+224) 620 037 778',
      'mouctardh45@gmail.com',
      0
    ),
    (
      admin_id,
      'LES BOUTIQUES THIERNODJO & FRERE',
      'LES BOUTIQUES THIERNODJO & FRERE',
      'Commerce Generale',
      'sise au grand marche centrale de labe',
      '622 227 115 / 626 121 245',
      '',
      15
    );
END $$;

INSERT INTO public.counters (name, last_sequence)
VALUES ('global', 0)
ON CONFLICT (name) DO UPDATE
SET last_sequence = EXCLUDED.last_sequence,
    updated_at = NOW();

CREATE INDEX IF NOT EXISTS idx_companies_user_id ON public.companies(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON public.invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_number ON public.invoices(number);
CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON public.invoices(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON public.invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- L'application utilise principalement le service role cote serveur.
-- On laisse la RLS desactivee ici pour repartir simple et stable.
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.counters DISABLE ROW LEVEL SECURITY;

COMMIT;

SELECT
  (SELECT COUNT(*) FROM public.profiles) AS profiles_count,
  (SELECT COUNT(*) FROM public.companies) AS companies_count,
  (SELECT COUNT(*) FROM auth.users) AS auth_users_count,
  (SELECT COUNT(*) FROM auth.identities WHERE provider = 'email') AS email_identities_count,
  (SELECT COUNT(*)
   FROM auth.users u
   WHERE u.email IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM auth.identities i
       WHERE i.user_id = u.id
         AND i.provider = 'email'
     )) AS missing_email_identities;

-- CostureiraPro · Prompt Mestre V3.43 · schema isolado costureirapro (hub cqirovvxtyreuvucosol)
-- Parte 1: identidade própria do app (accounts/profiles/licenses/sessions) + logs. BOOTSTRAP (1ª criação).
-- Os e-mails administradores da fábrica NÃO ficam no código: moram em costureirapro.factory_admins
-- (preenchida pela desenvolvedora) e/ou no secret ADMIN_EMAILS da Edge. Ao inserir um e-mail ali,
-- o gatilho cria a licença vitalícia obrigatória (regra §2 C · licenças da fábrica).

CREATE SCHEMA IF NOT EXISTS costureirapro;

CREATE OR REPLACE FUNCTION costureirapro.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, costureirapro AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS costureirapro.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS costureirapro.accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  password_hash text NOT NULL,
  full_name text,
  is_active boolean NOT NULL DEFAULT true,
  password_changed_at timestamptz,
  totp_secret_enc text,
  totp_enabled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS accounts_email_lower_idx ON costureirapro.accounts (lower(email));

CREATE TABLE IF NOT EXISTS costureirapro.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL UNIQUE REFERENCES costureirapro.accounts(id) ON DELETE RESTRICT,
  company_id uuid REFERENCES costureirapro.companies(id) ON DELETE RESTRICT,
  full_name text,
  email text,
  role text NOT NULL DEFAULT 'usuario' CHECK (role IN ('administrador','operador','usuario')),
  is_active boolean NOT NULL DEFAULT true,
  password_changed_at timestamptz,
  terms_accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Lista fechada de administradores da fábrica (regra 58). Sem acesso de anon/authenticated.
CREATE TABLE IF NOT EXISTS costureirapro.factory_admins (
  email text PRIMARY KEY CHECK (email = lower(trim(email))),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION costureirapro.is_factory_admin(p_email text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, costureirapro AS $$
  SELECT EXISTS (SELECT 1 FROM costureirapro.factory_admins f WHERE f.email = lower(trim(coalesce(p_email, ''))));
$$;
REVOKE ALL ON FUNCTION costureirapro.is_factory_admin(text) FROM PUBLIC, anon, authenticated;

-- Regra 58: DEFAULT não-admin + gatilho que só promove e-mail da lista fechada.
CREATE OR REPLACE FUNCTION costureirapro.enforce_profile_role()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, costureirapro AS $$
BEGIN
  IF costureirapro.is_factory_admin(NEW.email) THEN
    NEW.role := 'administrador';
  ELSIF NEW.role IS NULL OR NEW.role = 'administrador' THEN
    NEW.role := 'usuario';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS profiles_enforce_role ON costureirapro.profiles;
CREATE TRIGGER profiles_enforce_role BEFORE INSERT OR UPDATE ON costureirapro.profiles
  FOR EACH ROW EXECUTE FUNCTION costureirapro.enforce_profile_role();

CREATE TABLE IF NOT EXISTS costureirapro.licenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid REFERENCES costureirapro.accounts(id) ON DELETE RESTRICT,
  email text NOT NULL,
  buyer_email text,
  plan text NOT NULL DEFAULT 'vitalicia',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('trial','active','cancelled','expired')),
  source text NOT NULL DEFAULT 'manual',
  hotmart_txn_id text,
  notes text,
  started_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS licenses_email_lower_idx ON costureirapro.licenses (lower(email));
CREATE INDEX IF NOT EXISTS licenses_buyer_email_idx ON costureirapro.licenses (lower(buyer_email));
CREATE INDEX IF NOT EXISTS licenses_account_idx ON costureirapro.licenses (account_id) WHERE account_id IS NOT NULL;

-- Ao cadastrar um administrador da fábrica: cria a licença vitalícia (email = buyer_email), sem senha.
CREATE OR REPLACE FUNCTION costureirapro.factory_admin_license()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, costureirapro AS $$
BEGIN
  INSERT INTO costureirapro.licenses (email, buyer_email, status, plan, expires_at, source)
  SELECT NEW.email, NEW.email, 'active', 'vitalicia', NULL, 'fabrica'
  WHERE NOT EXISTS (
    SELECT 1 FROM costureirapro.licenses l
    WHERE lower(trim(l.email)) = NEW.email OR lower(trim(coalesce(l.buyer_email, ''))) = NEW.email
  );
  UPDATE costureirapro.profiles SET role = 'administrador' WHERE lower(trim(email)) = NEW.email;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS factory_admins_license ON costureirapro.factory_admins;
CREATE TRIGGER factory_admins_license AFTER INSERT ON costureirapro.factory_admins
  FOR EACH ROW EXECUTE FUNCTION costureirapro.factory_admin_license();

CREATE TABLE IF NOT EXISTS costureirapro.sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES costureirapro.accounts(id) ON DELETE RESTRICT,
  token_hash text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_activity_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  ip_hash text,
  user_agent_hash text
);
CREATE INDEX IF NOT EXISTS sessions_account_idx ON costureirapro.sessions (account_id);

CREATE TABLE IF NOT EXISTS costureirapro.login_attempts (
  email text PRIMARY KEY,
  failed_count integer NOT NULL DEFAULT 0,
  locked_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS costureirapro.registration_verifications (
  email text PRIMARY KEY,
  full_name text,
  terms_accepted_at timestamptz NOT NULL,
  token_hash text,
  expires_at timestamptz NOT NULL,
  verified_at timestamptz,
  failed_attempts integer NOT NULL DEFAULT 0,
  send_count integer NOT NULL DEFAULT 0,
  last_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS registration_verifications_token_hash_uidx
  ON costureirapro.registration_verifications (token_hash) WHERE token_hash IS NOT NULL;

CREATE TABLE IF NOT EXISTS costureirapro.password_change_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid REFERENCES costureirapro.accounts(id) ON DELETE RESTRICT,
  email text,
  source text NOT NULL DEFAULT 'alterar_senha',
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS costureirapro.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid,
  action text,
  screen text,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS costureirapro.error_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  screen text,
  message text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS costureirapro.hotmart_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key text NOT NULL UNIQUE,
  hotmart_event_id text,
  event_type text,
  transaction_id text,
  product_id text,
  buyer_email text,
  purchase_status text,
  outcome text,
  license_id uuid,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);
CREATE INDEX IF NOT EXISTS hotmart_events_txn_idx ON costureirapro.hotmart_events (transaction_id);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['companies','accounts','profiles','licenses'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I_updated_at ON costureirapro.%I', t, t);
    EXECUTE format('CREATE TRIGGER %I_updated_at BEFORE UPDATE ON costureirapro.%I FOR EACH ROW EXECUTE FUNCTION costureirapro.set_updated_at()', t, t);
  END LOOP;
  -- RLS ligado em todas as tabelas de auth/log, sem policy: só a Edge (service_role) acessa.
  FOREACH t IN ARRAY ARRAY['companies','accounts','profiles','licenses','sessions','login_attempts',
    'registration_verifications','password_change_log','audit_logs','error_logs','hotmart_events','factory_admins'] LOOP
    EXECUTE format('ALTER TABLE costureirapro.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON costureirapro.%I FROM PUBLIC, anon, authenticated', t);
    EXECUTE format('GRANT ALL ON costureirapro.%I TO service_role', t);
  END LOOP;
END $$;

-- Crachá de sessão (V3.33): token opaco no cabeçalho x-costureirapro-session. Sem JWT.
CREATE OR REPLACE FUNCTION costureirapro.session_account_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, costureirapro AS $$
  WITH cracha AS (
    SELECT nullif(trim(coalesce(
      nullif(current_setting('request.headers', true), '')::json ->> 'x-costureirapro-session', ''
    )), '') AS token
  )
  SELECT a.id
  FROM cracha c
  JOIN costureirapro.sessions s ON s.token_hash = encode(sha256(convert_to(c.token, 'UTF8')), 'hex')
  JOIN costureirapro.accounts a ON a.id = s.account_id
  JOIN costureirapro.profiles p ON p.account_id = a.id
  WHERE c.token IS NOT NULL
    AND s.revoked_at IS NULL
    AND s.expires_at > now()
    AND s.last_activity_at > now() - interval '30 minutes'
    AND a.is_active IS TRUE
    AND p.is_active IS TRUE
    AND p.terms_accepted_at IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM costureirapro.licenses l
      WHERE (lower(trim(l.email)) = lower(trim(a.email))
             OR lower(trim(coalesce(l.buyer_email, ''))) = lower(trim(a.email)))
        AND l.status IN ('active','trial')
        AND (l.expires_at IS NULL OR l.expires_at > now())
    )
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION costureirapro.session_account_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION costureirapro.session_account_id() TO anon, authenticated, service_role;

GRANT USAGE ON SCHEMA costureirapro TO anon, authenticated, service_role;

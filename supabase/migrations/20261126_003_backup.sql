-- CostureiraPro · Parte 3: backup por schema em TABELAS (regras 38 · 59 · 60).
-- costureirapro_backup NUNCA vai para Exposed schemas e não tem acesso de anon/authenticated.

CREATE SCHEMA IF NOT EXISTS costureirapro_backup;
REVOKE ALL ON SCHEMA costureirapro_backup FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA costureirapro_backup TO service_role;

CREATE TABLE IF NOT EXISTS costureirapro_backup.snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  note text,
  fingerprint text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS costureirapro_backup.snapshot_tables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id uuid NOT NULL REFERENCES costureirapro_backup.snapshots(id) ON DELETE RESTRICT,
  source_schema text NOT NULL,
  source_table text NOT NULL,
  backup_table text NOT NULL,
  row_count bigint NOT NULL DEFAULT 0
);

-- Impressão digital do conteúdo (sem sessões/tentativas/verificações, que mudam sem importância).
CREATE OR REPLACE FUNCTION costureirapro.schema_fingerprint()
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, costureirapro AS $$
DECLARE
  t record;
  part text;
  acc text := '';
BEGIN
  FOR t IN
    SELECT c.relname FROM pg_class c JOIN pg_namespace ns ON ns.oid = c.relnamespace
    WHERE ns.nspname = 'costureirapro' AND c.relkind = 'r'
      AND c.relname NOT IN ('sessions','login_attempts','registration_verifications')
    ORDER BY c.relname
  LOOP
    EXECUTE format('SELECT md5(coalesce(string_agg(x::text, %L ORDER BY x::text), %L)) FROM costureirapro.%I x',
                   E'\n', '', t.relname) INTO part;
    acc := acc || t.relname || ':' || part || ';';
  END LOOP;
  RETURN md5(acc);
END;
$$;

CREATE OR REPLACE FUNCTION costureirapro.snapshot_schema(p_label text DEFAULT 'manual')
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, costureirapro, costureirapro_backup AS $$
DECLARE
  snap_id uuid;
  t record;
  suffix text := to_char(clock_timestamp() AT TIME ZONE 'UTC', 'YYYYMMDD_HH24MISS');
  backup_name text;
  n bigint;
BEGIN
  INSERT INTO costureirapro_backup.snapshots(label, fingerprint)
  VALUES (coalesce(nullif(trim(p_label), ''), 'manual'), costureirapro.schema_fingerprint())
  RETURNING id INTO snap_id;

  FOR t IN
    SELECT c.relname FROM pg_class c JOIN pg_namespace ns ON ns.oid = c.relnamespace
    WHERE ns.nspname = 'costureirapro' AND c.relkind = 'r'
      AND c.relname NOT IN ('sessions','login_attempts','registration_verifications')
    ORDER BY c.relname
  LOOP
    backup_name := left(t.relname, 40) || '_' || suffix;
    IF to_regclass(format('costureirapro_backup.%I', backup_name)) IS NOT NULL THEN
      RAISE EXCEPTION 'Snapshot % já existe (dois snapshots no mesmo segundo). Tente de novo.', backup_name;
    END IF;
    EXECUTE format('CREATE TABLE costureirapro_backup.%I AS TABLE costureirapro.%I', backup_name, t.relname);
    EXECUTE format('REVOKE ALL ON costureirapro_backup.%I FROM PUBLIC, anon, authenticated', backup_name);
    EXECUTE format('SELECT count(*) FROM costureirapro_backup.%I', backup_name) INTO n;
    INSERT INTO costureirapro_backup.snapshot_tables(snapshot_id, source_schema, source_table, backup_table, row_count)
    VALUES (snap_id, 'costureirapro', t.relname, backup_name, n);
  END LOOP;
  RETURN snap_id;
END;
$$;

-- Cron 4x/dia: só cria snapshot se os dados mudaram desde o último.
CREATE OR REPLACE FUNCTION costureirapro.snapshot_if_changed(p_label text DEFAULT 'auto')
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, costureirapro, costureirapro_backup AS $$
DECLARE last_fp text;
BEGIN
  SELECT fingerprint INTO last_fp FROM costureirapro_backup.snapshots
  WHERE fingerprint IS NOT NULL ORDER BY created_at DESC LIMIT 1;
  IF last_fp IS NOT NULL AND last_fp = costureirapro.schema_fingerprint() THEN
    RETURN NULL;
  END IF;
  RETURN costureirapro.snapshot_schema(p_label);
END;
$$;

CREATE OR REPLACE FUNCTION costureirapro.purge_old_snapshots(p_days integer DEFAULT 7)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, costureirapro_backup AS $$
DECLARE r record; dropped integer := 0;
BEGIN
  IF p_days < 7 THEN RAISE EXCEPTION 'Retenção mínima de 7 dias.'; END IF;
  FOR r IN
    SELECT st.id, st.backup_table FROM costureirapro_backup.snapshot_tables st
    JOIN costureirapro_backup.snapshots s ON s.id = st.snapshot_id
    WHERE s.created_at < now() - make_interval(days => p_days)
  LOOP
    EXECUTE format('DROP TABLE IF EXISTS costureirapro_backup.%I', r.backup_table);
    DELETE FROM costureirapro_backup.snapshot_tables WHERE id = r.id;
    dropped := dropped + 1;
  END LOOP;
  DELETE FROM costureirapro_backup.snapshots s
  WHERE s.created_at < now() - make_interval(days => p_days)
    AND NOT EXISTS (SELECT 1 FROM costureirapro_backup.snapshot_tables st WHERE st.snapshot_id = s.id);
  RETURN dropped;
END;
$$;

CREATE OR REPLACE FUNCTION costureirapro.restore_table_from_snapshot(p_snapshot uuid, p_table text)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, costureirapro, costureirapro_backup AS $$
DECLARE src text; cols text; updates text; n bigint;
BEGIN
  SELECT backup_table INTO src FROM costureirapro_backup.snapshot_tables
  WHERE snapshot_id = p_snapshot AND source_schema = 'costureirapro' AND source_table = p_table;
  IF src IS NULL THEN RAISE EXCEPTION 'Tabela % não está no snapshot %.', p_table, p_snapshot; END IF;

  SELECT string_agg(format('%I', a.column_name), ', ' ORDER BY a.ordinal_position),
         string_agg(format('%1$I = EXCLUDED.%1$I', a.column_name), ', ' ORDER BY a.ordinal_position)
           FILTER (WHERE a.column_name <> 'id')
  INTO cols, updates
  FROM information_schema.columns a
  JOIN information_schema.columns b
    ON b.table_schema = 'costureirapro_backup' AND b.table_name = src AND b.column_name = a.column_name
  WHERE a.table_schema = 'costureirapro' AND a.table_name = p_table;

  EXECUTE format('INSERT INTO costureirapro.%I (%s) SELECT %s FROM costureirapro_backup.%I ON CONFLICT (id) DO UPDATE SET %s',
                 p_table, cols, cols, src, updates);
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

-- Ordem respeita as chaves (pai antes do filho).
CREATE OR REPLACE FUNCTION costureirapro.restore_business_from_snapshot(p_snapshot uuid)
RETURNS TABLE(tabela text, linhas bigint) LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, costureirapro, costureirapro_backup AS $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['clientes','medidas','servicos','ordens','ordem_itens','produtos','compras',
                           'movimentos_estoque','lancamentos','compromissos','preferencias','envios_whatsapp'] LOOP
    tabela := t;
    linhas := costureirapro.restore_table_from_snapshot(p_snapshot, t);
    RETURN NEXT;
  END LOOP;
END;
$$;

DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY['schema_fingerprint()','snapshot_schema(text)','snapshot_if_changed(text)',
                           'purge_old_snapshots(integer)','restore_table_from_snapshot(uuid,text)',
                           'restore_business_from_snapshot(uuid)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION costureirapro.%s FROM PUBLIC, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION costureirapro.%s TO service_role', f);
  END LOOP;
END $$;
GRANT ALL ON ALL TABLES IN SCHEMA costureirapro_backup TO service_role;

-- 02h · 08h · 14h · 20h (Cuiabá) = 0 0,6,12,18 UTC · limpeza 1×/dia (7 dias).
SELECT cron.schedule('costureirapro_snapshot_4x', '0 0,6,12,18 * * *', $$SELECT costureirapro.snapshot_if_changed('auto');$$);
SELECT cron.schedule('costureirapro_purge_snapshots', '45 6 * * *', $$SELECT costureirapro.purge_old_snapshots(7);$$);

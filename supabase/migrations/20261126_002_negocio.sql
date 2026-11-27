-- CostureiraPro · Parte 2: tabelas de negócio. Toda tabela tem account_id obrigatório (FK accounts)
-- e RLS pelo crachá de sessão: account_id = (SELECT costureirapro.session_account_id()).
-- Registros filhos só aceitam pai (cliente, costura, produto, compra) da mesma conta.

-- Clientes da costureira
CREATE TABLE IF NOT EXISTS costureirapro.clientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES costureirapro.accounts(id) ON DELETE RESTRICT,
  company_id uuid REFERENCES costureirapro.companies(id) ON DELETE RESTRICT,
  nome_completo text NOT NULL CHECK (length(trim(nome_completo)) > 0),
  cpf text CHECK (cpf IS NULL OR cpf ~ '^[0-9]{11}$'),
  telefone text,
  email text,
  data_nascimento date,
  cep text,
  endereco text,
  bairro text,
  cidade text,
  uf text,
  como_conheceu text,
  observacoes text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS clientes_cpf_conta_uidx ON costureirapro.clientes (account_id, cpf) WHERE cpf IS NOT NULL;
CREATE INDEX IF NOT EXISTS clientes_conta_idx ON costureirapro.clientes (account_id, nome_completo);

-- Ficha de medidas (cm)
CREATE TABLE IF NOT EXISTS costureirapro.medidas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES costureirapro.accounts(id) ON DELETE RESTRICT,
  cliente_id uuid NOT NULL REFERENCES costureirapro.clientes(id) ON DELETE CASCADE,
  data_medida date NOT NULL DEFAULT current_date,
  busto numeric(6,1), cintura numeric(6,1), quadril numeric(6,1), ombro numeric(6,1),
  pescoco numeric(6,1), braco numeric(6,1), manga numeric(6,1), comprimento_blusa numeric(6,1),
  comprimento_saia numeric(6,1), comprimento_calca numeric(6,1), gancho numeric(6,1),
  coxa numeric(6,1), joelho numeric(6,1), barra numeric(6,1),
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS medidas_cliente_idx ON costureirapro.medidas (cliente_id);

-- Tabela de preços dos serviços
CREATE TABLE IF NOT EXISTS costureirapro.servicos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES costureirapro.accounts(id) ON DELETE RESTRICT,
  nome text NOT NULL CHECK (length(trim(nome)) > 0),
  tipo_servico text NOT NULL DEFAULT 'Ajuste',
  tipo_peca text,
  preco numeric(12,2) NOT NULL DEFAULT 0 CHECK (preco >= 0),
  prazo_dias integer NOT NULL DEFAULT 7 CHECK (prazo_dias >= 0),
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Costuras recebidas (ordem de serviço)
CREATE TABLE IF NOT EXISTS costureirapro.ordens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES costureirapro.accounts(id) ON DELETE RESTRICT,
  numero integer NOT NULL,
  cliente_id uuid NOT NULL REFERENCES costureirapro.clientes(id) ON DELETE RESTRICT,
  data_recebimento date NOT NULL DEFAULT current_date,
  data_prova date,
  data_entrega date NOT NULL,
  hora_entrega time,
  data_entregue date,
  status text NOT NULL DEFAULT 'recebida'
    CHECK (status IN ('recebida','em_andamento','aguardando_prova','pronta','entregue','cancelada')),
  urgente boolean NOT NULL DEFAULT false,
  desconto numeric(12,2) NOT NULL DEFAULT 0 CHECK (desconto >= 0),
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, numero)
);
CREATE INDEX IF NOT EXISTS ordens_conta_entrega_idx ON costureirapro.ordens (account_id, data_entrega);
CREATE INDEX IF NOT EXISTS ordens_cliente_idx ON costureirapro.ordens (cliente_id);

CREATE OR REPLACE FUNCTION costureirapro.ordens_numero()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, costureirapro AS $$
BEGIN
  IF NEW.numero IS NULL OR NEW.numero <= 0 THEN
    PERFORM pg_advisory_xact_lock(hashtext('costureirapro.ordens:' || NEW.account_id::text));
    SELECT coalesce(max(numero), 0) + 1 INTO NEW.numero FROM costureirapro.ordens WHERE account_id = NEW.account_id;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS ordens_numero_trg ON costureirapro.ordens;
CREATE TRIGGER ordens_numero_trg BEFORE INSERT ON costureirapro.ordens
  FOR EACH ROW EXECUTE FUNCTION costureirapro.ordens_numero();

-- Peças de cada costura e o que modificar
CREATE TABLE IF NOT EXISTS costureirapro.ordem_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES costureirapro.accounts(id) ON DELETE RESTRICT,
  ordem_id uuid NOT NULL REFERENCES costureirapro.ordens(id) ON DELETE CASCADE,
  tipo_peca text NOT NULL,
  tipo_servico text NOT NULL DEFAULT 'Ajuste',
  descricao text,
  cor text,
  quantidade integer NOT NULL DEFAULT 1 CHECK (quantidade > 0),
  valor_unitario numeric(12,2) NOT NULL DEFAULT 0 CHECK (valor_unitario >= 0),
  concluido boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ordem_itens_ordem_idx ON costureirapro.ordem_itens (ordem_id);

-- Estoque: linha, agulha, óleo, zíper, botão…
CREATE TABLE IF NOT EXISTS costureirapro.produtos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES costureirapro.accounts(id) ON DELETE RESTRICT,
  nome text NOT NULL CHECK (length(trim(nome)) > 0),
  categoria text NOT NULL DEFAULT 'Outros',
  unidade text NOT NULL DEFAULT 'un',
  cor text,
  estoque_atual numeric(12,3) NOT NULL DEFAULT 0,
  estoque_minimo numeric(12,3) NOT NULL DEFAULT 0 CHECK (estoque_minimo >= 0),
  custo_medio numeric(12,2) NOT NULL DEFAULT 0 CHECK (custo_medio >= 0),
  ativo boolean NOT NULL DEFAULT true,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Compras de produtos (cabeçalho). Os itens entram como movimentos de estoque.
CREATE TABLE IF NOT EXISTS costureirapro.compras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES costureirapro.accounts(id) ON DELETE RESTRICT,
  fornecedor text,
  data_compra date NOT NULL DEFAULT current_date,
  valor_total numeric(12,2) NOT NULL DEFAULT 0 CHECK (valor_total >= 0),
  forma_pagamento text,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS costureirapro.movimentos_estoque (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES costureirapro.accounts(id) ON DELETE RESTRICT,
  produto_id uuid NOT NULL REFERENCES costureirapro.produtos(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('entrada','saida','ajuste')),
  quantidade numeric(12,3) NOT NULL CHECK (quantidade <> 0),
  custo_unitario numeric(12,2) CHECK (custo_unitario IS NULL OR custo_unitario >= 0),
  data_movimento date NOT NULL DEFAULT current_date,
  compra_id uuid REFERENCES costureirapro.compras(id) ON DELETE CASCADE,
  ordem_id uuid REFERENCES costureirapro.ordens(id) ON DELETE SET NULL,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS movimentos_produto_idx ON costureirapro.movimentos_estoque (produto_id);

-- Estoque atual = soma dos movimentos (entrada +, saída −, ajuste com sinal).
CREATE OR REPLACE FUNCTION costureirapro.movimento_delta(p_tipo text, p_qtd numeric)
RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_tipo WHEN 'saida' THEN -abs(p_qtd) WHEN 'entrada' THEN abs(p_qtd) ELSE p_qtd END;
$$;

CREATE OR REPLACE FUNCTION costureirapro.movimentos_estoque_sync()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, costureirapro AS $$
BEGIN
  IF TG_OP IN ('UPDATE','DELETE') THEN
    UPDATE costureirapro.produtos
       SET estoque_atual = estoque_atual - costureirapro.movimento_delta(OLD.tipo, OLD.quantidade), updated_at = now()
     WHERE id = OLD.produto_id AND account_id = OLD.account_id;
  END IF;
  IF TG_OP IN ('INSERT','UPDATE') THEN
    UPDATE costureirapro.produtos p
       SET estoque_atual = p.estoque_atual + costureirapro.movimento_delta(NEW.tipo, NEW.quantidade),
           custo_medio = CASE
             WHEN NEW.tipo = 'entrada' AND coalesce(NEW.custo_unitario, 0) > 0 THEN
               round(((greatest(p.estoque_atual, 0) * p.custo_medio) + (abs(NEW.quantidade) * NEW.custo_unitario))
                     / nullif(greatest(p.estoque_atual, 0) + abs(NEW.quantidade), 0), 2)
             ELSE p.custo_medio END,
           updated_at = now()
     WHERE p.id = NEW.produto_id AND p.account_id = NEW.account_id;
    RETURN NEW;
  END IF;
  RETURN OLD;
END;
$$;
DROP TRIGGER IF EXISTS movimentos_estoque_sync_trg ON costureirapro.movimentos_estoque;
CREATE TRIGGER movimentos_estoque_sync_trg AFTER INSERT OR UPDATE OR DELETE ON costureirapro.movimentos_estoque
  FOR EACH ROW EXECUTE FUNCTION costureirapro.movimentos_estoque_sync();

-- Caixa: entradas e saídas, pagas ou agendadas (a receber / a pagar)
CREATE TABLE IF NOT EXISTS costureirapro.lancamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES costureirapro.accounts(id) ON DELETE RESTRICT,
  tipo text NOT NULL CHECK (tipo IN ('entrada','saida')),
  status text NOT NULL DEFAULT 'pago' CHECK (status IN ('pago','pendente')),
  categoria text NOT NULL DEFAULT 'Outros',
  descricao text NOT NULL CHECK (length(trim(descricao)) > 0),
  valor numeric(12,2) NOT NULL CHECK (valor > 0),
  data_lancamento date NOT NULL DEFAULT current_date,
  data_vencimento date,
  forma_pagamento text,
  cliente_id uuid REFERENCES costureirapro.clientes(id) ON DELETE SET NULL,
  ordem_id uuid REFERENCES costureirapro.ordens(id) ON DELETE SET NULL,
  compra_id uuid REFERENCES costureirapro.compras(id) ON DELETE CASCADE,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS lancamentos_conta_data_idx ON costureirapro.lancamentos (account_id, data_lancamento);
CREATE INDEX IF NOT EXISTS lancamentos_ordem_idx ON costureirapro.lancamentos (ordem_id);

-- Agenda: compromissos, provas, entregas, compras, pagamentos
CREATE TABLE IF NOT EXISTS costureirapro.compromissos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES costureirapro.accounts(id) ON DELETE RESTRICT,
  titulo text NOT NULL CHECK (length(trim(titulo)) > 0),
  tipo text NOT NULL DEFAULT 'Compromisso',
  data_compromisso date NOT NULL,
  hora_inicio time,
  hora_fim time,
  local text,
  cliente_id uuid REFERENCES costureirapro.clientes(id) ON DELETE SET NULL,
  ordem_id uuid REFERENCES costureirapro.ordens(id) ON DELETE SET NULL,
  observacoes text,
  concluido boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS compromissos_conta_data_idx ON costureirapro.compromissos (account_id, data_compromisso);

-- Dados do ateliê e modelos de mensagem do WhatsApp (1 linha por conta)
CREATE TABLE IF NOT EXISTS costureirapro.preferencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL UNIQUE REFERENCES costureirapro.accounts(id) ON DELETE RESTRICT,
  nome_atelie text,
  telefone_atelie text,
  endereco_atelie text,
  chave_pix text,
  prazo_padrao_dias integer NOT NULL DEFAULT 7 CHECK (prazo_padrao_dias BETWEEN 0 AND 365),
  msg_pronta text,
  msg_lembrete text,
  msg_cobranca text,
  msg_prova text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Histórico de mensagens de WhatsApp abertas pelo app
CREATE TABLE IF NOT EXISTS costureirapro.envios_whatsapp (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES costureirapro.accounts(id) ON DELETE RESTRICT,
  cliente_id uuid REFERENCES costureirapro.clientes(id) ON DELETE SET NULL,
  ordem_id uuid REFERENCES costureirapro.ordens(id) ON DELETE SET NULL,
  tipo text NOT NULL,
  mensagem text NOT NULL,
  enviado_em timestamptz NOT NULL DEFAULT now()
);

-- Resumo das costuras com total, pago e saldo (view com security_invoker: respeita o RLS).
CREATE OR REPLACE VIEW costureirapro.ordens_resumo WITH (security_invoker = true) AS
SELECT o.id, o.account_id, o.numero, o.cliente_id, c.nome_completo AS cliente_nome, c.telefone AS cliente_telefone,
       c.bairro AS cliente_bairro, c.cidade AS cliente_cidade,
       o.data_recebimento, o.data_prova, o.data_entrega, o.hora_entrega, o.data_entregue, o.status, o.urgente,
       o.desconto, o.observacoes, o.created_at, o.updated_at,
       coalesce(i.qtd_pecas, 0)::integer AS qtd_pecas,
       coalesce(i.total_itens, 0)::numeric(12,2) AS total_itens,
       greatest(coalesce(i.total_itens, 0) - o.desconto, 0)::numeric(12,2) AS valor_total,
       coalesce(p.pago, 0)::numeric(12,2) AS valor_pago,
       greatest(greatest(coalesce(i.total_itens, 0) - o.desconto, 0) - coalesce(p.pago, 0), 0)::numeric(12,2) AS saldo,
       i.resumo_pecas
FROM costureirapro.ordens o
JOIN costureirapro.clientes c ON c.id = o.cliente_id
LEFT JOIN LATERAL (
  SELECT sum(oi.quantidade) AS qtd_pecas, sum(oi.quantidade * oi.valor_unitario) AS total_itens,
         string_agg(oi.quantidade || 'x ' || oi.tipo_peca || ' (' || oi.tipo_servico || ')', ', ' ORDER BY oi.created_at) AS resumo_pecas
  FROM costureirapro.ordem_itens oi WHERE oi.ordem_id = o.id
) i ON true
LEFT JOIN LATERAL (
  SELECT sum(l.valor) AS pago FROM costureirapro.lancamentos l
  WHERE l.ordem_id = o.id AND l.tipo = 'entrada' AND l.status = 'pago'
) p ON true;

-- updated_at
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['clientes','medidas','servicos','ordens','ordem_itens','produtos','compras',
                           'lancamentos','compromissos','preferencias'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I_updated_at ON costureirapro.%I', t, t);
    EXECUTE format('CREATE TRIGGER %I_updated_at BEFORE UPDATE ON costureirapro.%I FOR EACH ROW EXECUTE FUNCTION costureirapro.set_updated_at()', t, t);
  END LOOP;
END $$;

-- RLS + permissões (anon só SELECT/INSERT/UPDATE/DELETE; sem TRUNCATE/REFERENCES/TRIGGER)
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['clientes','medidas','servicos','ordens','ordem_itens','produtos','compras',
                           'movimentos_estoque','lancamentos','compromissos','preferencias','envios_whatsapp'] LOOP
    EXECUTE format('ALTER TABLE costureirapro.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON costureirapro.%I FROM PUBLIC, anon, authenticated', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON costureirapro.%I TO anon', t);
    EXECUTE format('GRANT ALL ON costureirapro.%I TO service_role', t);
    EXECUTE format('DROP POLICY IF EXISTS cracha_dono ON costureirapro.%I', t);
  END LOOP;
END $$;

CREATE POLICY cracha_dono ON costureirapro.clientes FOR ALL TO anon
  USING (account_id = (SELECT costureirapro.session_account_id()))
  WITH CHECK (account_id = (SELECT costureirapro.session_account_id()));

CREATE POLICY cracha_dono ON costureirapro.servicos FOR ALL TO anon
  USING (account_id = (SELECT costureirapro.session_account_id()))
  WITH CHECK (account_id = (SELECT costureirapro.session_account_id()));

CREATE POLICY cracha_dono ON costureirapro.produtos FOR ALL TO anon
  USING (account_id = (SELECT costureirapro.session_account_id()))
  WITH CHECK (account_id = (SELECT costureirapro.session_account_id()));

CREATE POLICY cracha_dono ON costureirapro.compras FOR ALL TO anon
  USING (account_id = (SELECT costureirapro.session_account_id()))
  WITH CHECK (account_id = (SELECT costureirapro.session_account_id()));

CREATE POLICY cracha_dono ON costureirapro.preferencias FOR ALL TO anon
  USING (account_id = (SELECT costureirapro.session_account_id()))
  WITH CHECK (account_id = (SELECT costureirapro.session_account_id()));

CREATE POLICY cracha_dono ON costureirapro.medidas FOR ALL TO anon
  USING (account_id = (SELECT costureirapro.session_account_id()))
  WITH CHECK (account_id = (SELECT costureirapro.session_account_id())
    AND EXISTS (SELECT 1 FROM costureirapro.clientes c WHERE c.id = cliente_id AND c.account_id = medidas.account_id));

CREATE POLICY cracha_dono ON costureirapro.ordens FOR ALL TO anon
  USING (account_id = (SELECT costureirapro.session_account_id()))
  WITH CHECK (account_id = (SELECT costureirapro.session_account_id())
    AND EXISTS (SELECT 1 FROM costureirapro.clientes c WHERE c.id = cliente_id AND c.account_id = ordens.account_id));

CREATE POLICY cracha_dono ON costureirapro.ordem_itens FOR ALL TO anon
  USING (account_id = (SELECT costureirapro.session_account_id()))
  WITH CHECK (account_id = (SELECT costureirapro.session_account_id())
    AND EXISTS (SELECT 1 FROM costureirapro.ordens o WHERE o.id = ordem_id AND o.account_id = ordem_itens.account_id));

CREATE POLICY cracha_dono ON costureirapro.movimentos_estoque FOR ALL TO anon
  USING (account_id = (SELECT costureirapro.session_account_id()))
  WITH CHECK (account_id = (SELECT costureirapro.session_account_id())
    AND EXISTS (SELECT 1 FROM costureirapro.produtos p WHERE p.id = produto_id AND p.account_id = movimentos_estoque.account_id)
    AND (compra_id IS NULL OR EXISTS (SELECT 1 FROM costureirapro.compras x WHERE x.id = compra_id AND x.account_id = movimentos_estoque.account_id))
    AND (ordem_id IS NULL OR EXISTS (SELECT 1 FROM costureirapro.ordens o WHERE o.id = ordem_id AND o.account_id = movimentos_estoque.account_id)));

CREATE POLICY cracha_dono ON costureirapro.lancamentos FOR ALL TO anon
  USING (account_id = (SELECT costureirapro.session_account_id()))
  WITH CHECK (account_id = (SELECT costureirapro.session_account_id())
    AND (cliente_id IS NULL OR EXISTS (SELECT 1 FROM costureirapro.clientes c WHERE c.id = cliente_id AND c.account_id = lancamentos.account_id))
    AND (ordem_id IS NULL OR EXISTS (SELECT 1 FROM costureirapro.ordens o WHERE o.id = ordem_id AND o.account_id = lancamentos.account_id))
    AND (compra_id IS NULL OR EXISTS (SELECT 1 FROM costureirapro.compras x WHERE x.id = compra_id AND x.account_id = lancamentos.account_id)));

CREATE POLICY cracha_dono ON costureirapro.compromissos FOR ALL TO anon
  USING (account_id = (SELECT costureirapro.session_account_id()))
  WITH CHECK (account_id = (SELECT costureirapro.session_account_id())
    AND (cliente_id IS NULL OR EXISTS (SELECT 1 FROM costureirapro.clientes c WHERE c.id = cliente_id AND c.account_id = compromissos.account_id))
    AND (ordem_id IS NULL OR EXISTS (SELECT 1 FROM costureirapro.ordens o WHERE o.id = ordem_id AND o.account_id = compromissos.account_id)));

CREATE POLICY cracha_dono ON costureirapro.envios_whatsapp FOR ALL TO anon
  USING (account_id = (SELECT costureirapro.session_account_id()))
  WITH CHECK (account_id = (SELECT costureirapro.session_account_id())
    AND (cliente_id IS NULL OR EXISTS (SELECT 1 FROM costureirapro.clientes c WHERE c.id = cliente_id AND c.account_id = envios_whatsapp.account_id))
    AND (ordem_id IS NULL OR EXISTS (SELECT 1 FROM costureirapro.ordens o WHERE o.id = ordem_id AND o.account_id = envios_whatsapp.account_id)));

REVOKE ALL ON costureirapro.ordens_resumo FROM PUBLIC, anon, authenticated;
GRANT SELECT ON costureirapro.ordens_resumo TO anon, service_role;

-- Funções internas não ficam abertas ao público
REVOKE ALL ON FUNCTION costureirapro.ordens_numero() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION costureirapro.movimentos_estoque_sync() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION costureirapro.enforce_profile_role() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION costureirapro.factory_admin_license() FROM PUBLIC, anon, authenticated;

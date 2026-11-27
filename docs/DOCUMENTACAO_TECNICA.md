# 📘 DOCUMENTAÇÃO TÉCNICA — CostureiraPro
## PlanilhaProfissional.com

**Soluções Digitais Inteligentes**

> **Você apresenta a necessidade. Nós encontramos a solução.**

---

# CONTROLE DO DOCUMENTO

| Campo | Informação |
|---|---|
| Projeto | CostureiraPro |
| Produto | CostureiraPro — app de controle para costureiras e ateliês |
| Código | `costureirapro` |
| Versão | `v0.1.2` |
| Status | Produção |
| Data de criação | 26/11/2026 |
| Última atualização | 26/11/2026 |
| Responsável | PlanilhaProfissional.com |
| Empresa | PlanilhaProfissional.com |
| Repositório | https://github.com/planilhaprofissionalmba/costureirapro |
| Ambiente Produção | https://costureirapro.planilhaprofissional.com |
| Ambiente Homologação | Previews da Vercel (`costureirapro-*.vercel.app`) e https://costureirapro.vercel.app |
| Padrão de construção | Prompt Mestre V3.43 (Fábrica de Apps Planilha Profissional) |

---

# SUMÁRIO

1. Visão Geral
2. Objetivos
3. Escopo
4. Stakeholders e Responsabilidades
5. Requisitos
6. Regras de Negócio
7. Arquitetura
8. Stack Tecnológica
9. Estrutura do Projeto
10. Banco de Dados
11. Modelo de Dados
12. APIs e Integrações
13. Autenticação e Autorização
14. Segurança
15. LGPD e Privacidade
16. Interface e Experiência do Usuário
17. Funcionalidades
18. Fluxos do Sistema
19. Tratamento de Erros
20. Logs e Monitoramento
21. Testes
22. Ambientes
23. Variáveis de Ambiente
24. Instalação e Configuração
25. Deploy
26. CI/CD
27. Backup e Recuperação
28. Manutenção
29. Dependências
30. Performance
31. Acessibilidade
32. Changelog
33. Roadmap
34. Riscos e Decisões Técnicas
35. Glossário
36. Checklist de Entrega

---

# 01. VISÃO GERAL

## 1.1 Descrição

App web instalável (PWA), pensado para uso no **celular**, que organiza o dia a dia de uma costureira: agenda, costuras recebidas (peças e ajustes), clientes com CPF, estoque de materiais, compras, caixa, pendências, mensagens de WhatsApp e painel com gráficos.

## 1.2 Problema que o sistema resolve

A costureira controla as peças em caderno, papel preso na roupa e conversas soltas no WhatsApp. Por isso perde prazos de entrega, esquece quem não pagou, cadastra a mesma cliente duas vezes e não sabe quanto entrou e saiu no mês.

## 1.3 Solução proposta

Um único app, simples para quem não entende de tecnologia:
- cada costura é registrada com as peças, o que modificar, o valor e a data de entrega;
- a agenda mostra o que entregar e o que provar;
- o caixa e as pendências mostram o dinheiro;
- o WhatsApp avisa a cliente com um toque.

Os dados ficam no banco na nuvem e funcionam igual no celular e no computador.

## 1.4 Público-alvo

Costureiras autônomas, MEI e pequenos ateliês de ajuste, reforma e confecção.

## 1.5 Tipo de produto

- [x] Aplicação Web
- [x] PWA
- [x] SaaS (licença por e-mail; venda pela Hotmart)
- [x] Dashboard (Painel)
- [x] Site (landing de venda)
- [ ] API
- [ ] Sistema interno
- [ ] Aplicativo nativo
- [ ] Planilha automatizada

---

# 02. OBJETIVOS

## 2.1 Objetivo principal

Dar à costureira controle total de prazos, clientes, materiais e dinheiro, no celular e sem complicação.

## 2.2 Objetivos específicos

- Nunca perder uma data de entrega (agenda, filtros "Atrasadas" e "Entregar em 7 dias").
- Evitar cliente duplicada (CPF obrigatório, validado e único por conta).
- Saber quem não pagou e cobrar pelo WhatsApp com a chave Pix.
- Controlar o estoque de linha, agulha, óleo e outros materiais, com alerta de mínimo.
- Ver no Painel de onde vêm as clientes, as 10 maiores clientes e as peças que mais chegam.

## 2.3 Indicadores de sucesso

| Indicador | Meta | Forma de medição |
|---|---:|---|
| Costuras entregues no prazo | ≥ 95% | Costuras entregues × `data_entrega` |
| Pendências vencidas | Queda mês a mês | Tela Pendências / `lancamentos` com status pendente |
| Clientes duplicadas | 0 | Índice único `(account_id, cpf)` |
| Erros registrados | 0 críticos | `costureirapro.error_logs` |

---

# 03. ESCOPO

## 3.1 Incluído no projeto

- Agenda de compromissos, entregas, provas e costuras agendadas.
- Costuras (ordens) com peças, serviço, o que modificar, valor, sinal, prova, situação e recibo.
- Clientes com nome completo, telefone, e-mail, **CPF obrigatório**, CEP automático, medidas e histórico.
- Importar contato do celular ou WhatsApp (Contact Picker, vCard ou texto colado).
- Tabela de preços (serviços).
- Estoque, compras e uso de materiais.
- Caixa (entradas e saídas), pendências a receber e a pagar.
- Mensagens de WhatsApp (pronta, lembrete, prova, cobrança e aniversário).
- Painel com indicadores e gráficos.
- Administração de acessos, Termos de Uso e LGPD.
- Landing de venda (De R$ 427 por R$ 347).
- Comece Aqui e Guia do Usuário.
- Backup automático 4 vezes ao dia.

## 3.2 Fora do escopo

- Emissão de nota fiscal.
- Envio automático de WhatsApp sem toque da usuária (o app abre o WhatsApp com o texto pronto).
- App nativo para lojas (Play Store e App Store).
- Integração Hotmart ativa (fica para depois; o webhook já está escrito).

## 3.3 Premissas

- Cada compradora usa o app com o e-mail da compra (licença por e-mail).
- O schema `costureirapro` já está exposto na Data API do hub.
- A usuária tem WhatsApp instalado no aparelho.

## 3.4 Restrições

- Hub Supabase único (`cqirovvxtyreuvucosol`), compartilhado com outros apps: **proibido** alterar outros schemas ou a lista de schemas expostos.
- Nada no schema `public`.
- Fonte Tahoma e paleta Papel (Prompt Mestre).
- Sem JWT do Supabase Auth: a sessão é um crachá próprio do app.

---

# 04. STAKEHOLDERS E RESPONSABILIDADES

| Papel | Responsável | Responsabilidade |
|---|---|---|
| Product Owner | PlanilhaProfissional.com | Define requisitos, aprova entregas e libera acessos |
| Desenvolvimento | PlanilhaProfissional.com (com Claude) | Código, banco, Edge Functions, deploy |
| Design | PlanilhaProfissional.com | Paleta Papel, Tahoma, padrão do Prompt Mestre |
| Infraestrutura | PlanilhaProfissional.com | Supabase hub, Vercel, domínio, Resend |
| Suporte | suporte@planilhaprofissional.com · WhatsApp +55 66 99238-8026 | Atendimento às compradoras |

---

# 05. REQUISITOS

## 5.1 Requisitos Funcionais

### RF001 – Cadastrar cliente
**Descrição:** cadastro com nome completo, telefone, e-mail, CPF, endereço, medidas e observações.
**Entrada:** dados digitados ou importados de um contato do celular.
**Processamento:** valida o CPF (dígitos verificadores), busca o endereço pelo CEP (ViaCEP) e grava em `clientes` com o `account_id` da sessão.
**Saída:** cliente salva; se o CPF já existir na conta, aparece a mensagem de duplicidade.

### RF002 – Receber costura
**Descrição:** registrar a peça que chegou e o que deve ser feito.
**Entrada:** cliente, peças (tipo, serviço, o que modificar, valor), data e hora de entrega, prova, sinal, urgência.
**Processamento:** grava em `ordens` e `ordem_itens`; o número sequencial é gerado por gatilho; o sinal vira lançamento de entrada no caixa.
**Saída:** costura na lista, na agenda e no recibo.

### RF003 – Editar e excluir costura
**Descrição:** na lista de Costuras, cada linha tem os botões **Editar** (lápis) e **Excluir** (lixeira).
**Processamento:** excluir pede confirmação, apaga a costura e as peças (`ON DELETE CASCADE`); os pagamentos ficam no caixa, sem ligação (`ON DELETE SET NULL`).
**Saída:** lista atualizada e aviso "Costura excluída."

### RF003A – Entregar costura com conferência do pagamento
**Descrição:** botão ✓ (Entregar e receber) na lista de Costuras e situação "Entregue" no formulário abrem a janela de entrega.
**Entrada:** valor recebido agora, forma de pagamento, caixinha "Conferi o pagamento"; se faltar dinheiro, "A cliente vai pagar depois" + data.
**Processamento:** marca como pagos os recebimentos agendados conferidos; grava a entrada paga em `lancamentos` (ligada à costura e à cliente); o restante vira lançamento pendente com vencimento; atualiza `ordens.status = 'entregue'` e `data_entregue = hoje`.
**Saída:** costura baixada, Caixa e Pendências atualizados. Sem receber tudo e sem marcar "vai pagar depois", a entrega é bloqueada.

### RF004 – Avisar cliente pelo WhatsApp
**Descrição:** abre o WhatsApp com a mensagem montada (pronta, lembrete, prova ou cobrança com Pix).
**Processamento:** registra o envio em `envios_whatsapp` e **fecha a janela de envio** assim que o WhatsApp abre.
**Saída:** conversa aberta no WhatsApp com o texto pronto.

### RF005 – Estoque e compras
**Descrição:** entrada, uso e ajuste de materiais; compras que sobem o estoque e lançam a saída no caixa.
**Processamento:** gatilho `movimentos_estoque_sync` atualiza `estoque_atual` e o custo médio ponderado.
**Saída:** estoque atualizado e alerta quando fica abaixo do mínimo.

### RF006 – Caixa e pendências
**Descrição:** entradas e saídas por mês; contas a receber e a pagar com vencimento.
**Saída:** saldo do mês, botões "Recebi" e "Paguei", lista de quem não pagou (ordem A→Z).

### RF007 – Agenda
**Descrição:** compromissos, entregas e provas por dia; troca de mês e de ano por seleção.

### RF008 – Painel
**Descrição:** indicadores do mês e gráficos: recebido por mês, top 10 clientes, peças que mais chegam, serviços mais pedidos, clientes por bairro e por cidade.

### RF009 – Administração de acessos
**Descrição:** liberar e-mail, criar conta, convidar, editar, revogar, reativar, excluir e reiniciar o autenticador. Só para administradoras.

## 5.2 Requisitos Não Funcionais

| Código | Requisito | Critério |
|---|---|---|
| RNF001 | Performance | Telas abrem em menos de 2 s em 4G; consultas por índice `account_id` |
| RNF002 | Segurança | RLS em todas as tabelas; senha bcrypt; TOTP cifrado; sem segredo no front |
| RNF003 | Disponibilidade | Vercel e Supabase gerenciados; backup 4×/dia |
| RNF004 | Usabilidade | Uso no celular por pessoa leiga; toque ≥ 44 px; textos simples |
| RNF005 | Padronização | Tahoma, paleta Papel, Prompt Mestre V3.43 |

---

# 06. REGRAS DE NEGÓCIO

### RB001 – CPF obrigatório e único
**Regra:** toda cliente tem CPF de 11 dígitos, válido, e não pode se repetir na mesma conta.
**Condição:** ao salvar a cliente.
**Resultado esperado:** CPF inválido é bloqueado na tela; CPF repetido gera o erro 23505, traduzido para "Já existe uma cliente com este CPF".

### RB002 – Número da costura
**Regra:** cada conta tem a sua numeração sequencial de costuras.
**Resultado esperado:** o gatilho `ordens_numero` preenche `numero` = maior número da conta + 1.

### RB003 – Situações da costura
**Regra:** recebida → em andamento → aguardando prova → pronta → entregue (ou cancelada).
**Resultado esperado:** "Atrasada" = costura aberta, não pronta, com entrega antes de hoje.

### RB004 – Saldo da costura
**Regra:** saldo = soma dos valores das peças − soma das entradas pagas ligadas à costura (view `ordens_resumo`).

### RB005 – Estoque por movimentos
**Regra:** o estoque nunca é digitado direto; ele é a soma dos movimentos (entrada, uso, ajuste). Entradas recalculam o custo médio ponderado.

### RB006 – Excluir costura não apaga dinheiro
**Regra:** ao excluir uma costura, os lançamentos de caixa ficam, sem ligação com ela.

### RB006A – Entrega só com dinheiro conferido
**Regra:** a costura só é baixada como Entregue quando o saldo está quitado ou o restante foi combinado (lançamento pendente com data). Pagamento recebido na entrega exige a confirmação "Conferi o pagamento".

### RB007 – Licença por e-mail
**Regra:** só entra quem tem licença ativa (ou em teste) e não vencida para o e-mail.
**Resultado esperado:** sem licença, aparece "Este e-mail não tem licença para este app."

### RB008 – Administradoras
**Regra:** papel `administrador` só para e-mails da tabela `factory_admins`. Ao inserir um e-mail nela, o gatilho cria uma licença vitalícia.

### RB009 – Sessão
**Regra:** 30 minutos sem uso encerram a sessão; 5 senhas erradas bloqueiam por 15 minutos.

---

# 07. ARQUITETURA

## 7.1 Visão geral

```text
USUÁRIA (celular / computador)
   │
   ▼
FRONTEND — PWA React (Vercel · costureirapro.planilhaprofissional.com)
   │
   ├── Data API (PostgREST)  ── cabeçalho x-costureirapro-session ──┐
   │                                                                ▼
   └── Edge Function costureirapro-auth (Deno)          POSTGRES — schema costureirapro
          │                                                 ├── RLS "cracha_dono" por account_id
          ├── Resend (e-mail de primeiro acesso)            ├── gatilhos (número, estoque, licença)
          └── TOTP (autenticador)                           └── pg_cron → schema costureirapro_backup
```

## 7.2 Componentes

| Componente | Tecnologia | Responsabilidade |
|---|---|---|
| Frontend | React 19 + Vite + TypeScript | Telas, PWA, regras de tela |
| Backend | Supabase Edge Functions (Deno) | Login, primeiro acesso, TOTP, sessão, administração |
| Banco | PostgreSQL (Supabase) | Dados de negócio, RLS, gatilhos, backup |
| Auth | Crachá de sessão próprio (`sessions`) | Sessão opaca sem JWT, 30 min de inatividade |
| Storage | — (previsto: `costureirapro-docs`) | Fotos das peças (futuro) |
| Deploy | Vercel | Build e hospedagem do front |
| E-mail | Resend | Confirmação de primeiro acesso |

## 7.3 Fluxo de dados

1. A usuária entra pela Edge `costureirapro-auth`. Ela confere a senha, o TOTP e a licença, e devolve um token opaco.
2. O front guarda o token e o envia no cabeçalho `x-costureirapro-session` em cada pedido à Data API, com `Accept-Profile` e `Content-Profile` = `costureirapro`.
3. A função `costureirapro.session_account_id()` transforma o token em `account_id`. As policies `cracha_dono` liberam só as linhas dessa conta.
4. Os gatilhos completam número, estoque e licença. O pg_cron copia o schema para `costureirapro_backup`.

---

# 08. STACK TECNOLÓGICA

| Tecnologia | Versão | Finalidade |
|---|---|---|
| React | ^19.1.0 | Interface |
| React DOM | ^19.1.0 | Renderização |
| react-router-dom | ^7.6.0 | Rotas |
| lucide-react | ^0.511.0 | Ícones |
| TypeScript | ~5.8.3 | Desenvolvimento |
| Vite | ^6.3.5 | Build |
| vite-plugin-pwa / workbox-window | ^1.0.0 / ^7.3.0 | PWA instalável |
| Supabase | Hub `planilhaprofissional-hub` | Backend (Postgres, PostgREST, Edge, pg_cron) |
| PostgreSQL | Supabase gerenciado | Banco |
| Deno + bcryptjs + npm:qrcode | Edge runtime | Senha, QR do TOTP |
| Resend | API HTTP | E-mail transacional |
| ViaCEP | API pública | Endereço pelo CEP |
| Contact Picker API | Navegador (Android/Chrome) | Importar contato |
| Vercel | Hobby/Pro | Deploy |
| GitHub | `planilhaprofissionalmba` | Versionamento |

---

# 09. ESTRUTURA DO PROJETO

```text
costureirapro/
│
├── src/
│   ├── components/   AppShell (menu), Footer, ui, Charts, WhatsAppDialog, LancamentoModal,
│   │                 AtelieConfig, FactoryPitch, BrandLockup, SyncedTable, ToastHost…
│   ├── pages/        uma tela por arquivo (Dashboard, Agenda, Costuras, CosturaForm, Recibo,
│   │                 Clientes, ClienteForm, Estoque, Compras, Caixa, Pendencias, Mensagens,
│   │                 Servicos, ComeceAqui, Config, AdminAcessos, Landing, Login, Register,
│   │                 ForgotPassword, ChangePassword, Termos, Lgpd)
│   ├── lib/          api, auth, db, hooks, format, costura, contatos, manual, brand,
│   │                 admin, types, export, install, toast, errorLog…
│   ├── index.css     base do Prompt Mestre
│   └── costura.css   estilos do domínio e ajustes de auditoria
│
├── public/           ícones do app (PNG, SVG, ICO) e logo da fábrica
├── docs/             DOCUMENTACAO_TECNICA.md · GUIA-DO-USUARIO.md · BACKUP-COSTUREIRAPRO.md
├── Documentos Oficiais/  TERMOS_DE_USO.md · LGPD_PRIVACIDADE.md
├── supabase/
│   ├── migrations/   001_auth · 002_negocio · 003_backup
│   └── functions/    costureirapro-auth · costureirapro-hotmart
│
├── .env.example · package.json · vercel.json · vite.config.ts · CHANGELOG.md · README.md
```

## 9.1 Convenções

- Telas em PascalCase (`src/pages/NomeDaTela.tsx`); utilitários em camelCase (`src/lib`).
- Tabelas e colunas em português, `snake_case`, sempre com `account_id`.
- Datas tratadas como data local (sem deslocar o dia); moeda em BRL.
- Listas em ordem A→Z por nome (Prompt Mestre).
- Textos do Comece Aqui e do Guia saem de `src/lib/manual.ts`, que é a fonte única.

---

# 10. BANCO DE DADOS

## 10.1 Tecnologia

PostgreSQL (Supabase), hub `cqirovvxtyreuvucosol`, schema **`costureirapro`** e schema de backup **`costureirapro_backup`** (nunca exposto).

## 10.2 Tabelas

| Tabela | Finalidade |
|---|---|
| `companies` | Empresa/ateliê da conta |
| `accounts` | Conta de acesso (e-mail, hash da senha, TOTP cifrado, termos) |
| `profiles` | Perfil e papel (`administrador` / `operador` / `usuario`) |
| `factory_admins` | E-mails das administradoras |
| `licenses` | Licenças por e-mail (status, plano, vencimento) |
| `sessions` | Crachás de sessão (hash do token, último uso, revogação) |
| `login_attempts` | Contador anti força bruta |
| `registration_verifications` | Links de confirmação do primeiro acesso |
| `password_change_log` | Histórico de troca de senha |
| `audit_logs` | Ações administrativas |
| `error_logs` | Erros do app e da Edge |
| `hotmart_events` | Eventos do webhook Hotmart (idempotente) |
| `clientes` | Clientes (CPF único por conta) |
| `medidas` | Ficha de medidas da cliente |
| `servicos` | Tabela de preços |
| `ordens` | Costuras recebidas |
| `ordem_itens` | Peças de cada costura |
| `produtos` | Materiais do estoque |
| `compras` | Compras de materiais |
| `movimentos_estoque` | Entradas, usos e ajustes |
| `lancamentos` | Caixa (entradas/saídas, pago/pendente) |
| `compromissos` | Agenda |
| `preferencias` | Dados do ateliê, Pix, prazo padrão, modelos de mensagem |
| `envios_whatsapp` | Histórico de mensagens enviadas |
| `costureirapro_backup.snapshots` / `snapshot_tables` | Controle das cópias de segurança |

## 10.3 Campos (principais)

### `clientes`

| Campo | Tipo | Obrigatório | Chave | Descrição |
|---|---|---|---|---|
| id | UUID | Sim | PK | Identificador |
| account_id | UUID | Sim | FK → accounts | Dona do dado |
| nome_completo | text | Sim | - | Nome |
| cpf | text | Sim | Único (conta) | 11 dígitos, CHECK |
| telefone / email | text | Não | - | Contato |
| cep, endereço, bairro, cidade, uf | text | Não | - | Endereço (ViaCEP) |

### `ordens`

| Campo | Tipo | Obrigatório | Chave | Descrição |
|---|---|---|---|---|
| id | UUID | Sim | PK | Identificador |
| account_id | UUID | Sim | FK | Dona |
| cliente_id | UUID | Sim | FK → clientes | Cliente |
| numero | int | Sim | - | Sequencial por conta (gatilho) |
| data_recebimento / data_entrega / hora_entrega | date/time | Sim/Sim/Não | - | Prazos |
| status | text | Sim | - | recebida, em_andamento, aguardando_prova, pronta, entregue, cancelada |
| urgente | boolean | Não | - | Destaque na lista |

### `ordem_itens`

| Campo | Tipo | Obrigatório | Chave | Descrição |
|---|---|---|---|---|
| ordem_id | UUID | Sim | FK (CASCADE) | Costura |
| peca, servico, o que modificar | text | Sim/Não | - | Peça e ajuste |
| valor | numeric | Sim | - | Preço do item |

### `lancamentos`

| Campo | Tipo | Obrigatório | Chave | Descrição |
|---|---|---|---|---|
| tipo | text | Sim | - | entrada / saida |
| status | text | Sim | - | pago / pendente |
| valor, descricao, data_lancamento, data_vencimento | — | Sim/Sim/Sim/Não | - | Movimento |
| ordem_id / cliente_id | UUID | Não | FK (SET NULL) | Ligação opcional |

## 10.4 Índices

- `accounts_email_lower_idx`, `licenses_email_lower_idx`: e-mail único sem diferenciar maiúsculas.
- `clientes_cpf_conta_uidx`: CPF único por conta.
- `ordens_conta_entrega_idx`, `lancamentos_conta_data_idx`, `compromissos_conta_data_idx`: listas por período.
- `ordem_itens_ordem_idx`, `movimentos_produto_idx`, `medidas_cliente_idx`, `sessions_account_idx`: buscas por pai.

## 10.5 Views

- `ordens_resumo` (`security_invoker = true`): costura + cliente, valor total, valor pago, saldo e resumo das peças.

## 10.6 Functions

`set_updated_at`, `is_factory_admin`, `enforce_profile_role`, `factory_admin_license`, `session_account_id`, `ordens_numero`, `movimento_delta`, `movimentos_estoque_sync`, `schema_fingerprint`, `snapshot_schema`, `snapshot_if_changed`, `purge_old_snapshots`, `restore_table_from_snapshot`, `restore_business_from_snapshot`.

## 10.7 Triggers

- `*_updated_at` em todas as tabelas com `updated_at`.
- `profiles_enforce_role`: bloqueia o papel administrador fora de `factory_admins`.
- `factory_admins_license`: cria a licença vitalícia da administradora.
- `ordens_numero_trg`: número sequencial da costura.
- `movimentos_estoque_sync_trg`: estoque atual e custo médio.

## 10.8 Policies / RLS

- RLS ligado nas **24 tabelas** do schema; **12 policies** `cracha_dono` (FOR ALL TO anon), que liberam a linha quando `account_id = costureirapro.session_account_id()` e o pai (cliente, costura, produto, compra) pertence à mesma conta.
- Tabelas de autenticação: `REVOKE` para `anon` e `authenticated`; só a Edge (service role) acessa.

---

# 11. MODELO DE DADOS

## 11.1 Relacionamentos

```text
ACCOUNTS ── PROFILES / LICENSES / SESSIONS
   │
   ├──── CLIENTES ──── MEDIDAS
   │        │
   │        └──── ORDENS (costuras) ──── ORDEM_ITENS (peças)
   │                 │
   │                 ├──── LANCAMENTOS (caixa)     [SET NULL]
   │                 ├──── COMPROMISSOS (agenda)   [SET NULL]
   │                 ├──── MOVIMENTOS_ESTOQUE      [SET NULL]
   │                 └──── ENVIOS_WHATSAPP         [SET NULL]
   │
   ├──── PRODUTOS ──── MOVIMENTOS_ESTOQUE
   │        └──── COMPRAS ──── LANCAMENTOS (saída)
   │
   ├──── SERVICOS (tabela de preços)
   └──── PREFERENCIAS (1 por conta)
```

## 11.2 Diagrama ERD

O diagrama acima resume o ERD. As chaves estrangeiras estão em `supabase/migrations/20261126_002_negocio.sql`.

---

# 12. APIs E INTEGRAÇÕES

## 12.1 Edge Function `costureirapro-auth`

**Endpoint:** `https://cqirovvxtyreuvucosol.supabase.co/functions/v1/costureirapro-auth`
**Método:** `POST` (campo `action` no corpo)
**Autenticação:** pública (`verify_jwt = false`); as ações protegidas exigem o crachá de sessão. CORS liberado para o domínio oficial, `costureirapro.vercel.app`, os previews `costureirapro-*.vercel.app` e localhost.

**Ações:** `login`, `totp_enable`, `register`, `verify_registration`, `finish_registration`, `me`, `touch`, `logout`, `accept_terms`, `change_password`, `forgot`, `log_error`, `admin_list`, `admin_liberar`, `admin_convite`, `admin_criar_conta`, `admin_editar`, `admin_revogar`, `admin_reativar`, `admin_excluir`, `admin_reset_totp`.

### Request

```json
{ "action": "login", "email": "cliente@exemplo.com", "password": "********", "totp": "123456" }
```

### Response

```json
{ "token": "<CRACHA_OPACO>", "user": { "email": "cliente@exemplo.com", "is_admin": false } }
```

### Erros

| Código | Significado | Tratamento |
|---|---|---|
| 400 | Dados inválidos (e-mail, senha fraca) | Mensagem na tela |
| 401 | E-mail/senha/código incorretos ou sessão expirada | Pedir login de novo |
| 403 | Sem licença ou sem permissão de administradora | "Este e-mail não tem licença para este app." |
| 429 | 5 tentativas erradas | Bloqueio de 15 min |
| 500 | Falha interna | Registro em `error_logs` + mensagem amigável |

## 12.2 Data API (PostgREST)

`https://cqirovvxtyreuvucosol.supabase.co/rest/v1/<tabela>`, com os cabeçalhos `apikey` (chave anônima), `x-costureirapro-session`, `Accept-Profile: costureirapro` e `Content-Profile: costureirapro`.

## 12.3 Edge Function `costureirapro-hotmart` (não publicada)

Webhook idempotente (`hotmart_events.transaction_id`) que cria, renova ou cancela a licença pelo e-mail da compra. Valida o `hottok`. Será publicada quando o produto for criado na Hotmart.

## 12.4 Integrações externas

Resend (e-mail), ViaCEP (CEP), WhatsApp (link `wa.me` com texto), Contact Picker API.

---

# 13. AUTENTICAÇÃO E AUTORIZAÇÃO

## 13.1 Autenticação

- [x] E-mail e senha (bcrypt, custo 12)
- [x] Autenticador TOTP (Google Authenticator e similares)
- [x] Confirmação de primeiro acesso por link no e-mail (Resend)
- [ ] Google / Microsoft / Magic Link / OAuth

## 13.2 Perfis

| Perfil | Permissões |
|---|---|
| Administrador | Tudo do app + Administração de acessos (só e-mails em `factory_admins`) |
| Usuário | Todos os dados da própria conta |
| Operador | Reservado para ajudantes do ateliê (versão futura) |

## 13.3 Fluxo

```text
LOGIN (e-mail + senha)
 ↓
VALIDAÇÃO (bloqueio 5×/15 min · licença ativa)
 ↓
AUTENTICAÇÃO (código do autenticador; QR só no 1º login)
 ↓
CARREGAMENTO DO PERFIL (ação "me": papel, licença, is_admin)
 ↓
VERIFICAÇÃO DE PERMISSÕES (RLS por crachá · menu Administração só para admin)
 ↓
ACESSO AO SISTEMA (30 min sem uso → sai)
```

---

# 14. SEGURANÇA

## 14.1 Medidas implementadas

- [x] HTTPS (Vercel e Supabase)
- [x] Autenticação (senha + TOTP)
- [x] Autorização (papéis e `factory_admins`)
- [x] RLS em todas as tabelas
- [x] Validação de entrada (CPF, e-mail estrito, CHECKs no banco)
- [x] Sanitização (filtro `.or()` seguro na Edge)
- [x] Proteção contra exposição de secrets (só na Edge; front sem segredo)
- [x] Controle de sessão (token opaco com hash, 30 min, revogação ao trocar a senha)
- [x] Logs (`error_logs`, `audit_logs`, `password_change_log`)
- [x] Backup (4×/dia, 7 dias)

## 14.2 Secrets

> Nunca registrar valores reais de chaves, tokens ou senhas.

```env
COSTUREIRAPRO_RESEND_API_KEY=<SECRET>
COSTUREIRAPRO_RESEND_FROM_EMAIL=<SECRET>
COSTUREIRAPRO_RESEND_FROM_NAME=<SECRET>
COSTUREIRAPRO_TOTP_KEY=<SECRET>
ADMIN_EMAILS=<SECRET>
COSTUREIRAPRO_HOTMART_HOTTOK=<SECRET>
COSTUREIRAPRO_HOTMART_PRODUCT_IDS=<SECRET>
SUPABASE_SERVICE_ROLE_KEY=<SECRET>
```

---

# 15. LGPD E PRIVACIDADE

## 15.1 Dados pessoais tratados

| Dado | Finalidade | Base legal | Retenção |
|---|---|---|---|
| E-mail, nome da usuária | Acesso e licença | Execução de contrato | Enquanto houver licença |
| Senha (hash), TOTP (cifrado) | Segurança do acesso | Execução de contrato | Enquanto houver conta |
| Nome, CPF, telefone, e-mail e endereço das clientes da costureira | Cadastro e atendimento | Legítimo interesse da costureira (controladora) | Até a costureira excluir |
| Medidas das clientes | Execução do serviço de costura | Execução de contrato | Até a costureira excluir |
| Registros de erro e auditoria | Segurança e suporte | Legítimo interesse | Até 12 meses |

## 15.2 Direitos do titular

A titular pede acesso, correção ou exclusão pelo e-mail suporte@planilhaprofissional.com. A costureira corrige ou exclui as clientes direto no app.

## 15.3 Consentimento

O aceite dos Termos de Uso e da Política de Privacidade/LGPD é obrigatório no primeiro acesso (`accept_terms`) e fica registrado na conta.

## 15.4 Exclusão de dados

- Clientes e costuras: botão Excluir no app.
- Conta: ação `admin_excluir`, feita pela administradora a pedido da titular.
- As cópias de backup somem sozinhas em até 7 dias.

Textos completos em `Documentos Oficiais/TERMOS_DE_USO.md` e `LGPD_PRIVACIDADE.md`.

---

# 16. INTERFACE E EXPERIÊNCIA DO USUÁRIO

## 16.1 Identidade visual

**Marca:** PlanilhaProfissional.com
**Conceito:** Soluções Digitais Inteligentes

### Paleta principal

| Cor | HEX | Uso no CostureiraPro |
|---|---|---|
| Off White | `#F8F9FA` | Paleta institucional (documentos) |
| Papel | `#FFFCF2` | Fundo do app (paleta Papel do Prompt Mestre) |
| Verde oliva | `#9FA488` | Apoio, hover do menu, linhas |
| Dourado | `#CAB77D` | Destaques, item ativo do menu, ☰ |
| Verde petróleo | `#184A4E` | Títulos, cabeçalho, botão principal |
| Bege claro | `#ECE4BB` | Faixas, textos sobre petróleo |
| Dourado escuro | `#8A6A2F` | Linha 2 da frase de efeito |
| Sucesso | `#256D1B` | Valores positivos, "pago" |
| Erro | `#C0392B` | Negativos, atrasos, "falta pagar" |
| Alerta | `#E65100` | Estoque baixo, atenção |

## 16.2 Tipografia

Tahoma em todo o app (fallback: Geneva, Verdana, sans-serif).

## 16.3 Componentes

- **AppShell:** cabeçalho de 56 px com ☰, a dica "MENU" e o lockup. O drawer tem `min(300px, 88vw)` e é organizado por seções (VISÃO GERAL, ATELIÊ, MATERIAIS, DINHEIRO, CONTA, ADMINISTRAÇÃO, DOCUMENTOS, APP).
- **Menu no computador:** abre ao aproximar o mouse (faixa de 24 px na borda esquerda, botão ☰ ou palavra MENU) e fecha quando o mouse sai.
- **ui.tsx:** PageHeader, KpiCard, StatusBadge, Modal, MoneyInput, EmptyState, ErrorState, Loading, Field.
- **Charts:** barras horizontais e colunas.
- **WhatsAppDialog**, **LancamentoModal**, **AtelieConfig**, **FactoryPitch**, **Footer**.

---

# 17. FUNCIONALIDADES

## 17.1 Painel
**Objetivo:** resumo do ateliê.
**Funcionalidades:** indicadores do mês; gráficos (recebido por mês, top 10 clientes, peças que mais chegam, serviços mais pedidos, clientes por bairro e cidade).
**Permissões:** todas as usuárias.

## 17.2 Agenda
Compromissos, entregas e provas por dia; troca de mês e ano por seleção; excluir compromisso.

## 17.3 Costuras
Lista com filtros (Em aberto, Atrasadas, Entregar em 7 dias, Prontas, Todas, Por situação), busca, exportação CSV e ações por linha: **WhatsApp, Editar e Excluir**. Formulário com peças, pagamentos, material usado e situação rápida. Recibo com canhoto para imprimir ou PDF.

## 17.4 Clientes
Cadastro com CPF, importação de contato, CEP automático, medidas e histórico de costuras.

## 17.5 Materiais
Estoque (entrada, uso, ajuste, alerta de mínimo) e Compras (ordem A→Z por fornecedor).

## 17.6 Dinheiro
Caixa mensal (editar e excluir lançamento, "Recebi" e "Paguei"); Pendências a receber e a pagar (A→Z).

## 17.7 Mensagens
Central de WhatsApp: pronta, lembrete, prova, cobrança com Pix e aniversário. A janela fecha depois do envio.

## 17.8 Conta
Configurações (Conta e licença, Alterar senha e Instalar App, os três alinhados e com a mesma altura; Dados do ateliê; modelos de mensagem), Comece Aqui, Termos e LGPD.

## 17.9 Administração de acessos
**Permissões:** só administradoras (`factory_admins`).

---

# 18. FLUXOS DO SISTEMA

## 18.1 Primeiro acesso

```text
INÍCIO
  ↓
E-mail + aceite dos Termos/LGPD
  ↓
┌──────────────────────┐
│ E-mail tem licença?  │
└──────────────────────┘
   ↓ SIM            ↓ NÃO
Link pelo Resend   "Este e-mail não tem licença"
  ↓
Criar senha → QR do autenticador → Comece Aqui
  ↓
FIM
```

## 18.2 Receber e entregar costura

```text
Receber costura → peças e prazos → (sinal no caixa)
  ↓
Em andamento → aguardando prova → pronta
  ↓
WhatsApp "pronta" (janela fecha) → entregue → pagamento → saldo 0
```

## 18.2A Entrega com recebimento

```text
✓ Entregar → resumo (total · já recebido · falta)
  ↓
Recebimentos agendados? → "Recebi" (marca pago)
  ↓
Recebido agora + forma + "Conferi o pagamento" → entrada no Caixa
  ↓
┌──────────────────┐
│ Ainda falta?     │
└──────────────────┘
   ↓ NÃO          ↓ SIM
 Baixa          "Vai pagar depois" + data → Pendências → Baixa
 (Entregue)     (sem marcar: entrega bloqueada)
```

## 18.3 Excluir costura

```text
Lixeira na linha → confirmação → apaga a costura e as peças → lançamentos ficam sem ligação → lista atualizada
```

---

# 19. TRATAMENTO DE ERROS

| Código | Erro | Mensagem usuário | Log |
|---|---|---|---|
| ERR001 | CPF duplicado (23505) | Já existe uma cliente com este CPF | Não |
| ERR002 | Sem licença | Este e-mail não tem licença para este app. | Não |
| ERR003 | Muitas tentativas | Muitas tentativas. Aguarde 15 minutos. | Não |
| ERR004 | Sessão expirada | Sua sessão terminou. Entre de novo. | Não |
| ERR005 | Falha ao ler licenças | Não foi possível verificar sua licença agora. | Sim |
| ERR006 | Falha do Resend | Não foi possível enviar a confirmação. | Sim |
| ERR007 | Histórico de WhatsApp não salvo | A mensagem foi aberta, mas o histórico não foi salvo. | Não |

## 19.1 Princípios

- Não expor informações técnicas sensíveis à usuária.
- Registrar erros críticos em `error_logs` (ação `log_error`).
- Apresentar mensagens compreensíveis.
- Permitir rastreamento do problema.

### Possíveis falhas e correções

| Sintoma | Causa provável | Correção |
|---|---|---|
| "Não foi possível enviar a confirmação" | Secrets do Resend faltando ou domínio não verificado | Conferir `COSTUREIRAPRO_RESEND_*` e o domínio no Resend |
| "Autenticador indisponível" | `COSTUREIRAPRO_TOTP_KEY` ausente ou inválido | Cadastrar 32 bytes em base64 |
| Listas vazias com login feito | Sessão expirada ou Termos não aceitos | Entrar de novo; ver `error_logs` |
| Agenda de contatos não abre | iPhone ou navegador sem Contact Picker | Usar "Colar contato" ou arquivo .vcf |
| "Sem licença" com e-mail certo | E-mail gravado diferente em `factory_admins`/`licenses` | Conferir com `SELECT email FROM costureirapro.licenses` (ver nota de 26/11 no Changelog) |
| Administração não aparece | E-mail fora de `factory_admins` | Inserir o e-mail na tabela |

---

# 20. LOGS E MONITORAMENTO

## 20.1 Logs

**Ferramenta:** tabelas do próprio schema e logs da Edge no painel Supabase.
**Local:** `costureirapro.error_logs`, `audit_logs`, `password_change_log`, `login_attempts`, `envios_whatsapp`.

## 20.2 Monitoramento

| Métrica | Meta | Ferramenta |
|---|---:|---|
| Disponibilidade | 99,5% | Vercel / Supabase status |
| Erros | 0 críticos/semana | `error_logs` |
| Performance | < 2 s por tela | Vercel Analytics / navegador |
| Backup | 4 cópias/dia | `costureirapro_backup.snapshots` |

---

# 21. TESTES

## 21.1 Tipos

- [ ] Unitários
- [x] Integração (RLS testada em transação desfeita: acesso sem crachá bloqueado)
- [ ] E2E
- [x] Segurança (RLS, anti força bruta, CORS)
- [ ] Performance
- [x] Acessibilidade (rótulos `aria-label`, toque ≥ 44 px)
- [x] Testes manuais (produção, 26/11/2026)
- [x] Typecheck TypeScript antes de cada entrega (`tsconfig.json` e `tsconfig.vercel.json`)

## 21.2 Casos de teste

| Código | Cenário | Resultado esperado | Status |
|---|---|---|---|
| TC001 | Pedido à Data API sem crachá | Nenhuma linha retornada | OK |
| TC002 | Primeiro acesso com e-mail sem licença | "Este e-mail não tem licença" | OK |
| TC003 | Primeiro acesso com e-mail de administradora | Link enviado e conta criada | OK |
| TC004 | Cliente salva | Linha em `clientes` com `account_id` | OK |
| TC005 | Costura com 2 peças | `ordens` + 2 `ordem_itens` | OK |
| TC006 | Envio de WhatsApp | Linha em `envios_whatsapp`; janela fecha | OK |
| TC007 | Excluir costura na lista | Costura e peças apagadas; caixa mantido | OK |
| TC007A | Entregar costura com saldo, sem marcar "vai pagar depois" | Entrega bloqueada com aviso | OK |
| TC007B | Entregar recebendo tudo | Entrada paga no Caixa; costura Entregue | OK |
| TC008 | Menu no computador | Abre ao aproximar o mouse e fecha ao sair | OK |
| TC009 | Build na Vercel | Status `success` | OK |

---

# 22. AMBIENTES

| Ambiente | URL | Finalidade |
|---|---|---|
| Desenvolvimento | http://localhost:5173 | Desenvolvimento |
| Homologação | `https://costureirapro-*.vercel.app` (previews) | Testes |
| Produção | https://costureirapro.planilhaprofissional.com | Usuárias |

---

# 23. VARIÁVEIS DE AMBIENTE

## `.env.example`

```env
VITE_SUPABASE_URL=https://cqirovvxtyreuvucosol.supabase.co
VITE_SUPABASE_ANON_KEY=
VITE_HOTMART_URL=
VITE_YOUTUBE_COMECE_AQUI=
VITE_YOUTUBE_LANDING=
```

> O arquivo `.env` real nunca deve ser versionado. Os secrets da Edge ficam só no painel do Supabase (seção 14.2).

---

# 24. INSTALAÇÃO E CONFIGURAÇÃO

## Pré-requisitos

- Node.js 20 ou superior
- Git
- Acesso ao hub Supabase `cqirovvxtyreuvucosol`

## Instalação

```bash
git clone https://github.com/planilhaprofissionalmba/costureirapro.git
cd costureirapro
npm install
```

## Configuração

```bash
cp .env.example .env.local
```

Preencher `VITE_SUPABASE_ANON_KEY` (chave pública).

## Executar

```bash
npm run dev
```

## Banco (já aplicado em produção)

Migrations em ordem: `20261126_001_auth.sql` → `20261126_002_negocio.sql` → `20261126_003_backup.sql`. Elas mexem **somente** nos schemas `costureirapro` e `costureirapro_backup`.

---

# 25. DEPLOY

## 25.1 Plataforma

Vercel (front) e Supabase (banco e Edge Functions).

## 25.2 Processo

```text
DESENVOLVIMENTO
       ↓
TYPECHECK (tsc)
       ↓
COMMIT (main)
       ↓
PUSH (GitHub)
       ↓
BUILD AUTOMÁTICO (Vercel) → status no commit
       ↓
PRODUÇÃO (costureirapro.planilhaprofissional.com)
```

## 25.3 Rollback

- **Front:** no painel da Vercel, em Deployments, escolher o deploy anterior e usar "Promote to Production". Outra opção é `git revert <sha>` seguido de push.
- **Banco:** restaurar a partir de um snapshot (seção 27).
- **Edge:** publicar de novo a versão anterior de `supabase/functions/...`.

---

# 26. CI/CD

## Pipeline

```text
Push → Build (tsc -b && vite build) → Deploy → Status do commit (GitHub)
```

## Ferramenta

Integração Git da Vercel. O status é conferido com `gh api repos/planilhaprofissionalmba/costureirapro/commits/<sha>/status`.

---

# 27. BACKUP E RECUPERAÇÃO

## Backup

**Frequência:** 4×/dia, às 0h, 6h, 12h e 18h no horário do servidor (UTC), pelo agendamento `costureirapro_snapshot_4x`. Usa `snapshot_if_changed`, então só copia quando houve mudança.
**Local:** schema `costureirapro_backup` (não exposto).
**Retenção:** 7 dias. A limpeza é feita por `costureirapro_purge_snapshots` diariamente às 6h45 UTC.

## Recuperação

**Procedimento:**
1. Listar as cópias: `SELECT id, label, created_at FROM costureirapro_backup.snapshots ORDER BY created_at DESC;`
2. Restaurar uma tabela: `SELECT costureirapro.restore_table_from_snapshot('<id>', 'clientes');`
3. Restaurar todo o negócio: `SELECT costureirapro.restore_business_from_snapshot('<id>');`

Detalhes em `docs/BACKUP-COSTUREIRAPRO.md`.

## RPO

Até 6 horas.

## RTO

Até 1 hora.

---

# 28. MANUTENÇÃO

## Rotinas

- [ ] Atualização de dependências (mensal)
- [ ] Verificação de segurança (advisors do Supabase)
- [ ] Verificação de logs (`error_logs`, semanal)
- [x] Backup (automático)
- [ ] Testes manuais após cada entrega
- [ ] Atualização de documentação a cada versão

## Procedimentos críticos

- **Nunca** alterar outros schemas do hub nem a lista de schemas expostos.
- **Nunca** colocar e-mails ou segredos no código.
- Inserir administradoras **com o e-mail real** (não deixar marcadores como `<email>`).
- Restauração de backup só com autorização da responsável.

---

# 29. DEPENDÊNCIAS

| Dependência | Versão | Finalidade | Criticidade |
|---|---|---|---|
| react / react-dom | ^19.1.0 | Interface | Alta |
| react-router-dom | ^7.6.0 | Rotas | Alta |
| lucide-react | ^0.511.0 | Ícones | Média |
| vite | ^6.3.5 | Build | Alta |
| typescript | ~5.8.3 | Tipagem | Alta |
| vite-plugin-pwa | ^1.0.0 | PWA | Média |
| workbox-window | ^7.3.0 | Service worker | Média |
| @vitejs/plugin-react | ^4.4.1 | Build React | Alta |
| bcryptjs / qrcode (Edge, npm:) | — | Senha e QR | Alta |

---

# 30. PERFORMANCE

## Métricas

| Métrica | Meta |
|---|---:|
| Tempo de carregamento | < 2 s (4G) |
| Tempo de resposta API | < 400 ms |
| Disponibilidade | 99,5% |

## Otimizações

- Índices por `account_id` + data em todas as listas.
- View `ordens_resumo` calcula os totais no banco (uma consulta por lista).
- PWA com cache do app (abre rápido após a primeira visita).
- `touch` de sessão no máximo a cada 5 minutos.

---

# 31. ACESSIBILIDADE

## Verificações

- [x] Contraste adequado (petróleo sobre papel; bege sobre petróleo)
- [x] Navegação por teclado (☰ abre com clique ou teclado; Esc fecha)
- [x] Labels (`aria-label` nos botões de ícone)
- [x] Textos alternativos
- [x] Estrutura semântica (`header`, `aside`/`navigation`, `main`, tabelas)
- [x] Responsividade (1 coluna no celular)
- [x] Compatibilidade mobile (toque ≥ 44 px)

---

# 32. CHANGELOG

## 0.1.2 – 26/11/2026 (noite)

### Adicionado
- **Entrega da costura ligada ao recebimento** (conferência do pagamento, entrada no Caixa, restante em Pendências e baixa da costura).
- Costuras: botões **Entregar**, **Editar** e **Excluir** em cada linha da lista; tabela ocupa toda a largura e as ações não quebram linha.

### Alterado
- WhatsApp: a janela de envio fecha sozinha depois de abrir o WhatsApp.
- Menu: abre ao aproximar o mouse (faixa de 24 px, palavra MENU e qualquer tela com mouse).
- Configurações: os três cards do topo ficam alinhados e com a mesma altura.
- Landing: os 3 passos ficam na mesma linha (≥ 768 px) e o título "Instalar app (PWA)" fica centralizado.

### Corrigido
- Licenças das administradoras gravadas com marcadores (`<email 1>`, `<email 2>`): trocadas pelos e-mails reais. O acesso passou a funcionar.

## 0.1.1 – 26/11/2026

### Corrigido
- Auditoria pelo Prompt Mestre:
  - topo da landing com a hierarquia certa (frase de efeito e slogan maiores);
  - cabeçalho da landing menor;
  - Agenda com mês e ano em seleção;
  - Compras e Pendências em ordem A→Z;
  - Comece Aqui na ordem oficial de cards.

## 0.1.0 – 26/11/2026

### Adicionado
- Primeira versão:
  - agenda, costuras, clientes com CPF e medidas, contato do celular;
  - estoque, compras, caixa, pendências, WhatsApp e gráficos;
  - Administração de acessos e landing (De R$ 427 por R$ 347);
  - backup 4×/dia.

### Segurança
- RLS por crachá de sessão, senha bcrypt, TOTP cifrado e anti força bruta.

---

# 33. ROADMAP

## Próximas versões

### v0.2.0
- [ ] Integração Hotmart (publicar `costureirapro-hotmart`, `VITE_HOTMART_URL`, hottok)
- [ ] Fotos das peças (antes/depois) no Storage `costureirapro-docs`

### v0.3.0
- [ ] Lembrete diário das entregas do dia
- [ ] Orçamento que vira costura com um toque

### Futuro
- [ ] Ajudantes do ateliê (perfil operador, dados isolados por empresa)
- [ ] Relatório mensal em PDF para o MEI

---

# 34. RISCOS E DECISÕES TÉCNICAS

## 34.1 Riscos

| ID | Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|---|
| R001 | Alterar outro app do hub compartilhado | Baixa | Alto | Migrations só em `costureirapro*`; conferência antes/depois (schemas, agendamentos, funções) |
| R002 | E-mail de licença gravado errado | Média | Médio | Conferir `licenses` após inserir; normalizar minúsculas |
| R003 | Resend fora do ar | Baixa | Médio | Erro registrado; administradora pode criar a conta direto |
| R004 | Perda do celular com autenticador | Média | Médio | `admin_reset_totp` |
| R005 | Contact Picker indisponível no iPhone | Alta | Baixo | Colar contato ou arquivo .vcf |

## 34.2 Decisões técnicas

### ADR-001 – Crachá de sessão sem JWT
**Contexto:** hub compartilhado por vários apps, cada um com a sua licença.
**Decisão:** sessão opaca própria (`sessions`) enviada no cabeçalho `x-costureirapro-session`, validada por `session_account_id()` nas policies.
**Motivo:** isolar o app do Supabase Auth dos outros apps e controlar inatividade e licença no banco.
**Alternativas consideradas:** Supabase Auth com JWT por projeto.
**Consequências:** a Edge cuida de toda a autenticação; o RLS depende da função de sessão.

### ADR-002 – Administradoras em tabela
**Contexto:** um plugin de privacidade impede escrever e-mails no código.
**Decisão:** tabela `factory_admins` + gatilho que cria a licença vitalícia.
**Consequências:** liberar uma administradora é um `INSERT`, sem novo deploy.

### ADR-003 – Estoque por movimentos
**Decisão:** o estoque é calculado por gatilho a partir de `movimentos_estoque`.
**Motivo:** histórico auditável e custo médio correto.

### ADR-004 – Backup por schema com pg_cron
**Decisão:** cópia do schema para `costureirapro_backup` só quando houve mudança, com retenção de 7 dias.
**Motivo:** restaurar um app sem afetar os outros do hub.

---

# 35. GLOSSÁRIO

| Termo | Definição |
|---|---|
| API | Interface de programação |
| CRUD | Create, Read, Update, Delete |
| RLS | Row Level Security (segurança por linha) |
| RBAC | Role-Based Access Control |
| PWA | App da web que se instala na tela inicial |
| Crachá de sessão | Token opaco que identifica a sessão sem JWT |
| TOTP | Código de 6 dígitos do aplicativo autenticador |
| Edge Function | Função no servidor (Deno) do Supabase |
| Costura / Ordem | Serviço recebido de uma cliente, com uma ou mais peças |
| Snapshot | Cópia de segurança do schema |
| Hub | Projeto Supabase único compartilhado pelos apps da fábrica |

---

# 36. CHECKLIST DE ENTREGA

## Documentação

- [x] README atualizado
- [x] Arquitetura documentada
- [x] Banco documentado
- [x] APIs documentadas
- [x] Regras de negócio documentadas
- [x] Segurança documentada
- [x] LGPD documentada
- [x] Variáveis documentadas
- [x] Testes documentados
- [x] Deploy documentado
- [x] CI/CD documentado
- [x] Backup documentado
- [x] Changelog atualizado

## Código

- [x] Código versionado
- [ ] Branch principal protegida
- [x] Dependências atualizadas
- [x] `.env` protegido
- [x] Testes executados (typecheck + manuais)
- [x] Build validado
- [x] Sem erros críticos

## Produção

- [x] Deploy realizado
- [x] Domínio configurado
- [x] SSL ativo
- [x] Banco configurado
- [x] Backup configurado
- [ ] Monitoramento ativo (externo)
- [x] Logs funcionando
- [x] Teste final realizado

---

# CONTROLE DE VERSÕES DA DOCUMENTAÇÃO

| Versão | Data | Autor | Alteração |
|---|---|---|---|
| 1.0.0 | 26/11/2026 | PlanilhaProfissional.com | Documentação inicial (v0.1.0) |
| 1.1.0 | 26/11/2026 | PlanilhaProfissional.com | Reescrita no Template Mestre v1.0 + notas de 26/11 (v0.1.1 e v0.1.2) |

---

# FIM DA DOCUMENTAÇÃO

**PlanilhaProfissional.com**

**Soluções Digitais Inteligentes**

> Você apresenta a necessidade. Nós encontramos a solução.

# Documentação técnica — CostureiraPro v0.1.0

**Planilha Profissional · Fábrica de Apps · Prompt Mestre V3.43 · 26/11/2026**

## Índice
1. O que foi feito
2. Estrutura (front, back, arquivos)
3. Banco de dados e segurança
4. Login, primeiro acesso e sessão
5. Telas do app
6. Ferramentas usadas
7. Cores e layout
8. Possíveis falhas e correções
9. Pendências de configuração
10. Melhorias sugeridas

---

## 1. O que foi feito
App completo para costureira, pensado para o **celular**: agenda; costuras recebidas (cada peça, o serviço e o que modificar, valor, prazo, prova, sinal, situação); clientes com **CPF obrigatório e validado** (sem duplicar), contato puxado da agenda do celular/WhatsApp, CEP automático e ficha de medidas; tabela de preços; estoque (linha, agulha, óleo de máquina, zíper…) com entrada, uso, ajuste e alerta de mínimo; compras que sobem o estoque e lançam no caixa; caixa mensal; pendências (quem não pagou, a receber, a pagar); central de mensagens do WhatsApp (pronta, lembrete, prova, cobrança com Pix, aniversário); painel com gráficos (recebido por mês, top 10 clientes, peças que mais chegam, serviços mais pedidos, clientes por bairro e cidade); recibo com canhoto para imprimir/PDF; Comece Aqui didático; Termos; LGPD; Administração de acessos; landing de venda (De R$ 427 por R$ 347) com teste grátis de 7 dias pelo WhatsApp.

## 2. Estrutura
| Pasta | Conteúdo |
|---|---|
| `src/pages/` | Uma tela por arquivo (PascalCase) |
| `src/components/` | Menu (AppShell), rodapé, peças de UI, gráficos, WhatsApp, lançamento |
| `src/lib/` | `api.ts` (endereços e crachá) · `db.ts` (Data API) · `auth.tsx` (sessão e 30 min) · `costura.ts` (listas e mensagens) · `format.ts` (moeda, datas, CPF, telefone) · `manual.ts` (texto do Comece Aqui e do Guia) |
| `supabase/migrations/` | SQL: auth, negócio, backup |
| `supabase/functions/costureirapro-auth` | Login, 1º acesso (Resend), TOTP, esqueci senha, sessão, administração |
| `supabase/functions/costureirapro-hotmart` | Webhook de compra (idempotente) |
| `public/` | Ícone próprio do app (PNG/ICO/SVG) e logo da fábrica |

## 3. Banco de dados e segurança
- Hub único `cqirovvxtyreuvucosol`, schema **`costureirapro`** (nada em `public`).
- Tabelas de auth: `accounts`, `profiles`, `licenses`, `sessions`, `login_attempts`, `registration_verifications`, `password_change_log`, `audit_logs`, `error_logs`, `hotmart_events`, `companies`, `factory_admins`. **Sem** acesso de `anon`/`authenticated` (só a Edge).
- Tabelas de negócio (todas com `account_id` obrigatório): `clientes`, `medidas`, `servicos`, `ordens`, `ordem_itens`, `produtos`, `movimentos_estoque`, `compras`, `lancamentos`, `compromissos`, `preferencias`, `envios_whatsapp` + view `ordens_resumo` (`security_invoker`).
- **RLS por crachá de sessão:** cada pedido leva o cabeçalho `x-costureirapro-session`; `costureirapro.session_account_id()` confere o hash do token, sessão ativa (30 min), conta/perfil ativos, Termos aceitos e licença válida. Policies `cracha_dono` comparam `account_id` e exigem que o pai (cliente, costura, produto, compra) seja da mesma conta. **Sem JWT.**
- Senhas só em **hash bcrypt** (custo 12). Segredo TOTP cifrado (AES-GCM).
- **Administradores:** tabela `factory_admins` + secret `ADMIN_EMAILS`. Nada de e-mail fixo no código. Gatilho impede `role = administrador` fora da lista; DEFAULT `usuario`.
- Número da costura sequencial por conta (gatilho). Estoque atual calculado por gatilho a partir dos movimentos (custo médio ponderado nas entradas).
- Backup por schema: ver `docs/BACKUP-COSTUREIRAPRO.md`.

## 4. Login, primeiro acesso e sessão
- **Entrar:** e-mail + senha → (1º login sem autenticador: QR uma única vez) → sessão.
- **Primeiro acesso:** e-mail + aceite Termos/LGPD → e-mail pelo **Resend** → link → Criar senha → QR do autenticador → Comece Aqui.
- **Esqueci senha:** e-mail + código do autenticador + nova senha (sem e-mail) → todas as sessões revogadas → `password_change_log`.
- Anti força bruta: 5 erros → 15 min de bloqueio **na Edge**.
- Sessão: 30 min sem uso; o app checa a inatividade **antes** de renovar e chama `touch` no máximo a cada 5 min durante o uso.

## 5. Telas
Landing `/` · Login `/login` (+ `?primeiro=1`) · Esqueci `/esqueci-senha` · Termos `/termos` · LGPD `/lgpd` · Comece Aqui · Painel · Agenda · Costuras (lista, nova, editar, recibo) · Clientes (lista, nova, editar com medidas e histórico) · Mensagens WhatsApp · Tabela de preços · Estoque · Compras · Caixa · Pendências · Configurações (conta, senha, instalar, ateliê, modelos de mensagem) · Administração de acessos.

## 6. Ferramentas
Vite · React 19 · TypeScript · react-router · lucide-react · vite-plugin-pwa · Supabase (Postgres, PostgREST, Edge Functions Deno, pg_cron) · Resend (e-mail) · Vercel (hospedagem) · ViaCEP (endereço pelo CEP) · Contact Picker API (agenda do celular, Android/Chrome).

## 7. Cores e layout
Paleta Papel: `#FFFCF2` (fundo) · `#ECE4BB` (bege) · `#9FA488` (oliva) · `#CAB77D` (dourado) · `#184A4E` (petróleo). Semânticas só para estado: `#256D1B` ok · `#C0392B` erro · `#E65100` alerta. Fonte Tahoma. Menu = modelo PrdPro (drawer 300 px, ícones Lucide 16 px). Botões 8 px, cards 10/14 px, áreas de toque ≥ 44 px.

## 8. Possíveis falhas e correções
| Sintoma | Causa provável | Correção |
|---|---|---|
| “Não foi possível enviar a confirmação” no 1º acesso | Secrets Resend faltando ou domínio do remetente não verificado | Conferir `COSTUREIRAPRO_RESEND_*` e o domínio no Resend |
| “Autenticador indisponível” | `COSTUREIRAPRO_TOTP_KEY` ausente ou inválido | Cadastrar 32 bytes em base64 |
| Listas vazias logado | Sessão expirada ou Termos não aceitos | Entrar de novo; ver `error_logs` |
| Agenda de contatos não abre | iPhone/navegador sem Contact Picker | Usar “Colar contato” ou arquivo .vcf |
| Administração não aparece | E-mail não está em `factory_admins`/`ADMIN_EMAILS` | Inserir o e-mail na tabela |

## 9. Pendências de configuração
Ver CHANGELOG e o resumo da entrega: secrets da Edge, inserir os 2 e-mails em `factory_admins`, domínio `costureirapro.planilhaprofissional.com` na Vercel, produto Hotmart (`VITE_HOTMART_URL`, hottok).

## 10. Melhorias sugeridas (próximas versões)
1. Fotos das peças (antes/depois) no Storage `costureirapro-docs`.
2. Lembrete automático diário (resumo das entregas do dia).
3. Orçamento que vira costura com um toque.
4. Comissão/controle de ajudantes (multiusuário por empresa, com dados isolados).
5. Relatório mensal em PDF para o MEI.

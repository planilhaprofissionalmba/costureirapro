# Backup do CostureiraPro (regras 38 · 59 · 60 do Prompt Mestre V3.43)

## Duas camadas
1. **Hub Pro** (`cqirovvxtyreuvucosol`): backup diário do projeto inteiro (conferir no painel do Supabase). Restaurar o hub afeta **todos** os apps — usar só em desastre do projeto.
2. **Por schema (este app):** schema `costureirapro_backup`, só com dados do CostureiraPro, em **tabelas reais** datadas (`<tabela>_AAAAMMDD_HHMMSS`). Nunca JSON.

## Rotina automática (pg_cron)
| Job | Quando | O que faz |
|---|---|---|
| `costureirapro_snapshot_4x` | `0 0,6,12,18 * * *` UTC = 20h · 02h · 08h · 14h (Cuiabá) | `costureirapro.snapshot_if_changed('auto')` — cria cópia **só se os dados mudaram** (impressão digital em `snapshots.fingerprint`) |
| `costureirapro_purge_snapshots` | `45 6 * * *` UTC (1×/dia) | `costureirapro.purge_old_snapshots(7)` — apaga cópias com mais de 7 dias |

Ficam fora da cópia (mudam sem importância): `sessions`, `login_attempts`, `registration_verifications`.

## Antes de mexer no schema (obrigatório)
```sql
SELECT costureirapro.snapshot_schema('pre-migration: <o que vai mudar>');  -- anote o id devolvido
```

## Ver as cópias
```sql
SELECT s.id, s.label, s.created_at, count(t.*) AS tabelas, sum(t.row_count) AS linhas
FROM costureirapro_backup.snapshots s LEFT JOIN costureirapro_backup.snapshot_tables t ON t.snapshot_id = s.id
GROUP BY s.id ORDER BY s.created_at DESC;
```

## Restaurar (só o CostureiraPro)
```sql
-- uma tabela
SELECT costureirapro.restore_table_from_snapshot('<snapshot_id>', 'clientes');
-- todas as tabelas de negócio (pai antes do filho)
SELECT * FROM costureirapro.restore_business_from_snapshot('<snapshot_id>');
```
A restauração faz *upsert* por `id` (devolve linhas apagadas/alteradas; não apaga linhas criadas depois). As funções só rodam com `service_role` (SQL Editor do painel).

## Segurança
`costureirapro_backup` **nunca** entra em Exposed schemas e não tem acesso de `anon`/`authenticated`.

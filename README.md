# CostureiraPro

App PWA da **Planilha Profissional** para costureiras: agenda, costuras recebidas (peças e o que modificar), clientes com CPF e medidas, estoque (linha, agulha, óleo…), compras, caixa, pendências (quem não pagou, a receber, a pagar), avisos pelo WhatsApp e painel com gráficos.

- **Produção:** https://costureirapro.planilhaprofissional.com
- **Vercel:** https://vercel.com/planilhaprofissionalmba/costureirapro (conta `planilhaprofissionalmba@gmail.com`)
- **GitHub:** https://github.com/planilhaprofissionalmba/costureirapro
- **Hub Supabase:** `planilhaprofissional-hub` · `cqirovvxtyreuvucosol` · schema `costureirapro` (+ `costureirapro_backup`, não exposto)
- **Edge Functions:** `costureirapro-auth` (login, 1º acesso, TOTP, admin) · `costureirapro-hotmart` (webhook)
- **Stack:** Vite + React + TypeScript + Supabase + PWA · CSS próprio (paleta Papel, Tahoma) · ícones Lucide
- **Modelo comercial:** HOTMART (lançamento De R$ 427,00 por R$ 347,00). Enquanto o checkout não existir, “Comprar” abre o WhatsApp.
- **Padrão:** Prompt Mestre V3.43 da Fábrica de Apps.

## Rodar localmente
```bash
npm install
cp .env.example .env.local   # preencha VITE_SUPABASE_ANON_KEY
npm run dev
```

## Documentos
- `docs/GUIA-DO-USUARIO.md` — manual da usuária (mesmo conteúdo do Comece Aqui)
- `docs/DOCUMENTACAO_TECNICA.md` — arquitetura, segurança, banco e operação
- `docs/BACKUP-COSTUREIRAPRO.md` — backup por schema (4×/dia) e como restaurar
- `supabase/migrations/` — SQL do schema · `supabase/functions/` — Edge Functions
- `CHANGELOG.md` — versões

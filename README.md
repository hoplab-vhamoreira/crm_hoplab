# HOP Lab CRM — Frontend

Frontend estático do CRM HOP Lab, a correr em Cloudflare Pages com Supabase como backend.

**URL produção:** https://crm.hoplab.pt

## Stack

- HTML / CSS / JavaScript puro (sem frameworks)
- [Supabase JS Client](https://supabase.com/docs/reference/javascript) para auth e dados
- Cloudflare Pages para hosting
- Supabase (projeto `crm_hoplab`) como base de dados e auth

## Estrutura

```
/
├── index.html          # App principal (requer autenticação)
├── login.html          # Página de login
├── js/
│   ├── supabase-client.js  # Inicialização e export do client Supabase
│   ├── auth.js             # Login, logout, sessão, protecção de rotas
│   ├── api.js              # Wrapper sobre supabase-js (substitui /api/data/...)
│   └── compute.js          # Lógica de negócio (portada de compute.py)
└── css/
    └── style.css           # Estilos globais
```

## Desenvolvimento local

1. Clona o repo
2. Cria um ficheiro `.env.local` com:
   ```
   SUPABASE_URL=https://bocwqacwalzshjkhjzwi.supabase.co
   SUPABASE_ANON_KEY=<a tua anon key>
   ```
3. Serve localmente (ex: `npx serve .` ou Live Server no VS Code)

> As variáveis de ambiente em frontend estático ficam expostas no browser — é o comportamento esperado para a `anon key`. A segurança está nas **policies RLS** do Supabase.

## Deploy

Auto-deploy via Cloudflare Pages ligado a este repo.
Branch `main` → produção (`crm.hoplab.pt`)

## Branches

| Branch | Conteúdo |
|--------|----------|
| `main` | Frontend novo (este código) |
| `legacy` | Snapshot do Flask CRM original (só leitura) |

## Migração em curso

Ver `MIGRACAO.md` (na branch `legacy`) para o plano completo de migração.

Fases:
- [x] Fase 0 — Inventário e arquitectura
- [ ] Fase 1 — Foundations: `profiles`, RLS policies, auth
- [ ] Fase 2 — CRUD genérico
- [ ] Fase 3 — Auth completo
- [ ] Fase 4 — Endpoints agregados (RPC)
- [ ] Fase 5 — Histórico e audit
- [ ] Fase 6 — Polimento e cutover

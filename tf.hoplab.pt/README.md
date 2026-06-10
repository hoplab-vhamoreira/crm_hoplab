# SpeechCraft — tf.hoplab.pt

App de continuidade terapêutica para terapia da fala. **Não é dispositivo médico.**

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Mobile | React Native + Expo |
| Backoffice (TF) | React + Cloudflare Pages |
| API | Cloudflare Workers |
| Auth + DB + Storage | Supabase (região Frankfurt — UE) |

## Estrutura

```
tf.hoplab.pt/
├── app/          React Native + Expo (iOS + Android)
├── web/          Backoffice do terapeuta (React)
├── api/          Cloudflare Workers
├── packages/
│   └── types/    Tipos TypeScript partilhados
├── docs/         AIPD, política de privacidade, termos
└── infra/        Supabase migrations, wrangler configs
```

## Fases

- **Fase 0** — Fundação (modelo de dados, RBAC, consentimento, cifragem) ← *aqui*
- **Fase 1** — MVP (plano, hoje, biblioteca, adesão, vídeo→TF, notificações, gamificação)
- **Fase 2** — Backoffice TF completo, análise descritiva
- **Fase 3** — Módulo de análise (dispositivo médico regulado — projeto separado)

## Regra legal central

A app **nunca** avalia, pontua ou corrige clinicamente. Ver `docs/compliance.md`.

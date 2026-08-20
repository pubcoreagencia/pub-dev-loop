# Deploy do PUB DEV LOOP & PUB Prototype (PP) no Cloudflare

Este documento registra a arquitetura, configuração e procedimentos operacionais do deploy em produção do **PUB DEV LOOP (PDL)** e do **PUB Prototype (PP)** na infraestrutura Cloudflare.

---

## 1. Arquitetura em Produção

```text
[ Browser / Cliente ]
        │
        ▼ (HTTPS)
[ Cloudflare Worker: pub-dev-loop-api ]
  │  ├── GET /health
  │  ├── GET /prototype (Web UI nativa)
  │  ├── REST Endpoints (/prototype/sessions, /tasks, /migrate)
  │  └── SSE Stream (/prototype/sessions/:id/events)
  │
  ├──► [ Cloudflare Hyperdrive ] ──► [ Neon PostgreSQL (sa-east-1) ]
  │
  └──► [ Cloudflare Durable Object: PubDevLoopWorkerContainer ]
            │
            ▼ (SDK official @cloudflare/containers)
       [ Linux Worker Container: Dockerfile.worker ]
         ├── ModeAwareWorker (RouterWorker + PrototypeWorker)
         ├── Git + Codex CLI + Cloudflared (Live Preview Tunnels)
         └── Two-Tier Inference Gateways:
               ├── Primary: OpenRouter (com fallback interno de modelos)
               └── Secondary: 9Router (ativado em ALL_PROVIDERS_FAILED)
```

---

## 2. Endpoints de Produção

- **URL Base:** `https://pub-dev-loop-api.contato-pubcore.workers.dev`
- **Healthcheck:** `GET https://pub-dev-loop-api.contato-pubcore.workers.dev/health`
- **Interface Web do PP:** `GET https://pub-dev-loop-api.contato-pubcore.workers.dev/prototype`
- **Sessões do PP:** `POST /prototype/sessions`, `GET /prototype/sessions`, `GET /prototype/sessions/:id`
- **Prompts do PP:** `POST /prototype/sessions/:id/prompts`
- **Checkpoints do PP:** `POST /prototype/sessions/:id/checkpoints`, `GET /prototype/sessions/:id/checkpoints`
- **Promoção PP → PDL:** `POST /prototype/sessions/:id/promote`
- **SSE Stream:** `GET /prototype/sessions/:id/events`
- **Tarefas de Desenvolvimento:** `GET /tasks`, `POST /tasks`, `GET /tasks/:id`

---

## 3. Configuração de Variáveis e Secrets

### Variáveis Públicas (`wrangler.jsonc`)
- `PRIMARY_GATEWAY`: `openrouter`
- `FALLBACK_GATEWAY`: `9router`
- `OPENROUTER_BASE_URL`: `https://openrouter.ai/api/v1`
- `OPENROUTER_MODEL`: `openrouter/free`
- `ROUTER_BASE_URL`: `http://127.0.0.1:20128/v1`
- `ROUTER_MODEL`: `gemini/gemini-3.7-flash`
- `AGENT_PROVIDER`: `gateway`
- `PROTOTYPE_TEMPLATE_REPOSITORY`: `https://github.com/pubcoreagencia/pub-dev-loop-template.git`

### Secrets Gerenciados via Wrangler
- `DATABASE_URL` (Neon PostgreSQL)
- `PUB_DEV_LOOP_API_KEY`
- `GITHUB_TOKEN`
- `ROUTER_API_KEY`
- `OPENROUTER_API_KEY` (opcional quando utilizando modelos abertos/gratuitos)

---

## 4. Procedimento de Deploy

Para compilar e realizar o deploy para o ambiente de produção:

```bash
# 1. Validação local completa
npm run typecheck
npm test

# 2. Deploy no Cloudflare
npx wrangler deploy --env=""

# 3. Execução de testes de validação ponta a ponta em produção
npx tsx scripts/verify-prod.ts
```

---

## 5. Validação Executada

O deploy foi integralmente validado com execução real contra a borda Cloudflare e banco de dados Neon:
- `GET /health` → `200 OK` (`runtime: cloudflare-worker`)
- `GET /prototype` → `200 OK` (Web UI completa com Live Preview, Chat Timeline, History & Diffs)
- `POST /prototype/sessions` → `201 Created`
- `POST /prototype/sessions/:id/prompts` → `202 Accepted`
- `POST /prototype/sessions/:id/checkpoints` → `201 Created`
- `POST /prototype/sessions/:id/promote` → `200 OK` (Promoção atômica para modo `DEVELOPMENT` com criação de tarefa no PDL)
- `GET /tasks` → `200 OK`

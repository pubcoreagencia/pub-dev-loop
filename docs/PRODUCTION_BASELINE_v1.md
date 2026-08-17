# PUB DEV LOOP — PRODUCTION BASELINE v1.0.0

Documento de referência operacional da primeira versão estável e validada em produção do **PUB DEV LOOP**.

---

## 1. Arquitetura Validada
O PUB DEV LOOP é uma plataforma distribuída de execução autônoma de tarefas de engenharia de software baseada em micro-containers isolados e orquestração serverless na Cloudflare.

```
[ HTTP Client / API ] ──> [ Cloudflare Worker API ] ──> [ Neon PostgreSQL ]
                                  │                            ▲
                                  ▼                            │
                       [ Durable Object Alarm ] ───────────────┤ (Queue Scan)
                                  │                            │
                                  ▼                            │
                       [ Firecracker Container ] ──────────────┘ (Claim & Process)
```

---

## 2. Componentes Principais

### Cloudflare Worker (`pub-dev-loop-api`)
- **Papel:** Ponto de entrada HTTP REST API e roteador principal de requisições.
- **Endpoints:**
  - `GET /health` — Verificação de saúde da API.
  - `GET /tasks` — Listagem de tarefas na fila.
  - `GET /tasks/:id` — Consulta de detalhes e estado de uma tarefa.
  - `POST /tasks` — Enfileiramento de novas tarefas.
- **Bindings:** `HYPERDRIVE` (Neon PostgreSQL connection pooler) e `WORKER_CONTAINER` (Durable Object Container).

### Durable Objects (`PubDevLoopWorkerContainer`)
- **Papel:** Agendador de tarefas e guardião da saúde do worker de fila.
- **Lifecycle:**
  - `onStart()` ativa renovação de atividade e registra `setAlarm(+35000ms)`.
  - `alarm()` é disparado periodicamente a cada 35 segundos.
  - Reivindica tarefas travadas/estagnadas no banco (`reclaimStuck()`).
  - Aciona a reinicialização da instância do container via `getContainer().start({ envVars })`.

### Firecracker Container (`Dockerfile.worker`)
- **Papel:** Micro-VM Linux isolada executando em ambiente seguro.
- **Entrypoint ESM:**
  - Resolução robusta de entrypoint via `fileURLToPath(import.meta.url)` e `path.resolve(process.argv[1])`.
  - Executa `startupRecovery()`, `createProductionWorker()` (`RouterWorker`), `repo.claim()` e ciclo de tarefas.
- **Ferramentas Integradas:** Node.js 22 LTS, Git CLI, Codex CLI (`0.147.0`).

### Neon PostgreSQL (`HYPERDRIVE`)
- **Papel:** Banco de dados relacional que armazena a fila de tarefas e rastreabilidade total.
- **Garantia Anti-Race Condition:**
  - Utiliza `FOR UPDATE SKIP LOCKED LIMIT 1` em consultas de claim.
  - Garante atomicidade em concorrência pesada (20+ chamadas simultâneas sem dupla reivindicação).

### Router Provider (`9router` / `RouterProvider`)
- **Papel:** Provedor de inteligência e chamadas LLM com suporte a ferramentas (`ToolRuntime`).
- **Resolução de Base URL:**
  - Prioridade: `process.env.ROUTER_BASE_URL` (injetado via `containerEnv`).
  - Fallback gracioso para desenvolvimento local: `http://localhost:20128/v1`.

---

## 3. Ciclo de Vida da Tarefa (Task Lifecycle)
```
QUEUED  ──>  ASSIGNED  ──>  RUNNING  ──>  TESTING  ──>  COMPLETED
   │            │              │
   └────────────┴──────────────┴───────> FAILED / RECLAIMED
```
1. **QUEUED:** Registrada na base via `POST /tasks`.
2. **ASSIGNED:** Reivindicada atomicamente por um worker via `repo.claim()`.
3. **RUNNING:** Container cria o workspace local e inicia a execução do agente.
4. **TESTING:** Execução de testes de validação automática ou suite de checagem.
5. **COMPLETED:** Tarefa finalizada com sucesso, alteração commitada via Git e workspace limpo (`workspaceCleaned = true`).

---

## 4. Mecanismo de Recuperação (Recovery Mechanism)
- **Stuck Task Reclaim:** Tarefas em estado `ASSIGNED` ou `RUNNING` que ultrapassam `leaseDeadline` de 30 segundos são resgatadas pelo alarme do Durable Object e devolvidas para `QUEUED`.
- **Startup Recovery:** Ao iniciar, o worker dentro do container executa `startupRecovery()` limpando leases expirados do próprio worker antes de solicitar novas tarefas.

---

## 5. Política de Segredos (Secrets Policy)
- Nenhuma chave API, chave privada ou string de conexão de banco de dados é commitada no repositório Git.
- Todos os segredos (`DATABASE_URL`, `GITHUB_TOKEN`, `ROUTER_API_KEY`, `ROUTER_BASE_URL`) são armazenados em Cloudflare Secrets e propagados exclusivamente em memória para o container Firecracker através de `containerEnv`.

---

## 6. Procedimento de Rollback (Rollback Procedure)
Em caso de falha crítica em produção:
1. Reverter o deploy do Cloudflare Worker para a versão estável anterior através do Cloudflare Dashboard ou CLI:
   ```bash
   npx wrangler deployments rollback [VERSION_ID]
   ```
2. Caso necessário reverter código-fonte para esta tag de baseline:
   ```bash
   git checkout v1.0.0-production-ready
   npm run build
   npx wrangler deploy
   ```

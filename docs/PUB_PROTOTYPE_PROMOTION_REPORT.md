# PUB Prototype Promotion (PP → PDL Development) — Validation Report

**Branch:** `feat/pub-prototype-mode`  
**Repository:** `pubcoreagencia/pub-dev-loop`  
**Date:** 2026-08-19  
**Status:** **`PROMOTION_FLOW = PASS`**

---

## 1. RESUMO EXECUTIVO

O fluxo formal de promoção entre **PUB Prototype (PP)** e **PUB DEV LOOP Development (PDL)** foi implementado, integrado e validado com sucesso.

- **Typecheck (`tsc --noEmit`):** PASS (0 erros)
- **Build (`tsc -p tsconfig.json`):** PASS (Exit code 0)
- **Unit & Integration Tests (`npm test`):** PASS (27 suites, 158 passed, 8 skipped)
- **Prototype Smoke (`npm run test:prototype`):** PASS (1 suite, 1 passed)
- **Suíte de Promoção e Handoff (`tests/prototype-promotion.test.ts`):** PASS (6 testes)

---

## 2. ARQUITETURA DO FLUXO PP → PDL DEVELOPMENT

```
┌─────────────────────────────────────────────────────────────┐
│                    PUB PROTOTYPE (PP)                       │
│  - Sessão no modo PROTOTYPE                                 │
│  - Prompts iterativos no mesmo workspace                    │
│  - Live Preview ativo                                       │
│  - Checkpoint aprovado registrado no PostgreSQL             │
└──────────────────────────────┬──────────────────────────────┘
                               │
                [Botão "Promover para PDL"]
                               │
                               ▼
            POST /prototype/sessions/:id/promote
                               │
            ┌──────────────────┴──────────────────┐
            ▼                                     ▼
1. Atomic Session Update             2. Persist PrototypePromotion
   - mode: 'DEVELOPMENT'                - session_id
   - status: 'PROMOTED'                 - from_mode: 'PROTOTYPE'
   - where status IN (READY, APPROVED)  - to_mode: 'DEVELOPMENT'
   - where last_checkpoint_sha NOT NULL - repository, branch, checkpoint_sha
                                        - promoted_at
                               │
                               ▼
3. Emit SSE Event: PROMOTED_TO_DEVELOPMENT
                               │
                               ▼
4. Create Development Task in PostgresTaskRepository
   - prototypeSessionId: NULL  <── [ISOLAMENTO CRÍTICO]
   - repository: session.repository
   - branch: session.branch (approved prototype branch)
   - objective & prompt: Handoff para desenvolvimento contínuo
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 PDL DEVELOPMENT WORKER                      │
│  - claim() busca apenas WHERE prototype_session_id IS NULL  │
│  - Clona o repositório                                      │
│  - Executa: git fetch origin <approved_branch>               │
│  - Executa: git checkout -B <approved_branch>               │
│  - Histórico de commits do protótipo permanece intacto      │
│  - Aplica novas tarefas de engenharia sobre a branch real   │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. REQUISITOS IMPLEMENTADOS E VALIDADOS

### 3.1 Regras de Guarda na Promoção
1. **Existência da Sessão:** Retorna `404 Not Found` caso a sessão não exista.
2. **Status Válido:** A promoção só é aceita se a sessão estiver em status `READY` ou `APPROVED`. Sessões em `BUILDING`, `PREVIEWING` ou `FAILED` são rejeitadas com `409 Conflict`.
3. **Presença de Checkpoint:** Exige `lastCheckpointSha` válido. Se for `null`, rejeita com `409 Conflict`.
4. **Concorrência Atômica:** O update no PostgreSQL (`UPDATE prototype_sessions ... WHERE id=$1 AND status IN ('READY','APPROVED') AND last_checkpoint_sha IS NOT NULL`) garante que, em disparos simultâneos de promoção, exatamente **uma requisição vence** e o restante recebe `409 Conflict`.

### 3.2 Persistência e Migrações
- Criada a migração [`db/migrations/007_prototype_promotions.sql`](file:///c:/Users/Matheus%20Paes/Documents/ChatGPT/PUB%20DEV%20LOOP/db/migrations/007_prototype_promotions.sql) com a tabela `prototype_promotions` indexada por `session_id` e `promoted_at DESC`.
- Estrutura estritamente idempotente (`CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`).

### 3.3 Criação da Development Task
- A Development Task gerada pelo handoff recebe explicitamente **`prototypeSessionId = NULL`**.
- O repositório e a branch aprovada são vinculados à tarefa.
- A tarefa entra na fila `QUEUED` padrão do PDL.

### 3.4 Isolamento Estrito de Workers
- **`PrototypeWorker`** executa `claimPrototype()` (`WHERE status = 'QUEUED' AND prototype_session_id IS NOT NULL`). Nunca captura tarefas de desenvolvimento promovidas.
- **`DevelopmentWorker`** (`RouterWorker` / `CodexWorker`) executa `claim()` (`WHERE status = 'QUEUED' AND prototype_session_id IS NULL`). Nunca captura tarefas de prototipação ativas.

### 3.5 Checkout e Continuidade no Worker de Desenvolvimento
- Quando `task.branch` é `NULL`, o worker de desenvolvimento mantém seu comportamento padrão de criar uma branch `worker/<workerName>/<taskId>`.
- Quando `task.branch` está definido (caso da promoção PP → PDL):
  1. `git clone repository <workspace>`
  2. `git fetch origin <branch>`
  3. `git checkout -B <branch> origin/<branch>`
- O worker desenvolve e auto-comita sobre a branch aprovada, preservando a árvore de commits anterior como ancestral direta.
- Se `task.branch` não existir no repositório remoto/origem, o comando `git fetch` falha explicitamente e marca a tarefa como `FAILED` com mensagem descritiva de erro.

### 3.6 Interface com o Usuário (UI)
- Adicionado botão **"Promover para PDL"** no header de Live Preview ([`src/prototype/ui.ts`](file:///c:/Users/Matheus%20Paes/Documents/ChatGPT/PUB%20DEV%20LOOP/src/prototype/ui.ts)).
- Exibição de confirmação modal nativa:  
  `"Este MVP será entregue ao PDL para desenvolvimento contínuo."`
- Atualização em tempo real do chat e status via evento SSE `PROMOTED_TO_DEVELOPMENT`.

---

## 4. SUÍTE DE TESTES EXECUTADA

| Teste | Descrição | Status |
|---|---|---|
| `1. Promotion READY -> PROMOTED` | Promove sessão aprovada, cria registro em `prototype_promotions` e gera Development Task com `prototypeSessionId === null`. | **PASS** |
| `2. Guards & 409 Rejection` | Rejeita promoção quando sessão está em `BUILDING` ou sem `lastCheckpointSha`. | **PASS** |
| `3. Atomic Concurrency` | Disparos concorrentes simultâneos: exatamente 1 promoção aceita e 1 tarefa criada; segunda chamada recebe 409. | **PASS** |
| `4. Dev Worker Branch Checkout` | Worker clona, faz checkout da branch aprovada, executa agente e comita mantendo histórico intacto. | **PASS** |
| `5. Missing Branch Explicit Failure` | Tarefa com branch inexistente falha explicitamente na etapa de fetch/checkout. | **PASS** |
| `6. Strict Worker Isolation` | Valida que `PrototypeWorker` ignora a Development Task e `DevelopmentWorker` ignora a Prototype Task. | **PASS** |
| `UI Tests` | Confirma presença do botão "Promover para PDL" e texto de confirmação na UI HTML. | **PASS** |

---

## 5. ARQUIVOS MODIFICADOS E CRIADOS

- [`db/migrations/007_prototype_promotions.sql`](file:///c:/Users/Matheus%20Paes/Documents/ChatGPT/PUB%20DEV%20LOOP/db/migrations/007_prototype_promotions.sql) *(Novo)*: Migração da tabela `prototype_promotions`.
- [`src/prototype/domain.ts`](file:///c:/Users/Matheus%20Paes/Documents/ChatGPT/PUB%20DEV%20LOOP/src/prototype/domain.ts): Interface `PrototypePromotion` atualizada com `id?: string`.
- [`src/prototype/repository.ts`](file:///c:/Users/Matheus%20Paes/Documents/ChatGPT/PUB%20DEV%20LOOP/src/prototype/repository.ts): Métodos `promoteSession`, `createPromotion`, `getPromotion`.
- [`src/api.ts`](file:///c:/Users/Matheus%20Paes/Documents/ChatGPT/PUB%20DEV%20LOOP/src/api.ts): Endpoint `POST /prototype/sessions/:id/promote` com guards, lock atômico, emissão de evento e criação da Development Task.
- [`src/worker-service.ts`](file:///c:/Users/Matheus%20Paes/Documents/ChatGPT/PUB%20DEV%20LOOP/src/worker-service.ts): Suporte a `task.branch` no `BaseWorker` (`executeOnce` e `executeWithRetry`).
- [`src/router-worker.ts`](file:///c:/Users/Matheus%20Paes/Documents/ChatGPT/PUB%20DEV%20LOOP/src/router-worker.ts): Suporte a `task.branch` no `RouterWorker.executeWithRetry` para retries na branch aprovada.
- [`src/prototype/ui.ts`](file:///c:/Users/Matheus%20Paes/Documents/ChatGPT/PUB%20DEV%20LOOP/src/prototype/ui.ts): Botão "Promover para PDL", diálogo de confirmação e listener SSE.
- [`tests/prototype-promotion.test.ts`](file:///c:/Users/Matheus%20Paes/Documents/ChatGPT/PUB%20DEV%20LOOP/tests/prototype-promotion.test.ts) *(Novo)*: Suíte completa de testes de promoção e handoff.
- [`tests/prototype-ui.test.ts`](file:///c:/Users/Matheus%20Paes/Documents/ChatGPT/PUB%20DEV%20LOOP/tests/prototype-ui.test.ts): Asserções do botão e confirmação de promoção.
- [`tests/prototype-concurrency-migrations.test.ts`](file:///c:/Users/Matheus%20Paes/Documents/ChatGPT/PUB%20DEV%20LOOP/tests/prototype-concurrency-migrations.test.ts): Inclusão da migração 007 no teste de idempotência.
- [`docs/PUB_PROTOTYPE_PROMOTION_REPORT.md`](file:///c:/Users/Matheus%20Paes/Documents/ChatGPT/PUB%20DEV%20LOOP/docs/PUB_PROTOTYPE_PROMOTION_REPORT.md) *(Novo)*: Relatório técnico formal da promoção.

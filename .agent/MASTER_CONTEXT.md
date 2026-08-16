# PUB DEV LOOP — Master Context

## Objetivo
Plataforma de desenvolvimento automatizado de loops de publicação para PUB DEV LOOP.

## Arquitetura Atual

```
TASK → 9Router → tool calls → agent COMPLETED → BaseWorker.executeOnce() → TaskFinalizer → validation → auto-commit → working tree clean → COMPLETED
```

### Fluxo Principal
1. **TASK** — `Task` é criada e colocada na fila
2. **9Router** — `RouterProvider` roteia para modelo via 9Router proxy (`ag/gemini-3-flash`, etc.)
3. **Tool calls** — Modelo usa `ToolRuntime` tools (`write_file`, `read_file`, `list_files`, `git_status`, `git_diff`, `git_commit`, `run_command`)
4. **Agent COMPLETED** — Modelo termina com `finish_reason: stop`
5. **BaseWorker.executeOnce()** — Clona repo, cria branch, executa agent, **verifica status**
6. **TaskFinalizer** — Valida mudanças, roda testes (opcional), comita automaticamente
7. **Auto-commit** — `git add -A`, `git commit`, SHA retornado
8. **Working tree clean** — Validado via `git status --short`

### Context Bootstrap
`src/context/agent-context.ts` — carrega e valida contexto operacional de `.agent/`.
Antes de qualquer task: `git fetch`, verificar HEAD vs origin/main, ler `.agent/*.md`.

### Agentes
- **Hermes** — Agente principal (este)
- **Codex** — Agente secundário (via CLI, `codex`)

### Componentes

| Component | File | Descrição |
|-----------|------|-----------|
| `RouterProvider` | `src/providers/router.ts` | Integração com 9Router proxy (OpenAI-compatible); optional `modelOverride` (4th constructor param) |
| `ToolRuntime` | `src/tools/runtime.ts` | Executa tools solicitadas pelo modelo |
| `WorkspaceSecurity` | `src/tools/security.ts` | Contém filesystem ao workspace root |
| `AgentExecutor` | `src/executor.ts` | Executa comandos via `spawn` (shell: false) |
| `BaseWorker` | `src/worker-service.ts` | Worker abstrato: delegate to executeWithRetry → finalize; AttemptResult interface |
| `TaskFinalizer` | `src/finalizer.ts` | Valida + auto-commit (bloca push/reset/clean); FAILED_UNEXPECTED_CHANGES |
| `CodexWorker` | `src/worker-service.ts` | Worker concreto para Codex CLI; single attempt, no retry |
| `AgentContext` | `src/context/agent-context.ts` | Carrega/valida contexto operacional |
| `RouterWorker` | `src/router-worker.ts` | Worker permanente usando AgentProvider (RouterProvider); executeWithRetry with retry/fallback |

### Security Policies
- `git_commit` tool: **modelo NÃO deve chamar** — system prompt instrui "Do NOT use git_commit"
- TaskFinalizer bloqueia: `push`, `remote`, `reset`, `clean`, `checkout --`, `restore`, `fetch`, `pull`, `merge`, `branch -D`/`-d`
- `sanitizeCommitMessage()`: trunca a 200 chars, remove controlchars
- `WorkspaceSecurity`: resolvePath valida paths dentro do workspace

### Decisões Arquiteturais
- Commit final é responsabilidade do **Worker/Runtime**, não do modelo
- `BaseWorker.executeOnce()` delegates to `executeWithRetry()` (abstract):
  - `FAILED` → não chama finalizer, não comita, preserva error
  - `COMPLETED` → chama `TaskFinalizer.finalize()` → auto-commit
- `FAILED_UNEXPECTED_CHANGES`: IMPLEMENTADO ✅ (WorkspaceValidator + baseline capture in finalizer.ts)
- **Provider retry/fallback**: IMPLEMENTADO ✅ (TASK-000030) — retry only between RouterProvider instances
- `executeWithRetry` pattern: subclasses manage attempt lifecycle (workspace, baseline, provider, retry)
- `AttemptResult`: unified unit (workspace + baselineSnapshot + declaredChangedFiles)
- `WorkerExecutionTrace`: ✅ IMPLEMENTADO (TASK-000031) — AttemptTrace + WorkerExecutionTrace persisted in `task.result.trace`; remainingBudget bug fixed; no workspace paths persisted
- `.agent/` é fonte canônica do contexto operacional; Git é fonte canônica do código
- `CURRENT_STATE.md` uses `LAST_KNOWN_STABLE_COMMIT` (not volatile HEAD) to avoid bootstrap loop

### Retry/Fallback Design (TASK-000030)
- **Retryable statuses**: TIMED_OUT, ROUTER_CONNECTION_ERROR, ROUTER_TIMEOUT, HTTP 429, HTTP 5xx
- **Fail-fast statuses**: COMPLETED, START_ERROR, TOOL_LOOP_LIMIT, HTTP 4xx (except 429), httpStatus undefined (fail-closed)
- **Provider chain**: `ROUTER_PROVIDER_CHAIN="router:modelA,router:modelB"` — RouterProvider instances only
- **Global deadline**: `deadline = globalStart + ROUTER_TIMEOUT_TOTAL_MS` (default 180000)
- **Per-attempt timeout**: `min(ROUTER_TIMEOUT_PER_ATTEMPT_MS, remainingBudget)` (default 60000)
- **Backoff**: `min(ROUTER_BACKOFF_MS * attempt, remainingBudget)` (default 1000)
- **Default**: 1 provider, 1 attempt (no ROUTER_PROVIDER_CHAIN)
- **CodexWorker**: single attempt, no retry chain

### Limitations Conhecidas
1. `CODEX_CLI_UNAVAILABLE` — CLI Codex não instalado no Windows (environmental)
2. `FAILED_UNEXPECTED_CHANGES` — IMPLEMENTADO ✅ (WorkspaceValidator + baseline)
3. `RouterWorker` permanente — IMPLEMENTADO ✅ (with retry/fallback, TASK-000030)
4. REAL E2E test requires 9Router credentials (environmental: HTTP 404 "No active credentials")
5. GitHub web UI returns 404 (Git remote + push funcionam)

### Testes
- `tests/e2e-auto-commit.test.ts` — 4 testes (simulação)
- `tests/e2e-real-worker.test.ts` — 4 pass | 1 fail (REAL E2E: 9Router credentials 404)
- `tests/finalizer.test.ts` — 11 testes (unit)
- `tests/git-tool.test.ts` — 13 testes (integration)
- `tests/executor.test.ts` — 6 testes (1 environmental: CODEX_CLI_UNAVAILABLE)
- `tests/context/` — 3 arquivos, 23 testes (context loading, git state, handoff)
- `tests/worker-retry.test.ts` — 13 testes (NEW: retry/fallback + workspace isolation)
- `tests/worker-tracing.test.ts` — 11 testes (NEW: execution trace + bug fix)
- `tests/router-worker.test.ts` — 8 testes (unit)
- `src/context/cli.ts` — CLI de validação

### Comandos Oficiais
```bash
npm run build        # tsc -p tsconfig.json
npm test             # vitest run
npx vitest run tests/worker-retry.test.ts  # 13 tests (new)
# E2E real (necessita 9Router proxy rodando + credentials):
RUN_9ROUTER_E2E=1 npx vitest run tests/e2e-real-worker.test.ts
# Context validation:
npx tsx src/context/cli.ts --validate
npx tsx src/context/cli.ts --summary
npx tsx src/context/cli.ts --git-state
```

### Estado Atual
- Branch: `main` @ `e0843c0` (synced with origin)
- Origin: `pubcoreagencia/pub-dev-loop`
- Build: ✅ exit 0
- Tests: 102 pass | 1 failed (CODEX_CLI_UNAVAILABLE, environmental) | 8 skipped | 1 fail (REAL E2E: 9Router credentials)
- Context: ✅ bootstrapped + validated (23 unit tests)
- RouterWorker: ✅ permanente implementado com retry/fallback (TASK-000030)
- Execution Trace: ✅ AttemptTrace + WorkerExecutionTrace (TASK-000031)

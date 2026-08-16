# Current State

## Último Commit Estável
`6c21bd9` — feat: TASK-000032 — production execution path unification + crash recovery + git identity

## Branch
main

## Git State (runtime)
- Obtenha HEAD real via: `git rev-parse HEAD`
- Ou via CLI: `npx tsx src/context/cli.ts --validate`
- Este arquivo NÃO registra o SHA do commit que o contém (evita bootstrap loop).
- Ver: DECISIONS.md §10 (Volatile HEAD Bootstrap Loop)

## Último Teste Validado
```
npm run build → ✅ exit 0
npx vitest run tests/context/ → 23 passed (3 files)
npx vitest run tests/router-worker.test.ts → 8 passed
npx vitest run tests/finalizer.test.ts → 11 passed
npx vitest run tests/worker-retry.test.ts → 13 passed
npx vitest run tests/worker-tracing.test.ts → 11 passed (NEW)
npx vitest run tests/router.test.ts → 6 passed
RUN_9ROUTER_E2E=1 npx vitest run tests/e2e-real-worker.test.ts → 4 passed | 1 failed (REAL E2E: environmental — 9Router credentials 404)
npx vitest run → 128 passed | 1 failed (CODEX_CLI_UNAVAILABLE, environmental) | 8 skipped
npx vitest run tests/production-entrypoint.test.ts → 4 passed (NEW)
npx vitest run tests/crash-recovery.test.ts → 11 passed (NEW)
npx vitest run tests/workspace-cleanup.test.ts → 11 passed (NEW)
npx tsx src/context/cli.ts --validate → ✅ Context valid. Git state consistent.
```

## Build
✅ exit code 0

## RouterWorker Status
✅ Permanente — `src/router-worker.ts` (refactored with retry/isolation/deadline)
- Extends BaseWorker, uses AgentProvider
- Implements executeWithRetry() with provider retry/fallback via ROUTER_PROVIDER_CHAIN
- Each attempt: fresh workspace via mkdtemp, fresh git clone, baseline capture
- Hard global deadline enforcement (ROUTER_TIMEOUT_TOTAL_MS)
- Provider timeout = min(ROUTER_TIMEOUT_PER_ATTEMPT_MS, remainingBudget)
- Backoff capped to remaining deadline
- HTTP status classification: 429/5xx retryable, 4xx fail-fast, undefined fail-closed
- RouterProvider constructor accepts optional modelOverride (4th param)
- getProviderChain() supports only RouterProvider instances (kind === 'router')

## Production Execution Path (TASK-000032 Phase 1)
✅ worker.ts — AGENT_PROVIDER=9router → RouterWorker (TASK-000030 active)
- createProductionWorker() exported from src/worker.ts
- When AGENT_PROVIDER set (e.g. '9router'): RouterWorker with full retry/fallback
- When AGENT_PROVIDER not set: CodexWorker (Codex CLI path, separate feature)
- Tests: tests/production-entrypoint.test.ts (4 tests)

## FAILED_UNEXPECTED_CHANGES Status
✅ IMPLEMENTADO — `src/finalizer.ts`
- WorkspaceSnapshot interface + WorkspaceValidator class
- Baseline captured BEFORE agent runs in BaseWorker.executeOnce()
- detectUnexpectedChanges: compares git status vs declaredChangedFiles
- FAILED_UNEXPECTED_CHANGES → no commit (fail closed)
- Declared files → COMPLETED + commit
- 11 unit tests in tests/finalizer.test.ts

## Limitations
1. CODEX_CLI_UNAVAILABLE — CLI Codex não instalado no Windows (environmental)
2. E2E real requires RUN_9ROUTER_E2E=1 + 9Router proxy (validado com 9Router ✅)
3. GitHub web UI returns 404 (mas Git remote + push funcionam)
4. Crash recovery (lease/heartbeat/reclaim) implemented — requires DB schema migration 002_lease.sql
5. Git identity configured at runtime via git config + Dockerfile.system fallback
6. Staging deploy: docker-compose.staging.yml + .env.staging.example ready, requires 9Router credentials

## Task Atual
TASK-000032 — IMPLEMENTING (commit 6c21bd9)

## Tasks Concluídas
- TASK-000024 — PASS ✅ (commit f8ac9bb)
- TASK-000025 — PASS ✅ (commit a3ef616)
- TASK-000026 — PASS ✅ (commit 41c72e2)
- TASK-000027 — PASS ✅ (checkpoint sync verified)
- TASK-000028 — PASS ✅ (commit fe37d6c + d94fedc — RouterWorker permanente + production-clean)
- TASK-000029 — PASS ✅ (commit 1494669 — FAILED_UNEXPECTED_CHANGES workspace validation)
- TASK-000030 — PASS ✅ (commit 86850ac — provider retry/fallback with workspace isolation)
- TASK-000031 — PASS ✅ (commit e0843c0 — structured execution traces + remainingBudget bugfix)
- TASK-000032 Phase 1-5 — DONE ✅ (commit 6c21bd9 — production path unification + crash recovery + git identity)

## Próxima Task
TASK-000032 (continuation) — crash recovery + staging deployment

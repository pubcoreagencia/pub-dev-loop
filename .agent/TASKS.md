# Tasks Log

## TASK-000024
- **Objetivo**: Validar e fechar o ciclo auto-commit (TASK → 9Router → tool calls → agent → COMPLETED → Worker → TaskFinalizer → commit)
- **Status**: COMPLETE ✅
- **Commit**: `f8ac9bb` — test: add E2E auto-commit validation test
- **Tests**: `tests/e2e-auto-commit.test.ts` — 4/4 passed (simulação)
- **Limitações**: E2E testa apenas TaskFinalizer, não BaseWorker real

## TASK-000025
- **Objetivo**: Corrigir contrato BaseWorker + validar E2E real Worker + 9Router
- **Status**: COMPLETE ✅
- **Commit**: `a3ef616` — fix: validate worker completion before auto commit
- **Changes**:
  1. `BaseWorker.executeOnce()` guard: FAILED agent → no finalize, no commit
  2. `TaskFinalizer.execRaw`: execSync for PATH resolution
  3. `RouterProvider`: system prompt "Do NOT use git_commit"
  4. `ProviderTaskResult`: added `toolCalls`, `toolRounds` fields
  5. `AgentExecutor`: shell:false for reliable cross-platform execution
- **Files**: `src/executor.ts`, `src/finalizer.ts`, `src/providers/router.ts`, `src/providers/types.ts`, `src/worker-service.ts`, `tests/e2e-real-worker.test.ts` (614 lines, 5 testes)
- **Tests**: 5/5 E2E real passed, 47/48 full suite passed
- **Limitations**: CODEX_CLI_UNAVAILABLE (environmental), FAILED_UNEXPECTED_CHANGES (not yet implemented)

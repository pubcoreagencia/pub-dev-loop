# Current State

## Último Commit Estável
`2cbd62b` — TASK-000033: fix healthcheck (node-based API check, RouterWorker-aware health script)

## Branch
main

## Git State (runtime)
- HEAD: 2cbd62b7e7d5172358f492f1d57675ba003828ad
- Local == Remote: YES
- Worktree: CLEAN

## Último Teste Validado
```
npx tsc -p tsconfig.json --noEmit → ✅ exit 0
npx tsx src/context/cli.ts --validate → ✅ Context valid. Git state consistent.
npx vitest run → 128 passed | 1 failed (CODEX_CLI_UNAVAILABLE — environmental) | 8 skipped
```

## Staging Validation (TASK-000033 — ALL PASSED)
```
Containers: postgres (healthy) ✅ | api (healthy) ✅ | worker (healthy) ✅
9Router: http://host.docker.internal:20128/v1 → HTTP 200 ✅
Worker type: RouterWorker ✅ (not CodexWorker)
Git identity: PUB DEV LOOP Worker <worker@pub-dev-loop.internal> ✅

Real E2E Task: 7b3ace93-8615 — COMPLETED, commit=319e451ff3, provider=9router, model=ag/gemini-3-flash
Retry/Fallback Task: c2ee145e-f3d1 — COMPLETED, 2 attempts, timeout→retry, commit=bf5c61d2bc
Crash Recovery: task killed during RUNNING → lease expired → reclaimed → COMPLETED
Unexpected Changes: detected unexpected.txt → FAILED_UNEXPECTED_CHANGES, no commit ✅
Provider Failure: nonexistent model → 404 → FAILED fast, no finalize, commitSha=null ✅
Workspace Cleanup: orphan dir removed by startup recovery ✅
```

## Production Execution Path
✅ `worker.ts` — `createProductionWorker()` exports RouterWorker when `AGENT_PROVIDER` set
- AGENT_PROVIDER=9router → RouterWorker with full retry/fallback (TASK-000030)
- AGENT_PROVIDER not set → CodexWorker (CLI path)
- `AGENT_MODE=codex` + `AGENT_PROVIDER` set → throws (conflict guard)

## RouterWorker Status
✅ Permanent — `src/router-worker.ts`
- executeWithRetry() with provider retry/fallback via ROUTER_PROVIDER_CHAIN
- Each attempt: fresh workspace via mkdtemp, fresh git clone, baseline capture
- HTTP status classification: 429/5xx retryable, 4xx fail-fast, undefined fail-closed

## Crash Recovery (TASK-000032 Phase 3)
✅ Lease/heartbeat model
- claim() sets lease_owner, lease_deadline (30s window)
- heartbeat() refreshes every 10s (WORKER_HEARTBEAT_MS)
- reclaimStuck() on worker startup reclaims expired leases
- Confirmed: killed worker → lease expired → task reclaimed → resumed

## Workspace Cleanup (TASK-000032 Phase 4)
✅ Conservative orphan cleanup
- Scans tmpdir for pub-dev-loop-* and pu-dev-loop-attempt-* dirs
- Preserves DB-referenced workspaces
- Only removes dirs older than 24h
- Verified: old orphan dir removed, active dirs preserved

## Git Identity (TASK-000032 Phase 5)
✅ Runtime configuration
- worker.ts sets `git config user.name/email` from env vars
- Dockerfile.worker has `--global` fallback
- Staged file commit verified (SHA persists in PostgreSQL)

## FAILED_UNEXPECTED_CHANGES Status
✅ Implemented — `src/finalizer.ts`
- Baseline captured before agent runs
- detectUnexpectedChanges compares git status vs declaredChangedFiles
- FAILED_UNEXPECTED_CHANGES → no commit (fail closed)
- Verified: agent-created unexpected.txt via shell → detection → FAILED ✅

## Limitations
1. CODEX_CLI_UNAVAILABLE — CLI Codex not installed on Windows host (environmental)
2. GitHub repo `pubcoreagencia/pub-dev-loop.git` is private — requires GitHub token for full clone
3. Staging smoke test uses public repo (octocat/Hello-World) for validation

## Tasks Completed
- TASK-000029 — PASS ✅
- TASK-000030 — PASS ✅ (provider retry/fallback with workspace isolation)
- TASK-000031 — PASS ✅ (structured execution traces)
- TASK-000032 — PASS ✅ (production path unification + crash recovery + git identity)
- TASK-000033 — IN PROGRESS (staging deployment + smoke test)

## Current Task
TASK-000033 — Real Staging Deployment & Smoke Test

# Handoff Protocol

## 4.1 — Handoff State

| Field | Value |
|-------|-------|
| **CURRENT_TASK** | TASK-000029 (COMPLETE) |
| **CURRENT_AGENT** | Hermes |
| **CURRENT_BRANCH** | main |
| **LAST_KNOWN_STABLE_COMMIT** | `521c4bd` |
| **LAST_TESTS_RUN** | 78 passed, 1 failed (CODEX_CLI_UNAVAILABLE), 8 skipped (+ 11 finalizer tests, 5 E2E real) |
| **BUILD** | ✅ exit 0 |
| **KNOWN_LIMITATIONS** | 1. CODEX_CLI_UNAVAILABLE (environmental)<br>2. E2E real requires RUN_9ROUTER_E2E=1 + 9Router proxy<br>3. GitHub web UI returns 404 (Git remote works) |
| **DO_NOT_REPEAT** | RouterWorker permanente em src/router-worker.ts (production-clean, 76 lines). FAILED_UNEXPECTED_CHANGES implementado em src/finalizer.ts (WorkspaceValidator + baseline capture). Test observability no RouterWorkerSpy. Context bootstrap em src/context/agent-context.ts. |
| **NEXT_TASK** | TASK-000030 |
| **OPEN_RISKS** | 1. E2E real precisa de 9Router proxy (RUN_9ROUTER_E2E=1 + 9Router running)<br>2. Codex CLI não instalado no Windows (environmental) |

## 4.2 — Before Starting Any Task

1. `git fetch origin`
2. `git branch --show-current` → confirm `main`
3. `git status --short` → confirm clean
4. `git rev-parse HEAD` → note LOCAL_HEAD
5. `git rev-parse origin/main` → note REMOTE_HEAD
6. If `LOCAL_HEAD != REMOTE_HEAD` → STOP, run `AgentContext.validateGit()` to see if it's safe
7. Read `.agent/MASTER_CONTEXT.md`
8. Read `.agent/CURRENT_STATE.md`
9. Read `.agent/TASKS.md`
10. Read `.agent/DECISIONS.md`
11. Read `.agent/HANDOFF.md`
12. Load context via `AgentContext.load()` (src/context/agent-context.ts)

## 4.3 — After Completing Any Task

1. Update `.agent/CURRENT_STATE.md` (LAST_KNOWN_STABLE_COMMIT, build, tests status)
2. Update `.agent/TASKS.md` (add completed task)
3. Update `.agent/HANDOFF.md` (new handoff state)
4. Commit code + context in the same change when possible
5. Run `npm run build` + `npm test` before committing
6. Do NOT record the commit's own SHA inside the files it contains (bootstrap loop)

## 4.4 — Branch Protocol

When two agents work simultaneously:
- Codex: `agent/codex/<task-id>`
- Hermes: `agent/hermes/<task-id>`

## 4.5 — Work Preservation

If `LOCAL_HEAD != origin/main`:
- Do NOT run `git reset --hard`, `git clean`, `git pull --rebase` automatically.
- Identify local commits first, preserve work.

## 4.6 — Codex ↔ Hermes Handoff

Codex and Hermes are different agents using the same repository.
Neither should consider its own session context as canonical.
Both must read `.agent/*` before starting, and update it after finishing.

### Continuity Test
`tests/context/handoff.test.ts` proves that a second agent reading `.agent/` from the repo (without chat history) can:
- Identify the last completed task
- Identify the last commit (LAST_KNOWN_STABLE_COMMIT)
- Identify known limitations
- Identify the NEXT_TASK
- Continue working without prior conversation

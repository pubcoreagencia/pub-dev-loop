# Handoff Protocol

## 4.1 — Handoff State

| Field | Value |
|-------|-------|
| **CURRENT_TASK** | TASK-000034 (COMPLETE) |
| **CURRENT_AGENT** | Hermes |
| **CURRENT_BRANCH** | main |
| **LAST_KNOWN_STABLE_COMMIT** | `d327c89` |
| **LAST_TESTS_RUN** | 128 passed, 1 failed (CODEX_CLI_UNAVAILABLE, ambiental), 8 skipped | Build: exit 0 ✅ | Staging: containers prontos (Docker Desktop indisponível neste ambiente) |
| **BUILD** | ✅ exit 0 |
| **KNOWN_LIMITATIONS** | 1. CODEX_CLI_UNAVAILABLE (ambiental — Codex CLI não instalado no Windows)<br>2. E2E real requer 9Router credentials (HTTP 404 "No active credentials")<br>3. GitHub web UI retorna 404 (Git remote + push funcionam)<br>4. Docker Desktop indisponível neste ambiente Windows — staging containers não podem ser iniciados localmente |
| **DO_NOT_REPEAT** | RouterWorker: executeWithRetry() cria fresh workspace per attempt, clones repo, captures baseline, executes provider, returns unified AttemptResult. Retry only between RouterProvider instances. Fail-closed HTTP classification. BaseWorker.executeOnce() delegates to executeWithRetry, passes winner workspace+baseline+declaredChangedFiles to TaskFinalizer. CodexWorker: single attempt, no retry. RouterProvider: constructor accepts modelOverride (4th param). finalizer.ts and security.ts UNTOUCHED. Tracing: AttemptTrace + WorkerExecutionTrace persisted in task.result.trace; no workspace paths persisted; remainingBudget bug in catch block fixed. Git credentials: configureGitCredentials() configura git credential helper que lê GITHUB_TOKEN do ambiente em runtime (sem escrever arquivo nenhum — token nunca em URL, .env, código, log, trace ou commit). Staging: docker-compose.staging.yml tem GITHUB_TOKEN: ${GITHUB_TOKEN} interpolado do host (sem valor armazenado no arquivo). |
| **NEXT_TASK** | TASK-000035 (novo — definir escopo) |
| **OPEN_RISKS** | 1. REAL E2E test requires 9Router credentials (ambiental)<br>2. Codex CLI not installed on Windows (ambiental)<br>3. Docker Desktop indisponível neste ambiente — staging containers validados apenas via build + testes unitários |

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

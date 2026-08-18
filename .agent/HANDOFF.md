# Handoff Protocol

## 4.1 — Handoff State

| Field | Value |
|-------|-------|
| **CURRENT_TASK** | TASK-000035 (COMPLETE) |
| **CURRENT_AGENT** | Hermes |
| **CURRENT_BRANCH** | main |
| **LAST_KNOWN_STABLE_COMMIT** | `b5d65e8` |
| **LAST_TESTS_RUN** | 138 passed, 8 skipped | Build: exit 0 ✅ | Real E2E: 9Router gemini-3.7-flash PASS ✅ |
| **BUILD** | ✅ exit 0 |
| **KNOWN_LIMITATIONS** | 1. CODEX_CLI_UNAVAILABLE (ambiental — Codex CLI não instalado no Windows)<br>2. GitHub web UI retorna 404 para visualização web (Git remote + push funcionam perfeitamente)<br>3. Staging containers locais dependem de Docker Desktop |
| **DO_NOT_REPEAT** | Não recriar RouterWorker. RouterWorker permanente implementado com retry/fallback na fila [primaryModel, ...fallbackModels], backoff exponencial e suporte a retry-after em HTTP 429. TaskFinalizer cuida do commit automático. Nenhuma chave secreta em disco ou git. |
| **NEXT_TASK** | TASK-000036 (PUB HOLDING REPOSITORY INTEGRATION / UNIFICATION) |
| **OPEN_RISKS** | Nenhum blocker ativo para o PUB DEV LOOP. |

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

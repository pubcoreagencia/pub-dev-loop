# Handoff Protocol

## 4.1 — Handoff State

| Field | Value |
|-------|-------|
| **CURRENT_TASK** | TASK-000026 (COMPLETE) |
| **CURRENT_AGENT** | Hermes |
| **CURRENT_BRANCH** | main |
| **CURRENT_HEAD** | `ed4142b01e8c712340cde8fdfcf9b8b277465f10` |
| **REMOTE_HEAD** | `851ca16c833c63eb755ed15dc2202c9430e2e245` (1 commit behind) |
| **CHANGES** | Context bootstrap module + 23 tests + .agent/ updates |
| **TESTS** | 70 passed | 1 failed (CODEX_CLI_UNAVAILABLE) | 8 skipped; 23 context tests pass |
| **BUILD** | ✅ exit 0 |
| **KNOWN_LIMITATIONS** | 1. CODEX_CLI_UNAVAILABLE (environmental)<br>2. FAILED_UNEXPECTED_CHANGES (not implemented)<br>3. RouterWorker permanente (not implemented)<br>4. GitHub web UI returns 404 (Git remote works)<br>5. 1 commit local ahead (pending push approval) |
| **NEXT_TASK** | TASK-000027 — RouterWorker permanente |
| **DO_NOT_REPEAT** | Context bootstrap + sync protocol already implemented in 851ca16 + ed4142b. Do NOT re-create .agent/ files, re-implement agent-context.ts, or re-run sync push without checking git state first. |
| **OPEN_RISKS** | 1. LOCAL_HEAD != REMOTE_HEAD until push approved<br>2. Local agent sessions may diverge if git fetch not run before task |

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

1. Update `.agent/CURRENT_STATE.md` (HEAD, build, tests status)
2. Update `.agent/TASKS.md` (add completed task)
3. Update `.agent/HANDOFF.md` (new handoff state)
4. Commit code + context in the same change when possible
5. Run `npm run build` + `npm test` before committing

## 4.4 — Branch Protocol

When two agents work simultaneously:
- Codex: `agent/codex/<task-id>`
- Hermes: `agent/hermes/<task-id>`

Until a formal orchestration system exists, do NOT assume two local sessions pointing to `main` are synchronized.

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
- Identify the last commit
- Identify known limitations
- Identify the NEXT_TASK
- Continue working without prior conversation

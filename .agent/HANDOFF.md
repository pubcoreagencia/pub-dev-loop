# Handoff Protocol

## 4.1 — Handoff State

| Field | Value |
|-------|-------|
| **CURRENT_TASK** | TASK-000025 (COMPLETE) |
| **CURRENT_AGENT** | Hermes |
| **CURRENT_BRANCH** | main |
| **CURRENT_HEAD** | `a3ef6163ef09fa24cadb002908b3cbdc1fe12f0d` |
| **REMOTE_HEAD** | `a3ef6163ef09fa24cadb002908b3cbdc1fe12f0d` (synced ✅) |
| **CHANGES** | 6 files committed in `a3ef616` |
| **TESTS** | 47/48 pass (1 environmental: CODEX_CLI_UNAVAILABLE); E2E 9Router 5/5 pass |
| **BUILD** | ✅ exit 0 |
| **KNOWN_LIMITATIONS** | 1. CODEX_CLI_UNAVAILABLE (no codex CLI installed)<br>2. FAILED_UNEXPECTED_CHANGES not implemented<br>3. RouterWorker permanente not implemented |
| **NEXT_TASK** | Create permanent RouterWorker (`src/router-worker.ts`) |
| **DO_NOT_REPEAT** | Do NOT re-implement auto-commit, finalize guard, or system prompt instruction — already done in `a3ef616`. Do NOT re-run the same E2E tests unless validating a code change. |

## 4.2 — Before Starting Any Task

1. `git fetch origin`
2. `git branch --show-current` → confirm `main`
3. `git status --short` → confirm clean
4. Read `.agent/MASTER_CONTEXT.md`
5. Read `.agent/CURRENT_STATE.md`
6. Read `.agent/TASKS.md`
7. Read `.agent/DECISIONS.md`
8. Read `.agent/HANDOFF.md`

## 4.3 — After Completing Any Task

1. Update `.agent/CURRENT_STATE.md` (HEAD, build, tests status)
2. Update `.agent/TASKS.md` (add completed task)
3. Update `.agent/HANDOFF.md` (new handoff state)
4. Commit code + context in the same change when possible

## 4.4 — Branch Protocol

When two agents work simultaneously:
- Codex: `agent/codex/<task-id>`
- Hermes: `agent/hermes/<task-id>`

Until a formal orchestration system exists, do NOT assume two local sessions pointing to `main` are synchronized.

## 4.5 — Work Preservation

If `LOCAL_HEAD != origin/main`:
- Do NOT run `git reset --hard`, `git clean`, `git pull --rebase` automatically.
- Identify local commits first, preserve work.

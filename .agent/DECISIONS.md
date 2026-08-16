# Architectural Decisions

## 1. Commit Responsibility
- **The model/9Router does NOT control the final commit.**
- The `TaskFinalizer` (called by `BaseWorker.executeOnce()`) performs `git add -A && git commit` after the agent returns `COMPLETED`.
- The `RouterProvider` system prompt explicitly instructs: `"IMPORTANT: Do NOT use git_commit tool — the worker will automatically commit changes after you complete."`

## 2. FAILED Agent Guard
- **`BaseWorker.executeOnce()` checks `result.status` before calling `finalize()`.**
- If agent returns `FAILED`: TaskFinalizer is NOT called, NO commit, NO git add. Task is marked `FAILED`, error is preserved.
- If agent returns `COMPLETED`: TaskFinalizer.finalize() runs → validation → auto-commit.

## 3. FAILED_UNEXPECTED_CHANGES — NOT YET IMPLEMENTED
- `allowUnexpectedFiles?: boolean` exists in `FinalizeOptions` but is **NOT applied**.
- `git add -A` commits all staged changes — cannot distinguish expected vs unexpected files.
- A proper implementation requires a **workspace snapshot before/after** the agent task.
- `TASK_EXPECT_CHANGED_FILES` is NOT implemented — requires explicit file expectations per task.
- Limitation documented in `tests/e2e-real-worker.test.ts`.

## 4. Auto-Push / PR / Merge
- **TaskFinalizer does NOT push.**
- `push`, `remote`, `reset`, `clean`, `checkout --`, `restore`, `fetch`, `pull`, `merge`, `branch -D` are all blocked.
- Push/PR/merge auto is a future task, not part of current scope.

## 5. Commit Message Sanitization
- `sanitizeCommitMessage()`: truncates to 200 chars, removes control characters (`\x00-\x08`, `\x0B`, `\x0C`, `\x0E-\x1F`, `\x7F`).

## 6. Cross-Platform Execution (Windows/MSYS)
- `AgentExecutor.execute()`: uses `spawn` with `shell: false` for arg safety. Git PATH resolution handled by MSYS environment.
- `TaskFinalizer.execRaw()`: uses `execSync` (not `spawn`) for reliable PATH resolution on Windows.
- `BaseWorker.run()`: uses `execSync` with quoted args for git clone/checkout.

## 7. RouterWorker Not Implemented
- `TestRouterWorker` in `tests/e2e-real-worker.test.ts` is a **test adapter only**, not a permanent worker.
- A permanent `RouterWorker` (`src/router-worker.ts`) extending `BaseWorker` with `RouterProvider` is a future task.

## 8. ExecutionRequest Interface
- `detached?: boolean` — opt-in for detached process spawning (not yet used, forward-compat).

## 9. Tool Surface Area
- Available tools: `read_file`, `write_file`, `list_files`, `git_status`, `git_diff`, `git_commit`, `run_command`
- `git_commit` is blocked at the system-prompt level (model discouraged from using it; worker handles auto-commit).


## 10. Volatile HEAD Bootstrap Loop

### Problem
When a context file (e.g., `CURRENT_STATE.md`) records the exact git SHA of the
commit that *contains* that file, a bootstrap loop occurs:

1. Commit contains `CURRENT_STATE.md` with SHA `aaa...`
2. HEAD is now `bbb...` (different from what's recorded)
3. Context file says `aaa...` but git HEAD is `bbb...` → context is "stale"
4. To fix → update context file → new commit → HEAD changes to `ccc...` → still stale

### Solution
**Do NOT record the exact SHA of the containing commit in context files.**

Instead:
- `CURRENT_STATE.md` uses `LAST_KNOWN_STABLE_COMMIT` — the last known good commit
  from a *previous* commit, not the current one.
- `HANDOFF.md` uses `LAST_KNOWN_STABLE_COMMIT` instead of `CURRENT_HEAD`.
- To get the **real** current HEAD, agents call `git rev-parse HEAD` at runtime
  via `AgentContext.getGitState()` or `cli.ts --git-state`.

### Test Validation
`tests/context/handoff.test.ts` uses `git merge-base --is-ancestor` to validate
that the context's `LAST_KNOWN_STABLE_COMMIT` is an ancestor of the current
`git rev-parse HEAD` — this handles the bootstrap delay correctly (the context
HEAD will always be 1-N commits behind the actual HEAD when committed in the
same batch).

### Branch Protocol Note
- `main` remains the canonical branch.
- Work-in-progress: `agent/codex/<task-id>` or `agent/hermes/<task-id>`.
- Never rebase or force-push to `main`.

# AGENTS.md — Operational Instructions for AI Agents in PDL

> Target: any AI assistant, developer, or automated engine entering PUB DEV LOOP (PDL).
> Human operator: **MATHEUS**.
> Canonical institutional persistence: **Git/GitHub**.
> Evidence rule: current runtime and test evidence outrank derived documentation.

## 1. Entry Protocol

On every new session or recovery:

1. Read `PDL_OPERATIONAL_STATE.md`.
2. Inspect `git status --short`, recent history, and current/remote refs.
3. Read phase-specific evidence under `docs/evidence/` and `docs/operations/`.
4. Verify the current implementation before changing anything.
5. Address/refer to the operator as **MATHEUS**.

Do not rely on chat history, agent memory, or IDE scratchpads as institutional state.

## 2. Non-Negotiable Rules

### RULE 1 — FREE MODELS ONLY

Automated execution may use only models with verified **0 prompt price and 0 completion price**. Unknown pricing is rejected. `:free` alone is not sufficient evidence. Paid models are forbidden in automated paths.

Current verified policy is defined in `src/providers/model-registry.ts` and related routing policy code. Do not invent provider-specific free tiers in this document.

### RULE 2 — FAIL CLOSED

Governance denial, ambiguous authorization, invalid state, database failure, security-policy failure, or another explicitly non-recoverable condition must stop the relevant autonomous path. Never bypass governance to make a task succeed.

### RULE 3 — PRODUCT ISOLATION

PDL is the engine. Product repositories are external targets. Never commit product workspaces, clones, product secrets, or product artifacts into the PDL engine repository.

### RULE 4 — PP ISOLATED

PP is a separate project/repository. Do not add direct internal PDL↔PP coupling, PP database foreign keys, or PP implementation changes while working on PDL.

### RULE 5 — NO SECRETS

Never stage or commit `.env`, `.env.*`, tokens, credentials, private keys, or passwords.

### RULE 6 — NON-DESTRUCTIVE GIT

Never use `git reset --hard`, `git clean`, destructive restore/checkout operations, or any equivalent action that discards existing work.

### RULE 7 — FAST-FORWARD ONLY

Never force-push. If remote history diverges, stop and report instead of rewriting remote history.

### RULE 8 — EXPLICIT PHASE AUTHORIZATION

Do not implement Phase 5.5 Step 5, Step 6, Campaign orchestration, or unrestricted autonomy without explicit written authorization from **MATHEUS**.

## 3. Current Implementation Map

Use these paths as the current implementation locations:

- Scheduler: `src/pdl/scheduler/`
- Retry policy: `src/pdl/retry/`
- DLQ: `src/pdl/dlq/`
- Reaper: `src/pdl/reaper/`
- Governance: `src/pdl/governance/`
- Persistence: `src/pdl/persistence/`
- Provider registry: `src/providers/model-registry.ts`
- Provider routing: `src/providers/model-routing-policy.ts`

Historical documentation may reference older paths. Current code wins.

## 4. Verified Scheduler Contract

`src/pdl/scheduler/types.ts` currently defines:

`IDLE | RUNNING | STOPPED | BLOCKED | COMPLETED | FAILED`

Default configuration:

- `pollIntervalMs = 10000`
- `maxConcurrentTasks = 1`
- `authorizedBy = human-operator`

Do not document `STOPPING` as a scheduler state unless the implementation changes.

## 5. Verified Retry / DLQ Contract

Migration `db/migrations/023_pdl_task_retry_dlq.sql` defines retry metadata and the durable DLQ table **`pdl_dead_letters`**.

Default retry policy from `src/pdl/retry/types.ts`:

- base delay: 2000 ms
- factor: 2
- max delay: 60000 ms
- max retries: 3
- jitter: 0 by default

Failure classes are `RETRYABLE`, `NON_RETRYABLE`, and `POISON`.

Do not describe the default policy as jittered when `jitterMs` is zero.

## 6. Verified Reaper Contract

`src/pdl/reaper/types.ts` defines default values:

- interval: 60000 ms
- batch size: 10
- stale grace period: 0 ms

The reaper is governance-aware and integrates stale-task recovery with retry/DLQ/quarantine handling.

## 7. Verification Discipline

Before implementation changes:

- inspect the working tree;
- inspect the actual code and migrations;
- run the applicable typecheck/build/tests when the repository runtime is available;
- record meaningful evidence in Git;
- stage only explicit files;
- commit with a precise conventional message;
- verify local HEAD, `origin/main`, and remote `refs/heads/main` before handoff.

Never claim a test passed unless an actual execution result or dated evidence artifact supports it.

## 8. Current Phase Gate

Phase 5.5 Steps 1-4 are published. Step 5 is **not implemented** and remains **blocked**.

The next authorized task is documentation/code consistency work only. After that checkpoint, wait for explicit authorization from **MATHEUS** before implementing Step 5.

## 9. Handoff Contract

Every meaningful session should leave enough canonical Git evidence for another agent to continue without prior chat context:

`RETRIEVE → VERIFY → PLAN → EXECUTE → TEST → CAPTURE EVIDENCE → COMMIT → PUSH → HAND OFF`

If evidence is unavailable, mark the fact as unknown rather than guessing.

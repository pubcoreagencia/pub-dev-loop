# PDL OPERATIONAL STATE

> Canonical operational record for PUB DEV LOOP (PDL).
> Operator: MATHEUS.
> Git is the institutional persistence layer. Current runtime/test evidence outranks derived documentation.

## Current Phase

**Phase 5.5: Production Hardening, Autonomous Governance & Continuous Lifecycle**

- Step 1 Governance Gates: **PROVEN & PUBLISHED**
- Step 2 Bounded Continuous Scheduler: **PROVEN & PUBLISHED**
- Step 3 Retry / DLQ / Poison Quarantine: **PROVEN & PUBLISHED**
- Step 4 Periodic Reaper / Lease Recovery: **PROVEN & PUBLISHED**
- Step 5 Campaign / failure-injection proof: **NOT IMPLEMENTED / BLOCKED**
- Step 6 and unrestricted autonomy: **BLOCKED**

No phase advancement occurs without explicit written authorization from MATHEUS.

## Current Git Checkpoint

- Operational checkpoint: `59eef2f06b89e670fce218c39870452650d2e1c8`
- Step 4 implementation commit: `2e4b262b7ea112cbf100f41b849e6d17f37ae45a`
- Step 3 implementation commit: `611ec49ca8dbb33d3679a0357e5eab7af8259792`
- Step 2 implementation commit: `d8ee4a7420ecd45ad4c65be4d369e9dcb08fbbbf`
- Step 1 implementation commit: `2053d3349cff31b6458fa93187e22ed48ce5c620`
- Phase 5.4 frozen provider baseline: `53d0df0f5aa507154685f2ff6eb1de5008c9ff92`

## Current Architecture

PDL is a governed, fail-closed software-delivery engine. Product repositories remain external and isolated. PDL owns intake, execution orchestration, governance, scheduling, retry/DLQ, stale-lease recovery, model routing, validation, and remote product finalization.

### Canonical implementation locations

- Intake: `src/pdl/service/task-intake-service.ts`
- Scheduler: `src/pdl/scheduler/continuous-scheduler.ts`
- Scheduler contracts: `src/pdl/scheduler/types.ts`
- Governance: `src/pdl/governance/`
- Retry policy: `src/pdl/retry/`
- DLQ: `src/pdl/dlq/`
- Reaper: `src/pdl/reaper/`
- Persistence: `src/pdl/persistence/`
- Provider registry: `src/providers/model-registry.ts`
- Remote finalization: `src/pdl/persistence/remote-persistence.ts`

Historical documents may contain older paths. Current code wins.

## Scheduler: Verified Contract

`src/pdl/scheduler/types.ts` defines scheduler session states:

`IDLE | RUNNING | STOPPED | BLOCKED | COMPLETED | FAILED`

Events include start/stop/block/idle, task selection/start/success/failure, retry scheduling, quarantine, dead-lettering, limits, kill-switch, and governance denial.

Current defaults in code:

- `pollIntervalMs`: **10000 ms**
- `maxConcurrentTasks`: **1**
- `authorizedBy`: `human-operator`
- optional `projectId` filter

Do not document a `STOPPING` scheduler state unless the implementation adds it.

## Retry / DLQ: Verified Contract

Migration `db/migrations/023_pdl_task_retry_dlq.sql` adds:

- `tasks.retry_count`
- `tasks.max_retries`, default `3`
- `tasks.next_retry_at`
- failure/retry/quarantine metadata
- task status `QUARANTINED`
- partial index on queued tasks with `next_retry_at`
- durable table **`pdl_dead_letters`**
- unique `(task_id, attempt_count)` constraint

`src/pdl/retry/types.ts` defines failure classes:

`RETRYABLE | NON_RETRYABLE | POISON`

Default retry policy in code:

- `baseDelayMs`: **2000**
- `factor`: **2**
- `maxDelayMs`: **60000**
- `maxRetries`: **3**
- `jitterMs`: **0**

Do not call this policy "jittered" by default. Jitter is optional and disabled in the default configuration.

## Reaper: Verified Contract

Implementation lives under `src/pdl/reaper/`.

Default configuration in `src/pdl/reaper/types.ts`:

- `intervalMs`: **60000 ms**
- `batchSize`: **10**
- `staleGracePeriodMs`: **0**

The reaper tracks stale detection, recovery, DLQ, quarantine, blocked cycles, and structured recovery events. Recovery is governance-aware and integrates with retry/DLQ decisions.

## FREE MODELS ONLY

This is an implementation gate, not a provider-name whitelist.

A model is eligible only when pricing evidence verifies **prompt price = 0 AND completion price = 0**. Unknown pricing is not accepted. A `:free` suffix alone is insufficient. Paid models are prohibited from automated execution paths.

The empirical 2026-09-12 baseline currently ranks:

1. `kc/cohere/north-mini-code:free` — empirical score 99.10
2. `kc/kilo-auto/free` — 93.80
3. `kc/nvidia/nemotron-3.5-lightning:free` — 83.05
4. `openrouter/cohere/north-mini-code:free` — 82.70
5. `openrouter/openrouter/free` — 81.55

Current registry evidence explicitly excludes commercial Gemini from the verified free catalog. Do not reintroduce Gemini or any other model without fresh 0/0 pricing evidence and an explicit policy change.

## Product and PP Isolation

- Product repositories are external targets and must not be committed into the PDL engine repository.
- Product workspaces and scratch material are isolated by repository hygiene rules.
- PP is a separate project/repository and must not be coupled through internal imports or database foreign keys.
- Do not implement PP changes while operating on PDL.

## Proven Capabilities

The current implementation contains deterministic intake/execution specifications, PostgreSQL task leasing, governed worker execution, continuous scheduling, bounded retry/DLQ/quarantine, stale-lease reaping, free-model routing, validation, and remote product finalization.

Claims about exact test totals must be tied to a dated evidence artifact. This document does **not** claim a global 100% test pass rate.

## Evidence Hierarchy

1. Current runtime / direct execution evidence
2. Real execution results
3. Tests / QA evidence
4. Code and migrations at the referenced Git commit
5. Approved code review
6. Validated ADRs / decisions
7. Derived operational documentation
8. Agent memory, chat history, and local notes

Conflicts must be preserved and resolved using the higher-authority evidence. Never silently rewrite history.

## Current Authorized Next Action

**Documentation synchronization only:** keep this file and `AGENTS.md` code-accurate.

After this synchronization is verified, the next engineering milestone remains **Phase 5.5 Step 5**, but it is still blocked pending explicit authorization from MATHEUS.

Step 5 must not be implemented merely because Steps 1-4 are complete.

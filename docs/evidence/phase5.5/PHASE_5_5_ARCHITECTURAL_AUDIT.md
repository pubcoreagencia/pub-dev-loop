# PDL PHASE 5.5 — ARCHITECTURAL AUDIT: AUTONOMOUS OPERATIONS & CONTINUOUS DEVELOPMENT

## 1. EXECUTIVE SUMMARY & SCOPE

**Phase 5.4** formally proved that PDL can execute an isolated autonomous task end-to-end against real repositories with:
- Canonical FREE-only model governance (`kc/cohere/north-mini-code:free` via 9Router at zero cost);
- ExecutionSpec isolation and Product Catalog validation;
- Ephemeral workspace isolation (`AppData/Local/Temp/pdl-workspace-*`);
- In-process validation and correction loop (`PdlCorrectionLoop`);
- Remote Product Finalization layer (`PdlRemotePersistence`);
- Cryptographic and Git-level remote SHA verification (`localSha === remoteSha`);
- PostgreSQL audit trail and API retrieval (`/tasks/:id`).

**Phase 5.5** addresses the next capability boundary:
> **Transitioning PDL from isolated, single-task execution to bounded, observable, recoverable, fail-closed autonomous operation under explicit human governance.**

This document provides the mandatory **read-only architectural audit** of the existing PDL codebase, evaluating what exists, what is proven, what is missing, and the risks and technical steps required to establish continuous operations.

---

## 2. PHASE 5.4 BASELINE PRESERVATION STATEMENT

The Phase 5.4 baseline is formally frozen and immutable:
- `PHASE_5_4 = PROVEN`
- Zero regressions to model routing or pricing policies (`isFreeModel()` remains mandatory).
- Zero alterations to Product Catalog constraints, `allowedPaths`, or protected branches.
- Zero contamination of product repositories (`pub-rate-calculator`, `pub-dev-loop-template`, `pub-shopee-scraper`).
- Zero coupling with PUB Prototype (PP) or external commercial layers.
- Git HEAD remains locked to `53d0df0f5aa507154685f2ff6eb1de5008c9ff92` on `origin/main`.

---

## 3. CURRENT ARCHITECTURAL ASSETS INSPECTED

A complete inspection of the PDL codebase revealed substantial existing capabilities that must be leveraged without duplication:

1. **Database Schema & Persistence (`db/migrations/`, `src/repository.ts`)**:
   - `tasks` table with columns: `id`, `project`, `repository`, `objective`, `prompt`, `status` (`task_status` enum), `priority`, `worker`, `result` (JSONB), `error`, `branch`, `commit_sha`, `git_status`, `lease_owner`, `lease_deadline`, `heartbeat_at`, `workspace_path`.
   - `execution_specs` table with 1:1 relation to `tasks`, cryptographic `spec_hash`, status check (`UNSEALED`, `VALIDATED`, `SEALED`, `BLOCKED`).
   - `autonomy_missions`, `autonomy_mission_states`, and `autonomy_cycles` tables (Migration 018) providing durable multi-cycle tracking and cycle-level idempotency keys.
   - Atomic task claim using `SELECT id FROM candidate FOR UPDATE SKIP LOCKED LIMIT 1` with per-product concurrency limits (`PRODUCT_CONCURRENCY_LIMIT`).
   - Lease management with `lease_deadline` (30s) and background `heartbeat()` interval (10s).
   - Stale task reclamation via `reclaimStuck()`.

2. **Task Intake & Execution Seam (`src/pdl/service/task-intake-service.ts`, `src/execution/`)**:
   - Atomic database transaction wrapping `tasks` insertion, canonical `ExecutionSpec` construction, schema validation, and sealing.
   - Authorization validation against `defaultRepositoryAuthorizationPolicy`.
   - Preparation of execution context via `prepareExecution()` enforcing sealed spec assertion.

3. **Execution & Correction Engine (`src/worker-service.ts`, `src/pdl/worker/correction-worker.ts`)**:
   - Ephemeral workspace creation and teardown per attempt.
   - Provider retry loop (`executeWithRetry`) handling HTTP 429, 5xx, and connection timeouts with exponential backoff (`ROUTER_MAX_ATTEMPTS`).
   - `WorkspaceValidator` running product-defined test commands.
   - In-process correction loop (`PdlCorrectionLoop`) rerunning validation upon test failures.
   - Remote finalization bridge (`PdlRemotePersistence`) pushing commits via GitHub API and verifying remote commit SHAs.

4. **Autonomy Engine in Office Domain (`src/office/`)**:
   - `autonomy-loop.ts`: Gaps analysis (`analyzeGaps`), dynamic dependency ranking (`selectNextBestAction`), and engineering task synthesis.
   - `autonomous-execution-controller.ts`: Multi-cycle execution controller (`executeCycle`, `executeMissionContinuously`, `recoverMission`), CEO sovereignty approval stops for HIGH/CRITICAL risk actions (`WAITING_APPROVAL`), evidence-first validation.
   - `autonomous-pipeline.ts`: DAG validation (`validateDAG`), multi-step workflow progression (`tickPipeline`), approval checkpoints.

5. **Daemon Supervision & Observability (`src/pdl/service/supervisor.ts`, `src/pdl/api/entry.ts`)**:
   - `ProductionServiceSupervisor`: Multi-daemon process manager with PID file locking, duplicate process prevention, crash restart with backoff, and health/readiness probing.
   - Dedicated health (`/health`) and readiness (`/ready`) endpoints.
   - Telemetry endpoints (`/observability/active-tasks`, `/observability/tasks/:id/lineage`).

---

## 4. PHASE 5.5 GAP MATRIX

| Capability | Existing | Proven | Missing | Risk | Required |
| :--- | :---: | :---: | :--- | :---: | :---: |
| **Intake** | YES | YES | None (atomic intake + sealed ExecutionSpec in place) | Low | Preserved |
| **Planning** | PARTIAL | PARTIAL | Automated backlog task intake for continuous production work | High | YES |
| **Queue** | YES | YES | Dead-letter queue (DLQ) for poison tasks exceeding max retries | Medium | YES |
| **Scheduling** | PARTIAL | PARTIAL | Continuous multi-task scheduler connecting completed work to next task | High | YES |
| **Task locking** | YES | YES | Branch-level mutex (currently per-product count only) | Low | Harden |
| **Retry** | PARTIAL | YES | Automatic task-level retry backoff policy before DLQ marking | Medium | YES |
| **Crash recovery** | PARTIAL | YES | Remote state reconciliation (`LOCAL_COMMITTED` vs `REMOTE_VERIFIED`) | High | YES |
| **Stale task recovery**| YES | YES | Periodic background reaper in live worker daemon (currently startup only) | High | YES |
| **Duplicate prevention**| PARTIAL | YES | Intake idempotency keys (`idempotency_key` on POST /tasks) | Medium | YES |
| **Concurrent execution**| YES | YES | Global concurrent task throttling for continuous loops | Medium | YES |
| **Validation** | YES | YES | None (native validator + testCommand in place) | Low | Preserved |
| **Correction** | YES | YES | None (`PdlCorrectionLoop` active and proven) | Low | Preserved |
| **Finalization** | YES | YES | None (`PdlRemotePersistence` active and proven) | Low | Preserved |
| **Remote verification** | YES | YES | None (`localSha === remoteSha` API verification active) | Low | Preserved |
| **Audit** | YES | YES | Consolidated multi-task session audit trail | Low | Harden |
| **Observability** | PARTIAL | YES | Live governance status endpoint (`/governance/status`) | Medium | YES |
| **Human governance** | PARTIAL | PARTIAL | Unified Governance Policy Engine (Levels 0-4) with fail-closed bounds | CRITICAL | YES |
| **Kill switch** | PARTIAL | PARTIAL | Persistent, externally toggleable emergency stop checked at every gate | CRITICAL | YES |
| **Cost/request limits** | PARTIAL | YES | Continuous session volume caps (max consecutive tasks/tool calls) | Medium | YES |
| **Failure isolation** | YES | YES | Poison task quarantine (prevent immediate re-claim without backoff) | Medium | YES |
| **Continuous loop** | PARTIAL | PARTIAL | Production daemon loop linking completed tasks to next authorized task | High | YES |

---

## 5. TECHNICAL ANALYSIS OF CRITICAL GAPS

### A. Human Governance Policy Engine (MANDATORY GATE)
Currently, autonomy controls are fragmented: `ApprovalManager` handles office-level requests, while `defaultRepositoryAuthorizationPolicy` checks static path patterns and numeric autonomy levels.
**Gap**: There is no centralized `GovernanceController` that governs the continuous loop.
**Requirement**:
- Must support explicit levels:
  - **Level 0**: Manual execution only (scheduler disabled).
  - **Level 1**: Human explicitly dispatches tasks; PDL executes isolated task.
  - **Level 2**: Human loads authorized queue; PDL executes tasks sequentially.
  - **Level 3**: Bounded autonomous continuation: PDL selects next authorized task from product backlog within explicit limits (max consecutive tasks, max duration, max failures).
  - **Level 4**: Autonomous scheduling of maintenance tasks within authorized catalog.
  - **Level 5**: Strictly forbidden in Phase 5.5.
- Must fail closed: if governance configuration is unreadable or corrupted, the system stops immediately.

### B. Persistent Emergency Stop / Kill Switch
Currently, cancellation is per-task (`taskRepo.cancel(id)`) or per-process (`SIGTERM`).
**Gap**: An operator cannot instantly pause all autonomous claiming, execution, correction, or finalization without killing the operating process or altering code.
**Requirement**:
- External kill switch toggleable via file (`.killswitch` / `.pdl-pause`) and database state.
- Checked synchronously before:
  1. Claiming any new task from queue;
  2. Spawning LLM attempt;
  3. Invoking correction loop;
  4. Executing remote git push;
  5. Selecting next task in continuous loop.
- If kill switch is active: worker transitions to `PAUSED`, releases leases, records audit event, and stops.

### C. Periodic Stale Task Reaper & Dead-Letter Handling
Currently, `reclaimStuck()` is only called on worker startup (`src/worker.ts` line 114). In `src/pdl/worker/entry.ts`, `reclaimStuck()` is never called in the background loop!
**Gap**: If a worker process crashes, tasks in `RUNNING` or `TESTING` remain locked until the worker process restarts. Furthermore, a task that repeatedly crashes a worker has no retry counter limit, creating a poison task loop.
**Requirement**:
- Periodic background sweep (e.g. every 60s) in the dedicated PDL worker daemon.
- Increment `retry_count`. If `retry_count > MAX_TASK_RETRIES` (e.g. 3), transition to `NEEDS_REVIEW` / `DEAD_LETTER` with `stop_reason = 'EXCEEDED_MAX_RETRIES'`.

### D. Crash Recovery Across Remote Finalization Boundaries
Currently, if a crash occurs between local commit creation and remote verification:
```text
LOCAL_COMMITTED
      ↓ (process killed here)
REMOTE_PUSHED / REMOTE_VERIFIED
```
Upon restart, `reclaimStuck()` sees the task in `TESTING` with `lease_deadline < now`. It resets the status to `QUEUED`, causing a complete re-execution from scratch and potentially creating conflicting remote branches.
**Requirement**:
- Before re-executing a reclaimed task that has `commitSha` populated, check remote repository ref via `PdlRemotePersistence.verifyRemoteCommit()`.
- If already pushed and verified remotely: finalize task as `COMPLETED`.
- If unpushed: safely clean workspace and re-queue.

### E. Continuous Scheduler Integration
Currently, `AutonomousExecutionController.executeMissionContinuously()` exists in `src/office/`, but the live worker daemon (`src/pdl/worker/entry.ts`) only calls `executeOnce()`.
**Gap**: There is no standing scheduler service that orchestrates multi-task progression for live products in production.
**Requirement**:
- Implement `ContinuousDevelopmentScheduler` that operates on top of `TaskIntakeService` and `PdlCorrectionWorker`.
- Upon task completion, evaluate:
  1. Is continuous mode enabled? (Governance Level >= 3)
  2. Is Kill Switch clear?
  3. Has consecutive task limit been reached? (Default: max 3 tasks)
  4. Did the previous task succeed? (Fail closed on error)
  5. Is the next task authorized in `ProductCatalog`?

---

## 6. PROPOSED 5.5 STATE MACHINE

To maintain strict backward compatibility with existing migrations and TypeScript types, the state machine leverages the existing `task_status` enum and enriches state transitions via structured metadata:

```text
       [INTAKE]
          ↓
       QUEUED <-----------------------------------+ (Retryable failure with retry_count < max)
          ↓ (claim: atomic FOR UPDATE SKIP LOCKED) |
       ASSIGNED (lease set, heartbeat started)    |
          ↓                                       |
       RUNNING (sealed ExecutionSpec validated)   |
          ↓                                       |
      [EXECUTING] (9Router / Cohere Free)         |
          ↓                                       |
       TESTING (workspace validation & tests)     |
          ↓                                       |
     [VALIDATION]                                 |
     ├── FAIL → [CORRECTION]                      |
     │              ├── Recovered → [FINALIZING]  |
     │              └── Failed ───────────────────┼──> FAILED (if non-retryable or max retries)
     └── PASS → [FINALIZING] (local commit)       |
                    ↓                             |
               [REMOTE PUSH]                      |
                    ↓                             |
               [VERIFYING] (SHA match)            |
                    ├── Verified → COMPLETED      |
                    └── Unverified ───────────────+
```

### Failure and Governance Terminals:
- `COMPLETED`: Verified success (local SHA === remote SHA, tests exit 0).
- `FAILED`: Terminal unrecoverable failure.
- `BLOCKED`: Stopped by Governance limit, risk gate, or Kill Switch.
- `CANCELLED`: Explicit human cancellation.
- `NEEDS_REVIEW` (Dead-Letter): Exceeded max retry threshold (poison task quarantine).

---

## 7. HUMAN GOVERNANCE & SAFETY SPECIFICATION

The continuous development scheduler must enforce the following boundaries:

```typescript
export interface GovernanceLimits {
  activeLevel: 0 | 1 | 2 | 3 | 4; // 0=Manual, 1=Single, 2=Queued, 3=Continuous Bounded, 4=Scheduled
  maxConsecutiveTasks: number;     // e.g. 3 tasks per autonomous run
  maxTaskDurationMs: number;       // e.g. 180,000ms (3 minutes)
  maxToolRoundsPerTask: number;    // e.g. 10 rounds
  maxCorrectionAttempts: number;   // e.g. 2 attempts
  maxConsecutiveFailures: number;  // e.g. 1 failure -> FAIL CLOSED
  allowedProducts: string[];       // Must match ProductCatalog IDs
  killSwitchActive: boolean;       // Instant emergency stop
}
```

**Fail-Closed Rule**: If `activeLevel < 3`, `ContinuousDevelopmentScheduler` executes at most 1 task and exits. Under no circumstance may the loop proceed without human authorization for Level 3.

---

## 8. CONTROLLED CONTINUOUS OPERATION PROOF PLAN

The eventual verification of Phase 5.5 will follow this deterministic sequence:

```text
[Human authorizes Level 3 with maxConsecutiveTasks = 3]
       ↓
TASK A (Product 1 / Backlog item 1)
       ↓
Intake → Execute → Validate → Finalize → Remote Verify → Audit
       ↓
[Scheduler evaluates: Tasks run = 1/3, Status = PASS, KillSwitch = OFF]
       ↓
TASK B (Product 2 or Backlog item 2)
       ↓
Intake → Execute → Validate → Finalize → Remote Verify → Audit
       ↓
[Scheduler evaluates: Tasks run = 2/3, Status = PASS, KillSwitch = OFF]
       ↓
TASK C (Product 3 or Backlog item 3)
       ↓
Intake → Execute → Validate → Finalize → Remote Verify → Audit
       ↓
[Scheduler evaluates: Tasks run = 3/3 == maxConsecutiveTasks]
       ↓
AUTONOMOUS LOOP STOPS AT GOVERNANCE LIMIT (PROVEN BOUNDED CONTINUITY)
```

---

## 9. FAILURE INJECTION PLAN (TESTING MATRIX)

To prove robustness, the implementation phase must execute dedicated automated test suites for each failure mode:
1. **Kill Switch Activation**: Injected mid-run; verifies execution halts immediately before next attempt or push.
2. **Crash in TESTING after Local Commit**: Injected process abort; verifies startup recovery inspects remote before re-execution.
3. **Stale Lease Abandonment**: Simulated worker hang; verifies periodic reaper reclaims task cleanly.
4. **Poison Task / Exceeded Retries**: Repeated validation failure; verifies transition to `NEEDS_REVIEW` (DLQ) after 3 attempts.
5. **Provider Outage / Zero Free Models**: Simulated 9Router 503; verifies graceful fail-closed without paid model fallback.
6. **Governance Bound Hit**: Verifies loop strictly terminates after configured `maxConsecutiveTasks`.

---

## 10. EXPLICIT NON-GOALS

Phase 5.5 does NOT attempt, prove, or permit:
- Unrestricted self-modification or self-prompting loops.
- Bypassing human authorization levels.
- Modifying product repositories outside ephemeral workspaces.
- Introducing paid or unverified LLM models.
- SaaS / multi-tenant billing or customer-facing portals.
- Modification of the frozen Phase 5.4 baseline.

---

## 11. RECOMMENDED IMPLEMENTATION ORDER

Following human approval, the implementation should proceed in 5 strict, test-driven steps:

1. **Step 1: Emergency Stop & Governance Policy Engine**
   - Implement `PdlKillSwitch` (file + DB check).
   - Implement `PdlGovernanceEngine` (Levels 0-4, limit enforcement).
   - Unit tests for all governance boundary checks.

2. **Step 2: Crash Recovery & Stale Lease Hardening**
   - Implement periodic stale task reaper in `PdlCorrectionWorker`.
   - Implement remote ref reconciliation on startup for interrupted tasks.
   - Tests in `tests/crash-recovery-remote.test.ts`.

3. **Step 3: Dead-Letter Queue & Retry Policy**
   - Add task retry tracking and transition to `NEEDS_REVIEW` upon reaching max retries.
   - Tests in `tests/dead-letter-quarantine.test.ts`.

4. **Step 4: Bounded Continuous Development Scheduler**
   - Implement `ContinuousDevelopmentScheduler` integrating `TaskIntakeService`, `ProductCatalog`, and `PdlCorrectionWorker`.
   - Tests in `tests/continuous-scheduler.test.ts`.

5. **Step 5: Failure Injection & Continuous Operation Proof**
   - Execute the 3-task bounded continuous proof.
   - Run failure injection suite.
   - Audit and freeze Phase 5.5 baseline.

---

## 12. CONCLUSION & AUDIT STATUS

The PDL codebase already possesses the core primitives for task intake, execution, validation, correction, remote finalization, and leasing. The transition to autonomous continuous operations requires strictly bounded governance, an emergency kill switch, periodic stale task reaping, remote-aware crash recovery, and a bounded scheduler.

**PHASE_5_5_STATUS = AUDIT_COMPLETE**

# PHASE 6 â€” IMPLEMENTATION SPECIFICATION: COMPLEXITY-TRIGGERED PLANNING

> Target: PUB DEV LOOP (PDL) Engineering Engine
> Target Architecture: Autonomous Delivery Engine (`src/pdl/`)
> Human Operator: **MATHEUS**
> Canonical Institutional Persistence: **Git / GitHub**
> Status: **SPECIFICATION ONLY â€” AUDITED (NO CODE IMPLEMENTATION)**
> Baseline Reference: `05d415d`
> Audit Version: **Phase 6.1 Calibrated**
> Date: 2026-09-16

---

## 1. Executive Summary

This document establishes the authoritative, audited **Implementation Specification** for **Candidate A: Complexity-Triggered Planning** in the PUB Dev Loop (PDL).

Following the conclusion and institutional approval of **Phase 5** (`05d415d`) and the comprehensive **Phase 6.1 Audit**, this specification translates the empirical evidence of **Phase 4** into a formal, fail-closed, deterministic engineering specification. It defines the exact architectural boundaries, lifecycle hook points, complexity signal taxonomy (Hard vs. Soft), data contracts, validation rules, fail-closed mechanics, observability schemas, test matrices, and staged rollout/rollback procedures required before any production code implementation can be authorized.

**Key Architectural Invariant:**
No production code, worker modification, scheduler change, database schema alteration, or framework dependency is implemented in this phase. This document serves as the formal blueprint awaiting explicit written approval from **MATHEUS**.

---

## 2. Baseline

* **Approved Git Baseline Commit:** `05d415d` (`docs(benchmark): refine phase 5 evidence language`)
* **Branch:** `feat/remote-delivery-gate-phase1`
* **Repository State:** Working tree clean, synchronized with `origin/feat/remote-delivery-gate-phase1`
* **Phase 5 Status:** APPROVED & SYNTHESIZED in `docs/evidence/phase5.5/PHASE_5_DECISION_SYNTHESIS.md`
* **Approved Direction:** Selective Complexity-Triggered Planning (Candidate A). Candidate B (Portable Skills Consumer) is formally deferred and strictly out of scope.

---

## 3. Evidence from Phase 4

The architectural necessity of a selective planning trigger is grounded in the randomized controlled benchmark executed in **Phase 4** (`docs/evidence/phase5.5/poc-planning-gate/POC_4_PLANNING_GATE_RESULTS.md`), consisting of 90 live execution runs across 15 engineering tasks on `nvidia/nemotron-3-super-120b-a12b:free`:

### 3.1 Complex Tasks Tier (60 Runs: 30 Control vs. 30 Planning)
* **Pass Rate (Oracle Correctness):** Control **40.0%** (12/30) vs. Planning **66.7%** (20/30) â†’ **+26.7 percentage points** improvement.
* **Regressions:** **0 regressions** observed in the complex planning cohort.
* **Multi-File Coverage:** Average files touched increased from 0.77 to 1.03 (+0.26 files), preventing partial edit syndromes in multi-file refactors (e.g., `CMPX-05` circular dependency extraction).
* **Defect Discovery:** Complex state machine, DLQ, and stale reaper tasks (e.g., `CMPX-10`) progressed from failure under direct execution (0/3) to robust completion under planned execution (2/3).

### 3.2 Simple Tasks Tier (30 Runs: 15 Control vs. 15 Planning)
* **Pass Rate:** Control 66.7% (10/15) vs. Planning 80.0% (12/15) â†’ Marginal gain (+13.3 p.p., only +2 tasks passed).
* **Token Overhead:** Average tokens inflated from 925 to 2,764 â†’ **+198.8% (~3.0x token waste)**.
* **Latency Overhead:** Average wall-clock latency increased from 16.91s to 32.73s â†’ **+93.6% (~1.9x latency increase)**.
* **Regressions:** Regressions increased from **2 to 5** due to plan-induced over-complication of trivial string guards and comments (e.g., `SIMP-04`).

### 3.3 Institutional Conclusion
> **Universal Planning is REJECTED.**
> Mandatory planning on all tasks generates net-negative utility, introduces over-engineering regressions, and severely degrades system throughput. Planning must be triggered selectively by objective complexity and risk signals.

---

## 4. Current PDL Lifecycle

Based on architectural code audit across `src/pdl/service/task-intake-service.ts`, `src/pdl/worker/correction-worker.ts`, `src/router-worker.ts`, and `src/execution/execution-engine.ts`, the canonical task lifecycle operates as follows:

```text
CURRENT LIFECYCLE

[1. INTAKE & SPEC SEALING]
   Task Created / Submitted
       â†“
   normalizeTaskIntake() (`src/task/intake.ts`)
       â†“
   validateExecutionSpec() (`src/task/spec-validator.ts`)
       â†“
   sealExecutionSpec() (`src/execution/execution-spec-persistence.ts`)
       â†“
   Atomic DB Insert: tasks table + sealed execution_specs table

[2. SCHEDULER & LEASING]
   ContinuousScheduler polls pending tasks (`src/pdl/scheduler/continuous-scheduler.ts`)
       â†“
   Governance Check: evaluateClaim()
       â†“
   Task leased by Worker (`tasks.claim()`)

[3. WORKER PREPARATION]
   PdlCorrectionWorker.executeOnce() (`src/pdl/worker/correction-worker.ts`)
       â†“
   Governance Check: evaluateExecution(task)
       â†“
   Status update: tasks.status = 'RUNNING' + Lease Heartbeat started
       â†“
   assertSealedExecutable(executionSpecDb, task.id)
       â†“
   prepareExecution(task, executionSpec) (`src/execution/execution-seam.ts`)

[4. EXECUTION ATTEMPTS & RETRIES]
   RouterWorker.executeWithRetry() (`src/router-worker.ts`)
       â†“ (For each provider attempt)
   Workspace Provisioning: mkdtemp + git clone + repo checkout
       â†“
   Gate 1: verifyRepositoryIdentity() (Post-Provisioning)
       â†“
   Baseline Snapshot captured (`captureWorkspaceSnapshot()`)
       â†“
   Gate 2: verifyRepositoryIdentity() (Pre-Agent-Execution)
       â†“
   Provider/Agent execution: DefaultExecutionEngine.execute()
       â†“
   Winning attempt selected (or retryable provider fallback loop)

[5. VERIFICATION & CORRECTION]
   Status update: tasks.status = 'TESTING'
       â†“
   Initial Finalization Bridge: DefaultFinalizationBridge.finalize()
       â†“
   Validation Tests / Typecheck / Clean Worktree evaluation
       â†“
   (Optional) PdlCorrectionLoop if test/hygiene failure (max 2 attempts)
       â†“
   CodeReviewManager.evaluateReview()

[6. REMOTE PERSISTENCE & FINALIZATION]
   Governance Check: evaluateFinalization(task)
       â†“
   PdlRemotePersistence.persist() (fast-forward push + ls-remote SHA verify)
       â†“
   evaluatePersistenceGate() (PERSISTENCE_01 to PERSISTENCE_08)
       â†“
   PubNeuralBridge dispatch
       â†“
   Status update: tasks.status = 'COMPLETED' (or 'FAILED')
```

---

## 5. Proposed Decision Point: Task vs. Attempt Architecture

A critical distinction exists between **Task-Level Classification** and **Attempt-Level Planning**:

```text
PROPOSED TARGET ARCHITECTURE

[TASK LEVEL]
   Task Claimed & ExecutionSpec Deserialized
       â†“
   â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
   â”‚ TASK COMPLEXITY CLASSIFICATION                              â”‚
   â”‚ evaluateTaskComplexity(task, prepared.executionSpec)        â”‚
   â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                                  â”‚ (Deterministic, Immutable for Task Lifetime)
                                  â–¼
                     [Planning Required: YES / NO]
                                  â”‚
                                  â–¼
[ATTEMPT LEVEL (Inside RouterWorker.executeWithRetry loop)]
   For each attempt (Attempt 0, Attempt 1, ...):
       Provision fresh workspace + Clone + Baseline Snapshot
       â”‚
       IF planningRequired === false:
           DIRECT EXECUTION â†’ Agent executes code edits
       â”‚
       IF planningRequired === true:
           Check Attempt Context & Plan Cache:
           - Attempt 0: Generate StructuredExecutionPlan â†’ Validate â†’ Cache Plan
           - Attempt > 0 (Provider Fallback): REUSE cached validated plan
           - Attempt > 0 (Execution Failure with Workspace Drift): REPLAN
           â”‚
           Constrain Agent execution to Validated Plan
```

### 5.1 Classification Authority (Task Scope)
* **Scope:** Belongs to the **TASK**.
* **Immutability:** Evaluated once per task lifecycle upon execution start. The complexity classification does not oscillate across provider retries.
* **Deterministic Contract:** Computed from the sealed `ExecutionSpec` objective, instructions, target file manifests, and historical metadata.

### 5.2 Plan Authority (Attempt Scope)
* **Scope:** Generated at the **ATTEMPT**, but reusable across compatible attempts.
* **Retry Semantics:**
  * **Provider Fallback (e.g. Rate Limit, HTTP Timeout, Connection Error):** **REUSE** the existing validated plan. The technical implementation plan remains valid; only the LLM execution worker failed.
  * **Compilation/Test Failure (Correction Loop):** Handled by `PdlCorrectionLoop` inside the active attempt workspace without regenerating the architectural plan.
  * **Scope/Validation Violation on Previous Attempt:** **REPLAN** with explicit feedback regarding previous rejection reasons.

---

## 6. Complexity Model (Deterministic-First)

The Phase 6.1 audit mandates that **V1 operates as 100% Deterministic-First**:
* Zero probabilistic LLM calls required for complexity classification in V1.
* Evaluates static metadata from the sealed `ExecutionSpec`, repository configuration, and git tree.
* Hard signals trigger planning unconditionally.
* Soft signals accumulate points against an empirically calibrated threshold.
* Probabilistic / LLM-assisted classification is marked as **DEFERRED / FUTURE CANDIDATE ONLY** and is excluded from V1.

---

## 7. Hard Signals Audit & Specification

Hard signals represent strict architectural boundaries where direct, unstructured code generation historically caused partial edits or system regressions. The presence of **ANY SINGLE** hard signal mandates pre-execution planning.

| Signal ID | Signal Name | Detection Mechanism | Justification & Audit Evidence | False Positive / Negative Assessment |
| :--- | :--- | :--- | :--- | :--- |
| `HARD_01_LIFECYCLE_CORE` | Core Lifecycle / Subsystem Impact | Target paths include `src/pdl/{scheduler,reaper,dlq,retry,governance,persistence}/` or `src/router-worker.ts` | Phase 4 showed state machine and reaper tasks (`CMPX-03`, `CMPX-10`) failed completely without planning. Core engine integrity demands explicit decomposition. | Low FP (core paths are explicit); Zero FN on declared core targets. |
| `HARD_02_PERSISTENCE_SCHEMA` | Schema / Migration Modification | Target paths touch `db/migrations/` or SQL schema files | Migrations alter PostgreSQL durability. Irreversible without rollback scripts; warrants mandatory pre-planning. | Zero FP; Zero FN. |
| `HARD_03_BREAKING_CONTRACT` | Exported Contract / API Mutation | Target touches public interface definitions (`src/types.ts`, `*contract*.ts`, `*types.ts`) | Interface edits cascade across packages. Phase 4 `CMPX-02` showed contract union typing required plan decomposition to avoid regressions. | Moderate FP on trivial type additions (mitigated by check: only triggers if modifying existing types, not appending isolated enum/constant); Zero FN. |
| `HARD_04_CIRCULAR_DEP_REFACTOR` | Cross-Module Structural Refactoring | Task instructions explicitly declare "refactor", "extract module", or "circular dependency" | Phase 4 `CMPX-05` proved planning forced 100% identification of extraction points, while control failed partial files. | Low FP; Low FN. |
| `HARD_05_SECURITY_AUTH` | Governance / Security Policy Modification | Target paths touch `src/pdl/security/`, `repo-authorization.ts`, or `src/pdl/governance/` | Security and trust boundaries must never be modified without explicit risk enumeration. | Zero FP; Zero FN. |

### Critical Calibration Note on Multi-File Scope:
In the initial specification draft, `HARD_01_MULTI_FILE` was proposed as a Hard Signal. The **Phase 6.1 Audit** revealed:
* Many legitimate tasks touch $>1$ file trivially (e.g. updating an implementation and its associated test fixture, updating a constant and its re-export in `index.ts`).
* Elevating every $>1$ file edit unconditionally to Hard Signal creates excessive planning overhead on trivial tasks.
* **DECISION:** Multi-file scope is **CALIBRATED TO A HIGH-WEIGHT SOFT SIGNAL** (`SOFT_01_MULTI_FILE`, 2 points) rather than an unconditional Hard Signal, unless combined with structural refactoring or cross-module boundary changes.

---

## 8. Soft Signals Audit & Taxonomy

Soft signals indicate cumulative cognitive complexity. Each signal contributes defined points.

### Epistemic Classification:
* **SUPPORTED:** Corroborated by Phase 4 benchmark tasks and code analysis.
* **PROVISIONAL / CALIBRATION REQUIRED:** Heuristic hypothesis requiring telemetry calibration during the Shadow rollout stage.

| Signal ID | Signal Name | Weight | Condition / Heuristic | Epistemic Status | Justification |
| :--- | :--- | :---: | :--- | :--- | :--- |
| `SOFT_01_MULTI_FILE` | Target Files $> 1$ | 2 pts | Spec declares or implies modification of $>1$ file | SUPPORTED | In Phase 4, complex tasks touched $0.77 \to 1.03$ files on average. Strong risk indicator, but not unilaterally blocking when isolated. |
| `SOFT_02_PROMPT_LENGTH` | Lengthy Specification | 1 pt | Raw task objective + instructions $> 1,200$ characters | SUPPORTED | Complex tasks in Phase 4 averaged $>1,200$ characters, reflecting dense requirements. |
| `SOFT_03_MULTIPLE_ACCEPTANCE` | High Acceptance Criteria Count | 2 pts | Number of acceptance criteria items $\ge 4$ | SUPPORTED | Reflects multi-condition logic requiring sequenced execution. |
| `SOFT_04_ASYNC_CONCURRENCY` | Concurrency / Timing Keywords | 2 pts | Text matches terms: `mutex`, `lease`, `concurrency`, `race condition`, `deadlock`, `heartbeat`, `jitter` | SUPPORTED | High probability of subtle timing bugs (e.g. Phase 4 `CMPX-07`). |
| `SOFT_05_ERROR_HANDLING_DEPTH`| Robust Error Strategy Required | 1 pt | Text matches terms: `fail-closed`, `exponential backoff`, `poison`, `quarantine`, `rollback` | SUPPORTED | Indicates non-trivial resilience requirements (e.g. `CMPX-01`, `CMPX-04`). |
| `SOFT_06_PREVIOUS_FAILURE` | Prior Execution Attempt Retry | 2 pts | `task.retryCount > 0` | SUPPORTED | If direct execution already failed once, elevating to planning significantly reduces repeated rework. |
| `SOFT_07_ESTIMATED_DIFF_LOC` | Estimated Diff $> 50$ LOC | 2 pts | Spec indicates $> 50$ lines of new or modified logic | PROVISIONAL / CALIBRATION REQUIRED | Difficult to evaluate prior to execution; requires Shadow phase telemetry to validate predictive accuracy. |

---

## 9. Soft Signal Threshold Calibration

* **Proposed Operational Threshold:** `softSignalScore >= 3`
* **Audit Status:** **PROVISIONAL / CALIBRATION REQUIRED**
* **Rationale:** A threshold of 3 ensures that no single 1-point or 2-point soft signal can trigger planning alone (e.g., a 2-file edit with a short prompt and 1 acceptance criterion scores 2 $\to$ Direct Execution). However, combining a 2-file edit with high acceptance criteria ($2 + 2 = 4$) or concurrency keywords ($2 + 2 = 4$) immediately triggers planning.
* **Calibration Mandate:** This threshold is strictly subject to empirical adjustment during **Stage 1 (Shadow Mode)** prior to active production enforcement.

---

## 10. Classification Contract

```typescript
export type TaskComplexityTier = 'SIMPLE' | 'COMPLEX';

export type HardComplexitySignal =
  | 'HARD_01_LIFECYCLE_CORE'
  | 'HARD_02_PERSISTENCE_SCHEMA'
  | 'HARD_03_BREAKING_CONTRACT'
  | 'HARD_04_CIRCULAR_DEP_REFACTOR'
  | 'HARD_05_SECURITY_AUTH';

export type SoftComplexitySignal =
  | 'SOFT_01_MULTI_FILE'
  | 'SOFT_02_PROMPT_LENGTH'
  | 'SOFT_03_MULTIPLE_ACCEPTANCE'
  | 'SOFT_04_ASYNC_CONCURRENCY'
  | 'SOFT_05_ERROR_HANDLING_DEPTH'
  | 'SOFT_06_PREVIOUS_FAILURE'
  | 'SOFT_07_ESTIMATED_DIFF_LOC';

export interface ComplexityClassificationDecision {
  classifierVersion: '1.0.0';
  taskId: string;
  tier: TaskComplexityTier;
  planningRequired: boolean;
  hardSignalsTriggered: HardComplexitySignal[];
  softSignalsTriggered: Array<{
    signal: SoftComplexitySignal;
    weight: number;
    evidence: string;
  }>;
  softSignalScore: number;
  softSignalThreshold: number;
  decisionRationale: string;
  evaluationDurationMs: number;
  evaluatedAt: string;
}
```

---

## 11. Planning Contract & Scope Containment

When `planningRequired === true`, the worker invokes a dedicated pre-implementation planning step using the assigned provider. The planner must **NEVER** edit files, execute bash scripts, or commit code.

### 11.1 Fundamental Scope Containment Rule
$$\text{PLAN SCOPE} \subseteq \text{AUTHORIZED EXECUTION SPEC SCOPE} \subseteq \text{PRODUCT MANIFEST SCOPE}$$

The planner **CANNOT EXPAND** task scope. Any file listed in `filesToChange` must reside strictly within the scope authorized by `ExecutionSpec.repositoryTarget` and `ProductManifest.allowedPaths`.

```typescript
export interface StructuredExecutionPlan {
  planVersion: '1.0.0';
  taskId: string;
  attempt: number;
  goal: string;
  filesToChange: string[];
  dependencies: string[];
  implementationSteps: Array<{
    stepNumber: number;
    description: string;
    targetFile: string;
  }>;
  testStrategy: string[];
  riskPoints: string[];
  rollbackConsiderations: string[];
  complexityAssessment: string;
}
```

---

## 12. Plan Validation Infrastructure & Reusability Audit

Every plan must undergo deterministic verification prior to execution. The Phase 6.1 audit evaluated existing PDL primitives for reusability:

| Validation Stage | Responsibility | Architectural Origin / Status | Action |
| :--- | :--- | :--- | :--- |
| **Stage 1: Structural Validation** | Strict JSON parsing, required keys, non-empty arrays, min goal length ($\ge 20$) | Adapted from Phase 4 benchmark validator (`docs/evidence/phase5.5/poc-planning-gate/plan-validator.ts`) | **ADAPT** |
| **Stage 2: Scope & Path Containment** | Prevent path traversal (`..`), enforce safe relative resolution, check repository boundary | Reuses `safeResolve` / path utilities from `src/pdl/service/task-intake-service.ts` | **REUSE** |
| **Stage 3: Governance Policy Validation** | Enforce `ProductManifest.allowedPaths` and `protectedPaths`, verify Autonomy Level | Reuses `RepositoryAuthorizationPolicy.validateModifiedPaths` (`src/pdl/security/repo-authorization.ts`) | **REUSE** |
| **Stage 4: Executable Test Strategy** | Ensure verification steps contain actual executable test commands (e.g. `npm test`) | New deterministic regex checker matching product `testCommand` | **NEW** |

### Revision Budget:
* Exactly **1 automated revision attempt** is allowed if Stage 1 or Stage 4 fails.
* If Stage 2 or Stage 3 fails (security or governance path violation), or if the revised plan fails again, execution **FAILS CLOSED** immediately (`PLAN_VALIDATION_FAILED`).

---

## 13. Comprehensive Fail-Closed Matrix

To guarantee strict adherence to Rule 2 (Fail Closed), all edge cases must terminate deterministically without workspace contamination:

| Failure Scenario | Deterministic Policy / Action | Terminal Status / Code |
| :--- | :--- | :---: |
| Classifier evaluation error / exception | Fallback to `PLANNING_REQUIRED = true` (Safety Default) | Proceed to planning |
| Planner LLM timeout or connection error | Abort attempt, log error, fall back to next provider in chain | `RUNNING` (Retry next provider) |
| Planner returns malformed JSON / text | Trigger 1 revision prompt with syntax error details | `RUNNING` (Revision attempt) |
| Plan fails validation after revision | Fail closed: abort execution; zero file edits; zero git commits | `FAILED` (`PLAN_VALIDATION_FAILED`) |
| Plan specifies files outside authorized paths | Fail closed immediately (no revision): security violation | `FAILED` (`SECURITY_VIOLATION`) |
| Governance conflict (insufficient autonomy) | Fail closed: governance denial | `BLOCKED` (`GOVERNANCE_DENIAL`) |
| Implementation agent touches undeclared file | `FinalizationBridge` detects unexpected change; fail closed | `FAILED` (`UNEXPECTED_FILES_MODIFIED`) |
| Provider chain exhausted during planning | Fail closed: task fails with DLQ routing | `FAILED` / `QUARANTINED` (`PLANNER_CHAIN_EXHAUSTED`) |

> [!CRITICAL]
> **Planning Failure Never Degrades to Blind Execution:**
> If planning is required by a Hard or Soft signal, failure to generate or validate a plan **CAN NEVER** fall back to direct un-planned execution. It must fail closed.

---

## 14. Observability

Events conform to PDL's `OperationalEventEnvelope` standard (`src/router-worker.ts`):

1. `task_complexity_classified`: Emitted upon task classification.
   * Payload: `taskId`, `tier`, `planningRequired`, `hardSignals`, `softSignals`, `score`, `durationMs`.
2. `planning_started`: Emitted when planner model is invoked.
   * Payload: `taskId`, `attempt`, `provider`, `model`.
3. `plan_generated`: Emitted on raw plan receipt.
   * Payload: `taskId`, `attempt`, `tokensUsed`, `durationMs`.
4. `plan_validated`: Emitted upon validation approval.
   * Payload: `taskId`, `attempt`, `filesCount`, `stepsCount`.
5. `plan_rejected`: Emitted on validation failure.
   * Payload: `taskId`, `attempt`, `reasons`, `fatal`.
6. `execution_path_selected`: Emitted before implementation starts.
   * Payload: `taskId`, `path: 'DIRECT' | 'PLANNED'`.

---

## 15. Test & Benchmark Metrics Strategy

The Phase 6.1 audit clarifies that zero-error claims are **Benchmark Targets and Metrics**, not untracked assertions.

### 15.1 Core Quantitative Metrics
* **Planning Recall:** $\frac{\text{Complex Tasks Planned}}{\text{Total Complex Tasks}}$ (Target: $100\%$ on Hard Signal fixtures).
* **Planning Precision:** $\frac{\text{Legitimately Complex Planned}}{\text{Total Planned Tasks}}$ (Target: $\ge 90\%$).
* **False Planning Rate:** Frequency of trivial tasks erroneously routed to planning (Target: $< 5\%$).
* **Missed Planning Rate:** Frequency of complex tasks erroneously executed directly (Target: $0\%$ on Hard Signal suites).
* **Simple Task Overhead Ceiling:** Average token increase on simple tasks restricted to $\le 5\%$ (deterministic evaluation only; zero LLM calls).

### 15.2 Test Matrix
* **Unit Tests (`test/unit/planning/`):** Signal extraction, Soft Signal weighting, boundary thresholds ($2 \to \text{Simple}, 3 \to \text{Complex}$), Stage 1â€“4 plan validators.
* **Integration Tests (`test/integration/planning/`):** Full worker loop simulating Simple Task (Direct Execution) vs. Complex Task (Plan $\to$ Validate $\to$ Implement).
* **Regression Tests:** Execution of Phase 4 suite (`SIMP-01` to `SIMP-05`) verifying direct routing and zero planning overhead.

---

## 16. Staged Rollout Specification

```text
[STAGE 0: OFF] (Default)
   Feature flag disabled. 100% direct execution. Engine baseline preserved.
       â”‚
       â–¼ (Passes 100% unit and integration tests)
[STAGE 1: OBSERVE-ONLY / SHADOW MODE]
   Worker evaluates complexity and logs `task_complexity_classified` envelopes.
   DOES NOT invoke planner; execution remains direct.
   Purpose: Empirically calibrate Soft Signal threshold against real workloads.
   Exit Gate: 50 consecutive tasks with 0 false negatives on complex tasks.
       â”‚
       â–¼ (Written authorization from MATHEUS)
[STAGE 2: CANARY / LIMITED ENABLEMENT]
   Active planning enabled ONLY for designated test product: `pub-dev-loop-template`.
   Simple tasks execute directly; complex tasks execute via Plan-Validate-Implement.
   Exit Gate: 30 tasks completed with zero plan-induced regressions.
       â”‚
       â–¼ (Written authorization from MATHEUS)
[STAGE 3: GENERAL PRODUCTION ENABLEMENT]
   Active across all eligible catalog products.
```

---

## 17. Rollback Strategy & Feature Flag Audit

* **Proposed Future Feature Flag:**
  ```env
  PDL_COMPLEXITY_PLANNING_MODE = 'OFF' | 'SHADOW' | 'ACTIVE'
  ```
  *(Note: Formally documented as a **proposed future configuration**; no code or environment mutation is performed in Phase 6).*
* **Instant Reversion:** Setting `PDL_COMPLEXITY_PLANNING_MODE='OFF'` instantly routes all worker executions to the existing, proven direct execution path.
* **Automated Abort Triggers during Canary:**
  * Missed planning rate $> 0\%$ on core lifecycle modifications.
  * Plan validation false-rejection rate $> 10\%$.
  * Mean simple-task latency increase $> 10\%$.

---

## 18. Epistemic Language Audit

In compliance with Phase 6.1 instructions, all documentation adheres to strict epistemic discipline:
* Claims of "zero regressions" or "+26.7 p.p. pass rate" are strictly bounded to the empirical conditions of the **Phase 4 Controlled Benchmark** ($N=90$, `nvidia/nemotron-3-super-120b-a12b:free`).
* Theoretical claims of "universal proof" or "guaranteed 0% false planning" are eliminated and reclassified as **Empirical Benchmark Targets**.
* Uncalibrated heuristics are explicitly marked **`PROVISIONAL / CALIBRATION REQUIRED`**.

---

## 19. Implementation Boundary

* **Zero Code Implementation:** No TypeScript files in `src/`, test files in `test/`, or database migrations were created or modified.
* **Production Integrity:** The PDL engine remains in its verified, clean baseline state.
* **Gate Status:** Ready for formal human review.

---

## 20. Acceptance Criteria

- [x] Hard Signals audited against code and Phase 4 evidence; multi-file calibrated to Soft Signal.
- [x] Soft Signals audited, weighted, and epistemic status documented.
- [x] Soft Signal threshold ($score \ge 3$) marked `PROVISIONAL / CALIBRATION REQUIRED`.
- [x] V1 classifier specified as 100% Deterministic-First; probabilistic LLM classifier deferred.
- [x] Task vs. Attempt architecture formally separated; retry semantics explicitly defined.
- [x] Plan scope containment enforced: $\text{Plan Scope} \subseteq \text{Authorized Spec Scope}$.
- [x] Validation stages audited for reusability (`REUSE` vs. `ADAPT` vs. `NEW`).
- [x] Comprehensive fail-closed matrix defined; planning failure forbidden from degrading to blind execution.
- [x] Test and benchmark metrics defined with recall, precision, and false planning rates.
- [x] Staged rollout operationalized (`OFF` $\to$ `SHADOW` $\to$ `CANARY` $\to$ `FULL`).
- [x] Rollback mechanism audited and documented as proposed future feature flag.
- [x] Epistemic language calibrated throughout.
- [x] Zero production code modified.

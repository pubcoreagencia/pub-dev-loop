# PHASE 6 — IMPLEMENTATION SPECIFICATION: COMPLEXITY-TRIGGERED PLANNING

> Target: PUB DEV LOOP (PDL) Engineering Engine  
> Target Architecture: Autonomous Delivery Engine (`src/pdl/`)  
> Human Operator: **MATHEUS**  
> Canonical Institutional Persistence: **Git / GitHub**  
> Status: **SPECIFICATION ONLY (NO CODE IMPLEMENTATION)**  
> Date: 2026-09-16  

---

## 1. Executive Summary

This document establishes the authoritative **Implementation Specification** for **Candidate A: Complexity-Triggered Planning** in the PUB Dev Loop (PDL).

Following the conclusion and institutional approval of **Phase 5** (`05d415d`), this specification translates the empirical evidence of **Phase 4** into a formal, fail-closed, deterministic engineering specification. It defines the exact architectural boundaries, lifecycle hook points, complexity signal taxonomy (Hard vs. Soft), data contracts, validation rules, fail-closed mechanics, observability schemas, test matrices, and staged rollout/rollback procedures required before any production code implementation can be authorized.

**Key Mandate:** No production code, worker modification, scheduler change, database schema alteration, or framework dependency is implemented in this phase. This document serves as the formal blueprint awaiting explicit written approval from **MATHEUS**.

---

## 2. Baseline

* **Approved Git Baseline Commit:** `05d415d` (`docs(benchmark): refine phase 5 evidence language`)
* **Branch:** `feat/remote-delivery-gate-phase1`
* **Repository State:** Working tree clean, fully synchronized with `origin/feat/remote-delivery-gate-phase1`
* **Phase 5 Status:** APPROVED & SYNTHESIZED in `docs/evidence/phase5.5/PHASE_5_DECISION_SYNTHESIS.md`
* **Approved Direction:** Selective Complexity-Triggered Planning (Candidate A). Candidate B (Portable Skills Consumer) is formally deferred and strictly out of scope for Phase 6.

---

## 3. Evidence from Phase 4

The architectural necessity of a selective planning trigger is grounded in the randomized controlled benchmark executed in **Phase 4** (`docs/evidence/phase5.5/poc-planning-gate/POC_4_PLANNING_GATE_RESULTS.md`), consisting of 90 live execution runs across 15 engineering tasks on `nvidia/nemotron-3-super-120b-a12b:free`:

### 3.1 Complex Tasks Tier (60 Runs: 30 Control vs. 30 Planning)
* **Pass Rate (Oracle Correctness):** Control **40.0%** (12/30) vs. Planning **66.7%** (20/30) → **+26.7 percentage points** improvement.
* **Regressions:** **0 regressions** observed in the complex planning cohort.
* **Multi-File Coverage:** Average files touched increased from 0.77 to 1.03 (+0.26 files), preventing partial edit syndromes in multi-file refactors (e.g., `CMPX-05` circular dependency extraction).
* **Defect Discovery:** Complex state machine, DLQ, and stale reaper tasks (e.g., `CMPX-10`) progressed from total failure under direct execution (0/3) to robust completion under planned execution (2/3).

### 3.2 Simple Tasks Tier (30 Runs: 15 Control vs. 15 Planning)
* **Pass Rate:** Control 66.7% (10/15) vs. Planning 80.0% (12/15) → Marginal gain (+13.3 p.p., only +2 tasks passed).
* **Token Overhead:** Average tokens inflated from 925 to 2,764 → **+198.8% (~3.0x token waste)**.
* **Latency Overhead:** Average wall-clock latency increased from 16.91s to 32.73s → **+93.6% (~1.9x latency increase)**.
* **Regressions:** Regressions increased from **2 to 5** due to plan-induced over-complication of trivial string guards and comments (e.g., `SIMP-04`).

### 3.3 Institutional Conclusion
> **Universal Planning is REJECTED.**  
> Mandatory planning on all tasks generates net-negative utility, introduces over-engineering regressions, and severely degrades system throughput. Planning must be triggered exclusively by objective complexity and risk signals.

---

## 4. Current PDL Lifecycle

Based on architectural code audit across `src/pdl/service/task-intake-service.ts`, `src/pdl/worker/correction-worker.ts`, `src/router-worker.ts`, and `src/execution/execution-engine.ts`, the canonical task lifecycle operates as follows:

```text
CURRENT LIFECYCLE

[1. INTAKE & SPEC SEALING]
   Task Created / Submitted
       ↓
   normalizeTaskIntake() (`src/task/intake.ts`)
       ↓
   validateExecutionSpec() (`src/task/spec-validator.ts`)
       ↓
   sealExecutionSpec() (`src/execution/execution-spec-persistence.ts`)
       ↓
   Atomic DB Insert: tasks table + sealed execution_specs table

[2. SCHEDULER & LEASING]
   ContinuousScheduler polls pending tasks (`src/pdl/scheduler/continuous-scheduler.ts`)
       ↓
   Governance Check: evaluateClaim()
       ↓
   Task leased by Worker (`tasks.claim()`)

[3. WORKER PREPARATION]
   PdlCorrectionWorker.executeOnce() (`src/pdl/worker/correction-worker.ts`)
       ↓
   Governance Check: evaluateExecution(task)
       ↓
   Status update: tasks.status = 'RUNNING' + Lease Heartbeat started
       ↓
   assertSealedExecutable(executionSpecDb, task.id)
       ↓
   prepareExecution(task, executionSpec) (`src/execution/execution-seam.ts`)

[4. EXECUTION ATTEMPTS]
   RouterWorker.executeWithRetry() (`src/router-worker.ts`)
       ↓
   Workspace Provisioning: mkdtemp + git clone + repo checkout
       ↓
   Gate 1: verifyRepositoryIdentity() (Post-Provisioning)
       ↓
   Baseline Snapshot captured (`captureWorkspaceSnapshot()`)
       ↓
   Gate 2: verifyRepositoryIdentity() (Pre-Agent-Execution)
       ↓
   Provider/Agent execution: DefaultExecutionEngine.execute()
       ↓
   Winning attempt selected (or retryable provider fallback)

[5. VERIFICATION & CORRECTION]
   Status update: tasks.status = 'TESTING'
       ↓
   Initial Finalization Bridge: DefaultFinalizationBridge.finalize()
       ↓
   Validation Tests / Typecheck / Clean Worktree evaluation
       ↓
   (Optional) PdlCorrectionLoop if test/hygiene failure (max 2 attempts)
       ↓
   CodeReviewManager.evaluateReview()

[6. REMOTE PERSISTENCE & FINALIZATION]
   Governance Check: evaluateFinalization(task)
       ↓
   PdlRemotePersistence.persist() (fast-forward push + ls-remote SHA verify)
       ↓
   evaluatePersistenceGate() (PERSISTENCE_01 to PERSISTENCE_08)
       ↓
   PubNeuralBridge dispatch
       ↓
   Status update: tasks.status = 'COMPLETED' (or 'FAILED')
```

---

## 5. Proposed Decision Point

The complexity classification and planning mechanism MUST NOT be injected into intake or scheduling. Sealing an ExecutionSpec during intake occurs before workspace context and provider capabilities are determined.

The authoritative, deterministic **Decision Point** is located in **Worker Execution Preparation**, specifically within `PdlCorrectionWorker` / `RouterWorker` immediately following `prepareExecution()` and workspace baseline acquisition, but strictly **PRIOR to code-modifying agent execution**:

```text
PROPOSED TARGET LIFECYCLE LOCATION

   Workspace Provisioned & Cloned
       ↓
   Baseline Snapshot Captured (`attemptBaseline`)
       ↓
┌─────────────────────────────────────────────────────────────┐
│ [NEW DECISION POINT]                                        │
│ evaluateTaskComplexity(task, prepared.executionSpec, ws)    │
└──────────────────────────────┬──────────────────────────────┘
                               │
               ┌───────────────┴───────────────┐
               ▼                               ▼
      [PLANNING NOT REQUIRED]         [PLANNING REQUIRED]
      (Simple / Low Risk)             (Complex / High Risk)
               │                               │
               │                      Generate Structured Plan
               │                               │
               │                      Validate Plan (Deterministic)
               │                               │
               │                      Pass Plan as Constrained Input
               │                               │
               └───────────────┬───────────────┘
                               ▼
            Agent Code Implementation Execution
                               ↓
                        Test & Finalize
```

### Rationale for this location:
1. **Workspace Context Available:** At this stage, the repository tree, filesystem structure, and exact target files are accessible for static inspection.
2. **Spec Immutability Preserved:** The sealed `ExecutionSpec` is not mutated; the plan acts as an ephemeral execution guidance artifact bound to the execution attempt.
3. **Attempt Isolation:** If an attempt fails and retries with a fallback provider, the complexity classification is re-evaluated or passed cleanly without contaminating the task database row.
4. **Pre-Implementation Containment:** No file edits occur until either (a) the task is confirmed simple, or (b) a structured plan has passed deterministic validation.

---

## 6. Complexity Model

The complexity model evaluates incoming tasks across three operational tiers:

```text
                                  COMPLEXITY EVALUATION
                                            │
               ┌────────────────────────────┼────────────────────────────┐
               ▼                            ▼                            ▼
        [HARD SIGNALS]               [SOFT SIGNALS]             [CLASSIFIER ENGINE]
       Deterministic Match          Weighted Accumulation         Constrained Heuristic
               │                            │                            │
         IF ANY MATCH:                  IF SCORE >= 3:                 OVERRIDE:
      PLANNING REQUIRED             PLANNING REQUIRED          Deterministic rules
                                                               outrank classifier
```

1. **Deterministic Rule Supremacy:** Hard signals trigger planning unconditionally. No LLM or soft evaluation can downgrade a task flagged by a Hard Signal.
2. **Deterministic Ceiling:** If an LLM-assisted classifier is used for ambiguous natural language tasks, its output is strictly constrained by deterministic schema and can only elevate a task to planning, never suppress a Hard Signal.
3. **Fail-Closed Default:** In the event of an evaluation error, schema corruption, or ambiguous score, the system defaults to `PLANNING_REQUIRED`.

---

## 7. Hard Signals

Hard signals represent non-negotiable architectural boundaries. The presence of **ANY SINGLE** hard signal mandates pre-execution planning.

| Signal ID | Signal Name | Detection Mechanism | Justification |
| :--- | :--- | :--- | :--- |
| `HARD_01_MULTI_FILE` | Explicit Multi-File Scope | Spec declares $>1$ target files or diff expectation $>1$ file in known modules | Phase 4 demonstrated that multi-file tasks without planning suffer from partial edits and circular breakages. |
| `HARD_02_LIFECYCLE_CORE` | Core Lifecycle / Subsystem Impact | Target paths include `src/pdl/{scheduler,reaper,dlq,retry,governance,persistence}/` | Modifying core state machines or persistence requires comprehensive dependency and rollback planning. |
| `HARD_03_PERSISTENCE_SCHEMA` | Schema / Database Migration | Target paths touch `db/migrations/` or SQL schema definitions | Database migrations are irreversible without down-migrations; transactional integrity must be planned. |
| `HARD_04_BREAKING_CONTRACT` | Exported Contract / API Mutation | Target touches public interface definitions (`src/types.ts`, `*contract*.ts`, `*types.ts`) | Interface changes create cascading compile failures across consumers if not systematically sequenced. |
| `HARD_05_CIRCULAR_DEP_REFACTOR` | Cross-Module Structural Refactoring | Task objective/instructions explicitly specify "refactor", "extract module", or "circular dependency" | Architectural restructuring requires upfront identification of extraction points and import graphs. |
| `HARD_06_SECURITY_AUTH` | Governance / Security Policy Modification | Target paths touch `src/pdl/security/`, `repo-authorization.ts`, or `auth.ts` | Governance and trust boundaries must never be modified without explicit risk enumeration. |

---

## 8. Soft Signals

Soft signals represent indicators that individually may not warrant planning overhead, but cumulatively indicate high cognitive load and implementation risk.

* **Scoring Policy:** Each soft signal contributes a defined point value. A cumulative score of **$\ge 3$ points** elevates the task to `PLANNING_REQUIRED`.
* Thresholds marked with `[CALIBRATION REQUIRED]` must be calibrated against real production task telemetry during initial shadow rollout.

| Signal ID | Signal Name | Weight | Condition / Heuristic | Status |
| :--- | :--- | :---: | :--- | :--- |
| `SOFT_01_PROMPT_LENGTH` | Lengthy Specification | 1 pt | Raw task objective + instructions $> 1,500$ characters | Validated (Phase 4 complex tasks averaged $>1,200$ chars) |
| `SOFT_02_MULTIPLE_ACCEPTANCE` | High Acceptance Criteria Count | 2 pts | Number of acceptance criteria items $\ge 4$ | Validated (indicates multi-step requirements) |
| `SOFT_03_ASYNC_CONCURRENCY` | Concurrency / Timing Keywords | 2 pts | Text matches terms: `mutex`, `lease`, `concurrency`, `race condition`, `deadlock`, `heartbeat`, `jitter` | Validated (high risk of subtle runtime bugs) |
| `SOFT_04_ERROR_HANDLING_DEPTH`| Robust Error Strategy Required | 1 pt | Text matches terms: `fail-closed`, `exponential backoff`, `poison`, `quarantine`, `rollback` | Validated |
| `SOFT_05_ESTIMATED_DIFF_LOC` | Estimated Diff Size $> 50$ LOC | 2 pts | Spec indicates $> 50$ lines of new or modified code | `[CALIBRATION REQUIRED]` |
| `SOFT_06_PREVIOUS_FAILURE` | Prior Attempt Retry | 2 pts | `task.retryCount > 0` (task has already failed once in a previous execution) | Validated (rework reduction strategy) |

---

## 9. Classification Contract

The classification output must be strictly typed, immutable, fully serializable, and attached to the execution audit trace.

```typescript
export type TaskComplexityTier = 'SIMPLE' | 'COMPLEX';

export type HardComplexitySignal =
  | 'HARD_01_MULTI_FILE'
  | 'HARD_02_LIFECYCLE_CORE'
  | 'HARD_03_PERSISTENCE_SCHEMA'
  | 'HARD_04_BREAKING_CONTRACT'
  | 'HARD_05_CIRCULAR_DEP_REFACTOR'
  | 'HARD_06_SECURITY_AUTH';

export type SoftComplexitySignal =
  | 'SOFT_01_PROMPT_LENGTH'
  | 'SOFT_02_MULTIPLE_ACCEPTANCE'
  | 'SOFT_03_ASYNC_CONCURRENCY'
  | 'SOFT_04_ERROR_HANDLING_DEPTH'
  | 'SOFT_05_ESTIMATED_DIFF_LOC'
  | 'SOFT_06_PREVIOUS_FAILURE';

export interface ComplexityClassificationDecision {
  /** Evaluation version for audit and replay compatibility */
  classifierVersion: '1.0.0';
  /** Target task ID */
  taskId: string;
  /** Final determined complexity tier */
  tier: TaskComplexityTier;
  /** Whether pre-execution planning is required */
  planningRequired: boolean;
  /** Hard signals detected (empty if none) */
  hardSignalsTriggered: HardComplexitySignal[];
  /** Soft signals detected with their assigned weights */
  softSignalsTriggered: Array<{
    signal: SoftComplexitySignal;
    weight: number;
    evidence: string;
  }>;
  /** Cumulative score from soft signals */
  softSignalScore: number;
  /** Threshold used to evaluate soft signals (default: 3) */
  softSignalThreshold: number;
  /** Human-readable explanation of the classification decision */
  decisionRationale: string;
  /** Evaluation latency in milliseconds */
  evaluationDurationMs: number;
  /** Evaluated at timestamp (ISO-8601) */
  evaluatedAt: string;
}
```

---

## 10. Planning Contract

When `planningRequired === true`, the worker invokes a dedicated pre-implementation planning step using the assigned provider. The planner must **NEVER** edit files, execute bash scripts, or commit code. It produces solely a structured JSON artifact conforming to `StructuredExecutionPlan`:

```typescript
export interface StructuredExecutionPlan {
  /** Schema contract version */
  planVersion: '1.0.0';
  /** Correlation task ID */
  taskId: string;
  /** Executive summary of the technical approach (min 20 chars) */
  goal: string;
  /** Comprehensive list of files targeted for addition or modification */
  filesToChange: string[];
  /** Identified internal or external dependencies */
  dependencies: string[];
  /** Sequenced, actionable technical implementation steps */
  implementationSteps: Array<{
    stepNumber: number;
    description: string;
    targetFile: string;
  }>;
  /** Verification and test strategy (unit, integration, compiler commands) */
  testStrategy: string[];
  /** Identified risks, side effects, or potential regression points */
  riskPoints: string[];
  /** Explicit rollback or clean failure mitigation instructions */
  rollbackConsiderations: string[];
  /** Estimated complexity justification */
  complexityAssessment: string;
}
```

---

## 11. Plan Validation

Before an execution plan is delivered to the coding agent, it must pass a **four-stage deterministic validation pipeline**. A plan is NOT an authority to execute; it is an untrusted model output that must be verified.

```text
STRUCTURED PLAN (Raw LLM Output)
               │
               ▼
   [STAGE 1: STRUCTURAL VALIDATION]
   Schema completeness, JSON parsing, non-empty arrays
               │
               ▼
   [STAGE 2: SCOPE & PATH VALIDATION]
   Files within authorized repository paths, no path traversal
               │
               ▼
   [STAGE 3: GOVERNANCE VALIDATION]
   No protected files touched without required governance level
               │
               ▼
   [STAGE 4: TEST STRATEGY VALIDATION]
   Non-empty verification steps, valid command references
               │
               ▼
   VALIDATED PLAN → Passed to Implementation Worker
```

### 11.1 Stage 1: Structural Validation
* Raw string parsed as strict JSON (rejecting unescaped markdown wrappers).
* `goal` is string with `length >= 20`.
* `filesToChange` is non-empty array of valid relative paths.
* `implementationSteps` is non-empty array with sequential numbering.
* `testStrategy` is non-empty array.
* `riskPoints` is non-empty array.
* `rollbackConsiderations` is non-empty array.

### 11.2 Stage 2: Scope & Path Validation
* Every path in `filesToChange` must pass `safeResolve` against workspace root.
* No `..` directory traversal or absolute root escapes.
* Files must reside within the designated product catalog repository boundary.

### 11.3 Stage 3: Governance Validation
* If any file in `filesToChange` touches protected paths defined in `ProductManifest.protectedPaths` (e.g. CI/CD workflows, core governance policies), verify that worker governance level permits such edits.
* If prohibited, reject plan with `GOVERNANCE_PATH_VIOLATION`.

### 11.4 Stage 4: Test Strategy Validation
* Verifies that `testStrategy` contains executable test directives (e.g. `npm test`, `vitest`, `typecheck`).
* Purely passive assertions like "manual check" are rejected.

### 11.5 Plan Revision Budget
If plan validation fails:
* The system allows **exactly 1 automated revision attempt**, returning the validation error reasons to the planner.
* If the revised plan fails validation again, execution **FAILS CLOSED** immediately (`PLAN_VALIDATION_EXHAUSTED`).

---

## 12. Governance Boundaries

To preserve Rule 2 (Fail Closed) and prevent LLM hallucination from overriding architectural constraints, strict governance boundaries are enforced:

1. **Deterministic Override:** Deterministic rules strictly outrank LLM reasoning. An LLM planner cannot "decide" that a schema migration or multi-file refactor does not need planning.
2. **No Autonomous Gate Alteration:** The planner cannot modify `GovernanceLimits`, disable `PersistenceGate`, bypass `verifyRepositoryIdentity()`, or skip tests.
3. **Immutability of Sealed Spec:** The `ExecutionSpec` created at intake remains sealed. The `StructuredExecutionPlan` is subordinate to the `ExecutionSpec` and cannot expand task scope beyond `objective` and `acceptanceCriteria`.
4. **Tool Restrictions on Planner:** During the planning call, tools that mutate the filesystem, run shell commands, or interact with git are completely disabled in provider configuration.

---

## 13. Fail-Closed Behavior

Every edge case and failure mode must terminate safely without corrupted state, orphaned processes, or blind execution:

| Failure Scenario | Deterministic Behavior | Resulting Task Status |
| :--- | :--- | :---: |
| Classifier unavailable / LLM timeout | Fallback to `PLANNING_REQUIRED` (Hard default) | Continue to planning |
| Classifier output corrupt / schema invalid | Fallback to `PLANNING_REQUIRED` | Continue to planning |
| Planner call timeout / connection error | Fail attempt, log error, retry via provider fallback chain | `RUNNING` (Attempt retry) |
| Plan validation fails (Attempt 1) | Prompt planner for single structured revision | `RUNNING` (Revision loop) |
| Plan validation fails (Attempt 2) | Fail closed: abort task execution, do not edit workspace | `FAILED` (`PLAN_VALIDATION_FAILED`) |
| Plan touches forbidden/protected paths | Fail closed: reject plan, abort execution | `FAILED` (`SECURITY_VIOLATION`) |
| Governance conflict between plan and policy| Fail closed: governance deny terminates task | `BLOCKED` (`GOVERNANCE_DENIAL`) |
| Scope drift during implementation (agent touches files not in validated plan) | `FinalizationBridge` detects undeclared files; fail closed | `FAILED` (`UNEXPECTED_FILES_MODIFIED`) |

---

## 14. Observability

The complexity and planning lifecycle must emit structured operational envelopes matching PDL's `OperationalEventEnvelope` standard.

### 14.1 Operational Events
1. `task_complexity_classified`: Emitted immediately upon complexity determination.
   * *Payload:* `taskId`, `tier`, `planningRequired`, `hardSignals`, `softSignals`, `score`, `durationMs`.
2. `planning_started`: Emitted when the planner model is invoked.
   * *Payload:* `taskId`, `provider`, `model`, `attempt`.
3. `plan_generated`: Emitted upon receipt of raw plan from provider.
   * *Payload:* `taskId`, `tokensUsed`, `durationMs`.
4. `plan_validated`: Emitted upon successful 4-stage deterministic validation.
   * *Payload:* `taskId`, `filesCount`, `stepsCount`, `risksCount`.
5. `plan_rejected`: Emitted when plan fails deterministic validation.
   * *Payload:* `taskId`, `reasons`, `revisionAttempt`, `fatal`.
6. `execution_path_selected`: Emitted before implementation starts.
   * *Payload:* `taskId`, `path: 'DIRECT' | 'PLANNED'`.

---

## 15. Test Strategy

Prior to any production activation, a comprehensive test suite must be implemented and pass with 100% assertions:

### 15.1 Unit Tests (`test/unit/planning/`)
* **Signal Evaluator Tests:**
  * Detect all 6 Hard Signals against fixture specifications.
  * Score Soft Signals correctly and verify threshold boundary condition ($2 \to \text{Simple}, 3 \to \text{Complex}$).
  * Verify deterministic overrides (Hard signal present with 0 soft points $\to$ Complex).
* **Plan Validator Tests:**
  * Accept valid `StructuredExecutionPlan` fixtures.
  * Reject malformed JSON, empty arrays, short goal string ($<20$ chars).
  * Reject path traversal attempts (`../../etc/passwd`, `/root/.ssh`).
  * Reject protected paths (`.github/workflows`, `src/pdl/governance/`).

### 15.2 Integration Tests (`test/integration/planning/`)
* **Direct Execution Flow:** Verify simple task fixtures bypass planning and invoke execution directly with zero token inflation.
* **Planned Execution Flow:** Verify complex task fixtures trigger planner, pass plan to implementation, and succeed.
* **Fail-Closed Verification:** Simulate invalid plan output $\to$ verify revision requested $\to$ simulate second failure $\to$ verify task cleanly marked `FAILED` with zero git commits.

### 15.3 Regression Prevention Tests
* Execute the 5 standard Simple Task fixtures (`SIMP-01` to `SIMP-05`) under the classifier:
  * 100% must be classified as `tier: 'SIMPLE'`.
  * Zero planning tokens expended.
  * Wall-clock execution time within baseline tolerances.

---

## 16. Benchmark Strategy

To validate the specification in runtime without risking production drift, an automated verification harness (`Phase 6 Benchmark`) must run before general enablement:

* **Harness Setup:** Automated rerun of the Phase 4 task suite (5 simple, 10 complex across 3 randomized passes).
* **Target Metrics:**
  * **Classifier Accuracy:** $\ge 95\%$ alignment with expected task tier.
  * **False Planning Rate:** $0\%$ on trivial tasks (`SIMP-01` to `SIMP-05`).
  * **Missed Planning Rate:** $0\%$ on architectural tasks (`CMPX-01` to `CMPX-10`).
  * **Complex Pass Rate:** Maintain or exceed the $+26.7\text{ p.p.}$ gain observed in Phase 4.
  * **Simple Task Overhead:** Token increase on simple tasks strictly bounded to $\le 5\%$ (classifier evaluation cost only, zero planner generation cost).

---

## 17. Rollout Strategy

A four-stage gated rollout guarantees safe institutional deployment:

```text
[STAGE 0: OFF] (Default)
   Classification and planning completely disabled. 100% direct execution.
       │
       ▼ (Passes unit & integration tests)
[STAGE 1: OBSERVE-ONLY / SHADOW]
   Classifier runs on all tasks; logs decision envelope; DOES NOT alter execution path.
   Enables empirical calibration of Soft Signal thresholds without operational risk.
       │
       ▼ (Telemetric validation: zero false negatives on complex tasks)
[STAGE 2: CANARY / LIMITED ENABLEMENT]
   Active planning enabled ONLY for explicit candidate product (e.g. `pub-dev-loop-template`).
       │
       ▼ (Approval from MATHEUS + 0 regressions in 50 tasks)
[STAGE 3: FULL PRODUCTION ENABLEMENT]
   Active on all authorized products across continuous scheduler.
```

---

## 18. Rollback Strategy

* **Kill Switch / Feature Flag:** Governed by environment variable:
  ```env
  PDL_COMPLEXITY_PLANNING_MODE = 'OFF' | 'SHADOW' | 'ACTIVE'
  ```
  Default is strictly `'OFF'`.
* **Instant Rollback:** Setting `PDL_COMPLEXITY_PLANNING_MODE='OFF'` immediately forces all worker pipelines to direct execution without process restarts or database migrations.
* **Abort Conditions during Rollout:**
  * Any regression caused by plan validation false rejections.
  * Classifier latency exceeding $3,000\text{ ms}$.
  * Token consumption increase $> 15\%$ on tasks classified as simple.

---

## 19. Risks

1. **Heuristic Evasion:** A poorly phrased user prompt might describe a complex multi-file architectural change using simple words, evading soft signals.  
   *Mitigation:* Fail-closed keyword matchers and file dependency graph inspection.
2. **Planner Hallucination of File Paths:** The planner may generate steps for nonexistent files or incorrect relative paths.  
   *Mitigation:* Stage 2 plan validation checks proposed paths against existing workspace files and reject impossible additions.
3. **Model Degradation on Free Tier:** Free tier models occasionally experience rate limits or context degradation.  
   *Mitigation:* Planning step is bounded by per-attempt timeout and fallback provider chain.

---

## 20. Open Questions

1. **AST vs. Regex Signal Extraction:** Should Hard Signals inspect TypeScript ASTs before execution or rely on lightweight regex and path matching? *(Recommendation: V1 uses deterministic path matching and keyword boundaries; AST parsing deferred to V2).*
2. **Classifier Model Selection:** Should complexity classification be performed by a deterministic TypeScript heuristic function, or should an ultralight free LLM call be allowed? *(Recommendation: V1 must be 100% deterministic TypeScript code; zero LLM token cost for classification).*
3. **Calibration of `SOFT_05_ESTIMATED_DIFF_LOC`:** What is the ideal threshold for predicted diff size? *(Marked as `TBD / calibration required` during Shadow stage).*

---

## 21. Implementation Boundary

To preserve strict compliance with Phase 6 instructions:
* **NO PRODUCTION IMPLEMENTATION WAS PERFORMED.**
* `src/pdl/`, `src/worker.ts`, `src/router-worker.ts`, `src/scheduler/`, and `db/` remain completely untouched.
* No new npm packages added.
* No alterations to Phase 1–5 evidence artifacts.

---

## 22. Acceptance Criteria

- [x] Current PDL lifecycle mapped with exact code evidence.
- [x] Proposed decision point pinpointed between workspace baseline and provider execution.
- [x] Complexity signals categorized into Hard and Soft signals.
- [x] Thresholds requiring runtime validation explicitly marked `TBD / calibration required`.
- [x] Classification contract defined with strict TypeScript types.
- [x] Structured planning contract defined.
- [x] 4-stage deterministic plan validation pipeline defined.
- [x] Governance boundaries established (deterministic code outranks LLM).
- [x] Fail-closed behavior specified across all failure modes.
- [x] Observability event schema defined.
- [x] Unit, integration, regression, and benchmark test strategies documented.
- [x] Gated rollout and instant rollback mechanisms specified.
- [x] Working tree clean and zero production code modified.

---

## 23. Future Work

Following formal review and authorization by **MATHEUS**:
1. **Phase 7 Authorization:** Proceed to implementation of the deterministic Complexity Classifier and Plan Validator in isolated module `src/pdl/planning/`.
2. **Shadow Telemetry Collection:** Deploy Stage 1 (Observe-Only) to calibrate soft thresholds against real workloads.
3. **Candidate B Consideration:** Re-evaluate Portable Skills consumer specification only after Complexity-Triggered Planning reaches Stage 3 Production.

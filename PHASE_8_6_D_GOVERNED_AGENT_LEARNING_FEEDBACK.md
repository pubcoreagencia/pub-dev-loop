# PDL — PHASE 8.6-D: GOVERNED AGENT LEARNING FEEDBACK LOOP

## 1. Executive Summary & Objective

Phase 8.6-D implements the deterministic and governed **Agent Learning Feedback Loop Engine** (`src/office/learning-feedback.ts`) for THE OFFICE workforce:
1. `chief-of-staff`
2. `architect`
3. `developer`
4. `reviewer`
5. `qa-engineer`

### Core Invariant:
> **OBSERVED OUTCOME != INSTITUTIONAL LESSON**
> The learning feedback loop captures real, empirical outcomes (Runtime Execution, Code Review findings, QA test assertions, Verified Remediations) and routes them into the existing organizational memory and pattern detection pipelines.
> It NEVER promotes lessons directly, alters eligibility thresholds, creates autonomous execution loops, or allows agents to self-approve.

---

## 2. Implemented Architecture (`src/office/learning-feedback.ts`)

### 2.1 Contracts & Types
* **`AgentAction`**: Explicit representation of actions (`RECOMMENDATION` vs `EXECUTED_ACTION`).
* **`ExecutionOutcome`**: Real technical execution status (`SUCCESS`, `FAILURE`, `PARTIAL`, `BLOCKED`, `CANCELLED`, `UNKNOWN`) with exit code, stdout/stderr, and duration.
* **`ReviewOutcome`**: Real code review status (`PASSED`, `BLOCKED`, `IN_PROGRESS`, `NOT_REQUESTED`) enforcing `MAX_REVIEW_ITERATIONS = 3`.
* **`QAOutcome`**: Real test assertions (`PASSED`, `FAILED`, `SKIPPED`, `NOT_RUN`) with test counts and regression detection.
* **`OutcomeEvaluation`**: Deterministic assessment of empirical evidence.
* **`LearningFeedbackSignal`**: Structured feedback signals:
  * `SUCCESSFUL_EXECUTION`
  * `FAILED_EXECUTION`
  * `REVIEW_BLOCKED`
  * `QA_FAILED`
  * `QA_PASSED`
  * `REGRESSION_DETECTED`
  * `REMEDIATION_VERIFIED`
  * `REPEATED_FAILURE`
  * `PARTIAL_SUCCESS`
  * `UNKNOWN_OUTCOME`

### 2.2 Integration Pipeline
$$\text{AgentAction} + \text{Execution/Review/QA Evidence} \longrightarrow \text{LearningFeedbackEngine} \longrightarrow \text{MemoryIngestPipeline} \longrightarrow \text{PatternDetectionEngine} \longrightarrow \text{LessonCandidateEngine}$$

* Ingests `TASK_RESULT`, `REVIEW_FINDING`, and `REVIEW_BLOCKED` events into the existing memory store.
* Feeds corroborated findings into pattern detection with canonical SHA-256 signatures.
* Multi-task corroboration thresholds ($\ge 3$ independent tasks) and remediation requirements ($\ge 1$ verified remediation) remain strictly enforced.
* Same-task retries do NOT inflate independent task counts.

---

## 3. Test Coverage (`tests/office-learning-feedback.test.ts`)

1. **Successful Execution:** Verifies `SUCCESSFUL_EXECUTION` signal generation.
2. **Failed Execution:** Captures non-zero exit codes as `FAILED_EXECUTION`.
3. **Review Blocked:** Enforces `MAX_REVIEW_ITERATIONS = 3` guardrail as `REVIEW_BLOCKED`.
4. **QA Failures & Regressions:** Distinguishes `QA_FAILED` and `REGRESSION_DETECTED`.
5. **Remediation Verification:** Emits `REMEDIATION_VERIFIED` only upon verified fix + QA pass.
6. **Unknown Outcome:** Insufficient evidence stays `UNKNOWN_OUTCOME`.
7. **Failure Isolation:** Engine errors never throw or break primary execution pipelines.

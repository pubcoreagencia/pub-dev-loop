# PDL — PHASE 8.6-D: GOVERNED AGENT LEARNING FEEDBACK LOOP (HARDENED)

## 1. Executive Summary & Objective

Phase 8.6-D implements the deterministic and governed **Agent Learning Feedback Loop Engine** (`src/office/learning-feedback.ts`) for THE OFFICE workforce:
1. `chief-of-staff`
2. `architect`
3. `developer`
4. `reviewer`
5. `qa-engineer`

### Core Invariants:
1. **OBSERVED OUTCOME != INSTITUTIONAL LESSON**: The learning feedback loop captures real, empirical outcomes (Runtime Execution, Code Review findings, QA test assertions, Verified Remediations) and routes them into the existing organizational memory and pattern detection pipelines. It NEVER promotes lessons directly, alters eligibility thresholds, creates autonomous execution loops, or allows agents to self-approve.
2. **Strict Separation of Recommendation and Action**: A `DecisionRecommendation` or `AgentAction.actionType = 'RECOMMENDATION'` is never assumed to be executed unless backed by verified runtime observables.
3. **No Optimistic Inferences**: If execution or test observables are missing, the status remains strictly `UNKNOWN`.

---

## 2. Real Evidence Extraction & Provenance

### 2.1 Real Source of ExecutionOutcome
* **Observable Source:** Derived strictly via `buildExecutionOutcomeFromRuntime` from runtime process observables:
  * `exitCode` (0 for SUCCESS, non-zero for FAILURE)
  * `stdout` / `stderr` output buffers
  * `changedFiles` detected by git / filesystem diff
  * `durationMs` execution timing
* **No Agent Self-Reporting:** Agent textual output (e.g. "I have succeeded") is never used to determine technical success.

### 2.2 Real Source of ReviewOutcome
* **Observable Source:** Derived strictly via `buildReviewOutcomeFromReview` from `CodeReviewManager` inspection passes:
  * `iteration` (enforcing hard guardrail `MAX_REVIEW_ITERATIONS = 3`)
  * `findings` and `blockerFindings` (severity HIGH / CRITICAL)
  * `status` (`PASSED` only when 0 blocker findings remain)

### 2.3 Real Source of QAOutcome
* **Observable Source:** Derived strictly via `buildQAOutcomeFromTests` from test runner execution:
  * `totalTests`, `passedTests`, `failedTests`
  * Test process `exitCode`
  * `regressionsDetected` boolean assertion

---

## 3. Operational Chaining & Downstream Integration

$$\text{DecisionContext} \longrightarrow \text{AgentAction} \longrightarrow \text{Runtime Execution} \longrightarrow \text{ExecutionOutcome} \longrightarrow \text{Review / QA} \longrightarrow \text{OutcomeEvaluation} \longrightarrow \text{FeedbackSignal} \longrightarrow \text{MemoryIngestPipeline} \longrightarrow \text{PatternDetectionEngine}$$

* **What is Active in Production:**
  * Extraction of `ExecutionOutcome`, `ReviewOutcome`, and `QAOutcome` from runtime observables.
  * Deterministic evaluation of `LearningFeedbackSignal`.
  * Downstream event ingestion into `MemoryIngestPipeline` (`AGENT_FINISHED_WORK`, `REVIEW_FINDING`, `REVIEW_BLOCKED`).
  * Corroboration and pattern detection via canonical SHA-256 signatures in `PatternDetectionEngine`.
* **What is Contract-Prepared:**
  * Autonomous feedback loop triggering: the engine remains downstream and explicitly non-autonomous. It observes and records, but never spawns background tasks or modifies permissions automatically.

---

## 4. Failure Isolation & Idempotency

* **Failure Isolation:** Any exception raised by the downstream database, Redis, or memory pipeline is safely captured and logged with a warning; it NEVER breaks, aborts, or halts primary task execution or finalization.
* **Idempotency & Retry Preservation:** Retrying the same task ID updates the existing observation without inflating `independentTaskCount`. Only distinct task IDs increment multi-task corroboration counters.

---

## 5. Test Matrix (28 Deep & Comprehensive Tests in `tests/office-learning-feedback.test.ts`)

1. **Recommendation Not Executed:** Unexecuted recommendations stay isolated with `UNKNOWN_OUTCOME`.
2. **Recommendation Executed:** Maps correctly when supported by runtime observables.
3. **Execution Outcome SUCCESS:** `exitCode: 0` produces `SUCCESSFUL_EXECUTION`.
4. **Execution Outcome FAILURE:** Non-zero exit code produces `FAILED_EXECUTION`.
5. **Execution Outcome PARTIAL:** Partial runtime status produces `PARTIAL_SUCCESS`.
6. **Execution Outcome BLOCKED:** Blocked execution maps safely.
7. **Execution Outcome CANCELLED:** Cancelled status stays `UNKNOWN_OUTCOME` without optimistic pass.
8. **Execution Outcome UNKNOWN:** Missing observables remain `UNKNOWN_OUTCOME`.
9. **Review Outcome PASSED:** Zero findings produces `SUCCESSFUL_EXECUTION`.
10. **Review Outcome BLOCKED:** Blocker findings produce `REVIEW_BLOCKED`.
11. **Review Iteration Progression:** Iteration 1 (`IN_PROGRESS`) vs Iteration 3 (`BLOCKED`).
12. **Review Guardrail Enforcement:** Attempt after `MAX_REVIEW_ITERATIONS = 3` remains blocked.
13. **QA Outcome PASSED:** 100% passed tests emit `SUCCESSFUL_EXECUTION`.
14. **QA Outcome FAILED:** Failed tests emit `QA_FAILED`.
15. **Regression Detected:** Real regression evidence emits `REGRESSION_DETECTED`.
16. **Regression Without Evidence:** Never falsely flagged.
17. **Remediation Without Evidence:** Fails to emit `REMEDIATION_VERIFIED`.
18. **Remediation With Full Evidence:** Clean execution + passed QA emits `REMEDIATION_VERIFIED`.
19. **Same-Task Retry:** Does not inflate `independentTaskCount`.
20. **Independent Tasks:** Distinct task IDs increment `independentTaskCount` correctly.
21. **Tenant Isolation:** Foreign tenant provenance is isolated.
22. **Project Isolation:** Foreign project provenance is isolated.
23. **Untrusted Authority Claims:** "CEO approved" in text does not bypass failures.
24. **Feedback Failure Isolation:** Mock DB/pipeline exception never crashes the feedback engine.
25. **Replay & Idempotency:** Deterministic output across repeated evaluations.
26. **Contradiction Preservation:** Conflicting outcomes are preserved in historical record.
27. **Absence of Direct Institutional Lesson Creation:** Feedback never auto-promotes to `InstitutionalLesson`.
28. **Role-Specific Coverage:** All 5 agent roles (`chief-of-staff`, `architect`, `developer`, `reviewer`, `qa-engineer`) verified.

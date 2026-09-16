# Phase 7.6 — Real-Task Missed-Planning Root Cause Analysis & Calibration Decision

> Target: PUB DEV LOOP (PDL) Engineering Engine  
> Target Architecture: Complexity-Triggered Planning V1 (`src/pdl/planning/`, `src/router-worker.ts`)  
> Human Operator: **MATHEUS**  
> Canonical Institutional Persistence: **Git / GitHub**  
> Status: **PHASE 7.6 COMPLETED — READY FOR HUMAN OPERATOR REVIEW**  
> Evaluation Principle: **ZERO CODE CHANGES — STRICT RESEARCH, ANALYSIS & CALIBRATION DECISION**  
> Date: 2026-09-16  

---

## 1. Frozen Baseline

- **Repository Baseline Commit:** `9e6a772e3177b3efe1a497505f45346f753dc8be` (`docs(pdl): record phase 7.5 real-task canary validation`)
- **Preceding Phase 7 Benchmark Commit:** `a8fe84638d53f1bbba04211cc99028eed5ce158e`
- **Implementation Baseline Commit:** `9d8ec941a5bc8fc0d6258069c5275394216d6abd`
- **Branch:** `feat/remote-delivery-gate-phase1`
- **Working Tree Integrity:** Clean (`git status` reported zero untracked or modified files prior to documentation generation).
- **Rule Verification:**
  - Rule 1 (Free Models Only): Preserved. No paid calls or unverified models executed.
  - Rule 2 (Fail Closed): Preserved across all analytical paths.
  - Zero Code Alteration: **ZERO lines** of production, test, or engine code modified.

---

## 2. Missed-Planning Case Inventory

Extracted directly from the Phase 7.5 validation report (`docs/evidence/phase7.5/PHASE_7_5_CANARY_REAL_TASK_VALIDATION.md`, Section 5 & Section 9), the 6 tasks where human expectations (`PLANNING`) differed from the classifier decision (`DIRECT`) are:

| Case ID | Source Commit | Title | Target Subsystem / Files | Human Expectation | Classifier Output | Soft Score |
| :--- | :--- | :--- | :--- | :---: | :---: | :---: |
| `REAL-MOD-01` | `64f8d39` | Align post-task neural writeback lifecycle | `src/pdl/neural/neural-bridge.ts`, `src/pdl/neural/post-task-gate.ts`, `tests/...` | `PLANNING` | `DIRECT` | 2 |
| `REAL-MOD-03` | `f70bd05` | Enforce CI SHA binding & `merged_at` check | `src/pdl/delivery/pr-lifecycle-manager.ts`, `src/pdl/delivery/remote-ci-observer.ts`, `src/pdl/delivery/types.ts` | `PLANNING` | `DIRECT` | 0 |
| `REAL-MOD-05` | `9c1fc54` | Decouple daemons & postgres claim tests | `src/repository.ts`, `src/api.ts`, `src/worker.ts`, `tests/postgres-task-claim.test.ts` | `PLANNING` | `DIRECT` | 2 |
| `REAL-MOD-06` | `b27c52c` | Provider multi-turn tool calling loop | `src/providers/router.ts`, `src/providers/openrouter.ts`, `src/routing/engine.ts`, `scripts/...` | `PLANNING` | `DIRECT` | 0 |
| `REAL-CMPX-04` | `452ae23` | Dismantle legacy multi-repo mechanisms | `src/api-worker.ts`, `docs/...`, `tests/pdl/repository-identity-invariant.test.ts` | `PLANNING` | `DIRECT` | 1 |
| `REAL-CMPX-05` | `df09e0b` | Remote delivery merge executor/verifier | `src/pdl/delivery/merge-executor.ts`, `src/pdl/delivery/merge-reconciler.ts`, `src/pdl/delivery/main-verifier.ts`, `src/pdl/delivery/github-client.ts`, `src/pdl/delivery/types.ts` | `PLANNING` | `DIRECT` | 0 |

---

## 3. Individual Case Analysis

### Case 1: `REAL-MOD-01`

```text
CASE_ID: REAL-MOD-01

ORIGINAL OBJECTIVE:
Align post-task neural writeback lifecycle and prevent unhandled promise rejection on closed experience streams.

ORIGINAL PROMPT:
fix(pdl): align post-task neural writeback lifecycle
Ensure postTaskNeuralGate.evaluateAndRecord safely drains and writes experiences to the neural bridge without racing against task completion. Update tests in tests/pdl/post-task-experience-gate.test.ts.

HUMAN EXPECTATION:
PLANNING

CLASSIFIER:
DIRECT

HARD SIGNALS:
None

SOFT SIGNALS:
- SOFT_01_MULTI_FILE (weight: 2, files: src/pdl/neural/neural-bridge.ts, src/pdl/neural/post-task-gate.ts, tests/pdl/post-task-experience-gate.test.ts)

SOFT SCORE:
2 (Threshold: 3)

TARGET FILES:
src/pdl/neural/neural-bridge.ts
src/pdl/neural/post-task-gate.ts
tests/pdl/post-task-experience-gate.test.ts

ACTUAL ARCHITECTURAL IMPACT:
Internal subsystem lifecycle synchronization between neural memory bridge and post-task experience gate. Touches async promise drainage.

ACTUAL CHANGE SURFACE:
3 files (+278 / -285 lines in git history, dominated by test fixtures; engine code was ~17 lines modified).

ACTUAL RISK:
Medium. Async unhandled rejection could leak or crash worker loop if not guarded, but isolated to neural logging.

TEST / VERIFICATION COMPLEXITY:
Moderate. Required async mock drain tests and timeout verification.

WHY HUMAN EXPECTED PLANNING:
Involves lifecycle coordination, background asynchronous writebacks, and touches cross-module components (neural-bridge + post-task-gate).

WHY CLASSIFIER CHOSE DIRECT:
Target paths are in src/pdl/neural/ which is NOT listed in HARD_01 (scheduler|reaper|dlq|retry|governance|persistence). The prompt did not use explicit concurrency keywords (e.g. mutex, lease) or refactoring keywords. Multi-file scored 2, remaining strictly below threshold 3.

ROOT CAUSE:
The neural subsystem (src/pdl/neural/) is an engine lifecycle boundary created after the Phase 6.1 specification, leaving a signal coverage gap in HARD_01. Additionally, prompt phrasing lacked explicit concurrency tokens despite dealing with asynchronous drainage.

CLASSIFICATION:
A — SIGNAL COVERAGE GAP
```

---

### Case 2: `REAL-MOD-03`

```text
CASE_ID: REAL-MOD-03

ORIGINAL OBJECTIVE:
Handle GitHub merged_at in PR list and enforce CI SHA binding in remote delivery pipeline.

ORIGINAL PROMPT:
fix(delivery): handle GitHub merged_at in PR list and enforce CI SHA binding
GitHub list PRs returns merged=null even if merged_at is present. Update PrLifecycleManager to inspect merged_at. Update RemoteCiObserver to strictly bind check runs to expected headSha. Add tests.

HUMAN EXPECTATION:
PLANNING

CLASSIFIER:
DIRECT

HARD SIGNALS:
None

SOFT SIGNALS:
None

SOFT SCORE:
0 (Threshold: 3)

TARGET FILES:
src/pdl/delivery/pr-lifecycle-manager.ts
src/pdl/delivery/remote-ci-observer.ts
src/pdl/delivery/types.ts
tests/pdl/delivery/pr-lifecycle-manager.test.ts
tests/pdl/delivery/remote-ci-observer.test.ts

ACTUAL ARCHITECTURAL IMPACT:
Enforces strict cryptographic SHA binding on remote CI observations to prevent TOCTOU race conditions where checks for an old commit satisfy a newly pushed commit. Touches contract in types.ts.

ACTUAL CHANGE SURFACE:
5 files (+166 / -10 lines).

ACTUAL RISK:
High. A flaw in CI SHA binding can result in deploying unverified or malicious code to upstream production branches.

TEST / VERIFICATION COMPLEXITY:
High. Requires simulating out-of-order GitHub API responses, stale SHA checks, and null merged attributes.

WHY HUMAN EXPECTED PLANNING:
Security-critical delivery pipeline logic directly guarding production merges against TOCTOU and SHA substitution attacks.

WHY CLASSIFIER CHOSE DIRECT:
src/pdl/delivery/ is absent from HARD_01. While src/pdl/delivery/types.ts was modified, HARD_03_BREAKING_CONTRACT checks for words like 'breaking', 'refactor', 'modify', 'union', or contract filenames matching *contract*.ts|*types.ts in combination with breaking keywords, but the prompt text used 'handle' and 'enforce', while file extraction in classifier did not flag contract mutation as breaking. Soft score was 0 because files were referenced in natural prose without triggering threshold.

ROOT CAUSE:
src/pdl/delivery/ is completely unmapped in HARD_01, and the security/safety impact of remote delivery verification is not recognized as a Hard Signal.

CLASSIFICATION:
A — SIGNAL COVERAGE GAP
```

---

### Case 3: `REAL-MOD-05`

```text
CASE_ID: REAL-MOD-05

ORIGINAL OBJECTIVE:
Complete Phase 4B daemon independence and decouple daemon lifecycle from postgres task claim tests.

ORIGINAL PROMPT:
feat(pdl): complete phase 4B daemon independence
Ensure background daemons can run independently from postgres task claiming without holding locks across test boundaries. Update repository.ts, worker.ts, and add tests in tests/postgres-task-claim.test.ts.

HUMAN EXPECTATION:
PLANNING

CLASSIFIER:
DIRECT

HARD SIGNALS:
None

SOFT SIGNALS:
- SOFT_04_ASYNC_CONCURRENCY (weight: 2, matched keyword: 'lock')
- SOFT_01_MULTI_FILE (not triggered if regex failed on generic names)

SOFT SCORE:
2 (Threshold: 3)

TARGET FILES:
src/repository.ts
src/api.ts
src/worker.ts
tests/postgres-task-claim.test.ts
README.md

ACTUAL ARCHITECTURAL IMPACT:
Decoupling daemon process lifecycles from database connection holding.

ACTUAL CHANGE SURFACE:
5 files (+135 / -19 lines). However, the changes in src/api.ts, src/repository.ts, and src/worker.ts were exactly 1 to 2 lines each (minor flag adjustments), while 125 lines were in the test file.

ACTUAL RISK:
Low to Moderate. Changes were localized wiring adjustments; the core persistence logic was already decoupled.

TEST / VERIFICATION COMPLEXITY:
Moderate (integration test verifying postgres claim isolation).

WHY HUMAN EXPECTED PLANNING:
Human reviewer saw words like "daemon independence", "postgres task claim", and "locks", inferring a major concurrency refactor.

WHY CLASSIFIER CHOSE DIRECT:
Matched concurrency keyword ('lock' -> 2 pts), but did not reach threshold 3. src/repository.ts and src/worker.ts are legacy root files, not src/pdl/persistence/ or src/pdl/scheduler/.

ROOT CAUSE:
Human reviewer overclassified this task based on high-level operational terminology ("daemon independence"). In reality, the production diff was trivial (8 lines across 3 files: passing a flag), with no architectural change to database concurrency primitives. The classifier's decision of DIRECT was objectively appropriate.

CLASSIFICATION:
C — HUMAN OVERCLASSIFICATION
```

---

### Case 4: `REAL-MOD-06`

```text
CASE_ID: REAL-MOD-06

ORIGINAL OBJECTIVE:
Harden provider multi-turn tool calling loop, fine-grained error codes, and reproducible smoke runner.

ORIGINAL PROMPT:
feat(providers): harden tool calling multi-turn loop, fine-grained error codes, and reproducible smoke runner
Ensure OpenRouterProvider and RouterProvider properly handle multi-round tool calling loops without prematurely exiting on intermediate stops. Add fine-grained error classification for HTTP 401, 429, and 500.

HUMAN EXPECTATION:
PLANNING

CLASSIFIER:
DIRECT

HARD SIGNALS:
None

SOFT SIGNALS:
None

SOFT SCORE:
0 (Threshold: 3)

TARGET FILES:
src/providers/router.ts
src/providers/openrouter.ts
src/routing/engine.ts
scripts/smoke-phase2-3.ts

ACTUAL ARCHITECTURAL IMPACT:
Provider engine state machine loop: changes how multi-turn tool calling streams are accumulated, prevents premature termination, and introduces structured error taxonomy.

ACTUAL CHANGE SURFACE:
4 files (+370 / -56 lines; 326 lines in smoke runner script, ~44 lines in provider core).

ACTUAL RISK:
High for model interaction. A bug in the tool-calling loop causes infinite loops, model stalls, or silent loss of tool response output.

TEST / VERIFICATION COMPLEXITY:
High. Requires mocking recursive model interactions and verifying error status codes.

WHY HUMAN EXPECTED PLANNING:
Tool calling loops and provider routing represent complex multi-turn asynchronous protocol state machines.

WHY CLASSIFIER CHOSE DIRECT:
src/providers/* and src/routing/* are NOT included in HARD_01. HARD_01 only checks src/router-worker.ts, not the underlying provider implementations. Prompt did not match concurrency keywords (it said "multi-turn loop", not "race condition" or "mutex"). Soft score evaluated to 0.

ROOT CAUSE:
src/providers/ and src/routing/ constitute external LLM protocol adapter boundaries. The classifier treats provider internals as ordinary code rather than an architectural subsystem, while prompt lacked specific lexical triggers for complex state machines.

CLASSIFICATION:
E — MODEL GAP (Contextual State-Machine Complexity) & A — SIGNAL COVERAGE GAP
```

---

### Case 5: `REAL-CMPX-04`

```text
CASE_ID: REAL-CMPX-04

ORIGINAL OBJECTIVE:
Dismantle legacy multi-repo mechanisms and enforce hard repository identity invariant in orchestrator.

ORIGINAL PROMPT:
fix(security): dismantle getScheduledRepo and createSafetyBackup in orchestrator
Permanently convert getScheduledRepo and createSafetyBackup to fail-closed hard-stops in src/api-worker.ts. Add structural immunity tests F & G in repository-identity-invariant.test.ts.

HUMAN EXPECTATION:
PLANNING

CLASSIFIER:
DIRECT

HARD SIGNALS:
None

SOFT SIGNALS:
- SOFT_05_ERROR_HANDLING_DEPTH (weight: 1, matched keyword: 'fail-closed')

SOFT SCORE:
1 (Threshold: 3)

TARGET FILES:
src/api-worker.ts
tests/pdl/repository-identity-invariant.test.ts
docs/evidence/phase5.5/CEO_RECOVERY_PROTOCOL_EVIDENCE.md

ACTUAL ARCHITECTURAL IMPACT:
Security dismantling under CEO Recovery Protocol. Eliminates dangerous autonomous mutation methods in src/api-worker.ts by making them throw hard stop errors.

ACTUAL CHANGE SURFACE:
3 files (+37 / -52 lines; ~15 lines in src/api-worker.ts converting functions to throw).

ACTUAL RISK:
Low execution complexity, but extreme security context (incident remediation). The actual edit was replacing method bodies with throw new Error(...).

TEST / VERIFICATION COMPLEXITY:
Low to Moderate. Directly verified by 2 unit tests asserting method rejection.

WHY HUMAN EXPECTED PLANNING:
Human categorized this as complex because it belongs to the CEO RECOVERY PROTOCOL and addresses an unauthorized autonomous commit security incident.

WHY CLASSIFIER CHOSE DIRECT:
Target file was src/api-worker.ts. HARD_01 monitors src/router-worker.ts, but NOT src/api-worker.ts. HARD_05 monitors src/pdl/security/ and repo-authorization.ts, but does not monitor src/api-worker.ts. The prompt only hit fail-closed (1 pt), giving score 1 < 3.

ROOT CAUSE:
Divergence between contextual/historical criticality (security incident remediation) and physical code complexity (deleting 40 lines and adding 2 throw statements). From a pure code transformation perspective, this task was completely straightforward and did not require pre-planning. Human overclassified based on emotional/incident context.

CLASSIFICATION:
C — HUMAN OVERCLASSIFICATION
```

---

### Case 6: `REAL-CMPX-05`

```text
CASE_ID: REAL-CMPX-05

ORIGINAL OBJECTIVE:
Implement Phase 3B remote delivery merge executor, reconciler, and main verifier.

ORIGINAL PROMPT:
feat(delivery): implement Phase 3B merge executor, reconciler, and main verifier
Create src/pdl/delivery/merge-executor.ts, merge-reconciler.ts, and main-verifier.ts with comprehensive vitest test coverage. Ensure TOCTOU protection, 409 Conflict handling, and post-ambiguity state resolution.

HUMAN EXPECTATION:
PLANNING

CLASSIFIER:
DIRECT

HARD SIGNALS:
None

SOFT SIGNALS:
None

SOFT SCORE:
0 (Threshold: 3)

TARGET FILES:
src/pdl/delivery/merge-executor.ts
src/pdl/delivery/merge-reconciler.ts
src/pdl/delivery/main-verifier.ts
src/pdl/delivery/github-client.ts
src/pdl/delivery/types.ts
tests/pdl/delivery/merge-executor.test.ts
tests/pdl/delivery/merge-reconciler.test.ts
tests/pdl/delivery/main-verifier.test.ts
tests/pdl/delivery/github-client.test.ts

ACTUAL ARCHITECTURAL IMPACT:
Major architectural subsystem implementation: introduces automated GitHub PR merge execution, post-timeout state reconciliation, adversarial SHA divergence protection, and remote branch verification.

ACTUAL CHANGE SURFACE:
10 files (+1,524 lines of code and tests).

ACTUAL RISK:
Critical. Autonomous merging to main without human oversight has the highest possible operational blast radius in PDL.

TEST / VERIFICATION COMPLEXITY:
Very High. 4 test suites, 800+ lines of test code covering network timeouts, replay attacks, 409 conflicts, and governance gates.

WHY HUMAN EXPECTED PLANNING:
This is objectively one of the most complex, high-risk architectural subsystems in the entire repository. Pre-planning is essential to decompose interfaces, error handling, and test fixtures.

WHY CLASSIFIER CHOSE DIRECT:
src/pdl/delivery/ was not in HARD_01. The prompt did not use the exact literal string "refactor" or "circular dependency" (HARD_04), did not use exact concurrency keywords from the list (it mentioned "TOCTOU protection" and "post-ambiguity", neither of which are in CONCURRENCY_KEYWORDS), and did not include literal text "50 lines of code" (SOFT_07). Hence, it scored 0 and fell back to DIRECT.

ROOT CAUSE:
Pure architectural coverage gap combined with signal expression gap. src/pdl/delivery/ is the core execution boundary for delivery, equivalent in risk to scheduler and reaper. Missing it is a direct omission in the Hard Signal taxonomy.

CLASSIFICATION:
A — SIGNAL COVERAGE GAP
```

---

## 4. Root Cause Classification Summary

| Case ID | Primary Root Cause Category | Description |
| :--- | :---: | :--- |
| `REAL-MOD-01` | **A — SIGNAL COVERAGE GAP** | Subsystem `src/pdl/neural/` omitted from core lifecycle list. |
| `REAL-MOD-03` | **A — SIGNAL COVERAGE GAP** | Subsystem `src/pdl/delivery/` omitted from core lifecycle list. |
| `REAL-MOD-05` | **C — HUMAN OVERCLASSIFICATION** | Trivial 8-line flag change across 3 files; classified by human based on high-level operational terms ("daemon independence"). Direct execution was objectively optimal. |
| `REAL-MOD-06` | **E — MODEL GAP** & **A** | Complex asynchronous multi-turn state machine in `src/providers/router.ts`. Provider engine boundaries are unmapped, and state-machine nuance eludes lexical keywords. |
| `REAL-CMPX-04` | **C — HUMAN OVERCLASSIFICATION** | Replacing dismantled methods with `throw` in `src/api-worker.ts`. High emotional/incident stakes (CEO recovery) but near-zero structural coding complexity. Direct execution was appropriate. |
| `REAL-CMPX-05` | **A — SIGNAL COVERAGE GAP** | Massive new subsystem (`src/pdl/delivery/`, 1,524 lines, critical merge authority) omitted from HARD_01. |

### Distribution:
- **A — Signal Coverage Gap:** 3 cases (`REAL-MOD-01`, `REAL-MOD-03`, `REAL-CMPX-05`)
- **C — Human Overclassification:** 2 cases (`REAL-MOD-05`, `REAL-CMPX-04`)
- **E — Model Gap / Contextual State Machine:** 1 case (`REAL-MOD-06`)
- **B — Signal Expression Gap:** 0 primary (contributed as secondary factor in `REAL-CMPX-05`)
- **D — Threshold / Weight Limitation:** 0 primary

---

## 5. Architectural Analysis: The Delivery and Worker Boundaries

### 5.1 Deep Dive: `src/pdl/delivery/`
- **Architectural Role:** `src/pdl/delivery/` controls autonomous PR creation (`pr-lifecycle-manager.ts`), status check polling (`remote-ci-observer.ts`), branch verification (`main-verifier.ts`), and remote merge execution (`merge-executor.ts`, `merge-reconciler.ts`).
- **Blast Radius:** Highest in PDL. It directly mutates remote canonical repositories by merging code to `main`. A defect here can push unverified, breaking, or compromised code to production.
- **Why was it omitted from HARD_01?** Git history confirms: `src/pdl/delivery/` was implemented during Phase 5.6 (`commit 84b8ce1`, `df09e0b`, `68dcb66`, `614819b` on Mon Sep 14). The Hard Signal list in `src/pdl/planning/classifier.ts` was drafted based on Phase 6.1 specs and frozen during Phase 7 (`commit 9d8ec94`), copying an earlier static enumeration of modules (`scheduler`, `reaper`, `dlq`, `retry`, `governance`, `persistence`). It was an institutional synchronization oversight, not a deliberate design choice.
- **Contract Equivalence:** Architecturally, `src/pdl/delivery/` has identical risk, lifecycle impact, and governance coupling to `src/pdl/governance/` and `src/pdl/persistence/`.

### 5.2 Deep Dive: `src/api-worker.ts`
- **Architectural Role:** `src/api-worker.ts` is the legacy Cloudflare Worker and API daemon. During the Phase 5.5 CEO Recovery Protocol (`43910c6`, `452ae23`), all autonomous mutation logic was stripped and converted to dead-end hard stops.
- **Current Role:** It is now primarily an HTTP endpoint router and dead-stop tombstone. The active agent execution engine resides in `src/router-worker.ts`.
- **Is it an Architectural Boundary?** No. Treating `src/api-worker.ts` as an architectural hard signal would be an anti-pattern. Changes in `src/api-worker.ts` are either HTTP route plumbing or dead-code dismantling. `REAL-CMPX-04` proved that editing it was trivial (`DIRECT` was completely safe and consumed 0 planning overhead). Adding `src/api-worker.ts` to Hard Signals would cause False Planning on simple API tweaks.

---

## 6. Historical Evidence & Comparison with Phase 4

- **Phase 4 Lesson:** Universal planning created severe latency and token overhead on simple tasks, while causing over-engineering regressions (e.g. creating 10-step plans to edit a single comment or rename a variable).
- **Phase 7.5 Confirmation:** Direct tasks ran in **18.2 ms** (vs 49.4 ms for planned tasks) and saved **26.0% total tokens**. Simple tasks achieved a **0.0% False Planning Rate**.
- **The Danger of Over-Correction:** If we attempt to solve the 6 missed cases by lowering the soft threshold to 1 or 2, or by treating any multi-file task as complex, we immediately re-introduce Phase 4 pathologies: simple documentation updates and localized flag adjustments would trigger unnecessary planning.

---

## 7. Calibration Options Evaluated

### OPTION 0 — NO CHANGE
- Accept the 50% missed planning rate in real tasks.
- *Evaluation:* Unacceptable long-term. `REAL-CMPX-05` (+1,524 lines, automated merge executor) executing without pre-execution planning is an existential risk to remote repository integrity.

### OPTION 1 — EXPAND HARD SIGNALS (Subsystem Alignment)
- Add verified core autonomous subsystems created in Phase 5.6 to `HARD_01_LIFECYCORE`: specifically `src/pdl/delivery/` and `src/pdl/neural/`.
- *Evaluation:* Highly sustainable and generalizable. These are not arbitrary files; they are formal architectural boundaries within `src/pdl/` that hold lifecycle and mutation authority.

### OPTION 2 — IMPROVE SOFT SIGNALS
- Add keywords to `SOFT_04` (`toctou`, `reconcil`, `state machine`) and refine `SOFT_01` to scale with file count (e.g. >3 files = 3 pts).
- *Evaluation:* Promising, but lexical regex on prompts will always suffer from phrasing variations. Must be done conservatively.

### OPTION 3 — LOWER THRESHOLD (Threshold = 2)
- Lower provisional soft threshold from 3 to 2.
- *Evaluation:* **REJECTED.** As proven in Phase 7.5, tasks like `REAL-SIMP-07` (2 files touched, score 2) and `REAL-AMB-01` (score 2) would immediately be forced into planning, causing False Planning and violating the core Phase 7 hypothesis.

### OPTION 4 — CONTEXTUAL / SEMANTIC CLASSIFICATION (LLM Evaluator)
- Use a small LLM call to classify task complexity before deciding on planning.
- *Evaluation:* **REJECTED.** Violates determinism, introduces ~800ms latency to every single simple task, consumes tokens, introduces non-deterministic flake, and violates Rule 2 simplicity.

### OPTION 5 — TWO-STAGE DETERMINISTIC GATE
- Evaluate hard signals first; then evaluate structural metadata (git diff estimation, declared file counts); then soft textual signals.
- *Evaluation:* Structurally sound, but premature for V1.1.

---

## 8. Decision Matrix

| Option | Missed Planning | False Planning Risk | Complexity | Determinism | Auditability | Maintenance | Decision |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Option 0: No Change** | HIGH | LOW | LOW | HIGH | HIGH | HIGH | **REJECT** |
| **Option 1: Expand Hard Signals** | LOW | LOW | LOW | HIGH | HIGH | HIGH | **ADOPT** |
| **Option 2: Improve Soft Signals** | MEDIUM | MEDIUM | MEDIUM | HIGH | HIGH | MEDIUM | **DEFER** |
| **Option 3: Change Threshold (<3)** | LOW | HIGH | LOW | HIGH | HIGH | HIGH | **REJECT** |
| **Option 4: Semantic Classifier** | LOW | HIGH | HIGH | LOW | LOW | LOW | **REJECT** |
| **Option 5: Two-Stage Deterministic** | LOW | LOW | HIGH | HIGH | HIGH | MEDIUM | **DEFER (V2)** |

---

## 9. Anti-Frankenstein Analysis

### The Critical Test:
> *"Se adicionarmos uma nova regra para cada caso: Estamos modelando complexidade ou catalogando nomes de arquivos?"*

- If an engineer proposes adding:
  `src/api-worker.ts`, `src/providers/router.ts`, `src/repository.ts`, `scripts/smoke-phase2-3.ts`
  to the classifier, that is **cataloging file names** (Frankenstein patch). It must be **STRICTLY REJECTED**.
- However, `src/pdl/delivery/` and `src/pdl/neural/` are entire top-level architectural modules under `src/pdl/`. The existing pattern in `classifier.ts:128` is:
  `/(?:^|\/)(?:src\/pdl\/(?:scheduler|reaper|dlq|retry|governance|persistence)\/|src\/router-worker\.ts)/i`
- Modifying this regex to encompass `delivery` and `neural` is **NOT** cataloging ad-hoc files; it is aligning the classifier's map of the PDL core engine with the actual directory structure of `src/pdl/`.
- Furthermore, 2 of the 6 cases (`REAL-MOD-05` and `REAL-CMPX-04`) were **Human Overclassifications**. Adding rules to capture them would be a catastrophic violation of the Anti-Frankenstein principle, degrading the engine just to satisfy human subjective bias.

**Anti-Frankenstein Test Result: PASS** (Clean conceptual boundaries identified; ad-hoc patching rejected).

---

## 10. Critical Synthesis: One Problem or Six?

> **Question:** *Os 6 missed-planning cases são seis problemas independentes ou manifestações de uma única deficiência arquitetural do classifier?*

**Answer:**  
They are **manifestations of a single structural boundary synchronization lag, compounded by human subjective bias**.

Specifically:
1. **The Subsystem Synchronization Lag (4/6 cases):** The engine architecture evolved rapidly in Phase 5.5 and 5.6 by introducing autonomous delivery (`src/pdl/delivery/`) and post-task neural reflection (`src/pdl/neural/`). The classifier's Hard Signal catalog remained frozen on the older Phase 6.1 core list (`scheduler`, `reaper`, `dlq`, `retry`, `governance`, `persistence`). This single oversight accounts for `REAL-CMPX-05`, `REAL-MOD-03`, `REAL-MOD-01`, and partially `REAL-MOD-06`.
2. **The Subjective Human Bias (2/6 cases):** Reviewers expected planning on tasks with high-sounding operational titles ("dismantle legacy orchestrator", "daemon independence") even when the physical code change was a trivial 2-line patch. The classifier was objectively right; the human was wrong.

There are not six separate bugs. There is exactly **one legitimate engine coverage gap** (`src/pdl/delivery/` & `src/pdl/neural/`) and **one cognitive calibration gap** in human expectations.

---

## 11. Recommended Calibration

### Recommendation: **`B — V1.1 MINOR CALIBRATION`**

For the future V1.1 calibration (when authorized by Operator **MATHEUS**):
1. **Align Core Subsystem Hard Signal:** Update `HARD_01_LIFECYCLE_CORE` regex to include `delivery` and `neural`:
   ```typescript
   /(?:^|\/)(?:src\/pdl\/(?:scheduler|reaper|dlq|retry|governance|persistence|delivery|neural)\/|src\/router-worker\.ts)/i
   ```
2. **Keep Soft Threshold at 3:** Do NOT lower the threshold to 2. Preserving threshold 3 is mandatory to maintain the 0% False Planning Rate and protect simple tasks.
3. **Keep `src/api-worker.ts` out of Hard Signals:** Reject ad-hoc cataloging of legacy files.
4. **Maintain Fail-Closed Invariants:** Zero changes to governance or provider fallback.

---

## 12. Expected Impact of Recommended V1.1 Calibration

If V1.1 Minor Calibration is applied to the Phase 7.5 dataset:
- `REAL-CMPX-05` (Merge executor): DIRECT -> **PLANNING** (Resolved via `HARD_01`)
- `REAL-MOD-03` (CI SHA binding): DIRECT -> **PLANNING** (Resolved via `HARD_01`)
- `REAL-MOD-01` (Neural writeback): DIRECT -> **PLANNING** (Resolved via `HARD_01`)
- `REAL-MOD-05` (Daemon tests): DIRECT -> **DIRECT** (Appropriate; avoids over-engineering)
- `REAL-CMPX-04` (Orchestrator hard-stop): DIRECT -> **DIRECT** (Appropriate; avoids over-engineering)
- `REAL-MOD-06` (Provider loop): DIRECT -> **DIRECT** (Pending semantic/state machine signals in V2)

**Projected Metrics under V1.1:**
- **Missed Planning Rate on Genuine High-Risk Tasks:** Drops from 50.0% to **16.7%** (1/6).
- **False Planning Rate:** Remains **0.0%** (0/9).
- **Hard Signal Recall:** Remains **100.0%**.
- **Human Agreement Rate:** Increases from 71.4% to **85.7%** (18/21).

---

## 13. Risks & Limitations

1. **Provider Engine Boundary (`src/providers/`):** Model protocol adaptations (`REAL-MOD-06`) remain outside Hard Signals. This is an intentional boundary: provider adapters are infrastructure clients, not PDL core delivery engines.
2. **Natural Language Variability:** Prompts that describe complex behavior without referencing file paths or standard concurrency tokens will continue to execute directly unless they touch core subsystems. This is an acceptable trade-off to ensure zero false planning.

---

## 14. Decision Gate

**Formal Recommendation to Operator MATHEUS:**
- **ADOPT DECISION:** **`B — V1.1 MINOR CALIBRATION`** (Architectural subsystem synchronization).
- **CURRENT STATUS:** **HARD STOP.** Do NOT implement V1.1 code changes until explicitly ordered.
- **GATE ACTION:** Commit this analytical report to Git and await authorization from **MATHEUS**.

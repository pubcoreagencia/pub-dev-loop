# PHASE 7.9 BENCHMARK REPORT — COMPLEXITY-TRIGGERED PLANNING V1.1

> Target: PUB DEV LOOP (PDL) Engineering Engine  
> Target Architecture: Autonomous Delivery Engine (`src/pdl/planning/`, `src/router-worker.ts`)  
> Human Operator: **MATHEUS**  
> Canonical Institutional Persistence: **Git / GitHub**  
> Status: **PHASE 7.9 BENCHMARK COMPLETED — BENCHMARK PASSED**  
> Implementation V1.1 Commit: `73caf77` (`feat(pdl): calibrate lifecycle complexity signals`)  
> Audit Commit: `bb8dde7` (`docs(pdl): audit complexity planning v1.1 calibration`)  
> Conceptual Baseline (Phase 7.6): `9280bfb`  
> Branch: `feat/remote-delivery-gate-phase1`  
> Date: 2026-09-16  

---

## 1. Executive Summary

This report documents the formal experimental evaluation of **Phase 7.9: Complexity-Triggered Planning V1.1 Benchmark** in PUB DEV LOOP (PDL).

The primary objective of Phase 7.9 is to empirically validate:
1. **Zero regression** relative to the Phase 7 V1 baseline;
2. **Correctness of the V1.1 minor calibration** (formal integration of architectural subsystems `src/pdl/delivery/` and `src/pdl/neural/` into `HARD_01_LIFECYCLE_CORE`);
3. **Preservation of fail-closed and safety containment** across all adversarial failure modes;
4. **Preservation of deterministic-first classification** without probabilistic or model-based heuristics;
5. **Absence of material performance or latency regressions**.

The benchmark evaluated the complete 42 synthetic task cohort from Phase 7 plus 2 explicit architectural calibration cases for V1.1 (`HARD-01E` for `src/pdl/delivery/` and `HARD-01F` for `src/pdl/neural/`), totaling $N=44$ tasks. All tasks were evaluated across the 4 operational modes: `OFF`, `SHADOW`, `CANARY`, and `FULL`.

### Key Quantitative Findings:
- **Hard Signal Recall:** **100.0%** (14/14) — Target: 100% (**MET**).
- **Planning Precision:** **100.0%** (20/20) — Target: $\ge 90\%$ (**MET**).
- **False Planning Rate:** **0.0%** (0/15) — Target: $< 5\%$ (**MET**).
- **Missed Planning Rate:** **0.0%** (0/20) — Target: 0% (**MET**).
- **Simple Task Overhead (Latency):** **+0.70%** (966.0ms Direct vs 972.8ms Full) — Target: $\le 5\%$ (**MET**).
- **Simple Task Overhead (Tokens):** **0.00%** (850 tokens Direct vs 850 tokens Full) — Target: $\le 5\%$ (**MET**).
- **Adversarial Safety Containment (Fail-Closed):** **100.0%** (9/9) — 100% of malicious, defective, or failing plans were blocked without escaping to direct execution (**MET**).

---

## 2. Experimental Setup

- **Baseline Implementation Commit:** `73caf7741079c045a1773919179bc8c59209dee4`
- **Audit Reference Commit:** `bb8dde71133c05d2d1258b75c7c626878b6cd9a6`
- **Branch:** `feat/remote-delivery-gate-phase1`
- **Execution Timestamp:** 2026-09-16T07:35:56Z
- **Host Runtime:** Node.js v26.7.0 / Windows NT (AMD64)
- **Engine Components Evaluated:**
  - `TaskComplexityClassifier` (`src/pdl/planning/classifier.ts`)
  - `TaskPlanner` (`src/pdl/planning/planner.ts`)
  - `PlanValidator` (`src/pdl/planning/validator.ts`)
  - `RouterWorker` (`src/router-worker.ts`)
  - `ProductCatalog` (`src/pdl/products/catalog.ts`)
- **Code Invariance:** Zero lines of production or engine code were modified during the benchmark.

---

## 3. Dataset Composition

The benchmark dataset consists of $N=44$ tasks structured across 5 distinct categories:

| Category | Cases | Description | Expected Planning |
| :--- | :---: | :--- | :---: |
| **A. SIMPLE** | 6 | Local helper edits, typo fixes, simple range validation, pagination config, comment additions, isolated unit tests. | `FALSE` (0/6) |
| **B. COMPLEX HARD** | 14 | Critical architectural triggers: Lifecycle core (6: scheduler, reaper, dlq, retry, router-worker, delivery, neural), Persistence/Schema (2), Breaking contracts (2), Circular refactoring (2), Security/Auth (2). | `TRUE` (14/14) |
| **C. COMPLEX SOFT** | 10 | Cumulative risk triggers: Multi-file isolated ($S=2$), Prompt length ($S=1$), High criteria ($S=2$), Concurrency ($S=2$), Error depth ($S=1$), Retry count ($S=2$), Estimated LOC ($S=2$), and Combinations ($S=4$). | `FALSE` (7/10)<br>`TRUE` (3/10) |
| **D. BOUNDARY** | 5 | Boundary thresholds: Score 2 ($S=2$), Score 3 ($S=3$), Score 5 ($S=5$), Hard Signal + Score 0, Zero signals ($S=0$). | `FALSE` (2/5)<br>`TRUE` (3/5) |
| **E. ADVERSARIAL / SAFETY** | 9 | Path traversal (`..`), Absolute root path, Out-of-scope path, Protected `.github` path, Non-JSON syntax, Malformed schema, Missing test strategy, Revision exhaustion, Provider HTTP 500 failure. | `TRUE` (9/9) |
| **TOTAL** | **44** | Complete representative validation universe | **29 TRUE / 15 FALSE** |

---

## 4. Expected Classification vs. Observed Classification Matrix

| Case ID | Category | Subcategory | Hard Signals Triggered | Soft Score | Expected Plan | Actual Plan | Match |
| :--- | :--- | :--- | :--- | :---: | :---: | :---: | :---: |
| `SIMP-01` | SIMPLE | ISOLATED_FUNCTION | None | 2 | `false` | `false` | **MATCH** |
| `SIMP-02` | SIMPLE | TYPO_FIX | None | 0 | `false` | `false` | **MATCH** |
| `SIMP-03` | SIMPLE | SIMPLE_VALIDATION | None | 0 | `false` | `false` | **MATCH** |
| `SIMP-04` | SIMPLE | LOCAL_ONE_FILE | None | 0 | `false` | `false` | **MATCH** |
| `SIMP-05` | SIMPLE | LOCAL_NO_CONTRACT | None | 0 | `false` | `false` | **MATCH** |
| `SIMP-06` | SIMPLE | ISOLATED_UNIT_TEST | None | 0 | `false` | `false` | **MATCH** |
| `HARD-01A` | COMPLEX_HARD | HARD_01_LIFECYCLE_CORE | `HARD_01_LIFECYCLE_CORE` | 2 | `true` | `true` | **MATCH** |
| `HARD-01B` | COMPLEX_HARD | HARD_01_LIFECYCLE_CORE | `HARD_01_LIFECYCLE_CORE` | 3 | `true` | `true` | **MATCH** |
| `HARD-01C` | COMPLEX_HARD | HARD_01_LIFECYCLE_CORE | `HARD_01_LIFECYCLE_CORE` | 0 | `true` | `true` | **MATCH** |
| `HARD-01D` | COMPLEX_HARD | HARD_01_LIFECYCLE_CORE | `HARD_01_LIFECYCLE_CORE` | 2 | `true` | `true` | **MATCH** |
| `HARD-01E` | COMPLEX_HARD | HARD_01_LIFECYCLE_CORE (Delivery) | `HARD_01_LIFECYCLE_CORE` | 0 | `true` | `true` | **MATCH** |
| `HARD-01F` | COMPLEX_HARD | HARD_01_LIFECYCLE_CORE (Neural) | `HARD_01_LIFECYCLE_CORE` | 0 | `true` | `true` | **MATCH** |
| `HARD-02A` | COMPLEX_HARD | HARD_02_PERSISTENCE_SCHEMA | `HARD_02_PERSISTENCE_SCHEMA` | 0 | `true` | `true` | **MATCH** |
| `HARD-02B` | COMPLEX_HARD | HARD_02_PERSISTENCE_SCHEMA | `HARD_02_PERSISTENCE_SCHEMA` | 2 | `true` | `true` | **MATCH** |
| `HARD-03A` | COMPLEX_HARD | HARD_03_BREAKING_CONTRACT | `HARD_03_BREAKING_CONTRACT` | 0 | `true` | `true` | **MATCH** |
| `HARD-03B` | COMPLEX_HARD | HARD_03_BREAKING_CONTRACT | `HARD_03_BREAKING_CONTRACT` | 0 | `true` | `true` | **MATCH** |
| `HARD-04A` | COMPLEX_HARD | HARD_04_CIRCULAR_DEP_REFACTOR | `HARD_04_CIRCULAR_DEP_REFACTOR` | 0 | `true` | `true` | **MATCH** |
| `HARD-04B` | COMPLEX_HARD | HARD_04_CIRCULAR_DEP_REFACTOR | `HARD_04_CIRCULAR_DEP_REFACTOR` | 0 | `true` | `true` | **MATCH** |
| `HARD-05A` | COMPLEX_HARD | HARD_05_SECURITY_AUTH | `HARD_05_SECURITY_AUTH` | 0 | `true` | `true` | **MATCH** |
| `HARD-05B` | COMPLEX_HARD | HARD_05_SECURITY_AUTH | `HARD_01`, `HARD_05` | 1 | `true` | `true` | **MATCH** |
| `SOFT-01-ISO` | COMPLEX_SOFT | MULTI_FILE_ISOLATED | None | 2 | `false` | `false` | **MATCH** |
| `SOFT-02-LEN` | COMPLEX_SOFT | PROMPT_LENGTH | None | 1 | `false` | `false` | **MATCH** |
| `SOFT-03-ACC` | COMPLEX_SOFT | MULTIPLE_ACCEPTANCE | None | 2 | `false` | `false` | **MATCH** |
| `SOFT-04-CONC` | COMPLEX_SOFT | ASYNC_CONCURRENCY | None | 2 | `false` | `false` | **MATCH** |
| `SOFT-05-ERR` | COMPLEX_SOFT | ERROR_HANDLING_DEPTH | None | 1 | `false` | `false` | **MATCH** |
| `SOFT-06-RET` | COMPLEX_SOFT | PREVIOUS_FAILURE | None | 2 | `false` | `false` | **MATCH** |
| `SOFT-07-LOC` | COMPLEX_SOFT | ESTIMATED_DIFF_LOC | None | 2 | `false` | `false` | **MATCH** |
| `SOFT-COMB-01` | COMPLEX_SOFT | MULTI_FILE_PLUS_CONCURRENCY | None | 4 | `true` | `true` | **MATCH** |
| `SOFT-COMB-02` | COMPLEX_SOFT | MULTI_FILE_PLUS_ACCEPTANCE | None | 4 | `true` | `true` | **MATCH** |
| `SOFT-COMB-03` | COMPLEX_SOFT | RETRY_PLUS_ERROR_PLUS_PROMPT | None | 4 | `true` | `true` | **MATCH** |
| `BOUND-01` | BOUNDARY | SCORE_EXACTLY_2 | None | 2 | `false` | `false` | **MATCH** |
| `BOUND-02` | BOUNDARY | SCORE_EXACTLY_3 | None | 3 | `true` | `true` | **MATCH** |
| `BOUND-03` | BOUNDARY | SCORE_4_PLUS | None | 5 | `true` | `true` | **MATCH** |
| `BOUND-04` | BOUNDARY | HARD_PLUS_SCORE_0 | `HARD_02_PERSISTENCE_SCHEMA` | 0 | `true` | `true` | **MATCH** |
| `BOUND-05` | BOUNDARY | ZERO_SIGNALS | None | 0 | `false` | `false` | **MATCH** |
| `SAFE-01` | ADVERSARIAL | PATH_TRAVERSAL | `HARD_01_LIFECYCLE_CORE` | 0 | `true` | `true` | **MATCH** |
| `SAFE-02` | ADVERSARIAL | ABSOLUTE_PATH | `HARD_01_LIFECYCLE_CORE` | 0 | `true` | `true` | **MATCH** |
| `SAFE-03` | ADVERSARIAL | UNAUTHORIZED_PATH | `HARD_01_LIFECYCLE_CORE` | 0 | `true` | `true` | **MATCH** |
| `SAFE-04` | ADVERSARIAL | PROTECTED_PATH | `HARD_01_LIFECYCLE_CORE` | 0 | `true` | `true` | **MATCH** |
| `SAFE-05` | ADVERSARIAL | INVALID_JSON | `HARD_01`, `HARD_03` | 0 | `true` | `true` | **MATCH** |
| `SAFE-06` | ADVERSARIAL | MALFORMED_PLAN | `HARD_01`, `HARD_03` | 0 | `true` | `true` | **MATCH** |
| `SAFE-07` | ADVERSARIAL | MISSING_TEST_STRATEGY | `HARD_01`, `HARD_04`, `HARD_05` | 0 | `true` | `true` | **MATCH** |
| `SAFE-08` | ADVERSARIAL | REVISION_EXHAUSTION | `HARD_01_LIFECYCLE_CORE` | 0 | `true` | `true` | **MATCH** |
| `SAFE-09` | ADVERSARIAL | PLANNER_PROVIDER_FAILURE | `HARD_01_LIFECYCLE_CORE` | 0 | `true` | `true` | **MATCH** |

---

## 5. Aggregate Classification Performance

Evaluating the standard non-adversarial task set ($N=35$):

| Category | Cases | Expected Planning | Actual Planning | TP | FP | TN | FN | Recall | Precision |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Simple** | 6 | 0 | 0 | 0 | 0 | 6 | 0 | N/A | N/A |
| **Complex Hard** | 14 | 14 | 14 | 14 | 0 | 0 | 0 | 100.0% | 100.0% |
| **Complex Soft** | 10 | 3 | 3 | 3 | 0 | 7 | 0 | 100.0% | 100.0% |
| **Boundary** | 5 | 3 | 3 | 3 | 0 | 2 | 0 | 100.0% | 100.0% |
| **TOTAL** | **35** | **20** | **20** | **20** | **0** | **15** | **0** | **100.0%** | **100.0%** |

---

## 6. V1 vs V1.1 Comparison

| Metric | Phase 7 V1 | Phase 7.9 V1.1 | Delta | Target |
| :--- | :---: | :---: | :---: | :---: |
| **Hard Signal Recall** | 100.0% (12/12) | **100.0%** (14/14) | 0.0 p.p. | 100% |
| **Planning Precision** | 100.0% (18/18) | **100.0%** (20/20) | 0.0 p.p. | $\ge 90\%$ |
| **False Planning Rate** | 0.0% (0/15) | **0.0%** (0/15) | 0.0 p.p. | $< 5\%$ |
| **Missed Planning Rate** | 0.0% (0/18) | **0.0%** (0/20) | 0.0 p.p. | 0% |
| **Simple Latency Overhead** | -3.25% | **+0.70%** | +3.95 p.p. | $\le 5\%$ |
| **Simple Token Overhead** | 0.00% | **0.00%** | 0.0 p.p. | $\le 5\%$ |
| **Planner LLM Calls (FULL)** | 27 | **29** | +2 calls | Consistent (+2 new complex cases) |
| **Safety Failures Blocked** | 9 / 9 | **9 / 9** | 0 | 100% |
| **Fail-Closed Rate** | 100.0% | **100.0%** | 0.0 p.p. | 100% |

---

## 7. Calibration-Specific Boundary Check

Testing path boundaries and aliases on target files:

| Target File Path | Expected Result | Actual Result | Status |
| :--- | :---: | :---: | :---: |
| `src/pdl/delivery/foo.ts` | `HARD_01_LIFECYCLE_CORE` | `HARD_01_LIFECYCLE_CORE` | **PASS** |
| `src/pdl/neural/foo.ts` | `HARD_01_LIFECYCLE_CORE` | `HARD_01_LIFECYCLE_CORE` | **PASS** |
| `src/pdl/delivery-helper.ts` | NOT `HARD_01` | NOT `HARD_01` | **PASS** |
| `src/pdl/neural-helper.ts` | NOT `HARD_01` | NOT `HARD_01` | **PASS** |
| `src/pdl/deliveries/foo.ts` | NOT `HARD_01` | NOT `HARD_01` | **PASS** |
| `src/pdl/neuralization/foo.ts` | NOT `HARD_01` | NOT `HARD_01` | **PASS** |
| `src/api-worker.ts` | NOT `HARD_01` | NOT `HARD_01` | **PASS** |
| `src/router-worker.ts` | `HARD_01_LIFECYCLE_CORE` | `HARD_01_LIFECYCLE_CORE` | **PASS** |
| `c:\repo\src\pdl\delivery\foo.ts` (Windows raw) | `HARD_01_LIFECYCLE_CORE` | `HARD_01_LIFECYCLE_CORE` | **PASS** |
| `c:/repo/src/pdl/neural/foo.ts` (Posix normalized) | `HARD_01_LIFECYCLE_CORE` | `HARD_01_LIFECYCLE_CORE` | **PASS** |

---

## 8. Operational Mode Results

All 44 tasks evaluated across all 4 modes supported by `RouterWorker`:

| Mode | Planned Tasks | Direct Tasks | Completed Tasks | Failed Tasks | Planner LLM Calls | Avg Latency | P95 Latency | Behavioral Verification |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **OFF** | 0 | 44 | 44 | 0 | 0 | 992.8ms | 1096.4ms | Pure legacy behavior: 100% direct execution, zero planner calls. |
| **SHADOW** | 0 | 44 | 44 | 0 | 0 | 977.0ms | 1061.5ms | Classification emitted via lifecycle telemetry; execution remains 100% direct. |
| **CANARY** | 20 | 24 | 35 | 9 | 29 | 942.5ms | 1076.8ms | Selective gating: canary targets plan when required; non-canary products execute directly. |
| **FULL** | 20 | 24 | 35 | 9 | 29 | 948.6ms | 1056.2ms | Full active gating: all complex tasks require validated plan; 9 adversarial tasks fail closed. |

---

## 9. Safety & Fail-Closed Results

All 9 adversarial and failure scenarios executed under `PDL_COMPLEXITY_PLANNING_MODE=FULL`:

| Case ID | Adversarial Invariant Tested | Validator Stage | Triggered Error Code | Execution Blocked? | Fail-Closed Verified |
| :--- | :--- | :---: | :--- | :---: | :---: |
| `SAFE-01` | Path Traversal (`../etc/passwd`) | Stage 2 | `PLAN_VALIDATION_FATAL` | Yes | **YES** |
| `SAFE-02` | Absolute Path (`/var/log/app.log`) | Stage 2 | `PLAN_VALIDATION_FATAL` | Yes | **YES** |
| `SAFE-03` | Unauthorized Path (`forbidden_dir/hack.ts`) | Stage 2 / 3 | `PLAN_VALIDATION_FATAL` | Yes | **YES** |
| `SAFE-04` | Protected File (`.github/workflows/deploy.yml`) | Stage 3 | `PLAN_VALIDATION_FATAL` | Yes | **YES** |
| `SAFE-05` | Malformed Non-JSON String | Stage 1 | `PLAN_VALIDATION_FAILED` | Yes | **YES** |
| `SAFE-06` | Truncated / Empty Plan Structure | Stage 1 | `PLAN_VALIDATION_FAILED` | Yes | **YES** |
| `SAFE-07` | Non-Actionable Test Strategy | Stage 4 | `PLAN_VALIDATION_FAILED` | Yes | **YES** |
| `SAFE-08` | Revision Budget Exhaustion (2 failures) | Stage 1 | `PLAN_VALIDATION_FAILED` | Yes | **YES** |
| `SAFE-09` | Planner Provider HTTP 500 Failure | Worker | `ROUTER_HTTP_ERROR` | Yes | **YES** |

**Adversarial Fail-Closed Rate:** **100.0% (9/9)**. Zero escapes to direct execution.

---

## 10. Determinism & Performance Invariants

- **Determinism:** 100% deterministic evaluation. Repeating the evaluation yields identical decisions with zero score variance. Zero LLM calls or network dependencies in the classifier.
- **Overhead:**
  - Simple task mean latency: 966.0ms (Direct) vs 972.8ms (Full) $\rightarrow$ **+0.70% overhead** ($\le 5\%$ target met).
  - Simple task token consumption: 850 tokens (Direct) vs 850 tokens (Full) $\rightarrow$ **0.00% token overhead**.
- **Engine Invariants:**
  - Exactly 5 Hard Signals.
  - Exactly 7 Soft Signals.
  - Threshold strictly maintained at 3.
  - Weights unchanged.

---

## 11. Findings & Methodological Limitations

- **Findings:** None (0 issues identified). Zero regressions.
- **Methodological Scope:** Evaluated synthetic tasks designed to rigorously map every branch, boundary condition, and failure path of the engine. The runner in scratch operated without modifying any production file.

---

## 12. Final Verdict

### **BENCHMARK PASSED**

All mandatory metrics and invariants met:
1. Hard Recall: **100.0%** (14/14)
2. Planning Precision: **100.0%** (20/20)
3. False Planning Rate: **0.0%** (0/15)
4. Missed Planning Rate: **0.0%** (0/20)
5. Simple Task Overhead: **+0.70%** ($\le 5\%$)
6. Safety Fail-Closed: **100.0%** (9/9)
7. Calibration verified: `src/pdl/delivery/` and `src/pdl/neural/` trigger `HARD_01_LIFECYCLE_CORE`; boundary cases and `src/api-worker.ts` remain excluded.
8. Zero production changes.

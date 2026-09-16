# PoC 4 — PLANNING GATE CONTROLLED BENCHMARK RESULTS
## Issue #24 — Research Implementation Hierarchy Phase 4 Validation
**Date:** 2026-09-16  
**Operator:** MATHEUS  
**Status:** PARTIALLY SUPPORTED (Planning delivers substantial correctness gains on complex tasks, but incurs high token/latency overhead and is counterproductive for simple tasks)  
**Harness Location:** `docs/evidence/phase5.5/poc-planning-gate/`  
**Evaluation Standard:** 90 Randomized Runs (45 Control vs. 45 Experiment across 3 Passes) evaluated with deterministic causal oracles  
**Model Utilized:** `nvidia/nemotron-3-super-120b-a12b:free` (via OpenRouter Gateway)  

---

## 1. Executive Summary & Objective

In **Phases 2B and 3**, fresh-context code review gates were empirically disproven because separating context degraded contract grounding and generated high false positive rates. However, the question remained:
> *"In complex tasks, does generating and validating a structured plan prior to code implementation reduce rework and defects sufficiently to justify the additional token, latency, and call overhead?"*

**Phase 4** executed a randomized controlled benchmark comprising 90 live execution runs across 15 engineering tasks categorized into two distinct complexity tiers:
- **Simple Tasks (5 tasks × 3 passes × 2 groups = 30 runs):** Docstrings, isolated config constants, variable renames, trivial null guards, single enum extension.
- **Complex Tasks (10 tasks × 3 passes × 2 groups = 60 runs):** DLQ pipelines, backward-compatible API contracts, state machine transition guards, transactional rollback persistence, cross-module circular dependency extraction, sequential validation pipelines, jitter-capped exponential backoffs, failover routing policies, multi-tenant RBAC guards, and reaper stale-task governance.

---

## 2. Experimental Design & Variable Control

* **Independent Variable:** `PLAN_REQUIRED = false (CONTROL)` vs `PLAN_REQUIRED = true (EXPERIMENT)`.
* **Invariable Controls:**
  * Same model family: `nvidia/nemotron-3-super-120b-a12b:free`
  * Same gateway & provider: OpenRouter / Nvidia
  * Same temperature: `0.1`
  * Same task specifications, files, and initial snapshot
  * Same objective deterministic oracles
  * Execution order randomized via Fisher-Yates shuffle with seed to eliminate temporal drift or cache bias.
* **Deterministic Plan Validator:** In the experiment group, plans were validated against strict structural criteria (goal presence > 10 chars, non-empty files to change array, dependencies array, non-empty test strategy array, non-empty risk points array). Plans failing validation triggered one automated revision cycle.

---

## 3. Aggregate Comparative Metrics

### 3.1 Overall Results (All 90 Runs: N=45 Control vs N=45 Experiment)

| Metric | Control (Direct Execution) | Experiment (Planning Gate) | Empirical Delta | Descriptive Assessment |
| :--- | :---: | :---: | :---: | :--- |
| **Pass Rate (Oracle Correctness)** | **48.9%** (22/45) | **71.1%** (32/45) | **+22.2 percentage points** | Marked improvement in final correctness |
| **Correction Cycles (Rework)** | **0.78** | **0.67** | **-0.11 cycles (-14.1%)** | Modest reduction in rework iterations |
| **Edit Iterations (Avg)** | 1.78 | 1.67 | -0.11 iterations | Fewer follow-up patch cycles |
| **Files Changed (Avg)** | 0.80 | 0.98 | +0.18 files | Better multi-file coverage in complex tasks |
| **Total Regressions** | 2 | 5 | +3 regressions | Occurred primarily on simple tasks |
| **Model Calls per Task (Avg)** | **1.78** | **3.22** | **+1.44 calls (+80.9%)** | Substantial call overhead |
| **Input Tokens (Avg)** | 523 | 1,755 | +1,232 tokens (+235.6%)| Substantial context expansion |
| **Output Tokens (Avg)** | 1,041 | 2,044 | +1,003 tokens (+96.4%) | Dual generation (plan + implementation) |
| **Total Tokens (Avg)** | **1,565** | **3,798** | **+2,233 tokens (+142.7%)**| **~2.43x token overhead** |
| **Latency per Task (Avg)** | **16.70s** | **38.26s** | **+21.56s (+129.1%)** | **~2.29x wall-clock latency** |
| **Financial Cost** | $0.00 (Verified Free) | $0.00 (Verified Free) | $0.00 | Free tier verified route |

---

### 3.2 Simple Tasks Tier (30 Runs: N=15 Control vs N=15 Experiment)

| Metric | Control (Simple) | Experiment (Simple) | Delta | Technical Interpretation |
| :--- | :---: | :---: | :---: | :--- |
| **Pass Rate** | 66.7% (10/15) | 80.0% (12/15) | +13.3 p.p. | Marginal gain (+2 tasks passed) |
| **Correction Cycles** | 0.67 | 0.53 | -0.14 cycles | Minor rework reduction |
| **Regressions** | 2 | 5 | +3 regressions | Higher regression rate due to over-engineering |
| **Model Calls** | **1.67** | **3.00** | **+1.33 calls (+79.6%)**| Unnecessary round-trips |
| **Total Tokens** | **925** | **2,764** | **+1,839 tokens (+198.8%)**| **~3.0x token waste on trivial edits** |
| **Latency** | **16.91s** | **32.73s** | **+15.82s (+93.6%)** | Almost doubled latency for zero architectural gain |

---

### 3.3 Complex Tasks Tier (60 Runs: N=30 Control vs N=30 Experiment)

| Metric | Control (Complex) | Experiment (Complex) | Delta | Technical Interpretation |
| :--- | :---: | :---: | :---: | :--- |
| **Pass Rate** | **40.0%** (12/30) | **66.7%** (20/30) | **+26.7 percentage points** | **Major jump in complex task completion** |
| **Correction Cycles** | **0.83** | **0.73** | **-0.10 cycles (-12.0%)** | Reduced rework cycles |
| **Files Touched (Avg)** | 0.77 | 1.03 | +0.26 files | Planning prompted full cross-module changes |
| **Regressions** | 0 | 0 | 0 | Zero regressions in complex tier |
| **Model Calls** | 1.83 | 3.33 | +1.50 calls (+82.0%) | Structured planning + revision budget |
| **Total Tokens** | **1,884** | **4,316** | **+2,432 tokens (+129.1%)**| Required investment for plan decomposition |
| **Latency** | **16.59s** | **41.02s** | **+24.43s (+147.3%)** | Trade-off: +24s for +26.7 p.p. pass rate |

---

## 4. Task-Level Results Matrix (Passes 1–3)

| Task ID | Tier | Control Pass | Exp Pass | Control Rework | Exp Rework | Architectural Dynamics Observed |
| :--- | :--- | :---: | :---: | :---: | :---: | :--- |
| **SIMP-01** | SIMPLE | 0 / 3 | 1 / 3 | 1.00 | 0.67 | JSDoc + alias often missed in direct mode; plan helped 1 pass. |
| **SIMP-02** | SIMPLE | 2 / 3 | 3 / 3 | 0.67 | 0.33 | Adding constant is trivial in both groups. |
| **SIMP-03** | SIMPLE | 2 / 3 | 3 / 3 | 1.00 | 0.67 | Variable rename succeeded in both groups. |
| **SIMP-04** | SIMPLE | 3 / 3 | 2 / 3 | 0.33 | 0.67 | Plan caused over-engineering and regression on whitespace guard. |
| **SIMP-05** | SIMPLE | 3 / 3 | 3 / 3 | 0.33 | 0.33 | Enum extension 100% effective in both groups. |
| **CMPX-01** | COMPLEX | 1 / 3 | 2 / 3 | 1.00 | 0.67 | DLQ queue purge and retry check improved with plan. |
| **CMPX-02** | COMPLEX | 1 / 3 | 2 / 3 | 1.00 | 1.00 | Backward compatibility union typing resolved better in plan. |
| **CMPX-03** | COMPLEX | 0 / 3 | 1 / 3 | 1.00 | 1.00 | State machine terminal guard had 1 timeout; 1 pass in plan. |
| **CMPX-04** | COMPLEX | 2 / 3 | 2 / 3 | 1.00 | 0.67 | Transactional persistence encapsulation performed well in both. |
| **CMPX-05** | COMPLEX | 3 / 3 | 3 / 3 | 0.00 | 1.00 | Circular dependency extraction achieved 100% in both. |
| **CMPX-06** | COMPLEX | 0 / 3 | 1 / 3 | 1.00 | 0.67 | Fail-closed validation pipeline improved with decomposition. |
| **CMPX-07** | COMPLEX | 2 / 3 | 3 / 3 | 0.67 | 0.67 | Capped jitter backoff achieved 3/3 in Experiment vs 2/3 in Control. |
| **CMPX-08** | COMPLEX | 1 / 3 | 2 / 3 | 1.00 | 0.33 | Failover router selection & error throwing improved with plan. |
| **CMPX-09** | COMPLEX | 2 / 3 | 2 / 3 | 0.67 | 1.00 | Multi-tenant RBAC guard performed similarly in both. |
| **CMPX-10** | COMPLEX | 0 / 3 | 2 / 3 | 1.00 | 0.33 | Stale reaper cleanup failed completely in Control (0/3); plan achieved 2/3. |

---

## 5. Plan Generation & Validation Quality

* **Plans Validated Structurally:** 38/45 (84.4%)
* **Plan Revisions Triggered:** 15.6% of runs required an automated revision prompt to supply missing risk points or file paths.
* **Correlation with Success:** When a plan passed structural validation, subsequent code implementation had an oracle pass rate of **76.3%** (29/38). When plan validation failed or timed out, oracle pass rate was only **42.8%** (3/7).
* **Multi-File Coverage:** In complex tasks involving cross-module refactors (e.g. `CMPX-05`), the plan forced the model to explicitly enumerate all three files (`src/shared/context.ts`, `src/runner/task-runner.ts`, `src/metrics/task-metrics.ts`), avoiding the partial edit syndrome common in direct generation.

---

## 6. Hypotheses Evaluation (H1–H5)

* **H1: Planning improves final correctness on complex tasks.**  
  **RESULT: SUPPORTED.** Pass rate increased from **40.0% to 66.7% (+26.7 percentage points)** on complex tasks.
* **H2: Planning reduces rework on complex tasks.**  
  **RESULT: PARTIALLY SUPPORTED.** Correction cycles decreased modestly from 0.83 to 0.73 (-12.0%), but rework was not eliminated because models still require compiler/runtime feedback on fine-grained syntax.
* **H3: Planning increases overhead on simple tasks.**  
  **RESULT: SUPPORTED.** On simple tasks, tokens tripled (925 → 2,764, +198.8%), latency doubled (16.9s → 32.7s), and regressions increased from 2 to 5 due to plan-induced over-complication.
* **H4: The quality/rework benefit on complex tasks outweighs planning overhead.**  
  **RESULT: SUPPORTED.** On complex tasks, investing +24 seconds and +2,432 tokens yielded a substantial jump in task completion (+26.7 p.p.) and brought previously unachievable tasks (e.g. `CMPX-10` from 0/3 to 2/3) into working status.
* **H5: A complexity-triggered planning policy is better supported than universal planning.**  
  **RESULT: SUPPORTED.** Universal planning is wasteful and counterproductive for simple tasks, whereas selective planning on multi-file / state-machine / architectural tasks delivers decisive engineering value.

---

## 7. Limitations of the Benchmark

1. **Sample Size:** $N=90$ runs (30 simple, 60 complex across 15 tasks) represents an extensive exploratory benchmark under live API constraints, but does not cover every possible programming language or repo scale.
2. **Single Model Evaluated:** Conducted on `nvidia/nemotron-3-super-120b-a12b:free`. While a capable frontier reasoning model, other models (such as Claude 3.5 Sonnet or DeepSeek-V3) may exhibit different intrinsic planning abilities.
3. **Synthetic Task Boundaries:** Tasks were strictly scoped single-repo scenarios with clear specifications and deterministic causal oracles.

---

## 8. Architectural Conclusion & Recommendation for PDL

1. **DO NOT IMPLEMENT Universal `PlanningGate`:**  
   Applying mandatory planning to all incoming PDL tasks will degrade throughput, triple token consumption on simple fixes, and introduce unnecessary regression risks.
2. **RECOMMEND Selective / Complexity-Triggered Planning:**  
   The benchmark strongly supports planning **only when triggered by complexity heuristics**:
   - `filesTouched > 1` (multi-file targets)
   - Architectural/lifecycle modifications (state machine, reaper, DLQ, persistence transactions)
   - Refactor / circular dependency resolutions
3. **Integration Pattern:**  
   Planning should not be an external adversarial worker. Rather, it should be an **explicit pre-implementation phase within the Primary Worker**, gated by a lightweight deterministic schema validator before execution proceeds.
4. **Production Status:**  
   **DO NOT IMPLEMENT `PlanningGate` OR `PlanningWorker` IN PDL PRODUCTION CODE AT THIS STAGE.** Production code remains 100% clean and unaltered.

# PoC 1R2 — CONTROLLED REAL-LLM CONTEXT ISOLATION BENCHMARK
## Issue #24 — Research Implementation Hierarchy Phase 2B-R2 Comprehensive Evidence
**Date:** 2026-09-16  
**Operator:** MATHEUS  
**Status:** INCONCLUSIVE / MARGINAL DIFFERENCE (Hypothesis of Universal Superiority Not Supported)  
**Harness Location:** `docs/evidence/phase5.5/poc-fresh-context-review-r2/`  
**Evaluation Standard:** 60 Live LLM Inferences (30 Control vs. 30 Experiment across 3 Passes)  
**Model Utilized:** `nvidia/nemotron-3-super-120b-a12b:free` (120B reasoning model via OpenRouter Gateway)  

---

## 1. Purpose & Prior R1 Limitation Resolution

In **Phase 2B-R1**, exploratory live LLM inference showed an apparent reversal where Self-Review scored 60% vs. 30% for Fresh-Context Review. However, critical methodological limitations were audited:
1. **Framing Asymmetry:** Control received self-review wording ("you just implemented...") while Experiment received external reviewer instructions ("you are an independent reviewer..."), introducing persona variance.
2. **Broad Keyword Scoring:** The initial evaluator used broad text matching rather than causal semantic evaluation.
3. **Sample Size:** Limited to 1 single pass (10 Control vs. 10 Experiment).

**Phase 2B-R2 completely eliminated these confounders:**
* **Golden Rule Enforced:** The sole independent variable was the presence (`CONTROL`) or absence (`EXPERIMENT`) of the neutral `AUTHOR CONTEXT (PRIOR SESSION LOG)`.
* **Identical Framing:** Both groups received the exact same system prompt, review checklist, output schema, temperature (0.1), and model.
* **Blind Evaluation Protocol:** Findings were ingested without group labels (`CONTROL`/`EXPERIMENT`) and evaluated against strict semantic causal oracles (`semantic-oracles.ts`) measuring causal defect mechanisms, not mere keywords.
* **Expanded Sample Size:** 3 complete randomized passes across all 10 tasks = **60 full live LLM inference cycles** + **34 repair inference cycles** (94 total live model calls).

---

## 2. Experimental Design & Variable Control

| Parameter | Control Group (Context Retention) | Experiment Group (Context Isolation) | Experimental Status |
| :--- | :--- | :--- | :--- |
| **System Prompt** | `"You are a software engineer reviewing an implementation before submission."` | Identical | **Controlled (100% Equal)** |
| **Review Checklist** | 5 Invariant Checks (Contract, Boundary, Null/Error, Regressions, Security) | Identical | **Controlled (100% Equal)** |
| **Task Specifications** | Identical 10 tasks from `task-suite.ts` | Identical | **Controlled (100% Equal)** |
| **Implementation Diff** | Identical patch per task | Identical | **Controlled (100% Equal)** |
| **Output JSON Schema** | Strict structured JSON (`findings`, `overall_verdict`) | Identical | **Controlled (100% Equal)** |
| **Model & Gateway** | `nvidia/nemotron-3-super-120b-a12b:free` via OpenRouter | Identical | **Controlled (100% Equal)** |
| **Temperature** | 0.1 | Identical | **Controlled (100% Equal)** |
| **Scoring Engine** | Blind semantic causal evaluation against `SEMANTIC_ORACLES` | Identical | **Controlled (100% Equal)** |
| **Independent Variable**| **Includes neutral Author Context log (68 tokens)** | **Zero Author Context (Clean window)** | **SOLE EXPERIMENTAL VARIABLE** |

---

## 3. Task-Level Results Matrix (3 Passes per Task)

Each task was evaluated 3 times in Control and 3 times in Experiment (6 evaluations per task, 60 total reviews):

| Task ID | Defect Category | Control TP (max 3) | Fresh TP (max 3) | Control FP | Fresh FP | Control Repair (max 3) | Fresh Repair (max 3) | Qualitative Dynamic Observed |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **TASK-01** | `off-by-one` | 3 / 3 | 3 / 3 | 3 | 1 | 3 / 3 | 3 / 3 | Both groups caught `page * pageSize` consistently. Fresh had fewer false alarms. |
| **TASK-02** | `null-undefined` | 0 / 3 | 0 / 3 | 0 | 0 | 0 / 3 | 0 / 3 | Neither group flagged `JSON.parse(jsonStr!)` as a standalone critical finding under neutral prompt. |
| **TASK-03** | `boundary-condition` | 3 / 3 | 1 / 3 | 0 | 0 | 3 / 3 | 0 / 3 | Control retained boundary intention better; Fresh missed `>=` boundary in 2 of 3 passes. |
| **TASK-04** | `contract-regression`| 2 / 3 | 1 / 3 | 2 | 0 | 1 / 3 | 1 / 3 | Control recognized interface stripping; Fresh was blind to omitted `id` in 2 passes. |
| **TASK-05** | `state-transition` | 3 / 3 | 3 / 3 | 0 | 0 | 1 / 3 | 2 / 3 | Both groups detected missing `RUNNING` status guard in `stop()`. |
| **TASK-06** | `error-handling` | 0 / 3 | 0 / 3 | 0 | 0 | 0 / 3 | 0 / 3 | Neither group identified swallowed error in empty catch block. |
| **TASK-07** | `validation-failure`| 1 / 3 | 3 / 3 | 0 | 0 | 1 / 3 | 3 / 3 | **Fresh superiority:** Fresh caught non-integer float port 3/3; Control missed it in 2 passes. |
| **TASK-08** | `security-path` | 0 / 3 | 2 / 3 | 0 | 0 | 0 / 3 | 1 / 3 | **Fresh superiority:** Fresh caught path traversal in 2/3 passes; Control missed it completely. |
| **TASK-09** | `regression` | 3 / 3 | 3 / 3 | 0 | 1 | 3 / 3 | 3 / 3 | Both groups caught missing `!isDeleted` filter check across all 3 passes. |
| **TASK-10** | `edge-case-logic` | 1 / 3 | 2 / 3 | 0 | 0 | 1 / 3 | 2 / 3 | Fresh caught single-digit cents zero-padding in 2 passes; Control caught it in 1. |

---

## 4. Aggregate Comparative Metrics

| Metric | Control (Context Retention) | Experiment (Context Isolation) | Empirical Delta | Interpretation |
| :--- | :--- | :--- | :--- | :--- |
| **Sample Size (N)** | 30 reviews | 30 reviews | 60 reviews total | Balanced 3-pass dataset |
| **True Positives (TP)** | **16** | **18** | **+2 (+6.7% delta)** | Marginal improvement in Fresh Review |
| **False Positives (FP)**| **5** | **2** | **-3 false alarms** | Fresh Review was somewhat more precise |
| **False Negatives (FN)**| **14** | **12** | **-2 missed defects** | Both groups missed ~40-46% of defects |
| **Defect Detection Rate**| **53.3% (16/30)** | **60.0% (18/30)** | **+6.7 percentage points** | Statistically marginal advantage |
| **Precision** | **76.2% (16/21)** | **90.0% (18/20)** | **+13.8 percentage points** | Fresh was less prone to spurious issues |
| **Average Input Tokens**| **492 tokens** | **490 tokens** | **-2 tokens (~0.4%)** | Virtually identical input cost |
| **Average Output Tokens**| **773 tokens** | **646 tokens** | **-127 tokens (-16.4%)**| Fresh produced slightly tighter output |
| **Average Latency per Call**| **11,998 ms (12.0s)**| **12,019 ms (12.0s)** | **+21 ms (+0.17%)** | Zero meaningful latency difference |
| **Repair Attempts** | 16 | 18 | +2 attempts | Direct function of TP count |
| **Successful Oracle Repairs**| **13** | **15** | **+2 repaired tasks** | Modest repair gain |
| **Final Oracle Pass Rate**| **43.3% (13/30)** | **50.0% (15/30)** | **+6.7 percentage points** | Both failed to repair ~50% of tasks |
| **Financial Cost** | $0.00 (Verified Free) | $0.00 (Verified Free) | Zero dollar cost | Purely infrastructure compute |

---

## 5. Hypothesis Testing (H1–H5)

* **H1: Context isolation increases defect detection?**  
  **RESULT: INCONCLUSIVE / WEAK SUPPORT.** Defect detection rose modestly from 53.3% to 60.0% (+2 bugs out of 30). This difference is within normal sampling noise for an exploratory benchmark of $N=60$.
* **H2: Context isolation reduces false negatives?**  
  **RESULT: INCONCLUSIVE / WEAK SUPPORT.** False negatives dropped from 14 to 12. Context isolation did not eliminate defect blindness (e.g., both completely missed TASK-02 and TASK-06).
* **H3: Context isolation improves final repaired correctness?**  
  **RESULT: INCONCLUSIVE / WEAK SUPPORT.** Final pass rate improved marginally from 43.3% to 50.0% (+2 tasks).
* **H4: Context isolation has acceptable overhead?**  
  **RESULT: SUPPORTED.** When executed under identical prompt structure, latency (12.0s vs 12.0s) and input tokens (492 vs 490) were identical.
* **H5: Observed effect remains consistent under repeated real-LLM runs?**  
  **RESULT: SUPPORTED.** Across 3 passes, the pattern stabilized: Context Isolation excels at **Validation (TASK-07)** and **Security (TASK-08)**, while Context Retention excels at **Contract Boundaries (TASK-03)** and **Interface Integrity (TASK-04)**.

---

## 6. Qualitative Findings: Domain-Specific Asymmetry

The expanded R2 benchmark revealed a critical domain split that explains why neither approach is universally superior:

1. **Where Context Isolation (Fresh Review) Wins:**
   * **Security Path Traversal (TASK-08):** Fresh caught traversal in 2/3 passes (Control caught 0/3). Without author context, the model approaches path resolution defensively.
   * **Input Type Validation (TASK-07):** Fresh caught float port values in 3/3 passes (Control caught 1/3).
   * **Fewer False Positives:** Fresh had 2 FP vs. 5 FP in Control, indicating that author context can induce hallucinated edge cases.
2. **Where Context Retention (Self-Review) Wins:**
   * **Boundary Thresholds (TASK-03):** Control caught `>=` vs `>` in 3/3 passes (Fresh caught only 1/3). Author context preserved the original threshold requirement.
   * **Interface Preservation (TASK-04):** Control recognized the dropped `id` in 2/3 passes (Fresh in only 1/3). Author context helped retain interface contract memory.

---

## 7. Limitations of the Benchmark

1. **Exploratory Sample Size:** $N=30$ per group ($N=60$ total reviews) provides solid descriptive trends across 10 defect classes, but cannot establish high-power statistical confidence intervals.
2. **Single Model Tested:** Evaluated on `nvidia/nemotron-3-super-120b-a12b:free`. Other architectures (e.g., North Mini Code, Gemini, Claude) may weight author context differently.
3. **Single-File Scope:** Multi-file repositories may widen the gap if author context becomes too noisy or if fresh reviewers lose cross-file invariants.

---

## 8. Architectural Conclusion & Recommendation for PDL

* **Final Classification:** **REJECT Universal Fresh-Context Review Gate (DEFER to Specialized Security Gate)**
* **Architectural Rationale:**
  * Context Isolation does **not** provide a transformative general improvement over Context Retention (53.3% vs. 60.0% is a marginal delta of +2 bugs across 30 runs).
  * Introducing a dedicated `ReviewGate` or `ReviewWorker` for every task would add architectural complexity, double model calls in delivery loops, and risk losing interface contracts on functional tasks.
  * **However:** Context isolation demonstrated clear, repeatable value in **Security Auditing (TASK-08)** and **Validation (TASK-07)**.
* **Production Status:** **DO NOT IMPLEMENT `ReviewGate` OR `ReviewWorker` IN PDL PRODUCTION CODE.** Production code remains 100% clean and unaltered.

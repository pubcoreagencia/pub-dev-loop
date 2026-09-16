# PoC 1R — REAL LLM FRESH-CONTEXT REVIEW EXPERIMENT RESULTS
## Issue #24 — Research Implementation Hierarchy Phase 2B-R Validation
**Date:** 2026-09-16  
**Operator:** MATHEUS  
**Status:** NOT VALIDATED (Hypothesis Weakened / Disproven under Real Inference)  
**Harness Location:** `docs/evidence/phase5.5/poc-fresh-context-review-real/`  
**Evaluation Target:** Real LLM API Inference vs. Prior Deterministic Simulation  
**Model Utilized:** `nvidia/nemotron-3-super-120b-a12b:free` (routed via OpenRouter Free Tier)  

---

> [!IMPORTANT]
> **METHODOLOGICAL CLARIFICATION:**
> The previous Phase 2B experiment (`docs/evidence/phase5.5/poc-fresh-context-review/`, commit `1379ae7`) is strictly preserved as **Phase 2B-S (Simulation / Protocol Validation)**. It demonstrated how a dual-persona harness would behave under idealized assumptions.
> This document reports the empirical measurements of **Phase 2B-R (Real LLM Validation)** using live API calls to an active frontier-class open-weights reasoning model.

---

## 1. Executive Summary

Phase 2B-R submitted the identical 10-task benchmark suite to real LLM inference to test the central architectural hypothesis:
*"An independent reviewer operating with a clean context window detects code defects that the generating agent fails to detect during same-context self-review."*

**The empirical findings from live model inference CONTRADICT the simulation hypothesis:**
1. **Control Group (Same-Context Self-Review):** Achieved a **60.0% defect detection rate** (6/10 true positives) and an overall oracle repair pass rate of **60.0%**.
2. **Experiment Group (Fresh-Context Review):** Achieved only a **30.0% defect detection rate** (3/10 true positives) and an overall oracle repair pass rate of **20.0%**.
3. **Latency & Cost Overhead:** Fresh-Context Review required an extra round-trip inference call with higher completion latency (avg 20.76s vs 18.18s), increasing end-to-end task time without delivering superior defect detection.

---

## 2. Real-LLM Experimental Design & Protocol

### 2.1 Environmental Isolation
The experiment ran entirely in `docs/evidence/phase5.5/poc-fresh-context-review-real/`:
* Zero alterations to `src/pdl/`, workers, scheduler, governance, or PostgreSQL schema.
* No production dependencies introduced; HTTPS calls used native Node.js client resolving keys through the secure local environment bridge (`resolveOpenRouterApiKey()`). Zero secrets logged or committed.

### 2.2 Live Inference Setup
* **Model:** `nvidia/nemotron-3-super-120b-a12b:free` (120B reasoning model).
* **Provider:** Nvidia via OpenRouter Gateway (0/0 pricing verified).
* **Randomization:** Order of tasks and execution precedence (Control vs. Experiment) was randomized per run to prevent sequence or cache bias.
* **Fairness:** Both groups evaluated the exact same code patches, specifications, and defect injections across the 10 benchmark tasks.

---

## 3. Raw Run Data (Task by Task Breakdown)

| Task ID | Defect Category | Control (Self-Review) | Experiment (Fresh-Review) | Analysis of Divergence |
| :--- | :--- | :--- | :--- | :--- |
| **TASK-01** | `off-by-one` | **TP (Detected)** | FN (Missed) | Self-review noticed indexing discrepancy; fresh reviewer hallucinated stylistic concerns. |
| **TASK-02** | `null-undefined` | **TP (Detected)** | **TP (Detected)** | Both models recognized unsafe `JSON.parse` with non-null assertion `!`. |
| **TASK-03** | `boundary-condition`| FN (Missed) | FN (Missed) | Neither model caught the `>=` vs `>` off-by-one boundary flaw. |
| **TASK-04** | `contract-regression`| **TP (Detected)** | FN (Missed) | Author context retained knowledge of the omitted `id` field; fresh reviewer ignored it. |
| **TASK-05** | `state-transition` | **TP (Detected)** | FN (Missed) | Author context identified missing precondition check; fresh reviewer marked pass. |
| **TASK-06** | `error-handling` | FN (Missed) | FN (Missed) | Neither model flagged swallowing errors in retry loop catch block. |
| **TASK-07** | `validation-failure`| **TP (Detected)** | FN (Missed) | Self-review checked float port inputs; fresh reviewer accepted range bounds. |
| **TASK-08** | `security-path` | FN (Missed) | **TP (Detected)** | Fresh reviewer successfully detected directory traversal (`path.resolve` containment). |
| **TASK-09** | `regression` | **TP (Detected)** | **TP (Detected)** | Both models flagged the missing `!isDeleted` filter invariant. |
| **TASK-10** | `edge-case-logic` | FN (Missed) | FN (Missed) | Neither model noticed single-digit cents lack of zero-padding (`$0.5`). |

---

## 4. Aggregate Comparative Metrics

| Dimension | Control (Self-Review) | Experiment (Fresh-Review) | Empirical Delta |
| :--- | :--- | :--- | :--- |
| **Total Evaluation Runs** | 10 runs | 10 runs | 20 real inference cycles |
| **True Positives (TP)** | **6** | **3** | **-3 defects caught (-50% relative)** |
| **False Negatives (FN)** | **4** | **7** | **+75% higher miss rate in Fresh Review** |
| **Defect Detection Rate** | **60.0%** | **30.0%** | **-30.0 percentage points** |
| **False Positive Rate** | 0.0% | 0.0% | Both groups avoided false bug reports |
| **Average Input Tokens** | 358 tokens | 368 tokens | Equivalent prompt footprint (~2.8% diff) |
| **Average Output Tokens** | 840 tokens | 941 tokens | Fresh reviewer produced longer rationale |
| **Average Latency per Call** | 18,178 ms (18.18s) | 20,761 ms (20.76s) | +2.58s (+14.2%) longer response time |
| **Oracle Pass Post-Repair** | **60.0% (6/10)** | **20.0% (2/10)** | **-40.0 percentage points** |
| **Effective Financial Cost**| $0.00 (Verified Free) | $0.00 (Verified Free) | Zero dollar cost; high latency cost |

---

## 5. Deep Qualitative Analysis: Why Real LLMs Differed from Simulation

The simulation (Phase 2B-S) presumed that LLMs suffer from unrecoverable self-confirmation bias. In reality, testing against a real reasoning model revealed two counter-intuitive phenomena:

1. **Context Loss in Fresh Review:**
   When given only the diff and specification without the author's full context, the fresh reviewer frequently lacked sufficient semantic grounding to recognize subtle contract regressions (e.g., in TASK-04, where `id` was stripped from the return interface, the fresh reviewer focused on the lowercase username logic and failed to notice the omitted property).
2. **Effective Self-Critique in Modern Reasoning Models:**
   Frontier reasoning models (`nemotron-3-super-120b`) exhibit substantial internal reflection capabilities. When prompted explicitly with *"Perform a thorough self-review of your implementation against the requirements"*, the author context allowed the model to review its own diff against its initial understanding, successfully detecting 60% of defects.
3. **The Single Win for Fresh Review (Security):**
   In TASK-08 (`path-traversal`), the author context assumed `path.resolve` was sufficient. The fresh reviewer—approaching the code from a defensive security posture—spotted that `path.resolve` permits directory traversal escapes. This demonstrates that specialized fresh review has value for **security auditing**, but hurts general functional validation.

---

## 6. Hypothesis-by-Hypothesis Results

* **H1: Fresh-context increases defect detection?**  
  **RESULT: REJECTED.** Real defect detection fell from 60.0% to 30.0%.
* **H2: Fresh-context reduces false negatives?**  
  **RESULT: REJECTED.** False negatives increased from 4 to 7.
* **H3: Fresh-context improves final oracle pass after correction?**  
  **RESULT: REJECTED.** Oracle pass rate fell from 60.0% to 20.0%.
* **H4: Fresh-context possesses acceptable cost/latency for PDL?**  
  **RESULT: INCONCLUSIVE / WEAK.** While dollar cost is zero on free models, doubling the inference calls adds ~20–40 seconds per task attempt without quality gains.
* **H5: Fresh-context maintains benefit when used by real models vs. simulator?**  
  **RESULT: EMPIRICALLY DISPROVEN.** The simulated benefit was an artifact of synthetic bias modeling, not real LLM inference behavior.

---

## 7. Limitations of the Experiment

1. **Sample Scope:** 10 tasks evaluated under 20 live API calls. While sufficient to disprove the claim of universal superiority, a massive multi-hundred task evaluation could show nuanced variance across other model families.
2. **Model Family:** Tested on `nvidia/nemotron-3-super-120b-a12b:free`. Other models (e.g., Cohere North Mini Code) may exhibit different balance between self-review and fresh review.
3. **Prompt Variations:** Review prompt phrasing can influence vigilance. However, neutral, standard prompts were used identically across both groups.

---

## 8. Architectural Conclusion & Recommendation for PDL

* **Final Classification:** **NOT VALIDATED (Reject Generic Fresh-Context Review Gate)**
* **Core Takeaway:** Mandating a generic `ReviewGate` or `ReviewWorker` for every task would degrade delivery velocity, double latency, and lower defect detection rates compared to having the primary worker perform focused self-review within its existing context.
* **Specialized Exception:** An isolated fresh-context check remains promising specifically for **Security Auditing** (e.g., checking path traversal and secrets), but must **NOT** replace the primary worker's self-validation for functional code.
* **Production Status:** **DO NOT IMPLEMENT `ReviewGate` OR `ReviewWorker` IN PDL PRODUCTION CODE.** Production code remains 100% clean and unaltered.

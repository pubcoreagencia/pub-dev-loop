# PoC 3 — SPECIALIZED SECURITY REVIEW BENCHMARK RESULTS
## Issue #24 — Research Implementation Hierarchy Phase 3 Validation
**Date:** 2026-09-16  
**Operator:** MATHEUS  
**Status:** NOT SUPPORTED (The tested hypothesis that a fresh-context specialized security reviewer would outperform contextual self-review was not supported in this benchmark)  
**Harness Location:** `docs/evidence/phase5.5/poc-specialized-security-review/`  
**Evaluation Standard:** 60 Live LLM Security Inferences (30 Control vs. 30 Experiment across 3 Passes) + 29 Repair Inferences  
**Model Utilized:** `nvidia/nemotron-3-super-120b-a12b:free` (via OpenRouter Gateway)  

---

## 1. Executive Summary & Objective

In **Phase 2B-R2**, a generic `ReviewGate` for all engineering tasks was rejected due to marginal performance differences (+6.7 p.p.) and loss of interface contracts. However, an exploratory signal emerged in security tasks (path traversal), raising the refined hypothesis:
> *"Context isolation brings distinct, measurable advantage when the objective is specialized security auditing (detecting vulnerabilities that the author may have normalized during implementation)."*

To test this hypothesis under strict scientific controls, **Phase 3** constructed a suite of 10 security-specific synthetic tasks covering OWASP, injection, and sandbox escapes.

**Under the tested model, task suite, and protocol, contextual self-review outperformed the fresh security reviewer:**
1. **Control Group (Self-Review with Author Context):**
   * Achieved a **56.7% vulnerability detection rate** (17/30 true positives) and **85.0% precision** (3 false positives).
   * Achieved a **26.7% successful repair rate** (8/30 passes).
2. **Experiment Group (Independent Fresh Security Review):**
   * Achieved a **43.3% vulnerability detection rate** (13/30 true positives) and **68.4% precision** (6 false positives).
   * Achieved a **16.7% successful repair rate** (5/30 passes).
3. **Overhead & Precision Differences:**
   * Context isolation did **not** improve vulnerability detection overall under the tested benchmark conditions. Instead, the fresh reviewer generated twice as many false positive alarms (6 FP vs. 3 FP), suffered from context starvation in authorization/file-serving tasks, and trailed the self-reviewing worker by **-13.4 percentage points** in detection.

---

## 2. Experimental Design & Variable Control

The experiment maintained the Golden Rule: the **only** independent variable was the presence (`CONTROL`) or absence (`EXPERIMENT`) of neutral author operational context.

* **Identical Security Checklist (8 Invariant Rules):**
  1. Input validation & strict type constraints
  2. Path/file boundaries & traversal containment
  3. Command/shell execution safety
  4. Authorization & multi-tenant isolation
  5. Secrets & environment handling (process.env leaks)
  6. Injection resistance (SQL, shell, eval, template)
  7. Least privilege in execution sandboxes
  8. Sandbox escape prevention
* **Identical Output Schema:** Strict structured JSON (`findings`, `overall_verdict`).
* **Blind Evaluation:** Submissions were evaluated by a blind causal engine against `SECURITY_SEMANTIC_ORACLES` with group identifiers stripped.

---

## 3. Task-Level Results Matrix (3 Passes per Task)

| Task ID | Vulnerability Class | Control TP (max 3) | Fresh TP (max 3) | Control FP | Fresh FP | Control Repair | Fresh Repair | Qualitative Vulnerability Dynamics |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **SEC-01** | `path-traversal` | 1 / 3 | 1 / 3 | 0 | 0 | 1 / 3 | 0 / 3 | Both groups caught traversal in 1 pass; missed in 2 passes. |
| **SEC-02** | `shell-injection` | 3 / 3 | 2 / 3 | 0 | 1 | 1 / 3 | 1 / 3 | Both caught `exec(\`git checkout \${branch}\`)` reliably. |
| **SEC-03** | `command-execution`| 1 / 3 | 2 / 3 | 0 | 1 | 0 / 3 | 0 / 3 | Fresh reviewer was more vigilant on `execSync('ping ' + host)`. |
| **SEC-04** | `secret-exposure` | 2 / 3 | 1 / 3 | 0 | 1 | 2 / 3 | 1 / 3 | Logging `process.env` caught in 2 passes by Control, 1 by Fresh. |
| **SEC-05** | `authorization-boundary`| 1 / 3 | 1 / 3 | 1 | 0 | 1 / 3 | 0 / 3 | Missing tenant `orgId` check caught in 1 pass by both. |
| **SEC-06** | `unsafe-file-access`| 2 / 3 | 1 / 3 | 0 | 1 | 0 / 3 | 0 / 3 | Control recognized missing extension whitelist better than Fresh. |
| **SEC-07** | `input-validation` | 1 / 3 | 0 / 3 | 0 | 0 | 0 / 3 | 0 / 3 | `parseInt` non-numeric trailing bypass missed by Fresh 3/3 times. |
| **SEC-08** | `unsafe-deserialization`| 3 / 3 | 2 / 3 | 2 | 0 | 2 / 3 | 1 / 3 | `eval('(' + input + ')')` caught 3/3 by Control, 2/3 by Fresh. |
| **SEC-09** | `sandbox-escape` | 0 / 3 | 1 / 3 | 0 | 2 | 0 / 3 | 0 / 3 | `vm.runInThisContext` escape caught once by Fresh, missed by Control. |
| **SEC-10** | `env-leakage` | 3 / 3 | 2 / 3 | 0 | 0 | 1 / 3 | 2 / 3 | Public endpoint returning `process.env` caught consistently. |

---

## 4. Aggregate Comparative Metrics

| Metric | Control (Self-Review with Context) | Experiment (Fresh Security Review) | Empirical Delta | Technical Interpretation |
| :--- | :--- | :--- | :--- | :--- |
| **Sample Size (N)** | 30 reviews | 30 reviews | 60 reviews | 3 randomized passes across 10 tasks (exploratory benchmark) |
| **True Positives (TP)** | **17** | **13** | **-4 vulnerabilities caught** | Self-review detected more vulnerabilities in this sample |
| **False Positives (FP)**| **3** | **6** | **+3 false alarms in Fresh** | Fresh reviewer produced double the false alarms |
| **False Negatives (FN)**| **13** | **17** | **+4 missed vulnerabilities** | Fresh reviewer suffered from higher misses |
| **Vulnerability Detection Rate**| **56.7% (17/30)** | **43.3% (13/30)** | **-13.4 percentage points** | Descriptive difference observed in this exploratory benchmark |
| **Review Precision** | **85.0% (17/20)** | **68.4% (13/19)** | **-16.6 percentage points** | Fresh reviewer was noisier under tested conditions |
| **Input Tokens (Average)** | 540 tokens | 504 tokens | -36 tokens (-6.7%) | Negligible prompt size difference |
| **Output Tokens (Average)**| 855 tokens | 867 tokens | +12 tokens (+1.4%) | Equivalent rationale verbosity |
| **Latency per Call (Avg)** | **15.95s** | **15.30s** | -0.65s (-4.1%) | Identical execution latency |
| **Repair Attempts Dispatched**| 16 | 13 | -3 repair cycles | Direct function of TP count |
| **Repairs Passed Oracle** | **8 (26.7%)** | **5 (16.7%)** | **-3 repaired tasks** | Self-review led to more repaired tasks in this sample |
| **Effective Financial Cost**| $0.00 (Verified Free) | $0.00 (Verified Free) | Zero dollar cost | Purely infrastructure compute |

---

## 5. Hypothesis Testing (H1–H4)

* **H1: Security Fresh Review improves vulnerability detection?**  
  **RESULT: NOT SUPPORTED.** Vulnerability detection was lower in the Fresh group (43.3% vs. 56.7%, -13.4 p.p.).
* **H2: Security Fresh Review reduces missed vulnerabilities?**  
  **RESULT: NOT SUPPORTED.** Missed vulnerabilities were higher in the Fresh group (17 vs. 13).
* **H3: Security Fresh Review improves secure final state after correction?**  
  **RESULT: NOT SUPPORTED.** Final secure state passing the oracle was lower in the Fresh group (16.7% vs. 26.7%).
* **H4: The benefit justifies additional review latency/calls?**  
  **RESULT: NOT SUPPORTED.** No measurable benefit was observed sufficient to justify the additional review stage under the tested conditions.

---

## 6. Qualitative Findings: Observed Dynamics in the Benchmark

Why did the independent reviewer perform lower on security vulnerabilities in this benchmark?

1. **Loss of Threat Model Grounding:**
   When an agent reviews code in isolation without the author's session context, it lacks the context of why certain implementation choices were made. It produced false alarms on safe constructs (e.g., complaining about error propagation in `SEC-09` while missing the actual `vm.runInThisContext` escape).
2. **Dilution Across Broad Checklists:**
   Without operational context, the fresh reviewer tended to spread its attention evenly across the 8 checklist items, missing specific vulnerabilities (e.g., missing `eval` in SEC-08 during Pass 1, or missing path traversal in SEC-01 during Passes 1 and 2).
3. **Targeted Self-Inspection in Modern Models:**
   When the author agent—already familiar with the imports, data flow, and intent—is prompted with an explicit security checklist, it performed focused self-inspection. It caught leaks (`process.env` in SEC-04 and SEC-10, `eval` in SEC-08, and `exec` in SEC-02) with 85% precision.

---

## 7. Limitations of the Benchmark

1. **Sample Size:** $N=30$ reviews per group (10 synthetic tasks, 3 passes, $N=60$ total reviews) represents an exploratory benchmark; no broad population statistical generalization is claimed.
2. **Single Model Tested:** Evaluated exclusively on `nvidia/nemotron-3-super-120b-a12b:free`. Other model families (e.g., Claude 3.5 Sonnet, GPT-4o) might exhibit different dynamics.
3. **Synthetic Vulnerabilities:** Clear, single-file vulnerability injections were tested. Complex multi-file repository taint flows may exhibit different behavior.

---

## 8. Architectural Conclusion & Recommendation for PDL

* **Final Classification:** **REJECT Dedicated `SecurityReviewGate` / `SecurityReviewWorker`**
* **Core Takeaway:**
  * Mandating an independent, fresh-context security review worker in the PDL lifecycle is **not justified** by the empirical evidence gathered. It increased false positives and did not improve true vulnerability detection under tested conditions.
  * An independent fresh reviewer did not demonstrate architectural superiority for security in PDL.
  * **Pattern that Performed Better under the Tested Benchmark Conditions:** Equipping the primary worker with the **Security Review Checklist directly in its own self-review sub-step**, backed deterministically by fail-closed governance (`PersistenceGate`, sandbox process isolation, and static AST analysis).
  * **Summary Judgment:** The tested hypothesis that a fresh-context specialized security reviewer would outperform contextual self-review was not supported in this benchmark; self-review outperformed the fresh security reviewer under the tested model, task suite, and protocol.
* **Production Status:** **DO NOT IMPLEMENT `SecurityReviewGate` OR `SecurityReviewWorker` IN PDL PRODUCTION CODE.** Production code remains 100% clean and unaltered.

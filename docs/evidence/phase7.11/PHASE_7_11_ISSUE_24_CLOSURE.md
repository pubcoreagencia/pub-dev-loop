# Phase 7.11 — Issue #24 Formal Closure & Institutionalization

> Target: PUB DEV LOOP (PDL) Engineering Engine  
> Target Architecture: Complexity-Triggered Planning V1.1 (`src/pdl/planning/`, `src/router-worker.ts`)  
> Human Operator: **MATHEUS**  
> Canonical Institutional Persistence: **Git / GitHub**  
> Issue: **#24 — Complexity-Triggered Planning**  
> Final Status: **CLOSED — IMPLEMENTATION VALIDATED WITH KNOWN LIMITATIONS**  
> Branch: `feat/remote-delivery-gate-phase1`  
> Date: 2026-09-16  

---

## 1. Executive Summary

This document formally concludes and institutionalizes **PDL Issue #24: Complexity-Triggered Planning**.

### 1.1 The Original Problem
In early architecture phases (Phase 4 and PoC 4), universal pre-execution planning introduced heavy penalties on simple, localized tasks:
- Over-engineering of trivial changes (+3 regressions);
- Extreme token inflation (+198.8% token expenditure);
- Doubled latency (+93.6% latency overhead);
- Fragility from unnecessary validation loops on straightforward single-file edits.

Conversely, executing complex architectural tasks directly resulted in a 60% failure rate due to scope drift, uncoordinated multi-file edits, circular dependencies, and breaking contract mutations.

### 1.2 The Implemented Solution
The engine implemented **Candidate A: Complexity-Triggered Planning**:
- A **deterministic-first, rule-based classifier** (`TaskComplexityClassifier`) that categorizes tasks as either `SIMPLE` (direct execution) or `COMPLEX` (mandatory planning);
- **Task-level classification** evaluated ahead of the attempt loop;
- **Attempt-level planning and validation** (`TaskPlanner`, `PlanValidator`), ensuring that planning occurs within the bounded execution loop and that validated plans are cached and reused across provider retries without re-planning;
- **Strict 4-stage plan validation**: Stage 1 Structural, Stage 2 Scope Containment, Stage 3 Product Governance, and Stage 4 Test Strategy;
- **Unconditional Fail-Closed Protection**: Any planning failure, validation rejection, or scope violation halts execution immediately, purges workspaces, and never degrades into blind direct execution.

### 1.3 The Calibrated Version (V1.1)
Following real-task validation (Phase 7.5) and root-cause analysis (Phase 7.6), the classifier was calibrated to **V1.1** (commit `73caf77`), synchronizing `HARD_01_LIFECYCLE_CORE` with newly established formal architectural subsystems: `src/pdl/delivery/` and `src/pdl/neural/`.

### 1.4 Final Operational Status
Issue #24 is formally closed as:
**`COMPLEXITY-TRIGGERED PLANNING V1.1 — OPERATIONALLY VALIDATED WITH KNOWN LIMITATIONS`**

---

## 2. Final Architecture

The operational flow of Complexity-Triggered Planning V1.1 is strictly defined:

```text
Task Intake + Sealed ExecutionSpec
                  ↓
TaskComplexityClassifier.evaluate(task, spec)
                  ↓
        [ planningRequired? ]
          /              \
        NO                YES
        ↓                  ↓
  DIRECT PATH        PLANNING PATH
  (Simple tasks)     (Complex tasks)
        ↓                  ↓
  Provider Run       TaskPlanner.generatePlan()
  (Direct edits)           ↓
        ↓            PlanValidator.validatePlan()
  Verification             ↓
        ↓            [ Valid Plan? ]
     Complete            /         \
                       YES          NO (Fatal / Budget Exhausted)
                       ↓            ↓
                 Enriched Spec   FAIL-CLOSED STOP
                       ↓         (status: FAILED, workspace purged)
                 Provider Run
                       ↓
                 Verification
```

### Architectural Invariants:
1. **Deterministic-First:** The classifier runs in $\approx 1.5$ ms without LLM calls, embeddings, or external dependencies.
2. **Attempt-Level Gating:** Planning is executed inside the attempt lifecycle, scoped to the product manifest resolved from `ProductCatalog`.
3. **Provider Fallback Plan Cache:** In multi-provider retry chains, a validated plan is generated once and reused across fallback attempts (`replanningCalls = 0`).
4. **Scope Containment:** The 4-stage validator strictly confines plan targets to the product's `allowedPaths`, blocking path traversal, absolute paths, and unauthorized files.
5. **Fail-Closed:** Malicious, unparseable, or scope-violating plans terminate immediately with `PLAN_VALIDATION_FATAL` or `PLAN_VALIDATION_FAILED`.

---

## 3. Final Classifier Contract

The frozen production contract (`src/pdl/planning/classifier.ts`) defines exactly 5 Hard Signals, 7 Soft Signals, and a Soft Threshold of 3.

### 3.1 Five Hard Signals (Unconditional Planning)

1. **`HARD_01_LIFECYCLE_CORE`:** Target paths or explicit instructions touch core autonomous engine subsystems (`src/pdl/{scheduler, reaper, dlq, retry, governance, persistence, delivery, neural}/` or `src/router-worker.ts`).
2. **`HARD_02_PERSISTENCE_SCHEMA`:** Target paths touch database migrations (`db/migrations/`) or SQL schema definitions (`*.sql`).
3. **`HARD_03_BREAKING_CONTRACT`:** Target paths touch public interface contracts (`*types.ts`, `*contract*.ts`) with modification or breaking change intent.
4. **`HARD_04_CIRCULAR_DEP_REFACTOR`:** Task instructions explicitly declare structural refactoring, module extraction, or circular dependency resolution.
5. **`HARD_05_SECURITY_AUTH`:** Target paths touch security, authorization policies, or repository boundary enforcement (`src/pdl/security/`, `repo-authorization.ts`, `src/pdl/governance/`).

### 3.2 Seven Soft Signals (Cumulative Scoring)

1. **`SOFT_01_MULTI_FILE`** (Weight: 2): Target files count $> 1$.
2. **`SOFT_02_PROMPT_LENGTH`** (Weight: 1): Task prompt + objective length $> 1,200$ characters.
3. **`SOFT_03_MULTIPLE_ACCEPTANCE`** (Weight: 2): Acceptance criteria items $\ge 4$.
4. **`SOFT_04_ASYNC_CONCURRENCY`** (Weight: 2): Instructions match concurrency terms (`mutex`, `concurrency`, `race condition`, `atomic`, `deadlock`, `lease`).
5. **`SOFT_05_ERROR_HANDLING_DEPTH`** (Weight: 1): Instructions match resilience terms (`retry`, `backoff`, `circuit breaker`, `timeout`, `fallback`).
6. **`SOFT_06_PREVIOUS_FAILURE`** (Weight: 2): Task retry count $> 0$.
7. **`SOFT_07_ESTIMATED_DIFF_LOC`** (Weight: 2): Spec indicates $> 50$ LOC modified or added.

### 3.3 Decision Threshold
$$\text{Planning Required} \iff (\text{Hard Signals} > 0) \lor (\text{Soft Score} \ge 3)$$

---

## 4. `HARD_01_LIFECYCLE_CORE` Final Scope

The authorized scope for `HARD_01` recognizes formal architectural subsystems:

```text
src/pdl/
  scheduler/        — Task leasing state machine & polling loops
  reaper/           — Stale lease recovery & cleanup
  dlq/              — Dead letter quarantine service
  retry/            — Bounded retry & backoff policy
  governance/       — Autonomous claim evaluation & permissions
  persistence/      — Git commit & push verification gates
  delivery/         — PR lifecycle, merge executor, main verifier (Added V1.1)
  neural/           — Knowledge retrieval & experience writeback gates (Added V1.1)

src/router-worker.ts — Autonomous multi-provider orchestration worker loop
```

### Excluded Paths & Anti-Frankenstein Rule:
- **`src/api-worker.ts` is NOT included:** Identified in Phase 7.6 as a legacy tombstone.
- **Zero individual file aliases:** The engine recognizes formal directories, never ad-hoc individual files.

---

## 5. Institutional Evidence Chain

The progression of Issue #24 across all phases is fully recorded in canonical Git commits:

| Phase | Evidence Document | Canonical Commit | Verified Outcome |
| :--- | :--- | :---: | :--- |
| **Phase 5** | Decision Synthesis & Epistemic Fix | `7a8406b` / `05d415d` | Candidate A (Triggered Planning) Approved |
| **Phase 6** | Implementation Specification & Audit | `559dc8b` / `a3e5745` | Architecture Specified & Formally Audited |
| **Phase 7** | Complexity Planning V1 Implementation | `9d8ec94` | V1 Engine Code Merged |
| **Phase 7 Benchmark** | 42-Task Synthetic Benchmark | `a8fe846` | Benchmark Passed (100% Hard Recall, 0% Overhead) |
| **Phase 7.5** | Real-Task Classifier Validation | `9e6a772` | Canary Validated with Limitations (Simulated Runtime) |
| **Phase 7.6** | Missed-Planning Root Cause Analysis | `9280bfb` | V1.1 Minor Calibration Approved (`delivery` & `neural`) |
| **Phase 7.7** | V1.1 Calibration Implementation | `73caf77` | V1.1 Minor Calibration Implemented |
| **Phase 7.8** | V1.1 Implementation Audit | `bb8dde7` | Implementation Verified (Zero Lateral Diff) |
| **Phase 7.9** | V1.1 Regression Benchmark | `8cfd805` | Benchmark Passed (100% Hard Recall, +0.70% Overhead) |
| **Phase 7.10** | End-to-End Real-Task Revalidation | `29a1d67` | 25/25 Real Workspaces Executed, 100% Fail-Closed |
| **Phase 7.11** | Issue #24 Formal Closure | *(Current)* | Issue #24 Closed — Operationally Validated |

---

## 6. Final Validation Matrix

| Dimension | Verification Method | Result | Notes |
| :--- | :--- | :---: | :--- |
| **Deterministic Classifier** | Zero model/network dependencies | **PASS** | Evaluates in $\sim 1.5$ ms; 100% reproducible |
| **Hard Signal Recall** | Synthetic ($N=14$) & Real ($N=6$) | **PASS** | 100.0% recall on explicit paths |
| **Soft Threshold Behavior** | Boundary evaluation ($S=0, 1, 2, 3, 5$) | **PASS** | Score $2 \rightarrow$ DIRECT; Score $3 \rightarrow$ PLANNING |
| **Planning Precision** | 44 synthetic benchmark tasks | **PASS** | 100.0% precision |
| **False Planning Rate** | Simple & isolated tasks | **PASS** | 0.0% false planning rate |
| **Synthetic Benchmark** | 44 tasks across OFF, SHADOW, CANARY, FULL | **PASS** | All primary targets met |
| **Real Execution** | 25 real engineering tasks | **PASS** | 25/25 real git workspaces executed |
| **Plan Validation** | 4-stage validation pipeline | **PASS** | Blocked 100% of malicious / invalid plans |
| **Scope Containment** | Product catalog allowedPaths enforcement | **PASS** | 100% containment of external paths |
| **Fail-Closed** | Validation failure handling | **PASS** | Zero degradation into blind direct execution |
| **Provider Fallback Plan Cache** | Multi-attempt retry simulation | **PASS** | Plan reused without re-planning |
| **Delivery Recognition** | `src/pdl/delivery/` target tasks | **PASS** | Triggers `HARD_01_LIFECYCLE_CORE` |
| **Neural Recognition** | `src/pdl/neural/` target tasks | **PASS** | Triggers `HARD_01_LIFECYCLE_CORE` |
| **Legacy Isolation** | `src/api-worker.ts` task | **PASS** | Preserved direct execution; no aliases |

---

## 7. Known Limitations

The operational evaluation of V1.1 established clear boundaries:

### Limitation 1: Semantic & Conceptual Complexity Gap
In Phase 7.10, the real-task Missed Planning Rate was **41.7% (5/12)**.
- **Cause:** Human reviewers evaluated tasks as planning-beneficial based on implicit architectural intuition (e.g. cross-daemon state interactions, streaming buffer parsers, subtle lifecycle timing).
- **Reality:** Because the V1.1 classifier is strictly deterministic and surface-signal-based, tasks that lack explicit core directory prefixes, breaking contract keywords, or high LOC declarations evaluate to `score < 3` and execute directly.
- **Distinction:**
  $$\text{Human Conceptual Complexity} \ne \text{Deterministic Observable Complexity}$$
  This gap is an intentional design boundary of V1.1 to prevent false planning explosions.

### Limitation 2: Human Agreement Variance (76.2%)
Human agreement on decided real tasks was 76.2% (16/21). Agreement was 100% on simple tasks. Disagreements occurred entirely on moderate/complex tasks with low surface signals. Human disagreement does not represent an engine bug.

### Limitation 3: Laboratory Repository Manifest Scope
In Phase 7.10, 5 complex tasks failed closed with `PLAN_VALIDATION_FATAL` because the plans touched `tests/` or `db/migrations/`, which are restricted under `pub-dev-loop-template`'s catalog manifest (`allowedPaths: [*.md, devloop-*, docs/**, src/**]`). This proved fail-closed enforcement but prevented full execution of those specific historical tasks in that repository.

### Limitation 4: Mock Agent Provider under Rule 1
In strict adherence to **Rule 1 (Free Models Only)**, code generation inside the execution seam utilized mock provider completions. While the classifier, planner, validator, workspace provisioning, and git operations ran authentic production code, full end-to-end code generation using external paid LLMs was not conducted.

---

## 8. What V1.1 Proves and Does NOT Prove

### What V1.1 Proves:
1. Tasks with complexity explicitly declared via established Hard Signals or multi-signal Soft criteria are consistently and deterministically planned;
2. Simple tasks bypass planning with zero token overhead and negligible latency overhead ($+0.70\%$);
3. Generated plans are strictly validated against product governance boundaries;
4. Validation failures never escape to blind direct execution (100% fail-closed);
5. Provider fallback chains reuse validated plans without token waste;
6. `delivery` and `neural` subsystems are cleanly incorporated into core lifecycle gating.

### What V1.1 Does NOT Prove:
1. It does **NOT** prove that every conceptually complex task will trigger planning;
2. It does **NOT** prove that an LLM-based classifier would perform better without regression;
3. It does **NOT** guarantee optimal plan generation from all arbitrary LLMs;
4. It does **NOT** prove that the 41.7% missed planning tasks would have failed direct execution.

---

## 9. Anti-Frankenstein Statement

The 41.7% missed planning rate observed in real-task validation **MUST NOT** be used to justify:
- Ad-hoc regex for specific historical task prompts;
- Cataloging individual file names (e.g. `api-worker.ts`, `router.ts`);
- Arbitrary threshold reductions below 3;
- Arbitrary weight inflation;
- Creating a 6th or 7th Hard Signal without architectural justification;
- Unbenchmarked LLM classifiers or probabilistic scoring.

Any future enhancement of semantic complexity detection must follow the formal PDL research and decision lifecycle as an independent issue.

---

## 10. Deferred Research

The following initiatives are deferred to future architectural roadmaps:
1. **Semantic / Intent Complexity Classification:** Researching formal AST analysis or calibrated local embeddings to detect structural complexity that lacks surface keywords.
2. **Learned / LLM-Assisted Classification:** Investigating whether a fast, verified free model can assist classification without compromising determinism or latency.
3. **Neural Complexity Routing:** Exploring whether the PUB Neural knowledge bridge can supply historical risk signals to the intake spec.
4. **Adaptive Product Manifest Scopes:** Enabling configurable multi-tier allowed paths for repositories with distinct testing/migration policies.

---

## 11. Final Decision & Status

### **ISSUE #24 STATUS: CLOSED — IMPLEMENTATION VALIDATED**

> **Declaration:**  
> Complexity-Triggered Planning V1.1 is formally validated and operational. It establishes a deterministic, fail-closed pre-execution planning gate that concentrates planning on high-risk architectural tasks while eliminating planning overhead on simple tasks. Semantic complexity detection remains deferred research.

# RESEARCH REPORT: ENGINEERING HARNESS BENCHMARK
## Issue #24 — Research Implementation Hierarchy Phase 1 Closeout
**Date:** 2026-09-16  
**Operator:** MATHEUS  
**Status:** PHASE 1 — RESEARCH CLOSED (PoC DESIGN READY)  
**Evidence Rule:** Claims reflect empirical findings and documented specifications. No speculative benefits are assumed as proven.

---

## 1. Executive Summary

This study conducted a deep technical investigation into three external candidate approaches to engineering harnesses:
1. **ECC (`affaan-m/ECC`)** — Orchestration conventions and sub-agent prompting built primarily for Claude Code.
2. **Tencent TeamAI CLI (`Tencent/teamai-cli`)** — A Git-based synchronization utility for team AI configurations and IDE rules.
3. **Portable Skills (`agentskills.io` / `SKILL.md`)** — An emerging open specification for modular, progressive-disclosure capability packaging.

The PDL current production baseline was preserved with zero modifications. No code changes, dependency additions, or architectural refactors were performed.

Key technical conclusions:
* **ECC Full Integration:** Candidate for **REJECT** (pending no contradictory evidence). ECC is predominantly a prompt-based library with tight coupling to client-side Claude Code behaviors rather than a deterministic enterprise execution engine.
* **TeamAI Full Integration:** Candidate for **REJECT** (pending no contradictory evidence). TeamAI functions primarily as a dotfile/config distributor for local IDEs, providing no execution primitives missing from PDL's Git-first backend architecture.
* **Fresh-Context Review:** Classified as **NEEDS PoC**. Evaluated as a potential pattern to reduce self-confirmation blind spots, but unproven in terms of defect rate improvement versus token/latency cost.
* **Portable Skills (`SKILL.md`):** Classified as **NEEDS PoC**. The standard provides an appealing low-footprint format for modular capabilities, but ingestion determinism and security boundaries require empirical measurement.
* **Planning Gate:** Classified as **NEEDS PoC**. Structuring execution specs before code mutations is a sound concept, but strict gate enforcement vs. latency overhead must be measured on real tasks.

---

## 2. Candidate Investigations

### 2.1 ECC (`affaan-m/ECC`)
* **Core Nature:** A modular repository of Markdown instructions, `.claude/agents/` definitions, and Pre/PostToolUse hooks.
* **Planning:** Employs a `planner` agent persona that creates task decomposition checklists. Enforcement is predominantly conversational and relies on LLM instruction following rather than kernel/runtime-level hard gates.
* **Test-First / TDD:** Commands like `/tdd` instruct the model through RED -> GREEN sequences. While structured, compliance is voluntary unless paired with custom tool-abort hooks.
* **Fresh-Context Review:** Uses a distinct `code-reviewer` agent launched in a clean subagent context with minimal history (receiving diff and criteria). This reduces context bleed from the implementation phase.
* **Hooks & Enforcement:** Implemented via client configuration hooks on tool events. Can reject actions, but is client-bound.
* **Institutional Memory:** Uses local session files and Markdown notes; lacks ACID transactional guarantees or distributed reconciliation.
* **PDL Comparison:** PDL's Postgres-backed task state machine, deterministic governance gates (`evaluateBudgetGate`, `evaluateModelGate`, `PersistenceGate`), and remote delivery validation provide significantly stronger operational guarantees than ECC's prompt layers.

### 2.2 Tencent TeamAI CLI (`Tencent/teamai-cli`)
* **Core Nature:** A command-line utility for Git-based synchronization of rules, skills, and MCP configurations across multi-developer environments.
* **Workflow:** Synchronizes central Git repositories into local IDE paths (`.cursorrules`, `.claude/config.json`) during `SessionStart`.
* **Learning Loop:** Facilitates friction-based learning by encouraging manual PR submissions with newly discovered rules/patterns.
* **PDL Comparison:** PDL already uses Git as its canonical institutional persistence layer and manages task execution centrally in worker sandboxes. Distributing desktop configuration files to human workstations does not resolve any backend execution bottleneck in PDL.

### 2.3 Portable Skills (`agentskills.io` / `SKILL.md`)
* **Core Nature:** An emerging open specification for structuring capability packages using YAML frontmatter (`name`, `description`) combined with Markdown workflows and optional `scripts/` or `references/`.
* **Progressive Disclosure:** Provides a three-tier lifecycle:
  1. Discovery: Loads only `name` and `description` (~20-50 tokens).
  2. Activation: Ingests full `SKILL.md` instructions when matched.
  3. Execution: Invokes bundled scripts or secondary assets on demand.
* **PDL Comparison:** PDL currently hardcodes tool logic in TypeScript within `src/tools/` or worker routines. Adopting a declarative capability format could decouple knowledge evolution from engine redeployments, provided security sandboxing is strictly preserved.

---

## 3. Analysis of Hypothesized Gaps

| Gap | Current PDL Capability | External Counterpart | Actual Gap Status | Evidence Quality | Risk & Cost |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **GAP A: Planning Gate** | `TaskIntakeService` creates `ExecutionSpec`; workers may edit immediately. | ECC `planner` decomposes tasks before code modifications. | **Hypothesis (Needs PoC)** | High (ECC prompt spec examined; PDL code audited). | Risk of unnecessary latency and token overhead on trivial or single-line fixes. |
| **GAP B: Test-First Enforcement** | `PersistenceGate` enforces final test passage (`PERSISTENCE_01`). | ECC `/tdd` prompts RED -> GREEN workflow. | **Weak / Unconfirmed** | Medium (ECC does not structurally block GREEN without verified RED). | High friction on pure refactors or documentation tasks; final gate already prevents broken builds. |
| **GAP C: Fresh-Context Review** | Single worker generates changes, runs verification, and evaluates readiness. | ECC `code-reviewer` operates in an isolated context window. | **Hypothesis (Needs PoC)** | High (Empirical literature indicates self-review bias in LLMs). | Additional LLM invocation latency; potential conflicting reviews. |
| **GAP D: Portable Skills** | Static TypeScript tools and worker actions. | `agentskills.io` directory format with YAML frontmatter. | **Hypothesis (Needs PoC)** | High (Open standard specification verified). | Execution of untrusted scripts if sandbox boundary fails. |
| **GAP E: Scoped Rules** | Global governance in `AGENTS.md` and compiled TypeScript policies. | TeamAI / Cursor per-directory rule trees (`.cursorrules`). | **Weak / Unconfirmed (Candidate for Deferral)** | High (TeamAI repo examined). | Fragmented rules undermine centralized auditability in automated delivery. |

---

## 4. Decision Matrix (Pre-Implementation Status)

| Capability / Primitive | Classification | Architectural Justification |
| :--- | :--- | :--- |
| **Fresh-Context Review** | **NEEDS PoC** | Must be measured in an isolated environment to determine if defect detection increases significantly enough to warrant the cost of a secondary model call. |
| **Portable Skills (`SKILL.md`)** | **NEEDS PoC** | Ingestion performance, metadata validation, and sandboxing must be verified without touching production engine code. |
| **Planning Gate** | **NEEDS PoC** | Complexity-aware gating (simple -> execute; complex -> plan -> review) must be evaluated for latency and quality impact. |
| **TeamAI CLI Integration** | **REJECT** (Candidate) | Provides dotfile synchronization for human IDEs; does not address PDL backend execution primitives. |
| **ECC Full Harness Integration** | **REJECT** (Candidate) | Large prompt/hook library tightly bound to Claude Code CLI; incompatible with PDL's deterministic architecture. |
| **Dynamic Scoped Rules** | **DEFER** | Centralized, audited governance is preferable for automated engine consistency. |

---

## 5. Design of Isolated PoCs (Scratch / Benchmark Area)

The following two proof-of-concept experiments are designed to run in complete isolation from the PDL engine (`tests/scratch/` or benchmark workspace). No production files will be modified.

### 5.1 PoC 1: Fresh-Context Review vs. Same-Context Self-Review

#### Objective
Empirically measure whether an independent reviewer with a clean context window detects a higher proportion of seeded defects in code diffs compared to self-review by the generating agent.

#### Control Group (Same-Context Self-Review)
1. Agent receives Task Specification and Context.
2. Agent produces Code Implementation.
3. Agent is asked in the same context: "Review your implementation against the requirements and report any bugs, edge cases, or regressions."
4. Agent produces self-review feedback and final code.

#### Experiment Group (Fresh-Context Review)
1. Agent A (Generator) receives Task Specification and Context.
2. Agent A produces Code Implementation.
3. Git diff and original Task Specification are extracted.
4. Agent B (Reviewer, fresh process/context, zero prior conversation history) receives only:
   - Original Task Specification.
   - Patch / Git Diff.
   - Standard Review Checklist (correctness, regressions, edge cases).
5. Agent B produces structured Review Feedback.
6. Agent A receives Review Feedback and produces corrected code.

#### Synthetic Benchmark Tasks (Seeded Defects)
* **Task A1 (Logic Bug):** Off-by-one error in pagination slice boundaries.
* **Task A2 (Regression):** Accidental modification of an exported interface contract.
* **Task A3 (Edge Case):** Unhandled null/undefined input under specific payload combinations.
* **Task A4 (Security):** Missing input sanitization on a dynamic path argument.

#### Metrics to Record
* Known defects seeded vs. detected by Generator.
* Known defects detected by Fresh Reviewer.
* False positives (flagging non-defects as errors).
* False negatives (missed defects).
* Total tokens consumed (Control vs. Experiment).
* Latency and execution calls.

---

### 5.2 PoC 2: Portable Skills (`SKILL.md`) Parser & Progressive Disclosure

#### Objective
Evaluate the operational footprint, parsing determinism, and safety boundaries of the `agentskills.io` specification in isolation.

#### Test Execution Flow
```text
Raw Skill Directory
  ├── SKILL.md (YAML Frontmatter + Markdown)
  ├── scripts/ (Mock tools)
  └── references/ (Supporting docs)
         │
         ▼
[Phase 1: Discovery]
Read frontmatter only (`name`, `description`)
Record: Token footprint, discovery latency
         │
         ▼
[Phase 2: Activation]
Task matches description -> Ingest full body
Validate required/optional fields, types, constraints
         │
         ▼
[Phase 3: Sandbox Safety Check]
Verify `allowed-tools` restrictions
Verify unknown/malformed frontmatter handling
```

#### Test Fixtures to Evaluate
1. **Valid Skill:** Correct YAML frontmatter with progressive instructions.
2. **Malformed Frontmatter:** Invalid YAML syntax, missing mandatory `description`.
3. **Invalid Identifiers:** Names with uppercase letters, spaces, or invalid symbols.
4. **Tool Escalation Attempt:** Skill attempting to invoke tools outside its declared `allowed-tools`.
5. **Oversized Skill:** Large reference documentation to test progressive disclosure boundary.

#### Metrics to Record
* Discovery token count vs. Full activation token count.
* Parse time (milliseconds).
* Rejection rate of malformed/invalid skill packages.

---

## 6. What MUST NOT Be Changed Yet

1. **No Worker Alterations:** `BaseWorker`, `RouterWorker`, and `SandboxWorker` remain unchanged.
2. **No Governance Gate Modifications:** `evaluateBudgetGate`, `evaluateModelGate`, and `evaluatePersistenceGate` remain strictly intact.
3. **No Database Migrations:** No changes to PostgreSQL schemas or `tasks` tables.
4. **No Framework Installations:** Neither ECC nor TeamAI CLI packages will be added to `package.json`.
5. **No Production Filesystem Alterations:** All PoC artifacts and runner scripts must reside strictly in temporary benchmark directories.

---

## 7. Recommended Next Benchmark Sequence

1. **Step 1.1:** Commit this research closeout and PoC design artifact to Git.
2. **Step 1.2:** Implement isolated, self-contained test runner scripts for **PoC 1** (Fresh-Context Review) and **PoC 2** (Portable Skills) in a separate benchmark directory.
3. **Step 1.3:** Run the synthetic benchmark tasks against verified free models (0/0 pricing compliant).
4. **Step 1.4:** Capture raw execution traces and compile the empirical results table.
5. **Step 1.5:** Submit findings to MATHEUS for architectural decision before any production work begins.

# PDL Autonomous E2E Roadmap

**Status:** CANONICAL / ACTIVE
**Owner:** MATHEUS
**Date:** 2026-09-13
**Objective:** Reach the first useful, functional, end-to-end autonomous PDL cycle as fast as possible without sacrificing governance, persistence, verification or recoverability.

## 1. Strategic Objective

The primary objective is not to make AG more capable.

The primary objective is to make **PDL capable of developing the PUB autonomously on a daily basis**.

Target:

```text
MATHEUS DIRECTION
    ↓
PDL DISCOVERS / PRIORITIZES WORK
    ↓
KNOWLEDGE RETRIEVAL
    ↓
PLANNING
    ↓
SPECIALIST / CAPABILITY ROUTING
    ↓
EXECUTION
    ↓
TEST / QA
    ↓
AUTO-CORRECTION
    ↓
PERSISTENCE
    ↓
RUNTIME VERIFICATION
    ↓
NEURAL LEARNING
    ↓
NEXT TASK
    ↺
```

The first production-grade target is **one complete governed loop**, not maximum feature count.

## 2. Current Position — 2026-09-13

### PDL

Already established:

- durable task/worker architecture;
- isolated execution model;
- LLM gateway/fallback infrastructure;
- governance concepts;
- finalization and validation pipeline;
- PDL retry/DLQ/scheduler test coverage;
- repository identity invariant;
- remote persistence infrastructure;
- mandatory Git persistence protocol;
- forensic investigation and hard-stop of the legacy autonomous writer;
- production verification lessons;
- canonical persistence gate primitive and failure-mode tests.

Current critical gap:

> **The persistence gate exists, but the terminal worker completion path still needs to be wired so that material work cannot become COMPLETED while remote persistence is missing or unverifiable.**

The current worker still contains a direct worker-level push path. That path must become governed persistence rather than an independent completion side effect.

### PUB Neural

Already established:

- canonical Master Context;
- cognitive-brain role;
- institutional knowledge model;
- provenance requirements;
- project isolation;
- knowledge promotion states;
- RAG / graph / document memory target architecture;
- PDL relationship;
- extraction strategy;
- repository harvesting roadmap;
- historical knowledge consolidation;
- extraction index for reconstructing PDL from Git.

Current critical gap:

> **Neural still needs a reliable, repeatable harvesting/ingestion path that can consume PDL/project changes from Git, preserve provenance, extract reusable knowledge and make it retrievable by PDL.**

## 3. Immediate Goal: Minimum Viable Autonomous Loop

Do not attempt to finish every Neural capability or every PDL subsystem first.

Build the smallest end-to-end loop that can safely:

```text
1. RECEIVE a defined objective
2. CREATE / SELECT a task
3. RETRIEVE relevant context
4. INSPECT the target repository
5. PLAN a bounded change
6. EXECUTE the change
7. RUN tests / validation
8. AUTO-CORRECT bounded failures
9. COMMIT
10. PUSH
11. VERIFY remote SHA
12. VERIFY runtime when applicable
13. MARK task completed only after the persistence gate
14. EMIT a structured event / learning payload
15. INGEST that result into Neural
16. SELECT or schedule the next useful task
```

If these steps work reliably for one controlled project, the architecture has become operational end to end.

## 4. Short Term — Make One Loop Actually Work

### S1 — Governed terminal completion

**Priority: P0**

Wire the persistence gate into the worker's terminal completion transition.

Acceptance criteria:

- material task cannot reach `COMPLETED` without validated persistence;
- no independent worker-level push path bypasses the gate;
- local SHA and verified remote SHA must match;
- dirty worktree fails closed;
- production-affecting work requires runtime verification;
- push failure becomes explicit incomplete/blocked state;
- tests cover all failure modes.

### S2 — Define the PDL task contract

**Priority: P0**

Standardize the minimum task envelope:

```yaml
objective:
project:
repository:
scope:
priority:
constraints:
acceptance_criteria:
validation:
runtime_impact:
knowledge_queries:
required_capabilities:
persistence_policy:
```

The task must be sufficient for PDL to act without relying on chat context.

### S3 — Project reconnaissance contract

**Priority: P0**

Before development, PDL must automatically:

1. identify repository;
2. inspect local project instructions;
3. inspect current branch/ref;
4. inspect relevant source/docs/tests;
5. query Neural for related knowledge;
6. compare Neural knowledge with current repository evidence;
7. detect contradictions;
8. produce a bounded execution context.

### S4 — First controlled E2E pilot

**Priority: P0**

Choose one non-critical PUB project and run a fully governed PDL cycle.

The pilot should be intentionally small and measurable.

Success is not code volume. Success is a complete cycle with evidence.

### S5 — Neural ingestion MVP

**Priority: P0**

Implement the minimum ingestion path:

```text
PDL completion event
→ source commit / diff
→ extractor
→ normalized knowledge candidates
→ provenance
→ validation state
→ Neural persistence
```

At first, prioritize:

- decisions;
- architecture changes;
- fixes;
- lessons;
- reusable patterns;
- governance changes;
- important test evidence.

## 5. Medium Term — Make the Loop Useful Every Day

### M1 — Autonomous backlog generation

PDL should be able to inspect project state and generate candidate work from:

- explicit Matheus direction;
- TODOs and known gaps;
- failing tests;
- stale dependencies;
- incomplete roadmap items;
- incidents;
- product priorities;
- Neural lessons;
- repository health;
- runtime observations.

Every candidate must have provenance and a reason for being proposed.

### M2 — Specialist capability registry

Build a governed registry of specialists/capabilities by function, for example:

```text
Architecture
Backend
Frontend
Database
Security
QA
UX
SEO
Growth
Data
Infrastructure
Research
Documentation
Product
```

PDL routes work to capabilities based on task requirements, not hard-coded manual orchestration.

### M3 — Research / retrieval before execution

Before implementing unfamiliar work:

```text
PROJECT GIT
+
PUB NEURAL
+
DOCUMENTATION / WEB WHEN NEEDED
        ↓
EVIDENCE PACK
        ↓
PLAN
```

Research results must be persisted when they materially change a decision.

### M4 — Correction loop

Bounded automatic recovery:

```text
EXECUTE
 ↓
TEST
 ├── PASS → continue
 └── FAIL
       ↓
    DIAGNOSE
       ↓
    CORRECT
       ↓
    RETEST
       ↓
    bounded retry
```

After the retry budget is exhausted, produce a recoverable blocked state rather than fake completion.

### M5 — Runtime verification framework

Standardize production verification for:

- APIs;
- workers;
- scheduled jobs;
- deployments;
- security controls;
- database migrations;
- frontend applications.

Source state and runtime state must be independently represented.

### M6 — Neural retrieval for PDL

PDL should be able to ask Neural:

- what decisions already exist;
- what similar work was completed;
- what failed before;
- which skills apply;
- what governance applies;
- what patterns are reusable;
- what knowledge is stale or contradictory.

Results must include provenance and confidence.

## 6. Long Term — PDL Autonomous Daily Development

### L1 — Continuous development loop

PDL operates continuously within explicit governance and resource limits:

```text
OBSERVE
→ DISCOVER
→ PRIORITIZE
→ PLAN
→ EXECUTE
→ VALIDATE
→ PERSIST
→ LEARN
→ NEXT
```

### L2 — Self-maintaining knowledge

Neural automatically:

- ingests material PDL outcomes;
- deduplicates knowledge;
- links entities;
- detects contradictions;
- marks superseded knowledge;
- promotes validated lessons;
- maintains provenance;
- prepares minimal context for future tasks.

### L3 — Self-improving capabilities

PDL can identify repeated work and convert validated repetition into:

- skills;
- reusable playbooks;
- specialist capabilities;
- templates;
- tests;
- governance rules.

Self-improvement remains bounded by governance and evidence.

### L4 — Multi-project autonomous development

PDL can safely operate across PUB projects with project-scoped context, permissions, policies and persistence rules.

No project-specific knowledge should leak into another project without explicit scope and provenance.

### L5 — Strategic development loop

The final maturity target is:

```text
MATHEUS
  ↓
STRATEGIC DIRECTION
  ↓
PDL
  ↓
DAILY DEVELOPMENT BACKLOG
  ↓
AUTONOMOUS EXECUTION
  ↓
MEASURABLE RESULTS
  ↓
NEURAL LEARNING
  ↓
BETTER FUTURE PRIORITIZATION
  ↺
```

Matheus becomes primarily the source of direction, priorities, constraints and strategic decisions rather than the operator of individual development tasks.

## 7. Explicitly Out of Scope for the First E2E Milestone

Do not block the first autonomous E2E loop on:

- perfect knowledge graph;
- complete organization-wide harvesting;
- every specialist role;
- every external integration;
- perfect self-improvement;
- broad multi-project autonomy;
- polished human UI;
- complete Obsidian synchronization.

These are later multipliers.

## 8. Priority Order

```text
P0  Persistence Gate → terminal completion
P0  Task contract
P0  Repository + Neural reconnaissance
P0  First controlled E2E pilot
P0  Neural ingestion MVP

P1  Autonomous backlog
P1  Specialist registry
P1  Research/retrieval
P1  Correction loop
P1  Runtime verification
P1  Neural retrieval into planning

P2  Continuous autonomous operation
P2  Knowledge self-maintenance
P2  Skill/capability evolution
P2  Multi-project autonomy
P2  Strategic self-directed development
```

## 9. Definition of First Useful PDL

PDL becomes **USEFUL E2E** when it can complete this sequence without human intervention inside the loop:

```text
TASK
→ CONTEXT
→ PLAN
→ CODE
→ TEST
→ CORRECT (if needed)
→ COMMIT
→ PUSH
→ REMOTE VERIFY
→ RUNTIME VERIFY (if applicable)
→ NEURAL LEARNING
→ COMPLETED
```

A human may still define the initial objective and review the result. That is compatible with the first milestone.

## 10. Definition of Autonomous PDL

PDL becomes **AUTONOMOUS DAILY** when it can additionally:

```text
OBSERVE PROJECTS
→ DISCOVER CANDIDATE WORK
→ PRIORITIZE WITH GOVERNANCE
→ EXECUTE
→ LEARN
→ SELECT NEXT USEFUL WORK
→ CONTINUE
```

without AG as a dependency.

## 11. Progress Metric

Measure autonomy by capabilities, not by number of files or agents.

```text
A0 = manual execution
A1 = governed task execution
A2 = autonomous correction
A3 = autonomous knowledge retrieval
A4 = autonomous task discovery / backlog
A5 = autonomous daily development loop
A6 = validated self-improvement
```

The immediate target is **A1 → A2 → A3 → A4 → A5** as quickly as reliability permits.

## 12. Decision Rule for Every New Feature

Before implementing a feature, ask:

> **Does this bring PDL closer to developing the PUB autonomously tomorrow?**

If yes, prioritize it.

If it only makes current manual agent operation more convenient, classify it as transitional and do not let it displace the E2E autonomy path.

## 13. Execution Discipline

Every meaningful milestone follows the canonical persistence protocol:

```text
VALIDATE
→ EVIDENCE
→ COMMIT
→ PUSH
→ VERIFY REMOTE
→ VERIFY RUNTIME (when applicable)
→ UPDATE CONTEXT / EXTRACTION INDEX
→ CONTINUE
```

Never allow important progress to remain only in chat or a local workspace.

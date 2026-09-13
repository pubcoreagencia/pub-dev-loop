# PDL E2E-01 — First Governed Autonomous Development Cycle

**Status:** ACTIVE / NEXT EXECUTION GATE  
**Owner:** MATHEUS  
**Date:** 2026-09-13  
**Goal:** Put the smallest useful PDL loop into real operation end to end.

## Objective

The first milestone is not maximum autonomy. It is one real, recoverable, governed development cycle that proves the PDL can move from an objective to persistent project change and institutional learning.

## Canonical cycle

```text
OBJECTIVE
→ TASK
→ PROJECT RECONNAISSANCE
→ NEURAL CONTEXT
→ CURRENT GIT TRUTH
→ BOUNDED PLAN
→ SPECIALIST / CAPABILITY ROUTING
→ EXECUTION
→ TEST / VALIDATION
→ BOUNDED CORRECTION
→ COMMIT
→ GOVERNED PUSH
→ REMOTE SHA VERIFICATION
→ RUNTIME VERIFICATION WHEN APPLICABLE
→ NEURAL INGESTION
→ COMPLETED
```

## Non-negotiable gates

### Gate 1 — Task is self-contained

The task must contain enough information for PDL execution without chat history:

- objective;
- project/repository;
- scope;
- constraints;
- acceptance criteria;
- validation command;
- runtime impact;
- relevant knowledge queries;
- required capability;
- persistence policy.

### Gate 2 — Project reconnaissance

Before execution, PDL must establish:

1. canonical repository;
2. current source state;
3. local project instructions;
4. relevant tests/docs;
5. relevant PUB Neural knowledge;
6. contradictions between Neural and current Git/runtime evidence.

Current implementation truth outranks stale historical knowledge.

### Gate 3 — Governed execution

The worker may only modify an authorized project within declared paths and branch policy. Protected branches remain prohibited for autonomous persistence.

### Gate 4 — Validation

A material task cannot become complete without validation evidence.

### Gate 5 — Persistence

Invariant 6 applies:

```text
VALIDATE
→ COMMIT
→ PUSH THROUGH CANONICAL PERSISTENCE
→ VERIFY REMOTE SHA
→ VERIFY RUNTIME WHEN REQUIRED
→ COMPLETED
```

The terminal worker transition must call the persistence gate. No independent push side effect may bypass it.

### Gate 6 — Neural learning

After persistence, emit a structured learning payload containing at minimum:

- repository/project;
- commit SHA;
- changed files;
- objective;
- validation evidence;
- decision/architecture changes;
- fixes;
- reusable lessons/patterns;
- provenance;
- validation state.

Neural ingestion must not replace Git as factual authority.

## Pilot selection

Use a **non-critical, persistence-eligible PUB project** whose development branch policy permits the PDL worker branch. The pilot must be intentionally small and reversible.

The pilot should demonstrate a real code/documentation change, not a synthetic no-op.

## Success criteria

E2E-01 passes only if all are true:

- task was selected by PDL without manual code editing inside the execution loop;
- project context was assembled from current Git plus Neural knowledge;
- execution occurred in an isolated workspace;
- validation ran and passed;
- failures, if any, were corrected within a bounded retry budget;
- commit was created;
- governed remote persistence succeeded;
- verified remote SHA equals the local commit SHA;
- runtime verification was performed when applicable;
- a structured learning event was emitted;
- Neural accepted the result with provenance;
- task reached `COMPLETED` only after all required gates passed;
- all evidence is recoverable from Git.

## Explicit non-goals

Do not block E2E-01 on:

- complete Neural graph;
- organization-wide repository harvesting;
- every specialist;
- autonomous strategic backlog generation;
- complete Obsidian synchronization;
- multi-project continuous autonomy;
- polished UI.

## Immediate implementation order

1. Wire `evaluatePersistenceGate()` into terminal worker completion.
2. Replace direct worker-level `git push` with `PdlRemotePersistence`.
3. Add runtime-verification context to the task contract.
4. Add E2E tests for push failure, remote SHA mismatch, dirty tree, and runtime-verification failure.
5. Implement the smallest Git → Neural ingestion path.
6. Run one controlled real-project pilot.
7. Capture evidence and persist the milestone.

## Definition of done

```text
PDL can complete ONE real task end to end
without human intervention inside the execution loop.

Human provides direction and reviews the outcome.
PDL performs the governed development cycle.
```

This is the first operational proof that the PDL, rather than AG, is becoming the PUB's autonomous development system.

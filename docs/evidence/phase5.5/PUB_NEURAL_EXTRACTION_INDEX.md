# PUB Neural Extraction Index — Phase 5.5

**Status:** CANONICAL / ACTIVE
**Purpose:** Give PUB Neural a deterministic starting point for reconstructing the current PDL state from Git without depending on chat history.

## Extraction Order

Read in this order:

1. `AGENTS.md`
2. `MASTER_CONTEXT.md`
3. `docs/GIT_PERSISTENCE_PROTOCOL.md`
4. `docs/evidence/phase5.5/FORENSIC_AUTONOMOUS_WRITER_AUDIT.md`
5. `docs/evidence/phase5.5/GIT_PERSISTENCE_AND_INCIDENT_CLOSURE.md`
6. recent `main` commit history
7. current source/tests for runtime truth
8. production verification artifacts when the task affects runtime

## Phase 5.5 Canonical Commit Trail

The following commits form the relevant recovery trail. Do not collapse them into a vague summary. Preserve their ordering and inspect their diffs when reconstructing causality.

- `43910c6` — structural dismantling of legacy autonomous multi-repository mutation mechanisms.
- `452ae23` — fail-closed hard-stops for scheduled-repository and safety-backup paths.
- `d0c995d` — operational checkpoint synchronization.
- `77d7499` — canonical architecture reconciliation and legacy autonomy deprecation.
- `c7aeb65` — documentation/checkpoint reconciliation.
- `e0a00bf` — bounded campaign/failure-injection checkpoint.
- `1c2c529` — forensic investigation and resolution of the legacy autonomous writer.
- `e39403f` — mandatory Git persistence protocol.
- `f3c923e` — incident closure and persistence invariant record.

## Current Architectural Truth

`AG executa. PDL governa. Git registra a verdade.`

Legacy path:

`Cron/HTTP → legacy Cloudflare worker → repo selection → synthesis → direct GitHub Contents PUT`

**Status:** dismantled and blocked.

Governed path:

`User → PDL → Governance → Specialist → AG/Executor → Validation → Controlled Persistence → Git`

**Status:** preserved as the target architecture.

## Persistence Invariant

For every meaningful milestone, update, fix, feature, security remediation, architectural change, configuration change, incident resolution, or production correction:

`VALIDATE → EVIDENCE → COMMIT → PUSH → VERIFY REMOTE → VERIFY RUNTIME (when applicable) → HAND OFF`

A local-only meaningful change is incomplete.

A production-affecting fix with unknown active runtime is incomplete.

## Runtime Lesson

A source fix and a production fix are different verification objects. The active deployment must be checked after production-affecting changes.

This distinction is now a permanent PDL governance rule because the legacy-writer incident demonstrated that Git could contain the hard-stop while an older runtime remained active.

## Reconstruction Principle

PUB Neural must prefer evidence in this order:

`CURRENT RUNTIME → CURRENT SOURCE → GIT HISTORY → VERSIONED EVIDENCE → TEST RESULTS → HISTORICAL MEMORY`

Chat history is not required for reconstruction when the repository is complete.

## Handoff Requirement

Any agent continuing PDL must leave its next meaningful state in Git before handoff. If it cannot commit/push, it must explicitly mark the work as incomplete and preserve the blocker as evidence.

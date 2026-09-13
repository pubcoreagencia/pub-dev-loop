# PUB Neural Extraction Index — Phase 5.5

**Status:** CANONICAL / ACTIVE
**Purpose:** Give PUB Neural a deterministic starting point for reconstructing the current PDL state from Git without depending on chat history.

## Extraction Order

Read in this order:

1. `AGENTS.md`
2. `MASTER_CONTEXT.md`
3. `docs/architecture/PUB_SYSTEM_ARCHITECTURE.md`
4. `docs/roadmap/PDL_AUTONOMOUS_E2E_ROADMAP.md`
5. `docs/GIT_PERSISTENCE_PROTOCOL.md`
6. `docs/evidence/phase5.5/FORENSIC_AUTONOMOUS_WRITER_AUDIT.md`
7. `docs/evidence/phase5.5/GIT_PERSISTENCE_AND_INCIDENT_CLOSURE.md`
8. recent `main` commit history
9. current source/tests for runtime truth
10. production verification artifacts when the task affects runtime

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
- `4ef0688` — canonical PUB system architecture, explicitly excluding AG from the final PDL architecture.
- `98c9371` — PDL autonomous end-to-end execution roadmap.

## Current Architectural Truth

Final architecture:

`MATHEUS → PDL → Planning/Governance/Specialists → Execution → QA/Correction → Persistence → Git → Runtime → Neural Learning → Next Task`

**AG is NOT part of this final chain.**

AG is a temporary development instrument used while PDL is incomplete. It is not a PDL subsystem, runtime dependency or final executor.

## System Roles

- **Obsidian:** human thinking, strategy, ideas, hypotheses and planning. Not implementation truth.
- **Git/GitHub:** authoritative factual record of project implementation and history.
- **Runtime:** operational truth for what is actually running.
- **PUB Neural:** institutional memory/intelligence derived from projects, with provenance and knowledge governance.
- **PDL:** autonomous development loop that turns direction and knowledge into validated, persistent work.

## Project Development Retrieval Contract

When PDL develops a project:

`IDENTIFY PROJECT → CONSULT NEURAL → INSPECT CURRENT GIT → INSPECT RUNTIME WHEN RELEVANT → CROSS-CHECK → PLAN → DEVELOP`

Git and Neural are complementary:

> **Git answers what exists. Neural answers what PUB knows about it.**

For implementation conflicts, current runtime/direct evidence and current source outrank historical Neural knowledge.

## Neural Extraction Contract

After meaningful development milestones, Neural should ingest the result from Git and extract durable knowledge rather than blindly copying the repository.

`GIT/RUNTIME → AUDIT → DISCOVERY → CLASSIFICATION → EXTRACTION → NORMALIZATION → PROVENANCE → VALIDATION → FUSION → NEURAL`

Priority knowledge classes:

- architecture;
- decisions;
- governance;
- fixes;
- incidents;
- lessons;
- patterns;
- skills;
- constraints;
- important validation evidence;
- project relationships.

## Persistence Invariant

For every meaningful milestone, update, fix, feature, security remediation, architectural change, configuration change, incident resolution, production correction, or phase gate:

`VALIDATE → EVIDENCE → COMMIT → PUSH → VERIFY REMOTE → VERIFY RUNTIME (when applicable) → NEURAL INGESTION → HAND OFF`

A local-only meaningful change is incomplete.

A production-affecting fix with unknown active runtime is incomplete.

## Current PDL Execution Priority

The immediate objective is **one complete governed end-to-end autonomous cycle**, not maximum feature count.

P0:

1. wire Persistence Gate into terminal worker completion;
2. remove/neutralize any independent worker-level push bypass;
3. standardize task contract;
4. enforce project reconnaissance using Git + Neural;
5. run one controlled E2E pilot;
6. create Neural ingestion MVP.

P1:

- autonomous backlog generation;
- specialist/capability registry;
- research/retrieval before execution;
- bounded correction loop;
- runtime verification framework;
- Neural retrieval during planning.

P2:

- continuous autonomous daily development;
- self-maintaining institutional knowledge;
- validated capability/skill evolution;
- multi-project autonomy;
- strategic self-directed development.

The canonical detailed plan is `docs/roadmap/PDL_AUTONOMOUS_E2E_ROADMAP.md`.

## Runtime Lesson

A source fix and a production fix are different verification objects. The active deployment must be checked after production-affecting changes.

This distinction is permanent because the legacy-writer incident demonstrated that Git could contain the hard-stop while an older runtime remained active.

## Reconstruction Principle

PUB Neural must prefer evidence in this order:

`CURRENT RUNTIME → CURRENT SOURCE → GIT HISTORY → VERSIONED EVIDENCE → TEST RESULTS → HISTORICAL MEMORY`

Chat history is not required for reconstruction when the repository is complete.

## Handoff Requirement

Any agent continuing PDL must leave its next meaningful state in Git before handoff. If it cannot commit/push, it must explicitly mark the work as incomplete and preserve the blocker as evidence.

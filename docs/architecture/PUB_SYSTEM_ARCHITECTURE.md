# PUB System Architecture — Canonical

**Status:** CANONICAL / ACTIVE
**Owner:** MATHEUS
**Date:** 2026-09-13
**Scope:** PUB Core Holding, PUB Neural, PDL, Git, Obsidian

## 1. Final Architecture

The final PUB operating model is:

```text
                         MATHEUS
                    IDEIA / DIREÇÃO
                           │
                           ▼
                          PDL
                AUTONOMOUS DEVELOPMENT LOOP
                           │
             ┌─────────────┼─────────────┐
             ▼             ▼             ▼
        PLANEJAMENTO   ESPECIALISTAS  GOVERNANÇA
             │             │             │
             └─────────────┼─────────────┘
                           ▼
                       EXECUÇÃO
                           │
                           ▼
                    TESTES / QA / FIX
                           │
                           ▼
                   PERSISTENCE GATE
                           │
                           ▼
                          GIT
                           │
                  ┌────────┴────────┐
                  ▼                 ▼
             DEPLOY/RUNTIME    PUB NEURAL
                  │                 │
                  │          MEMÓRIA / CONHECIMENTO
                  │                 │
                  └────────┬────────┘
                           ▼
                       OBSERVAÇÃO
                           │
                           ▼
                       APRENDIZADO
                           │
                           ▼
                    PRÓXIMA TAREFA
                           │
                           └──────────────↺
```

**The loop is the product.**

The objective is for Matheus to provide direction while PDL autonomously plans, develops, validates, persists, learns and continues the PUB's daily development.

## 2. AG Is Not Part of the Final Architecture

AG is a temporary development instrument used while PDL is incomplete.

It is explicitly **not**:

- a PDL subsystem;
- a PDL runtime dependency;
- a final executor in the architecture;
- a source of institutional truth;
- a component that the PDL should depend on for autonomous operation.

Current transitional reality may use external development agents to build PDL capabilities. The final architecture must not contain that dependency.

Architectural test:

> If a capability only improves manual operation of AG and does not increase PDL's ability to develop autonomously, it is transitional work, not the destination.

## 3. Four System Roles

### Obsidian — Human Thinking Layer

Obsidian is the human-facing workspace for:

- ideas;
- strategy;
- hypotheses;
- planning;
- personal reasoning;
- human-readable notes;
- exploratory relationships.

Obsidian is not the source of truth for implementation.

### Git / GitHub — Factual Software Truth

Git is the authoritative persistent record of what was actually implemented in a project.

It contains:

- source code;
- tests;
- migrations;
- configuration;
- documentation;
- commit history;
- versioned evidence;
- implementation provenance.

If a project-local claim conflicts with the current repository, current repository evidence wins for implementation truth.

### PUB Neural — Institutional Intelligence and Memory

PUB Neural is the cognitive layer that extracts, normalizes, relates, validates and retrieves knowledge produced across PUB projects.

Neural must preserve provenance to the source project and distinguish:

- factual implementation;
- validated knowledge;
- project-local knowledge;
- institutional knowledge;
- historical knowledge;
- hypotheses.

Neural is not a replacement for project repositories.

### PDL — Autonomous Development System

PDL is the system that turns Matheus's direction and available knowledge into an autonomous daily development loop.

PDL must eventually be able to:

1. understand strategic direction;
2. discover useful work;
3. retrieve relevant Neural knowledge;
4. inspect the current project repository/runtime;
5. select capabilities/specialists;
6. plan work;
7. execute;
8. test and validate;
9. correct failures;
10. persist safely;
11. verify runtime when applicable;
12. emit learning to Neural;
13. select the next useful task.

## 4. Authority Model

The systems answer different questions:

| System | Primary question | Authority |
|---|---|---|
| Obsidian | What are we thinking / proposing? | Human intent |
| Git | What was actually built? | Implementation truth |
| Runtime | What is actually running? | Operational truth |
| PUB Neural | What has PUB learned and how is it related? | Institutional knowledge |
| PDL | What should happen next and how do we execute it safely? | Autonomous operation within governance |

For implementation conflicts:

```text
CURRENT RUNTIME / DIRECT EVIDENCE
    > CURRENT SOURCE
    > GIT HISTORY
    > VERSIONED EVIDENCE
    > VALIDATED NEURAL KNOWLEDGE
    > HISTORICAL MEMORY
    > HYPOTHESIS
```

Neural must preserve contradictions instead of silently overwriting them.

## 5. Project Development Retrieval Contract

When PDL develops a project:

```text
TASK
 ↓
IDENTIFY PROJECT / REPOSITORY
 ↓
CONSULT PUB NEURAL
 ↓
RETRIEVE RELEVANT KNOWLEDGE / DECISIONS / LESSONS
 ↓
INSPECT CURRENT GIT SOURCE / TESTS
 ↓
INSPECT RUNTIME WHEN RELEVANT
 ↓
CROSS-CHECK EVIDENCE
 ↓
PLAN
 ↓
DEVELOP
```

Git and Neural are complementary, not interchangeable.

**Git answers what exists. Neural answers what PUB knows about it.**

## 6. Neural Extraction Contract

After meaningful development milestones, PUB Neural should ingest the result from Git and extract durable knowledge.

Do not blindly copy repositories into Neural.

Use:

```text
GIT / RUNTIME
   ↓
AUDIT
   ↓
DISCOVERY
   ↓
CLASSIFICATION
   ↓
EXTRACTION
   ↓
NORMALIZATION
   ↓
PROVENANCE
   ↓
VALIDATION
   ↓
FUSION
   ↓
PUB NEURAL
```

Extract reusable intelligence such as:

- architecture;
- decisions;
- governance;
- patterns;
- skills;
- lessons;
- incidents;
- fixes;
- constraints;
- project relationships;
- operational discoveries;
- test-backed behavior.

The goal is institutional memory without turning Neural into a duplicate source tree.

## 7. Persistence and Learning Loop

Every meaningful development milestone follows:

```text
IMPLEMENT
→ VALIDATE
→ CAPTURE EVIDENCE
→ COMMIT
→ PUSH
→ VERIFY REMOTE
→ VERIFY RUNTIME (when applicable)
→ INGEST / EXTRACT TO NEURAL
→ HAND OFF / CONTINUE
```

A meaningful change that exists only in chat, an IDE, a local workspace or an unpushed commit is incomplete.

## 8. Architectural End State

The end state is not "a better AG".

The end state is:

```text
MATHEUS SETS DIRECTION
        ↓
PDL UNDERSTANDS PRIORITY
        ↓
PDL BUILDS DAILY BACKLOG
        ↓
PDL RETRIEVES KNOWLEDGE
        ↓
PDL SELECTS SPECIALISTS / CAPABILITIES
        ↓
PDL DEVELOPS
        ↓
PDL TESTS / CORRECTS
        ↓
PDL PERSISTS TO GIT
        ↓
PDL OBSERVES RUNTIME
        ↓
PUB NEURAL LEARNS
        ↓
PDL CHOOSES NEXT USEFUL WORK
        ↺
```

The success condition is:

> **Matheus can provide direction, leave the system running, and PDL continues developing the PUB safely and measurably without AG.**

## 9. Non-Negotiable Principles

1. PDL is the destination.
2. AG is transitional and external to the final architecture.
3. Git is implementation truth.
4. Runtime evidence is operational truth.
5. Neural is institutional memory and intelligence.
6. Obsidian is the human thinking surface.
7. Neural knowledge requires provenance.
8. Contradictions must be preserved and resolved explicitly.
9. Important work must be persisted before handoff.
10. Every major implementation should increase PDL's autonomous capability.
11. Do not optimize for agent-session convenience at the expense of PDL autonomy.
12. The objective is end-to-end autonomous development, not isolated autonomous features.

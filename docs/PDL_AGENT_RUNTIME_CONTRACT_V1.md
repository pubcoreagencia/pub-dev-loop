# PDL Agent Runtime Contract V1

**Status:** P1.1 contract introduced  
**Scope:** PUB Development Loop runtime boundary  
**Date:** 2026-09-17

## Purpose

PDL already has a functioning autonomous execution path. P1.1 does not create
a second runtime. It makes the existing runtime boundary explicit so future
workers, providers, tools, validators, and PUB Neural integrations can evolve
without collapsing responsibilities into one worker class.

## Canonical lifecycle

    Execution Inbox
          |
          v
    Agent Loop
          |
          v
    Governance
          |
          v
    Execution Engine
          |
          v
    Agent Provider + Workspace Runtime
          |
          v
    Validation / Correction / Review
          |
          v
    Finalization / Persistence
          |
          v
    Evidence
          |
          v
    PUB Neural

## Existing PDL mapping

| Contract concept | Existing implementation |
|---|---|
| Execution Inbox | PostgreSQL task queue + scheduler |
| Agent Loop | PdlContinuousScheduler + PdlCorrectionWorker |
| Governance | PdlGovernanceEngine |
| Execution Engine | DefaultExecutionEngine |
| Provider | AgentProvider / RouterProvider / OpenRouterProvider |
| Workspace runtime | RouterWorker attempt workspace + sandbox/executor |
| Validation | Finalization + validation commands |
| Correction | PdlCorrectionLoop |
| Review | CodeReviewManager |
| Persistence | persistence gate + remote persistence |
| Evidence | task result, trace, finalization and lifecycle events |
| Institutional handoff | PubNeuralBridge |

## Contract invariants

1. Single runtime: P1.1 wraps existing execution paths rather than introduce a parallel runtime.
2. Fail closed: missing execution identity, authorization, workspace, or sealed ExecutionSpec must block execution.
3. Provider neutrality: the runtime contract does not select a model or provider.
4. Workspace authority: physical execution remains owned by the existing workspace/executor boundary.
5. Evidence is first-class: every terminal run must expose structured evidence sufficient to reconstruct what happened.
6. Finalization remains separate: execution success is not equivalent to commit, remote persistence, or institutional completion.
7. Neural is downstream memory: the runtime emits evidence to PUB Neural; Neural does not become an execution dependency.
8. No nanobot clone: external agent-runtime designs are architectural references only. PUB-native contracts remain authoritative.

## Contract

The TypeScript contract lives at:
- src/pdl/runtime/runtime-contract.ts
- src/pdl/runtime/index.ts

The contract deliberately contains only identity, lifecycle, evidence and
terminal-result semantics. Concrete orchestration stays in the existing PDL
workers and execution layers.

## Next implementation step

P1.1-B should add an adapter around the existing PdlCorrectionWorker /
DefaultExecutionEngine path and prove that one real task can be represented by
this contract without changing execution behavior.

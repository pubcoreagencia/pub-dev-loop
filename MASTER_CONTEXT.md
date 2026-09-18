
# PDL — MASTER CONTEXT
## Canonical Architectural Source of Truth
**Repository:** pubcoreagencia/pub-dev-loop  
**Current proof branch:** pdl/p1-2-operational-worker-proof  
**Current audited checkpoint:** cceea37c49fa2bef35bb8a18034854f38860bd2a  
**Last architectural update:** 2026-09-18

---

# 1. IDENTITY

**PUB DEV LOOP (PDL) is the governed engineering runtime of the PUB software house.**

PDL is not a coding agent, not a model, and not a subscription to an agent product.

PDL is the system that controls the engineering lifecycle:

**intake → identity → governance → execution → validation → correction → review → finalization → persistence/delivery → evidence → institutional memory**

The model/provider layer is replaceable.

The permanent architectural center is PDL.

---

# 2. THE MOST IMPORTANT ARCHITECTURAL DISTINCTION

## PDL is the system

Hermes, Antigravity, Codex, Claude Code and other coding agents are external execution tools.

They may be used by humans while developing PDL, but they are not architectural components of PDL.

**Hermes is not PDL.**

A temporary workflow such as:

~~~text
Human → Hermes → OpenRouter / 9router → code
~~~

describes how PDL itself may currently be developed.

It does not describe the target architecture of the software house.

---

# 3. CANONICAL PDL ARCHITECTURE

~~~text
                         PDL
              ┌──────────────────────┐
              │ SOFTWARE HOUSE ENGINE │
              │                      │
              │ intake / scheduling  │
              │ governance            │
              │ execution             │
              │ validation/correction │
              │ review                │
              │ persistence/delivery  │
              │ evidence / Neural     │
              └──────────┬───────────┘
                         │
                         ▼
                    OpenRouter
                         │
                    fallback
                         ▼
                      9router
                         │
                  provider/model pool
~~~

### Canonical gateway rule

**PDL → OpenRouter → 9router fallback → provider/model**

OpenRouter and 9router are the gateway/infrastructure layer used by PDL.

The concrete model or provider is not the identity of PDL.

The PDL runtime must remain provider-neutral.

---

# 4. PDL RESPONSIBILITIES

## 4.1 Intake and durable state

PDL owns the engineering task lifecycle.

Current foundation includes:

- PostgreSQL-backed task queue.
- Durable task state.
- Task claiming and leases.
- Explicit lifecycle states.
- ExecutionSpec persistence.
- ExecutionSpec lineage and sealed execution identity.

A task is not merely a prompt. It is a governed unit of work with identity, repository, execution specification and terminal evidence.

---

## 4.2 Scheduling and worker orchestration

PDL contains the worker/scheduler layer responsible for moving durable tasks through execution.

Current architectural pieces include:

- continuous bounded scheduling;
- correction worker;
- retry/failure handling;
- lease heartbeat;
- reaper/recovery;
- terminal task persistence.

The scheduler is bounded by governance and execution policy.

---

## 4.3 Governance

Governance is a PDL runtime boundary, not an optional UI feature.

Current components include:

- PdlGovernanceEngine;
- PdlExecutionGovernance;
- policy decisions;
- fail-closed authorization;
- capability grants;
- kill-switch/policy controls;
- post-execution governance evidence.

### Production execution capabilities

The production worker path explicitly authorizes:

- WORKSPACE_READ
- WORKSPACE_WRITE
- COMMAND_EXECUTION
- GIT_WRITE
- REMOTE_PERSISTENCE

The worker reuses an authoritative policy decision when available instead of evaluating the same policy redundantly.

Execution authorization happens before actual execution.

Post-execution governance evidence is persisted.

---

# 5. PDL AGENT RUNTIME CONTRACT V1

P1.1 made the existing runtime boundary explicit.

This did **not** create a second execution runtime.

The contract exists to stabilize the boundary between task identity, lifecycle, evidence and the physical execution engine.

## Contract

- PDL_AGENT_RUNTIME_CONTRACT_VERSION = pdl-agent-runtime-v1
- RuntimeContext
- RuntimeEvidence
- RuntimeResult
- AgentRuntime
- ExecutionEngineRuntimeAdapter

## Contract invariants

1. Single runtime. The contract wraps the existing execution path.
2. Fail closed. Missing execution identity or required authorization blocks execution.
3. Provider neutrality. The contract does not select a model/provider.
4. Workspace authority. Physical execution remains owned by the existing execution boundary.
5. Evidence is first-class.
6. Finalization remains separate from provider execution.
7. PUB Neural remains downstream memory, not physical execution.
8. External agent-runtime designs are references only. PDL-native contracts are authoritative.

## Existing mapping

| Contract concept | PDL implementation |
|---|---|
| Execution Inbox | PostgreSQL task queue + scheduler |
| Agent Loop | PdlContinuousScheduler + PdlCorrectionWorker |
| Governance | PdlGovernanceEngine |
| Execution Engine | DefaultExecutionEngine |
| Provider | AgentProvider / RouterProvider / OpenRouterProvider |
| Workspace runtime | RouterWorker attempt workspace + sandbox/executor |
| Validation | finalization + validation commands |
| Correction | PdlCorrectionLoop |
| Review | CodeReviewManager |
| Persistence | persistence gate + remote persistence |
| Evidence | task result, trace, finalization and lifecycle evidence |
| Institutional handoff | PubNeuralBridge |

---

# 6. PROVIDER AND GATEWAY LAYER

The provider layer is below PDL, not above it.

## Primary route

**OpenRouter**

## Fallback route

**9router**

The system records gateway/provider/model information in execution traces.

Provider failure handling is bounded.

Relevant execution controls include:

- per-attempt timeout;
- global timeout;
- retryable status classification;
- HTTP 429 handling;
- HTTP 5xx handling;
- connection/timeout retry;
- fallback chain evidence;
- attempt workspace isolation;
- winner-attempt preservation.

The architecture must never be rewritten around whichever provider happens to be available today.

---

# 7. WORKSPACE AND REPOSITORY AUTHORITY

Physical repository manipulation belongs to the PDL execution boundary.

A provider/model produces execution behavior inside a controlled workspace. It does not become the owner of PDL's governance model.

## Repository identity invariant

~~~text
canonical(TASK.repository) === canonical(GIT_REMOTE.origin)
~~~

Repository identity is checked at enforced gates.

Mismatch is fail-closed.

## Workspace invariant

Each provider attempt receives an isolated workspace.

Baseline state is captured before execution.

Changed files are attributed to the execution attempt.

Failed attempts are cleaned up.

The winning attempt is the one passed downstream to finalization.

---

# 8. EXECUTION IS NOT COMPLETION

A provider returning success is not equivalent to a completed engineering task.

The PDL lifecycle is:

~~~text
Task Intake
   ↓
ExecutionSpec / lineage
   ↓
Governance claim gate
   ↓
Task claim
   ↓
Governance execution gate
   ↓
Execution authorization
   ↓
Isolated workspace
   ↓
Provider execution
   ↓
Validation
   ↓
Correction
   ↓
Review
   ↓
Finalization / local commit
   ↓
Persistence gate
   ↓
Remote persistence / delivery
   ↓
Post-execution governance evidence
   ↓
PUB Neural
   ↓
Terminal task state
~~~

This distinction is fundamental.

---

# 9. VALIDATION, CORRECTION AND REVIEW

PDL treats implementation, validation and acceptance as separate phases.

## Validation

Finalization evaluates the resulting workspace using the configured validation/test path.

## Correction

Failed validation can enter the correction loop rather than being falsely marked complete.

## Review

CodeReviewManager is a separate quality boundary.

Review is not merely a provider response and is not equivalent to validation.

---

# 10. FINALIZATION AND PERSISTENCE

Finalization is responsible for turning a valid workspace state into a durable local engineering result.

Persistence is a separate concern.

Current architecture includes:

- TaskFinalizer;
- FinalizationBridge;
- persistence gate;
- PdlRemotePersistence;
- Git transport;
- RemoteDeliveryGate;
- GitHub client integration;
- remote verification.

A local commit is not enough to claim remote delivery.

Remote state must be evaluated and evidenced.

---

# 11. EVIDENCE

PDL is evidence-driven.

The runtime persists structured information about:

- task identity;
- provider/model;
- gateway;
- attempt sequence;
- fallback chain;
- timing;
- tool calls/rounds;
- changed files;
- validation/finalization result;
- commit;
- persistence;
- delivery;
- governance;
- terminal outcome.

Evidence exists so that a run can be reconstructed without relying on a volatile chat session.

---

# 12. PUB NEURAL

PUB Neural is the institutional-memory layer of the PUB ecosystem.

PDL emits completed-task experience to PUB Neural through an explicit bridge.

The architectural relationship is:

~~~text
PDL execution
     ↓
real evidence
     ↓
PUB Neural
     ↓
institutional memory / retrieval / learning
~~~

PUB Neural is downstream.

It does not replace the PDL execution engine.

It does not become the worker.

It does not own the physical workspace.

---

# 13. PDL AND THE OTHER PUB REPOSITORIES

PDL is an independent system.

Product repositories are execution targets or adjacent systems.

PDL must preserve:

- repository isolation;
- workspace isolation;
- product isolation;
- explicit execution identity;
- governed remote persistence.

PDL is not implemented by importing another PUB product into its runtime.

---

# 14. THE OFFICE

THE OFFICE / frontend is a visualization and human-observability surface around PDL functionality.

It is not the architectural center of PDL.

It must not be used as evidence that the underlying runtime depends on a fixed fictional team of agents.

The backend execution runtime remains authoritative.

If the visual layer shows agents, roles or activity, those representations must correspond to actual runtime state and evidence.

No fake activity is permitted.

---

# 15. GOVERNANCE AND HUMAN AUTHORITY

PDL is governed.

Human authority remains above autonomous execution for actions that the governance policy marks as requiring authorization.

The system must not silently bypass:

- security policy;
- repository identity;
- capability authorization;
- persistence policy;
- delivery gates;
- explicit human approval requirements.

Fail-closed is preferred to ambiguous execution.

---

# 16. ABSOLUTE INVARIANTS

| Invariant | Canonical rule |
|---|---|
| PDL identity | PDL is the software-house engineering runtime. |
| Gateway | OpenRouter is primary; 9router is fallback. |
| Provider neutrality | Models and agent brands are replaceable resources. |
| Hermes separation | Hermes is an external coding agent, not a PDL component. |
| Governance | Execution is authorized before physical execution. |
| Fail-closed | Missing identity, policy or capability blocks execution. |
| Workspace | Every provider attempt runs in an isolated workspace. |
| Repository identity | Task repository must match the workspace Git origin at enforced gates. |
| Validation | Provider success is not validation success. |
| Completion | Validation, review, finalization and persistence are distinct states. |
| Persistence | Local state and remote state are explicitly separated. |
| Evidence | Terminal execution must be reconstructable from persisted evidence. |
| Neural | PUB Neural is downstream institutional memory. |
| Isolation | Product repositories do not become internal PDL modules. |
| No fake activity | UI and metrics represent real runtime evidence only. |

---

# 17. CURRENT IMPLEMENTATION CHECKPOINT

Current branch:

**pdl/p1-2-operational-worker-proof**

Current audited HEAD:

**cceea37c49fa2bef35bb8a18034854f38860bd2a**

Recent architectural milestones:

1. P1.1 introduced the PDL Agent Runtime Contract.
2. P1.1-B adapted the existing ExecutionEngine into that contract.
3. P1.2 introduced the execution governance contract.
4. P1.2 wired governance into the production worker path.
5. P1.2 added the production proof that execution is authorized and post-execution governance evidence is persisted.

The current codebase therefore represents PDL as a governed engineering runtime, not as a Codex-specific worker product.

---

# 18. LEGACY / HISTORICAL DOCUMENTATION RULE

Older documentation may refer to:

- Codex as the primary worker;
- THE OFFICE as a multi-agent organization;
- cloud-first MVP terminology;
- older autonomy phases;
- historical provider choices.

Those descriptions are historical unless they match the current runtime implementation.

The canonical architecture in this document takes precedence over obsolete descriptions.

A legacy adapter remaining in source code does not redefine the architecture.

---

# 19. OPERATING PRINCIPLE

The final operating model is intentionally simple at the top:

~~~text
WORK ARRIVES
     ↓
    PDL
     ↓
OpenRouter
     ↓
9router fallback
     ↓
provider/model
     ↓
controlled execution
     ↓
validate → correct → review
     ↓
finalize → persist → deliver
     ↓
evidence
     ↓
PUB Neural
~~~

The complexity belongs inside PDL.

The user should not need to manually orchestrate coding agents forever.

The strategic objective is for **PDL itself to become the operating system of the PUB software house**.

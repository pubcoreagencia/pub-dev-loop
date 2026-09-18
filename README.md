
# PUB DEV LOOP (PDL)

**PUB DEV LOOP (PDL)** is the governed engineering runtime of the PUB software house.

PDL is **the system**, not an AI coding agent. Its responsibility is to receive engineering work, establish execution identity and policy, execute work in isolated workspaces through a provider/gateway layer, validate and correct the result, review it, persist it remotely, emit evidence, and hand the resulting experience to PUB Neural.

The provider/model layer is intentionally replaceable.

## Canonical architecture

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

**Canonical gateway path: PDL → OpenRouter → 9router fallback → provider/model.**

OpenRouter and 9router are infrastructure used by PDL. The concrete model/provider is an implementation detail of the provider layer and must not redefine the PDL architecture.

### Hermes, Antigravity, Codex and other coding agents

These are **external execution tools**, not components of PDL's architecture.

During PDL development, a human may use any available coding agent to modify the PDL repository. That temporary development workflow must not be confused with the final PDL runtime.

In particular, **Hermes is not PDL** and PDL is not architecturally coupled to Hermes.

The intended operating model is:

~~~text
Human / product intake
        ↓
       PDL
        ↓
OpenRouter → 9router fallback
        ↓
provider / model
        ↓
isolated workspace execution
        ↓
validate → correct → review → finalize
        ↓
remote persistence / delivery
        ↓
evidence → PUB Neural
~~~

## What PDL actually is

PDL is a **governed software-engineering execution platform** with these responsibilities:

1. **Intake and durable task state**
   - PostgreSQL-backed task queue.
   - Explicit task lifecycle and leases.
   - Execution specifications with lineage and sealed identity.

2. **Scheduling and worker orchestration**
   - Continuous bounded scheduling.
   - Correction worker / execution loop.
   - Retry and failure classification.
   - Reaper and durable recovery mechanisms.

3. **Governance**
   - Fail-closed policy evaluation.
   - Execution authorization at the runtime boundary.
   - Capability grants for workspace read/write, command execution, Git write and remote persistence.
   - Post-execution governance evidence.

4. **Execution runtime**
   - PDL Agent Runtime Contract V1 defines identity, lifecycle, evidence and terminal-result semantics.
   - The contract wraps the existing runtime rather than creating a second runtime.
   - DefaultExecutionEngine remains authoritative for physical provider execution.
   - Provider/model selection is deliberately outside the runtime contract.

5. **Provider/gateway abstraction**
   - OpenRouter is the primary gateway.
   - 9router is the fallback gateway.
   - Provider attempts are isolated and observable.
   - Retry, timeout, quota and fallback behavior are bounded and recorded.
   - The runtime does not depend on a specific coding-agent brand.

6. **Workspace and repository safety**
   - Temporary isolated workspaces per execution attempt.
   - Repository identity verification.
   - Fail-closed behavior for identity or authorization mismatches.
   - The provider operates inside the execution boundary; it does not own PDL's host or repository governance.

7. **Validation, correction and review**
   - Execution success is not the same thing as engineering completion.
   - Finalization validates the produced workspace before commit.
   - Correction loops can remediate failed validation.
   - Code review is a distinct quality gate.

8. **Persistence and delivery**
   - Local Git commit is not the terminal truth.
   - Persistence gates evaluate whether work may be delivered remotely.
   - Remote Git persistence/delivery is governed and evidenced.
   - Repository identity and remote state are verified.

9. **Evidence and institutional memory**
   - Execution traces, lifecycle state, finalization, governance and persistence outcomes are persisted as evidence.
   - PUB Neural is the downstream institutional-memory layer.
   - Neural receives execution experience. It is not the physical execution engine.

## Canonical lifecycle

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
Correction when required
    ↓
Code review
    ↓
Finalization / local commit
    ↓
Persistence gate
    ↓
Remote persistence / delivery
    ↓
Post-execution evidence
    ↓
PUB Neural ingestion
    ↓
Terminal task state
~~~

A successful provider response is therefore only one phase of the system.

## Current P1.1 / P1.2 architecture

### P1.1: Agent Runtime Contract

PDL now has an explicit runtime contract:

- PDL_AGENT_RUNTIME_CONTRACT_VERSION = pdl-agent-runtime-v1
- RuntimeContext
- RuntimeEvidence
- RuntimeResult
- AgentRuntime
- ExecutionEngineRuntimeAdapter

The contract is intentionally narrow. It establishes identity, lifecycle and evidence semantics without taking over scheduling, governance, provider selection, workspace execution, finalization or Neural.

### P1.2: Execution Governance

The production worker path is now bounded by PdlExecutionGovernance.

The production capability set is:

- WORKSPACE_READ
- WORKSPACE_WRITE
- COMMAND_EXECUTION
- GIT_WRITE
- REMOTE_PERSISTENCE

The worker reuses the authoritative policy decision where available, authorizes the execution boundary, and persists post-execution governance evidence.

## Hard invariants

| Invariant | Rule |
|---|---|
| **PDL is the system** | PDL is the engineering runtime/platform. Agents and models are replaceable execution resources. |
| **Gateway separation** | PDL talks to OpenRouter first and uses 9router as fallback. |
| **Provider neutrality** | Runtime contracts do not hard-code a model or coding-agent brand. |
| **Fail-closed governance** | Missing identity, authorization, capability or required execution state blocks the operation. |
| **Workspace isolation** | Provider execution occurs inside an isolated task workspace. |
| **Repository identity** | canonical(TASK.repository) === canonical(GIT_REMOTE.origin) must hold at the enforced gates. |
| **Execution ≠ completion** | Provider success does not imply validation, review, persistence or delivery success. |
| **Evidence first** | Terminal runs must leave structured evidence sufficient to reconstruct the execution. |
| **Persistence first** | Durable Git/remote state and PostgreSQL state outrank volatile chat/session state. |
| **Neural downstream** | PUB Neural receives institutional evidence; it is not the physical execution engine. |
| **No fake activity** | Operational state and metrics must represent real execution evidence only. |
| **No architectural coupling to agents** | Hermes, Antigravity, Codex, Claude Code or another tool may be used externally without becoming part of PDL's identity. |

## Repository and development

Repository: pubcoreagencia/pub-dev-loop

Current proof branch: pdl/p1-2-operational-worker-proof

Current audited checkpoint:

cceea37c49fa2bef35bb8a18034854f38860bd2a

Current scripts include:

~~~sh
npm run typecheck
npm run build
npm test
npm run pdl:api
npm run pdl:worker
npm run router:start
npm run router:health
~~~

The repository also contains the legacy Codex adapter and compatibility paths. Their presence in source code does **not** mean Codex is the architectural center of PDL. The canonical architecture is the provider/gateway abstraction described above.

## PDL, PP and other PUB repositories

PDL is an independent engineering system.

Other PUB products and repositories are execution targets or adjacent systems, not internal implementation modules of PDL. PDL must preserve repository, workspace and product isolation while operating on those targets.

PUB Neural is the institutional-memory system connected downstream through an explicit bridge.

## Current strategic direction

The goal is not to build a permanent collection of coding-agent subscriptions around PDL.

The goal is to finish PDL as the **software-house engineering runtime**, with the model/provider layer remaining replaceable behind the PDL gateway abstraction.

Once PDL is operationally closed, the normal software-house workflow becomes:

~~~text
work arrives
   ↓
PDL
   ↓
OpenRouter → 9router fallback
   ↓
execution
   ↓
validation / correction / review
   ↓
delivery
   ↓
evidence / PUB Neural
~~~

That is the system being built.

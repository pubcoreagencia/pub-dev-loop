# PDL — PHASE 8.3D-A: CHIEF OF STAFF ORGANIZATIONAL MEMORY ARCHITECTURE

## 1. Executive Summary & Objective

This document defines the architectural contract, security boundaries, precedence rules, and failure isolation guarantees for integrating the **Chief of Staff (CoS)** with the PUB DEV LOOP Organizational Memory Engine.

As the organizational coordinator of **The Office**, the Chief of Staff operates at the strategic delegation and planning layer—coordinating the **Architect**, **Developer**, **Reviewer**, and **QA Engineer**. Because the Chief of Staff orchestrates task decomposition and delegation, memory must act strictly as **advisory historical context**, never as autonomous authority that overrides the current CEO objective, current project state, or active approval and review guardrails.

---

## 2. Real Chief of Staff Execution Path

The Chief of Staff execution path in the codebase spans two distinct flows:

```text
                  ┌────────────────────────────────────────────────────────┐
                  │                    CEO OBJECTIVE                       │
                  │             (HTTP POST /office/plans)                  │
                  └───────────────────────────┬────────────────────────────┘
                                              │
                      ┌───────────────────────┴───────────────────────┐
                      ▼                                               ▼
         [EventBus: OBJECTIVE_SUBMITTED]                [EventBus: MEETING_STARTED]
         actorId: 'ceo', targetId: 'chief-of-staff'     participants: ['ceo', 'chief-of-staff']
                      │                                               │
                      └───────────────────────┬───────────────────────┘
                                              │
                                              ▼
                             ┌──────────────────────────────────┐
                             │    createOrganizationalPlan()    │
                             │      (src/office/planning.ts)    │
                             └────────────────┬─────────────────┘
                                              │
         ┌────────────────────────────────────┼────────────────────────────────────┐
         ▼                                    ▼                                    ▼
[Step Dependency Graph]              [resolveAgentAssignment]            [Topological Validation]
(validateStepDependencies)           (Architect/Dev/Rev/QA)              (Cycle & Deadlock Check)
         │                                    │                                    │
         └────────────────────────────────────┼────────────────────────────────────┘
                                              │
                                              ▼
                             ┌──────────────────────────────────┐
                             │     [OrganizationalPlan READY]   │
                             │     createdBy: 'chief-of-staff'  │
                             └────────────────┬─────────────────┘
                                              │
                      ┌───────────────────────┴───────────────────────┐
                      ▼                                               ▼
         [EventBus: PLAN_FORMULATED]                    [EventBus: MEETING_ENDED]
         actorId: 'chief-of-staff', targetId: 'ceo'     actorId: 'chief-of-staff', targetId: 'ceo'
                      │
                      ▼
         [HTTP POST /office/plans/execute-step]
         planStepToTask() ──► tasks.create() ──► [EventBus: STEP_DELEGATED] ──► [EventBus: AGENT_STARTED_WORK]
```

### Direct Cognitive Task Execution:
When a specific task is queued directly with `agentId: 'chief-of-staff'` (e.g. strategic report or organizational synthesis), it enters `RouterWorker.executeWithRetry()`, executing the model via `OpenRouterProvider`/`RouterProvider`.

---

## 3. Map of Context Sources for Chief of Staff

| Source ID | Context Source | Origin in Code | Timing of Ingestion | Authority Level |
|---|---|---|---|---|
| **A** | **Current CEO Objective** | `req.body.objective` in `/office/plans` | Initial request payload | **Primary (Precedence 1)** |
| **B** | **Current Project State** | `req.body.project`, `req.body.repository`, Git workspace | Planning invocation | **Precedence 2** |
| **C** | **Current Active Tasks & Queue** | `TaskRepository.list()`, `step.dependsOn` | Step resolution | **Precedence 3** |
| **D** | **Current Approvals** | `CEOApprovalManager`, `APPROVAL_REQUESTED` | Execution / approval gate | **Precedence 3** |
| **E** | **Current Review Status** | `CodeReviewManager`, `REVIEW_BLOCKED` | Iteration check | **Precedence 3** |
| **F** | **Current Execution Status** | `TaskRepository`, `BaseWorker` leases | Runtime execution | **Precedence 3** |
| **G** | **Organizational Memory** | `MemoryRetrievalEngine.retrieveContext()` | Context enrichment | **Consultative (Precedence 4)** |
| **H** | **Historical Agent Text** | Ephemeral event logs / transcript | Logging / trace | **Informational (Precedence 5)** |

---

## 4. Map of Available Memories for Chief of Staff

| Memory Type | Real Runtime Producer | Source Event | Epistemic Status | Allowed for CoS? | Default Scope |
|---|---|---|---|---|---|
| `DECISION` | CEO Approval Decision | `APPROVAL_GRANTED`, `APPROVAL_REJECTED` | `DECIDED` | **YES** | `PROJECT` |
| `PLAN` | Chief of Staff Formulation | `PLAN_FORMULATED` | `DERIVED` | **YES** | `PROJECT` |
| `PROJECT_CONTEXT` | Architect / Setup Pipeline | System Boundary Config | `DERIVED` | **YES** | `PROJECT` |
| `TASK_RESULT` | Developer / QA Task Completion | `AGENT_FINISHED_WORK` | `OBSERVED` | **NO** (Filtered) | `TASK` |
| `REVIEW_FINDING` | Reviewer Inspection | `REVIEW_FINDING`, `REVIEW_BLOCKED` | `DERIVED` | **NO** (Filtered) | `PROJECT` |
| `LESSON` | Verified Knowledge Pipeline | Verified Procedure Notice | `DERIVED` | **NO** (Filtered) | `PROJECT` |

---

## 5. Current State vs. Organizational Memory Matrix

| Dimension | Current Runtime State (Authoritative) | Organizational Memory (Consultative) | Conflict Resolution Rule |
|---|---|---|---|
| **CEO Goal** | Current prompt/objective submitted by CEO. | Past goals from previous weeks/sprints. | **Current CEO objective wins 100%.** |
| **Project Arch** | Current files, branches, and schemas in repo. | Past architecture decisions and plans. | **Current repository state is truth.** |
| **Approval** | Current approval request status (`PENDING`/`REJECTED`). | Historical approval granted on earlier PR. | **Current pending/rejected state binds runtime.** |
| **Review Gate** | Active `REVIEW_BLOCKED` at iteration 3. | Historical `REVIEW_APPROVED` on old commit. | **`REVIEW_BLOCKED` blocks execution.** |
| **Task Status** | `QUEUED`, `RUNNING`, `ASSIGNED`. | Historical `TASK_RESULT` completed in past. | **Current queue state determines delegation.** |

---

## 6. Precedence Contract

$$\text{CURRENT CEO OBJECTIVE} > \text{SECURITY / RUNTIME POLICIES} > \text{CURRENT PROJECT STATE} > \text{ACTIVE EXECUTION / APPROVAL STATE} > \text{AUTHORIZED ORGANIZATIONAL CONTEXT} > \text{ORGANIZATIONAL MEMORY} > \text{HISTORICAL AGENT TEXT}$$

### Mandatory Rule Set:
1. A historical `DECISION` memory **NEVER** overrides or modifies a new, explicit instruction or objective from the CEO.
2. A historical `PLAN` memory **NEVER** replaces or alters the current project plan or dependency DAG.
3. An organizational memory **NEVER** grants authorization, modifies permissions, or bypasses CEO approval requirements.
4. An organizational memory **NEVER** unblocks a `REVIEW_BLOCKED` task.

---

## 7. Analysis of "Memory-Driven Planning" Risks & Mitigations

| Identified Risk | Failure Scenario | Mitigation & Guardrail |
|---|---|---|
| **Stale Plan Repetition** | CoS re-creates a completed 4-step plan because a past `PLAN` memory matches the keyword. | Memory is injected with an explicit disclaimer notice; `createOrganizationalPlan` creates steps deterministically based on current objective only. |
| **Redundant Delegation** | CoS delegates tasks already completed in the current sprint. | Current `TaskRepository` active state check takes absolute precedence over historical memories. |
| **Bypassing Blocked States** | CoS assumes past approval overrides a current `REVIEW_BLOCKED`. | Guardrail from Phase 7.2 is enforced at the Worker/Finalizer level, immune to prompt text. |
| **Contradictory Architecture** | CoS assumes legacy database decision (e.g. MySQL) applies when current objective specifies PostgreSQL. | Precedence notice explicitly instructs the agent to discard memories that contradict current contracts. |

---

## 8. Retrieval Contract for Chief of Staff

```typescript
export interface ChiefOfStaffMemoryRetrievalContract {
  tenantId: string;       // Derived from trusted task.tenantId or request context (default: 'pub-dev-loop')
  projectId: string;      // Derived from task.project or plan.project (strictly required)
  agentRole: 'chief-of-staff';
  status: 'ACTIVE';       // Discards BLOCKED, SUPERSEDED, INACTIVE
  types: ['DECISION', 'PLAN', 'PROJECT_CONTEXT'];
  limit: 5;               // Hard cap at 5 memories
  maxContentLength: 500;  // Truncated with '... [truncated]' if longer
}
```

### Justification for Limit = 5:
* 5 verified memories provide sufficient context regarding executive decisions and decomposition patterns without diluting the prompt or introducing context bloat.
* Maintains uniform deterministic performance across all agents.

---

## 9. Decision & Plan Semantics

### Decision Semantics:
* Produced exclusively by `APPROVAL_GRANTED` / `APPROVAL_REJECTED` events originating from the CEO (`actorId: 'ceo'`).
* When a newer decision supersedes an older one, `store.supersede(oldId, newId)` marks the old decision as `SUPERSEDED`.
* `SUPERSEDED` decisions are strictly filtered out by `status === 'ACTIVE'`.

### Plan Semantics:
* Produced exclusively by `PLAN_FORMULATED` events originating from the Chief of Staff (`actorId: 'chief-of-staff'`).
* Stored as derived organizational structure (`epistemicStatus: 'DERIVED'`).
* A past plan memory is purely informational regarding decomposition strategies and does not instantiate tasks.

---

## 10. Multi-Tenant & Project Isolation

* **Tenant Resolution:** Derived strictly from trusted backend request/task context (`task.tenantId`). Never parsed from free text or LLM prompt output.
* **Project Resolution:** Derived strictly from `task.project` or `plan.project`.
* **Zero Global Fallback:** If `projectId` is missing or empty, retrieval is aborted immediately, returning `[]` with no database query.
* **Cross-Tenant Guard:** Queries for Tenant A will never return records for Tenant B under any circumstance.

---

## 11. Interaction with Planning Engine & Safety Gates

### Injection Point:
* For direct tasks (`agentId === 'chief-of-staff'`), injection occurs in `RouterWorker.executeWithRetry()` via `enrichChiefOfStaffTaskWithMemory()`.
* For plan formulation (`createOrganizationalPlan`), memory acts as supplementary context for step prompt refinement without altering step ID generation, dependency graph resolution, or topological sort order.

### Safety Gates:
* Memory context **CANNOT**:
  * Reset review iterations.
  * Increase `MAX_REVIEW_ITERATIONS` (3).
  * Auto-approve CEO approval requests.
  * Bypass `REVIEW_BLOCKED`.
  * Elevate permissions or change tool bindings.

---

## 12. Failure Isolation

* If the PostgreSQL connection drops, times out, or the Memory Engine throws an exception:
  * Error is logged safely (`console.warn('[MemoryRetrieval] Chief of Staff retrieval notice...')`).
  * The planning or task execution proceeds seamlessly using current objective and state only.
  * **Memory failure never fails a plan, task, or approval.**

---

## 13. Observability Standard

When memories are retrieved for Chief of Staff, an event is logged in standard structured JSON:

```json
{
  "event": "ORGANIZATIONAL_MEMORY_RETRIEVED",
  "taskId": "task-cos-1",
  "project": "pub-dev-loop",
  "agent": "chief-of-staff",
  "memoryCount": 3,
  "memoryIds": ["mem-101", "mem-102", "mem-103"],
  "durationMs": 1
}
```

* **Safety:** Zero full prompts, memory contents, diffs, credentials, or secrets are ever logged.

---

## 14. Implementation Boundary for Future Phase 8.3D-B

Phase 8.3D-B will implement:
1. `formatChiefOfStaffMemoryContext(memories: OrganizationalMemory[]): string`
2. `enrichChiefOfStaffTaskWithMemory(task: Task, retrievalEngine?: MemoryRetrievalEngine): Promise<Task>`
3. Chaining in `RouterWorker.executeWithRetry()`:
   ```typescript
   let effectiveTask = await enrichDeveloperTaskWithMemory(task);
   effectiveTask = await enrichArchitectTaskWithMemory(effectiveTask);
   effectiveTask = await enrichReviewerTaskWithMemory(effectiveTask);
   effectiveTask = await enrichQaTaskWithMemory(effectiveTask);
   effectiveTask = await enrichChiefOfStaffTaskWithMemory(effectiveTask);
   ```
4. Comprehensive test suite `tests/office-cos-memory-context.test.ts` implementing the 14 mandatory test cases.

---

## 15. Mandatory Test Plan for Phase 8.3D-B

1. **CEO Objective Precedence:** CEO objective beats contradictory historical `DECISION`.
2. **Current Project State Precedence:** Current repository state beats historical `PLAN`.
3. **Current Approval Precedence:** Current pending/rejected approval state beats memory.
4. **Review Guardrail Precedence:** Active `REVIEW_BLOCKED` beats historical approval.
5. **Tenant Isolation:** Tenant A task cannot retrieve Tenant B memories.
6. **Project Isolation:** Project A task cannot retrieve Project B memories.
7. **Empty Project Guard:** Missing `task.project` returns empty array cleanly.
8. **Authorized Memory Scoping:** CoS receives `DECISION`, `PLAN`, `PROJECT_CONTEXT`.
9. **Negative Scoping:** CoS does NOT receive `TASK_RESULT`, `REVIEW_FINDING`, or `LESSON`.
10. **Superseded Memories:** CoS does not receive `SUPERSEDED` or `BLOCKED` records.
11. **Context Limits:** Maximum 5 memories capped; maximum 500 chars truncated per memory.
12. **Failure Isolation:** Database outage does not break CoS planning/execution.
13. **Provenance Integrity:** Full provenance fields preserved without fabrication.
14. **Real Execution Integration:** Provider receives enriched CoS task prompt.

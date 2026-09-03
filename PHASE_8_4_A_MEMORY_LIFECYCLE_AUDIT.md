# PDL — PHASE 8.4-A: ORGANIZATIONAL MEMORY LIFECYCLE & LEARNING AUDIT

## 1. Executive Summary

As of Phase 8.3D-B, the full workforce of **The Office** (CEO, Chief of Staff, Architect, Developer, Reviewer, QA Engineer) is integrated with the deterministic PostgreSQL **Organizational Memory Engine**. All 5 operational agents retrieve relevant, verified memories scoped strictly by role, tenant, and project, capped at 5 memories and 500 characters per entry.

This audit addresses the next evolutionary question of PUB DEV LOOP:
> *"How can the system learn continuously from real operations without converting memory into historical garbage, obsolete authority, or hallucinated rules?"*

**Status:** This phase is **AUDIT + ARCHITECTURE ONLY**. No runtime code, schema migrations, or production deployments are performed.

---

## 2. Current Memory Architecture Map

The existing runtime execution trace flows as follows:

```text
[OfficeEvent] (EventBus / PostgreSQL office_events)
     │
     ▼
[MemoryIngestPipeline.ingestEvent(event, tenantId)]
     │ (Filters non-durable events; extracts provenance, epistemic status, metadata)
     ▼
[OrganizationalMemoryStore.create(input)]
     ├── In-Memory Map (Synchronous deterministic storage & testing)
     └── PostgreSQL Table: organizational_memories (Persistent multi-tenant storage)
            (ON CONFLICT DO UPDATE SET recurrence_count = recurrence_count + 1)
     │
     ▼
[MemoryRetrievalEngine.retrieveContext(filter)]
     ├── 1. Tenant Isolation (exact match: task.tenantId)
     ├── 2. Project Isolation (exact match: task.project; abort if empty)
     ├── 3. Status Filter (status === 'ACTIVE')
     ├── 4. Role Scope Filter (AGENT_ROLE_MEMORY_SCOPES[role])
     ├── 5. Deterministic Token Matching (query keywords)
     └── 6. Strict Cap (limit <= 5, max 500 chars)
     │
     ▼
[enrich<Role>TaskWithMemory(task)]
     └── [Effective Task Prompt: Current Task Prompt + Explicit Historical Context Block]
            └── Provider.execute(effectiveTask)
```

---

## 3. Real Memory Producers Audit

| Event Type | Generated Memory Type | Epistemic Status | Source | Producer / Actor | When Ingested | When Excluded / Ignored |
|---|---|---|---|---|---|---|
| `APPROVAL_GRANTED` | `DECISION` | `DECIDED` | `CEO_DECISION` | `ceo` | When CEO approves an approval request | Non-approval events |
| `APPROVAL_REJECTED` | `DECISION` | `DECIDED` | `CEO_DECISION` | `ceo` | When CEO rejects an approval request | Non-approval events |
| `REVIEW_FINDING` | `REVIEW_FINDING` | `DERIVED` | `REVIEW_INSPECTION` | `reviewer` | When code review detects issues | Review approvals with 0 findings |
| `REVIEW_BLOCKED` | `REVIEW_FINDING` (`status: 'BLOCKED'`) | `DERIVED` | `REVIEW_INSPECTION` | `reviewer` | When review iterations reach limit (3) | Normal iterations (<3) |
| `AGENT_FINISHED_WORK` | `TASK_RESULT` | `OBSERVED` | `RUNTIME_EXECUTION` | Agent ID | When task completes with exitCode 0 | Intermediate execution steps |
| `AGENT_FAILED_WORK` | `TASK_RESULT` (`failed: true`) | `OBSERVED` | `RUNTIME_EXECUTION` | Agent ID | When task fails / non-zero exit | Intermediate execution steps |
| `PLAN_FORMULATED` | `PLAN` | `DERIVED` | `ORGANIZATIONAL_PLAN` | `chief-of-staff` | When CoS decomposes CEO objective | Unvalidated / Draft plans |

### Producer Integrity Audit Findings:
* **Zero Fake Context:** All producers extract information strictly from verified event payloads and runtime metadata.
* **No Free Text Hallucination:** Memories are not generated from unverified conversational prose.
* **Limitation Identified:** Operational task results (`AGENT_FINISHED_WORK`) are currently stored with `scope: 'TASK'` but are searchable across the project if not filtered by `taskId`.

---

## 4. LESSON Status Audit (Explicit Declaration)

> **DECLARAÇÃO ESTATUTÁRIA: `LESSON` NÃO É AINDA UM CONHECIMENTO GERADO AUTOMATICAMENTE PELO SISTEMA.**

* **Current Status:** The `LESSON` type exists in `MemoryType` enum and `AGENT_ROLE_MEMORY_SCOPES` (for Developer and QA Engineer), but **no automated ingest pipeline producer currently emits `LESSON`**.
* **Rationale:** Lessons require cross-task corroboration and procedural validation. Auto-generating lessons via single-shot LLM runs risks codifying idiosyncratic bugs or temporary workarounds as permanent organizational rules.
* **Validation Requirement:** A `LESSON` must only be created when a pattern is validated across multiple task cycles or verified by an explicit institutional policy.

---

## 5. Status State Machine Audit

### Existing State Machine:
```text
         ┌───────────────┐
         │    ACTIVE     │ ◄─── Initial State (Default on creation)
         └───────┬───────┘
                 │
        ┌────────┴────────┐
        ▼                 ▼
 ┌───────────────┐ ┌───────────────┐
 │  SUPERSEDED   │ │    BLOCKED    │
 └───────────────┘ └───────────────┘
```

* **`ACTIVE`**: Retrievable by `MemoryRetrievalEngine`.
* **`SUPERSEDED`**: Set via `store.supersede(oldId, newId)`. Excluded from active retrieval.
* **`BLOCKED`**: Set upon `REVIEW_BLOCKED` events. Excluded from active retrieval.

### Identified Gaps:
1. **No Automated Superseding:** When a new `DECISION` or `PLAN` is formulated, the previous record remains `ACTIVE` unless `store.supersede()` is explicitly called by a controller.
2. **No Terminal Archival:** No state exists for memories that are permanently obsolete or archived without a direct replacement.
3. **No Unblock Transition:** No `RESOLVED` or `UNBLOCKED` transition exists for `BLOCKED` records.

---

## 6. Decision Lifecycle Audit

* **Operational Approval vs. Institutional Policy:**
  * `APPROVAL_GRANTED` records single-task approvals (e.g. deploy step, plan step).
  * Strategic institutional decisions (e.g. database choice, framework standard) share the same `DECISION` type.
* **Supersession Mechanism:**
  * The system supports `store.supersede(oldId, newId, tenantId)`, which updates `status = 'SUPERSEDED'` and records `metadata.supersededBy`.
  * **Gap:** The decision pipeline does not yet automatically detect semantic contradictions between new CEO directives and old decisions to trigger supersession autonomously.

---

## 7. Plan Lifecycle Audit

* **Current Behavior:** When `PLAN_FORMULATED` fires, a `PLAN` memory is created as `ACTIVE`.
* **Risk:** A plan formulated 3 months ago remains `ACTIVE` in memory even after the plan has been fully executed, abandoned, or rewritten.
* **Proposed Plan Lifecycle States:**
  * `PLAN_PROPOSED` $ightarrow$ `PLAN_EXECUTING` $ightarrow$ `PLAN_COMPLETED` $ightarrow$ `PLAN_SUPERSEDED` / `PLAN_ABANDONED`.

---

## 8. Memory Obsolescence Model

To prevent stale context from poisoning agent reasoning, memory must be categorized into 5 distinct lifecycle categories:

| Category | Definition | Retrievable by Agents? | Transition Trigger |
|---|---|---|---|
| **CURRENT** | Active truth of the current operational state | Primary Evidence | State changes in runtime |
| **HISTORICAL** | Past verified event (informational context) | YES (Consultative) | Age / completion of task |
| **SUPERSEDED** | Formally replaced by a newer decision/plan | **NO** | `store.supersede()` call |
| **OBSOLETE** | Outdated knowledge without direct replacement | **NO** (Archived) | Governance / TTL rule |
| **BLOCKED** | Quarantined due to failed verification / guardrail | **NO** | `REVIEW_BLOCKED` event |

---

## 9. Recurrence and Pattern Detection

* **Current Implementation:**
  * In PostgreSQL: `ON CONFLICT (tenant_id, project_id, type, COALESCE(provenance->>'eventId', ''), COALESCE(provenance->>'taskId', ''), COALESCE(provenance->>'ruleId', '')) DO UPDATE SET recurrence_count = recurrence_count + 1`.
* **Distinction Required:**
  $$\text{REPEATED OBSERVATION (Same rule/task hit)} \neq \text{VALIDATED INSTITUTIONAL LESSON}$$
  * A high `recurrence_count` indicates a persistent issue or repeated rule violation, but does NOT automatically promote the record into a universal dogma without corroboration.

---

## 10. Memory Quality Model (Proposed Dimensions)

```text
                       ┌──────────────────────────────────────┐
                       │       MEMORY QUALITY INDEX (MQI)     │
                       └──────────────────┬───────────────────┘
                                          │
         ┌──────────────────┬─────────────┴────────────┬──────────────────┐
         ▼                  ▼                          ▼                  ▼
[Provenance Score]  [Source Authority]        [Recency & Decay]   [Corroboration]
 (Complete IDs)     (CEO > Reviewer > Dev)    (Temporal Validity) (Cross-Task Hits)
```

1. **Provenance Completeness (Deterministic):** Evaluates if `eventId`, `taskId`, `actorId`, `source`, and `verifiedAt` are fully populated.
2. **Source Authority (Deterministic):** `CEO_DECISION` (High) > `REVIEW_INSPECTION` (High) > `RUNTIME_EXECUTION` (Medium).
3. **Temporal Validity / Recency (Deterministic):** Age of memory vs. project milestone.
4. **Corroboration Index (Deterministic):** Cross-task recurrence without contradiction.

---

## 11. Contradiction Model

When memories conflict, the system must differentiate:

1. **Scope Differences (Coexistence):**
   * Rule A applies to `project: payments`; Rule B applies to `project: auth`. (Valid coexistence).
2. **Temporal Supersession (Replacement):**
   * Decision 1 (Q1: "Use Library X") $ightarrow$ Decision 2 (Q3: "Migrate to Library Y"). (Superseded).
3. **Operational Contradiction (Conflict):**
   * Historical Memory ("All tests passed") vs. Current Execution ("Test failed with exitCode 1").
   * **Absolute Rule:** Current execution evidence wins 100%.

---

## 12. Memory vs. Current State Boundary

> **AXIOMA FUNDAMENTAL: CURRENT STATE $\neq$ ORGANIZATIONAL MEMORY**

* **Current State Authority:** `TaskRepository`, Active Plans, `CEOApprovalManager`, `CodeReviewManager` guardrails, Git Workspace snapshot.
* **Organizational Memory Role:** Supplementary historical context with zero operational authority.
* **Audit Confirmation:** No runtime path currently relies on memory as a proxy for operational state.

---

## 13. Retrieval Quality Audit

* **Current Mechanism:** Exact tenant + exact project + status `ACTIVE` + role-based memory type filtering + token substring search.
* **Strengths:** 100% deterministic, zero hallucination, zero embedding drift, sub-millisecond execution.
* **Limitations:** Exact token matching lacks semantic synonym matching (e.g. "auth" vs "authentication").
* **Recommendation:** Maintain deterministic baseline as P0; evaluate hybrid token-BM25 ranking in later phases.

---

## 14. Agent vs. Organizational Scope

| Scope | Visibility | Usage | Example |
|---|---|---|---|
| **GLOBAL** | All tenants & projects | Statutory system guardrails | Precedence notices |
| **PROJECT** | Specific project across all agents | Architectural standards & CEO decisions | PostgreSQL migration mandate |
| **AGENT** | Specific agent role in project | Review rules, QA testing patterns | Reviewer regex patterns |
| **TASK** | Specific task execution only | Single run execution traces | Test run exit codes |

---

## 15. Memory Retention & Archival

* **Audit Finding:** Currently, memories are stored permanently in `organizational_memories` table without automatic purging.
* **Archival Policy Recommendation:**
  * **Raw Audit Records:** Never delete (required for historical compliance, replay, and provenance).
  * **Retrieval View:** Filter out memories where `status IN ('SUPERSEDED', 'BLOCKED', 'OBSOLETE')` or age exceeds project milestone threshold without recent recurrence.

---

## 16. Replay & Reconstruction Audit

* `replayHistoricalEvents()` in `src/office/memory.ts` reads from `office_events` and re-ingests them through `MemoryIngestPipeline`.
* **Idempotency:** Protected by PostgreSQL unique index `org_memories_dedupe_idx`.
* **Audit Finding:** Replaying historical events preserves exact event provenance without fabricating new IDs.

---

## 17. Security & Boundary Verification

* **Tenant Isolation:** Verified across all agents; cross-tenant retrieval is strictly impossible.
* **Project Isolation:** Empty `projectId` returns `[]` immediately with zero global leak.
* **Permission Immutability:** Memory **CANNOT** elevate permissions, alter roles, add tools, or bypass approval gates.

---

## 18. Memory Poisoning & Trusted Producers

* **Vulnerability Analysis:** Can an LLM inject false decisions into memory?
* **Guardrail:** Only structured `OfficeEvent` objects emitted by trusted backend services (e.g. `CEOApprovalManager`, `CodeReviewManager`, `RouterWorker`) enter `MemoryIngestPipeline`. Unstructured agent prose is strictly ignored.

---

## 19. Future Learning Loop Architecture

```text
[OBSERVATION] ──► [CORROBORATION] ──► [PATTERN DETECTED]
                                              │
                                              ▼
[INSTITUTIONAL LESSON] ◄── [VALIDATION / CEO] ◄── [LESSON CANDIDATE]
       │
       ▼
[AGENT RETRIEVAL] ──► [TASK EXECUTION] ──► [FEEDBACK & RE-EVALUATION]
```

---

## 20. CEO Oversight Matrix

* **Requires Explicit CEO Approval:**
  * Promoting a `LESSON CANDIDATE` to permanent `INSTITUTIONAL LESSON`.
  * Superseding core architectural mandates.
  * Modifying security policies.
* **Automatic Ingestion (Zero Approval Needed):**
  * Execution outcomes (`TASK_RESULT`).
  * Review findings (`REVIEW_FINDING`).
  * Automated test results and compiler outputs.

---

## 21. Memory Governance Layer Architecture

A future **Memory Governance Layer** will govern:
1. Lifecycle state transitions (`ACTIVE` $\rightarrow$ `SUPERSEDED` $\rightarrow$ `ARCHIVED`).
2. Quality scoring and decay curves.
3. Contradiction resolution and supersession tracking.
4. Retention and selective indexing.

---

## 22. Recommended Phase 8.4-B Implementation Roadmap

* **P0 (Critical Foundation):**
  * Formalize automated supersession triggers on new `DECISION` / `PLAN` formulation.
  * Implement `ARCHIVED` and `OBSOLETE` status filtering in `MemoryRetrievalEngine`.
  * Hardened deduplication and replay lifecycle fidelity.
* **P1 (Quality & Governance):**
  * Objective Memory Quality Index (MQI) calculation.
  * Recurrence cross-task corroboration tracking.
* **P2 (Institutional Learning Pipeline):**
  * First verified `LESSON` producer with CEO validation workflow.
* **P3 (Retrieval Enhancements):**
  * Hybrid deterministic + BM25 ranking (no non-deterministic vector drift).

---

## 23. Explicit Non-Goals

* **NO** Vector Embeddings or Vector DBs in this milestone.
* **NO** LLM-based memory summarization or auto-rewrite.
* **NO** Autonomous self-modification of system policies.
* **NO** Synthetic memory generation to artificially pass tests.

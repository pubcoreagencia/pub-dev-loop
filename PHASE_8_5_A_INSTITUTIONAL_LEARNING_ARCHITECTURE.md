# PDL — PHASE 8.5-A: INSTITUTIONAL LEARNING AUDIT & ARCHITECTURE CONTRACT

## 1. Executive Summary & Mission Statement

As of Phase 8.4-B, the full workforce of **The Office** (CEO, Chief of Staff, Architect, Developer, Reviewer, QA Engineer) operates with a governed, multi-tenant Organizational Memory Engine in PostgreSQL. All 5 operational agents consume historical memory under strict role-based scopes, capped contexts (max 5 memories, max 500 chars), deterministic deduplication, and transition guards.

### Mission Statement:
This architecture contract defines how PUB DEV LOOP will evolve from **Memory Storage & Retrieval** to **Institutional Learning**.
The core mission of Institutional Learning is:
> *"Transform verified operational experience across multiple tasks into governed, reusable institutional lessons without allowing agents, free text, mechanical recurrence, or stale historical memory to manufacture unverified authority."*

**Status:** This phase is **AUDIT + ARCHITECTURE CONTRACT ONLY**. No runtime code, schema migrations, or production deployments are performed.

---

## 2. Current Learning Foundation Audit

### 2.1 Complete Execution Flow:
```text
[Real Runtime Event] (office_events: AGENT_FINISHED_WORK, REVIEW_FINDING, APPROVAL_GRANTED)
     │
     ▼
[MemoryIngestPipeline.ingestEvent(event, tenantId)]
     │ (Extracts provenance, epistemic status, metadata; filters ephemeral events)
     ▼
[OrganizationalMemoryStore.create(input)]
     ├── In-Memory Map (Deterministic synchronous access)
     └── PostgreSQL Table: organizational_memories
            (ON CONFLICT DO UPDATE SET recurrence_count = recurrence_count + 1)
     │
     ▼
[MemoryGovernanceEngine] (src/office/memory-governance.ts)
     ├── State Machine Guards (ACTIVE -> SUPERSEDED / BLOCKED; forbids silent reactivation)
     ├── Supersession Validation (same-tenant, same-project, both ACTIVE)
     ├── Objective Quality Metadata (provenanceCompleteness, sourceAuthority, temporalValidity)
     ├── Contradiction Analysis (COEXISTING, SUPERSEDED, CONTRADICTORY_UNRESOLVED)
     └── Memory Poisoning Protection (rejects untrusted conversational claims)
     │
     ▼
[MemoryRetrievalEngine.retrieveContext(filter)]
     ├── Exact tenantId & projectId scoping
     ├── Status === 'ACTIVE' filter
     ├── Role scope filter (AGENT_ROLE_MEMORY_SCOPES[role])
     └── Token match + Hard Cap (5 memories, 500 chars)
     │
     ▼
[enrich<Role>TaskWithMemory(task)]
     └── [Effective Task Prompt: Current Task Prompt + Verified Historical Context Block]
            └── Provider.execute(effectiveTask)
```

### 2.2 Core Distinction: Authoritative Facts vs. Historical Context
* **Authoritative Runtime Facts (Current State):** Process exit codes, vitest test outputs, TypeScript compiler errors, active review findings (`CodeReviewManager`), CEO approval decisions (`CEOApprovalManager`), and Git workspace files.
* **Historical Organizational Memory:** Advisory, non-authoritative historical records. Never replaces or overrides current runtime evidence.

---

## 3. The 5-Tier Learning Taxonomy

```text
┌─────────────────┐
│   OBSERVATION   │  Verified runtime fact (exitCode, test result, compiler output, review finding)
└────────┬────────┘
         │ (Corroborated across >= 3 independent task runs with remediation)
         ▼
┌─────────────────┐
│     PATTERN     │  Deterministic canonical signature of recurring finding + verified fix
└────────┬────────┘
         │ (Proven dual-role confirmation: Reviewer finding + QA pass)
         ▼
┌─────────────────┐
│ LESSON_CANDIDATE│  Proposed organizational lesson with full evidence graph & zero contradictions
└────────┬────────┘
         │ (Governed Validation: CEO approval for strategic / Governance Engine for operational)
         ▼
┌─────────────────┐
│INSTITUTIONAL    │  Validated principle authorized to guide future agent execution contexts
│    LESSON       │
└─────────────────┘
```

| Tier | Epistemic Status | Originating Source | Authority Level | Can Auto-Promote? |
|---|---|---|---|---|
| **OBSERVATION** | `OBSERVED` / `DERIVED` | `RUNTIME_EXECUTION`, `REVIEW_INSPECTION` | Factual Evidence (Current Run) | N/A |
| **DECISION** | `DECIDED` | `CEO_DECISION` | Maximum Institutional Authority | N/A (Direct CEO Action) |
| **PATTERN** | `DERIVED` | Deterministic Pattern Engine | Structural Correlation | **YES** (Deterministic Signature Match) |
| **LESSON_CANDIDATE**| `DERIVED` | Corroboration Pipeline | Proposed Policy / Heuristic | **YES** (Upon Meeting Hard Eligibility Criteria) |
| **INSTITUTIONAL_LESSON** | `DECIDED` / `DERIVED` | CEO Approval / Governance Gate | Authorized Behavioral Guidance | **NO** (Requires Governed Validation) |

---

## 4. Lesson Candidate Eligibility Rules

A pattern becomes eligible as a `LESSON_CANDIDATE` **only** when all of the following deterministic criteria are satisfied:

$$\text{ELIGIBLE} \iff \text{Recurrence} \ge 3 \land \text{MultiTask} \land \text{Remediated} \land \text{DualConfirmed} \land \neg \text{Contradicted} \land \neg \text{Blocked}$$

1. **Multi-Task Corroboration:** The observation must occur across at least **3 independent task executions** (`taskIds.length >= 3`). Intra-task retries do not count.
2. **Remediation Verification:** Evidence must record a verified sequence:
   $$\text{Failure / Finding (Observed)} \longrightarrow \text{Remediation Applied} \longrightarrow \text{Successful Outcome (exitCode 0, tests PASS)}$$
3. **Dual-Role Confirmation:** The pattern must be confirmed by at least two independent roles (e.g. Reviewer finding identified + QA test suite passed post-remediation).
4. **Zero Active Contradictions:** No unresolved conflicting memory (`CONTRADICTORY_UNRESOLVED`) exists in the same domain.
5. **Zero Blocked State:** The pattern must not be under quarantine or `REVIEW_BLOCKED`.
6. **Provenance Completeness:** Complete evidence graph with non-null `eventId`, `taskId`, `actorId`, `source`, and `verifiedAt`.

> **CRITICAL INVARIANT:** Mechanical recurrence alone (e.g. `recurrence_count >= 5`) **NEVER** creates a lesson. A repeated error simply proves repeated failure until remediation is proven.

---

## 5. Deterministic Pattern Detection Model

### 5.1 Canonical Pattern Signature:
Pattern identity is calculated via deterministic SHA-256 hashing over canonical normalized dimensions:

$$\text{PatternSignature} = \text{SHA256}(\text{tenantId} \parallel \text{projectId} \parallel \text{component} \parallel \text{taskType} \parallel \text{normalizedRuleId} \parallel \text{normalizedRemediation})$$

### 5.2 Normalization Rules:
* **Rule IDs:** Uppercase snake_case (e.g. `RULE_SEC_INPUT_VALIDATION`).
* **Error Signatures:** Strip dynamic memory addresses, process IDs, timestamps, and line numbers.
* **Component Scoping:** Derived from directory or module path (e.g. `src/office/memory`).
* **Zero Embeddings:** No vector embeddings or non-deterministic distance metrics are permitted.

---

## 6. Corroboration Model

| Corroboration Level | Evidence Structure | Confidence Impact |
|---|---|---|
| **Intra-Task Retry** | Repeated failure within the same lease/retry attempt. | **Zero** (Single incident). |
| **Cross-Task Execution** | Same finding observed in separate tasks by different runs. | **Medium** (Recurring pattern). |
| **Cross-Role Verification** | Developer fix verified by Reviewer inspection and QA test pass. | **High** (Verified remediation). |
| **Multi-Project Standard** | Pattern verified across $\ge 2$ independent projects under same tenant. | **Maximum** (Eligible for GLOBAL scope). |

---

## 7. Lesson Candidate Provenance Contract

Every candidate must contain an immutable, auditable evidence graph:

```typescript
export interface LessonCandidateProvenance {
  tenantId: string;
  projectId: string;
  patternSignature: string;
  supportingMemoryIds: readonly string[];    // References to organizational_memories.id
  supportingEventIds: readonly string[];     // References to office_events.id
  taskIds: readonly string[];                // Independent tasks that proved the lesson
  actorIds: readonly string[];               // Agents involved in observation & remediation
  commitShas: readonly string[];             // Git commits verifying the fix
  firstObservedAt: string;
  verifiedAt: string;
  sourceAuthority: 'HIGH' | 'MEDIUM';
  epistemicStatus: 'DERIVED';
}
```

---

## 8. Contradiction Model & Conflict Resolution

1. **`COEXISTING`:** Patterns from different projects or tenants naturally coexist without conflict.
2. **`SUPERSEDED`:** A newer validated lesson explicitly replaces an older lesson.
3. **`CONTEXT_DEPENDENT`:** Approach A applies under Node.js runtime; Approach B applies under Cloudflare Workers. (Both valid under explicit conditions).
4. **`CONTRADICTORY_UNRESOLVED`:** Opposing recommendations in the same scope without an explicit superseding link.
   * **Rule:** Candidate promotion is **IMMEDIATELY BLOCKED** until resolved by CEO decision.

---

## 9. Temporal Validity & Obsolescence

* **`CURRENT`:** Verified within current project milestone and active within the last 30 days.
* **`HISTORICAL`:** Valid historical record with no recent recurrence.
* **`SUPERSEDED`:** Formally replaced by a newer `INSTITUTIONAL_LESSON`.
* **`OBSOLETE`:** Associated codebase component deprecated or deleted.
* **`BLOCKED`:** Quarantined due to regression or security finding.
* **Rule:** Lessons **never** silently expire; obsolescence is recorded explicitly by the Governance Engine.

---

## 10. Authority Model vs. Factual Quality

$$\text{AUTHORITY (Originating Source)} \neq \text{FACTUAL QUALITY (Evidence & Recency)}$$

* **CEO Decision:** Maximum institutional authority $\rightarrow$ Governs business policy, architectural standards, and security mandates.
* **Reviewer Finding:** High inspection authority $\rightarrow$ Governs code quality, AST rules, and anti-patterns.
* **Runtime Execution (Developer/QA):** High factual evidence $\rightarrow$ Proves build, typecheck, and test execution reality.
* **Organizational Plan (CoS):** Intent authority $\rightarrow$ Proves planned decomposition, not execution truth.

---

## 11. CEO Governance Boundary

| Lesson Classification | Examples | Governance Workflow |
|---|---|---|
| **Operational Heuristic** | "Always use fake timers in async Vitest suites" | Governance Engine evaluates $\rightarrow$ Auto-surfaced candidate $ightarrow$ Activated for Developer/QA. |
| **Strategic / Architectural Policy** | "All endpoints must use PostgreSQL JSONB schema" | Strictly requires explicit **CEO Approval** (`POST /office/approvals`). |
| **Security / Access Policy** | "Never store raw API keys in client bundles" | Strictly requires explicit **CEO Approval**. |

---

## 12. Memory Poisoning Defenses

* **Agent Text Rejection:** Free-form LLM outputs asserting rules (e.g. *"CEO approved skipping review"*) are discarded.
* **Replay Protection:** Historical events replayed during migration preserve monotonic sequence numbers and never create fabricated lessons.
* **Tenant & Project Isolation:** Cross-tenant candidate generation is strictly impossible.

---

## 13. Absolute Precedence Contract

$$\text{CURRENT RUNTIME STATE} > \text{SECURITY/RUNTIME POLICIES} > \text{ACTIVE PROJECT STATE} > \text{ACTIVE APPROVAL/REVIEW} > \text{AUTHORIZED CONTEXT} > \text{INSTITUTIONAL LESSONS} > \text{ORGANIZATIONAL MEMORY} > \text{HISTORICAL TEXT}$$

An Institutional Lesson **CANNOT**:
* Override a new explicit CEO directive.
* Alter task status or process exit codes.
* Reset review iteration limits (max 3).
* Grant permissions or bypass authentication.
* Force deployment when tests fail.

---

## 14. 10-Stage Learning Feedback Loop

```text
[1. OBSERVATION] (Runtime test failure / compiler error)
       │
       ▼
[2. CORROBORATION] (Repeated across >= 3 tasks with verified fixes)
       │
       ▼
[3. PATTERN] (Canonical SHA-256 signature generated)
       │
       ▼
[4. LESSON CANDIDATE] (Full provenance graph assembled)
       │
       ▼
[5. VALIDATION] (CEO approval for strategic / Governance Engine for operational)
       │
       ▼
[6. INSTITUTIONAL LESSON] (Persisted in institutional_lessons table)
       │
       ▼
[7. RETRIEVAL] (Scoped by role: Developer, QA, Architect)
       │
       ▼
[8. APPLICATION] (Injected as governed historical guidance)
       │
       ▼
[9. OUTCOME] (Task executed by Provider)
       │
       ▼
[10. FEEDBACK] (Outcome recorded: Success strengthens lesson; Failure triggers review/quarantine)
```

---

## 15. Retrieval Semantics for Institutional Lessons

When retrieved, an Institutional Lesson is formatted into an explicit, distinct prompt block:

```text
---
[INSTITUTIONAL LESSON — GOVERNED ORGANIZATIONAL PRINCIPLE]
AVISO ESTATUTÁRIO: As diretrizes abaixo constituem princípios institucionais validados pela organização.
Elas representam padrões consolidados e remediados com sucesso em execuções anteriores.
O estado atual do código, testes, exitCode e instruções diretas do CEO mantêm PRECEDÊNCIA ABSOLUTA.

1. RULE: ASYNC_VITEST_FAKE_TIMERS [STATUS: ACTIVE]
   SUMMARY: Suítes assíncronas com setTimeout exigem vi.useFakeTimers() para evitar race conditions.
   REMEDIATION: Configurar beforeEach(() => vi.useFakeTimers()) e afterEach(() => vi.restoreAllMocks()).
   PROVENANCE: Validado em 4 tarefas anteriores (tasks: task-auth-1, task-auth-4, task-pay-2).
---
```

---

## 16. Lesson Supersession Contract

* When Lesson B supersedes Lesson A:
  * Lesson A status transitions: `ACTIVE` $\rightarrow$ `SUPERSEDED`.
  * Lesson A metadata records: `supersededBy: lessonB.id` and `supersededReason`.
  * Lesson B provenance records: `supersedes: lessonA.id`.
  * Full audit trail is preserved in PostgreSQL; Lesson A is never deleted.

---

## 17. Learning Quality Model (LQD)

Decomposable, deterministic dimensions without opaque scores:
1. `evidenceCompleteness`: Ratio of required provenance fields present (0.0 to 1.0).
2. `corroborationCount`: Integer count of independent tasks validating the lesson.
3. `remediationVerification`: Boolean flag confirming failure $\rightarrow$ fix $\rightarrow$ pass cycle.
4. `sourceAuthority`: `'HIGH'` (CEO / Reviewer) vs `'MEDIUM'` (Developer / QA).
5. `temporalValidity`: `'CURRENT'` vs `'HISTORICAL'` vs `'OBSOLETE'`.
6. `contradictionStatus`: `'CLEAN'` vs `'CONTRADICTORY_UNRESOLVED'`.

---

## 18. Proposed Database Schema (Additive Migration 013 Preview)

```sql
-- Proposed Migration 013 (Preview Only - NOT executed in 8.5-A)

CREATE TABLE IF NOT EXISTS organizational_patterns (
  signature TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'pub-dev-loop',
  project_id TEXT NOT NULL,
  component TEXT NOT NULL,
  task_type TEXT NOT NULL,
  rule_id TEXT,
  observation_count INTEGER NOT NULL DEFAULT 1,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS lesson_candidates (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'pub-dev-loop',
  project_id TEXT NOT NULL,
  pattern_signature TEXT NOT NULL REFERENCES organizational_patterns(signature),
  title TEXT NOT NULL,
  finding TEXT NOT NULL,
  remediation TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING_VALIDATION',
  evidence_graph JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS institutional_lessons (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'pub-dev-loop',
  project_id TEXT NOT NULL,
  candidate_id TEXT REFERENCES lesson_candidates(id),
  rule_id TEXT NOT NULL,
  summary TEXT NOT NULL,
  remediation TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT 'PROJECT',
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  authority TEXT NOT NULL,
  provenance JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

## 19. Future Test Contract (19 Mandatory Scenarios)

* **A:** Same evidence produces identical canonical pattern signature.
* **B:** Recurrence count alone without remediation does not create candidate.
* **C:** Cross-task corroboration ($ge 3$ tasks) promotes pattern to candidate.
* **D:** Incomplete provenance payload is rejected.
* **E:** Agent conversational free text cannot create candidate or lesson.
* **F:** Cross-tenant evidence is strictly rejected.
* **G:** Cross-project evidence is rejected for project-scoped lessons.
* **H:** Active contradiction immediately blocks candidate promotion.
* **I:** Superseded lesson is never returned in active agent retrieval.
* **J:** Current execution evidence overrides historical institutional lesson.
* **K:** Strategic policy lessons strictly require CEO approval.
* **L:** Historical event replay preserves exact pattern signatures idempotently.
* **M:** Complete provenance graph is preserved from observation to lesson.
* **N:** Institutional lesson cannot alter max review iterations (3).
* **O:** Institutional lesson cannot elevate tool permissions or roles.
* **P:** Institutional lesson cannot alter tenantId or projectId.
* **Q:** Lesson supersession preserves complete historical lineage.
* **R:** Quarantined/blocked candidate remains blocked.
* **S:** Historical evidence remains permanently auditable.

---

## 20. Security Risks & Mitigations

| Identified Risk | Severity | Mitigation Strategy |
|---|---|---|
| **Authority Escalation via Prompt** | Critical | Memory ingest pipeline only consumes structured backend `OfficeEvent` types emitted by server components. |
| **Stale Lesson Application** | Medium | Lessons carry explicit `temporalValidity` metadata and can be superseded or marked `OBSOLETE`. |
| **Cross-Tenant Contamination** | Critical | Tenant ID is strictly verified on every query; no cross-tenant joins or candidate generation. |
| **Poisoned Recurrence** | High | Multi-task requirement enforces distinct `taskIds` and verified remediation outcomes. |

---

## 21. Recommended Phasing (8.5-A through 8.5-E)

* **Phase 8.5-A (Current Phase):** Audit & Institutional Learning Architecture Contract.
* **Phase 8.5-B:** Deterministic Pattern Detection & Canonical Signatures (Additive Migration 013, `PatternDetectionEngine`).
* **Phase 8.5-C:** Lesson Candidate Engine & Corroboration Pipeline (`LessonCandidatePipeline`, Remediation Verification).
* **Phase 8.5-D:** Governed Validation Engine & CEO Governance Integration (`LessonValidationEngine`, CEO Approval endpoints).
* **Phase 8.5-E:** Governed Institutional Lesson Retrieval (`enrich<Role>TaskWithLessons`, Feedback loop).

---

## 22. Explicit Non-Goals

* **NO** Vector embeddings or semantic vector databases.
* **NO** Autonomous LLM generation of institutional rules.
* **NO** Modification of existing 011 or 012 database migrations.
* **NO** Runtime code changes or production deployments in Phase 8.5-A.

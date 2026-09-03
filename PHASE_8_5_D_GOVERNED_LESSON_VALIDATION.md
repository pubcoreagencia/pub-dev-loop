# PDL — PHASE 8.5-D: GOVERNED LESSON VALIDATION & CEO GOVERNANCE

## 1. Executive Summary & Objective

Phase 8.5-D implements the official **Governed Lesson Validation Engine & CEO Governance Integration** for the PUB DEV LOOP Organizational Memory Engine.

### Core Invariant:
> **INSTITUTIONAL_LESSON IS CREATED ONLY THROUGH AN EXPLICIT GOVERNED VALIDATION PATH.**
> No candidate may become an institutional lesson merely because recurrence is high or an agent recommends it.
> Strategic, Architectural, and Security lessons, as well as Global scope promotions, strictly require **Authoritative CEO Approval**.

---

## 2. Implemented Components

### 2.1 Additive Database Migration (`db/migrations/015_institutional_lessons.sql`)
* **Table `institutional_lessons`:**
  * Fields: `id`, `tenant_id`, `project_id`, `candidate_id`, `status` (`ACTIVE`, `SUPERSEDED`, `BLOCKED`, `REVOKED`), `title`, `statement`, `scope` (`GLOBAL`, `PROJECT`, `AGENT`, `TASK`), `lesson_type` (`OPERATIONAL_GUIDANCE`, `TESTING_GUIDANCE`, `ARCHITECTURE_GUIDANCE`, `SECURITY_GUIDANCE`, `STRATEGIC_GUIDANCE`), `source_candidate_ids`, `supporting_pattern_ids`, `supporting_memory_ids`, `supporting_event_ids`, `supporting_task_ids`, `provenance`, `governance`, `validation`, `temporal_validity`, `superseded_by`, `created_at`, `validated_at`, `updated_at`.
  * Unique Constraint: `UNIQUE (tenant_id, project_id, candidate_id)`.

### 2.2 Governance Matrix & Classification (`src/office/lesson-validation.ts`)
| Lesson Type | Default Scope | Validation Method | CEO Approval Required? |
|---|---|---|---|
| **OPERATIONAL_GUIDANCE** | `PROJECT` / `AGENT` | Deterministic Governance Validation | **NO** (Operational) |
| **TESTING_GUIDANCE** | `PROJECT` / `AGENT` | Deterministic Governance Validation | **NO** (Context-Specific) |
| **ARCHITECTURE_GUIDANCE** | `PROJECT` / `GLOBAL` | Executive CEO Approval | **YES** |
| **SECURITY_GUIDANCE** | `PROJECT` / `GLOBAL` | Executive CEO Approval | **YES** |
| **STRATEGIC_GUIDANCE** | `GLOBAL` | Executive CEO Approval | **YES** |
| **ANY GLOBAL SCOPE** | `GLOBAL` | Executive CEO Approval | **YES** |

### 2.3 Authoritative CEO Authentication & Protection
* Relies on the authoritative authentication engine in `src/office/auth.ts` (`authenticateOfficeRequest`).
* Forged headers (e.g. `x-user-role: CEO`) or body parameters are strictly rejected; only authenticated CEO credentials grant approval permissions.
* Cross-tenant approval attempts are rejected with `TENANT_MISMATCH`.

### 2.4 Supersession & Lifecycle Management
* Supersession of strategic, architectural, and security lessons strictly requires CEO authorization.
* Revoked and superseded lessons remain in PostgreSQL with full audit trails and are never silently overwritten or deleted.

---

## 3. Test Coverage (`tests/office-lesson-validation.test.ts`)

1. **A & B:** Ineligible candidates cannot validate; eligible candidates proceed.
2. **C, D & E:** Missing provenance or unresolved contradictions block validation.
3. **G, H, I & J:** Authoritative CEO authentication: forged headers fail; non-CEO approval rejected.
4. **K & L:** Cross-tenant approval attempts are strictly rejected.
5. **M, N, O & P:** Governance Matrix enforcement (Security, Architecture, Global require CEO).
6. **V, W & AP:** Superseded and revoked lessons remain auditable in the database.
7. **AM, AN & AO:** Executive supersession of security and architecture lessons requires CEO.

---

## 4. Explicit Non-Goals & Invariants

* **NO** `INSTITUTIONAL_LESSON` retrieval enabled yet (deferred to Phase 8.5-E).
* **NO** Vector embeddings or vector search.
* **NO** LLM classification or summarization.
* **NO** Modification of `MAX_REVIEW_ITERATIONS = 3`.
* **NO** Client-provided or unverified provenance.

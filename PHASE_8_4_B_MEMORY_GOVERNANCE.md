# PDL — PHASE 8.4-B: MEMORY GOVERNANCE FOUNDATION

## 1. Executive Summary & Objective

Phase 8.4-B implements the official **Memory Governance Foundation** for the PUB DEV LOOP Organizational Memory Engine.

Building upon the 5 integrated agent roles (Developer, Architect, Reviewer, QA Engineer, Chief of Staff), this phase introduces strict lifecycle state validation, safe supersession rules, deterministic deduplication, hardened replay idempotency, objective quality metadata, and protection against memory poisoning.

---

## 2. Implemented Governance Components

### 1. Memory Governance Engine (`src/office/memory-governance.ts`)
* **State Machine Validation (`validateStatusTransition`):**
  * Allowed: `ACTIVE` $\rightarrow$ `SUPERSEDED` (requires `supersededBy` ID), `ACTIVE` $\rightarrow$ `BLOCKED` (requires trigger reason).
  * Disallowed: Silent reactivation (`SUPERSEDED` $\rightarrow$ `ACTIVE` or `BLOCKED` $\rightarrow$ `ACTIVE`) without explicit admin authorization.
  * Disallowed: Redundant transitions (`SUPERSEDED` $\rightarrow$ `SUPERSEDED`, `BLOCKED` $\rightarrow$ `BLOCKED`).
* **Supersession Hardening (`validateSupersession`):**
  * Enforces same-tenant and same-project validation.
  * Rejects cross-tenant and cross-project supersession.
  * Rejects self-supersession (`oldId === newId`).
  * Enforces that both old and new memories must be in `ACTIVE` state.
* **Objective Memory Quality Metadata (`computeQualityMetadata`):**
  * Decomposable components: `provenanceCompleteness` (0.0 to 1.0), `sourceAuthority` (`HIGH` | `MEDIUM` | `LOW`), `recurrenceCount`, `temporalValidity` (`CURRENT` | `HISTORICAL` | `OBSOLETE`).
  * Strictly separates source authority from factual recency/quality.
* **Contradiction Safety (`analyzeContradiction`):**
  * Classifies relations as `COEXISTING`, `SUPERSEDED`, or `CONTRADICTORY_UNRESOLVED`.
  * Guarantees that unresolved contradictions **never** auto-supersede or change memory state without verified authority.
* **Memory Poisoning Guard (`validateUntrustedClaim`):**
  * Rejects conversational claims from untrusted actors attempting to formulate `DECISION` or `LESSON` memories without verified backend `OfficeEvent` sources.

### 2. Store & Ingest Hardening (`src/office/memory.ts`)
* **Replay & Ingest Idempotency:** When re-ingesting existing events during replay, if an existing memory is `SUPERSEDED` or `BLOCKED`, its status is **preserved** and never resurrected back to `ACTIVE`.
* **Automatic Governance Metadata:** Every newly created memory receives structured `metadata.quality` computed deterministically.

### 3. Database Governance Migration (`db/migrations/012_memory_governance.sql`)
* Adds performance indexes for governance filtering (`tenant_id, project_id, status, type`), supersession lookups (`supersededBy`), and temporal recency sorting.

---

## 3. Mandatory Test Coverage (`tests/office-memory-governance.test.ts`)

1. **A & B:** Valid `ACTIVE` $\rightarrow$ `SUPERSEDED` and `ACTIVE` $\rightarrow$ `BLOCKED` transitions.
2. **C & D:** Rejection of silent reactivation for `SUPERSEDED` and `BLOCKED` records.
3. **E & F:** Rejection of cross-tenant, cross-project, and self supersession.
4. **G & H:** Replay idempotency and preservation of `SUPERSEDED` status during re-ingest.
5. **I:** Recurrence semantics incrementing on duplicate normalized keys without row explosion.
6. **J:** Strict provenance enforcement rejecting incomplete payloads.
7. **K:** Memory poisoning protection against agent claims of CEO approval.
8. **L & M:** Agent retrieval safety strictly excluding `SUPERSEDED` and `BLOCKED` memories.
9. **N & O:** Objective quality metadata and authority separation.
10. **P:** Contradiction safety ensuring unresolved contradictions do not auto-supersede.

---

## 4. Explicit Non-Goals & Invariants

* **NO** Vector embeddings or vector search.
* **NO** Autonomous LLM lesson generation.
* **NO** Silent mutation of operational states.
* **NO** Modification of core planning, review, or approval architectures.

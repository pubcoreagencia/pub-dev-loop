# PDL — PHASE 8.5-C: LESSON CANDIDATE ENGINE & CORROBORATION PIPELINE

## 1. Executive Summary & Objective

Phase 8.5-C implements the **Lesson Candidate Engine & Corroboration Pipeline** for the PUB DEV LOOP Organizational Memory Engine, strictly following the architecture contract established in Phase 8.5-A.

### Core Invariant:
> **A LESSON_CANDIDATE IS NOT AN INSTITUTIONAL LESSON.**
> Candidate generation is an auditable derivation of hypotheses from corroborated patterns.
> It does **NOT** institutionalize knowledge, does **NOT** inject candidates into agent prompt context or retrieval, and does **NOT** modify CEO approvals, review guardrails, or runtime permissions.

---

## 2. Implemented Components

### 2.1 Additive Database Migration (`db/migrations/014_lesson_candidates.sql`)
* **Table `lesson_candidates`:**
  * Fields: `id`, `tenant_id`, `project_id`, `pattern_id`, `candidate_key`, `status` (`PROPOSED`, `ELIGIBLE`, `BLOCKED`, `REJECTED`, `SUPERSEDED`), `title`, `statement`, `scope` (`PROJECT`, `AGENT`, `TASK`), `candidate_type`, `supporting_pattern_ids`, `supporting_memory_ids`, `supporting_event_ids`, `supporting_task_ids`, `supporting_agent_ids`, `evidence`, `corroboration`, `remediation`, `contradiction_status`, `provenance`, `eligibility`, `requires_ceo_approval`, `rejection_reason`, `created_at`, `updated_at`.
  * Unique Constraint: `UNIQUE (tenant_id, project_id, candidate_key)`.

### 2.2 Statement Safety & Eligibility Evaluation (`src/office/lesson-candidate.ts`)
* **Safe Statement Generator (`generateSafeCandidateStatement`):**
  * Produces factual, evidence-bounded statements:
    `"Observação verificada em ${component} (Regra: ${ruleId}): identificada em ${taskCount} tarefas independentes com remediação."`
  * Never generates overclaiming statements (e.g. "Always do X" or "CEO approved X").
* **Deterministic Eligibility Engine (`evaluateCandidateEligibility`):**
  * `isEligible = true` requires:
    1. Multi-Task Corroboration: `independentTaskCount >= 3`.
    2. Remediation Verification: `remediationVerifiedCount >= 1`.
    3. Dual-Role Confirmation: `reviewerConfirmedCount >= 1` or `qaConfirmedCount >= 1`.
    4. Zero Contradictions: `contradiction_status !== 'CONTRADICTORY_UNRESOLVED'`.
    5. Clean Status: Pattern not `BLOCKED` or `REJECTED`.
    6. Complete Provenance Graph.

### 2.3 Candidate Engine Lifecycle (`src/office/lesson-candidate.ts`)
* **Deterministic Upserting (`evaluateAndUpsertCandidate`):**
  * Computes deterministic candidate key: `${tenantId}:${projectId}:${pattern.signature}`.
  * Preserves candidate identity on replay (idempotent).
  * Automatically flags `requiresCEOApproval = true` for `ARCHITECTURE_GUIDANCE` and `SECURITY_GUIDANCE`.
  * Preserves `REJECTED` and `BLOCKED` states without silent auto-reactivation.

---

## 3. Test Coverage (`tests/office-lesson-candidate.test.ts`)

1. **A & B:** Patterns with <3 tasks remain `PROPOSED`; $ge 3$ independent tasks become `ELIGIBLE`.
2. **C:** Retry isolation: 3 retries of a single task keep `independentTaskCount = 1` and non-eligible.
3. **D, E & F:** Missing remediation or missing review/QA confirmation blocks eligibility.
4. **O:** Contradictions (`CONTRADICTORY_UNRESOLVED`) block promotion to `ELIGIBLE`.
5. **Q & R:** Statement safety and `DERIVED` epistemic status.
6. **S, T & U:** Deterministic idempotency and replay preservation.
7. **V & W:** `REJECTED` or `BLOCKED` candidates do not silently reactivate.
8. **X, Y, Z, AA & AB:** Absolute isolation: zero modifications to review limits, approvals, or runtime.

---

## 4. Explicit Non-Goals & Invariants

* **NO** `INSTITUTIONAL_LESSON` generated.
* **NO** Vector embeddings or vector search.
* **NO** LLM classification or candidate summarization.
* **NO** Agent retrieval or prompt enrichment changes.
* **NO** Alterations to `MAX_REVIEW_ITERATIONS = 3` or CEO approval workflows.

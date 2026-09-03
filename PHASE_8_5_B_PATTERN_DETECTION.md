# PDL — PHASE 8.5-B: DETERMINISTIC PATTERN DETECTION

## 1. Executive Summary & Objective

Phase 8.5-B implements the official **Deterministic Pattern Detection Engine** for the PUB DEV LOOP Organizational Memory Engine, in strict compliance with the architecture contract defined in Phase 8.5-A.

### Core Invariant:
> **PATTERN DETECTION IS NOT LEARNING PROMOTION.**
> A detected pattern is historical derived evidence only.
> It does **NOT** generate `LESSON_CANDIDATE` or `INSTITUTIONAL_LESSON`, does **NOT** alter agent prompt contexts, and does **NOT** mutate approval or review workflows.

---

## 2. Implemented Components

### 2.1 Additive Database Migration (`db/migrations/013_organizational_patterns.sql`)
* **Table `organizational_patterns`:**
  * Fields: `id`, `tenant_id`, `project_id`, `signature`, `status` (`ACTIVE`, `SUPERSEDED`, `BLOCKED`), `component`, `task_type`, `rule_id`, `remediation_signature`, `recurrence_count`, `supporting_memory_ids`, `supporting_event_ids`, `supporting_task_ids`, `supporting_agent_ids`, `corroboration`, `first_observed_at`, `last_observed_at`, `metadata`, `provenance`, `created_at`, `updated_at`.
  * Unique constraint: `UNIQUE (tenant_id, project_id, signature)`.

### 2.2 Canonicalization & Signature Algorithm (`src/office/pattern-detection.ts`)
* **Normalization (`normalizeFindingText`):**
  * Strips dynamic ISO timestamps and epoch timestamps.
  * Strips process IDs (`[pid: 1234]`).
  * Normalizes temporary and absolute filesystem paths (`C:\Users\...`, `/tmp/...`).
  * Normalizes line and column coordinates (`:line`).
  * Preserves semantic rule codes (`RULE_SEC_SQL`, error codes).
* **Deterministic SHA-256 Signature (`computePatternSignature`):**
  $$\text{Signature} = \text{SHA256}(\text{tenantId} \parallel \text{projectId} \parallel \text{component} \parallel \text{taskType} \parallel \text{ruleId} \parallel \text{normalizedFinding} \parallel \text{normalizedRemediation})$$

### 2.3 Pattern Detection Engine (`src/office/pattern-detection.ts`)
* Ingests only trusted backend events (`REVIEW_FINDING`, `REVIEW_BLOCKED`, `AGENT_FINISHED_WORK`, `AGENT_FAILED_WORK`).
* Discards untrusted agent conversational claims or free-text assertions.
* Manages multi-dimensional corroboration metrics:
  * `observationCount` (total observations)
  * `independentTaskCount` (unique task IDs)
  * `independentAgentCount` (unique agent IDs)
  * `reviewerConfirmedCount` (verified by Reviewer)
  * `qaConfirmedCount` (verified by QA)
  * `remediationVerifiedCount` (verified structured remediation success)
* Preserves `BLOCKED` and `SUPERSEDED` states on replay.

---

## 3. Test Coverage (`tests/office-pattern-detection.test.ts`)

1. **A:** Identical structured observations generate identical signatures.
2. **B & C:** Casing and whitespace normalization.
3. **D:** Dynamic timestamp normalization.
4. **E & F:** PID and filesystem path normalization.
5. **G:** Meaningful identifier and rule ID preservation.
6. **H:** Distinct errors produce distinct signatures without collision.
7. **I:** Retry isolation (same task retry does not inflate `independentTaskCount`).
8. **J & K:** Cross-task and cross-agent corroboration increment counts.
9. **L & M:** Multi-tenant and project isolation.
10. **N & O:** Recurrence does NOT create Lesson or Lesson Candidate.
11. **P & Q:** Free text and fake CEO claims rejected.
12. **R & S:** Remediation verification requires structured evidence.
13. **T & U:** Replay idempotency and provenance preservation.
14. **V:** Blocked pattern preservation.
15. **W:** Contradiction preservation without auto-resolution.
16. **X, Y, Z & AA:** Safety and non-interference with approvals and review guardrails.

---

## 4. Explicit Non-Goals & Invariants

* **NO** `LESSON_CANDIDATE` generated.
* **NO** `INSTITUTIONAL_LESSON` generated.
* **NO** Vector embeddings or semantic vector search.
* **NO** LLM classification or summarization.
* **NO** Agent prompt context or retrieval changes.
* **NO** Changes to CEO approvals or review iteration limits.

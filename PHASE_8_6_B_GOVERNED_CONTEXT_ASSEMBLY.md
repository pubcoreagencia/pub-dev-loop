# PDL — PHASE 8.6-B: GOVERNED CONTEXT ASSEMBLY

## 1. Executive Summary & Objective

Phase 8.6-B implements the official, typed, deterministic and governed **Context Assembly Engine** (`src/office/context-assembly.ts`) for the five THE OFFICE agent roles:
1. `chief-of-staff`
2. `architect`
3. `developer`
4. `reviewer`
5. `qa-engineer`

### Fundamental Authority Precedence:
$$\text{CURRENT EVIDENCE} > \text{GOVERNED INSTITUTIONAL LESSONS} > \text{HISTORICAL ORGANIZATIONAL MEMORY}$$

---

## 2. Core Architecture & Types (`src/office/context-assembly.ts`)

### 2.1 Context Authority
* **`CURRENT`**: CEO Objective, Current Project State, Current Task, Runtime Evidence (exit code, stdout/stderr), Review Evidence, QA Test Evidence, Security Findings, Current Dependencies.
* **`GOVERNED`**: Active Institutional Lessons (`InstitutionalLesson` from Migration 015, validated and advisory).
* **`HISTORICAL`**: Verified Organizational Memories (`OrganizationalMemory` from Migration 011/012, consultative).

### 2.2 Role Profiles & Source Prioritization
Deterministic configuration defining priority and allowed sources per role:
* **Chief of Staff:** `CEO_OBJECTIVE` (100) > `PROJECT_STATE` (90) > `CURRENT_TASK` (80) > `RUNTIME_EVIDENCE` (70) > `INSTITUTIONAL_LESSON` (30) > `ORGANIZATIONAL_MEMORY` (10).
* **Architect:** `PROJECT_STATE` (95) > `CURRENT_TASK` (90) > `RUNTIME_EVIDENCE` (80) > `SECURITY_EVIDENCE` (75) > `REVIEW_EVIDENCE` (70) > `INSTITUTIONAL_LESSON` (30) > `ORGANIZATIONAL_MEMORY` (10).
* **Developer:** `CURRENT_TASK` (100) > `RUNTIME_EVIDENCE` (90) > `PROJECT_STATE` (80) > `REVIEW_EVIDENCE` (75) > `QA_EVIDENCE` (70) > `INSTITUTIONAL_LESSON` (30) > `ORGANIZATIONAL_MEMORY` (10).
* **Reviewer:** `CURRENT_TASK` (100) > `REVIEW_EVIDENCE` (95) > `SECURITY_EVIDENCE` (90) > `RUNTIME_EVIDENCE` (85) > `INSTITUTIONAL_LESSON` (30) > `ORGANIZATIONAL_MEMORY` (10).
* **QA Engineer:** `CURRENT_TASK` (100) > `QA_EVIDENCE` (95) > `RUNTIME_EVIDENCE` (90) > `REVIEW_EVIDENCE` (80) > `INSTITUTIONAL_LESSON` (30) > `ORGANIZATIONAL_MEMORY` (10).

### 2.3 Context Budgets & Truncation Hierarchy
* **Budgets:**
  * `currentContextMaxChars`: 10,000 characters.
  * `governedContextMaxChars`: 2,000 characters.
  * `historicalContextMaxChars`: 2,000 characters.
  * `totalContextMaxChars`: 15,000 characters.
* **Truncation Hierarchy:**
  When budget is constrained:
  1. `HISTORICAL` memory blocks are truncated/dropped first.
  2. `GOVERNED` institutional lessons are truncated next.
  3. `CURRENT` task instructions and runtime evidence are strictly preserved.

### 2.4 Deduplication & Security
* Deduplication by unique Block ID / Provenance ID.
* Untrusted authority claims (e.g., free text asserting "CEO approved" or "security override") are flagged in diagnostics (`UNTRUSTED_AUTHORITY_CLAIM`) and grant zero authority.
* Multi-tenant isolation: Cross-tenant memories or lessons are excluded during assembly.

---

## 3. Test Coverage (`tests/office-context-assembly.test.ts`)

1. **Deterministic Assembly:** Identical inputs yield identical prompt outputs.
2. **Authority Ordering:** Proves `CURRENT > GOVERNED > HISTORICAL`.
3. **CEO Objective Precedence:** CEO objective strictly precedes tasks and historical memories for Chief of Staff.
4. **Truncation & Budgets:** Proves historical memory truncates first, preserving current task prompt.
5. **Deduplication:** Proves duplicate blocks are deduplicated.
6. **Security:** Proves forged authority text generates diagnostics without privilege elevation.
7. **Tenant Isolation:** Proves foreign tenant data is filtered out.

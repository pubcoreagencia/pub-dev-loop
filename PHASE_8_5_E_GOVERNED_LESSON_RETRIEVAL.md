# PDL — PHASE 8.5-E: GOVERNED INSTITUTIONAL LESSON RETRIEVAL & AGENT CONTEXT INTEGRATION

## 1. Executive Summary & Objective

Phase 8.5-E implements the official **Governed Institutional Lesson Retrieval Engine & Agent Context Integration** for the PUB DEV LOOP workforce (Chief of Staff, Architect, Developer, Reviewer, QA Engineer).

### Core Precedence Invariant:
> **CURRENT RUNTIME STATE > CURRENT TASK EVIDENCE > CURRENT REVIEW/SECURITY EVIDENCE > GOVERNED INSTITUTIONAL LESSONS > HISTORICAL MEMORY**
> Institutional Lessons are strictly **ADVISORY CONTEXT**.
> They NEVER constitute authority to mutate runtime state, override test execution findings, bypass review guardrails (`MAX_REVIEW_ITERATIONS = 3`), or auto-approve tasks.

---

## 2. Implemented Architecture

### 2.1 Governed Retrieval Engine (`src/office/lesson-retrieval.ts`)
* **Strict Filtering & Security:**
  * Multi-Tenant Isolation: `tenantId` is mandatory. Cross-tenant retrieval is strictly impossible.
  * Status Filter: Only `ACTIVE` lessons are returned. `SUPERSEDED`, `BLOCKED`, `REVOKED`, and `OBSOLETE` are excluded.
  * Scope Routing: Resolves `TASK`, `AGENT`, `PROJECT`, and `GLOBAL` scopes deterministically.
* **Deterministic Ranking (Zero LLM / Zero Embeddings):**
  * Scope Hierarchy: `TASK` (+40), `AGENT` (+30), `PROJECT` (+20), `GLOBAL` (+10).
  * Role Alignment:
    * **Developer:** `OPERATIONAL_GUIDANCE` (+5), `TESTING_GUIDANCE` (+4).
    * **Architect:** `ARCHITECTURE_GUIDANCE` (+5), `STRATEGIC_GUIDANCE` (+4).
    * **Reviewer:** `SECURITY_GUIDANCE` (+5), `OPERATIONAL_GUIDANCE` (+4).
    * **QA Engineer:** `TESTING_GUIDANCE` (+5), `OPERATIONAL_GUIDANCE` (+4).
    * **Chief of Staff:** `STRATEGIC_GUIDANCE` (+5), `ARCHITECTURE_GUIDANCE` (+4).
  * Tie-breaking: `validatedAt` (descending) followed by `id` (ascending).
* **Hard Limits:**
  * Maximum 5 lessons per retrieval.
  * Maximum 500 characters of aggregated statement text.
  * Strict deduplication by `id`.

### 2.2 Advisory Formatting (`formatInstitutionalLessonContext`)
* Injects an explicit statutory advisory notice into prompts:
  ```markdown
  ---
  [GOVERNED INSTITUTIONAL LESSONS — ADVISORY CONTEXT]
  AVISO ESTATUTÁRIO: As diretrizes abaixo representam lições organizacionais validadas e governadas.
  Elas constituem contexto consultivo e histórico, NÃO constituindo instrução imperativa ou autorização de mudança.
  O estado atual da tarefa, código, evidências de teste/review e o objetivo do CEO têm PRECEDÊNCIA ABSOLUTA.
  ```

### 2.3 Integrated Workforce Enrichment (`src/office/memory.ts`)
* Fully integrated across all 5 organizational agent roles:
  1. `enrichDeveloperTaskWithMemory`
  2. `enrichArchitectTaskWithMemory`
  3. `enrichReviewerTaskWithMemory`
  4. `enrichQaTaskWithMemory`
  5. `enrichChiefOfStaffTaskWithMemory`
* **Failure Isolation:** Any retrieval issue (DB timeout/network blip) fails gracefully without blocking primary agent execution.

---

## 3. Test Coverage (`tests/office-lesson-retrieval.test.ts`)

1. **A, B, C & D:** Retrieves `ACTIVE` lessons; excludes `SUPERSEDED`, `BLOCKED`, `REVOKED`.
2. **E:** Multi-tenant boundaries: cross-tenant access returns empty array.
3. **H, I & J:** Scope filtering (`GLOBAL`, `PROJECT`, `AGENT`, `TASK`).
4. **K, L & N:** Deterministic ranking, deduplication, and max 5 limit.
5. **O & Q:** Advisory context formatting and strictly read-only retrieval.
6. **Agent Integration:** All 5 agents safely enrich prompts with governed lessons.

---

## 4. Explicit Confirmations & Non-Goals

* **NO** Vector embeddings, vector database, or semantic search.
* **NO** LLM used for ranking or filtering.
* **NO** Alterations to review guardrails (`MAX_REVIEW_ITERATIONS = 3` strictly preserved).
* **NO** Alterations to CEO approvals or runtime authorization.
* **NO** Cross-tenant retrieval.

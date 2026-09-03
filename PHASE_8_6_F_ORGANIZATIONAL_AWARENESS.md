# PDL — PHASE 8.6-F: ORGANIZATIONAL AWARENESS

## 1. Executive Summary & Objective

Phase 8.6-F implements the **Organizational Awareness** layer for THE OFFICE.
It enables the CEO and Chief of Staff to perceive and observe the complete state of the organization (health, active risks, temporal delivery/quality trends, operational bottlenecks, workforce distribution, observed facts, and advisory recommendations) directly within the spatial and interactive office interface without converting the office into a traditional BI dashboard.

### Core Principle:
> **OFFICE FIRST • NOT DASHBOARD FIRST**
> The office remains the primary medium: CEO walks the office floor, observes specialist agents at desks, converses via Global Chat, and inspects activity.
> Organizational awareness acts as an observational consciousness over this live spatial workplace.

---

## 2. Implemented Architecture

### 2.1 Contracts & Types (`src/office/organizational-awareness.ts`)
* **`OrganizationAwareness`**: Unified diagnostic model for the office interface.
* **`AwarenessPulse`**: Compact pulse badge (`HEALTHY`, `ATTENTION`, `AT_RISK`, `BLOCKED`, `UNKNOWN`) with color indicators.
* **`AwarenessHealth`**: Empirical operational summary (success rate, failure rate, task status breakdown).
* **`AwarenessRisk`**: Auditable active risks with severity and confidence metrics.
* **`AwarenessTrend`**: Temporal trend analysis (`IMPROVING`, `STABLE`, `DEGRADING`, `VOLATILE`, `UNKNOWN`).
* **`AwarenessBottleneck`**: Flow bottlenecks formatted as organizational signals without individual employee blame.
* **`AwarenessAgentLoad`**: Distribution of work across all 5 workforce roles without ranking or individual scores.
* **`AwarenessInsight`**: Strict separation between `OBSERVED` empirical facts and `INFERRED` causal insights.
* **`AwarenessRecommendation`**: Strictly advisory recommendations where `requiresHumanDecision = true`.
* **`AwarenessMetadata`**: Tenant/project isolation provenance and read-only flags.

### 2.2 Endpoints (`src/api.ts` & `src/api-worker.ts`)
* **`GET /office/awareness`** (and alias `GET /office/intelligence`):
  * Strictly authenticated via `authenticateOfficeRequest`.
  * Scoped to `tenantId` and `projectId`.
  * Read-only: zero mutations, zero task creation, zero autonomous loops.
  * Resilient DB failure isolation.

### 2.3 Frontend Integration (`frontend/src/`)
* **`OfficeHeader.tsx`**: Added interactive Organization Pulse badge (`ORGANIZAÇÃO: ● HEALTHY / ATTENTION / AT RISK / BLOCKED / UNKNOWN`).
* **`AwarenessPanel.tsx`**: Discreet, accessible, vintage-styled modal overlay over the office canvas.
* **`useStore.ts`**: Integrated awareness state management and adaptive polling.

---

## 3. Strict Safety Invariants Preserved

1. **Source Precedence:**
   $$\text{CURRENT RUNTIME} > \text{EXECUTION OUTCOME} > \text{REVIEW OUTCOME} > \text{QA OUTCOME} > \text{FEEDBACK SIGNAL} > \text{PATTERNS} > \text{LESSONS} > \text{HISTORICAL MEMORY}$$
2. **Zero Autonomous Execution:** All recommendations remain strictly advisory with `requiresHumanDecision: true`.
3. **Zero Governance Mutation:** Discovering critical risks does not bypass approvals or alter review guardrails (`MAX_REVIEW_ITERATIONS = 3`).
4. **Zero Employee Blame:** Bottlenecks are diagnosed as organizational flow constraints rather than individual incompetence.
5. **No Ranking / Leaderboards:** Workforce metrics show task distribution without employee ranking.
6. **Multi-Tenant & Project Isolation:** Strict boundary filtering ensures foreign tenant data is never leaked.
7. **No Fake Activity:** All metrics, trends, and signals are derived exclusively from actual empirical execution data.

---

## 4. Test Matrix & Results (`tests/office-organizational-awareness.test.ts`)

* **New Tests:** 45 deterministic tests.
* **Total Project Tests:** 484/484 tests passing across 39 test suites.
* **Coverage:**
  * Authentication & Authorization (401 on missing auth, 200 on valid principal).
  * Tenant & Project Isolation.
  * Health states (`HEALTHY`, `ATTENTION`, `AT_RISK`, `BLOCKED`, `UNKNOWN`).
  * Risk and Bottleneck rendering.
  * Trend analysis (`IMPROVING`, `STABLE`, `DEGRADING`, `UNKNOWN`).
  * Workforce visibility across all 5 canonical roles.
  * Separation of OBSERVED vs INFERRED.
  * Advisory recommendation safety (`requiresHumanDecision: true`).
  * Idempotency, provenance, and data minimization.

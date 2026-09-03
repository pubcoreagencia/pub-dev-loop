# PDL — PHASE 8.6-E: ORGANIZATIONAL INTELLIGENCE

## 1. Executive Summary & Objective

Phase 8.6-E implements the deterministic and governed **Organizational Intelligence Engine** (`src/office/organizational-intelligence.ts`) for THE OFFICE.

### Core Principle:
> **ORGANIZATIONAL INTELLIGENCE OBSERVES AND EXPLAINS THE ORGANIZATION. IT DOES NOT GOVERN OR EXECUTE THE ORGANIZATION.**
> The intelligence layer aggregates real runtime events, task results, review findings, and corroborated patterns into deterministic metrics, signals, risks, trends, insights, and advisory recommendations.
> It CANNOT execute tasks, create tasks automatically, approve production, alter governance, or start autonomous loops.

---

## 2. Implemented Architecture (`src/office/organizational-intelligence.ts`)

### 2.1 Contracts & Types
* **`OrganizationalSignalType`**: Deterministic signals derived from empirical evidence:
  * `EXECUTION_FAILURE_RATE`
  * `EXECUTION_SUCCESS_RATE`
  * `REVIEW_BLOCK_RATE`
  * `QA_FAILURE_RATE`
  * `REGRESSION_RATE`
  * `REMEDIATION_SUCCESS_RATE`
  * `REPEATED_FAILURE_PATTERN`
  * `BOTTLENECK_DETECTED`
  * `AGENT_LOAD_SIGNAL`
  * `DEPENDENCY_BLOCK_SIGNAL`
  * `PROJECT_HEALTH_SIGNAL`
  * `GOVERNANCE_BLOCK_SIGNAL`
  * `DELIVERY_TREND`
  * `QUALITY_TREND`
* **`OrganizationalMetricsSummary`**: Delivery, Quality, Reliability, Workforce, and Dependency metrics.
* **`OrganizationalRisk`**: Typed risk records with severity (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`) and confidence.
* **`OrganizationalTrend`**: Temporal trend analysis (`IMPROVING`, `STABLE`, `DEGRADING`, `VOLATILE`, `UNKNOWN`).
* **`ProjectHealthStatus`**: Diagnostic health evaluation (`HEALTHY`, `ATTENTION`, `AT_RISK`, `BLOCKED`, `UNKNOWN`).
* **`OrganizationalInsight`**: Clean separation between observation, evidence, and interpretation.
* **`OrganizationalRecommendation`**: Advisory suggestions where `requiresHumanDecision` is strictly `true`.
* **`OrganizationalIntelligenceResult`**: Complete diagnostic snapshot with provenance.

---

## 3. Strict Invariants & Governance

1. **Hierarchy of Truth:**
   $$\text{CURRENT RUNTIME} > \text{EXECUTION OUTCOME} > \text{REVIEW OUTCOME} > \text{QA OUTCOME} > \text{GOVERNED FEEDBACK} > \text{PATTERNS} > \text{LESSONS} > \text{HISTORICAL MEMORY}$$
2. **Zero Autonomous Execution:** `OrganizationalRecommendation.requiresHumanDecision` is non-negotiable. Recommendations never trigger automatic tasks.
3. **Zero Governance Mutation:** Diagnosing a risk as `CRITICAL` does not alter permissions, approvals, or review thresholds.
4. **Data Minimization:** Metrics and signals reference IDs, hashes, and rates; prompt and stderr bodies are not duplicated into intelligence stores.
5. **Multi-Tenant Isolation:** All calculations and signals are strictly scoped to `tenantId` and `projectId`.

---

## 4. Test Coverage (`tests/office-organizational-intelligence.test.ts`)

* **Total Tests:** 35 deterministic unit tests.
* **Coverage Matrix:**
  1. Delivery metrics computation (`tasksCompleted`, `tasksFailed`, `successRate`, `failureRate`).
  2. Quality metrics computation (`reviewBlockRate`, `qaFailureRate`, `regressionRate`, `remediationSuccessRate`).
  3. Reliability & Pattern tracking (`repeatedFailureCount`, `recurringPatternCount`, `unresolvedContradictionCount`).
  4. Workforce load tracking across all 5 roles (`chief-of-staff`, `architect`, `developer`, `reviewer`, `qa-engineer`).
  5. Project Health evaluations (`HEALTHY`, `ATTENTION`, `AT_RISK`, `BLOCKED`, `UNKNOWN`).
  6. Temporal Trend detection (`IMPROVING`, `STABLE`, `DEGRADING`, `UNKNOWN`).
  7. Risk detection and severity categorization.
  8. Separation of Observation, Inference, and Recommendation.
  9. Human decision enforcement on recommendations (`requiresHumanDecision: true`).
  10. Security & Authority forgery resistance (text asserting "CEO approved" does not bypass metrics).
  11. Multi-tenant and project isolation.
  12. Idempotency and deterministic reproducibility.
  13. Contradiction preservation.
  14. Privacy and data minimization.
  15. Runtime evidence precedence.

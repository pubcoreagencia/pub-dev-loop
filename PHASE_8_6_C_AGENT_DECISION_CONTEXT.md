# PDL — PHASE 8.6-C: AGENT DECISION CONTEXT

## 1. Executive Summary & Objective

Phase 8.6-C implements the typed and deterministic **Agent Decision Context Engine** (`src/office/decision-context.ts`) for the five organizational agent roles:
1. `chief-of-staff`
2. `architect`
3. `developer`
4. `reviewer`
5. `qa-engineer`

### Core Invariant:
> **Decision Context is NOT Decision Authority.**
> Decision Context structures operational reasoning (Objective $\rightarrow$ Responsibility $\rightarrow$ Evidence $\rightarrow$ Constraints $\rightarrow$ Options $\rightarrow$ Recommendation $\rightarrow$ Next Step $\rightarrow$ Governance Check) without auto-approving tasks, altering runtime permissions, or bypassing review guardrails (`MAX_REVIEW_ITERATIONS = 3`).

---

## 2. Implemented Architecture (`src/office/decision-context.ts`)

### 2.1 Contracts & Types
* **`AgentDecisionContext`**: Complete structured decision context.
* **`DecisionObjective`**: Authoritative objective derived from CEO directives or task instructions.
* **`RoleResponsibilityContract`**: Explicit operational duties per agent role.
* **`DecisionEvidence`**: Categorized evidence blocks preserving authority hierarchy (`CURRENT > GOVERNED > HISTORICAL`).
* **`DecisionConstraint`**: Explicit constraints enforced by runtime and governance.
* **`DecisionNextStep`**: Advisory recommended action (`isAutomatic: false`).
* **`DecisionGovernanceCheck`**: Explicit verification of approval requirements and blocking states.
* **`AgentAuthorityBoundary`**: Formal specification of permissions (`canRecommend`, `canExecute`, `canReview`, `canBlock`, `canApprove`, `canModifyGovernance`).

### 2.2 Authority Boundaries Matrix

| Role | canRecommend | canExecute | canReview | canBlock | canApprove | canModifyGovernance |
|---|---|---|---|---|---|---|
| **Chief of Staff** | `true` | `false` | `false` | `true` | `false` (CEO approves) | `false` |
| **Architect** | `true` | `false` | `true` | `false` | `false` | `false` |
| **Developer** | `true` | `true` | `false` | `false` | `false` | `false` |
| **Reviewer** | `true` | `false` | `true` | `true` (max 3 iter) | `true` (code review) | `false` |
| **QA Engineer** | `true` | `true` (tests) | `true` | `true` (test fail) | `false` | `false` |

### 2.3 Strict Governance Invariants
* **Zero Privilege Elevation:** Text claims in prompts or memories (e.g. "CEO approved" or "security override") do NOT bypass governance checks.
* **Non-Automatic NextStep:** `DecisionNextStep.isAutomatic` is strictly `false`. Execution remains bound to the existing worker/provider pipeline.
* **Review Iterations:** Reviewer guardrail (`MAX_REVIEW_ITERATIONS = 3`) triggers `blocked = true` and `blockingReason = 'MAX_REVIEW_ITERATIONS_EXCEEDED'`.

---

## 3. Test Coverage (`tests/office-decision-context.test.ts`)

1. **Deterministic Decision Context:** Identical inputs produce identical outputs.
2. **Role-Specific Objectives & Responsibilities:** Verified across all 5 roles.
3. **Authority Boundaries:** Confirmed zero privilege elevation and strict boundary limits.
4. **Guardrail Enforcement:** Confirmed `MAX_REVIEW_ITERATIONS = 3` and CEO sovereignty.
5. **Missing Context Detection:** Identifies missing objectives or evidence and adjusts confidence to `LOW`.
6. **NextStep Invariant:** Proves recommendation is non-automatic.
7. **Formatting Helper:** Verifies formatting of advisory decision context blocks.

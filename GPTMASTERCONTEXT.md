# GPTMASTERCONTEXT.md

## PUB DEV LOOP (PDL) / THE OFFICE / PUB PROTOTYPE (PP)
### Autonomous Continuity Context — Canonical Product, Architecture, History and Roadmap

> **Purpose:** This file is the durable handoff from the long-running GPT ↔ PUB CORE engineering conversation into the repository itself. An autonomous engineering agent must read this file before making architectural, product, UX, governance or roadmap decisions. It exists so that work does **not** depend on chat history, copied prompts, or a human repeatedly translating context between GPT and an agent.
>
> **Canonical principle:** repository state + durable runtime data + this context are the operational continuity layer. Chat is disposable.
>
> **Language:** communication and visible product UI are Portuguese (Brazil) first. Code identifiers, schemas, enums, commits and technical artifacts remain English when that is the established project convention.

---

# 0. EXECUTIVE IDENTITY

**PUB DEV LOOP (PDL)** is not merely a task queue, chatbot, dashboard or generic AI coding wrapper.

It is a **Cloud-First Autonomous Engineering Platform** whose primary product experience is **THE OFFICE**: a living virtual engineering workplace where the human CEO leads a persistent team of specialist AI employees. The agents receive objectives, coordinate, execute real engineering work, review one another, validate outcomes, retain governed organizational memory, learn deterministic institutional lessons, expose organizational health, and eventually compound those lessons into reusable skills and governed autonomous workflows.

The product is intentionally moving through this conceptual evolution:

`AI task runner → autonomous engineering loop → virtual engineering organization → learning organization → compounding autonomous engineering workplace`

The UI metaphor is not decoration. **THE OFFICE is the product interface for the organization.**

The long-term goal is an engineering organization that can operate across projects with increasing autonomy while preserving empirical truth, security, tenant isolation and explicit human sovereignty at critical boundaries.

---

# 1. HUMAN / PRODUCT CONTEXT

- Product/organization: **PUB CORE**
- Main system: **PUB DEV LOOP (PDL)**
- Main experience: **THE OFFICE**
- Prototype/product-design lineage: **PUB Prototype (PP)**
- Primary repository: `pubcoreagencia/pub-dev-loop`
- Default branch: `main`
- Production runtime used during development: Cloudflare Workers deployment(s)
- Product language: pt-BR first
- Human role: **CEO** / final governance authority
- Engineering operating preference: autonomous agents should inspect, implement, validate, commit and deploy; the human should not be required to manually edit code merely to continue the workflow.

This context is specifically intended to eliminate the previous workflow where GPT produced a prompt and the human copied it into another coding agent. The agent should now use this document as its durable context and continue autonomously from repository state.

---

# 2. THE CORE PHILOSOPHY

## 2.1 Office First

The office is the primary experience. A traditional BI/task dashboard must never become the dominant interface.

Visual priority:

1. OfficeFloorMap / office space
2. CEO presence
3. Agents and desks
4. Real collaboration / handoffs / meetings
5. Global Office Chat
6. Agent Inspector
7. Awareness / operational overlays
8. Secondary diagnostics

Panels should behave as discreet overlays or supporting views rather than replacing the office.

## 2.2 Agents are employees, not buttons

Every canonical agent has:

- identity
- role
- specialty
- desk/workstation
- responsibilities
- personality
- operational status
- memory scope
- skills/capabilities
- collaboration relationships
- real work history

The office should communicate organizational behavior spatially and socially without fabricating events.

## 2.3 Conversation First

The CEO should be able to express objectives naturally through the Global Office Chat. The system translates objectives into organizational work through the Chief of Staff and the planning/delegation machinery.

## 2.4 Autonomous by default, human approval by exception

Routine engineering work should proceed autonomously when policy allows. Critical architecture, production, security and governance decisions remain subject to explicit CEO authority.

## 2.5 Real-time truth

The visual office must reflect runtime truth. Never invent a worker state, message, handoff, meeting, task completion, metric or celebration simply to make the office look alive.

## 2.6 Persistence first

Chat sessions are ephemeral. Local machines are ephemeral. Durable project continuity lives in Git, PostgreSQL/runtime persistence and repository documentation.

Canonical continuity pattern:

`READ CONTEXT → IMPLEMENT → VALIDATE → UPDATE CONTEXT → COMMIT → PUSH/DEPLOY → VERIFY PERSISTENCE`

---

# 3. ORIGINAL PDL ENGINE

The PDL began as a cloud engineering execution engine.

Canonical loop:

`Task API → PostgreSQL Queue → Isolated Worker → Provider/LLM → Workspace → Automated Validation → Git Commit → Result Persistence`

## 3.1 Worker sovereignty

The Worker owns:

- temporary workspace
- OS process execution
- Git operations
- validation
- task finalization
- result persistence

An LLM/provider is only a source of code/action suggestions. It must never be treated as the host/repository authority.

## 3.2 Secrets

Secrets are runtime-only:

- API keys
- authentication tokens
- provider credentials
- service-role credentials

Never commit them, log them, expose them to the client bundle, or persist them in task results.

## 3.3 Resilient provider architecture

The provider layer evolved into a dual-gateway strategy:

- PRIMARY: `openrouter`
- FALLBACK: `9router`

Important runtime concepts include:

- provider abstraction in `src/providers/types.ts`
- OpenRouter provider in `src/providers/openrouter.ts`
- 9router provider in `src/providers/router.ts`
- DualGateway in `src/providers/gateway.ts`
- RouterWorker in `src/router-worker.ts`
- Task finalization in `src/finalizer.ts`

The provider layer must remain model-independent. Model choice must not become product identity.

## 3.4 Reliability rules

- Provider fallback must be deterministic and observable.
- HTTP 429/quota conditions must not silently corrupt task state.
- Total router timeout is governed by the existing timeout configuration.
- Worker cycles are serialized where required to avoid concurrency races.
- PostgreSQL writes must not receive accidental `undefined` values; deterministic persistence matters.

## 3.5 Git integrity

A successful engineering task must materialize durable change in Git. A model claiming success is never sufficient.

The Task Finalizer validates available syntax/typecheck/build/test conditions before committing changes.

---

# 4. CURRENT EXECUTION ARCHITECTURE

Core layers:

- API: `src/index.ts`
- Task queue/database: `src/db/`
- Worker: `src/router-worker.ts`
- Provider abstraction: `src/providers/types.ts`
- 9router provider: `src/providers/router.ts`
- OpenRouter provider: `src/providers/openrouter.ts`
- Dual gateway: `src/providers/gateway.ts`
- Task finalizer: `src/finalizer.ts`
- Office registry: `src/office/registry.ts`
- Office events: `src/office/events.ts`
- Office review: `src/office/review.ts`
- Office approval: `src/office/approval.ts`
- Office auth: `src/office/auth.ts`
- Office memory and learning modules under `src/office/`

The system already has real API → queue → worker → provider → execution → validation → finalization flow. Do not replace this foundation with a UI-only simulation.

---

# 5. THE OFFICE — CANONICAL WORKFORCE

## 5.1 CEO

The CEO is a persistent visible participant in the office and the final human authority.

The CEO can:

- issue objectives
- participate in global chat
- approve/reject governed actions
- make strategic decisions
- override where policy explicitly permits it

The CEO cannot be impersonated by client payloads or forged headers.

## 5.2 Chief of Staff — `chief-of-staff`

Role: Leadership / Orchestrator

Responsibilities:

- interpret CEO objectives
- organize alignment
- formulate plans
- coordinate delegation
- manage handoffs
- track global project execution
- identify organizational blockers

Authority contract:

- canRecommend: true
- canExecute: false
- canReview: false
- canBlock: true
- canApprove: false
- canModifyGovernance: false

CoS memory scope:

- DECISION
- PLAN
- PROJECT_CONTEXT

Governed lessons affinity:

- STRATEGIC_GUIDANCE
- ARCHITECTURE_GUIDANCE

## 5.3 Architect — `architect`

Role: Engineering / Principal Architect

Responsibilities:

- architecture
- API contracts
- dependency boundaries
- system integrity
- technical debt mitigation
- architecture reviews

Authority:

- canRecommend: true
- canExecute: false
- canReview: true
- canBlock: false
- canApprove: false
- canModifyGovernance: false

Memory scope:

- DECISION
- PLAN
- REVIEW_FINDING
- PROJECT_CONTEXT

Lesson affinity:

- ARCHITECTURE_GUIDANCE
- STRATEGIC_GUIDANCE

## 5.4 Developer — `developer`

Role: Engineering / Senior Developer

Responsibilities:

- implement code
- refactor
- create endpoints
- execute changes in isolated workspaces
- fix validated findings

Authority:

- canRecommend: true
- canExecute: true
- canReview: false
- canBlock: false
- canApprove: false
- canModifyGovernance: false

Memory scope:

- TASK_RESULT
- REVIEW_FINDING
- LESSON
- PROJECT_CONTEXT

Lesson affinity:

- OPERATIONAL_GUIDANCE
- TESTING_GUIDANCE

## 5.5 Reviewer — `reviewer`

Role: QA / Code Reviewer & Security

Responsibilities:

- inspect actual changes
- identify correctness/security/architecture issues
- enforce review policy
- block unsafe or invalid work

Authority:

- canRecommend: true
- canExecute: false
- canReview: true
- canBlock: true
- canApprove: true for inspection/code review boundaries only
- canModifyGovernance: false

**Hard invariant:** `MAX_REVIEW_ITERATIONS = 3`

If the maximum is reached while blocking findings remain, the task becomes BLOCKED. It must not be auto-approved and must not be finalized/committed merely because the iteration limit was reached.

Memory scope:

- REVIEW_FINDING
- TASK_RESULT
- PROJECT_CONTEXT

Lesson affinity:

- SECURITY_GUIDANCE
- OPERATIONAL_GUIDANCE

## 5.6 QA Engineer — `qa-engineer`

Role: QA / QA Automation Engineer

Responsibilities:

- unit/integration/E2E validation
- regression detection
- empirical verification
- remediation confirmation

Authority:

- canRecommend: true
- canExecute: true for tests
- canReview: true
- canBlock: true on test failures
- canApprove: false for CEO-governed decisions
- canModifyGovernance: false

Memory scope:

- TASK_RESULT
- REVIEW_FINDING
- LESSON
- PROJECT_CONTEXT

Lesson affinity:

- TESTING_GUIDANCE
- OPERATIONAL_GUIDANCE

---

# 6. OFFICE VISUAL / FRONTEND CONTRACT

The frontend is a DOM/CSS Grid 2.5D hybrid office renderer, not a Three.js/WebGL rewrite.

Important components:

- `frontend/src/components/OfficeFloorMap.tsx`
- `frontend/src/components/GlobalOfficeChat.tsx`
- `frontend/src/components/ActivityTimeline.tsx`
- `frontend/src/components/AgentInspector.tsx`
- `frontend/src/components/PlanViewer.tsx`
- `frontend/src/components/OfficeHeader.tsx`
- `frontend/src/components/AwarenessPanel.tsx`
- `frontend/src/store/useStore.ts`
- `frontend/src/types/office.ts`
- `frontend/src/config/officeLayout.ts`
- `frontend/src/services/api.ts`
- `frontend/src/pages/Home.tsx`
- `frontend/src/index.css`

The office must feel like a real workplace:

- each employee has a desk
- agents can be idle/thinking/in meeting/working/reviewing/collaborating/etc.
- meaningful events can produce visible communication
- real handoffs can move agents
- meetings can be represented spatially
- the CEO is visible and persistent
- chat is part of the workplace rather than a detached chatbot page

Visual state must be driven by real runtime state.

Canonical operational states:

`idle`, `thinking`, `in_meeting`, `working`, `reviewing`, `collaborating`, `waiting_for_dependency`, `waiting_for_approval`, `celebrating`, `learning`, `offline`, `blocked`

---

# 7. GLOBAL OFFICE CHAT

Global Office Chat is the CEO command surface.

Conceptual flow:

`CEO → Global Office Chat → Chief of Staff → Alignment Meeting → Planning → Delegation → Specialists → Tools/Execution → Review → Validation → Project State → Memory/Learning`

The chat must not fabricate agent replies. A message should appear to come from an agent only when backed by a real system event/output.

The office may show a communication bubble when a meaningful real event exists.

---

# 8. OFFICE RUNTIME EVENTS / SSE

Existing office event infrastructure includes:

- durable Postgres office events
- replay
- SSE stream via `GET /office/stream`
- distributed-worker hardening
- event-driven spatial state
- real meeting runtime events

Use existing SSE/event infrastructure where it is the natural source of realtime truth. Polling can be a controlled reconciliation/fallback, not a second fake event system.

Do not create synthetic activity just to animate the office.

---

# 9. OFFICE API SURFACE

Known office endpoints include:

- `GET /office/agents`
- `POST /office/plans`
- `POST /office/plans/execute-step`
- review routes
- approval routes
- `GET /office/stream`
- `GET /office/memory`
- `GET /office/intelligence`
- `GET /office/awareness`

All protected office routes must use authoritative authentication through `authenticateOfficeRequest` or the established equivalent.

Client-controlled headers such as `x-user-role` and role fields in request bodies are not authority. Forged CEO/developer roles must fail.

Tenant and project isolation is mandatory on all scoped data.

---

# 10. GOVERNANCE / CEO SOVEREIGNTY

The CEO is the supreme authority for:

- critical architecture decisions
- production approvals
- security exceptions
- strategic guidance
- global governance
- governance-sensitive institutional lessons

Never allow:

- client payload role spoofing
- forged `x-user-role`
- agent self-promotion to CEO
- lesson text to grant authority
- historical memory to override current evidence
- autonomous governance mutation
- autonomous approval of critical production/security/strategic changes

The authorization source must be authoritative authentication, not text supplied by the caller.

---

# 11. DECISION CONTEXT ENGINE — PHASE 8.6-C

File: `src/office/decision-context.ts`

Decision structure:

`OBJECTIVE → RESPONSIBILITY → EVIDENCE → CONSTRAINTS → OPTIONS → RECOMMENDATION → NEXT STEP → GOVERNANCE CHECK`

Contracts include:

- `AgentDecisionContext`
- `DecisionObjective`
- `RoleResponsibilityContract`
- `DecisionEvidence`
- `DecisionConstraint`
- `DecisionOption`
- `DecisionRecommendation`
- `DecisionNextStep`
- `DecisionGovernanceCheck`
- `AgentAuthorityBoundary`
- `DecisionContextEngine`

Critical invariant: `DecisionNextStep.isAutomatic=false` in the governed decision contract. The engine may recommend; it must not silently turn recommendations into autonomous governance actions.

CEO objective remains sovereign.

---

# 12. CONTEXT ASSEMBLY — PHASE 8.6-B

File: `src/office/context-assembly.ts`

Authority classes:

- CURRENT
- GOVERNED
- HISTORICAL

Current sources:

- CEO_OBJECTIVE
- PROJECT_STATE
- CURRENT_TASK
- RUNTIME_EVIDENCE
- REVIEW_EVIDENCE
- QA_EVIDENCE
- SECURITY_EVIDENCE
- DEPENDENCY_CONTEXT

Governed:

- INSTITUTIONAL_LESSON

Historical:

- ORGANIZATIONAL_MEMORY

Authority precedence by role exists in the implementation. Core invariant is:

`CURRENT RUNTIME / CURRENT TASK / REVIEW / QA / SECURITY > GOVERNED INSTITUTIONAL LESSON > HISTORICAL MEMORY`

Context budgets:

- current: ~10k chars
- governed: ~2k chars
- historical: ~2k chars
- total: ~15k chars

When over budget, historical context is truncated/discarded first, governed next, current preserved.

Untrusted authority claims such as “CEO approved” or “security override” are detected as untrusted authority claims and must not elevate privilege.

---

# 13. ORGANIZATIONAL MEMORY — PHASES 8.1–8.4

Memory is consultive historical knowledge, never current-state authority.

Taxonomy:

- DECISION
- REVIEW_FINDING
- TASK_RESULT
- LESSON
- PROJECT_CONTEXT
- AGENT_CONTEXT
- PLAN

Core implementation:

- `src/office/memory.ts`
- `src/office/memory-governance.ts`
- migration `011_organizational_memory.sql`
- migration `012_memory_governance.sql`

Lifecycle:

- ACTIVE
- SUPERSEDED
- BLOCKED

Later institutional lessons additionally use REVOKED.

Governance rules include:

- ACTIVE → SUPERSEDED requires `supersededBy`
- ACTIVE → BLOCKED requires a guardrail reason
- no silent reactivation of SUPERSEDED/BLOCKED
- no self-supersession
- no cross-tenant supersession
- cross-project global compatibility must be explicit
- provenance is required
- epistemic status is preserved
- contradictions remain unresolved unless explicitly governed

Epistemic categories:

- OBSERVED
- DECIDED
- DERIVED
- INFERRED

Quality dimensions are separate from authority:

- provenance completeness
- source authority
- recurrence
- temporal validity

High authority does not automatically mean factual correctness.

---

# 14. INSTITUTIONAL LEARNING — PHASES 8.5-A–F

The organization learns from real work using deterministic evidence rather than an LLM or vector database.

Canonical pipeline:

`REAL EVENT → ORGANIZATIONAL MEMORY → DETERMINISTIC PATTERN → LESSON CANDIDATE → GOVERNED VALIDATION → INSTITUTIONAL LESSON → ROLE-AWARE RETRIEVAL`

## 14.1 8.5-A — Architecture audit

Established taxonomy:

1. OBSERVATION — verified runtime fact
2. DECISION — explicit authoritative decision
3. PATTERN — deterministic repeated/correlated observation
4. LESSON_CANDIDATE — auditable proposal
5. INSTITUTIONAL_LESSON — validated/authorized principle

Candidate eligibility concept:

`recurrence >= 3 AND multi-task AND remediated AND dual-confirmed AND not contradicted AND not blocked`

Corroboration is stronger when evidence crosses tasks/roles/projects.

## 14.2 8.5-B — Pattern detection

File: `src/office/pattern-detection.ts`

Migration: `013_organizational_patterns.sql`

Pattern signature is deterministic SHA-256 over canonicalized identity/evidence fields.

Normalization removes unstable values such as:

- ISO dates
- timestamps
- PIDs
- temporary/absolute paths
- line/column references

while preserving semantic rule IDs.

A repeated failure from the same task retry must not masquerade as independent corroboration.

Pattern table has a unique tenant/project/signature identity.

Patterns do not themselves change agent behavior.

## 14.3 8.5-C — Lesson candidates

File: `src/office/lesson-candidate.ts`

Migration: `014_lesson_candidates.sql`

Statuses:

- PROPOSED
- ELIGIBLE
- BLOCKED
- REJECTED
- SUPERSEDED

Eligibility requires:

1. independentTaskCount >= 3
2. remediationVerifiedCount >= 1
3. reviewerConfirmedCount >= 1 OR qaConfirmedCount >= 1
4. contradiction not unresolved
5. origin not BLOCKED/REJECTED

Default scope is PROJECT. GLOBAL is never assumed.

Candidate statement must be safe and non-authoritative; candidates do not directly become policy.

## 14.4 8.5-D — Governed institutional lessons

File: `src/office/lesson-validation.ts`

Migration: `015_institutional_lessons.sql`

Lesson statuses:

- ACTIVE
- SUPERSEDED
- BLOCKED
- REVOKED

Lesson types:

- OPERATIONAL_GUIDANCE
- TESTING_GUIDANCE
- ARCHITECTURE_GUIDANCE
- SECURITY_GUIDANCE
- STRATEGIC_GUIDANCE

Governance:

- operational/testing guidance can be validated deterministically under the defined rules
- architecture/security/strategic guidance requires CEO approval
- GLOBAL scope requires CEO approval
- strategic/security/architecture supersession requires CEO approval

Governance snapshot is immutable and records who/when/how approval happened.

Unresolved contradiction blocks institutionalization.

Subsequent contradiction is an audit signal; it does not silently revoke a lesson.

## 14.5 8.5-E — Governed retrieval

File: `src/office/lesson-retrieval.ts`

Retrieval precedence:

`CURRENT RUNTIME STATE > CURRENT TASK EVIDENCE > CURRENT REVIEW/SECURITY EVIDENCE > GOVERNED LESSONS > HISTORICAL MEMORY`

Deterministic ranking includes scope and role affinity.

Only ACTIVE lessons with valid temporal status are retrieved.

GLOBAL lessons are retrieved only when explicitly governed/CEO-approved.

The formatter explicitly marks lessons as advisory context.

No LLM, embeddings or vector database is required.

## 14.6 8.5-F — Institutional learning E2E audit

The full learning chain was validated end-to-end:

- 3 independent tasks can satisfy thresholds
- same-task retries do not inflate independentTaskCount
- missing remediation/confirmation/contradiction can block promotion
- forged role headers fail
- cross-tenant queries are isolated
- SUPERSEDED/BLOCKED/REVOKED lessons are excluded from retrieval
- current runtime evidence wins

Historical validation reached 356/356 tests and deployment was performed after the audit.

---

# 15. ADAPTIVE AGENT INTELLIGENCE — PHASES 8.6-A–F

## 15.1 8.6-A — Agent Context Behavior Audit

Audited all five agents and verified:

- role-specific memory scope
- role-specific lesson affinity
- current evidence precedence
- reviewer three-iteration ceiling
- QA current failures beat historical success
- CEO objective remains authoritative
- tenant isolation
- retrieval failures are isolated rather than fatal

Commit: `7c6aeb14c46de740cee2c0b1fd097be4bd5ca197`

## 15.2 8.6-B — Governed Context Assembly

Commit: `3df8940a31184239dea4d5ea1265a955adf7b0a9`

Created typed authority/source/budget contracts and deterministic context assembly.

## 15.3 8.6-C — Agent Decision Context

Commit: `4c691d298004f3a3f465812b864c086802e948ca`

Created decision context and explicit authority boundaries.

## 15.4 8.6-D — Governed Agent Learning Feedback Loop

File: `src/office/learning-feedback.ts`

Real outcome builders:

- `buildExecutionOutcomeFromRuntime`
- `buildReviewOutcomeFromReview`
- `buildQAOutcomeFromTests`

Evidence must come from real runtime/execution/review/test results, not an agent saying “I succeeded”.

Outcome chain:

`Decision Context → Agent Action → Real Execution → Outcome → Review → QA → Feedback → Memory → Pattern`

Feedback is downstream observation. It must not directly create an institutional lesson.

Hardening reached 28 dedicated tests and 404/404 full tests at that stage.

Commit: `92d083e01b5592f669c616e8f904543ad3fad27f`

## 15.5 8.6-E — Organizational Intelligence

File: `src/office/organizational-intelligence.ts`

Purpose: deterministic read-only organizational diagnosis based on real signals.

Signal types:

- EXECUTION_FAILURE_RATE
- EXECUTION_SUCCESS_RATE
- REVIEW_BLOCK_RATE
- QA_FAILURE_RATE
- REGRESSION_RATE
- REMEDIATION_SUCCESS_RATE
- REPEATED_FAILURE_PATTERN
- BOTTLENECK_DETECTED
- AGENT_LOAD_SIGNAL
- DEPENDENCY_BLOCK_SIGNAL
- PROJECT_HEALTH_SIGNAL
- GOVERNANCE_BLOCK_SIGNAL
- DELIVERY_TREND
- QUALITY_TREND

Precedence:

`CURRENT RUNTIME STATE > REAL EXECUTION OUTCOME > REAL REVIEW OUTCOME > REAL QA OUTCOME > GOVERNED FEEDBACK SIGNAL > VERIFIED PATTERN > GOVERNED INSTITUTIONAL LESSON > HISTORICAL ORGANIZATIONAL MEMORY`

Metrics cover:

- delivery
- quality
- reliability
- workforce visibility
- dependencies

Unknown-first rule: insufficient samples must yield UNKNOWN rather than invented zeros.

Temporal trend states:

- IMPROVING
- STABLE
- DEGRADING
- VOLATILE
- UNKNOWN

Bottleneck detection is process-oriented, never blame-oriented.

Agent load is for workforce visibility, not performance ranking.

Project health:

- HEALTHY
- ATTENTION
- AT_RISK
- BLOCKED
- UNKNOWN

Risk severity:

- LOW
- MEDIUM
- HIGH
- CRITICAL

Confidence:

- LOW
- MEDIUM
- HIGH

Severity and authority are separate concepts.

Insights distinguish:

- OBSERVED
- INFERRED
- RECOMMENDED

Recommendations are consultive and must have:

`requiresHumanDecision: true`

The intelligence engine must never mutate governance or autonomously execute a recommendation.

35 deterministic dedicated tests were added at that phase. Historical total reached 439/439.

Commit: `5734db18b05f7ffc04d93cbb0c45ddc91cdbaa30`

## 15.6 8.6-F — Organizational Awareness

Purpose: expose organizational intelligence inside THE OFFICE without turning the office into a dashboard.

Backend:

- `src/office/organizational-awareness.ts`

Frontend:

- `frontend/src/components/AwarenessPanel.tsx`
- `OfficeHeader.tsx` compact organization pulse
- `Home.tsx` overlay
- store awareness state/actions
- API service `fetchAwareness(project)`

Endpoints:

- `GET /office/awareness`
- `GET /office/intelligence`

Awareness includes:

- organizational health
- risks
- trends
- bottlenecks
- agent workload context
- project health
- observed/inferred insights
- advisory recommendations

Recommendations must never become action buttons that silently execute changes.

Agent Inspector may expose workload context but must not score/rank employees.

Awareness must not create fake agent messages/activity.

Realtime behavior uses the existing office truth/event model with reconciliation/polling only where appropriate.

Historical implementation validation reached 484/484 tests, backend typecheck/build and frontend build passed.

Commit: `f26909b8bfe5586291e8eb386428b482e8a4ec8a`

Historical deployment: `1f74ab61-92ba-451e-a92e-261ef74cc03d`

### 8.6-F acceptance caution

Before declaring any future feature built on awareness “frozen”, verify that:

1. awareness remains an adapter/read model over Organizational Intelligence rather than a duplicate intelligence engine;
2. `/office/awareness` uses the 8.6-E source of truth;
3. auth and tenant/project isolation are enforced server-side;
4. the actual browser UI works, not just backend serialization tests;
5. loading/error/unknown states work;
6. realtime/reconciliation is grounded in actual office events;
7. no recommendation can execute autonomously;
8. no fake activity exists.

---

# 16. CURRENT PRODUCT EXPERIENCE TARGET

The ideal user experience is:

1. CEO opens THE OFFICE.
2. CEO sees themselves and the five employees at their desks.
3. CEO gives a natural-language objective in Global Office Chat.
4. Chief of Staff interprets the objective and creates alignment/plan.
5. Agents receive delegated work according to specialty.
6. Agents visibly work only when real runtime work exists.
7. Agents hand work to one another through real events.
8. Reviewer and QA validate actual outputs.
9. Failures cause real status changes and remediation loops within governance.
10. Approved work is finalized into Git.
11. Real outcomes feed organizational memory/patterns/lessons.
12. Organizational Intelligence observes the organization.
13. Organizational Awareness surfaces that pulse discreetly in THE OFFICE.
14. Future Skills allow the organization to compound validated experience.

This should feel like a **company operating**, not a page containing five AI buttons.

---

# 17. PUB PROTOTYPE (PP) CONTEXT

**PUB Prototype (PP)** is the rapid product prototyping layer/idea that preceded and informed the mature PDL direction.

Its purpose is to accelerate:

`IDEA → PRODUCT → INTERFACE → FLOWS → FUNCTIONAL PROTOTYPE → VALIDATION`

A dedicated prototype mode/branch existed as:

`feat/pub-prototype-mode`

PP was used to validate the idea quickly before finalizing the deeper PDL implementation.

The prototype lineage emphasized:

- rapid interface iteration
- real functional flow validation
- browser preview validation
- preserving the core architecture instead of building a disposable fake

A previous PP E2E run exposed a concrete problem: a generated preview lacked a valid `package.json`/dev script and health check failed. The response was to introduce an adaptive LocalPreviewRuntime rather than manually patching every prototype.

Important PP E2E invariant:

**One E2E session must be used across Prompt 1 → Prompt 2 → Prompt 3. Do not advance unless READY, preview HTTP 200, checkpoint SHA, workspacePath and task COMPLETED are all confirmed. On failure, stop, dump diagnostics, and make no production changes.**

An adaptive preview runtime was approved with:

- Node dev/start detection
- static native Node server fallback
- `0.0.0.0` binding
- `127.0.0.1` health check
- traversal protection
- MIME handling
- stdout/stderr capture
- preservation of overrides
- validation sequence typecheck → build → preview/health

PP is therefore not a disconnected toy. Its validated product/UX principles feed the PDL, while the mature PDL execution/governance foundation remains authoritative.

---

# 18. IMPORTANT HISTORICAL PDL PHASES

## Foundation / core execution

PDL MVP established:

- HTTP API
- PostgreSQL durable queue
- isolated worker
- Codex/LLM provider abstraction
- Git per task
- TaskFinalizer
- Master Context
- Docker worker
- GitHub Actions

TaskFinalizer was refactored for automatic commit after successful validation.

A master context was consolidated into `PUB_MASTER_CONTEXT.md` during the earlier architecture.

Memory Engine MVP was introduced with commit `88d3eb4` and included:

- `lib/memory/` types
- memory ingest/search API
- versioned local JSON storage at MVP stage
- deterministic embedding concept at MVP stage

The later organizational memory implementation superseded the conceptual MVP with PostgreSQL-backed governed memory.

## Router integrity milestone

A later integrity milestone restored provider control flow and permanent fallback coverage.

Commit:

`449eb78` — `fix(router): restore provider control flow and permanent fallback test`

At that point:

- router syntax/brace issue fixed
- experimental streaming stub removed
- permanent fallback test added
- temporary E2E fallback workflow deleted
- full suite: 199/199
- typecheck/build passed
- working tree clean

Known architectural gap at that historical point: RouterProvider streaming was not implemented; streaming had been intentionally removed/hard-coded `stream:false`. Streaming remains a future capability unless later implementation superseded this state.

---

# 19. HISTORICAL OFFICE PHASES 2–7

## Phase 2

Live workforce foundation:

- spatial presence
- Portuguese UI
- real employee model

Commit:

`5845b8a4949fbfc103f5de023a43a0979a355db2`

## Phase 3

Live organizational events and speech bubbles.

Commit:

`96744d33896fe6927d5af18f4cf3a8cdedde9d19`

## Phase 4

Employee avatars, CRT workstations, spatial handoffs.

Commit:

`d14ba21d1c37b9e36b0db33452085c792278ab17`

## Phase 5 / 5.1

SSE, durable Postgres office events, replay and Cloudflare distributed-worker hardening.

## Phase 6 / 6.1

Spatial state, event-driven movement, real meeting runtime events and DOM movement validation.

Historical validation reached 193/193.

## Phase 7 / 7.1 / 7.2

Review and CEO approval system.

Implemented:

- CodeReviewManager
- real execution context review
- explicit review states
- maximum three review iterations
- critical approval gates for architecture/production/security
- authoritative office auth
- hard-block guardrail

At the hard-block milestone:

- max 3 iterations + blocking errors → BLOCKED
- no REVIEW_APPROVED
- no automatic approval
- no finalizer/git commit

Historical test counts reached 211/211 and then 214/214.

---

# 20. TESTING / QUALITY CONTRACT

Every implementation phase should validate at least:

- focused unit tests
- relevant integration/E2E tests
- full test suite
- backend typecheck
- backend build
- frontend build when frontend changed
- lint if configured and relevant
- Git working tree cleanliness
- deployment when the phase requires production deployment
- production smoke tests where credentials/access permit

Never treat a textual “tests passed” claim as sufficient if the report does not identify what actually ran.

When frontend behavior is a requirement, backend serialization tests alone are not equivalent to browser/UI E2E validation.

For critical flows, prefer deterministic acceptance criteria with explicit evidence:

- HTTP status
- task status
- commit SHA
- workspace path where relevant
- actual test counts
- deployment/version ID
- browser behavior when UI is part of the requirement

---

# 21. SECURITY CONTRACT

Non-negotiables:

1. No secrets in Git.
2. No secrets in client bundles.
3. No secrets in logs/task results.
4. Server-side authoritative auth.
5. Client headers cannot elevate role.
6. Request-body roles cannot elevate role.
7. CEO authority must come from authenticated authority.
8. Tenant isolation on all scoped records.
9. Project isolation where required.
10. No cross-tenant memory/lesson/intelligence leakage.
11. No governance mutation by agents.
12. No silent autonomous production/security approval.
13. No fake runtime evidence.
14. No raw prompt/credential duplication in organizational intelligence.
15. Preserve historical auditability rather than deleting evidence to hide failures.

---

# 22. DATA / TENANT ISOLATION

Every organizational feature must answer:

- Which tenant owns this data?
- Which project owns this data?
- Is global scope explicitly governed?
- Can a query accidentally return another tenant?
- Can a lesson/pattern/memory cross project boundaries without explicit governance?

Default posture: **deny cross-boundary access**.

GLOBAL is a governed scope, never an implicit convenience.

---

# 23. UNKNOWN-FIRST / EVIDENCE-FIRST

The system must prefer:

`UNKNOWN`

over an invented value.

Examples:

- insufficient organizational sample → UNKNOWN
- QA not run → NOT_RUN/UNKNOWN
- missing runtime evidence → do not infer success
- unresolved contradiction → remain unresolved/block promotion
- missing provenance → reject or quarantine rather than invent metadata

Current empirical evidence outranks historical success.

---

# 24. NO FAKE ACTIVITY — ABSOLUTE RULE

Never create:

- fake typing
- fake work
- fake agent conversations
- fake meetings
- fake task completion
- fake metrics
- fake reviews
- fake QA passes
- fake handoffs
- fake celebrations

Animations are acceptable only as representations of actual state/events or clearly local UI affordances that do not claim organizational truth.

---

# 25. CURRENT → GOVERNED → HISTORICAL PRECEDENCE

The universal mental model for future agents:

`CURRENT RUNTIME STATE`
`>` `CURRENT TASK EVIDENCE`
`>` `REAL REVIEW / QA / SECURITY EVIDENCE`
`>` `GOVERNED FEEDBACK SIGNALS`
`>` `VERIFIED PATTERNS`
`>` `GOVERNED INSTITUTIONAL LESSONS`
`>` `HISTORICAL ORGANIZATIONAL MEMORY`

A lesson can guide. It cannot overwrite reality.

A memory can inform. It cannot authorize.

An organizational insight can recommend. It cannot execute governance.

---

# 26. WHAT THE SYSTEM IS NOT

Do not accidentally turn PDL into:

- a generic chatbot SaaS
- a static AI dashboard
- a fake “AI employees” animation
- a BI dashboard as the primary product
- a vector-database-first RAG application
- an LLM deciding governance rules
- a model-specific product
- a system that trusts agent self-reported success
- a system that requires the human to manually shuttle prompts between GPT and a coding agent
- a disposable prototype that bypasses the real execution engine

---

# 27. WHAT THE SYSTEM SHOULD BECOME

The long-term trajectory is a genuine autonomous engineering organization.

Roadmap:

### Phase 8.7 — Daily Skill Learning & Organizational Compounding

Turn validated institutional lessons into reusable typed skills.

Proposed `SkillRecord` concepts:

- name
- description
- capability
- sourceExperiences
- confidence
- version
- applicableContexts
- limitations

Potential file:

`src/office/skills.ts`

Skills should be traceable to real experience and governed. They should not become a second ungoverned authority layer.

### Phase 8.8 — Governed Autonomous Execution & Adaptive Task Flow

Enable stronger autonomous orchestration:

- CoS multi-step pipelines
- automatic specialist delegation where allowed
- governed checkpoints
- adaptive response to organizational bottlenecks
- explicit CEO gates for critical operations

Autonomy must increase without removing sovereignty.

### Phase 8.9 — Multi-Project Ecosystem & Global Collaboration

Support multiple projects in one organizational workplace with:

- strict workspace isolation
- project switching
- governed cross-project learning
- explicitly approved global lessons/skills

### Phase 9.0 — Living Workplace & Office Turntable

Planned “Office Turntable”:

- CEO-controlled shared music environment
- uploaded/shared tracks
- lightweight environmental reactions
- non-blocking ambience

Also planned:

- richer spatial collaboration
- authentic movement for handoffs
- meeting-room interactions
- shared workplace atmosphere

These are secondary to engineering truth and execution reliability.

---

# 28. FUTURE ARCHITECTURE RULE FOR SKILLS / AUTONOMY

As autonomy increases, do not create a shortcut around governance.

Future compounding must remain:

`Experience → Evidence → Pattern → Candidate → Governance → Lesson → Skill → Governed Use → New Evidence`

Not:

`Agent said it worked → permanent rule`

Skills must carry:

- provenance
- version
- applicable context
- limitations
- confidence/evidence basis
- governance status where needed

A skill should never silently apply outside its validated context.

---

# 29. KNOWN HISTORICAL GAPS / WATCH ITEMS

These items were known at different milestones and should be re-audited before assuming they remain unresolved:

1. RouterProvider streaming was previously intentionally absent/hard-coded `stream:false`.
2. End-to-end API → worker → provider → finalizer → Git coverage was historically identified as a priority.
3. Runtime `AGENT_PROVIDER` selection needed explicit wiring verification at one point.
4. Fallback/retry metrics and logging were historically recommended.
5. Provider capability documentation was historically recommended.
6. Frontend lint/style cleanup was historically lower priority.
7. Awareness UI must always be verified at browser level when UI behavior is changed.
8. Awareness must remain a presentation/read model over organizational intelligence, not a duplicate business-logic engine.
9. Organizational intelligence currently works from bounded/runtime datasets rather than a dedicated historical warehouse.
10. Institutional learning intentionally avoids embeddings/vector search; do not add them just because they are fashionable.

Do not blindly implement an old gap. First inspect current repository state because later phases may have resolved it.

---

# 30. DOCUMENTATION CONTRACT

The repository should remain self-describing.

Relevant durable context files may include:

- `GPTMASTERCONTEXT.md` — this long-lived GPT/agent continuity context
- `THEOFFICEMASTERCONTEXT.md` — canonical THE OFFICE product/architecture context
- phase-specific `PHASE_*.md` documents
- project-specific context/handoff documents when applicable

When a major architectural decision changes the durable truth, update the relevant context document as part of the implementation, not as an afterthought.

Do not create multiple contradictory “master contexts”. If a conflict exists:

1. inspect repository implementation;
2. inspect tests;
3. inspect latest phase documentation;
4. reconcile this file and `THEOFFICEMASTERCONTEXT.md`;
5. make the newer validated implementation the truth;
6. preserve history rather than erasing it.

---

# 31. AUTONOMOUS AGENT OPERATING PROTOCOL

From this point forward, an autonomous agent working on PDL should follow this sequence without waiting for GPT to restate it:

## Step 1 — Orient

Read:

1. `GPTMASTERCONTEXT.md`
2. `THEOFFICEMASTERCONTEXT.md`
3. relevant phase documents
4. relevant source code
5. current tests
6. current Git status/history

## Step 2 — Determine current truth

Never assume that a historical commit is still the active implementation.

Inspect:

- current `HEAD`
- branch
- working tree
- production/deployment state when relevant
- actual routes
- actual runtime paths
- actual tests

## Step 3 — Audit before coding

For every new phase:

- identify existing source of truth
- identify duplicate logic risk
- identify authority boundaries
- identify data scope
- identify real evidence source
- identify tests
- identify UI/runtime implications

## Step 4 — Implement minimally

Prefer additive, typed, deterministic changes.

Do not rewrite stable foundations without evidence.

Do not replace working infrastructure with a new framework simply because it is easier to prototype.

## Step 5 — Validate empirically

Run the strongest relevant validation available:

- unit tests
- integration tests
- E2E
- typecheck
- build
- frontend build
- browser validation for UI
- security/tenant tests
- production smoke where appropriate

## Step 6 — Preserve continuity

Update context/phase docs when architecture or product behavior changes.

## Step 7 — Commit durable work

Use a meaningful English conventional commit.

Do not leave the repository in an ambiguous state.

## Step 8 — Deploy when required

Verify the actual deployment rather than merely claiming deployment.

## Step 9 — Report evidence

Final report must identify:

- what changed
- files
- tests and counts
- typecheck/build
- security/tenant validation
- production/deployment ID if deployed
- commit SHA
- remaining limitations
- whether the phase is IMPLEMENTED, ACCEPTED, or FROZEN

---

# 32. HARD STOP CONDITIONS

An autonomous agent must stop and surface the issue rather than “making it work” when:

- authentication authority is ambiguous
- tenant isolation cannot be proven
- a critical security rule would be weakened
- the agent would need to impersonate CEO authority
- real runtime evidence is unavailable but success is being requested as if it existed
- a review reaches `MAX_REVIEW_ITERATIONS = 3` with unresolved blocking findings
- a production approval is required but not granted
- a contradiction is unresolved where governance requires resolution
- a proposed change would replace a stable architecture without evidence
- a test/validation failure is being hidden or bypassed

---

# 33. HOW TO HANDLE OLD CONTEXT

This file contains both current principles and historical milestones.

When an old detail conflicts with current implementation:

**current validated code + current tests + current governed runtime state win.**

Historical commits are evidence of how the system evolved, not instructions to revert to the past.

The purpose of preserving history here is to prevent loss of product intent and architectural reasoning.

---

# 34. CURRENT ACCEPTANCE PHILOSOPHY

A phase is not “done” because:

- code compiles
- a test file exists
- an agent says it implemented the feature
- a deployment ID exists
- a UI screenshot looks good

A phase is done when its intended behavior is supported by:

`IMPLEMENTATION + REAL EVIDENCE + TESTS + SECURITY/GOVERNANCE + PERSISTENCE + VALIDATION`

For UI-heavy phases:

`IMPLEMENTATION + BACKEND TESTS + BROWSER BEHAVIOR + RUNTIME TRUTH`

For governance-heavy phases:

`IMPLEMENTATION + AUTHORITY TESTS + NEGATIVE TESTS + TENANT ISOLATION + AUDITABILITY`

---

# 35. MASTER PRODUCT NORTH STAR

The north star is not “make agents smarter”.

It is:

> **Build a trustworthy digital engineering organization that can understand objectives, coordinate specialist employees, execute real software work, inspect its own results, learn only from verified experience, expose its organizational state, and progressively compound its capabilities — while keeping the human CEO in control of critical decisions.**

THE OFFICE should eventually make this visible enough that the CEO can understand the organization simply by being in the office:

- who is working
- what they are working on
- who is waiting
- where work is blocked
- what is being reviewed
- what was learned
- what is improving
- what is at risk
- what needs the CEO
- what the organization can now do better than before

The office is therefore the **living control surface of the engineering organization**.

---

# 36. ABSOLUTE INVARIANT MATRIX

| Rule | Canonical Requirement |
|---|---|
| Office First | THE OFFICE is the primary product experience |
| CEO Sovereignty | Critical governance remains human-authorized |
| Current Truth | Current runtime/evidence beats history |
| Zero Fake Activity | Never fabricate organizational truth |
| Real Evidence | Agent self-report is not execution proof |
| Review Ceiling | `MAX_REVIEW_ITERATIONS = 3` is immutable unless explicitly governed by a future architecture change |
| Tenant Isolation | No cross-tenant leakage |
| Project Isolation | No accidental cross-project leakage |
| Global Scope | Explicitly governed, never implicit |
| Memory | Consultive, historical, never current authority |
| Lessons | Governed, evidence-backed, advisory unless policy explicitly defines otherwise |
| Intelligence | Read-only diagnosis, no governance mutation |
| Awareness | Office-facing read model, not duplicate intelligence authority |
| Recommendations | Human decision required |
| Secrets | Runtime-only |
| Persistence | Git/Postgres/repository docs preserve continuity |
| Model Independence | Product must not depend on one LLM/provider |
| pt-BR First | User-visible product language is Portuguese Brazil |
| Cloud First | Core execution lives in cloud runtime |
| Autonomous by Default | Routine allowed work should not require manual prompt shuttling |
| Human by Exception | Critical decisions require explicit CEO governance |

---

# 37. FINAL INSTRUCTION TO FUTURE AUTONOMOUS AGENTS

You are not starting a new project.

You are joining an existing organization whose engineering history, product philosophy, governance, memory and roadmap are documented here.

**Do not ask the human to paste this context again. Read it from the repository.**

Before asking for clarification, first inspect the repository, tests, current phase documents and runtime state. If the answer can be determined from durable project evidence, determine it yourself.

The human should be able to say a high-level objective and trust the PDL organization to:

`understand → plan → delegate → execute → review → validate → learn → report`

without the human acting as a message relay between GPT and the coding agent.

When uncertainty exists, surface it explicitly. Never replace uncertainty with fabricated certainty.

When a task is complete, leave durable evidence in the repository.

When a new architectural truth is established, update the durable context.

When the system learns, it must learn from reality.

When the system becomes more autonomous, it must remain governable.

When the office becomes more alive, it must become more truthful — never more fake.

---

## END OF GPTMASTERCONTEXT

**Canonical intent:** Preserve everything important about what PUB DEV LOOP is, what THE OFFICE is, what PUB Prototype contributed, what has already been built, why it was built that way, what must never be broken, and where the organization is going next — so autonomous engineering can continue without depending on the historical GPT chat.

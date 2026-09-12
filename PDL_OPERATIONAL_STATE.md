# PDL OPERATIONAL STATE

> **Canonical Operational Source of Truth for PUB DEV LOOP (PDL)**  
> **Last Updated:** 2026-09-12  
> **Operator:** MATHEUS  
> **Rule of Law:** Git repository state is the absolute operational source of truth.

---

## Current Phase

**Phase 5.5: Production Hardening, Autonomous Governance & Continuous Lifecycle**
* **Step 1:** Governance Gates Remediation & Hardening — **PROVEN & PUBLISHED**
* **Step 2:** Bounded Continuous Scheduler — **PROVEN & PUBLISHED**
* **Step 3:** Task-Level Retry Policy, DLQ & Poison Task Quarantine — **PROVEN & PUBLISHED**
* **Step 4:** Periodic Stale-Task Reaper & Lease Recovery — **PROVEN & PUBLISHED**
* **Step 5 / Step 6 / Campaign:** **NOT STARTED / EXPLICITLY BLOCKED** (Awaiting explicit authorization from MATHEUS)

---

## Current Published Commit

* **Step 4 Published Commit:** 2e4b262b7ea112cbf100f41b849e6d17f37ae45a (eat(pdl): add periodic stale task reaper)
* **Step 3 Published Commit:** 611ec49ca8dbb33d3679a0357f5eab7af8259792 (eat(pdl): add bounded retry and dead-letter quarantine)
* **Step 2 Published Commit:** d8ee4a7420ecd45ad4c65be4d369e9dcb08fbbbf (eat(pdl): add bounded continuous scheduler)
* **Step 1 Published Commit:** 2053d3349cff31b6458fa93187e22ed48ce5c620 (ix(pdl): harden phase 5.5 governance gates)
* **Phase 5.4 Frozen Baseline:** 53d0df0f5aa507154685f2ff6eb1de5008c9ff92 (eat(providers): consolidate canonical FREE MODELS ONLY routing policy and empirical benchmark evidence)

---

## Current Working Checkpoint

* **Type:** Consolidating Git as Absolute Operational Source of Truth
* **Scope:** Repository inventory, classification, recovery of operational evidence and historical diagnostics, hardening of .gitignore isolation rules, canonical operational state documentation, and agent entrypoint.

---

## Architecture

PDL (PUB DEV LOOP) is an autonomous, fail-closed, governed software delivery engine designed to orchestrate AI-assisted development loops across multiple product repositories without human intervention in the execution path, while maintaining absolute human authority over policy, governance, and promotion.

`
+-----------------------------------------------------------------------------------+
|                                 PDL ORCHESTRATION                                 |
|                                                                                   |
|  +---------------------------+       +-----------------------------------------+  |
|  |   Single Intake Authority | ----> |         Task Intake Service             |  |
|  |      (/tasks endpoint)    |       |   (validates, hashes & seals Exec Spec) |  |
|  +---------------------------+       +-----------------------------------------+  |
|                                                           |                       |
|                                                           v                       |
|  +---------------------------+       +-----------------------------------------+  |
|  |     Continuous Scheduler  | <---> |           PostgreSQL State DB           |  |
|  |   (concurrency bounded)   |       |  (tasks, execution_specs, sessions,    |  |
|  +---------------------------+       |   task_dlq, retry metadata)             |  |
|                |                     +-----------------------------------------+  |
|                v                                          ^                       |
|  +---------------------------+                            |                       |
|  |    Governance Engine      | (fail-closed pre-check)    |                       |
|  +---------------------------+                            |                       |
|                |                                          |                       |
|                v                                          |                       |
|  +---------------------------+       +--------------------+--------------------+  |
|  |       Worker Daemon       | ----> |            Periodic Reaper              |  |
|  |   (Lease Owner/Worker)    |       |  (detects stale leases, requeues/DLQs)  |  |
|  +---------------------------+       +-----------------------------------------+  |
|                |                                                                  |
|                v                                                                  |
|  +---------------------------+       +-----------------------------------------+  |
|  |   RouterProvider Engine   | ----> |     Remote Git Product Repositories     |  |
|  |  (FREE MODELS ONLY tier)  |       |    (projects/* isolated workspaces)     |  |
|  +---------------------------+       +-----------------------------------------+  |
+-----------------------------------------------------------------------------------+
`

### Core Components:
1. **Intake Service (src/pdl/service/task-intake-service.ts)**: Single point of task entry. Generates deterministic execution specifications, cryptographically hashes specs, and atomically persists tasks in PostgreSQL.
2. **PostgreSQL Repository (src/pdl/persistence/pg-task-repository.ts, src/pdl/persistence/session-repository.ts)**: Manages task lifecycle, leases (lease_owner, lease_deadline, heartbeat_at), retry states, and audit trails.
3. **Continuous Scheduler (src/pdl/service/continuous-scheduler.ts)**: Runs background poll loop (	ick()) respecting max concurrent active sessions, idle sleep, backoff on errors, and fail-closed shutdown.
4. **Governance Policy Engine (src/pdl/governance/policy-engine.ts)**: Evaluates strict pre-execution conditions: Kill-switch status, authorized product names, rate limits, workspace validation, and lease integrity. Rejects invalid tasks fail-closed (FAILED / REJECTED).
5. **Worker Daemon & Execution Engine (src/worker-service.ts, src/execution/)**: Acquires leases, provisions isolated workspace, orchestrates model reasoning via RouterProvider, applies code changes, validates integrity, runs builds/tests, and commits/pushes to the target product repository.
6. **Retry & DLQ Subsystem (src/pdl/service/task-retry-service.ts)**: Evaluates failure causes. Non-retryable/poison failures or attempts exceeding max limits transition tasks to DEAD_LETTER / QUARANTINED and record audit entries in 	ask_dlq.
7. **Periodic Reaper (src/pdl/service/periodic-reaper.ts)**: Background daemon scanning for abandoned leases (NOW() > lease_deadline). Stale tasks under retry limits are safely reclaimed (QUEUED with incremented retry count); tasks exceeding lease attempt limits are sent to DLQ.

---

## Governance

* **Fail-Closed Principle:** Any ambiguity, authorization failure, database disconnect, or rule violation immediately terminates the execution loop without committing code or advancing state.
* **Kill Switch:** pdl.kill_switch_enabled / PDL_KILL_SWITCH=true halts all task scheduling, lease acquisition, and worker execution immediately.
* **Lease Semantics:** Active tasks must hold an unexpired lease (lease_deadline). Heartbeats are required during execution. Workers failing to heartbeat lose their lease to the Periodic Reaper.
* **Run Rate Limits:** Enforced per product and globally to prevent runaway execution loops.
* **No Self-Modification:** PDL engine code is immutable to worker execution. Workers only operate within targeted external product workspaces.

---

## Scheduler

* **File:** src/pdl/service/continuous-scheduler.ts
* **Configuration:**
  * maxConcurrentSessions: Bounds parallel active sessions (default: 1).
  * pollIntervalMs: Tick frequency when idle (default: 1000ms).
  * errorBackoffMs: Backoff penalty when encountering database or infrastructure errors.
* **State Machine:** STOPPED -> RUNNING -> STOPPING -> STOPPED.
* **Lifecycle:** Controlled via start() and stop(). Gracefully finishes in-flight ticks before resolving stop promises.

---

## Retry / DLQ

* **Files:** src/pdl/service/task-retry-service.ts, db/migrations/023_pdl_task_retry_dlq.sql
* **Max Attempts:** Default 3 attempts (max_retries = 3).
* **Backoff Strategy:** Exponential backoff with jitter (initialBackoffMs: 1000, maxBackoffMs: 30000, ackoffFactor: 2).
* **Dead-Letter Queue (	ask_dlq):**
  * Records original_task_id, ailure_reason, error_details, 
etry_count, quarantined_at.
* **Poison Task Quarantine:** Tasks failing due to deterministic poison errors (syntax errors, security violations, unrecoverable spec violations) bypass retry loops and are quarantined immediately.

---

## Reaper

* **File:** src/pdl/service/periodic-reaper.ts
* **Sweep Frequency:** Default every 30 seconds (sweepIntervalMs: 30000), configurable per environment.
* **Stale Threshold:** Tasks in RUNNING or IN_PROGRESS status where lease_deadline < NOW().
* **Recovery Action:**
  * If 
etry_count < max_retries: Requeues task to QUEUED, resets lease fields, logs audit event.
  * If 
etry_count >= max_retries: Moves task to DEAD_LETTER / FAILED, writes record to 	ask_dlq.
* **Kill-Switch Aware:** Suspends recovery sweeps if kill switch is activated.

---

## Provider Policy

* **Canonical Engine:** RouterProvider (src/providers/router.ts)
* **Protocol Enforcement:** Alternating role turns (user/assistant), valid tool calls, strict function calling formatting.
* **Model Registry:** Managed via src/providers/registry.ts and src/providers/policy.ts.
* **State Machine:** Robust parsing of tool arguments, error recovery on malformed json, timeout management.

---

## FREE MODELS ONLY

* **Policy Mandate:** PDL is strictly governed to run ONLY on zero-cost free model tiers.
* **Tiers:**
  * **Primary:** Groq Free Tier (llama-3.3-70b-versatile, deepseek-r1-distill-llama-70b).
  * **Secondary:** OpenRouter Free Tier (openrouter/free, qwen/qwen-2.5-coder-32b-instruct:free).
  * **Tertiary:** HuggingFace / Gemini Free APIs.
* **Prohibitions:** NO paid OpenAI API, NO paid Anthropic API, NO credit cards attached to engine execution paths.
* **Rate Limits:** If daily free tier quotas are exhausted (HTTP 429), PDL fails closed and backs off until reset, rather than failing over to paid services.

---

## Product Isolation

* **Engine vs Product Repositories:** PDL is an orchestration engine. The code for products (e.g., pub-rate-calculator, pub-servers, uzios-de-cima, pub-leads) is completely isolated in separate git repositories or workspace directories under projects/.
* **Git Hygiene:** External product repositories, clones, and local workspaces are strictly excluded via .gitignore and must never be staged or committed into the PDL engine repository.
* **Zero Leakage:** Product secrets, tokens, and domain assets must not enter PDL commit history.

---

## PP Isolation

* **Historical Boundary:** PP (Prototype Platform) was extracted and decoupled from PDL in Phase 4B/4C (commit c2bc2b6).
* **Separation Rules:**
  * PDL does not depend on internal PP database tables or private APIs.
  * Integration occurs solely through defined repository boundaries and explicit task intake payloads.
  * Detailed in docs/PUB_PP_INTEGRATION_BOUNDARY.md and PP_REPOSITORY_EXTRACTION_PLAN.md.

---

## Current Proven Capabilities

1. **Deterministic Intake & Execution Specs:** Intake validates, parses, and seals execution specifications with SHA-256 integrity hashing.
2. **PostgreSQL Lease Concurrency:** Safe atomic task leasing preventing double-allocation among workers.
3. **Autonomous End-to-End Execution:** Proven in Phase 4D/4E/5.4 — PDL autonomously pulls remote GitHub product repos, invokes free LLM inference, applies code edits, executes local product tests, commits, and pushes branch updates.
4. **Governed Continuous Scheduler:** Autonomous tick-based worker dispatch with strict concurrency ceilings.
5. **Automated Retry, DLQ & Quarantine:** Robust resilience against transient failures without infinite loops.
6. **Periodic Stale-Task Reaper:** Autonomous cleanup and recovery of crashed or abandoned leases.
7. **Complete 100% Test Pass Rate:** Vitest unit, integration, and governance test suites pass cleanly.

---

## Known Limitations

1. **Single-Worker Baseline:** Current verified production tests run with concurrency bound of 1. Multi-worker scaling requires distributed lock testing.
2. **Free Model Rate Limits:** Free tier providers periodically enforce strict requests-per-minute (RPM) and tokens-per-day limits (e.g. OpenRouter 429 daily quota).
3. **Campaign Layer Absent:** Multi-step strategic campaign orchestration across multiple dependent repositories (Step 5) is not yet implemented.

---

## Recent Commits

`	ext
2e4b262 feat(pdl): add periodic stale task reaper
611ec49 feat(pdl): add bounded retry and dead-letter quarantine
d8ee4a7 feat(pdl): add bounded continuous scheduler
2053d33 fix(pdl): harden phase 5.5 governance gates
53d0df0 feat(providers): consolidate canonical FREE MODELS ONLY routing policy and empirical benchmark evidence
9b5fc52 feat(providers): implement canonical model routing policy, registry and protocol turn fix
d687c6c fix(pdl): correct router provider tool-call state machine
e53e758 feat(pdl): implement canonical remote product finalization layer
4244269 docs(pdl): consolidate phase 5.3 correction-loop baseline
96f1d0a feat(phase5): internal autonomous product factory
c37b918 feat(phase4f): operationalize sovereign daemons, repo authorization and resilience
bed8077 feat(pdl): Phase 4D.1 real inference and remote GitHub verification
3bda388 feat(pdl): Phase 4D real product pilot validation, autonomous mock build support and operational report
f0ef950 docs(pdl): add phase 4C operational contract and runbook
9c1fc54 feat(pdl): complete phase 4B daemon independence
`

---

## Uncommitted Work Recovered

During this operational checkpoint, the following local assets were recovered, audited, classified, and committed into canonical Git tracking:
1. **Historical Forensic & Diagnostic Reports (Category B):**
   * 3C.5-PROPOSED-SPEC.md, 3C.6-PROPOSED-SPEC.md
   * HERMES-FALLBACK-DIAGNOSTIC.txt, HERMES-POSTGRES-DIAGNOSTIC.txt
   * PHASE-3C-2-CORRECTION.md, PHASE-3C-2-FINAL-FORENSIC.md, PHASE-3C-2-FORENSIC-AUDIT.md, PHASE-3C-2-REPORT.md
   * PHASE4D1_FINAL_FORENSIC_RECONCILIATION.md
   * PHASE4E_BASELINE.md, PHASE4E_PRODUCT_CANDIDATES.md, PHASE4E_REAL_PUB_PRODUCT_REPORT.md
   * PP_REPOSITORY_EXTRACTION_PLAN.md, RECOVERY-NOTE.md
2. **Phase 5.5 Evidence Artifacts (Category B):**
   * docs/evidence/phase5.5/PHASE_5_5_ARCHITECTURAL_AUDIT.md
   * docs/evidence/phase5.5/PHASE_5_5_STEP1_GOVERNANCE_EVIDENCE.md
   * docs/evidence/phase5.5/PHASE_5_5_STEP1_REMEDIATION_EVIDENCE.md
   * docs/evidence/phase5.5/PHASE_5_5_STEP2_CONTINUOUS_SCHEDULER_EVIDENCE.md
   * docs/evidence/phase5.5/PHASE_5_5_STEP3_RETRY_DLQ_EVIDENCE.md
   * docs/evidence/phase5.5/PHASE_5_5_STEP4_REAPER_EVIDENCE.md
3. **Execution Test Suite (Category A):**
   * 	ests/execution/changed-files-handoff.test.ts
4. **Task Submission Tooling (Category A):**
   * submit-real-task.mjs (environment-configurable API target)
5. **Product & Workspace Isolation Rules (Category A):**
   * Hardened .gitignore to prevent accidental inclusion of projects/, product clones, and scratch files.

---

## Decisions

* **ADR-001: Git as Absolute Operational Source of Truth.** No operational state may exist solely in agent memory, ephemeral scratchpads, or chat transcripts. All state must be reproducible from git history.
* **ADR-002: Fail-Closed Autonomous Governance.** Workers and schedulers must immediately abort if policy checks or database connectivity fail.
* **ADR-003: Strict FREE MODELS ONLY Mandate.** Paid AI model calls are strictly forbidden in automated loops.
* **ADR-004: Mandatory Lease Heartbeats & Reaper Sweep.** Stale tasks are reclaimed via explicit lease expiration timestamps rather than arbitrary timeouts.

---

## Open Problems

1. **Provider Rate Limiting:** Daily quotas on free-tier providers (e.g. OpenRouter 429) can stall execution cycles until quota resets.
2. **E2E Live Multi-Project Verification:** While individual tasks in pub-rate-calculator succeed, running continuous multi-product pipelines requires Step 5 Campaign orchestration.

---

## Explicitly Blocked Work

The following initiatives are **strictly forbidden** until explicit written authorization from MATHEUS:
* **Phase 5.5 Step 5 / Step 6 / Campaign Orchestration**
* **Unrestricted Autonomy / Level 5 Autonomy**
* **Paid Model Integration / SaaS billing / Commercialization**
* **Modifications to Product Repositories from PDL Engine Commits**
* **Self-Modifying Code Loops**

---

## Next Authorized Action

* **Current Step:** Complete Git Checkpoint publication.
* **Next Action:** Wait for explicit review and task instruction from **MATHEUS**.

---

## AGENT HANDOFF

`	ext
CURRENT_STATE = STABLE_VERIFIED
OPERATOR = MATHEUS
LAST_VERIFIED_COMMIT = 2e4b262b7ea112cbf100f41b849e6d17f37ae45a
CURRENT_PHASE = 5.5
CURRENT_STEP = 4 (COMPLETED)
WHAT_IS_PROVEN = Governance hardening (Step 1), Bounded Continuous Scheduler (Step 2), Task Retry / DLQ (Step 3), Periodic Reaper (Step 4), RouterProvider FREE MODELS ONLY routing, PostgreSQL lease lifecycle.
WHAT_IS_NOT_PROVEN = Multi-worker parallel leasing under high contention, Campaign orchestration (Step 5).
WHAT_MUST_NOT_BE_CHANGED = FREE MODELS ONLY policy, Fail-closed governance engine, Product Isolation boundaries, Database migrations 001-023 integrity.
WHAT_IS_BLOCKED = Phase 5.5 Step 5 / Campaign, SaaS, paid models, unrestricted autonomy.
WHAT_REQUIRES_HUMAN_AUTHORIZATION = Advancing to Step 5, schema modifications, external network promotions, production deployments. All authorizations must come exclusively from MATHEUS.
HOW_TO_VERIFY_STATE = Run 
pm run typecheck, 
pm run build, and 
px vitest run tests/pdl/ tests/execution/.
WHERE_TO_CONTINUE = Read AGENTS.md, inspect git log, and await instruction from MATHEUS.
`

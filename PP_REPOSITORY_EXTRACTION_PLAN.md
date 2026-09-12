# PP REPOSITORY EXTRACTION PLAN
## Decoupling & Sovereign Repository Extraction Architecture

**Target Date:** September 2026  
**Document Authority:** Antigravity Engineering (Phase 3D Pre-Extraction Gate)  
**Baseline Commit (PDL):** `6639d58663eb4291dd27fb0d7b10764a2266728f`  
**Current Working Directory:** `C:/Users/Matheus Paes/Documents/ChatGPT/PUB DEV LOOP`  

---

## 1. EXECUTIVE SUMMARY

The PUB DEV LOOP (PDL) monorepo currently houses two structurally distinct systems:
1. **PUB DEV LOOP (PDL):** Production autonomous engineering loop, task intake, preflight research, prompt refinement, multi-tier LLM routing, sealed `ExecutionSpec` engine, in-process workspace correction, and git push finalization.
2. **PUB PROTOTYPE (PP):** Rapid prototype sandbox, ephemeral prototype sessions, user chat prompts, checkpoint management, real-time comparison preview runtime, and promotion to engineering.

While structural ownership was established in commits `6837519` (PP) and `87857d5` (PDL), physical extraction into two independent Git repositories has been blocked by four architectural coupling points:
* **Blocker 1:** Uncommitted Gate 3D worktree (3D.1 through 3D.4).
* **Blocker 2:** Physical PostgreSQL foreign key binding between `tasks.prototype_session_id` and `prototype_sessions(id)`.
* **Blocker 3:** Monolithic legacy runtime (`src/mode-aware-worker.ts`, `src/worker.ts`, `src/api.ts`, `src/api-worker.ts`).
* **Blocker 4:** Type-only import coupling from `src/pdl/handoff/adapter.ts` to `src/pp/handoff/handoff.ts`.

This document establishes the forensically verified architecture, boundary decoupling strategy, and step-by-step extraction plan to separate PP and PDL without regression or data loss.

---

## 2. CURRENT VS TARGET ARCHITECTURE

### Current Architecture (Monorepo with Residual Couplers)
```
┌────────────────────────────────────────────────────────────────────────┐
│ PUB DEV LOOP REPOSITORY (pub-dev-loop)                                 │
│                                                                        │
│   ┌───────────────────────────┐      ┌───────────────────────────────┐ │
│   │   PUB DEV LOOP (PDL)      │      │     PUB PROTOTYPE (PP)        │ │
│   │   src/pdl/                │      │     src/pp/                   │ │
│   │   - api/entry.ts (3001)   │      │     - api/entry.ts (3002)     │ │
│   │   - worker/entry.ts(3003) │      │     - worker/entry.ts (3004)  │ │
│   │   - correction/           │      │     - preview/                │ │
│   │   - refinement/           │      │     - events/                 │ │
│   │   - research/             │      │     - persistence/            │ │
│   │   - service/              │      │     - handoff/                │ │
│   └─────────────┬─────────────┘      └───────────────┬───────────────┘ │
│                 │ import type PdlTaskIngestionPort   │                 │
│                 └────────────────────────────────────┘                 │
│                                                                        │
│   ┌──────────────────────────────────────────────────────────────────┐ │
│   │ RESIDUAL COUPLERS (Shared Core & Legacy)                         │ │
│   │ - src/mode-aware-worker.ts (runs PrototypeWorker + RouterWorker) │ │
│   │ - src/worker.ts (instantiates ModeAwareWorker by default)        │ │
│   │ - src/api.ts (mounts /prototype routes on PDL API)               │ │
│   │ - src/api-worker.ts (unified Cloudflare worker)                  │ │
│   └──────────────────────────────────────────────────────────────────┘ │
│                                                                        │
│   ┌──────────────────────────────────────────────────────────────────┐ │
│   │ SHARED POSTGRESQL DATABASE                                       │ │
│   │ - tasks (PDL)                                                    │ │
│   │   └── prototype_session_id ──FK──> prototype_sessions (PP)       │ │
│   │ - prototype_tasks (PP sovereign repo)                            │ │
│   │ - execution_specs (PDL)                                          │ │
│   │ - organizational_memory (The Office)                             │ │
│   └──────────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────┘
```

### Target Architecture (Two Fully Sovereign Repositories & Services)
```
┌──────────────────────────────────────┐     ┌──────────────────────────────────────┐
│ REPOSITORY: pub-dev-loop (PDL)       │     │ REPOSITORY: pub-prototype (PP)       │
│                                      │     │                                      │
│ - src/pdl/api/entry.ts (Port 3001)   │     │ - src/api/entry.ts (Port 3002)       │
│ - src/pdl/worker/entry.ts (Port 3003)│     │ - src/worker/entry.ts (Port 3004)    │
│ - The Office (59 Agents)             │     │ - Preview Runtime (Local + Public)   │
│ - Execution Engine (Sealed Spec)     │     │ - SSE Event Publisher & Bridge       │
│ - In-Process Workspace Correction    │     │ - Checkpoint & Session Store         │
│ - Autonomous Execution Controller    │     │ - Prototype Worker                   │
│                                      │     │                                      │
│ Ingestion Endpoint:                  │     │ Outbound Handoff Client:             │
│ POST /tasks                          │◄────┼─ HTTP REST Promotion Call            │
│ Header: X-Source: prototype-promotion│     │ (Sends: project, repo, branch, sha)  │
│                                      │     │                                      │
│ DATABASE: pub_dev_loop               │     │ DATABASE: pub_prototype              │
│ - tasks                              │     │ - prototype_sessions                 │
│   (optional correlation id:          │     │ - prototype_tasks                    │
│    origin_session_id UUID unlinked)  │     │ - prototype_checkpoints              │
│ - execution_specs                    │     │ - prototype_events                   │
│ - organizational_memory              │     │ - prototype_promotions               │
│ - autonomous_pipelines               │     │ - prototype_messages                 │
└──────────────────────────────────────┘     └──────────────────────────────────────┘
```

---

## 3. BLOCKER 1 — 3D WORKTREE PRESERVATION & SELECTIVE COMMIT

### Audit of Current Worktree State
* **Tracked Modified Files:**
  1. `src/pdl/service/task-intake-service.ts` (Connects intake to research/refinement)
  2. `src/pdl/worker/entry.ts` (Instantiates `PdlCorrectionWorker`)
* **Untracked PDL Production Files:**
  1. `src/pdl/research/` (6 files: `context-source.ts`, `documentation-lookup.ts`, `index.ts`, `preflight-engine.ts`, `repository-inspector.ts`, `skill-discovery.ts`)
  2. `src/pdl/refinement/` (3 files: `index.ts`, `refinement-engine.ts`, `refinement-provider.ts`)
  3. `src/pdl/correction/` (6 files: `correction-loop.ts`, `diagnostic-parser.ts`, `error-classifier.ts`, `index.ts`, `secret-redaction.ts`, `types.ts`)
  4. `src/pdl/worker/correction-worker.ts`
  5. `src/pdl/worker/index.ts`
* **Untracked PDL Test Files:**
  1. `tests/pdl-preflight.test.ts`
  2. `tests/pdl-refinement.test.ts`
  3. `tests/pdl-error-classifier.test.ts`
  4. `tests/pdl-correction-loop.test.ts`
  5. `tests/execution/phase-3c-intake-authority.test.ts`
* **PP Files in Worktree:**
  * Exactly **0** uncommitted PP files. PP is 100% committed in HEAD.

### Preservation Strategy
Before touching any extraction logic or database boundaries, the PDL 3D work must be committed to `main`:
1. `git add src/pdl/ tests/pdl* tests/execution/phase-3c-intake-authority.test.ts`
2. Commit with message: `feat(pdl): implement autonomous execution maturity (Gate 3D.1 - 3D.4)`
3. Verify `git status` confirms zero pending changes in `src/pdl` and `tests/`.

---

## 4. BLOCKER 2 — DATABASE BOUNDARY DECOUPLING

### Analysis of `004_prototype_task_binding.sql`
Line 5 of `db/migrations/004_prototype_task_binding.sql` executes:
```sql
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS prototype_session_id UUID REFERENCES prototype_sessions(id) ON DELETE SET NULL;
```
This introduces a physical database foreign key from the PDL table `tasks` to the PP table `prototype_sessions`.

### Consumer Audit of `prototypeSessionId` / `prototype_session_id`

| Consumer | File Location | Purpose | Post-Separation Treatment |
| :--- | :--- | :--- | :--- |
| **`Task` Domain Interface** | `src/domain.ts:25` | Declares optional `prototypeSessionId: string \| null` on Task | Retain as optional metadata field or generic `externalCorrelationId` |
| **`PostgresTaskRepository`** | `src/repository.ts:47,75` | Maps column `prototype_session_id` | Retain column mapping in PDL, drop SQL foreign key constraint |
| **`BaseWorker.executeOnce`** | `src/worker-service.ts:479` | `if (!task.prototypeSessionId)` skips git push | In sovereign PDL, all claimed tasks are PDL tasks. Push policy governed by `ExecutionSpec.specType !== 'PROTOTYPE'` or explicit flag |
| **`PdlCorrectionWorker`** | `src/pdl/worker/correction-worker.ts:242` | Skips git push if `task.prototypeSessionId` is truthy | Same as above |
| **`PdlTaskIngestionAdapter`**| `src/pdl/handoff/adapter.ts:72` | Records `prototypeSessionId` into `task.result` JSONB | Store in JSONB `result.prototypeSessionId` as correlation metadata |
| **The Office Intent/Planning**| `src/office/intent.ts:770`, `planning.ts:255` | Hardcodes `prototypeSessionId: null` | Keep as null or remove when property deprecated |
| **PP Repository** | `src/pp/persistence/task-repository.ts` | Queries `prototype_tasks` table | PP will own its database containing `prototype_tasks` |

### Database Decoupling Solution
1. **PDL Database:**
   * Drop the physical Foreign Key constraint in PDL:
     ```sql
     ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_prototype_session_id_fkey;
     ```
   * The column `tasks.prototype_session_id UUID` remains in PDL as an **unconstrained correlation ID** (index retained for trace lookups).
   * All promotion context (session ID, promotion ID, checkpoint SHA) is stored immutably in `tasks.result JSONB`.
   * When PP is removed, PP tables (`prototype_sessions`, `prototype_checkpoints`, `prototype_events`, `prototype_promotions`, `prototype_messages`) will be removed from PDL migrations.
2. **PP Database:**
   * Migration in PP repository creates all PP tables: `prototype_sessions`, `prototype_checkpoints`, `prototype_events`, `prototype_promotions`, `prototype_messages`.
   * Migration creates `prototype_tasks` (incorporating what `PostgresPpTaskRepository` already queries).
   * PP has zero foreign keys pointing to PDL tables.

---

## 5. BLOCKER 3 — LEGACY RUNTIME RETIREMENT PLAN

### Monolithic Couplers Audit

| File | Nature of Coupling | Risk | Target Action |
| :--- | :--- | :--- | :--- |
| `src/mode-aware-worker.ts` | Imports `PrototypeWorker` and `RouterWorker`, alternate execution in loop | High: Keeps both runtimes alive in same heap | **MUST_REMOVE** in PDL upon extraction. Already marked `@deprecated`. |
| `src/worker.ts` | Calls `createProductionWorker()` which defaults to `ModeAwareWorker` | High: Production entrypoint still invokes dual mode | **MUST_REFACTOR** to export dedicated PDL worker runner. |
| `src/api.ts` | Express app mounting `/tasks` and `/prototype/sessions/:id` | Medium: Legacy monolith API | **MUST_REFACTOR**: Remove `/prototype` route from PDL; redirect to `src/pdl/api/entry.ts`. |
| `src/api-worker.ts` | Monolithic Cloudflare Worker with embedded SQL & routing for both | Medium: Monolithic serverless bundle | **MUST_DEPRECATE**: Split into PDL API deployment and PP API deployment. |

### Migration to Dedicated Entrypoints

| Subsystem | Dedicated Worker Entrypoint | Dedicated API Entrypoint | Port | Command |
| :--- | :--- | :--- | :--- | :--- |
| **PDL** | `src/pdl/worker/entry.ts` | `src/pdl/api/entry.ts` | 3001 (API), 3003 (Worker Health) | `npm run pdl:api`<br>`npm run pdl:worker` |
| **PP** | `src/pp/worker/entry.ts` | `src/pp/api/entry.ts` | 3002 (API), 3004 (Worker Health) | `npm run pp:api`<br>`npm run pp:worker` |

---

## 6. BLOCKER 4 — HANDOFF CONTRACT & BOUNDARY INVERSION

### Current Problem
In `src/pdl/handoff/adapter.ts`:
```typescript
import type {
  PdlTaskIngestionPort,
  PdlTaskIngestionRequest,
  PdlTaskIngestionResult,
} from '../../pp/handoff/handoff.js';
```
PDL imports a type definition from an internal PP directory. If `src/pp` is deleted from PDL, `src/pdl/handoff/adapter.ts` will fail compilation.

### Decoupled Boundary Architecture
1. **PDL-Owned Ingestion Contract:**
   Create `src/pdl/handoff/types.ts` in PDL containing the authoritative task ingestion contracts:
   ```typescript
   export interface PdlTaskIngestionRequest {
     project: string;
     repository: string;
     branch: string;
     checkpointSha: string;
     promotionId: string;
     prototypeSessionId: string;
     objective: string;
     prompt: string;
     priority?: number;
   }

   export interface PdlTaskIngestionResult {
     id: string;
     taskId: string;
     status?: string;
     branch?: string | null;
     repository?: string;
     prototypeSessionId?: string | null;
     result?: Record<string, unknown> | null;
   }

   export interface PdlTaskIngestionPort {
     ingest(request: PdlTaskIngestionRequest): Promise<PdlTaskIngestionResult>;
   }
   ```
2. **PDL Adapter Update:**
   Update `src/pdl/handoff/adapter.ts` to import `PdlTaskIngestionPort` from `./types.js` instead of `../../pp/handoff/handoff.js`.
3. **PP Outbound Handoff:**
   In PP (`src/pp/handoff/handoff.ts`), PP defines its client adapter that issues an HTTP `POST /tasks` request to the PDL API or uses the identical schema.
4. **Result:**
   **0 cross-repository imports.** Both repositories are self-contained.

---

## 7. FILE MANIFEST FOR EXTRACTION

### A. PP Files to Extract into New Repository (`pub-prototype`)
* **Source (`src/`):**
  * `src/pp/api/` $\rightarrow$ `src/api/`
  * `src/pp/domain/` $\rightarrow$ `src/domain/`
  * `src/pp/events/` $\rightarrow$ `src/events/`
  * `src/pp/handoff/` $\rightarrow$ `src/handoff/`
  * `src/pp/persistence/` $\rightarrow$ `src/persistence/`
  * `src/pp/preview/` $\rightarrow$ `src/preview/`
  * `src/pp/ui/` $\rightarrow$ `src/ui/`
  * `src/pp/worker/` $\rightarrow$ `src/worker/`
  * `src/pp/validation.ts` $\rightarrow$ `src/validation.ts`
  * `src/pp/index.ts` $\rightarrow$ `src/index.ts`
* **Shared Utilities Needed by PP:**
  * Provider adapters (`src/providers/` or minimal OpenRouter client)
  * `TaskFinalizer` and `captureWorkspaceSnapshot` (minimal Git helper)
* **Migrations (`db/migrations/`):**
  * `003_prototype.sql` $\rightarrow$ `001_initial_prototype.sql`
  * `006_prototype_events.sql` $\rightarrow$ `002_prototype_events.sql`
  * `007_prototype_promotions.sql` $\rightarrow$ `003_prototype_promotions.sql`
  * `008_prototype_messages.sql` $\rightarrow$ `004_prototype_messages.sql`
  * `009_prototype_events_idempotency.sql` $\rightarrow$ `005_prototype_idempotency.sql`
  * `006_prototype_tasks.sql` (Creates sovereign `prototype_tasks` table)
* **Tests (`tests/`):**
  * All 16 PP test suites: `tests/prototype*.ts`, `tests/event-bridge*.ts`, `tests/correction-controller.test.ts`, `tests/e2e*preview.test.ts`.
* **Documentation (`docs/`):**
  * `docs/PUB_PROTOTYPE_*.md`

### B. PDL Files to Retain in `pub-dev-loop`
* `src/pdl/` (all API, correction, handoff, refinement, research, service, worker modules)
* `src/execution/` (sealed ExecutionSpec engine & persistence)
* `src/task/` (ExecutionSpec interfaces & semantics)
* `src/office/` (The Office 59-agent organization, Memory, Pipelines, Governance)
* `src/context/` (Intent Engine, EngineeringTask, Context Resolver)
* `src/routing/` (Routing classifier, fallback chains)
* `src/providers/` (Anthropic, OpenAI, OpenRouter, streaming)
* `src/tools/` (Agent execution tools)
* `src/finalizer.ts`, `src/agent.ts`, `src/domain.ts`, `src/repository.ts`, `src/worker-service.ts`, `src/router-worker.ts`
* `frontend/` (React 3D office viewer)
* PDL Migrations: `001_initial.sql`, `002_lease.sql`, `010` through `019`.

---

## 8. 15-STEP EXTRACTION SEQUENCE

The 15-step sequence evaluated in the audit is fully endorsed, with precise sub-actions defined:

```
Step  1: Formal freeze and selective commit of PDL Phase 3D (3D.1 - 3D.4).
Step  2: Resolve handoff contract: create src/pdl/handoff/types.ts and decouple adapter.ts.
Step  3: Resolve database boundary: remove physical FK constraint from tasks.prototype_session_id.
Step  4: Decommission/deprecate legacy monolithic runtime (src/mode-aware-worker.ts).
Step  5: Run complete PDL test suite in isolation (npm run typecheck, vitest run tests/execution, tests/pdl*).
Step  6: Run complete PP test suite in isolation within monorepo (vitest run tests/prototype*).
Step  7: Initialize the new PP repository (pubcoreagencia/pub-prototype).
Step  8: Extract PP source files, migrations, tests, and documentation into the new repository.
Step  9: Remove src/pp, tests/prototype*, and PP migrations from PDL repository.
Step 10: Validate PDL independently (confirm 0 PP dependencies, clean typecheck, 100% GREEN tests).
Step 11: Validate PP independently (clean typecheck, 100% GREEN tests in new repository).
Step 12: Validate cross-system integration via HTTP handoff contract (PP promotion -> PDL /tasks).
Step 13: Commit clean decoupled PDL repository.
Step 14: Commit sovereign PP repository.
Step 15: Push both repositories only after double GREEN verification.
```

---

## 9. RISK & MITIGATION MATRIX

| Risk | Likelihood | Impact | Mitigation |
| :--- | :--- | :--- | :--- |
| **Accidental Loss of 3D Work** | Medium | Severe | Freeze and commit Gate 3D.4 first (Step 1) before performing any file manipulations. |
| **Broken Foreign Key in Production DB** | Low | High | Use `ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_prototype_session_id_fkey;` so existing data remains untouched while decoupling schema. |
| **TypeScript Import Breakages in PDL** | Low | High | Step 2 moves boundary types to `src/pdl/handoff/types.ts` before PP removal, guaranteeing zero broken imports. |
| **Duplicate Provider Code in PP** | Low | Medium | PP only requires basic LLM execution and preview; provider adapters in PP will be clean and focused. |

---

## 10. CONCLUSION

The architectural boundary between PDL and PP is verified and ready for decoupling. By addressing the four blockers (3D worktree freeze, unconstrained correlation ID, self-contained handoff types, and retirement of `ModeAwareWorker`), repository separation can proceed deterministically with **zero regression risk**.

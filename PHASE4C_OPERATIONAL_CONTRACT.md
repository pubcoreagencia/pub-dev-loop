# PHASE 4C — OPERATIONAL CONTRACT
## SOVEREIGN MULTI-REPOSITORY PRODUCTION ARCHITECTURE

### 1. Architectural Topology & Service Boundaries

The production architecture consists of two sovereign, decoupled systems communicating exclusively over HTTP:

```text
┌────────────────────────────────────────┐          ┌────────────────────────────────────────┐
│             PUB PROTOTYPE              │          │             PUB DEV LOOP               │
│         (Interactive Prototyping)      │          │       (Autonomous Engineering)         │
│                                        │          │                                        │
│  ┌──────────────┐    ┌──────────────┐  │          │  ┌──────────────┐    ┌──────────────┐  │
│  │    PP API    │    │  PP Worker   │  │          │  │   PDL API    │    │  PDL Worker  │  │
│  │ (Port 3001)  │    │ (Port 3002)  │  │          │  │ (Port 3000)  │    │ (Port 3004)  │  │
│  └──────┬───────┘    └──────┬───────┘  │          │  └──────▲───────┘    └──────┬───────┘  │
│         │                   │          │          │         │                   │          │
│         ▼                   ▼          │   HTTP   │         │                   ▼          │
│  ┌──────────────────────────────────┐  │  Handoff │  ┌──────────────────────────────────┐  │
│  │      PostgreSQL (PP Schema)      │  ├──────────┼─►│     PostgreSQL (PDL Schema)      │  │
│  │   pub_prototype_production      │  │          │  │    pub_dev_loop_production      │  │
│  └──────────────────────────────────┘  │          │  └──────────────────────────────────┘  │
└────────────────────────────────────────┘          └────────────────────────────────────────┘
```

---

### 2. Ownership Boundary Matrix

| Domain Area | PUB PROTOTYPE (`PP`) Owns | PUB DEV LOOP (`PDL`) Owns |
| :--- | :--- | :--- |
| **Interactive UX / Sessions** | `prototype_sessions`, prompts, conversational history | None |
| **Prototyping Tasks** | `prototype_tasks`, rapid iteration leases | None |
| **Checkpoints & Revisions** | `prototype_checkpoints`, session-level Git commit SHAs | None |
| **Preview Hosting** | Local and public ephemeral preview containers/runtimes | None |
| **Promotion Lifecycle** | Promotion trigger, approval state, handoff dispatch | None |
| **Ingestion Seam** | HTTP client (`HttpPdlTaskIngestionPort`) | HTTP endpoint (`POST /tasks/ingest`), `TaskIntakeService` |
| **Engineering Tasks** | None | `tasks` queue, leasing, lifecycle state machine |
| **Execution Specifications** | None | `execution_specs`, structural & semantic validation, sealing |
| **Autonomous Engineering** | None | `RouterWorker`, multi-model planning, tool execution |
| **Quality & Correction** | None | Test execution, linting, autonomous correction loop |
| **Result Finalization** | None | Git branch commits, diff summaries, durable persistence |

---

### 3. Cross-System Boundary Guarantees

1. **HTTP Only**: Communication between PP and PDL occurs strictly through HTTP REST endpoints (`POST /tasks/ingest`, `GET /tasks/:id`).
2. **Correlation IDs Only**: Information shared across boundaries is limited to correlation primitives (`prototypeSessionId`, `checkpointSha`, `project`, `repository`, `branch`, `objective`, `prompt`).
3. **Zero Shared Tables**: PP never reads or writes to PDL tables (`tasks`, `execution_specs`, etc.). PDL never reads or writes to PP tables (`prototype_sessions`, `prototype_tasks`, etc.).
4. **Zero Shared Database Connections**: PP process pools connect exclusively to PP databases. PDL process pools connect exclusively to PDL databases.
5. **Zero Cross-Database Foreign Keys**: Neither database has constraints pointing to the other.
6. **Zero Code Imports**: PP source code contains 0 internal imports from PDL. PDL source code contains 0 internal imports from PP.

---

### 4. Promotion Semantics

A PP promotion represents the formal transition from rapid interactive prototyping to autonomous engineering:

```text
Approved Prototype Checkpoint (PP)
               ↓
HTTP POST /tasks/ingest Payload (PP → PDL)
               ↓
Task Ingestion & Lineage Recording (PDL TaskIntakeService)
               ↓
Authoritative ExecutionSpec Created (PDL)
               ↓
ExecutionSpec Validated & SEALED (PDL)
               ↓
Queued in PDL Database (status='QUEUED', prototype_session_id=UUID)
               ↓
Autonomous Worker Claim & Execution (PDL Worker)
```

**Invariants**:
- PP **NEVER** mutates PDL task state directly.
- PP **NEVER** creates or alters `ExecutionSpec` records.
- If PDL is unreachable, PP fails closed with HTTP 502/503.
- Duplicate promotion requests from PP are idempotent and return the existing PDL task ID without side effects.

---

### 5. Target Repository Semantics

1. When PP promotes a prototype, it transmits the target Git repository, branch, and checkpoint commit SHA.
2. PDL clones or checks out the target repository into its own isolated worker workspace.
3. PDL operates strictly on its own filesystem workspace. It has **no dependency** on PP filesystem directories or memory.
4. PDL applies changes, executes tests, triggers correction if needed, creates a production Git commit, and persists the result to the PDL database.

---

### 6. Observability & Correlation Lineage

Every promoted task must be traceable end-to-end through its correlation lineage:

```text
promotionId (PP)
      ↓
prototypeSessionId (PP / PDL correlation key)
      ↓
pdlTaskId (PDL)
      ↓
executionSpecId (PDL)
      ↓
attempts / executionLogs (PDL)
      ↓
commitSha (Git target)
      ↓
finalStatus (PDL: COMPLETED / FAILED)
```

This lineage allows complete operational debugging and auditability across both repositories without requiring cross-database joins.

---

### 7. Security Model

1. **Untrusted Ingestion**: PP payloads received at `POST /tasks/ingest` are treated as untrusted external inputs.
2. **Authoritative Specification**: PDL constructs its own authoritative `ExecutionSpec` with validated permissions, resource limits, and governance constraints.
3. **Evidence Isolation**: Untrusted diagnostic evidence cannot elevate governance level or request privileged operations.
4. **Fail-Closed Target Security**: Tasks targeting unauthorized repositories or invalid branches are rejected immediately during intake/preflight.
5. **Secret Redaction**: Worker logging and persisted execution traces redact sensitive credentials before persisting to PostgreSQL.

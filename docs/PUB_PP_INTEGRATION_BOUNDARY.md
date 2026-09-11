# PUB DEV LOOP ↔ PUB PROTOTYPE INTEGRATION BOUNDARY (PHASE 3E)

## 1. Overview & Ownership Boundaries

The **PUB Prototype (PP)** and **PUB Dev Loop (PDL)** subsystems are completely sovereign, decoupled repositories. Communication occurs exclusively across an explicit, neutral boundary contract over HTTP.

### Entity & Identity Ownership
| Entity / ID | Owning Subsystem | Storage / Role in PDL |
|---|---|---|
| `prototypeSessionId` | PUB Prototype | Stored as `tasks.prototype_session_id` (unconstrained UUID logical correlation, **zero foreign key constraint**). |
| `promotionId` | PUB Prototype | Preserved inside `tasks.result.promotionId` JSON for deterministic idempotency auditing. |
| `checkpointSha` | PUB Prototype | Preserved inside `tasks.result.checkpointSha` JSON marking the promoted Git snapshot. |
| `pdlTaskId` (`id` / `taskId`) | PUB Dev Loop | Authoritative identifier for the created engineering task in `tasks.id`. |
| `ExecutionSpec` | PUB Dev Loop | Authoritative immutable execution specification constructed and sealed by PDL's `TaskIntakeService`. |
| `Task Status` | PUB Dev Loop | Governed exclusively by PDL `RouterWorker` / `PdlCorrectionWorker`. |

---

## 2. Ingestion Endpoint & Transport

- **Transport**: HTTP REST over `POST /tasks/ingest` (JSON)
- **Port Contract**: `PdlTaskIngestionPort` implemented by `PdlTaskIngestionAdapter`
- **Location**: `src/pdl/api/entry.ts` and `src/pdl/handoff/adapter.ts`

### Request Contract (`PdlTaskIngestionRequest`)
```json
{
  "project": "string (required)",
  "repository": "string (required)",
  "branch": "string (required)",
  "checkpointSha": "string (required)",
  "promotionId": "string (required)",
  "prototypeSessionId": "string (required)",
  "objective": "string (required)",
  "prompt": "string (required)",
  "priority": "number (optional, defaults to 0)"
}
```

### Response Contract (`PdlTaskIngestionResult`)
- **HTTP 201 Created**:
```json
{
  "id": "uuid",
  "taskId": "uuid",
  "status": "QUEUED",
  "branch": "string",
  "repository": "string",
  "prototypeSessionId": "uuid",
  "result": {
    "promotionId": "string",
    "prototypeSessionId": "string",
    "checkpointSha": "string"
  }
}
```

---

## 3. Idempotency & Failure Semantics

1. **Deterministic Idempotency**:
   - Every promotion handoff request from PP carries a unique `promotionId`.
   - When a request is received, `PdlTaskIngestionAdapter` checks for an existing task matching `promotionId` or `(branch && prototypeSessionId)`.
   - If an existing task is found, the same task is returned with HTTP 201 without creating duplicates.
2. **Validation & Malformed Payloads**:
   - Payloads missing any required fields return **HTTP 400 Bad Request** immediately.
   - Validation failures in the underlying specification engine return **HTTP 422 Unprocessable Entity**.
3. **Failure Classification for Upstream Clients**:
   - `HTTP 4xx`: **NON_RETRYABLE** (fails closed; invalid input).
   - `HTTP 5xx` or Network Timeout: **RETRYABLE** (safe to retry because `promotionId` prevents duplicate execution).

---

## 4. Security Boundary

- PP-originated payloads are treated as external, untrusted input.
- Neither `objective` nor `prompt` from the promotion request can override:
  - Repository target permissions or trust boundaries.
  - Governance policies or escalation conditions.
  - Core execution constraints.
- PDL's `TaskIntakeService` packages the request into `rawRequest` and `executionInstructions` while generating an authoritative, cryptographically sealed `ExecutionSpec`.

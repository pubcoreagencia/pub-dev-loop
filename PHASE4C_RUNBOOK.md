# PHASE 4C — OPERATIONAL RUNBOOK
## PRODUCTION OPERATION & RECOVERY PROCEDURES

### 1. Service Topology & Environment Configurations

#### PUB PROTOTYPE (PP)
- **PP API Daemon**:
  - Script: `src/pp/api/entry.ts`
  - Port: `3001` (or `PORT` / `PP_API_PORT`)
  - Environment:
    - `DATABASE_URL`: PostgreSQL connection string for PP database (`pub_prototype_production`)
    - `PDL_API_URL`: Base URL for PDL API (e.g. `http://127.0.0.1:3000`)
    - `RUN_PP_API`: `true`
  - Health Check: `GET /health` → `{"status":"ok","service":"pub-prototype-api"}`

- **PP Worker Daemon**:
  - Script: `src/pp/worker/entry.ts`
  - Port: `3002` (Health server)
  - Environment:
    - `DATABASE_URL`: PostgreSQL connection string for PP database
    - `PROTOTYPE_TEMPLATE_REPOSITORY`: Path or URL to template repository
    - `PROTOTYPE_WORKSPACES_ROOT`: Local path for prototype workspaces
    - `AGENT_PROVIDER`: `mock` | `router` | `codex-api`
    - `PP_WORKER_POLL_INTERVAL_MS`: Polling interval in ms (default: `1000`)
    - `RUN_PP_WORKER`: `true`
  - Health Check: `GET /` → `{"running":true,"service":"pub-prototype-worker"}`

#### PUB DEV LOOP (PDL)
- **PDL API Daemon**:
  - Script: `src/pdl/api/entry.ts`
  - Port: `3000` (or `PORT` / `PDL_API_PORT`)
  - Environment:
    - `DATABASE_URL`: PostgreSQL connection string for PDL database (`pub_dev_loop_production`)
    - `RUN_PDL_API`: `true`
  - Health Check: `GET /health` → `{"status":"ok","service":"pub-dev-loop-api"}`

- **PDL Worker Daemon**:
  - Script: `src/pdl/worker/entry.ts`
  - Port: `3004` (Health server)
  - Environment:
    - `DATABASE_URL`: PostgreSQL connection string for PDL database
    - `AGENT_PROVIDER`: `mock` | `9router` | `codex-api`
    - `PDL_WORKER_POLL_INTERVAL_MS`: Polling interval in ms (default: `1000`)
    - `RUN_PDL_WORKER`: `true`
  - Health Check: `GET /` → `{"running":true,"service":"pub-dev-loop-worker"}`

---

### 2. Failure Recovery Procedures

#### A. PP Worker Outage / Crash
1. **Symptom**: Prototype sessions remain in `IN_PROGRESS` without progressing to `READY`.
2. **Diagnosis**: Check worker process status: `curl http://127.0.0.1:3002/`.
3. **Recovery**:
   - Restart PP Worker daemon: `npm run pp:worker` (in PP repo).
   - Any unfinalized task with expired lease (`lease_deadline < NOW()`) is automatically re-acquired on the next polling cycle.
   - Idempotent checkpointing ensures no partial state corruption.

#### B. PDL Worker Outage / Crash
1. **Symptom**: Promoted tasks remain in `QUEUED` or `ASSIGNED` in PDL without reaching `COMPLETED`.
2. **Diagnosis**: Check worker health: `curl http://127.0.0.1:3004/`.
3. **Recovery**:
   - Restart PDL Worker daemon: `npm run pdl:worker` (in PDL repo).
   - Expired leases are automatically unlocked via `FOR UPDATE SKIP LOCKED` lease management.
   - Tasks are reclaimed and executed to completion.

#### C. PDL API Outage During Promotion
1. **Symptom**: User in PP UI initiates promotion and receives HTTP 502 / 503 error.
2. **Behavior**:
   - Standalone PP fails closed.
   - Session in PP remains unpromoted or records failed attempt.
   - Zero orphan or phantom records are created in PDL.
3. **Recovery**:
   - Restore PDL API service: `npm run pdl:api` (in PDL repo).
   - Verify health: `curl http://127.0.0.1:3000/health`.
   - Re-attempt promotion in PP: promotion succeeds, creates PDL task, and returns task ID.

#### D. PP API Outage
1. **Symptom**: Interactive web frontend or API clients cannot reach PP.
2. **Behavior**:
   - All session data, prompts, and checkpoints remain durably persisted in PostgreSQL (`pub_prototype_production`).
   - Running background workers continue processing existing active leases.
3. **Recovery**:
   - Restart PP API: `npm run pp:api` (in PP repo).
   - Query `GET /prototype/sessions/:id` to confirm session restoration.

---

### 3. Verification & Auditing Runbook

To perform full end-to-end multi-process verification across both sovereign repositories:
1. Ensure PostgreSQL is running and credentials are authenticated.
2. Ensure bare template repository is available.
3. Execute the canonical Phase 4 multi-process E2E harness.
4. Verify all 4 process PIDs and health endpoints.
5. Verify physical database isolation and zero cross-DB foreign keys.

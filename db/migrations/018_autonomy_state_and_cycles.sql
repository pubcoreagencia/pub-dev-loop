-- Migration 018: Durable Autonomy State, Missions & Cycle Idempotency (Phase 2.2)
-- Stores high-level Missions, SystemCurrentState capabilities snapshots, and discrete Autonomy Cycle execution records.
-- Strictly multi-tenant, project isolated, with deterministic cycle identity and atomic idempotency.

CREATE TABLE IF NOT EXISTS autonomy_missions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'pub-core-holding',
  project_id TEXT NOT NULL,
  title TEXT NOT NULL,
  objective TEXT NOT NULL,
  target_capabilities JSONB NOT NULL DEFAULT '[]'::jsonb,
  constraints JSONB NOT NULL DEFAULT '[]'::jsonb,
  risk_policy TEXT NOT NULL DEFAULT 'STANDARD' CHECK (risk_policy IN ('STRICT', 'STANDARD', 'AUTONOMOUS')),
  max_cycles INTEGER NOT NULL DEFAULT 5,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'COMPLETED', 'PAUSED', 'BLOCKED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS autonomy_missions_tenant_project_idx
  ON autonomy_missions (tenant_id, project_id);

CREATE INDEX IF NOT EXISTS autonomy_missions_status_idx
  ON autonomy_missions (tenant_id, status);

CREATE TABLE IF NOT EXISTS autonomy_mission_states (
  mission_id TEXT PRIMARY KEY REFERENCES autonomy_missions(id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL DEFAULT 'pub-core-holding',
  project_id TEXT NOT NULL,
  capabilities JSONB NOT NULL DEFAULT '{}'::jsonb,
  evaluated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS autonomy_mission_states_tenant_project_idx
  ON autonomy_mission_states (tenant_id, project_id);

CREATE TABLE IF NOT EXISTS autonomy_cycles (
  id TEXT PRIMARY KEY,
  mission_id TEXT NOT NULL REFERENCES autonomy_missions(id) ON DELETE CASCADE,
  cycle_number INTEGER NOT NULL,
  tenant_id TEXT NOT NULL DEFAULT 'pub-core-holding',
  project_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN (
    'PENDING',
    'RUNNING',
    'COMPLETED',
    'FAILED',
    'BLOCKED',
    'WAITING_APPROVAL'
  )),
  state_before JSONB NOT NULL DEFAULT '{}'::jsonb,
  identified_gaps JSONB NOT NULL DEFAULT '[]'::jsonb,
  selected_action JSONB NOT NULL DEFAULT '{}'::jsonb,
  generated_task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
  execution_status TEXT CHECK (execution_status IN (
    'QUEUED',
    'RUNNING',
    'COMPLETED',
    'FAILED',
    'BLOCKED',
    'WAITING_APPROVAL'
  )),
  validation_status TEXT CHECK (validation_status IN (
    'NOT_RUN',
    'PASSED',
    'FAILED',
    'BLOCKED'
  )),
  state_after JSONB,
  evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
  stop_reason TEXT,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  CONSTRAINT autonomy_cycles_mission_number_unique UNIQUE (mission_id, cycle_number)
);

CREATE INDEX IF NOT EXISTS autonomy_cycles_mission_number_idx
  ON autonomy_cycles (mission_id, cycle_number);

CREATE INDEX IF NOT EXISTS autonomy_cycles_tenant_project_idx
  ON autonomy_cycles (tenant_id, project_id);

CREATE INDEX IF NOT EXISTS autonomy_cycles_status_idx
  ON autonomy_cycles (status);

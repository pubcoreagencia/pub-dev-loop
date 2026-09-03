-- Migration 017: Additive Autonomous Pipelines & Task Flow (Phase 8.8)
-- Stores multi-step autonomous pipelines orchestrated by Chief of Staff with CEO governance checkpoints.
-- Zero LLM, zero embeddings, strictly multi-tenant and project isolated.

CREATE TABLE IF NOT EXISTS autonomous_pipelines (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'pub-dev-loop',
  project_id TEXT NOT NULL,
  title TEXT NOT NULL,
  ceo_objective TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PLANNING' CHECK (status IN (
    'PLANNING',
    'RUNNING',
    'PAUSED',
    'WAITING_APPROVAL',
    'COMPLETED',
    'FAILED',
    'CANCELLED'
  )),
  steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_steps INTEGER NOT NULL DEFAULT 0,
  completed_steps INTEGER NOT NULL DEFAULT 0,
  current_step_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS autonomous_pipelines_tenant_project_idx
  ON autonomous_pipelines (tenant_id, project_id);

CREATE INDEX IF NOT EXISTS autonomous_pipelines_status_idx
  ON autonomous_pipelines (tenant_id, status);

-- Migration 013: Additive Organizational Patterns Table
-- Stores deterministic derived pattern records based on verified operational events.
-- Zero LLM, zero embeddings, strictly multi-tenant and project-scoped.

CREATE TABLE IF NOT EXISTS organizational_patterns (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'pub-dev-loop',
  project_id TEXT NOT NULL,
  signature TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUPERSEDED', 'BLOCKED')),
  component TEXT NOT NULL,
  task_type TEXT NOT NULL,
  rule_id TEXT,
  remediation_signature TEXT,
  recurrence_count INTEGER NOT NULL DEFAULT 1,
  supporting_memory_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  supporting_event_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  supporting_task_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  supporting_agent_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  corroboration JSONB NOT NULL DEFAULT '{}'::jsonb,
  first_observed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_observed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS org_patterns_signature_uniq_idx
  ON organizational_patterns (tenant_id, project_id, signature);

CREATE INDEX IF NOT EXISTS org_patterns_status_idx
  ON organizational_patterns (tenant_id, project_id, status);

CREATE INDEX IF NOT EXISTS org_patterns_component_idx
  ON organizational_patterns (tenant_id, project_id, component, task_type);

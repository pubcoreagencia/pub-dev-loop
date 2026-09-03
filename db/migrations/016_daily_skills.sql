-- Migration 016: Additive Daily Skills Table (Phase 8.7)
-- Stores reusable, typed skills compiled from validated institutional lessons.
-- Zero LLM, zero embeddings, strictly multi-tenant and project isolated.

CREATE TABLE IF NOT EXISTS daily_skills (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'pub-dev-loop',
  project_id TEXT,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  capability TEXT NOT NULL,
  source_lesson_id TEXT,
  source_experiences JSONB NOT NULL DEFAULT '[]'::jsonb,
  confidence TEXT NOT NULL DEFAULT 'HIGH' CHECK (confidence IN ('LOW', 'MEDIUM', 'HIGH')),
  version INTEGER NOT NULL DEFAULT 1,
  applicable_roles JSONB NOT NULL DEFAULT '[]'::jsonb,
  applicable_contexts JSONB NOT NULL DEFAULT '[]'::jsonb,
  limitations JSONB NOT NULL DEFAULT '[]'::jsonb,
  executable_guideline TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('DRAFT', 'ACTIVE', 'DEPRECATED', 'BLOCKED')),
  provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS daily_skills_tenant_project_idx
  ON daily_skills (tenant_id, project_id);

CREATE INDEX IF NOT EXISTS daily_skills_status_idx
  ON daily_skills (tenant_id, status);

CREATE INDEX IF NOT EXISTS daily_skills_capability_idx
  ON daily_skills (tenant_id, capability);

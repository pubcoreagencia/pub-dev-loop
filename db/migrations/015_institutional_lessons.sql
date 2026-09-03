-- Migration 015: Additive Institutional Lessons Table
-- Stores governed and validated institutional principles authorized for organizational learning.
-- Zero LLM, zero embeddings, strictly multi-tenant and project/scope isolated.

CREATE TABLE IF NOT EXISTS institutional_lessons (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'pub-dev-loop',
  project_id TEXT NOT NULL,
  candidate_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUPERSEDED', 'BLOCKED', 'REVOKED')),
  title TEXT NOT NULL,
  statement TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT 'PROJECT' CHECK (scope IN ('GLOBAL', 'PROJECT', 'AGENT', 'TASK')),
  lesson_type TEXT NOT NULL CHECK (lesson_type IN (
    'OPERATIONAL_GUIDANCE',
    'TESTING_GUIDANCE',
    'ARCHITECTURE_GUIDANCE',
    'SECURITY_GUIDANCE',
    'STRATEGIC_GUIDANCE'
  )),
  source_candidate_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  supporting_pattern_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  supporting_memory_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  supporting_event_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  supporting_task_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
  governance JSONB NOT NULL DEFAULT '{}'::jsonb,
  validation JSONB NOT NULL DEFAULT '{}'::jsonb,
  temporal_validity TEXT NOT NULL DEFAULT 'CURRENT' CHECK (temporal_validity IN (
    'CURRENT',
    'HISTORICAL',
    'SUPERSEDED',
    'OBSOLETE',
    'BLOCKED',
    'CONTEXT_DEPENDENT'
  )),
  superseded_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  validated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS inst_lessons_candidate_uniq_idx
  ON institutional_lessons (tenant_id, project_id, candidate_id);

CREATE INDEX IF NOT EXISTS inst_lessons_status_idx
  ON institutional_lessons (tenant_id, project_id, status);

CREATE INDEX IF NOT EXISTS inst_lessons_type_scope_idx
  ON institutional_lessons (tenant_id, project_id, lesson_type, scope);

-- Migration 014: Additive Lesson Candidates Table
-- Stores auditable hypothesis records derived from verified patterns.
-- Zero LLM, zero embeddings, strictly multi-tenant and project-scoped.
-- A candidate is NOT an institutional lesson.

CREATE TABLE IF NOT EXISTS lesson_candidates (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'pub-dev-loop',
  project_id TEXT NOT NULL,
  pattern_id TEXT NOT NULL,
  candidate_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PROPOSED' CHECK (status IN ('PROPOSED', 'ELIGIBLE', 'BLOCKED', 'REJECTED', 'SUPERSEDED')),
  title TEXT NOT NULL,
  statement TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT 'PROJECT' CHECK (scope IN ('PROJECT', 'AGENT', 'TASK')),
  candidate_type TEXT NOT NULL DEFAULT 'OPERATIONAL_PRACTICE' CHECK (candidate_type IN (
    'OPERATIONAL_PRACTICE',
    'FAILURE_PATTERN',
    'REMEDIATION_PATTERN',
    'TESTING_PRACTICE',
    'ARCHITECTURE_GUIDANCE',
    'SECURITY_GUIDANCE'
  )),
  supporting_pattern_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  supporting_memory_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  supporting_event_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  supporting_task_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  supporting_agent_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  corroboration JSONB NOT NULL DEFAULT '{}'::jsonb,
  remediation JSONB NOT NULL DEFAULT '{}'::jsonb,
  contradiction_status TEXT NOT NULL DEFAULT 'CLEAN' CHECK (contradiction_status IN ('CLEAN', 'CONTEXT_DEPENDENT', 'CONTRADICTORY_UNRESOLVED')),
  provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
  eligibility JSONB NOT NULL DEFAULT '{}'::jsonb,
  requires_ceo_approval BOOLEAN NOT NULL DEFAULT false,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS lesson_candidates_key_uniq_idx
  ON lesson_candidates (tenant_id, project_id, candidate_key);

CREATE INDEX IF NOT EXISTS lesson_candidates_status_idx
  ON lesson_candidates (tenant_id, project_id, status);

CREATE INDEX IF NOT EXISTS lesson_candidates_pattern_idx
  ON lesson_candidates (tenant_id, project_id, pattern_id);

-- Phase 3C.2 — ExecutionSpec persistence foundation (OPTION B architecture)
-- First-class execution_specs table with UNIQUE(task_id) 1:1 relationship and FK to tasks.
-- Idempotent: IF NOT EXISTS + idempotent index creation.
-- No worker/service modifications; persistence layer only.

CREATE TABLE IF NOT EXISTS execution_specs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  spec_version TEXT NOT NULL,
  spec_hash TEXT NOT NULL DEFAULT '',
  objective TEXT NOT NULL,
  lineage JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'UNSEALED'
    CHECK (status IN ('UNSEALED','VALIDATED','SEALED','BLOCKED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sealed_at TIMESTAMPTZ,
  spec_content_json JSONB NOT NULL,
  CONSTRAINT execution_specs_task_id_unique UNIQUE (task_id),
  CONSTRAINT fk_execution_specs_task FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_execution_specs_task_id ON execution_specs(task_id);
CREATE INDEX IF NOT EXISTS idx_execution_specs_status ON execution_specs(status) WHERE status = 'SEALED';
CREATE INDEX IF NOT EXISTS idx_execution_specs_sealed_at ON execution_specs(sealed_at) WHERE sealed_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_execution_specs_spec_hash ON execution_specs(spec_hash);

-- Migration 023: PDL Task Retry Metadata, Dead-Letter Queue & Poison Task Quarantine (Phase 5.5 Step 3)
-- Adds retry tracking and quarantine state to tasks, and introduces durable, idempotent DLQ records.

DO $$ BEGIN
    ALTER TYPE task_status ADD VALUE IF NOT EXISTS 'QUARANTINED';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS retry_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_retries INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_retry_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_failure_code TEXT,
  ADD COLUMN IF NOT EXISTS last_failure_class TEXT,
  ADD COLUMN IF NOT EXISTS dead_lettered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS dead_letter_reason TEXT,
  ADD COLUMN IF NOT EXISTS quarantined_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS quarantine_reason TEXT;

CREATE INDEX IF NOT EXISTS tasks_next_retry_idx ON tasks (status, next_retry_at)
  WHERE status = 'QUEUED' AND next_retry_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS pdl_dead_letters (
  id TEXT PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  repository TEXT NOT NULL,
  product TEXT NOT NULL,
  failure_code TEXT NOT NULL,
  failure_class TEXT NOT NULL,
  attempt_count INTEGER NOT NULL DEFAULT 1,
  reason TEXT NOT NULL,
  quarantined BOOLEAN NOT NULL DEFAULT false,
  original_task_result JSONB,
  status TEXT NOT NULL DEFAULT 'UNRESOLVED' CHECK (status IN ('UNRESOLVED', 'RESOLVED', 'DISCARDED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolution TEXT,
  CONSTRAINT pdl_dead_letters_task_attempt_unique UNIQUE (task_id, attempt_count)
);

CREATE INDEX IF NOT EXISTS pdl_dead_letters_task_id_idx ON pdl_dead_letters (task_id);
CREATE INDEX IF NOT EXISTS pdl_dead_letters_status_idx ON pdl_dead_letters (status);
CREATE INDEX IF NOT EXISTS pdl_dead_letters_created_at_idx ON pdl_dead_letters (created_at DESC);

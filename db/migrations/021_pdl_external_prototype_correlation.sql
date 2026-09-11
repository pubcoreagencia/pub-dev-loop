-- Migration 021: PDL External Prototype Correlation Column
-- Establishes tasks.prototype_session_id as an independent, unconstrained UUID logical correlation field.
-- Zero foreign key dependency on prototype_sessions.
-- Safe and idempotent for both fresh PDL databases and upgraded historical monorepo databases.

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS prototype_session_id UUID;

CREATE INDEX IF NOT EXISTS tasks_prototype_session_idx
  ON tasks (prototype_session_id, created_at ASC)
  WHERE prototype_session_id IS NOT NULL;

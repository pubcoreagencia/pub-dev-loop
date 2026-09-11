ALTER TABLE prototype_sessions
  ADD COLUMN IF NOT EXISTS workspace_path TEXT;

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS prototype_session_id UUID REFERENCES prototype_sessions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS tasks_prototype_session_idx
  ON tasks (prototype_session_id, created_at ASC)
  WHERE prototype_session_id IS NOT NULL;

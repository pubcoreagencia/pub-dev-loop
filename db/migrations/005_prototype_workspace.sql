ALTER TABLE prototype_sessions
  ADD COLUMN IF NOT EXISTS workspace_path TEXT;

CREATE INDEX IF NOT EXISTS prototype_sessions_workspace_idx
  ON prototype_sessions (workspace_path)
  WHERE workspace_path IS NOT NULL;

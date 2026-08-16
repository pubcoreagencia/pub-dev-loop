CREATE TYPE task_status AS ENUM ('QUEUED','ASSIGNED','RUNNING','TESTING','COMPLETED','FAILED','BLOCKED','CANCELLED','NEEDS_REVIEW');
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY,
  project TEXT NOT NULL,
  repository TEXT NOT NULL,
  objective TEXT NOT NULL,
  prompt TEXT NOT NULL,
  status task_status NOT NULL DEFAULT 'QUEUED',
  priority INTEGER NOT NULL DEFAULT 0,
  worker TEXT,
  result JSONB,
  error TEXT,
  branch TEXT,
  commit_sha TEXT,
  git_status TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tasks_queue_idx ON tasks (status, priority DESC, created_at ASC);

CREATE TABLE IF NOT EXISTS office_events (
  id TEXT PRIMARY KEY,
  sequence BIGSERIAL,
  project TEXT NOT NULL,
  type TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  target_id TEXT,
  task_id TEXT,
  plan_id TEXT,
  step_id TEXT,
  summary TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS office_events_project_seq_idx
  ON office_events (project, sequence ASC);

CREATE TABLE IF NOT EXISTS prototype_sessions (
  id UUID PRIMARY KEY,
  project TEXT NOT NULL,
  repository TEXT NOT NULL,
  branch TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'PROTOTYPE' CHECK (mode IN ('PROTOTYPE','DEVELOPMENT')),
  status TEXT NOT NULL DEFAULT 'CREATING' CHECK (status IN ('CREATING','READY','BUILDING','PREVIEWING','FAILED','APPROVED','PROMOTED','ARCHIVED')),
  preview_url TEXT,
  preview_runtime TEXT,
  last_checkpoint_sha TEXT,
  prompt_count INTEGER NOT NULL DEFAULT 0 CHECK (prompt_count >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS prototype_sessions_status_idx
  ON prototype_sessions (status, updated_at DESC);

CREATE TABLE IF NOT EXISTS prototype_checkpoints (
  id UUID PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES prototype_sessions(id) ON DELETE CASCADE,
  prompt_index INTEGER NOT NULL CHECK (prompt_index > 0),
  prompt TEXT NOT NULL,
  commit_sha TEXT,
  preview_url TEXT,
  build_passed BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS prototype_checkpoints_session_idx
  ON prototype_checkpoints (session_id, prompt_index DESC);

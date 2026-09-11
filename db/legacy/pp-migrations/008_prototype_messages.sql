CREATE TABLE IF NOT EXISTS prototype_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES prototype_sessions(id) ON DELETE CASCADE,
  task_id UUID NULL REFERENCES tasks(id) ON DELETE SET NULL,
  role TEXT NOT NULL CHECK (role IN ('user','assistant','system','tool','progress')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  "order" BIGINT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS prototype_messages_session_order_idx ON prototype_messages (session_id, "order" ASC);
CREATE INDEX IF NOT EXISTS prototype_messages_session_idx ON prototype_messages (session_id, "order" ASC);

-- TASK-000032 Phase 3: Lease / Heartbeat / Stale Task Reclaim
-- Adds fields for crash recovery via lease mechanism

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS lease_owner TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS lease_deadline TIMESTAMPTZ;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS heartbeat_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS workspace_path TEXT;

-- Ensure id column has a default UUID (needed for tasks created via API)
ALTER TABLE tasks ALTER COLUMN id DROP DEFAULT;
ALTER TABLE tasks ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- Index for efficient stale task scanning
CREATE INDEX IF NOT EXISTS tasks_lease_idx 
  ON tasks (lease_deadline) 
  WHERE status IN ('ASSIGNED', 'RUNNING', 'TESTING');

CREATE TABLE IF NOT EXISTS organizational_memories (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'pub-dev-loop',
  project_id TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  epistemic_status TEXT NOT NULL DEFAULT 'OBSERVED',
  scope TEXT NOT NULL DEFAULT 'PROJECT',
  actor_id TEXT NOT NULL,
  recurrence_count INTEGER NOT NULL DEFAULT 1,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  provenance JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_memory_provenance_valid CHECK (
    (provenance->>'projectId') IS NOT NULL AND
    (provenance->>'actorId') IS NOT NULL AND
    (provenance->>'source') IS NOT NULL AND
    (provenance->>'verifiedAt') IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS org_memories_tenant_project_idx
  ON organizational_memories (tenant_id, project_id);

CREATE INDEX IF NOT EXISTS org_memories_tenant_project_type_idx
  ON organizational_memories (tenant_id, project_id, type);

CREATE INDEX IF NOT EXISTS org_memories_tenant_project_status_idx
  ON organizational_memories (tenant_id, project_id, status);

CREATE INDEX IF NOT EXISTS org_memories_event_id_idx
  ON organizational_memories ((provenance->>'eventId'))
  WHERE (provenance->>'eventId') IS NOT NULL;

CREATE INDEX IF NOT EXISTS org_memories_task_id_idx
  ON organizational_memories ((provenance->>'taskId'))
  WHERE (provenance->>'taskId') IS NOT NULL;

CREATE INDEX IF NOT EXISTS org_memories_plan_id_idx
  ON organizational_memories ((provenance->>'planId'))
  WHERE (provenance->>'planId') IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS org_memories_dedupe_idx
  ON organizational_memories (
    tenant_id,
    project_id,
    type,
    COALESCE(provenance->>'eventId', ''),
    COALESCE(provenance->>'taskId', ''),
    COALESCE(provenance->>'ruleId', '')
  );

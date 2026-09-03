-- Migration 012: Memory Governance Indexes & Constraints
-- Forward-compatible indices for lifecycle state filtering, supersession queries, and temporal sorting.

CREATE INDEX IF NOT EXISTS org_memories_governance_lifecycle_idx
  ON organizational_memories (tenant_id, project_id, status, type);

CREATE INDEX IF NOT EXISTS org_memories_superseded_by_idx
  ON organizational_memories (tenant_id, project_id, (metadata->>'supersededBy'))
  WHERE (metadata->>'supersededBy') IS NOT NULL;

CREATE INDEX IF NOT EXISTS org_memories_temporal_validity_idx
  ON organizational_memories (tenant_id, project_id, status, updated_at DESC);

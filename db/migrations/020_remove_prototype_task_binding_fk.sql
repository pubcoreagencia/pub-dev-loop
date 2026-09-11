-- Migration 020: Remove physical foreign key from PDL tasks to PP prototype_sessions
-- Decouples PDL database boundary for standalone operation (Phase 3D Step 3).
-- Preserves tasks.prototype_session_id as an unconstrained correlation UUID.
-- Preserves existing index tasks_prototype_session_idx for lookups.

ALTER TABLE tasks
  DROP CONSTRAINT IF EXISTS tasks_prototype_session_id_fkey;

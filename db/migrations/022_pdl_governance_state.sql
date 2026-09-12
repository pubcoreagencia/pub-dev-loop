-- Migration 022: Centralized PDL Governance Policy State & Emergency Kill Switch (Phase 5.5 Step 1)
-- Provides persistent, fail-closed governance level configuration and emergency stop state.
-- Strictly rejects Level 5 at the database constraint level.

CREATE TABLE IF NOT EXISTS pdl_governance_state (
  id TEXT PRIMARY KEY DEFAULT 'canonical',
  active_level INTEGER NOT NULL DEFAULT 0 CHECK (active_level IN (0, 1, 2, 3, 4)),
  kill_switch_active BOOLEAN NOT NULL DEFAULT true,
  max_consecutive_tasks INTEGER NOT NULL DEFAULT 1,
  max_task_duration_ms INTEGER NOT NULL DEFAULT 180000,
  max_tool_rounds_per_task INTEGER NOT NULL DEFAULT 10,
  max_correction_attempts INTEGER NOT NULL DEFAULT 2,
  max_consecutive_failures INTEGER NOT NULL DEFAULT 1,
  allowed_products JSONB NOT NULL DEFAULT '["pub-rate-calculator", "pub-dev-loop-template", "pub-shopee-scraper"]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by TEXT NOT NULL DEFAULT 'system',
  reason TEXT
);

CREATE INDEX IF NOT EXISTS pdl_governance_state_level_idx
  ON pdl_governance_state (active_level);

-- Seed canonical row with fail-closed default (Level 0, Kill Switch active)
INSERT INTO pdl_governance_state (
  id,
  active_level,
  kill_switch_active,
  max_consecutive_tasks,
  max_task_duration_ms,
  max_tool_rounds_per_task,
  max_correction_attempts,
  max_consecutive_failures,
  allowed_products,
  updated_at,
  updated_by,
  reason
) VALUES (
  'canonical',
  0,
  true,
  1,
  180000,
  10,
  2,
  1,
  '["pub-rate-calculator", "pub-dev-loop-template", "pub-shopee-scraper"]'::jsonb,
  now(),
  'migration-022',
  'Initial fail-closed state: Level 0 (Manual only), Kill Switch ACTIVE'
) ON CONFLICT (id) DO NOTHING;

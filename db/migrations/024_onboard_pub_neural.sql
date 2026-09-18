-- Migration 024: Explicitly admit PUB Neural to the PDL product governance allowlist.
-- This migration does NOT change the active governance level or kill-switch state.
-- It only adds pub-neural to an existing canonical JSONB array allowlist.
-- If the governance row or allowlist shape is unavailable/invalid, no change is made,
-- preserving fail-closed behavior.

UPDATE pdl_governance_state
SET
  allowed_products = (
    SELECT jsonb_agg(value ORDER BY value)
    FROM (
      SELECT DISTINCT value
      FROM jsonb_array_elements_text(allowed_products || '["pub-neural"]'::jsonb)
    ) AS deduped
  ),
  updated_at = now(),
  updated_by = 'migration-024',
  reason = 'Explicitly onboard pub-neural as a governed internal PDL target'
WHERE id = 'canonical'
  AND jsonb_typeof(allowed_products) = 'array';

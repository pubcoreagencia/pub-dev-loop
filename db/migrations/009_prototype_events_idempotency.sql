-- db/migrations/009_prototype_events_idempotency.sql
-- Persistent Idempotency Index for P5.5 Event Bridge & Operational Events

CREATE UNIQUE INDEX IF NOT EXISTS prototype_events_idempotency_idx
  ON prototype_events (
    session_id,
    (payload->>'taskId'),
    ((payload->>'attempt')::int),
    ((payload->>'operationalSeq')::bigint),
    type
  )
  WHERE (payload->>'taskId') IS NOT NULL
    AND (payload->>'attempt') IS NOT NULL
    AND (payload->>'operationalSeq') IS NOT NULL;

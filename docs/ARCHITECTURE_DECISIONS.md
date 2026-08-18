# Architecture Decisions

This file records the permanent decisions that define PUB DEV LOOP.

## ADR-001 - Worker lifecycle serializado

- Date: 2026-08-18
- Decision: Replace overlapping `setInterval` execution with serialized `runCycle` / `setTimeout` scheduling.
- Why: Prevent concurrent worker cycles and corruption of shared worker state such as `active`.
- Alternatives rejected: leave `setInterval`, add ad-hoc locks, or rely on manual cancellation.
- Impact: Tasks no longer get stuck due to overlapping worker cycles.
- Status: Accepted

## ADR-002 - PostgreSQL undefined values are forbidden

- Date: 2026-08-18
- Decision: Repository update paths must skip `undefined` before passing values to `pg`.
- Why: `node-postgres` rejects `undefined` values and can prevent a task from transitioning to `FAILED`.
- Alternatives rejected: allow driver errors, serialize undefined into null silently, or ignore the failure.
- Impact: Failure persistence is safe and deterministic.
- Status: Accepted

## ADR-003 - Official 9Router gateway

- Date: 2026-08-18
- Decision: Use the official 9Router gateway, not OpenRouter.
- Why: The project explicitly chose the official 9Router as the multi-provider gateway.
- Alternatives rejected: OpenRouter, custom fake gateway, Cloudflare proxy clone.
- Impact: The provider contract is OpenAI-compatible and can evolve independently of the worker.
- Status: Accepted

## ADR-004 - Worker owns execution

- Date: 2026-08-18
- Decision: The worker owns workspace, shell, Git, timeout, redaction, and finalization.
- Why: The LLM gateway must remain a planning/model endpoint, not a host-control endpoint.
- Alternatives rejected: allow the gateway to directly manage the filesystem or Git.
- Impact: Future providers can be swapped in without changing runtime ownership.
- Status: Accepted

## ADR-005 - Historical OpenRouter recommendation is obsolete

- Date: 2026-08-18
- Decision: Treat any OpenRouter recommendation in older docs as historical only.
- Why: The mission explicitly moved to the official 9Router gateway.
- Alternatives rejected: keep OpenRouter as primary recommendation.
- Impact: Future agents should not reselect OpenRouter from archived notes.
- Status: Accepted


# Agent Continuity

This document is the operational handoff for a new agent taking over PUB DEV LOOP.

## CURRENT STATUS

- Git branch: `main`
- Git HEAD: `cb0ba5e`
- Last known gate: router gateway architecture decision documented, but 9Router connectivity remains blocked in the current environment
- Provider in code: `mock`, `codex-api`, `9router`
- Working tree: dirty with unrelated local changes already present before this continuity task
- Blocking issue: no reachable 9Router endpoint proven in the current session

## COMPLETED

- Task lifecycle worker stabilized.
- PostgreSQL `undefined` update bug fixed.
- Provider abstraction exists.
- 9Router provider implementation exists.
- Operational and architecture docs already exist for the core MVP.

## IN PROGRESS

- Handoff and continuity documentation consolidation.
- 9Router endpoint/connectivity proof remains incomplete.

## BLOCKED

- Real 9Router task execution is blocked until a reachable official 9Router endpoint is available.
- The current environment could not prove `host.docker.internal:20128` or `localhost:20128`.

## NEXT ACTION

Audit the official 9Router endpoint connectivity from the actual worker/container environment, then validate `/v1/models` and `/v1/chat/completions` before attempting a real task.

## DO NOT TOUCH

- `src/worker.ts`
- `src/repository.ts`
- frontend / Claw3D
- lifecycle stabilization logic
- OpenRouter references as historical context only
- secrets, credentials, tokens

## KNOWN ISSUES

- The 9Router endpoint was not reachable in this session.
- Some older documents still contain historical OpenRouter analysis and should be treated as audit history, not current guidance.

## VALIDATION

- Lifecycle stabilization has been validated earlier in the mission history.
- Unit tests/build have been green in prior runs.
- 9Router connectivity is not yet validated.


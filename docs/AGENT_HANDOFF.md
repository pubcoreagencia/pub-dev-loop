# Agent Handoff

Use this document when another agent must assume PUB DEV LOOP safely.

## Handoff sequence

1. Run `git status`.
2. Run `git log --oneline --decorate -10`.
3. Read `docs/AGENT_CONTINUITY.md`.
4. Read `docs/PUB_DEV_LOOP_MASTER_CONTEXT.md`.
5. Read `docs/PROJECT_STATE.md`.
6. Read `docs/ARCHITECTURE_DECISIONS.md`.
7. Read the task-specific documentation.
8. Inspect the code that is actually present.
9. Validate tests and build.
10. Only then make changes.

## What the new agent must verify

- branch and HEAD
- working tree state
- provider choice
- gateway reachability
- lifecycle invariants
- secrets policy

## Assumptions that must not be made

- Do not assume a previous report is still accurate.
- Do not assume 9Router is reachable until tested.
- Do not assume a task is completed until PostgreSQL shows it.

## Safe continuation rules

- Keep the lifecycle fix intact.
- Keep repository undefined-value filtering intact.
- Keep the worker responsible for execution.
- Do not replace the official 9Router with a fake or alternate gateway.


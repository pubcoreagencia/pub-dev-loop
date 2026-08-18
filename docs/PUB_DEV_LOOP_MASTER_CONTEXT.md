# PUB DEV LOOP Master Context

This is the canonical continuity document for PUB DEV LOOP.

If you are a new agent, read this file first. It is the authoritative summary of the project, its architecture, what is frozen, what is blocked, and how to continue safely without relying on conversation memory.

## 1. What PUB DEV LOOP is

PUB DEV LOOP is a cloud-first task execution system for PUB Core engineering work. It accepts a task, stores it in PostgreSQL, lets a worker claim it, runs the task inside an isolated workspace, records the result, and preserves the work in Git.

The system exists so GPT-driven planning and human/agent execution can be traced, validated, and resumed from repository state.

## 2. Project goal

The goal is to keep a permanent, auditable, recoverable coding loop where:

`Task -> queue -> worker -> provider -> workspace -> tests -> Git -> result`

The repository must remain the source of truth for architecture, history, and operational handoff.

## 3. Current architecture

The active architecture is cloud-first and worker-centric:

- API receives tasks.
- PostgreSQL stores queue and task state.
- A worker claims queued tasks.
- The worker creates a temporary isolated workspace.
- The worker delegates coding to a provider.
- The provider is not allowed to own the workspace, Git, or local execution runtime.
- The worker finalizes, tests, commits, records SHA, and cleans up.

The worker continues to own:

- workspace creation and cleanup
- shell/process execution
- Git clone, branch, add, commit, status
- timeout and heartbeat handling
- redaction and diagnostics
- finalization

## 4. Main components

- `src/api-worker.ts`: API and cloud worker gateway entrypoint.
- `src/worker.ts`: worker lifecycle startup and serial cycle orchestration.
- `src/worker-service.ts`: worker execution, retry/finalization, and task lifecycle.
- `src/repository.ts`: PostgreSQL task persistence and state transitions.
- `src/agent.ts`: provider selection and Codex compatibility adapter.
- `src/providers/router.ts`: 9Router OpenAI-compatible provider runtime.
- `src/providers/codex-api.ts`: Codex API provider path.
- `src/providers/shared.ts`: shared router configuration helpers.
- `src/executor.ts`: process execution, redaction, and timeout handling.
- `src/finalizer.ts`: validation and local commit finalization.
- `src/tools/*`: workspace tools and security enforcement used by provider runtime.

## 5. Task flow

The intended task flow is:

`QUEUED -> ASSIGNED -> RUNNING -> TESTING -> COMPLETED`

Failure flow:

`QUEUED -> ASSIGNED -> RUNNING -> FAILED`

The invariant is that a task must not remain stuck in `RUNNING`.

## 6. Worker behavior

The worker is responsible for:

- claiming a task
- creating a branch/workspace
- invoking the configured provider
- enforcing timeout and heartbeat
- finalizing the workspace
- persisting result and commit SHA
- cleaning up temporary files

The worker must not silently mask provider failure.

## 7. Lifecycle fix that must not be reverted

The worker lifecycle bug was caused by overlapping execution cycles and by undefined values being sent to PostgreSQL.

Fixes already applied in history:

- worker polling became serialized instead of overlapping
- repository updates no longer send `undefined` to `pg`

Relevant commits:

- `2ff44a4` `fix: stabilize task lifecycle worker`
- `cb0ba5e` `docs: document router gateway architecture decision`

## 8. Provider model

The code now treats the coding backend as a provider abstraction.

Supported provider kinds in the current codebase:

- `mock`
- `codex-api`
- `9router`

The provider is the model/brain side only. It must not take over workspace, Git, shell, or cleanup responsibilities.

## 9. 9Router status

The chosen gateway is the official 9Router service at:

`https://9router.com/`

The official public site presents an OpenAI-compatible endpoint and a local default endpoint of:

`http://localhost:20128/v1`

Current status in this repository:

- The provider contract is implemented.
- The gateway endpoint has not been proven reachable in this session.
- `host.docker.internal:20128` was not reachable from the current environment.
- `localhost:20128` was also not reachable from the current host session.

Current status: `BLOCKED`

Reason: no confirmed reachable 9Router endpoint in the current execution environment.

## 10. Git automation

The worker may create local commits when a task is finalized successfully.

The intended contract is:

- commit is local and controlled by the worker
- push is not automatic unless explicitly enabled in a separate workflow
- the worker must preserve workspace cleanliness and commit SHA provenance

## 11. API

The API remains the task entrypoint and state query surface.

It is responsible for:

- task creation
- task lookup
- cancellation
- retry
- rate limiting
- authentication

## 12. Database

PostgreSQL is the durable queue and task result store.

Important invariants:

- task updates must not send `undefined`
- tasks must not remain indefinitely in `RUNNING`
- final task result should carry provider, model, summary/result, SHA, and diagnostics

## 13. Docker

Docker remains the portable Linux runtime path for the worker.

The worker image is expected to:

- run on Linux
- use a non-root user
- install Git and the official Codex CLI when Codex is enabled
- keep credentials out of the image

## 14. Cloudflare and experimental runtimes

Cloudflare/container paths exist in the codebase and are treated as runtime experiments or deployment-specific integrations, not the source of truth for architecture.

## 15. Security and secrets

Never commit or print:

- tokens
- API keys
- cookies
- credentials
- auth JSON

Use placeholders only:

- `<ROUTER_API_KEY>`
- `<PUB_DEV_LOOP_API_KEY>`
- `<GITHUB_TOKEN>`

## 16. Existing documentation

Historical documents still matter for auditability:

- `docs/PUB_DEV_LOOP_STABILITY.md`
- `docs/ROUTER_GATEWAY_DECISION.md`
- `docs/ARCHITECTURE.md`
- `docs/CLOUD_DEPLOYMENT.md`
- `docs/GITHUB_ACTIONS_WORKER.md`

If a historical doc contradicts this file, treat this file as current and leave the older document intact unless explicitly asked to mark it obsolete.

## 17. What not to do

Do not:

- reintroduce overlapping worker loops
- send undefined values to PostgreSQL
- replace the gateway with OpenRouter
- invent a fake 9Router implementation
- move Git ownership out of the worker without a deliberate architecture change
- wipe historical documents or Git history
- assume a report is proof without checking code and Git

## 18. How a new agent should start

1. Run `git status`.
2. Run `git log --oneline --decorate -10`.
3. Read this file.
4. Read `docs/AGENT_CONTINUITY.md`.
5. Read `docs/ARCHITECTURE_DECISIONS.md`.
6. Read `docs/PROJECT_STATE.md`.
7. Read `docs/AGENT_HANDOFF.md`.
8. Read the task-specific docs.
9. Validate code and tests.
10. Only then change code.


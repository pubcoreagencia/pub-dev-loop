# PUB DEV LOOP V0.1

Cloud-first MVP for a persistent coding-task loop: HTTP API -> PostgreSQL queue -> Codex worker -> Git branch -> persisted result.

## Run locally with Docker

1. Copy `.env.example` to `.env` and keep `AGENT_MODE=mock` initially.
2. Run `docker compose up --build`.
3. Check `curl http://localhost:3000/health`.

Create a task:

```sh
curl -X POST http://localhost:3000/tasks -H "Content-Type: application/json" -d '{"project":"demo","repository":"https://github.com/org/repo.git","objective":"Add a health check","prompt":"Implement the requested health check."}'
```

The worker polls the database, claims the highest-priority queued task atomically, clones its repository to a temporary directory, creates `worker/codex/TASK-ID`, runs the selected agent, and records Git metadata and the result. There is deliberately no automatic merge.

## Native development

Install dependencies with `npm install`, set `DATABASE_URL`, run `npm run db:migrate`, then use `npm run dev` for the API and `npm run worker` in another process. `npm test` runs unit lifecycle tests; `npm run build` compiles TypeScript.

## API

- `GET /health`
- `POST /tasks`
- `GET /tasks`
- `GET /tasks/:id`
- `POST /tasks/:id/cancel` (queued/assigned only)
- `POST /tasks/:id/retry` (failed, blocked, cancelled, needs-review)

Task states: `QUEUED`, `ASSIGNED`, `RUNNING`, `TESTING`, `COMPLETED`, `FAILED`, `BLOCKED`, `CANCELLED`, `NEEDS_REVIEW`.

## Configuration and limitations

`.env.example` lists all supported configuration. Never commit `.env`, tokens, or private keys. Project-specific test commands and pushing commits are intentionally not implemented in V0.1, so the result is a local branch/commit record only.

## Real Codex Worker

`AGENT_MODE=mock` is the safe default. To use the real worker, install the Codex CLI in the Linux worker image, authenticate it non-interactively using the credential mechanism supported by the deployed CLI, set `AGENT_MODE=codex`, and set `AGENT_TIMEOUT_MS` as appropriate. The adapter invokes the documented headless form `codex exec --full-auto <prompt>` only inside the task's isolated cloned workspace.

`AgentExecutor` starts the process without a shell, captures stdout/stderr, redacts common secret values before persistence, and kills a timed-out process. A missing CLI records `CODEX_CLI_UNAVAILABLE`; an inaccessible CLI returns structured `START_ERROR`; authentication failures are captured as failed process results. The Docker image intentionally does not claim to contain Codex: install and authenticate the official Linux CLI in the production worker image before enabling this mode. This retains Linux/container/headless compatibility and does not require any desktop UI. `AUTO_PUSH` and auto-merge are not implemented.

`Dockerfile.worker` is the Linux runtime for the Codex worker. It installs Git and the official Codex Linux installer, then runs as the non-root `codex` user. It intentionally contains no credentials. In cloud production, use the platform Secret Manager to inject the credential supported by the installed Codex CLI and set only the non-secret `CODEX_AUTH_SECRET_REF` for deployment observability. The application does not read or log that credential.

### Controlled real integration test

The real test is isolated from `npm test`: provision a disposable cloned repository and authenticated Linux container, then run `RUN_CODEX_INTEGRATION=1 CODEX_INTEGRATION_REPOSITORY=/workspace/sandbox npm test -- tests/integration/codex-hello.integration.ts`. It asks Codex to create only `hello.txt` with `PUB DEV LOOP TEST`; no push or merge occurs. The worker itself creates `worker/codex/TASK-ID`, records its diff summary, and commits successful file changes locally with the worker identity.

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

`.env.example` lists all supported configuration. Never commit `.env`, tokens, or private keys. `AGENT_MODE=mock` is the default and safely proves orchestration without modifying repositories. Set `AGENT_MODE=codex` only in a worker image/environment that has an authenticated `codex` CLI; it runs `codex exec <task prompt>`. Project-specific test commands and pushing commits are intentionally not implemented in V0.1, so the result is a local branch/commit record only.

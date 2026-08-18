# README For Agents

You are an agent working on PUB DEV LOOP.

Read in this order:

1. `docs/AGENT_CONTINUITY.md`
2. `docs/PUB_DEV_LOOP_MASTER_CONTEXT.md`
3. `docs/PROJECT_STATE.md`
4. `docs/ARCHITECTURE_DECISIONS.md`
5. `docs/AGENT_HANDOFF.md`
6. task-specific documentation

Where to look:

- Backend: `src/`
- Worker: `src/worker.ts`, `src/worker-service.ts`, `src/router-worker.ts`
- Providers: `src/providers/`
- Tests: `tests/`
- Infra: `docker-compose.yml`, `Dockerfile.worker`, `wrangler.jsonc`
- Migrations: `db/migrations/`
- Frontend: frozen separately; do not change unless the task explicitly requires it
- Docs: `docs/`

Rules:

- Do not assume a previous conversation is still valid.
- Do not assume 9Router is reachable until you test it.
- Do not change worker lifecycle or repository safety logic without evidence.
- Do not use OpenRouter as a replacement gateway.


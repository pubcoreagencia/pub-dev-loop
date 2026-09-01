# PUB DEV LOOP V0.1

Cloud-first MVP for a persistent coding-task loop: HTTP API -> PostgreSQL queue -> Codex worker -> Git branch -> persisted result.

PUB DEV LOOP's broader purpose is to let GPT plan and review a controlled engineering loop while workers implement tasks and Git preserves the audit trail. The current operational MVP is deliberately cloud-only with Codex as its sole worker; broader multi-worker ambitions remain future work.

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

`AGENT_MODE=mock` is the safe default. To use the real worker, install the Codex CLI in the Linux worker image, authenticate it non-interactively using the credential mechanism supported by the deployed CLI, set `AGENT_MODE=codex`, and set `AGENT_TIMEOUT_MS` as appropriate. The adapter invokes the documented headless form `codex -c approval_policy=never -c sandbox_mode=workspace-write exec <prompt>` only inside the task's isolated cloned workspace.

`AGENT_PROVIDER` is the new explicit provider selector. Supported values are `mock`, `codex-api`, and `9router`. `codex-api` preserves the Codex worker path, while `9router` uses an OpenAI-compatible gateway as the planning brain and keeps filesystem, shell, and Git control inside the worker runtime.


`AgentExecutor` starts the process without a shell, captures stdout/stderr, redacts common secret values before persistence, and kills a timed-out process. A missing CLI records `CODEX_CLI_UNAVAILABLE`; an inaccessible CLI returns structured `START_ERROR`; authentication failures are captured as failed process results. The Docker image intentionally does not claim to contain Codex: install and authenticate the official Linux CLI in the production worker image before enabling this mode. This retains Linux/container/headless compatibility and does not require any desktop UI. `AUTO_PUSH` and auto-merge are not implemented.

For the first cloud proof, a manual GitHub Actions Ubuntu worker runs the real isolated `hello.txt` integration test. See [GitHub Actions Worker](docs/GITHUB_ACTIONS_WORKER.md). It is experimental and does not replace the Docker/Linux worker runtime.

`Dockerfile.worker` is the Linux runtime for the Codex worker. It installs Git and the official Codex Linux installer, then runs as the non-root `codex` user. It intentionally contains no credentials. In cloud production, use the platform Secret Manager to inject the credential supported by the installed Codex CLI and set only the non-secret `CODEX_AUTH_SECRET_REF` for deployment observability. The application does not read or log that credential.

### Controlled real integration test

The real test is isolated from `npm test`: provision a disposable cloned repository and authenticated Linux container, then run `RUN_CODEX_INTEGRATION=1 CODEX_INTEGRATION_REPOSITORY=/workspace/sandbox npm test -- tests/integration/codex-hello.integration.ts`. It asks Codex to create only `hello.txt` with `PUB DEV LOOP TEST`; no push or merge occurs. The worker itself creates `worker/codex/TASK-ID`, records its diff summary, and commits successful file changes locally with the worker identity.

## PP Production Safety Gate

Para garantir que deploys do PUB Prototype nunca sejam publicados com JavaScript quebrado, template strings corrompidas ou erros de parsing V8, todo deploy de produção do worker exige a execução prévia obrigatória do gate:

```sh
npm run pp:safety-gate
```

### O que o Gate valida:
1. **Typecheck & Build**: Compilação TypeScript integral sem erros.
2. **Geração do HTML Real**: Avalia `prototypeUiHtml()` e extrai todos os blocos `<script>`.
3. **Compilação Estrita no V8 (`node:vm`)**: Garante ZERO `SyntaxError`, ausência de variáveis duplicadas (`let/const`) e validação de todas as regex.
4. **Teste Negativo de Controle**: Prova que o validador falha imediatamente caso JavaScript inválido seja inserido.
5. **Execução no DOM Simulado (JSDOM)**: Simula o carregamento no browser, chamada a `/prototype/sessions` e renderização de `#projectsList`.
6. **Contrato da API**: Valida o payload de sessões.

Qualquer deploy via `npm run deploy:cf` invoca o `pp:safety-gate` antes de prosseguir com o Wrangler. Deploys sem PASS são proibidos.

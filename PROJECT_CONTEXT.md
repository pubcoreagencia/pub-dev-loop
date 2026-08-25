# PROJECT_CONTEXT.md

## Repository Overview
- **Name**: `pubcoreagencia/pub-dev-loop`
- **Branch**: `feat/pub-prototype-mode`
- **Primary Language**: TypeScript (Node.js 22)
- **CI**: GitHub Actions (`ubuntu-latest`) running `npm ci`, `npm run typecheck`, `npm run build`, `npm run build:cf`, `npm test`.
- **Deployment**: Cloudflare Workers + Cloudflare Containers. Docker image built in CI via Buildx, pushed to Cloudflare Managed Registry, and rolled out with `wrangler deploy --containers-rollout=immediate`.

## Architecture Overview
```mermaid
flowchart LR
    subgraph CI[GitHub Actions CI]
        A[Checkout] --> B[Install deps]
        B --> C[Typecheck]
        C --> D[Build]
        D --> E[Build CF Worker]
        E --> F[Run tests]
        F --> G[Docker Buildx]
        G --> H[Wrangler deploy]
    end
    subgraph Cloud[Cloudflare]
        H --> I[Image pushed to Managed Registry]
        I --> J[PubDevLoopWorkerContainer (basic, 4 GB)]
        J --> K[OpenRouter gateway]
        K --> L[API Worker (pub-dev-loop-api)]
        L --> M[Prototype endpoints]
    end
```

## Runtime Environment
- **Container**: `PubDevLoopWorkerContainer` (instance_type `basic`, 4 GB disk, 1 GiB RAM).
- **Worker**: `pub-dev-loop-api` (Cloudflare Worker script).
- **Gateway**: OpenRouter (primary). 9Router is only a dev fallback, disabled in production.
- **Secrets (Cloudflare Worker)**:
  - `OPENROUTER_API_KEY`
  - `DATABASE_URL`
  - `PUB_DEV_LOOP_API_KEY`
  - `ROUTER_API_KEY` (optional for 9Router)
- **Env vars** (provided via secrets or `.env` locally) are defined in `src/api-worker.ts`.

## Build & Deploy Process
1. Push to `feat/pub-prototype-mode` triggers **cloudflare-container-build.yml** workflow.
2. CI runs typecheck, build, tests.
3. Docker Buildx builds the image from `Dockerfile.worker` on the Linux runner.
4. Image is pushed to `registry.cloudflare.com/<account>/pub-dev-loop-api-pubdevloopworkercontainer`.
5. `wrangler deploy --containers-rollout=<strategy>` deploys the Worker script and rolls out the new container version.
6. Post‑deploy steps list containers, inspect the newly created container, and run smoke tests (`/health`, `/prototype` auth).

## Dependencies
- **Runtime**: `@cloudflare/containers`, `pg`, `express`, `node-fetch`.
- **Dev**: `typescript`, `vitest`, `ts-node`, `eslint`, `prettier`.
- **Container Base Image**: `node:22-alpine` (see `Dockerfile.worker`).

## Security & Secrets
- Secrets are stored only in Cloudflare Worker secrets and GitHub Actions secrets; never committed.
- `.gitignore` excludes all `.env*` files.
- API authentication enforced via `PUB_DEV_LOOP_API_KEY`; unauthenticated requests receive `401`.

## Testing & Quality
- Test suite: 172 passing, 8 skipped.
- End‑to‑end flow validated for health, auth, task creation, checkpoint, preview, SSE, and rollback.
- Rate‑limiting and retry logic exercised in unit tests.

## Documentation Produced for Handoff
- `HANDOFF_CODEX.md`
- `AUDIT_20128.md`
- `CHANGELOG.md`
- `DEPLOY_RUNBOOK.md`
- `ARCHITECTURE.md`

*This file serves as the single source of truth for the project state.*

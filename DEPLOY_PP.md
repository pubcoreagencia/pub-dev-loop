# PUB Prototype — Cloudflare Deployment

## Runtime

- Cloudflare Worker: `pub-dev-loop-api`
- Production branch for the initial PP deployment: `feat/pub-prototype-mode`
- PostgreSQL: Cloudflare Hyperdrive binding already configured in `wrangler.jsonc`
- PP HTTP surface: `src/api.ts` through `PubDevLoopApiContainer`
- Task worker: `PubDevLoopWorkerContainer`
- Container image: `Dockerfile.worker`

## Workers Builds

Use Cloudflare Workers Builds with:

- Repository: `pubcoreagencia/pub-dev-loop`
- Branch: `feat/pub-prototype-mode`
- Build command: `npm run build:cf`
- Deploy command: `npx wrangler deploy --containers-rollout=immediate`

## Required runtime secrets/variables

- `PUB_DEV_LOOP_API_KEY`
- `GITHUB_TOKEN`
- `OPENROUTER_API_KEY`
- `ROUTER_API_KEY` when the secondary 9Router gateway is enabled

The database connection is provided through the existing Hyperdrive binding.

## Important

Containers require a production deployment with `wrangler deploy`; preview uploads do not update container images. After the first deployment, allow the container instances time to provision before testing `/prototype`.

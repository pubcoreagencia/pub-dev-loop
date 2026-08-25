# HANDOFF_CODEX.md

## Overview
This document provides Codex (or any future maintainer) with everything needed to understand, build, test, and deploy the **pub-dev-loop** project.

## Repository
- **URL**: https://github.com/pubcoreagencia/pub-dev-loop
- **Primary branch**: `feat/pub-prototype-mode`
- **Language**: TypeScript (Node.js 22)

## Build & CI
1. **GitHub Actions** runs on `ubuntu-latest`.
2. Steps:
   - `npm ci`
   - `npm run typecheck`
   - `npm run build`
   - `npm run build:cf`
   - `npm test`
   - Docker Buildx builds the image from `Dockerfile.worker`.
   - Image is pushed to Cloudflare Managed Registry.
   - `npx wrangler deploy --containers-rollout=immediate` deploys the Worker and rolls out the container.
3. Secrets required (set in GitHub Actions):
   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID`
   - All other secrets are stored as Cloudflare Worker secrets.

## Runtime Secrets (Cloudflare Worker)
- `OPENROUTER_API_KEY`
- `DATABASE_URL`
- `PUB_DEV_LOOP_API_KEY`
- `ROUTER_API_KEY` (optional for 9Router fallback)

## Deployment Steps (manual trigger)
```bash
# Ensure you are on the correct branch
git checkout feat/pub-prototype-mode
# Push to trigger CI or run workflow manually via GitHub UI
git push origin feat/pub-prototype-mode
# Or trigger via CLI (if you have gh installed)
gh workflow run cloudflare-container-build.yml -f rollout_strategy=immediate
```
After the workflow completes, verify:
- `npx wrangler containers list` shows the container in **ready** state.
- `curl https://pub-dev-loop-api.contato-pubcore.workers.dev/health` returns `200`.
- Unauthenticated request to `/prototype/session` returns `401`.

## Rollback Procedure
1. Identify the previous container ID:
   ```bash
   npx wrangler containers list --limit 5
   ```
2. Roll back to a prior version:
   ```bash
   npx wrangler containers rollback <container-id> --containers-rollout=immediate
   ```
3. Verify health/endpoints as above.

## Testing
- Run the full suite locally:
  ```bash
  npm test
  ```
- End‑to‑end tests hit a real Cloudflare Worker; they are safe to run as they use the live deployment.

## Important Notes
- **Never** modify `main`.
- Do **not** expose any secret values in the repository.
- The Docker build is performed in CI; no local Docker Desktop is required.
- 9Router is kept only for local development and is **disabled** in production.

---
*Prepared for hand‑off to Codex. All steps are reproducible and automated.*

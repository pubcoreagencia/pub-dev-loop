# Current State

## Último Commit Estável
`17a6ee0` — fix(worker): add db:migrate script to package.json for staging deployment

## Branch
`feat/pub-prototype-mode`

## 9Router Investigation Complete ✅
- **Root Cause**: cx/gpt-* models fail because Codex provider uses ChatGPT free account (not Codex)
- **Available Models**: `oc/laguna-s-2.1-free`, `gemini/gemini-3.5-flash-lite`, `gemini/gemini-3.6-flash`
- **Broken Models**: `cx/*` (codex auth issue), `nvidia/*` (410), `kimi/*` (402), `ag/*` (token expired/empty responses)
- **Fix Applied**: `.env.staging` updated to use `oc/laguna-s-2.1-free` (Laguna S 2.1)
- **E2E Validated**: Task `d138bf4f` COMPLETED — model: laguna-s-2.1-free, provider: 9router, 5259ms, commit afbca3c4

## Git State (runtime)
- Working directory: C:\Users\Matheus Paes\Documents\ChatGPT\PUB DEV LOOP
- Worktree: clean (on feat/pub-prototype-mode branch)
- GITHUB_TOKEN: NOT SET (same as TASK-000034)

## Docker Status
- postgres: healthy
- api: healthy (port 3000)
- worker: healthy (RouterWorker, model: oc/laguna-s-2.1-free)
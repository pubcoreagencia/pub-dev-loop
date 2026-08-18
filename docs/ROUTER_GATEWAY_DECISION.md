# Router Gateway Decision

## Current State

- **Client Layer (`RouterProvider` & `RouterWorker`)**:
  - The PUB DEV LOOP backend contains a complete, robust OpenAI-compatible LLM client gateway ([`src/providers/router.ts`](file:///C:/Users/Matheus%20Paes/Documents/ChatGPT/PUB%20DEV%20LOOP/src/providers/router.ts)) and worker loop ([`src/router-worker.ts`](file:///C:/Users/Matheus%20Paes/Documents/ChatGPT/PUB%20DEV%20LOOP/src/router-worker.ts)).
  - It handles multi-step tool calls ([`ToolRuntime`](file:///C:/Users/Matheus%20Paes/Documents/ChatGPT/PUB%20DEV%20LOOP/src/tools/runtime.ts)), workspace sandboxing ([`WorkspaceSecurity`](file:///C:/Users/Matheus%20Paes/Documents/ChatGPT/PUB%20DEV%20LOOP/src/tools/security.ts)), execution tracing, retries, and clean finalization.
  - The worker lifecycle bug fix (`2ff44a4`) is verified and stable (`QUEUED -> ASSIGNED -> RUNNING -> FAILED/COMPLETED` without orphan tasks).

- **Server/Gateway Layer (`9Router`)**:
  - The 9Router service/gateway is **not provisioned**.
  - `https://9router.contato-pubcore.workers.dev` returns HTTP 404 HTML from Cloudflare (no Worker published on this route for account `Contato.pubcore@gmail.com`).
  - Local sidecar gateway `http://host.docker.internal:20128/v1` is not active (`ECONNREFUSED`).
  - No separate 9Router repository exists; 9Router is an architectural interface specification rather than a running standalone service in the repository.

---

## Required Contract

The LLM Gateway must strictly fulfill the OpenAI Chat Completions API contract expected by [`src/providers/router.ts`](file:///C:/Users/Matheus%20Paes/Documents/ChatGPT/PUB%20DEV%20LOOP/src/providers/router.ts):

| Attribute | Contract Requirement |
| :--- | :--- |
| **Protocol** | HTTP / HTTPS REST |
| **Base URL** | `ROUTER_BASE_URL` env variable (e.g. `https://.../v1`) |
| **Health Check Endpoint** | `GET ${ROUTER_BASE_URL}/models` (returns 200 OK with model list) |
| **Chat Endpoint** | `POST ${ROUTER_BASE_URL}/chat/completions` |
| **Authentication** | `Authorization: Bearer ${ROUTER_API_KEY}` (when key is configured) |
| **Request Payload** | `{ model: string, messages: OpenAIChatMessage[], tools: ToolFunctionSpec[], tool_choice: "auto", stream: false }` |
| **Supported Tools** | `read_file`, `write_file`, `list_files`, `run_command` |
| **Tool Response Format** | `choices[0].message.tool_calls` containing array of `{ id, type: "function", function: { name, arguments: JSON_string } }` |
| **Final Response Format** | `choices[0].message.content` text summary with `finish_reason: "stop"` or empty `tool_calls` |
| **Gemini / OpenAI Compatibility** | Must allow `content: null` when `tool_calls` are present (required for OpenAI & Gemini compatibility) |

---

## Candidate Architectures

### Candidate A: Dedicated Cloudflare Worker (`9router` Worker)
- **Description**: Deploy a custom Cloudflare Worker at `9router.contato-pubcore.workers.dev` acting as an OpenAI-compatible proxy to upstream LLM providers (e.g. OpenRouter, Gemini, Anthropic).
- **Compatibility**: High (custom built for the exact contract).
- **Cost**: Low (Cloudflare Worker free/standard tier + upstream API costs).
- **Security**: High (secrets stored in Cloudflare Workers Secrets).
- **Tool Support**: Full (passes tool definitions through to native tool-calling models).
- **Deployment Complexity**: Medium (requires writing, testing, and deploying a new Cloudflare Worker).

### Candidate B: OpenRouter API Directly (`https://openrouter.ai/api/v1`)
- **Description**: Set `ROUTER_BASE_URL=https://openrouter.ai/api/v1` and `ROUTER_API_KEY=<openrouter_key>` directly in Worker environment / secrets.
- **Compatibility**: 100% (OpenRouter strictly follows OpenAI Chat Completions API with native tool-calling support for models like `google/gemini-2.5-flash`, `anthropic/claude-3.5-sonnet`, `openai/gpt-4o`).
- **Cost**: Pay-as-you-go per token via OpenRouter account.
- **Security**: High (standard HTTPS + API Key authentication).
- **Tool Support**: Native support across all leading models.
- **Deployment Complexity**: Low (zero new code or workers needed; configuration-only change via `ROUTER_BASE_URL` and `ROUTER_API_KEY`).

### Candidate C: Local / Sidecar Proxy Gateway (Port 20128)
- **Description**: Run a local LiteLLM / Ollama / 9Router proxy daemon on host port 20128 (`http://host.docker.internal:20128/v1`).
- **Compatibility**: High (if configured with OpenAI compatibility).
- **Cost**: Free (if local models) or API cost.
- **Security**: Low for Cloudflare Production (cannot easily connect to local host without tunnels), High for local dev.
- **Tool Support**: Limited depending on local model tool-calling capabilities.
- **Deployment Complexity**: High for Cloudflare Production; convenient for local dev only.

---

## Recommended Architecture

### **Primary Recommendation: Direct OpenAI-Compatible Gateway / OpenRouter (Candidate B)**

**Rationale**:
1. **Zero Architectural Drift**: `RouterProvider` was explicitly coded as a universal OpenAI-compatible client. `https://openrouter.ai/api/v1` or an equivalent OpenAI-compatible gateway matches every single line of `src/providers/router.ts` without requiring a single line of new proxy code.
2. **Immediate Availability & High Reliability**: Removes single point of failure and custom Cloudflare worker maintenance.
3. **Multi-Model Fallback Support**: `ROUTER_PROVIDER_CHAIN` (e.g. `router:google/gemini-2.5-flash,router:anthropic/claude-3.5-sonnet`) works natively out of the box.

---

## Required Infrastructure

- **Target Domain / Base URL**: `https://openrouter.ai/api/v1` (or dedicated deployed gateway endpoint).
- **Supported Models**: `google/gemini-2.5-flash`, `anthropic/claude-3.5-sonnet`, `openai/gpt-4o-mini`.
- **Egress Network**: Outbound HTTPS from Cloudflare Workers / Docker containers to port 443.

---

## Required Secrets

1. `ROUTER_BASE_URL` = `https://openrouter.ai/api/v1`
2. `ROUTER_API_KEY` = `<valid_api_key>`
3. `ROUTER_MODEL` = `google/gemini-2.5-flash`

---

## Required Deployment

1. Register `ROUTER_BASE_URL` and `ROUTER_API_KEY` in Cloudflare Secrets:
   ```bash
   npx wrangler secret put ROUTER_BASE_URL
   npx wrangler secret put ROUTER_API_KEY
   ```
2. Update local `.env` for Docker worker container:
   ```env
   AGENT_PROVIDER=9router
   ROUTER_BASE_URL=https://openrouter.ai/api/v1
   ROUTER_API_KEY=<valid_api_key>
   ROUTER_MODEL=google/gemini-2.5-flash
   ```

---

## Security Model

- All credentials (`ROUTER_API_KEY`) strictly passed via `Authorization: Bearer` headers.
- Secrets stored in Cloudflare Secrets (production) and local `.env` (gitignored).
- Zero secret logging in trace logs (`redactSecrets: true` in [`ToolRuntime`](file:///C:/Users/Matheus%20Paes/Documents/ChatGPT/PUB%20DEV%20LOOP/src/tools/runtime.ts)).
- Workspace path traversal security enforced by [`WorkspaceSecurity`](file:///C:/Users/Matheus%20Paes/Documents/ChatGPT/PUB%20DEV%20LOOP/src/tools/security.ts).

---

## Migration Impact

- **Frontend (`pub-dev-loop-3d`)**: Zero changes required.
- **Backend Core (`src/worker.ts`, `src/repository.ts`)**: Zero changes required.
- **Baseline Fix (`2ff44a4`)**: 100% preserved.

---

## E2E Acceptance Criteria

To transition status from `BLOCKED` to `READY_FOR_PRODUCTION`, a real task created via the 3D Frontend UI must complete the full lifecycle:

```
Browser -> BFF -> POST /tasks -> PostgreSQL -> RouterWorker -> ROUTER_BASE_URL -> LLM Tool Call -> Workspace Tool Execution -> Testing -> TaskFinalizer -> Auto-Commit -> SHA -> COMPLETED
```

- Invariant Validation: `SELECT count(*) FROM tasks WHERE status = 'RUNNING';` must equal `0`.

# PUB Prototype — Architecture Research & Design Basis

## 1. Purpose

PUB Prototype (PP) is the rapid product-creation experience of the PUB REC Holding.

Its job is to turn a natural-language idea into a running, iterative MVP:

`idea → prompt → generated code → live preview → prompt iteration → preview evolution → deploy → Git → PDL development`

PP is not a second engineering engine. It should reuse the mature execution capabilities already present in PUB DEV LOOP (PDL) and add a product/prototyping layer around them.

## 2. Target UX

The target experience is a Lovable-like split workspace:

- left: persistent conversation and agent activity;
- right: live application preview;
- each user prompt creates an incremental change to the same prototype session;
- preview updates after the change/build succeeds;
- user can continue iterating without leaving the session;
- approval promotes the repository to PDL Development Mode.

Example:

`"Monte um sistema para gerenciamento de uma barbearia"`

→ create project
→ generate UI/UX and mock behavior
→ start preview
→ show running app beside chat
→ user: `"Adicione uma agenda semanal"`
→ update code
→ rebuild/reload
→ same preview session reflects the change

## 3. Current PDL capabilities that should be reused

The current `pub-dev-loop` already provides the core execution primitives required by PP:

- `Task` lifecycle and persistent task repository (`src/domain.ts`, `src/repository.ts`);
- worker queue claiming, leases and heartbeats;
- `BaseWorker` execution lifecycle (`src/worker-service.ts`);
- `RouterWorker` and 9Router provider-chain execution (`src/router-worker.ts`);
- isolated temporary repositories/workspaces per attempt;
- retry/fallback behavior for router failures;
- workspace snapshots and change validation;
- `TaskFinalizer` with tests, validation and automatic Git commit (`src/finalizer.ts`);
- command execution with timeout and secret redaction (`src/executor.ts`);
- provider abstraction under `src/providers/`;
- task API under `src/api.ts`.

The README also documents `9router` as an existing provider path and confirms that the worker clones repositories, creates worker branches, executes the agent and preserves Git metadata/results.

## 4. Architectural decision

### Decision

Implement PP as a **Prototype Mode/domain on top of the PDL execution core**, not as an independent second coding engine.

### Modes

`PROTOTYPE`
- optimized for speed and visual validation;
- mock data and simulated integrations are allowed;
- live preview is mandatory;
- build/health validation is mandatory;
- preview checkpoints are first-class;
- production hardening is explicitly out of scope.

`DEVELOPMENT`
- existing PDL engineering workflow;
- real integrations;
- tests and security hardening;
- architecture and refactoring;
- CI/CD and production deployment.

## 5. What is new for PP

The PDL core is not sufficient by itself for a Lovable-like experience. PP needs these new domains:

### 5.1 Prototype Session

A persistent session representing one idea/product iteration:

- project id;
- repository;
- branch;
- current runtime/sandbox;
- preview URL;
- current preview status;
- prompt history;
- active task id;
- last successful checkpoint;
- build status;
- runtime logs;
- errors;
- mode (`PROTOTYPE` / `DEVELOPMENT`);
- promotion status.

### 5.2 Preview Runtime

An abstraction for starting and controlling the application being built:

- create workspace/runtime;
- install dependencies;
- start dev server;
- detect/declare port;
- stream logs;
- health-check;
- restart after code changes when necessary;
- expose preview URL;
- stop/sleep/wake;
- destroy.

Suggested interface:

```ts
interface PreviewRuntime {
  create(input: PreviewCreateInput): Promise<PreviewSession>
  start(sessionId: string): Promise<PreviewRuntimeState>
  restart(sessionId: string): Promise<PreviewRuntimeState>
  health(sessionId: string): Promise<PreviewHealth>
  logs(sessionId: string): AsyncIterable<PreviewLogEvent>
  expose(sessionId: string, port: number): Promise<string>
  stop(sessionId: string): Promise<void>
  destroy(sessionId: string): Promise<void>
}
```

The implementation must remain replaceable. Candidate runtimes:

- Docker + reverse proxy/tunnel (recommended V1);
- Cloudflare Sandbox/tunnels;
- E2B;
- WebContainers/BrowserCode for a future browser-local fast path.

### 5.3 Event streaming

The PP UI needs live progress from the worker without polling every UI element manually.

Required event types:

- `prompt.accepted`
- `task.queued`
- `task.running`
- `agent.tool.started`
- `agent.tool.completed`
- `file.changed`
- `build.started`
- `build.completed`
- `preview.starting`
- `preview.ready`
- `preview.failed`
- `preview.restarting`
- `checkpoint.created`
- `deploy.started`
- `deploy.completed`
- `task.failed`

Transport can be SSE or WebSocket in V1. WebSocket is preferable if bidirectional preview/session control is required; SSE is simpler if the first milestone is server-to-client progress only.

### 5.4 Prototype checkpoints

Every successful prompt/build cycle should be restorable.

A checkpoint should retain at least:

- prompt;
- task id;
- commit SHA;
- branch;
- changed files;
- build result;
- preview URL/state at checkpoint time;
- timestamp.

Git remains the source of truth; checkpoint metadata is a product/session abstraction on top of Git.

### 5.5 Promotion

The prototype must have an explicit promotion boundary:

`PROTOTYPE_APPROVED → DEVELOPMENT`

Promotion should preserve:

- same repository;
- same Git history;
- same branch/selected promotion ref;
- `.pub/` prototype context;
- known limitations;
- mock inventory;
- pending production work.

## 6. Reference projects researched

### sandboxd

GitHub: https://github.com/tastyeffectco/sandboxd

Key ideas to borrow:

- isolated container per app;
- live preview URL per sandbox;
- API-first/headless engine;
- lifecycle management;
- sleep/wake;
- runtime presets;
- in-browser Git/diff flow;
- snapshots/fork/restore;
- process logs.

Why it matters: it is the closest open-source reference to a self-hosted engine that turns a prompt into a running app at a preview URL.

Source: GitHub README, accessed 2026-08-19.

### AI App Builder Open

GitHub: https://github.com/totalumlabs/ai-app-builder-open

Key ideas to borrow:

- prompt to full application;
- live preview;
- logs;
- code editor;
- version history/checkpoints;
- GitHub synchronization;
- one-click deploy.

Why it matters: it represents the complete product experience PP is targeting.

Source: GitHub README, accessed 2026-08-19.

### Claudable

GitHub: https://github.com/opactorai/Claudable

Key ideas to borrow:

- Lovable-like UX over external/local CLI agents;
- Codex/Claude/Gemini/Qwen/Cursor agent compatibility;
- instant preview with hot reload;
- GitHub + Vercel integrations.

Why it matters: it strongly validates the decision to keep intelligence/provider choice outside the product UX and make the builder an orchestration layer.

Source: GitHub README, accessed 2026-08-19.

### Beam Lovable Clone

GitHub: https://github.com/beam-cloud/lovable-clone

Key ideas to borrow:

- model client separated from sandbox;
- React/Vite sandbox runtime;
- WebSocket-based agent communication;
- streaming edit requests.

Why it matters: useful reference for the chat/agent/preview real-time protocol.

Source: GitHub README, accessed 2026-08-19.

### Dyad

GitHub: https://github.com/dyad-sh/dyad

Key ideas to borrow:

- AI app-builder project UX;
- local-first/BYOK philosophy;
- persistent project sessions;
- practical lessons from preview/runtime edge cases.

Why it matters: useful for product/session UX and for identifying real-world preview reliability problems.

Source: public GitHub repository/issues, accessed 2026-08-19.

### E2B

GitHub: https://github.com/e2b-dev/e2b

Key ideas to evaluate:

- isolated cloud sandbox for AI-generated code;
- SDK-controlled filesystem and commands;
- long-running processes;
- internet access;
- Git cloning;
- web server exposure.

Why it matters: strong candidate reference for a future hosted sandbox runtime if PUB outgrows single-host Docker.

Source: GitHub README, accessed 2026-08-19.

### BrowserCode

GitHub: https://github.com/leaningtech/browsercode

Key ideas to evaluate:

- Node.js in browser via WebAssembly;
- browser-contained filesystem;
- bash/git/npm;
- instant browser preview;
- browser-side CLI agents.

Why it matters: possible future fast path for prototypes that do not need a remote sandbox.

Source: GitHub README, accessed 2026-08-19.

## 7. Preview URL strategy

The preview system must support an internal/local URL and a shareable URL.

### V1 recommendation

Use a server-side isolated runtime and expose its application port through a proxy/tunnel.

A useful production pattern is:

`runtime → app port → preview router → stable session URL`

Cloudflare Sandbox documents two relevant patterns:

- quick tunnels for zero-configuration temporary URLs;
- exposed ports + wildcard/custom domain routing for stable production-style URLs.

Sources:

- https://developers.cloudflare.com/sandbox/concepts/preview-urls/
- https://developers.cloudflare.com/sandbox/guides/expose-services/

The PP abstraction should hide the transport so the UI only knows `preview.url`.

## 8. Preview lifecycle

```text
CREATE SESSION
   ↓
CREATE RUNTIME
   ↓
CLONE/INIT PROJECT
   ↓
INSTALL DEPENDENCIES
   ↓
START DEV SERVER
   ↓
HEALTH CHECK
   ↓
EXPOSE PREVIEW
   ↓
READY
   ↓
USER PROMPT
   ↓
PDL TASK EXECUTION
   ↓
FILES UPDATED
   ↓
BUILD/HEALTH CHECK
   ↓
RELOAD OR RESTART
   ↓
CHECKPOINT
   ↓
PREVIEW UPDATED
```

Failure path:

`build/runtime error → collect logs → expose concise error to agent → repair task → rebuild → preview ready`

## 9. Important non-goals for PP V1

Do not put these into the prototype mode unless required by the product:

- production-grade database migrations;
- full security hardening;
- enterprise observability;
- complex multi-region deployment;
- automatic production merge;
- irreversible external integrations;
- real payment processing;
- real customer data.

Mocks are a feature, not a defect, during PP.

## 10. Recommended V1 stack

### Reuse from PDL

- TypeScript/Node runtime;
- Postgres task persistence;
- task/worker lifecycle;
- leases/heartbeats;
- 9Router provider path;
- workspace isolation;
- executor;
- Git branch/commit workflow;
- finalizer/security controls.

### Add for PP

- Prototype Session domain + persistence;
- Preview Runtime interface;
- initial Docker runtime;
- preview URL routing (Traefik or equivalent reverse proxy; Cloudflare tunnel is an alternative for public previews);
- SSE/WebSocket event stream;
- prototype checkpoint metadata;
- split-pane PP frontend;
- prompt-to-task adapter;
- promotion endpoint/state change.

## 11. Recommended first architecture

```text
                 PUB PROTOTYPE UI
              ┌────────┴──────────┐
              │                   │
           CHAT PANEL         LIVE PREVIEW
              │                   │
              └─────────┬─────────┘
                        ↓
                 PP SESSION API
                        ↓
                PDL TASK EXECUTION
                        ↓
                     9ROUTER
                        ↓
                      AGENT
                        ↓
               ISOLATED WORKSPACE
                        ↓
                PREVIEW RUNTIME
                        ↓
                  DEV SERVER
                        ↓
                   PREVIEW URL
                        ↓
                  CHECKPOINT/GIT
                        ↓
                PROMOTE TO PDL DEV
```

## 12. Design principle

PP must optimize for:

> **Time from idea to visible product.**

PDL must optimize for:

> **Time from approved MVP to professional production software.**

The same Git repository should move between these states without a rewrite or migration of the product codebase.

## 13. Acceptance target for the first end-to-end proof

User enters:

`Monte um sistema para gerenciamento de uma barbearia.`

Expected result:

1. a new prototype session is created;
2. the agent generates a usable web MVP;
3. a live preview appears beside the conversation;
4. user submits at least two additional prompts;
5. the same preview session reflects both changes;
6. each successful iteration has a Git/checkpoint record;
7. preview errors are surfaced and recoverable by another agent iteration;
8. user can publish the MVP;
9. user can promote the repository to PDL Development Mode.

## 14. Final recommendation

Do **not** clone Lovable wholesale.

Do **not** create a second coding engine from scratch.

Build the PP product experience around the existing PDL execution engine, using the best proven ideas from sandboxd, AI App Builder Open, Claudable, Beam's Lovable clone, Dyad, E2B and browser-based runtimes.

The strategic differentiator is:

`PUB Prototype UX + PDL execution + 9Router model independence + Git/context continuity.`

# PUB DEV LOOP — Master Context

This document is the architectural source of truth for PUB DEV LOOP.

## Scope

PUB DEV LOOP is cloud-first and cloud-only. Local Windows and macOS computers are development clients, never operational components. GPT is the future planning/orchestration brain. PostgreSQL is the initial durable task-state store and queue. GitHub is the source of truth for source code.

The V0.1 loop is: task API -> PostgreSQL queue -> ephemeral coding worker -> isolated Git branch -> persisted result -> future GPT follow-up task. Workers run on Linux/Docker with temporary workspaces. The MVP coding backends are Codex API and 9Router, selected through the provider abstraction. `AgentExecutor` is the process-execution abstraction used by coding adapters.

GitHub Actions on an Ubuntu runner is the first experimental cloud runtime used to validate the worker. It is an ephemeral execution environment, not the definitive architecture; the same worker remains portable to Docker/Linux and future cloud runtimes.

## Explicit exclusions

Hermes, Antigravity, OpenClaw, dashboards, auto-merge, auto-push, automatic deployment, Kubernetes, and distributed messaging are out of scope. No worker may merge code automatically. The new 9Router gateway is a provider backend only; it does not replace worker isolation or give direct host access.

## Security

Secrets are injected at runtime by the deployment platform's Secret Manager; never commit them, print them, put them in Dockerfiles, or persist them in task results. Workers use non-root users, process timeouts, redacted logs, isolated temporary workspaces, and cleanup. Repository credentials and Codex authentication are deployment concerns, not application configuration values.

## Evolution

New workers must implement the existing worker/agent interfaces without changing orchestration or the task model. Multiple workers, richer test policies, secret-manager bindings, and cloud deployment are future work once the single-Codex loop is proven. Provider selection now goes through `AGENT_PROVIDER`, with `mock`, `codex-api`, and `9router` as initial options.

## Persistence-First Continuity

GitHub is not only the source of truth for source code; it is the durable continuity layer for project evolution. Conversations, AI memory, local machines, sessions, accounts, and specific model providers are temporary working environments and must not be required to resume development.

Every AI or worker that makes meaningful project evolution must, when repository write access is available, materialize the resulting state in Git. This includes code and tests plus relevant architecture, decisions, business rules, contracts, security constraints, phase/status, blockers, and handoff/resume instructions.

The required lifecycle is:

```text
READ CONTEXT -> IMPLEMENT -> VALIDATE -> UPDATE CONTEXT -> COMMIT -> PUSH/PR -> VERIFY PERSISTENCE
```

A task is not considered fully complete merely because code works in an ephemeral workspace. The next AI or developer must be able to continue from the repository without relying on the previous conversation. If persistence is blocked by permissions or connectivity, the blocker must be explicit and the work must remain recoverable; it must never be represented as persisted when it is not.

Project-specific continuity guidance should live in version control alongside the project. See the PUB Neural OS AI Continuity & Persistence Protocol for the organization-wide policy.

## Historical direction

The remote history added a broader product vision: GPT plans and reviews, workers execute isolated tasks, Git provides auditability, and human approval remains available for risky changes. That direction is retained, but earlier references to Windows/macOS operational workers, Hermes, and Antigravity are superseded by the current cloud-only MVP scope above. The full original document remains preserved in the merged Git history.

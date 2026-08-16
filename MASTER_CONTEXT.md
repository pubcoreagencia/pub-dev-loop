# PUB DEV LOOP — Master Context

This document is the architectural source of truth for PUB DEV LOOP.

## Scope

PUB DEV LOOP is cloud-first and cloud-only. Local Windows and macOS computers are development clients, never operational components. GPT is the future planning/orchestration brain. PostgreSQL is the initial durable task-state store and queue. GitHub is the source of truth for source code.

The V0.1 loop is: task API -> PostgreSQL queue -> ephemeral Codex worker -> isolated Git branch -> persisted result -> future GPT follow-up task. Workers run on Linux/Docker with temporary workspaces. The only MVP coding worker is Codex. `AgentExecutor` is the process-execution abstraction used by coding adapters.

## Explicit exclusions

Hermes, Antigravity, OpenClaw, dashboards, auto-merge, auto-push, automatic deployment, Kubernetes, and distributed messaging are out of scope. No worker may merge code automatically.

## Security

Secrets are injected at runtime by the deployment platform's Secret Manager; never commit them, print them, put them in Dockerfiles, or persist them in task results. Workers use non-root users, process timeouts, redacted logs, isolated temporary workspaces, and cleanup. Repository credentials and Codex authentication are deployment concerns, not application configuration values.

## Evolution

New workers must implement the existing worker/agent interfaces without changing orchestration or the task model. Multiple workers, richer test policies, secret-manager bindings, and cloud deployment are future work once the single-Codex loop is proven.

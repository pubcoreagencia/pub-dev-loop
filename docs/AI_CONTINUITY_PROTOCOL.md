# AI Continuity & Persistence Protocol

PUB DEV LOOP follows a persistence-first rule: the repository is the durable continuity layer for AI-assisted development.

## Rule

Meaningful project evolution must be materialized in Git whenever repository write access is available. This includes code, tests, architecture, decisions, requirements, contracts, security constraints, status, blockers, and handoff/resume information as applicable.

The conversation is a temporary working interface. It is not the system of record.

## Lifecycle

```text
READ REPOSITORY CONTEXT
        ↓
IMPLEMENT / CHANGE
        ↓
VALIDATE
        ↓
UPDATE CONTEXT / HANDOFF
        ↓
COMMIT
        ↓
PUSH / PR
        ↓
VERIFY PERSISTED STATE
```

A task/session is not fully complete merely because code works in an ephemeral worker or local workspace. The next AI or developer must be able to continue from Git without the previous conversation.

If persistence is blocked by permissions, connectivity, or another capability, record the blocker explicitly and leave the work recoverable. Never claim that an evolution has been persisted when it has not.

## Minimum Continuity State

Each project should have a clear version-controlled entry point that answers:

1. What is the project?
2. What is the current architecture?
3. What is implemented?
4. What is changing now?
5. Which decisions and constraints must be preserved?
6. What is blocked or unfinished?
7. What is the next safe step?

## Auditability

Prefer normal commits and pull requests. Do not rewrite published history merely to improve context documentation. Preserve the audit trail.

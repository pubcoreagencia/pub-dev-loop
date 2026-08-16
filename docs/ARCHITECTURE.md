# V0.1 Architecture

The application is intentionally a small cloud-compatible service, with no desktop dependency, Kubernetes, broker, or distributed coordinator.

```text
Client -> Express Task API -> PostgreSQL tasks table <- Codex worker
                                              |
                                       task result + Git metadata
Codex worker -> temporary workspace -> Git clone -> worker/codex/TASK-ID branch -> agent adapter
```

The PostgreSQL repository claims work using one `UPDATE` statement over a `FOR UPDATE SKIP LOCKED` candidate. This makes a task unavailable to another worker as soon as it is reserved. The worker updates state from `QUEUED` through `ASSIGNED`, `RUNNING`, `TESTING`, and then `COMPLETED` or `FAILED`.

`CodingAgent` is the seam between orchestration and coding systems. `MockCodingAgent` provides deterministic development operation. `CodexCliAgent` uses a separately authenticated Codex CLI when explicitly enabled. Future agent implementations can satisfy the same interface without changing queue logic.

## Real Codex Worker

`CodexCliAgent` delegates to the generic `AgentExecutor`, rather than spawning a process itself. The executor accepts command, arguments, workspace, timeout, and environment; it returns exit code, redacted stdout/stderr, duration, and status (`COMPLETED`, `FAILED`, `TIMED_OUT`, or `START_ERROR`). A timeout terminates the process and then force-kills it if needed, preventing an orphaned agent process. Worker persistence stores the structured execution result only after redaction.

The real adapter detects whether `codex` is executable before task execution. It uses `codex exec --full-auto <prompt>` in the task-specific cloned repository. The official CLI supports `codex exec` for repeatable workflows and pipelines; an authenticated Linux CLI is a deployment prerequisite. No CLI binary or credentials are baked into this repository or Docker image. This is compatible with headless Linux containers, temporary filesystems, and environment-provided authentication.

Temporary workspaces are removed in `finally`. Git remote push and merging are intentionally excluded. PostgreSQL is the only persistent queue/result store in this version.

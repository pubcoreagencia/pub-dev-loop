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

Temporary workspaces are removed in `finally`. Git remote push and merging are intentionally excluded. PostgreSQL is the only persistent queue/result store in this version.

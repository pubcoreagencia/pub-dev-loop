# PDL Persistence Gate, Invariant 6

## Status

Implemented as a canonical fail-closed evidence gate in:

- `src/pdl/persistence/persistence-gate.ts`
- `tests/pdl/persistence-gate.test.ts`

## Rule

A meaningful PDL change is not considered `COMPLETED` merely because an agent finished, tests passed, or a local commit exists.

The canonical sequence is:

```text
VALIDATE
→ CAPTURE EVIDENCE
→ COMMIT
→ PUSH
→ VERIFY REMOTE
→ VERIFY RUNTIME (when applicable)
→ HAND OFF
```

## Minimum evidence for material work

1. Validation passed.
2. A 40-character commit SHA exists.
3. The working tree is clean.
4. Remote persistence evidence exists.
5. Remote persistence is `VERIFIED`.
6. The remote SHA exactly matches the local commit SHA.
7. Production-affecting work has explicit runtime verification.

Any missing or contradictory evidence blocks completion.

## Why this exists

The September 12, 2026 autonomous-writer incident demonstrated that a Git-side correction is not equivalent to a production-side correction. A hard-stop commit existed in Git while an older Cloudflare deployment remained active and continued to write to a repository.

Invariant 6 turns that lesson into a reusable PDL contract: **local state is not the final state**. A handoff must leave a recoverable, remotely verified checkpoint, and operational changes require runtime confirmation.

## Architectural boundary

```text
AG executes
PDL governs
Git records the truth
Persistence Gate proves the checkpoint
Runtime verification proves production state
```

The gate is intentionally pure and fail-closed. It does not acquire credentials, choose repositories, or perform pushes itself. Those responsibilities remain in the existing governed remote-persistence layer.

## Important implementation note

This milestone establishes the canonical gate primitive and its failure-mode tests. The next integration step is to make the worker's terminal `COMPLETED` transition call this gate and remove the direct worker-level push path, so that no task can become complete while the persistence contract is unmet.

# ADR: Agent Quality Loop V1

## Status

Proposed, recorded for implementation.

## Decision

Generated code is not completed work. A PDL task is considered complete only after producing machine-verifiable quality evidence.

## Target flow

```text
Execution
  -> Quality Gates
  -> Diagnosis
  -> Bounded Correction
  -> Re-gate
  -> Evidence
  -> Finalization
```

## Initial gates

- Tests
- Validation/lint
- Build

Future gates may include duplication detection (for example, jscpd), typecheck, Playwright/UX, security, and repository-specific validation.

## Principles

1. Quality gates are product-aware and independently executable.
2. Correction is bounded and fail-closed.
3. Specific tools are gate implementations, not architectural dependencies of PDL.
4. `TaskFinalizer` remains responsible for finalization and integrity; quality validation remains a separate execution concern.
5. A successful commit is not sufficient evidence of task completion.

## Research origin

This decision was informed by the Copy-Think and agent self-validation research reviewed in September 2026. The research is treated as input/hypothesis until validated through PDL implementation and evidence.

## Related work

- Issue #20: Agent Quality Loop
- Issue #21: Agent Quality Loop V1 architectural decision

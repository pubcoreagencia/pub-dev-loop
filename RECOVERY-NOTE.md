# RECOVERY NOTE — PDL / PUB DEV LOOP

Created: 2026-09-11
Reason: Workspace contamination from prior experimental sessions

## Critical Reminders
1. **Do NOT modify** `src/task/spec-validator.ts` or `src/task/spec-semantics.ts` except for explicit, validated fixes that compile without errors.
2. **Do NOT re-add** `import { type ExecutionSpec } from './execution-spec.js';` to spec-validator.ts unless it's a valid production import with clear usage.
3. **Do NOT push** without explicit authorization for specific branch refs.
4. **Always check** git status before/after experiments.
5. **Preserve** stash entries with PDL context (e.g., `TEMP-PDL-A2-ISOLATION-PRESERVE-WORKTREE`).
6. **Do NOT** blindly apply suggested code changes without verifying they compile.

## Current State (as of last verification)
- HEAD is NOT at canonical A.2 baseline (cde0806)
- Spec-semantics.ts had a syntax error introduced by incorrect patching
- Stash entry exists for PDL A2 isolation preserve worktree
- Structural branches (7f246a9, 7cd9401) are the true canonical references

## Safe Pattern
- Verify all changes compile before proceeding
- Use git diff --name-only to check scope before any operation
- Never reset unless explicitly instructed
- Never cherry-pick without full audit
- Use `git log --oneline --all --graph` to check topology before any git operation

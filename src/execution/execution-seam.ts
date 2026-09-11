/**
 * Phase 3C.1 — Execution Spec Contract Seam (minimal, explicit, strictly contracted)
 *
 * PreparedExecution is the smallest validated execution abstraction
 * that delivers an authentic, validated ExecutionSpec (from A.2 pipeline)
 * to the worker execution boundary without inventing new architecture.
 *
 * Invariants preserved:
 * - ExecutionSpec identity is NOT reconstructed; it is passed through.
 * - Fails closed if ExecutionSpec is missing, null, primitive, or structurally invalid.
 * - Zero synthetic lineage or synthetic spec identity.
 * - Zero legacy bypass paths inside the contracted execution seam.
 * - No rebuild of ExecutionSpec; no raw-request substitution.
 * - No changes to routing, provider, finalization, or A.2.
 */
import type { ExecutionSpec } from '../task/execution-spec.js';
import type { Task } from '../domain.js';

export interface PreparedExecution {
  task: Task;
  executionSpec: ExecutionSpec;
}

function assertValidSpec(spec: unknown): asserts spec is ExecutionSpec {
  if (!spec || typeof spec !== 'object') {
    throw new Error('ExecutionSeam: ExecutionSpec is not an object');
  }
  // Structural identity preserved; do NOT rebuild fields
  const s = spec as ExecutionSpec;
  if (typeof s.specVersion !== 'string' || s.specVersion.trim().length === 0) {
    throw new Error('ExecutionSeam: ExecutionSpec.specVersion missing');
  }
  if (!s.lineage || typeof s.lineage.intakeHash !== 'string' || s.lineage.intakeHash.trim().length === 0) {
    throw new Error('ExecutionSeam: ExecutionSpec.lineage missing');
  }
}

/**
 * Minimal contracted delivery seam — delivers validated ExecutionSpec to execution.
 * Throws an explicit Error if ExecutionSpec is missing, null, or structurally invalid.
 * Does NOT provide legacy bypass or synthetic identity generation.
 */
export function prepareExecution(
  task: Task,
  executionSpec: unknown,
): PreparedExecution {
  assertValidSpec(executionSpec);
  return { task, executionSpec: executionSpec as ExecutionSpec };
}

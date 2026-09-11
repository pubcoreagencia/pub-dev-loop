/**
 * ExecutionEngine — PDL contract (Phase 3A).
 *
 * The ExecutionEngine transforms a validated Task + validated ExecutionSpec
 * into an ExecutionResult that conceptually separates execution from finalization.
 *
 * This file is CONTRACT-ONLY. It defines the minimum abstraction necessary
 * for the PDL execution layer without duplicating A.2 responsibilities
 * (spec generation/validation) or altering the existing worker lifecycle.
 *
 * Dependencies (contractual):
 *   - Task              (src/domain.ts)
 *   - ExecutionSpec     (src/task/execution-spec.ts)
 *   - FinalizeResult    (src/finalizer.ts) — reused, not duplicated
 *   - TaskLineage       (src/task/execution-spec.ts) — for spec identity
 *
 * NOT dependencies:
 *   - src/task/refinement.ts        (A.2 — spec generation)
 *   - src/task/spec-validator.ts    (A.2 — structural validation)
 *   - src/task/spec-semantics.ts    (A.2 — semantic validation)
 *   - src/worker-service.ts         (orchestration — not yet integrated)
 *   - src/router-worker.ts          (provider routing — not yet integrated)
 *   - src/pp/*                      (product domain — excluded)
 *   - src/prototype/*               (prototype domain — excluded)
 */

import type { Task } from '../domain.js';
import type {
  ExecutionSpec,
  TaskLineage,
} from '../task/execution-spec.js';
import type { FinalizeResult } from '../finalizer.js';

// ─── Execution Outcome ───────────────────────────────────────────────

/**
 * Outcome of the provider execution phase.
 *
 * This is NOT FinalizeResult. It captures what the provider/executor
 * actually produced before any finalization (commit, test, persist) occurs.
 *
 * Fields are minimal and derived from the real types already present
 * in the codebase (AttemptResult / ProviderTaskResult in worker-service.ts
 * and providers/types.ts).
 */
export interface ExecutionOutcome {
  /** Whether the provider completed the task successfully. */
  status: 'COMPLETED' | 'FAILED';
  /** Provider identity that produced this outcome. */
  provider: string | null;
  /** Model used by the provider, if known. */
  model: string | null;
  /** Absolute path to the workspace where the provider executed. */
  workspace: string;
  /** Files declared changed by the provider. */
  changedFiles: string[];
  /** Wall-clock duration of the provider execution in milliseconds. */
  durationMs: number;
  /** Error code when status === 'FAILED', otherwise null. */
  errorCode: string | null;
  /** Human-readable error message when status === 'FAILED'. */
  errorMessage: string | null;
}

// ─── Spec Identity ───────────────────────────────────────────────────

/**
 * Preserved identity of the ExecutionSpec that produced this result.
 *
 * The ExecutionEngine does not reconstruct or reinterpret the spec —
 * it carries the spec's own identity forward so downstream layers
 * can trace the result back to its validated origin.
 */
export interface SpecIdentity {
  /** Version of the ExecutionSpec contract that was used. */
  specVersion: string;
  /** ID of the Task that this spec was created for. */
  taskId: string;
  /** Lineage from the ExecutionSpec — intake hash, source, creation time. */
  lineage: TaskLineage;
}

// ─── Execution Result ────────────────────────────────────────────────

/**
 * Result of executing a Task with a validated ExecutionSpec.
 *
 * Conceptually separates:
 *   - execution   → what the provider/executor produced
 *   - finalization → commit, tests, persistence (optional, may be absent)
 *
 * This is NOT FinalizeResult. FinalizeResult is reused as-is for the
 * finalization sub-result; it is not duplicated here.
 */
export interface ExecutionResult {
  /**
   * Outcome of the provider execution phase.
   * Always present — even on failure, this describes what happened.
   */
  execution: ExecutionOutcome;

  /**
   * Outcome of the finalization phase (TaskFinalizer).
   * Absent when the execution failed and finalization was not attempted.
   * When present, it is the FinalizeResult from src/finalizer.ts — not a copy.
   */
  finalization?: FinalizeResult;

  /**
   * Identity of the ExecutionSpec that produced this result.
   * Preserved from the input spec — not reconstructed or re-derived.
   */
  specIdentity: SpecIdentity;
}

// ─── Execution Engine Contract ───────────────────────────────────────

/**
 * ExecutionEngine — the PDL execution contract.
 *
 * Accepts a Task and a validated ExecutionSpec, and returns an
 * ExecutionResult that separates execution from finalization.
 *
 * The engine does NOT:
 *   - generate or validate the ExecutionSpec (that is A.2's job)
 *   - manage the TaskRepository (infrastructure, not input)
 *   - handle retry/fallback strategy (that is the provider/routing layer)
 *   - manage workspace lifecycle directly (that is the worker layer)
 *
 * The engine DOES:
 *   - accept a validated Task + ExecutionSpec pair
 *   - produce an ExecutionResult with distinct execution/finalization phases
 *   - preserve spec identity through to the result
 */
export interface ExecutionEngine {
  /**
   * Execute a Task using a validated ExecutionSpec.
   *
   * @param task         — the Task to execute (already claimed/assigned)
   * @param executionSpec — the validated ExecutionSpec (already passed
   *                       structural + semantic validation in A.2)
   * @returns ExecutionResult with distinct execution and optional
   *          finalization phases, plus preserved spec identity.
   */
  execute(task: Task, executionSpec: ExecutionSpec): Promise<ExecutionResult>;
}
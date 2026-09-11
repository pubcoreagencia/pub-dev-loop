/**
 * PDL Validation Diagnostic & Error Classification Types (Gate 3D.3).
 *
 * Defines the deterministic data model, error taxonomy, and actionability
 * contracts for diagnosing execution/finalization failures.
 *
 * Invariants:
 * - Pure data contracts (no side effects, no execution).
 * - Untrusted data marking (prompt injection defense).
 * - Decoupled from ExecutionSpec (spec is immutable, diagnostics are ephemeral).
 */

import type { FinalizeResult, WorkspaceSnapshot } from '../../finalizer.js';
import type { ExecutionOutcome } from '../../execution/execution-engine.js';

export type ErrorClass =
  | 'CORRECTABLE'
  | 'RETRYABLE'
  | 'INFRASTRUCTURE'
  | 'UNRECOVERABLE'
  | 'SECURITY'
  | 'UNKNOWN';

export type Correctability =
  | 'CORRECTABLE_IN_WORKSPACE'
  | 'RETRYABLE_TRANSIENT'
  | 'INFRASTRUCTURE_FAILURE'
  | 'FATAL_UNRECOVERABLE'
  | 'SECURITY_ABORT'
  | 'UNKNOWN_FAIL_CLOSED';

export type RecommendedAction =
  | 'ATTEMPT_WORKSPACE_CORRECTION'
  | 'RETRY_TRANSIENT_OPERATION'
  | 'ESCALATE_INFRASTRUCTURE'
  | 'FAIL_CLOSED_TERMINAL'
  | 'SECURITY_TERMINATION';

export type DiagnosticSource =
  | 'finalizer'
  | 'execution'
  | 'process'
  | 'security'
  | 'runtime-diagnostic';

export type FailureKind =
  | 'test_failure'
  | 'compilation_error'
  | 'lint_error'
  | 'git_hygiene'
  | 'timeout'
  | 'security_violation'
  | 'infrastructure_error'
  | 'push_error'
  | 'commit_error'
  | 'unknown';

export interface AttemptIdentity {
  taskId: string;
  attemptNumber: number;
  /** Canonical string ID formatted as `${taskId}:attempt:${attemptNumber}` */
  id: string;
}

export interface ParsedFailureDetails {
  failureKind: FailureKind;
  failedTestCount?: number;
  failedTests?: string[];
  compilerErrors?: string[];
  lintErrors?: string[];
  unexpectedFiles?: string[];
}

export interface DiagnosticInput {
  taskId: string;
  attemptNumber: number;
  finalization?: FinalizeResult;
  execution?: ExecutionOutcome;
  rawOutput?: {
    stdout?: string;
    stderr?: string;
    exitCode?: number | null;
  };
  gitDiff?: string;
  gitStatus?: string;
  error?: unknown;
  baselineSnapshot?: WorkspaceSnapshot;
}

export interface DiagnosticResult {
  /** Attempt Identity: strictly scoped to task and attempt index */
  identity: AttemptIdentity;
  /** Primary authoritative diagnostic source */
  source: DiagnosticSource;
  /** Standardized or authoritative error code */
  errorCode: string;
  /** High-level taxonomy category */
  errorClass: ErrorClass;
  /** Fine-grained correctability assessment */
  correctability: Correctability;
  /** Boolean shorthand: whether the failure is plausible to fix in the existing workspace */
  isCorrectableInWorkspace: boolean;
  /** One-line human-readable summary of the failure */
  summary: string;
  /** Sanitized error message (redacted & truncated) */
  sanitizedMessage: string;
  /** Sanitized test/execution output (redacted & truncated) */
  sanitizedTestOutput: string;
  /** Sanitized git diff (redacted & truncated) */
  sanitizedDiff: string;
  /** Changed files declared or detected */
  changedFiles: string[];
  /** Unexpected files detected in workspace */
  unexpectedFiles: string[];
  /** Process exit code, if available */
  exitCode: number | null;
  /** Fine-grained parsed failure breakdown */
  failureDetails: ParsedFailureDetails;
  /** Prompt injection defense flag: diagnostic text is untrusted runtime data */
  untrusted: true;
}

export interface ClassifiedDiagnostic {
  /** Underlying diagnostic result */
  diagnostic: DiagnosticResult;
  /** Whether the diagnostic qualifies for automated in-process correction */
  actionable: boolean;
  /** Recommended routing or lifecycle action */
  recommendedAction: RecommendedAction;
  /** Rationale explaining why this classification was assigned */
  reasoning: string;
}

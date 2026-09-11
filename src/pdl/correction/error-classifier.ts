/**
 * PDL Error Classifier (Gate 3D.3).
 *
 * Evaluates a DiagnosticResult to produce a ClassifiedDiagnostic determining
 * whether in-process correction is permissible and actionable.
 *
 * Invariants:
 * - Single responsibility: DiagnosticResult -> ClassifiedDiagnostic.
 * - Zero side effects: no execution, no provider calls, no task mutations.
 * - Fail closed: Unknown failures are NEVER marked actionable.
 * - Security abort: Security breaches are immediately marked for termination.
 */

import type {
  DiagnosticResult,
  ClassifiedDiagnostic,
  RecommendedAction,
} from './types.js';

export class PdlErrorClassifier {
  /**
   * Classifies a DiagnosticResult into an actionable ClassifiedDiagnostic.
   */
  static classify(diagnostic: DiagnosticResult): ClassifiedDiagnostic {
    switch (diagnostic.correctability) {
      case 'CORRECTABLE_IN_WORKSPACE':
        return {
          diagnostic,
          actionable: true,
          recommendedAction: 'ATTEMPT_WORKSPACE_CORRECTION',
          reasoning:
            `Failure (${diagnostic.errorCode}) is caused by workspace code or file discrepancies ` +
            `that an agent can plausibly rectify in the existing workspace without modifying the ExecutionSpec.`,
        };

      case 'RETRYABLE_TRANSIENT':
        return {
          diagnostic,
          actionable: false, // Not actionable as in-workspace code fix; requires operational retry
          recommendedAction: 'RETRY_TRANSIENT_OPERATION',
          reasoning:
            `Failure (${diagnostic.errorCode}) is transient (e.g. git index lock, network jitter, or gateway rate limit) ` +
            `and should be addressed via operational backoff/retry rather than re-prompting code modifications.`,
        };

      case 'INFRASTRUCTURE_FAILURE':
        return {
          diagnostic,
          actionable: false,
          recommendedAction: 'ESCALATE_INFRASTRUCTURE',
          reasoning:
            `Failure (${diagnostic.errorCode}) originates from the hosting runtime, provider availability, ` +
            `or total time budget exhaustion. In-workspace correction cannot resolve infrastructure degradation.`,
        };

      case 'SECURITY_ABORT':
        return {
          diagnostic,
          actionable: false,
          recommendedAction: 'SECURITY_TERMINATION',
          reasoning:
            `Security boundary breach detected (${diagnostic.errorCode}). ` +
            `Immediate fail-closed termination enforced to protect workspace and system integrity.`,
        };

      case 'FATAL_UNRECOVERABLE':
        return {
          diagnostic,
          actionable: false,
          recommendedAction: 'FAIL_CLOSED_TERMINAL',
          reasoning:
            `Failure (${diagnostic.errorCode}) cannot be recovered autonomously (e.g. remote push authorization, ` +
            `missing repository target, or explicit cancellation). Failing closed immediately.`,
        };

      case 'UNKNOWN_FAIL_CLOSED':
      default:
        return {
          diagnostic,
          actionable: false,
          recommendedAction: 'FAIL_CLOSED_TERMINAL',
          reasoning:
            `Failure (${diagnostic.errorCode}) is unrecognized or lacks sufficient diagnostic evidence. ` +
            `By policy (UNKNOWN ≠ CORRECTABLE), the system fails closed to prevent runaway or hallucinatory edits.`,
        };
    }
  }
}

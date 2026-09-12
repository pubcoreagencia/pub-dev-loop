/**
 * Phase 5.5 Step 3: Failure Classification Engine.
 *
 * Deterministically maps task execution errors and finalization codes
 * to one of three canonical failure classes: RETRYABLE, NON_RETRYABLE, or POISON.
 */

import type { Task } from '../../domain.js';
import type { FailureClassification, PdlFailureClass, PdlFailureCode } from './types.js';

export class PdlRetryClassifier {
  /**
   * Deterministically classifies an error or failure outcome.
   *
   * @param task The task being processed
   * @param error Raw error string, Error instance, or failure record
   * @param finalizeStatus Optional status code from TaskFinalizer
   */
  public static classify(
    task: Task,
    error: unknown,
    finalizeStatus?: string | null
  ): FailureClassification {
    const errorStr = this.extractErrorMessage(error);
    const errorCode = this.extractErrorCode(error);

    // 1. POISON CHECKS (Deterministic priority to isolate poison tasks)
    if (
      errorCode === 'REPEATED_VALIDATION_FAILURE' ||
      errorCode === 'REPEATED_CORRECTION_FAILURE' ||
      errorCode === 'REPEATED_FINALIZATION_FAILURE' ||
      errorCode === 'REPEATED_POLICY_FAILURE' ||
      errorCode === 'UNRECOVERABLE_EXECUTION_FAILURE' ||
      /poison/i.test(errorStr) ||
      /unrecoverable/i.test(errorStr) ||
      /infinite loop/i.test(errorStr) ||
      /ast corruption/i.test(errorStr)
    ) {
      const code = (errorCode && this.isPoisonCode(errorCode))
        ? errorCode
        : 'UNRECOVERABLE_EXECUTION_FAILURE';
      return {
        failureClass: 'POISON',
        failureCode: code,
        reason: `Poison failure detected: ${errorStr}`,
        isPoison: true,
      };
    }

    // Repeated failures on syntax/validation after prior attempts are poison
    if (
      (task.retryCount ?? 0) >= 1 &&
      (/syntax error/i.test(errorStr) || /validation failed/i.test(errorStr) || /lint failed/i.test(errorStr))
    ) {
      return {
        failureClass: 'POISON',
        failureCode: 'REPEATED_VALIDATION_FAILURE',
        reason: `Repeated validation/syntax failure across attempts: ${errorStr}`,
        isPoison: true,
      };
    }

    // 2. NON-RETRYABLE CHECKS (Permanent violations, governance stops, spec faults)
    if (
      errorCode === 'KILL_SWITCH_ACTIVE' ||
      /kill switch/i.test(errorStr) ||
      /kill_switch/i.test(errorStr)
    ) {
      return {
        failureClass: 'NON_RETRYABLE',
        failureCode: 'KILL_SWITCH_ACTIVE',
        reason: `Execution halted by active emergency kill switch: ${errorStr}`,
        isPoison: false,
      };
    }

    if (
      errorCode === 'PAID_MODEL_REJECTED' ||
      /free models only/i.test(errorStr) ||
      /paid model/i.test(errorStr) ||
      /paid_model/i.test(errorStr)
    ) {
      return {
        failureClass: 'NON_RETRYABLE',
        failureCode: 'PAID_MODEL_REJECTED',
        reason: `Paid model rejected by FREE MODELS ONLY policy: ${errorStr}`,
        isPoison: false,
      };
    }

    if (
      errorCode === 'UNAUTHORIZED_REPOSITORY' ||
      /unauthorized repository/i.test(errorStr) ||
      /repository not authorized/i.test(errorStr)
    ) {
      return {
        failureClass: 'NON_RETRYABLE',
        failureCode: 'UNAUTHORIZED_REPOSITORY',
        reason: `Target repository is unauthorized: ${errorStr}`,
        isPoison: false,
      };
    }

    if (
      errorCode === 'UNAUTHORIZED_PRODUCT' ||
      /unauthorized product/i.test(errorStr) ||
      /product not in catalog/i.test(errorStr) ||
      /product not authorized/i.test(errorStr)
    ) {
      return {
        failureClass: 'NON_RETRYABLE',
        failureCode: 'UNAUTHORIZED_PRODUCT',
        reason: `Target product is unauthorized or not in catalog: ${errorStr}`,
        isPoison: false,
      };
    }

    if (
      errorCode === 'INVALID_EXECUTION_SPEC' ||
      /invalid execution spec/i.test(errorStr) ||
      /spec validation error/i.test(errorStr) ||
      /ExecutionSpecValidationError/i.test(errorStr) ||
      /missing required field/i.test(errorStr)
    ) {
      return {
        failureClass: 'NON_RETRYABLE',
        failureCode: 'INVALID_EXECUTION_SPEC',
        reason: `Execution spec is invalid or malformed: ${errorStr}`,
        isPoison: false,
      };
    }

    if (
      errorCode === 'TASK_DURATION_EXCEEDED' ||
      /task duration exceeded/i.test(errorStr) ||
      /max task duration/i.test(errorStr)
    ) {
      return {
        failureClass: 'NON_RETRYABLE',
        failureCode: 'TASK_DURATION_EXCEEDED',
        reason: `Task exceeded maximum permitted duration: ${errorStr}`,
        isPoison: false,
      };
    }

    if (
      errorCode === 'SECURITY_POLICY_FAILURE' ||
      /security policy/i.test(errorStr) ||
      /path traversal/i.test(errorStr) ||
      /forbidden command/i.test(errorStr)
    ) {
      return {
        failureClass: 'NON_RETRYABLE',
        failureCode: 'SECURITY_POLICY_FAILURE',
        reason: `Security policy violation detected: ${errorStr}`,
        isPoison: false,
      };
    }

    if (
      errorCode === 'GOVERNANCE_DENIED' ||
      /governance/i.test(errorStr) ||
      /consecutive_tasks_exceeded/i.test(errorStr) ||
      /consecutive_failures_exceeded/i.test(errorStr)
    ) {
      return {
        failureClass: 'NON_RETRYABLE',
        failureCode: 'GOVERNANCE_DENIED',
        reason: `Task rejected by governance policy: ${errorStr}`,
        isPoison: false,
      };
    }

    // 3. RETRYABLE CHECKS (Transient provider, network, workspace, or db issues)
    if (
      errorCode === 'PROVIDER_TIMEOUT' ||
      /timeout/i.test(errorStr) ||
      /ETIMEDOUT/i.test(errorStr) ||
      /504 gateway timeout/i.test(errorStr) ||
      /request timed out/i.test(errorStr)
    ) {
      return {
        failureClass: 'RETRYABLE',
        failureCode: 'PROVIDER_TIMEOUT',
        reason: `Provider timeout encountered: ${errorStr}`,
        isPoison: false,
      };
    }

    if (
      errorCode === 'PROVIDER_429' ||
      /429/i.test(errorStr) ||
      /rate limit/i.test(errorStr) ||
      /too many requests/i.test(errorStr)
    ) {
      return {
        failureClass: 'RETRYABLE',
        failureCode: 'PROVIDER_429',
        reason: `Provider rate limit (429) encountered: ${errorStr}`,
        isPoison: false,
      };
    }

    if (
      errorCode === 'PROVIDER_5XX' ||
      /500/i.test(errorStr) ||
      /502/i.test(errorStr) ||
      /503/i.test(errorStr) ||
      /bad gateway/i.test(errorStr) ||
      /service unavailable/i.test(errorStr) ||
      /internal server error/i.test(errorStr)
    ) {
      return {
        failureClass: 'RETRYABLE',
        failureCode: 'PROVIDER_5XX',
        reason: `Provider 5xx transient server error: ${errorStr}`,
        isPoison: false,
      };
    }

    if (
      errorCode === 'TRANSIENT_NETWORK_FAILURE' ||
      /ECONNRESET/i.test(errorStr) ||
      /ECONNREFUSED/i.test(errorStr) ||
      /ENOTFOUND/i.test(errorStr) ||
      /socket hang up/i.test(errorStr) ||
      /fetch failed/i.test(errorStr) ||
      /network error/i.test(errorStr)
    ) {
      return {
        failureClass: 'RETRYABLE',
        failureCode: 'TRANSIENT_NETWORK_FAILURE',
        reason: `Transient network failure: ${errorStr}`,
        isPoison: false,
      };
    }

    if (
      errorCode === 'TEMPORARY_WORKSPACE_FAILURE' ||
      /EBUSY/i.test(errorStr) ||
      /workspace lock/i.test(errorStr) ||
      /temporary workspace/i.test(errorStr)
    ) {
      return {
        failureClass: 'RETRYABLE',
        failureCode: 'TEMPORARY_WORKSPACE_FAILURE',
        reason: `Temporary workspace or disk lock failure: ${errorStr}`,
        isPoison: false,
      };
    }

    if (
      errorCode === 'TEMPORARY_DATABASE_FAILURE' ||
      /deadlock detected/i.test(errorStr) ||
      /connection pool timeout/i.test(errorStr) ||
      /connection terminated/i.test(errorStr)
    ) {
      return {
        failureClass: 'RETRYABLE',
        failureCode: 'TEMPORARY_DATABASE_FAILURE',
        reason: `Temporary database connection/lock failure: ${errorStr}`,
        isPoison: false,
      };
    }

    // Default fallback: If unrecognized, default to RETRYABLE if under max retries
    return {
      failureClass: 'RETRYABLE',
      failureCode: 'TRANSIENT_NETWORK_FAILURE',
      reason: `Unclassified transient execution failure: ${errorStr}`,
      isPoison: false,
    };
  }

  private static extractErrorMessage(error: unknown): string {
    if (!error) return 'Unknown error';
    if (typeof error === 'string') return error;
    if (error instanceof Error) return error.message;
    if (typeof error === 'object') {
      const rec = error as Record<string, unknown>;
      if (typeof rec.message === 'string') return rec.message;
      if (typeof rec.error === 'string') return rec.error;
      if (typeof rec.reason === 'string') return rec.reason;
      try {
        return JSON.stringify(error);
      } catch {
        return String(error);
      }
    }
    return String(error);
  }

  private static extractErrorCode(error: unknown): string | null {
    if (!error || typeof error !== 'object') return null;
    const rec = error as Record<string, unknown>;
    if (typeof rec.code === 'string') return rec.code;
    if (typeof rec.errorCode === 'string') return rec.errorCode;
    if (typeof rec.reasonCode === 'string') return rec.reasonCode;
    return null;
  }

  private static isPoisonCode(code: string): boolean {
    return [
      'REPEATED_VALIDATION_FAILURE',
      'REPEATED_CORRECTION_FAILURE',
      'REPEATED_FINALIZATION_FAILURE',
      'REPEATED_POLICY_FAILURE',
      'UNRECOVERABLE_EXECUTION_FAILURE',
    ].includes(code);
  }
}

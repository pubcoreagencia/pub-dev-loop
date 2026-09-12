/**
 * Phase 5.5 Step 3: Task Retry Policy & Failure Classification Types.
 *
 * Provides deterministic failure classification, bounded backoff configurations,
 * and retry/quarantine decision structures.
 */

export type PdlFailureClass = 'RETRYABLE' | 'NON_RETRYABLE' | 'POISON';

export type RetryDecisionAction = 'RETRY' | 'DEAD_LETTER' | 'QUARANTINE';

export const RETRYABLE_FAILURE_CODES = [
  'PROVIDER_TIMEOUT',
  'PROVIDER_429',
  'PROVIDER_5XX',
  'TRANSIENT_NETWORK_FAILURE',
  'TEMPORARY_WORKSPACE_FAILURE',
  'TEMPORARY_DATABASE_FAILURE',
] as const;
export type RetryableFailureCode = typeof RETRYABLE_FAILURE_CODES[number];

export const NON_RETRYABLE_FAILURE_CODES = [
  'INVALID_EXECUTION_SPEC',
  'UNAUTHORIZED_REPOSITORY',
  'UNAUTHORIZED_PRODUCT',
  'PAID_MODEL_REJECTED',
  'GOVERNANCE_DENIED',
  'KILL_SWITCH_ACTIVE',
  'TASK_DURATION_EXCEEDED',
  'SECURITY_POLICY_FAILURE',
] as const;
export type NonRetryableFailureCode = typeof NON_RETRYABLE_FAILURE_CODES[number];

export const POISON_FAILURE_CODES = [
  'REPEATED_VALIDATION_FAILURE',
  'REPEATED_CORRECTION_FAILURE',
  'REPEATED_FINALIZATION_FAILURE',
  'REPEATED_POLICY_FAILURE',
  'UNRECOVERABLE_EXECUTION_FAILURE',
] as const;
export type PoisonFailureCode = typeof POISON_FAILURE_CODES[number];

export type PdlFailureCode =
  | RetryableFailureCode
  | NonRetryableFailureCode
  | PoisonFailureCode
  | (string & {});

export interface RetryPolicyConfig {
  /** Base delay in milliseconds for exponential backoff. Default: 2000 */
  baseDelayMs: number;
  /** Multiplicative growth factor. Default: 2 */
  factor: number;
  /** Maximum backoff ceiling in milliseconds. Default: 60000 */
  maxDelayMs: number;
  /** Maximum retry attempts allowed per task before dead-lettering. Default: 3 */
  maxRetries: number;
  /** Optional deterministic jitter in milliseconds. Default: 0 */
  jitterMs?: number;
}

export const DEFAULT_RETRY_CONFIG: RetryPolicyConfig = {
  baseDelayMs: 2000,
  factor: 2,
  maxDelayMs: 60000,
  maxRetries: 3,
  jitterMs: 0,
};

export interface FailureClassification {
  failureClass: PdlFailureClass;
  failureCode: PdlFailureCode;
  reason: string;
  isPoison: boolean;
}

export interface RetryDecision {
  action: RetryDecisionAction;
  failureClass: PdlFailureClass;
  failureCode: PdlFailureCode;
  reason: string;
  attemptCount: number;
  delayMs?: number;
  nextRetryAt?: Date;
}

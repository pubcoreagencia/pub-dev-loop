/**
 * Phase 5.5 Step 3: Bounded Retry Policy Engine.
 *
 * Implements exponential backoff with upper bounds and evaluates
 * whether a failed task should be retried, quarantined, or sent to the DLQ.
 */

import type { Task } from '../../domain.js';
import { PdlRetryClassifier } from './classification.js';
import type {
  RetryPolicyConfig,
  RetryDecision,
  FailureClassification,
} from './types.js';
import { DEFAULT_RETRY_CONFIG } from './types.js';

export interface EvaluateRetryOptions {
  maxRetries?: number;
  now?: Date;
  finalizeStatus?: string | null;
}

export class PdlRetryPolicy {
  public readonly config: RetryPolicyConfig;

  constructor(config?: Partial<RetryPolicyConfig>) {
    this.config = { ...DEFAULT_RETRY_CONFIG, ...(config || {}) };

    if (this.config.baseDelayMs <= 0) {
      throw new Error(`INVALID_BASE_DELAY: baseDelayMs must be > 0 (received: ${this.config.baseDelayMs})`);
    }
    if (this.config.factor < 1) {
      throw new Error(`INVALID_FACTOR: factor must be >= 1 (received: ${this.config.factor})`);
    }
    if (this.config.maxDelayMs < this.config.baseDelayMs) {
      throw new Error(`INVALID_MAX_DELAY: maxDelayMs must be >= baseDelayMs (received: ${this.config.maxDelayMs})`);
    }
    if (this.config.maxRetries < 0) {
      throw new Error(`INVALID_MAX_RETRIES: maxRetries must be >= 0 (received: ${this.config.maxRetries})`);
    }
  }

  /**
   * Calculates exponential backoff delay capped at maxDelayMs.
   * delay = min(baseDelayMs * (factor ^ retryCount) + jitter, maxDelayMs)
   */
  public computeBackoff(retryCount: number): number {
    const raw = this.config.baseDelayMs * Math.pow(this.config.factor, Math.max(0, retryCount));
    const jitter = this.config.jitterMs ? Math.floor(Math.random() * this.config.jitterMs) : 0;
    return Math.min(raw + jitter, this.config.maxDelayMs);
  }

  /**
   * Evaluates task error and returns deterministic action (RETRY, DEAD_LETTER, QUARANTINE).
   */
  public evaluate(
    task: Task,
    error: unknown,
    options: EvaluateRetryOptions = {}
  ): RetryDecision {
    const classification: FailureClassification = PdlRetryClassifier.classify(
      task,
      error,
      options.finalizeStatus
    );

    const currentRetryCount = task.retryCount ?? 0;
    const nextAttempt = currentRetryCount + 1;
    const maxRetries = options.maxRetries ?? task.maxRetries ?? this.config.maxRetries;

    // 1. Poison tasks are quarantined immediately
    if (classification.failureClass === 'POISON') {
      return {
        action: 'QUARANTINE',
        failureClass: 'POISON',
        failureCode: classification.failureCode,
        reason: classification.reason,
        attemptCount: nextAttempt,
      };
    }

    // 2. Non-retryable failures go straight to Dead-Letter Queue
    if (classification.failureClass === 'NON_RETRYABLE') {
      return {
        action: 'DEAD_LETTER',
        failureClass: 'NON_RETRYABLE',
        failureCode: classification.failureCode,
        reason: classification.reason,
        attemptCount: nextAttempt,
      };
    }

    // 3. Retryable failures: check max retries limit
    if (nextAttempt > maxRetries) {
      return {
        action: 'DEAD_LETTER',
        failureClass: 'RETRYABLE',
        failureCode: 'MAX_RETRIES_EXCEEDED',
        reason: `Exceeded maximum retry limit (${maxRetries}): ${classification.reason}`,
        attemptCount: nextAttempt,
      };
    }

    // 4. Schedule retry with bounded exponential backoff
    const delayMs = this.computeBackoff(currentRetryCount);
    const now = options.now ?? new Date();
    const nextRetryAt = new Date(now.getTime() + delayMs);

    return {
      action: 'RETRY',
      failureClass: 'RETRYABLE',
      failureCode: classification.failureCode,
      reason: classification.reason,
      attemptCount: nextAttempt,
      delayMs,
      nextRetryAt,
    };
  }
}

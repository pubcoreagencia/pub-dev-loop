/**
 * Phase 5.5 Step 4: Periodic Task Reaper & Stale Task Recovery Engine.
 *
 * Scans for abandoned/stale tasks whose lease deadlines have expired,
 * evaluates governance and retry policies, and atomically recovers or routes
 * tasks to retry, DLQ, or quarantine with zero duplicate execution.
 */

import type { Pool } from 'pg';
import type { TaskRepository, Task } from '../../domain.js';
import {
  PdlGovernanceEngine,
  defaultGovernanceEngine,
} from '../governance/index.js';
import type { GovernanceLimits } from '../governance/types.js';
import {
  PdlRetryPolicy,
  type RetryDecision,
} from '../retry/index.js';
import {
  PdlDeadLetterRepository,
  type IPdlDeadLetterRepository,
} from '../dlq/index.js';
import type {
  ReaperConfig,
  ReaperStatus,
  ReaperEvent,
  ReaperEventType,
  ReaperCycleResult,
} from './types.js';
import { DEFAULT_REAPER_CONFIG } from './types.js';

export interface PdlTaskReaperOptions {
  tasks: TaskRepository;
  governance?: PdlGovernanceEngine;
  retryPolicy?: PdlRetryPolicy;
  dlq?: IPdlDeadLetterRepository;
  pool?: Pool;
  config?: Partial<ReaperConfig>;
}

export class PdlTaskReaper {
  public readonly tasks: TaskRepository;
  public readonly governance: PdlGovernanceEngine;
  public readonly retryPolicy: PdlRetryPolicy;
  public readonly dlq: IPdlDeadLetterRepository;
  public readonly config: ReaperConfig;

  private running = false;
  private abortController: AbortController | null = null;
  private loopPromise: Promise<void> | null = null;
  private cycleCount = 0;
  private eventListeners: Array<(event: ReaperEvent) => void> = [];

  private metrics: ReaperStatus = {
    running: false,
    lastCycleAt: null,
    totalCycles: 0,
    staleDetectedCount: 0,
    recoveredCount: 0,
    dlqCount: 0,
    quarantinedCount: 0,
    blockedCount: 0,
    lastError: null,
  };

  constructor(options: PdlTaskReaperOptions) {
    if (!options.tasks) {
      throw new Error('MISSING_TASKS_REPOSITORY: PdlTaskReaper requires a valid TaskRepository');
    }

    const rawConfig = { ...DEFAULT_REAPER_CONFIG, ...(options.config || {}) };
    if (typeof rawConfig.intervalMs !== 'number' || isNaN(rawConfig.intervalMs) || rawConfig.intervalMs < 1000) {
      throw new Error(`INVALID_REAPER_INTERVAL: Reaper interval must be >= 1000ms (received: ${rawConfig.intervalMs})`);
    }
    if (typeof rawConfig.batchSize !== 'number' || isNaN(rawConfig.batchSize) || rawConfig.batchSize < 1) {
      throw new Error(`INVALID_REAPER_BATCH_SIZE: Reaper batchSize must be >= 1 (received: ${rawConfig.batchSize})`);
    }

    this.tasks = options.tasks;
    this.governance = options.governance || defaultGovernanceEngine;
    this.retryPolicy = options.retryPolicy || new PdlRetryPolicy();
    this.dlq = options.dlq || new PdlDeadLetterRepository(options.pool);
    this.config = rawConfig;
  }

  public getStatus(): ReaperStatus {
    return {
      ...this.metrics,
      running: this.running,
    };
  }

  public resetMetrics(): void {
    this.cycleCount = 0;
    this.metrics = {
      running: this.running,
      lastCycleAt: null,
      totalCycles: 0,
      staleDetectedCount: 0,
      recoveredCount: 0,
      dlqCount: 0,
      quarantinedCount: 0,
      blockedCount: 0,
      lastError: null,
    };
  }

  public onEvent(listener: (event: ReaperEvent) => void): () => void {
    this.eventListeners.push(listener);
    return () => {
      this.eventListeners = this.eventListeners.filter((l) => l !== listener);
    };
  }

  private emitEvent(
    type: ReaperEventType,
    payload: {
      cycleNumber?: number;
      taskId?: string | null;
      product?: string | null;
      previousStatus?: string | null;
      newStatus?: string | null;
      previousLeaseOwner?: string | null;
      leaseExpiredAt?: string | null;
      retryCount?: number;
      failureCode?: string;
      governanceDecision?: string;
      details?: Record<string, unknown>;
    } = {}
  ): void {
    const sanitizedDetails: Record<string, unknown> = {};
    if (payload.details) {
      for (const [k, v] of Object.entries(payload.details)) {
        if (/token|key|secret|auth|password|credential/i.test(k)) {
          sanitizedDetails[k] = '[REDACTED]';
        } else if (typeof v === 'string' && /ghp_|github_pat_|Bearer |eyJ/i.test(v)) {
          sanitizedDetails[k] = '[REDACTED]';
        } else {
          sanitizedDetails[k] = v;
        }
      }
    }

    const event: ReaperEvent = {
      type,
      timestamp: new Date().toISOString(),
      cycleNumber: payload.cycleNumber ?? this.cycleCount,
      taskId: payload.taskId,
      product: payload.product,
      previousStatus: payload.previousStatus,
      newStatus: payload.newStatus,
      previousLeaseOwner: payload.previousLeaseOwner,
      leaseExpiredAt: payload.leaseExpiredAt,
      retryCount: payload.retryCount,
      failureCode: payload.failureCode,
      governanceDecision: payload.governanceDecision,
      details: sanitizedDetails,
    };

    for (const listener of this.eventListeners) {
      try {
        listener(event);
      } catch (err: any) {
        console.error('[PdlTaskReaper] Event listener error:', err.message);
      }
    }
  }

  public async start(): Promise<void> {
    if (this.running) {
      return;
    }

    this.running = true;
    this.abortController = new AbortController();
    this.emitEvent('REAPER_STARTED');

    this.loopPromise = this.runLoop().finally(() => {
      this.running = false;
    });
  }

  public async stop(): Promise<void> {
    this.running = false;
    if (this.abortController) {
      this.abortController.abort();
    }
    this.emitEvent('REAPER_STOPPED');

    if (this.loopPromise) {
      await this.loopPromise;
      this.loopPromise = null;
    }
  }

  private async runLoop(): Promise<void> {
    while (this.running && this.abortController && !this.abortController.signal.aborted) {
      try {
        await this.runOnce();
      } catch (err: any) {
        console.error('[PdlTaskReaper] Unexpected loop iteration error:', err.message);
      }

      const aborted = await this.interruptibleSleep(this.config.intervalMs);
      if (aborted) {
        break;
      }
    }
  }

  /**
   * Executes a single stale task recovery cycle.
   * Resilient and fail-closed: exceptions are captured and reported without crashing callers.
   */
  public async runOnce(now = new Date()): Promise<ReaperCycleResult> {
    const cycleNumber = ++this.cycleCount;
    this.emitEvent('REAPER_CYCLE_STARTED', { cycleNumber });

    const result: ReaperCycleResult = {
      cycleNumber,
      staleDetected: 0,
      recovered: 0,
      deadLettered: 0,
      quarantined: 0,
      blocked: 0,
      error: null,
    };

    try {
      // 1. Check Kill Switch Authority
      let killStatus;
      try {
        killStatus = await this.governance.getKillSwitch().checkStatus();
      } catch (err: any) {
        result.error = `KILL_SWITCH_CHECK_FAILED: ${err.message}`;
        this.metrics.lastError = result.error;
        this.emitEvent('TASK_RECOVERY_BLOCKED', {
          cycleNumber,
          governanceDecision: 'KILL_SWITCH_READ_ERROR',
          details: { error: err.message },
        });
        this.emitEvent('REAPER_CYCLE_FAILED', { cycleNumber, details: { error: result.error } });
        return result;
      }

      if (killStatus.active) {
        result.error = 'KILL_SWITCH_ACTIVE';
        this.metrics.lastError = 'KILL_SWITCH_ACTIVE';
        this.emitEvent('TASK_RECOVERY_BLOCKED', {
          cycleNumber,
          governanceDecision: 'KILL_SWITCH_ACTIVE',
          details: { reason: killStatus.reason },
        });
        this.emitEvent('REAPER_CYCLE_COMPLETED', { cycleNumber, details: { reason: 'KILL_SWITCH_ACTIVE' } });
        return result;
      }

      // 2. Check Governance Continuation Level
      let limits: GovernanceLimits;
      try {
        limits = await this.governance.loadLimits();
      } catch (err: any) {
        result.error = `GOVERNANCE_LOAD_FAILED: ${err.message}`;
        this.metrics.lastError = result.error;
        this.emitEvent('TASK_RECOVERY_BLOCKED', {
          cycleNumber,
          governanceDecision: 'GOVERNANCE_READ_ERROR',
          details: { error: err.message },
        });
        this.emitEvent('REAPER_CYCLE_FAILED', { cycleNumber, details: { error: result.error } });
        return result;
      }

      // Levels 0 and 1 strictly prohibit autonomous task recovery
      if (limits.activeLevel < 2) {
        result.error = 'LEVEL_EXCEEDED';
        this.metrics.lastError = 'LEVEL_EXCEEDED';
        this.emitEvent('TASK_RECOVERY_BLOCKED', {
          cycleNumber,
          governanceDecision: 'LEVEL_EXCEEDED',
          details: { activeLevel: limits.activeLevel, reason: 'Level < 2 blocks autonomous recovery' },
        });
        this.emitEvent('REAPER_CYCLE_COMPLETED', { cycleNumber, details: { reason: 'LEVEL_EXCEEDED' } });
        return result;
      }

      // 3. Find Stale Tasks (Lease deadline authoritative)
      const cutoff = new Date(now.getTime() - this.config.staleGracePeriodMs);
      let staleTasks: Task[] = [];

      if (typeof this.tasks.findStaleTasks === 'function') {
        staleTasks = await this.tasks.findStaleTasks(cutoff, this.config.batchSize);
      } else {
        const all = await this.tasks.list();
        staleTasks = all.filter((t) =>
          ['ASSIGNED', 'RUNNING', 'TESTING'].includes(t.status) &&
          t.leaseDeadline &&
          new Date(t.leaseDeadline).getTime() < cutoff.getTime()
        ).slice(0, this.config.batchSize);
      }

      result.staleDetected = staleTasks.length;
      this.metrics.staleDetectedCount += staleTasks.length;

      if (staleTasks.length === 0) {
        this.metrics.lastCycleAt = now.toISOString();
        this.metrics.totalCycles++;
        this.emitEvent('REAPER_CYCLE_COMPLETED', { cycleNumber, details: { staleDetected: 0 } });
        return result;
      }

      // 4. Process Each Stale Task
      for (const task of staleTasks) {
        const product = task.project || task.repository;
        const previousStatus = task.status;
        const previousLeaseOwner = task.leaseOwner;
        const leaseExpiredAt = task.leaseDeadline ? new Date(task.leaseDeadline).toISOString() : null;

        this.emitEvent('TASK_STALE_DETECTED', {
          cycleNumber,
          taskId: task.id,
          product,
          previousStatus,
          previousLeaseOwner,
          leaseExpiredAt,
        });

        // Verify product against Product Catalog
        if (!limits.allowedProducts.includes(product)) {
          result.blocked++;
          this.metrics.blockedCount++;
          this.emitEvent('TASK_RECOVERY_BLOCKED', {
            cycleNumber,
            taskId: task.id,
            product,
            governanceDecision: 'UNAUTHORIZED_PRODUCT',
            details: { reason: `Product '${product}' not authorized in governance limits` },
          });
          continue;
        }

        // Consult Retry Policy for appropriate recovery action
        const effectiveError = task.error || 'LEASE_EXPIRED_TIMEOUT';
        const decision: RetryDecision = this.retryPolicy.evaluate(
          task,
          effectiveError,
          { maxRetries: task.maxRetries, now }
        );

        if (decision.action === 'QUARANTINE') {
          const patch: Partial<Task> = {
            status: 'QUARANTINED',
            quarantinedAt: now,
            quarantineReason: decision.reason,
            lastFailureCode: decision.failureCode,
            lastFailureClass: decision.failureClass,
            worker: null,
            leaseOwner: null,
            leaseDeadline: null,
            heartbeatAt: null,
            workspacePath: null,
          };

          const recovered = typeof this.tasks.recoverStaleTask === 'function'
            ? await this.tasks.recoverStaleTask(task.id, patch, now)
            : await this.tasks.update(task.id, patch);

          if (recovered) {
            result.quarantined++;
            this.metrics.quarantinedCount++;

            await this.dlq.record({
              taskId: task.id,
              repository: task.repository,
              product,
              failureCode: decision.failureCode,
              failureClass: decision.failureClass,
              attemptCount: (task.retryCount ?? 0) + 1,
              reason: decision.reason,
              quarantined: true,
              originalTaskResult: task.result,
            });

            this.emitEvent('TASK_RECOVERY_TO_QUARANTINE', {
              cycleNumber,
              taskId: task.id,
              product,
              previousStatus,
              newStatus: 'QUARANTINED',
              failureCode: decision.failureCode,
              details: { reason: decision.reason },
            });
          }
        } else if (decision.action === 'DEAD_LETTER') {
          const patch: Partial<Task> = {
            status: 'FAILED',
            deadLetteredAt: now,
            deadLetterReason: decision.reason,
            lastFailureCode: decision.failureCode,
            lastFailureClass: decision.failureClass,
            worker: null,
            leaseOwner: null,
            leaseDeadline: null,
            heartbeatAt: null,
            workspacePath: null,
          };

          const recovered = typeof this.tasks.recoverStaleTask === 'function'
            ? await this.tasks.recoverStaleTask(task.id, patch, now)
            : await this.tasks.update(task.id, patch);

          if (recovered) {
            result.deadLettered++;
            this.metrics.dlqCount++;

            await this.dlq.record({
              taskId: task.id,
              repository: task.repository,
              product,
              failureCode: decision.failureCode,
              failureClass: decision.failureClass,
              attemptCount: (task.retryCount ?? 0) + 1,
              reason: decision.reason,
              quarantined: false,
              originalTaskResult: task.result,
            });

            this.emitEvent('TASK_RECOVERY_TO_DLQ', {
              cycleNumber,
              taskId: task.id,
              product,
              previousStatus,
              newStatus: 'FAILED',
              failureCode: decision.failureCode,
              details: { reason: decision.reason },
            });
          }
        } else {
          // decision.action === 'RETRY'
          const nextRetryCount = (task.retryCount ?? 0) + 1;
          const patch: Partial<Task> = {
            status: 'QUEUED',
            retryCount: nextRetryCount,
            lastRetryAt: now,
            nextRetryAt: decision.nextRetryAt ?? now,
            lastFailureCode: 'LEASE_EXPIRED',
            lastFailureClass: 'RETRYABLE',
            worker: null,
            leaseOwner: null,
            leaseDeadline: null,
            heartbeatAt: null,
            workspacePath: null,
          };

          const recovered = typeof this.tasks.recoverStaleTask === 'function'
            ? await this.tasks.recoverStaleTask(task.id, patch, now)
            : await this.tasks.update(task.id, patch);

          if (recovered) {
            result.recovered++;
            this.metrics.recoveredCount++;

            this.emitEvent('TASK_RECOVERED', {
              cycleNumber,
              taskId: task.id,
              product,
              previousStatus,
              newStatus: 'QUEUED',
              retryCount: nextRetryCount,
              failureCode: 'LEASE_EXPIRED',
              details: {
                delayMs: decision.delayMs,
                nextRetryAt: decision.nextRetryAt?.toISOString(),
              },
            });
          }
        }
      }

      this.metrics.lastCycleAt = now.toISOString();
      this.metrics.totalCycles++;
      this.emitEvent('REAPER_CYCLE_COMPLETED', {
        cycleNumber,
        details: {
          staleDetected: result.staleDetected,
          recovered: result.recovered,
          deadLettered: result.deadLettered,
          quarantined: result.quarantined,
          blocked: result.blocked,
        },
      });

      return result;
    } catch (cycleErr: any) {
      result.error = cycleErr.message;
      this.metrics.lastError = cycleErr.message;
      this.emitEvent('REAPER_CYCLE_FAILED', {
        cycleNumber,
        details: { error: cycleErr.message },
      });
      return result;
    }
  }

  private interruptibleSleep(ms: number): Promise<boolean> {
    return new Promise((resolve) => {
      if (!this.abortController || this.abortController.signal.aborted) {
        return resolve(true);
      }

      const timer = setTimeout(() => {
        resolve(false);
      }, ms);

      const abortHandler = () => {
        clearTimeout(timer);
        resolve(true);
      };

      this.abortController.signal.addEventListener('abort', abortHandler, { once: true });
    });
  }
}

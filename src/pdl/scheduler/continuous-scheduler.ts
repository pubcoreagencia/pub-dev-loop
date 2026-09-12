/**
 * Phase 5.5 Step 2: Bounded Continuous Scheduler Implementation.
 *
 * Implements a bounded, governed, observable, fail-closed continuous scheduler.
 * GovernancePolicyEngine is the absolute authority for every continuation decision.
 */

import crypto from 'node:crypto';
import type { Pool } from 'pg';
import type { TaskRepository, Task } from '../../domain.js';
import type { BaseWorker } from '../../worker-service.js';
import {
  PdlGovernanceEngine,
  defaultGovernanceEngine,
} from '../governance/index.js';
import type {
  GovernanceLimits,
  GovernanceDecision,
} from '../governance/types.js';
import type {
  SchedulerSessionState,
  SchedulerEventType,
  SchedulerEvent,
  SchedulerConfig,
  SchedulerSessionInfo,
  SchedulerCycleRecord,
} from './types.js';
import { DEFAULT_SCHEDULER_CONFIG } from './types.js';
import {
  SchedulerSessionRepository,
  type ISchedulerSessionRepository,
} from './session-repository.js';

export interface ContinuousSchedulerOptions {
  governance?: PdlGovernanceEngine;
  worker?: BaseWorker;
  tasks?: TaskRepository;
  repository?: ISchedulerSessionRepository;
  config?: Partial<SchedulerConfig>;
  pool?: Pool;
}

export interface CrashRecoveryResult {
  recoveredSessions: number;
  interruptedTasks: string[];
}

export class PdlContinuousScheduler {
  public readonly governance: PdlGovernanceEngine;
  public readonly worker?: BaseWorker;
  public readonly tasks?: TaskRepository;
  public readonly repository: ISchedulerSessionRepository;
  public readonly config: SchedulerConfig;

  private activeSession: SchedulerSessionInfo | null = null;
  private abortController: AbortController | null = null;
  private isLoopRunning = false;
  private loopPromise: Promise<void> | null = null;
  private eventListeners: Array<(event: SchedulerEvent) => void> = [];

  constructor(options: ContinuousSchedulerOptions = {}) {
    const rawConfig = { ...DEFAULT_SCHEDULER_CONFIG, ...(options.config || {}) };

    // Strict fail-closed configuration validation
    if (
      typeof rawConfig.pollIntervalMs !== 'number' ||
      isNaN(rawConfig.pollIntervalMs) ||
      rawConfig.pollIntervalMs < 1000
    ) {
      throw new Error(
        `INVALID_POLL_INTERVAL: Polling interval must be a valid number >= 1000ms (received: ${rawConfig.pollIntervalMs})`
      );
    }

    if (rawConfig.maxConcurrentTasks !== 1) {
      throw new Error(
        `INVALID_CONCURRENCY: Bounded continuous scheduler strictly enforces maxConcurrentTasks = 1 (received: ${rawConfig.maxConcurrentTasks})`
      );
    }

    this.config = rawConfig;
    this.governance = options.governance || defaultGovernanceEngine;
    this.worker = options.worker;
    this.tasks = options.tasks;
    this.repository = options.repository || new SchedulerSessionRepository(options.pool);
  }

  /**
   * Returns current active or last known session status.
   */
  public getStatus(): SchedulerSessionInfo {
    if (this.activeSession) {
      return { ...this.activeSession };
    }
    return {
      id: 'none',
      state: 'IDLE',
      authorizedBy: this.config.authorizedBy,
      activeLevel: 0,
      consecutiveTasks: 0,
      consecutiveFailures: 0,
      cycleCount: 0,
      maxConsecutiveTasks: 1,
      maxConsecutiveFailures: 1,
      startedAt: new Date().toISOString(),
      stoppedAt: null,
      stopReason: null,
    };
  }

  /**
   * Register a listener for structured observability events.
   */
  public onEvent(listener: (event: SchedulerEvent) => void): () => void {
    this.eventListeners.push(listener);
    return () => {
      this.eventListeners = this.eventListeners.filter((l) => l !== listener);
    };
  }

  /**
   * Emits a structured observability event with strict zero-secret sanitization.
   */
  private emitEvent(
    type: SchedulerEventType,
    payload: {
      taskId?: string | null;
      product?: string | null;
      governanceLevel?: GovernanceLimits['activeLevel'];
      reasonCode?: string;
      consecutiveTasks?: number;
      consecutiveFailures?: number;
      details?: Record<string, unknown>;
    } = {}
  ): void {
    const sanitizedDetails: Record<string, unknown> = {};
    if (payload.details) {
      for (const [k, v] of Object.entries(payload.details)) {
        // Redact any potentially sensitive keys
        if (/token|key|secret|auth|password|credential/i.test(k)) {
          sanitizedDetails[k] = '[REDACTED]';
        } else if (typeof v === 'string' && /ghp_|github_pat_|Bearer |eyJ/i.test(v)) {
          sanitizedDetails[k] = '[REDACTED]';
        } else {
          sanitizedDetails[k] = v;
        }
      }
    }

    const event: SchedulerEvent = {
      type,
      sessionId: this.activeSession?.id || 'unassigned',
      timestamp: new Date().toISOString(),
      taskId: payload.taskId,
      product: payload.product,
      governanceLevel: payload.governanceLevel ?? this.activeSession?.activeLevel,
      reasonCode: payload.reasonCode,
      consecutiveTasks: payload.consecutiveTasks ?? this.activeSession?.consecutiveTasks,
      consecutiveFailures: payload.consecutiveFailures ?? this.activeSession?.consecutiveFailures,
      details: sanitizedDetails,
    };

    console.log(`[PDL Scheduler] EVENT ${event.type} Session=${event.sessionId} Reason=${event.reasonCode || 'N/A'}`);
    for (const listener of this.eventListeners) {
      try {
        listener(event);
      } catch (err: any) {
        console.error('[PDL Scheduler] Listener error:', err.message);
      }
    }
  }

  /**
   * Starts a bounded continuous execution session.
   * Fails closed if governance denies continuation.
   */
  public async start(): Promise<SchedulerSessionInfo> {
    if (this.isLoopRunning || (this.activeSession && this.activeSession.state === 'RUNNING')) {
      throw new Error('CONCURRENCY_VIOLATION: A continuous scheduler session is already active');
    }

    let limits: GovernanceLimits;
    try {
      limits = await this.governance.loadLimits();
    } catch (err: any) {
      const failedSession: SchedulerSessionInfo = {
        id: `session-${crypto.randomUUID()}`,
        state: 'FAILED',
        authorizedBy: this.config.authorizedBy,
        activeLevel: 0,
        consecutiveTasks: 0,
        consecutiveFailures: 0,
        cycleCount: 0,
        maxConsecutiveTasks: 1,
        maxConsecutiveFailures: 1,
        startedAt: new Date().toISOString(),
        stoppedAt: new Date().toISOString(),
        stopReason: 'GOVERNANCE_CONFIG_ERROR',
        lastError: `Failed to load governance limits: ${err.message}`,
      };
      this.activeSession = failedSession;
      this.emitEvent('SCHEDULER_BLOCKED', {
        reasonCode: 'GOVERNANCE_CONFIG_ERROR',
        details: { error: err.message },
      });
      return failedSession;
    }

    // Step 1 Authority: Evaluate continuation gate before starting session
    const initialDecision = await this.governance.evaluateContinuation({
      consecutiveTasksCount: 0,
      consecutiveFailuresCount: 0,
    });

    const sessionId = `session-${crypto.randomUUID()}`;
    const initialSession: SchedulerSessionInfo = {
      id: sessionId,
      state: initialDecision.allowed ? 'RUNNING' : 'BLOCKED',
      authorizedBy: this.config.authorizedBy,
      activeLevel: limits.activeLevel,
      consecutiveTasks: 0,
      consecutiveFailures: 0,
      cycleCount: 0,
      maxConsecutiveTasks: limits.maxConsecutiveTasks,
      maxConsecutiveFailures: limits.maxConsecutiveFailures,
      startedAt: new Date().toISOString(),
      stoppedAt: initialDecision.allowed ? null : new Date().toISOString(),
      stopReason: initialDecision.allowed ? null : initialDecision.reasonCode,
      lastError: initialDecision.allowed ? null : initialDecision.reason,
    };

    this.activeSession = await this.repository.createSession(initialSession);

    if (!initialDecision.allowed) {
      this.emitEvent('SCHEDULER_GOVERNANCE_DENIED', {
        reasonCode: initialDecision.reasonCode,
        details: { reason: initialDecision.reason },
      });
      this.emitEvent('SCHEDULER_BLOCKED', {
        reasonCode: initialDecision.reasonCode,
      });
      return this.activeSession;
    }

    this.abortController = new AbortController();
    this.isLoopRunning = true;
    this.emitEvent('SCHEDULER_STARTED', {
      details: {
        authorizedBy: this.config.authorizedBy,
        maxConsecutiveTasks: limits.maxConsecutiveTasks,
        maxConsecutiveFailures: limits.maxConsecutiveFailures,
      },
    });

    // Run the execution loop in the background or await directly depending on invocation
    this.loopPromise = this.runLoop().finally(() => {
      this.isLoopRunning = false;
    });

    return this.activeSession;
  }

  /**
   * Bounded loop processing queued tasks under continuous governance supervision.
   */
  private async runLoop(): Promise<void> {
    if (!this.activeSession || !this.abortController) return;

    while (this.isLoopRunning && !this.abortController.signal.aborted) {
      // 1. Check persistent Emergency Kill Switch
      try {
        const killStatus = await this.governance.getKillSwitch().checkStatus();
        if (killStatus.active) {
          this.emitEvent('SCHEDULER_KILL_SWITCH', {
            reasonCode: 'KILL_SWITCH_ACTIVE',
            details: { reason: killStatus.reason },
          });
          await this.stop('KILL_SWITCH_ACTIVE', 'BLOCKED');
          break;
        }
      } catch (err: any) {
        await this.stop('GOVERNANCE_READ_FAILURE', 'FAILED');
        break;
      }

      // 2. Evaluate pre-task continuation gate
      let decision: GovernanceDecision;
      try {
        decision = await this.governance.evaluateContinuation({
          consecutiveTasksCount: this.activeSession.consecutiveTasks,
          consecutiveFailuresCount: this.activeSession.consecutiveFailures,
        });
      } catch (err: any) {
        await this.stop('GOVERNANCE_READ_FAILURE', 'FAILED');
        break;
      }

      if (!decision.allowed) {
        this.emitEvent('SCHEDULER_GOVERNANCE_DENIED', {
          reasonCode: decision.reasonCode,
          details: { reason: decision.reason },
        });
        const finalState: SchedulerSessionState =
          decision.reasonCode === 'CONSECUTIVE_TASKS_EXCEEDED' ? 'COMPLETED' : 'BLOCKED';
        await this.stop(decision.reasonCode, finalState);
        break;
      }

      // 3. Dispatch execution through canonical worker
      if (!this.worker) {
        console.warn('[PDL Scheduler] No worker provided to execute queue');
        await this.stop('WORKER_UNAVAILABLE', 'FAILED');
        break;
      }

      const cycleNumber = this.activeSession.cycleCount + 1;
      const cycleRecord: SchedulerCycleRecord = {
        id: `${this.activeSession.id}:${cycleNumber}`,
        sessionId: this.activeSession.id,
        cycleNumber,
        status: 'RUNNING',
        startedAt: new Date().toISOString(),
      };
      await this.repository.recordCycle(cycleRecord);
      this.emitEvent('SCHEDULER_TASK_STARTED', {
        details: { cycleNumber },
      });

      let executed = false;
      try {
        executed = await this.worker.executeOnce();
      } catch (workerErr: any) {
        console.error('[PDL Scheduler] Worker threw unhandled error:', workerErr.message);
        executed = true; // treated as failed cycle below
      }

      if (!executed) {
        // Queue was idle (no eligible task)
        await this.repository.updateCycle(this.activeSession.id, cycleNumber, {
          status: 'BLOCKED',
          stopReason: 'QUEUE_IDLE',
          completedAt: new Date().toISOString(),
        });
        this.emitEvent('SCHEDULER_IDLE');

        // Bounded sleep respecting abort signal
        const aborted = await this.interruptibleSleep(this.config.pollIntervalMs);
        if (aborted) {
          await this.stop('STOPPED_BY_OPERATOR', 'STOPPED');
          break;
        }
        continue;
      }

      // 4. Task was processed — examine authoritative worker outcome
      this.activeSession.cycleCount++;
      const lastFinalize = this.worker.lastFinalizeStatus;
      const lastTask = (this.worker as any).lastExecutedTask as Task | undefined;
      const isSuccess = lastFinalize === 'COMPLETED';

      cycleRecord.taskId = lastTask?.id || null;
      cycleRecord.completedAt = new Date().toISOString();

      if (isSuccess) {
        this.activeSession.consecutiveTasks++;
        this.activeSession.consecutiveFailures = 0;
        cycleRecord.status = 'COMPLETED';

        await this.repository.updateCycle(this.activeSession.id, cycleNumber, {
          taskId: cycleRecord.taskId,
          status: 'COMPLETED',
          completedAt: cycleRecord.completedAt,
        });

        this.emitEvent('SCHEDULER_TASK_SUCCEEDED', {
          taskId: lastTask?.id,
          product: lastTask?.project || lastTask?.repository,
          consecutiveTasks: this.activeSession.consecutiveTasks,
        });
      } else {
        this.activeSession.consecutiveFailures++;
        cycleRecord.status = 'FAILED';
        cycleRecord.error = lastTask?.error || 'Task failed execution or finalization';

        await this.repository.updateCycle(this.activeSession.id, cycleNumber, {
          taskId: cycleRecord.taskId,
          status: 'FAILED',
          error: cycleRecord.error,
          completedAt: cycleRecord.completedAt,
        });

        this.emitEvent('SCHEDULER_TASK_FAILED', {
          taskId: lastTask?.id,
          product: lastTask?.project || lastTask?.repository,
          consecutiveFailures: this.activeSession.consecutiveFailures,
          details: { error: cycleRecord.error },
        });
      }

      await this.repository.updateSession(this.activeSession.id, {
        consecutiveTasks: this.activeSession.consecutiveTasks,
        consecutiveFailures: this.activeSession.consecutiveFailures,
        cycleCount: this.activeSession.cycleCount,
      });

      // 5. Post-task continuation evaluation (hard stop check)
      let postDecision: GovernanceDecision;
      try {
        postDecision = await this.governance.evaluateContinuation({
          consecutiveTasksCount: this.activeSession.consecutiveTasks,
          consecutiveFailuresCount: this.activeSession.consecutiveFailures,
        });
      } catch (err: any) {
        await this.stop('GOVERNANCE_READ_FAILURE', 'FAILED');
        break;
      }

      if (!postDecision.allowed) {
        this.emitEvent('SCHEDULER_LIMIT_REACHED', {
          reasonCode: postDecision.reasonCode,
          details: { reason: postDecision.reason },
        });
        const finalState: SchedulerSessionState =
          postDecision.reasonCode === 'CONSECUTIVE_TASKS_EXCEEDED' ? 'COMPLETED' : 'FAILED';
        await this.stop(postDecision.reasonCode, finalState);
        break;
      }
    }
  }

  /**
   * Gracefully requests termination of the continuous scheduler.
   */
  public async stop(
    reason = 'STOPPED_BY_OPERATOR',
    targetState: SchedulerSessionState = 'STOPPED'
  ): Promise<SchedulerSessionInfo | null> {
    this.isLoopRunning = false;
    if (this.abortController) {
      this.abortController.abort();
    }

    if (this.activeSession) {
      const updated = await this.repository.updateSession(this.activeSession.id, {
        state: targetState,
        stoppedAt: new Date().toISOString(),
        stopReason: reason,
      });
      if (updated) {
        this.activeSession = updated;
      }
      this.emitEvent('SCHEDULER_STOPPED', {
        reasonCode: reason,
        details: { finalState: targetState },
      });
      return this.activeSession;
    }

    return null;
  }

  /**
   * Waits for the current loop execution to fully finish.
   */
  public async waitForCompletion(): Promise<void> {
    if (this.loopPromise) {
      await this.loopPromise;
    }
  }

  /**
   * Crash Recovery: inspects unfinalized sessions and active task leases.
   * Ensures that sessions interrupted by a process crash are marked as FAILED/STOPPED
   * and prevents unsafe duplicate re-execution of tasks that were already completed or finalized.
   */
  public async recoverFromCrash(): Promise<CrashRecoveryResult> {
    const active = await this.repository.getActiveSession();
    let recoveredSessions = 0;
    const interruptedTasks: string[] = [];

    if (active && active.state === 'RUNNING') {
      await this.repository.updateSession(active.id, {
        state: 'FAILED',
        stoppedAt: new Date().toISOString(),
        stopReason: 'RECOVERED_FROM_CRASH',
        lastError: 'Session interrupted unexpectedly by process restart/crash',
      });
      recoveredSessions++;

      const cycles = await this.repository.listCycles(active.id);
      for (const cycle of cycles) {
        if (cycle.status === 'RUNNING' && cycle.taskId) {
          interruptedTasks.push(cycle.taskId);
          await this.repository.updateCycle(active.id, cycle.cycleNumber, {
            status: 'FAILED',
            stopReason: 'RECOVERED_FROM_CRASH',
            completedAt: new Date().toISOString(),
          });

          if (this.tasks) {
            const task = await this.tasks.get(cycle.taskId);
            // If the task was not terminal, mark it failed to prevent duplicate uncontrolled execution
            if (task && !['COMPLETED', 'FAILED'].includes(task.status)) {
              await this.tasks.update(task.id, {
                status: 'FAILED',
                error: 'Task interrupted by unhandled worker crash during continuous session',
                leaseOwner: null,
                leaseDeadline: null,
              });
            }
          }
        }
      }
    }

    return {
      recoveredSessions,
      interruptedTasks,
    };
  }

  /**
   * Interruptible bounded sleep. Returns true if aborted, false if slept full duration.
   */
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

/**
 * Phase 5.5 Step 1: Centralized PDL Governance Policy Engine.
 *
 * Provides deterministic, fail-closed evaluation across the complete
 * autonomous lifecycle:
 * - Gate A: Task Claim
 * - Gate B: Execution Start
 * - Gate C: In-Process Correction
 * - Gate D: Remote Finalization
 * - Gate E: Continuous Continuation / Next Task Selection
 *
 * Enforces strict Level 0-4 governance boundaries. Level 5 is strictly rejected.
 */

import type { Pool } from 'pg';
import type { Task } from '../../domain.js';
import { defaultProductCatalog } from '../products/catalog.js';
import {
  type GovernanceLevel,
  type GovernanceLimits,
  type GovernanceGate,
  type GovernanceDecision,
  type GovernanceDecisionCode,
  DEFAULT_FAIL_CLOSED_LIMITS,
} from './types.js';
import { PdlKillSwitch, defaultKillSwitch } from './kill-switch.js';

export interface GovernanceEngineOptions {
  pool?: Pool;
  killSwitch?: PdlKillSwitch;
  cacheTtlMs?: number;
}

export class PdlGovernanceEngine {
  private pool?: Pool;
  private readonly killSwitch: PdlKillSwitch;
  private readonly cacheTtlMs: number;
  private cachedLimits: GovernanceLimits | null = null;
  private cacheExpiresAt = 0;

  constructor(options?: GovernanceEngineOptions) {
    this.pool = options?.pool;
    this.killSwitch = options?.killSwitch || (options?.pool ? new PdlKillSwitch({ pool: options.pool }) : defaultKillSwitch);
    this.cacheTtlMs = options?.cacheTtlMs ?? 5000;
  }

  public setPool(pool: Pool): void {
    this.pool = pool;
    this.killSwitch.setPool(pool);
    this.invalidateCache();
  }

  public getKillSwitch(): PdlKillSwitch {
    return this.killSwitch;
  }

  public invalidateCache(): void {
    this.cachedLimits = null;
    this.cacheExpiresAt = 0;
  }

  /**
   * Loads and validates governance configuration.
   * Fail-Closed Guarantee: If database is unreachable, config is missing,
   * corrupted, or specifies Level 5, falls back to DEFAULT_FAIL_CLOSED_LIMITS.
   */
  public async loadLimits(): Promise<GovernanceLimits> {
    const now = Date.now();
    if (this.cachedLimits && now < this.cacheExpiresAt) {
      return this.cachedLimits;
    }

    if (!this.pool) {
      return { ...DEFAULT_FAIL_CLOSED_LIMITS, killSwitchActive: true };
    }

    try {
      const res = await this.pool.query(
        'SELECT * FROM pdl_governance_state WHERE id = $1 LIMIT 1',
        ['canonical']
      );

      if (!res.rows || res.rows.length === 0) {
        console.warn('[PdlGovernanceEngine] Governance configuration row missing. Failing closed to Level 0.');
        return { ...DEFAULT_FAIL_CLOSED_LIMITS, killSwitchActive: true };
      }

      const row = res.rows[0];
      const rawLevel = Number(row.active_level);

      // Strict check: Level 5 is strictly forbidden!
      if (rawLevel === 5 || rawLevel < 0 || rawLevel > 4 || Number.isNaN(rawLevel)) {
        console.error(`[PdlGovernanceEngine] Invalid or forbidden governance level (${row.active_level}). Failing closed.`);
        return { ...DEFAULT_FAIL_CLOSED_LIMITS, killSwitchActive: true };
      }

      const level = rawLevel as GovernanceLevel;
      const killSwitchStatus = await this.killSwitch.checkStatus();

      const parsedAllowedProducts: string[] = Array.isArray(row.allowed_products)
        ? row.allowed_products
        : typeof row.allowed_products === 'string'
        ? JSON.parse(row.allowed_products)
        : DEFAULT_FAIL_CLOSED_LIMITS.allowedProducts;

      const limits: GovernanceLimits = {
        activeLevel: level,
        killSwitchActive: killSwitchStatus.active,
        maxConsecutiveTasks: Number(row.max_consecutive_tasks) || DEFAULT_FAIL_CLOSED_LIMITS.maxConsecutiveTasks,
        maxTaskDurationMs: Number(row.max_task_duration_ms) || DEFAULT_FAIL_CLOSED_LIMITS.maxTaskDurationMs,
        maxToolRoundsPerTask: Number(row.max_tool_rounds_per_task) || DEFAULT_FAIL_CLOSED_LIMITS.maxToolRoundsPerTask,
        maxCorrectionAttempts: Number(row.max_correction_attempts) || DEFAULT_FAIL_CLOSED_LIMITS.maxCorrectionAttempts,
        maxConsecutiveFailures: Number(row.max_consecutive_failures) || DEFAULT_FAIL_CLOSED_LIMITS.maxConsecutiveFailures,
        allowedProducts: parsedAllowedProducts,
      };

      this.cachedLimits = limits;
      this.cacheExpiresAt = now + this.cacheTtlMs;
      return limits;
    } catch (err: any) {
      console.error('[PdlGovernanceEngine] Error reading governance limits, failing closed:', err.message);
      return { ...DEFAULT_FAIL_CLOSED_LIMITS, killSwitchActive: true };
    }
  }

  /**
   * Updates the persistent governance configuration in database.
   */
  public async updateLimits(
    patch: Partial<GovernanceLimits>,
    updatedBy = 'operator',
    reason = 'Governance update'
  ): Promise<GovernanceLimits> {
    if (!this.pool) {
      throw new Error('Database pool not configured on PdlGovernanceEngine');
    }

    if (patch.activeLevel !== undefined && (patch.activeLevel < 0 || patch.activeLevel > 4)) {
      throw new Error(`Invalid governance level: ${patch.activeLevel}. Level 5 is strictly forbidden.`);
    }

    const current = await this.loadLimits();
    const updated: GovernanceLimits = {
      ...current,
      ...patch,
    };

    if (patch.killSwitchActive !== undefined) {
      await this.killSwitch.setDatabaseState(patch.killSwitchActive, updatedBy, reason);
    }

    await this.pool.query(
      `INSERT INTO pdl_governance_state (
        id, active_level, kill_switch_active, max_consecutive_tasks,
        max_task_duration_ms, max_tool_rounds_per_task, max_correction_attempts,
        max_consecutive_failures, allowed_products, updated_at, updated_by, reason
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now(), $10, $11)
      ON CONFLICT (id) DO UPDATE SET
        active_level = EXCLUDED.active_level,
        kill_switch_active = EXCLUDED.kill_switch_active,
        max_consecutive_tasks = EXCLUDED.max_consecutive_tasks,
        max_task_duration_ms = EXCLUDED.max_task_duration_ms,
        max_tool_rounds_per_task = EXCLUDED.max_tool_rounds_per_task,
        max_correction_attempts = EXCLUDED.max_correction_attempts,
        max_consecutive_failures = EXCLUDED.max_consecutive_failures,
        allowed_products = EXCLUDED.allowed_products,
        updated_at = now(),
        updated_by = EXCLUDED.updated_by,
        reason = EXCLUDED.reason`,
      [
        'canonical',
        updated.activeLevel,
        updated.killSwitchActive,
        updated.maxConsecutiveTasks,
        updated.maxTaskDurationMs,
        updated.maxToolRoundsPerTask,
        updated.maxCorrectionAttempts,
        updated.maxConsecutiveFailures,
        JSON.stringify(updated.allowedProducts),
        updatedBy,
        reason,
      ]
    );

    this.invalidateCache();
    return this.loadLimits();
  }

  /**
   * Gate A: Evaluates whether worker is permitted to claim a task.
   */
  public async evaluateClaim(task?: Task): Promise<GovernanceDecision> {
    const limits = await this.loadLimits();

    if (limits.killSwitchActive) {
      return this.createDecision(
        'CLAIM',
        false,
        'KILL_SWITCH_ACTIVE',
        'Task claim blocked: Emergency kill switch is active',
        limits,
        task
      );
    }

    // Level 0: Manual execution only.
    if (limits.activeLevel === 0) {
      return this.createDecision(
        'CLAIM',
        false,
        'LEVEL_0_MANUAL_ONLY',
        'Task claim blocked: Governance Level 0 is active (Manual execution only; autonomous claiming disabled)',
        limits,
        task
      );
    }

    if (task) {
      const productCheck = this.checkProductAuthorization(task, limits);
      if (!productCheck.allowed) {
        return this.createDecision(
          'CLAIM',
          false,
          'UNAUTHORIZED_PRODUCT',
          productCheck.reason,
          limits,
          task
        );
      }
    }

    return this.createDecision(
      'CLAIM',
      true,
      'PERMITTED',
      `Task claim authorized under Governance Level ${limits.activeLevel}`,
      limits,
      task
    );
  }

  /**
   * Gate B: Evaluates whether LLM execution may begin for a claimed task.
   */
  public async evaluateExecution(
    task: Task,
    context?: { durationMs?: number }
  ): Promise<GovernanceDecision> {
    const limits = await this.loadLimits();

    if (limits.killSwitchActive) {
      return this.createDecision(
        'EXECUTION',
        false,
        'KILL_SWITCH_ACTIVE',
        'Execution start blocked: Emergency kill switch is active',
        limits,
        task
      );
    }

    const productCheck = this.checkProductAuthorization(task, limits);
    if (!productCheck.allowed) {
      return this.createDecision(
        'EXECUTION',
        false,
        'UNAUTHORIZED_PRODUCT',
        productCheck.reason,
        limits,
        task
      );
    }

    if (context?.durationMs && context.durationMs > limits.maxTaskDurationMs) {
      return this.createDecision(
        'EXECUTION',
        false,
        'TASK_DURATION_EXCEEDED',
        `Task duration (${context.durationMs}ms) exceeded governance limit (${limits.maxTaskDurationMs}ms)`,
        limits,
        task
      );
    }

    return this.createDecision(
      'EXECUTION',
      true,
      'PERMITTED',
      `Execution start authorized under Governance Level ${limits.activeLevel}`,
      limits,
      task
    );
  }

  /**
   * Gate C: Evaluates whether in-process workspace correction loop may run.
   */
  public async evaluateCorrection(
    task: Task,
    context: { attemptNumber: number }
  ): Promise<GovernanceDecision> {
    const limits = await this.loadLimits();

    if (limits.killSwitchActive) {
      return this.createDecision(
        'CORRECTION',
        false,
        'KILL_SWITCH_ACTIVE',
        'Correction loop blocked: Emergency kill switch is active',
        limits,
        task
      );
    }

    if (context.attemptNumber > limits.maxCorrectionAttempts) {
      return this.createDecision(
        'CORRECTION',
        false,
        'CORRECTION_ATTEMPTS_EXCEEDED',
        `Correction attempt ${context.attemptNumber} exceeded maximum configured correction attempts (${limits.maxCorrectionAttempts})`,
        limits,
        task
      );
    }

    return this.createDecision(
      'CORRECTION',
      true,
      'PERMITTED',
      `Correction attempt ${context.attemptNumber} authorized under Governance Level ${limits.activeLevel}`,
      limits,
      task
    );
  }

  /**
   * Gate D: Evaluates whether remote finalization & push may proceed.
   */
  public async evaluateFinalization(task: Task): Promise<GovernanceDecision> {
    const limits = await this.loadLimits();

    if (limits.killSwitchActive) {
      return this.createDecision(
        'FINALIZATION',
        false,
        'KILL_SWITCH_ACTIVE',
        'Remote finalization blocked: Emergency kill switch is active',
        limits,
        task
      );
    }

    const productCheck = this.checkProductAuthorization(task, limits);
    if (!productCheck.allowed) {
      return this.createDecision(
        'FINALIZATION',
        false,
        'UNAUTHORIZED_PRODUCT',
        productCheck.reason,
        limits,
        task
      );
    }

    return this.createDecision(
      'FINALIZATION',
      true,
      'PERMITTED',
      `Remote finalization authorized under Governance Level ${limits.activeLevel}`,
      limits,
      task
    );
  }

  /**
   * Gate E: Evaluates whether autonomous continuation to select the next task is permitted.
   */
  public async evaluateContinuation(context: {
    consecutiveTasksCount: number;
    consecutiveFailuresCount: number;
  }): Promise<GovernanceDecision> {
    const limits = await this.loadLimits();

    if (limits.killSwitchActive) {
      return this.createDecision(
        'CONTINUATION',
        false,
        'KILL_SWITCH_ACTIVE',
        'Autonomous continuation blocked: Emergency kill switch is active',
        limits
      );
    }

    // Level >= 3 is required for autonomous multi-task continuation
    if (limits.activeLevel < 3) {
      return this.createDecision(
        'CONTINUATION',
        false,
        'LEVEL_EXCEEDED',
        `Autonomous continuation requires Governance Level 3+, but active level is ${limits.activeLevel}`,
        limits
      );
    }

    if (context.consecutiveTasksCount >= limits.maxConsecutiveTasks) {
      return this.createDecision(
        'CONTINUATION',
        false,
        'CONSECUTIVE_TASKS_EXCEEDED',
        `Autonomous continuation stopped: Max consecutive tasks limit (${limits.maxConsecutiveTasks}) reached`,
        limits
      );
    }

    if (context.consecutiveFailuresCount >= limits.maxConsecutiveFailures) {
      return this.createDecision(
        'CONTINUATION',
        false,
        'CONSECUTIVE_FAILURES_EXCEEDED',
        `Autonomous continuation stopped: Max consecutive failures limit (${limits.maxConsecutiveFailures}) reached`,
        limits
      );
    }

    return this.createDecision(
      'CONTINUATION',
      true,
      'PERMITTED',
      `Autonomous continuation permitted for task ${context.consecutiveTasksCount + 1} of ${limits.maxConsecutiveTasks}`,
      limits
    );
  }

  private checkProductAuthorization(
    task: Task,
    limits: GovernanceLimits
  ): { allowed: boolean; reason: string } {
    const productId = task.project || task.repository || '';
    const catalogProduct = defaultProductCatalog.get(productId);

    if (!catalogProduct) {
      return {
        allowed: false,
        reason: `Product '${productId}' is not registered in the Product Catalog. Autonomous execution rejected.`,
      };
    }

    if (!limits.allowedProducts.includes(catalogProduct.productId)) {
      return {
        allowed: false,
        reason: `Product '${catalogProduct.productId}' is not in the authorized products list [${limits.allowedProducts.join(', ')}] under active governance.`,
      };
    }

    return { allowed: true, reason: 'Product authorized' };
  }

  private createDecision(
    gate: GovernanceGate,
    allowed: boolean,
    reasonCode: GovernanceDecisionCode,
    reason: string,
    limits: GovernanceLimits,
    task?: Task
  ): GovernanceDecision {
    const decision: GovernanceDecision = {
      allowed,
      gate,
      reasonCode,
      reason,
      activeLevel: limits.activeLevel,
      killSwitchActive: limits.killSwitchActive,
      limits,
      timestamp: new Date().toISOString(),
      taskId: task?.id,
      productId: task?.project || task?.repository,
    };

    // Structured governance audit log
    const logPrefix = allowed ? '[PDL Governance:PERMIT]' : '[PDL Governance:BLOCK]';
    console.log(`${logPrefix} Gate=${gate} Reason=${reasonCode} Level=${limits.activeLevel} Task=${task?.id || 'none'} Detail=${reason}`);

    return decision;
  }
}

export const defaultGovernanceEngine = new PdlGovernanceEngine();

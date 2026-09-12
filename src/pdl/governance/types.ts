/**
 * Phase 5.5 Step 1: Governance Policy Types and Contracts.
 *
 * Defines the canonical PDL governance levels (0-4), strict level limits,
 * decision codes, and fail-closed default structures.
 */

export type GovernanceLevel = 0 | 1 | 2 | 3 | 4;

export interface GovernanceLimits {
  /** Active governance level: 0=Manual, 1=Single, 2=Queued, 3=Continuous Bounded, 4=Scheduled */
  activeLevel: GovernanceLevel;
  /** Maximum consecutive tasks permitted in an autonomous continuation cycle */
  maxConsecutiveTasks: number;
  /** Maximum duration allowed for a single task in milliseconds */
  maxTaskDurationMs: number;
  /** Maximum tool call rounds allowed for a single task */
  maxToolRoundsPerTask: number;
  /** Maximum in-process correction attempts allowed */
  maxCorrectionAttempts: number;
  /** Maximum consecutive failures allowed before halting the loop */
  maxConsecutiveFailures: number;
  /** Authorized product IDs permitted for autonomous processing */
  allowedProducts: string[];
  /** Whether the persistent Emergency Stop / Kill Switch is active */
  killSwitchActive: boolean;
}

export type GovernanceGate =
  | 'CLAIM'
  | 'EXECUTION'
  | 'CORRECTION'
  | 'FINALIZATION'
  | 'CONTINUATION';

export type GovernanceDecisionCode =
  | 'PERMITTED'
  | 'KILL_SWITCH_ACTIVE'
  | 'LEVEL_0_MANUAL_ONLY'
  | 'LEVEL_EXCEEDED'
  | 'UNAUTHORIZED_PRODUCT'
  | 'TASK_DURATION_EXCEEDED'
  | 'TOOL_ROUNDS_EXCEEDED'
  | 'CORRECTION_ATTEMPTS_EXCEEDED'
  | 'CONSECUTIVE_FAILURES_EXCEEDED'
  | 'CONSECUTIVE_TASKS_EXCEEDED'
  | 'GOVERNANCE_CONFIG_ERROR'
  | 'LEVEL_5_FORBIDDEN';

export interface GovernanceDecision {
  allowed: boolean;
  gate: GovernanceGate;
  reasonCode: GovernanceDecisionCode;
  reason: string;
  activeLevel: GovernanceLevel;
  killSwitchActive: boolean;
  limits: GovernanceLimits;
  timestamp: string;
  taskId?: string;
  productId?: string;
}

export const DEFAULT_FAIL_CLOSED_LIMITS: GovernanceLimits = {
  activeLevel: 0,
  killSwitchActive: true,
  maxConsecutiveTasks: 1,
  maxTaskDurationMs: 180000,
  maxToolRoundsPerTask: 10,
  maxCorrectionAttempts: 2,
  maxConsecutiveFailures: 1,
  allowedProducts: [
    'pub-rate-calculator',
    'pub-dev-loop-template',
    'pub-shopee-scraper',
  ],
};

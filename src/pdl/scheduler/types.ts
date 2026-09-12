/**
 * Phase 5.5 Step 2: Bounded Continuous Scheduler Types and Contracts.
 *
 * Defines session states, configuration, cycle metrics, and structured observability events.
 */

import type { GovernanceLevel, GovernanceDecisionCode } from '../governance/types.js';

export type SchedulerSessionState =
  | 'IDLE'
  | 'RUNNING'
  | 'STOPPED'
  | 'BLOCKED'
  | 'COMPLETED'
  | 'FAILED';

export type SchedulerEventType =
  | 'SCHEDULER_STARTED'
  | 'SCHEDULER_STOPPED'
  | 'SCHEDULER_BLOCKED'
  | 'SCHEDULER_IDLE'
  | 'SCHEDULER_TASK_SELECTED'
  | 'SCHEDULER_TASK_STARTED'
  | 'SCHEDULER_TASK_SUCCEEDED'
  | 'SCHEDULER_TASK_FAILED'
  | 'SCHEDULER_LIMIT_REACHED'
  | 'SCHEDULER_KILL_SWITCH'
  | 'SCHEDULER_GOVERNANCE_DENIED';

export interface SchedulerEvent {
  type: SchedulerEventType;
  sessionId: string;
  timestamp: string;
  taskId?: string | null;
  product?: string | null;
  governanceLevel?: GovernanceLevel;
  reasonCode?: GovernanceDecisionCode | string;
  consecutiveTasks?: number;
  consecutiveFailures?: number;
  details?: Record<string, unknown>;
}

export interface SchedulerConfig {
  /** Polling interval in ms when the task queue is idle. Minimum 1000ms, default 10000ms. */
  pollIntervalMs: number;
  /** Principal or system that authorized this continuous execution session */
  authorizedBy: string;
  /** Maximum concurrent autonomous tasks executed by this scheduler instance (strictly 1). */
  maxConcurrentTasks: number;
  /** Optional target project/product filter. If unset, all authorized products in the catalog can be claimed. */
  projectId?: string;
}

export interface SchedulerSessionInfo {
  id: string;
  state: SchedulerSessionState;
  authorizedBy: string;
  activeLevel: GovernanceLevel;
  consecutiveTasks: number;
  consecutiveFailures: number;
  cycleCount: number;
  maxConsecutiveTasks: number;
  maxConsecutiveFailures: number;
  startedAt: string;
  stoppedAt?: string | null;
  stopReason?: string | null;
  lastError?: string | null;
}

export interface SchedulerCycleRecord {
  id: string;
  sessionId: string;
  cycleNumber: number;
  taskId?: string | null;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'BLOCKED';
  stopReason?: string | null;
  error?: string | null;
  startedAt: string;
  completedAt?: string | null;
}

export const DEFAULT_SCHEDULER_CONFIG: SchedulerConfig = {
  pollIntervalMs: 10000,
  authorizedBy: 'human-operator',
  maxConcurrentTasks: 1,
};

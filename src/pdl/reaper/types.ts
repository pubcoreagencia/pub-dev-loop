/**
 * Phase 5.5 Step 4: Periodic Reaper & Stale Task Recovery Types and Contracts.
 *
 * Defines reaper configurations, cycle metrics, status, and structured audit events.
 */

export interface ReaperStatus {
  running: boolean;
  lastCycleAt: string | null;
  totalCycles: number;
  staleDetectedCount: number;
  recoveredCount: number;
  dlqCount: number;
  quarantinedCount: number;
  blockedCount: number;
  lastError: string | null;
}

export interface ReaperConfig {
  /** Interval in milliseconds between periodic stale inspections. Minimum 1000ms, default 60000ms. */
  intervalMs: number;
  /** Maximum number of stale tasks inspected per recovery cycle. Default: 10. */
  batchSize: number;
  /** Optional grace period in ms after lease expiration before declaring stale. Default: 0. */
  staleGracePeriodMs: number;
}

export const DEFAULT_REAPER_CONFIG: ReaperConfig = {
  intervalMs: 60000,
  batchSize: 10,
  staleGracePeriodMs: 0,
};

export type ReaperEventType =
  | 'REAPER_STARTED'
  | 'REAPER_STOPPED'
  | 'REAPER_CYCLE_STARTED'
  | 'REAPER_CYCLE_COMPLETED'
  | 'REAPER_CYCLE_FAILED'
  | 'TASK_STALE_DETECTED'
  | 'TASK_RECOVERED'
  | 'TASK_RECOVERY_BLOCKED'
  | 'TASK_RECOVERY_TO_DLQ'
  | 'TASK_RECOVERY_TO_QUARANTINE';

export interface ReaperEvent {
  type: ReaperEventType;
  timestamp: string;
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
}

export interface ReaperCycleResult {
  cycleNumber: number;
  staleDetected: number;
  recovered: number;
  deadLettered: number;
  quarantined: number;
  blocked: number;
  error?: string | null;
}

/**
 * Phase 5.5 Step 3: Dead-Letter Queue (DLQ) Types and Contracts.
 *
 * Provides persistent records of exhausted or quarantined tasks,
 * ensuring complete observability and zero data loss.
 */

import type { PdlFailureClass, PdlFailureCode } from '../retry/types.js';

export type DeadLetterStatus = 'UNRESOLVED' | 'RESOLVED' | 'DISCARDED';

export interface DeadLetterRecord {
  id: string;
  taskId: string;
  repository: string;
  product: string;
  failureCode: PdlFailureCode;
  failureClass: PdlFailureClass;
  attemptCount: number;
  reason: string;
  quarantined: boolean;
  originalTaskResult?: Record<string, unknown> | null;
  status: DeadLetterStatus;
  createdAt: Date;
  resolvedAt?: Date | null;
  resolution?: string | null;
}

export interface CreateDeadLetterInput {
  id?: string;
  taskId: string;
  repository: string;
  product: string;
  failureCode: PdlFailureCode;
  failureClass: PdlFailureClass;
  attemptCount: number;
  reason: string;
  quarantined?: boolean;
  originalTaskResult?: Record<string, unknown> | null;
}

export interface DLQFilter {
  taskId?: string;
  product?: string;
  failureClass?: PdlFailureClass | string;
  failureCode?: string;
  quarantined?: boolean;
  status?: DeadLetterStatus;
  limit?: number;
}

export interface DLQStatus {
  totalCount: number;
  quarantinedCount: number;
  unresolvedCount: number;
  byFailureClass: Record<string, number>;
  byFailureCode: Record<string, number>;
  byProduct: Record<string, number>;
}

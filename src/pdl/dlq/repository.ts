/**
 * Phase 5.5 Step 3: Dead-Letter Queue (DLQ) Repository.
 *
 * Implements persistent, idempotent storage for dead-letter records
 * with sovereign in-memory fallback for zero downtime.
 */

import crypto from 'node:crypto';
import type { Pool } from 'pg';
import type {
  DeadLetterRecord,
  CreateDeadLetterInput,
  DLQFilter,
  DLQStatus,
} from './types.js';

// Sovereign fallback storage for DLQ records
const sovereignDlqStore = new Map<string, DeadLetterRecord>();

export interface IPdlDeadLetterRepository {
  record(input: CreateDeadLetterInput): Promise<DeadLetterRecord>;
  list(filter?: DLQFilter): Promise<DeadLetterRecord[]>;
  getStatus(): Promise<DLQStatus>;
  getByTaskId(taskId: string): Promise<DeadLetterRecord[]>;
  resolve(id: string, resolution: string): Promise<DeadLetterRecord | null>;
}

export class PdlDeadLetterRepository implements IPdlDeadLetterRepository {
  constructor(private readonly pool?: Pool) {}

  public clearInMemoryState(): void {
    sovereignDlqStore.clear();
  }

  /**
   * Idempotently records a dead-letter entry.
   * If a record for (task_id, attempt_count) already exists, returns the existing record.
   */
  public async record(input: CreateDeadLetterInput): Promise<DeadLetterRecord> {
    const id = input.id || `dlq-${crypto.randomUUID()}`;
    const dedupeKey = `${input.taskId}:${input.attemptCount}`;

    if (this.pool) {
      try {
        const r = await this.pool.query(
          `INSERT INTO pdl_dead_letters (
            id, task_id, repository, product, failure_code, failure_class,
            attempt_count, reason, quarantined, original_task_result, status, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'UNRESOLVED', now())
          ON CONFLICT (task_id, attempt_count) DO UPDATE
            SET reason = EXCLUDED.reason
          RETURNING *`,
          [
            id,
            input.taskId,
            input.repository,
            input.product,
            input.failureCode,
            input.failureClass,
            input.attemptCount,
            input.reason,
            input.quarantined ?? false,
            input.originalTaskResult ? JSON.stringify(input.originalTaskResult) : null,
          ]
        );

        if (r?.rows?.[0]) {
          const record = this.mapRow(r.rows[0]);
          sovereignDlqStore.set(dedupeKey, record);
          return record;
        }
      } catch (err: any) {
        console.warn('[PdlDeadLetterRepository] DB error on record, using sovereign memory:', err.message);
      }
    }

    // Sovereign memory fallback (idempotent)
    const existing = sovereignDlqStore.get(dedupeKey);
    if (existing) {
      return existing;
    }

    const record: DeadLetterRecord = {
      id,
      taskId: input.taskId,
      repository: input.repository,
      product: input.product,
      failureCode: input.failureCode,
      failureClass: input.failureClass,
      attemptCount: input.attemptCount,
      reason: input.reason,
      quarantined: input.quarantined ?? false,
      originalTaskResult: input.originalTaskResult ?? null,
      status: 'UNRESOLVED',
      createdAt: new Date(),
      resolvedAt: null,
      resolution: null,
    };
    sovereignDlqStore.set(dedupeKey, record);
    return record;
  }

  /**
   * Lists DLQ records according to filter criteria.
   */
  public async list(filter: DLQFilter = {}): Promise<DeadLetterRecord[]> {
    const results: DeadLetterRecord[] = [];
    const seenIds = new Set<string>();

    if (this.pool) {
      try {
        const conditions: string[] = [];
        const vals: unknown[] = [];
        let i = 1;

        if (filter.taskId) {
          conditions.push(`task_id = $${i++}`);
          vals.push(filter.taskId);
        }
        if (filter.product) {
          conditions.push(`product = $${i++}`);
          vals.push(filter.product);
        }
        if (filter.failureClass) {
          conditions.push(`failure_class = $${i++}`);
          vals.push(filter.failureClass);
        }
        if (filter.failureCode) {
          conditions.push(`failure_code = $${i++}`);
          vals.push(filter.failureCode);
        }
        if (filter.quarantined !== undefined) {
          conditions.push(`quarantined = $${i++}`);
          vals.push(filter.quarantined);
        }
        if (filter.status) {
          conditions.push(`status = $${i++}`);
          vals.push(filter.status);
        }

        const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
        const limitClause = filter.limit ? `LIMIT ${filter.limit}` : '';

        const r = await this.pool.query(
          `SELECT * FROM pdl_dead_letters ${whereClause} ORDER BY created_at DESC ${limitClause}`,
          vals
        );

        if (r?.rows) {
          for (const row of r.rows) {
            const mapped = this.mapRow(row);
            results.push(mapped);
            seenIds.add(mapped.id);
          }
        }
      } catch (err: any) {
        console.warn('[PdlDeadLetterRepository] DB error on list, consulting sovereign memory:', err.message);
      }
    }

    // Merge in-memory records not yet captured
    for (const memRecord of sovereignDlqStore.values()) {
      if (seenIds.has(memRecord.id)) continue;

      if (filter.taskId && memRecord.taskId !== filter.taskId) continue;
      if (filter.product && memRecord.product !== filter.product) continue;
      if (filter.failureClass && memRecord.failureClass !== filter.failureClass) continue;
      if (filter.failureCode && memRecord.failureCode !== filter.failureCode) continue;
      if (filter.quarantined !== undefined && memRecord.quarantined !== filter.quarantined) continue;
      if (filter.status && memRecord.status !== filter.status) continue;

      results.push(memRecord);
    }

    return results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Returns aggregated status and distribution metrics.
   */
  public async getStatus(): Promise<DLQStatus> {
    const all = await this.list();

    let quarantinedCount = 0;
    let unresolvedCount = 0;
    const byFailureClass: Record<string, number> = {};
    const byFailureCode: Record<string, number> = {};
    const byProduct: Record<string, number> = {};

    for (const r of all) {
      if (r.quarantined) quarantinedCount++;
      if (r.status === 'UNRESOLVED') unresolvedCount++;

      byFailureClass[r.failureClass] = (byFailureClass[r.failureClass] || 0) + 1;
      byFailureCode[r.failureCode] = (byFailureCode[r.failureCode] || 0) + 1;
      byProduct[r.product] = (byProduct[r.product] || 0) + 1;
    }

    return {
      totalCount: all.length,
      quarantinedCount,
      unresolvedCount,
      byFailureClass,
      byFailureCode,
      byProduct,
    };
  }

  public async getByTaskId(taskId: string): Promise<DeadLetterRecord[]> {
    return this.list({ taskId });
  }

  public async resolve(id: string, resolution: string): Promise<DeadLetterRecord | null> {
    const now = new Date();
    if (this.pool) {
      try {
        const r = await this.pool.query(
          `UPDATE pdl_dead_letters
           SET status = 'RESOLVED', resolution = $2, resolved_at = $3
           WHERE id = $1 RETURNING *`,
          [id, resolution, now]
        );
        if (r?.rows?.[0]) return this.mapRow(r.rows[0]);
      } catch (err: any) {
        console.warn('[PdlDeadLetterRepository] DB error on resolve:', err.message);
      }
    }

    for (const rec of sovereignDlqStore.values()) {
      if (rec.id === id) {
        rec.status = 'RESOLVED';
        rec.resolution = resolution;
        rec.resolvedAt = now;
        return rec;
      }
    }
    return null;
  }

  private mapRow(r: Record<string, unknown>): DeadLetterRecord {
    return {
      id: String(r.id),
      taskId: String(r.task_id),
      repository: String(r.repository),
      product: String(r.product),
      failureCode: String(r.failure_code),
      failureClass: r.failure_class as any,
      attemptCount: Number(r.attempt_count),
      reason: String(r.reason),
      quarantined: Boolean(r.quarantined),
      originalTaskResult: typeof r.original_task_result === 'string'
        ? JSON.parse(r.original_task_result)
        : (r.original_task_result as Record<string, unknown> | null),
      status: r.status as any,
      createdAt: new Date(r.created_at as string | Date),
      resolvedAt: r.resolved_at ? new Date(r.resolved_at as string | Date) : null,
      resolution: (r.resolution as string | null) ?? null,
    };
  }
}

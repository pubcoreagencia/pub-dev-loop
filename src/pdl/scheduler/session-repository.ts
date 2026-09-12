/**
 * Phase 5.5 Step 2: Scheduler Session & Cycle Repository.
 *
 * Persists bounded autonomous execution sessions and discrete cycles.
 * Uses existing autonomy_missions and autonomy_cycles durable tables when Postgres
 * is available, with resilient in-memory sovereign storage fallback.
 */

import type { Pool } from 'pg';
import type {
  SchedulerSessionInfo,
  SchedulerCycleRecord,
} from './types.js';

export interface ISchedulerSessionRepository {
  createSession(info: SchedulerSessionInfo, tenantId?: string): Promise<SchedulerSessionInfo>;
  updateSession(id: string, updates: Partial<SchedulerSessionInfo>): Promise<SchedulerSessionInfo | null>;
  getSession(id: string): Promise<SchedulerSessionInfo | null>;
  listSessions(): Promise<SchedulerSessionInfo[]>;
  getActiveSession(): Promise<SchedulerSessionInfo | null>;
  recordCycle(cycle: SchedulerCycleRecord, tenantId?: string): Promise<SchedulerCycleRecord>;
  updateCycle(sessionId: string, cycleNumber: number, updates: Partial<SchedulerCycleRecord>): Promise<SchedulerCycleRecord | null>;
  listCycles(sessionId: string): Promise<SchedulerCycleRecord[]>;
}

// Sovereign in-memory fallback store
const sovereignSessions = new Map<string, SchedulerSessionInfo>();
const sovereignCycles = new Map<string, SchedulerCycleRecord>();

export class SchedulerSessionRepository implements ISchedulerSessionRepository {
  constructor(private readonly pool?: Pool) {}

  async createSession(info: SchedulerSessionInfo, tenantId = 'pub-core-holding'): Promise<SchedulerSessionInfo> {
    const session: SchedulerSessionInfo = { ...info };
    sovereignSessions.set(session.id, session);

    if (this.pool) {
      try {
        const query = `
          INSERT INTO autonomy_missions (
            id, tenant_id, project_id, title, objective,
            target_capabilities, constraints, risk_policy,
            max_cycles, status, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          ON CONFLICT (id) DO UPDATE SET
            status = EXCLUDED.status,
            updated_at = EXCLUDED.updated_at
          RETURNING *;
        `;
        const mappedStatus = session.state === 'RUNNING' ? 'ACTIVE'
          : session.state === 'COMPLETED' ? 'COMPLETED'
          : session.state === 'BLOCKED' || session.state === 'FAILED' ? 'BLOCKED'
          : 'PAUSED';

        await this.pool.query(query, [
          session.id,
          tenantId,
          'pub-continuous-scheduler',
          `Scheduler Session ${session.id}`,
          `Bounded autonomous continuation (authorized by ${session.authorizedBy})`,
          JSON.stringify({ activeLevel: session.activeLevel, authorizedBy: session.authorizedBy }),
          JSON.stringify({
            maxConsecutiveTasks: session.maxConsecutiveTasks,
            maxConsecutiveFailures: session.maxConsecutiveFailures,
          }),
          'AUTONOMOUS',
          session.maxConsecutiveTasks,
          mappedStatus,
          session.startedAt,
          new Date().toISOString(),
        ]);
      } catch (err: any) {
        console.warn('[SchedulerSessionRepository] Postgres error on createSession, retained in memory:', err.message);
      }
    }

    return session;
  }

  async updateSession(id: string, updates: Partial<SchedulerSessionInfo>): Promise<SchedulerSessionInfo | null> {
    const existing = sovereignSessions.get(id);
    if (!existing) return null;

    const updated: SchedulerSessionInfo = {
      ...existing,
      ...updates,
    };
    sovereignSessions.set(id, updated);

    if (this.pool) {
      try {
        const mappedStatus = updated.state === 'RUNNING' ? 'ACTIVE'
          : updated.state === 'COMPLETED' ? 'COMPLETED'
          : updated.state === 'BLOCKED' || updated.state === 'FAILED' ? 'BLOCKED'
          : 'PAUSED';

        const completedAt = updated.stoppedAt ? new Date(updated.stoppedAt) : null;

        await this.pool.query(
          `UPDATE autonomy_missions
           SET status = $1, completed_at = $2, updated_at = now()
           WHERE id = $3`,
          [mappedStatus, completedAt, id]
        );
      } catch (err: any) {
        console.warn('[SchedulerSessionRepository] Postgres error on updateSession, retained in memory:', err.message);
      }
    }

    return updated;
  }

  async getSession(id: string): Promise<SchedulerSessionInfo | null> {
    const mem = sovereignSessions.get(id);
    if (mem) return { ...mem };

    if (this.pool) {
      try {
        const res = await this.pool.query('SELECT * FROM autonomy_missions WHERE id = $1', [id]);
        if (res.rows.length > 0) {
          const row = res.rows[0];
          const constraints = row.constraints || {};
          const targetCaps = row.target_capabilities || {};
          const session: SchedulerSessionInfo = {
            id: row.id,
            state: row.status === 'ACTIVE' ? 'RUNNING'
              : row.status === 'COMPLETED' ? 'COMPLETED'
              : row.status === 'BLOCKED' ? 'BLOCKED'
              : 'STOPPED',
            authorizedBy: targetCaps.authorizedBy || 'human-operator',
            activeLevel: targetCaps.activeLevel ?? 3,
            consecutiveTasks: 0,
            consecutiveFailures: 0,
            cycleCount: 0,
            maxConsecutiveTasks: constraints.maxConsecutiveTasks || row.max_cycles || 3,
            maxConsecutiveFailures: constraints.maxConsecutiveFailures || 1,
            startedAt: row.created_at?.toISOString?.() || new Date().toISOString(),
            stoppedAt: row.completed_at?.toISOString?.() || null,
          };
          sovereignSessions.set(session.id, session);
          return session;
        }
      } catch (err: any) {
        console.warn('[SchedulerSessionRepository] Postgres error on getSession:', err.message);
      }
    }

    return null;
  }

  async listSessions(): Promise<SchedulerSessionInfo[]> {
    return Array.from(sovereignSessions.values());
  }

  async getActiveSession(): Promise<SchedulerSessionInfo | null> {
    for (const session of sovereignSessions.values()) {
      if (session.state === 'RUNNING') {
        return { ...session };
      }
    }

    if (this.pool) {
      try {
        const res = await this.pool.query(
          "SELECT id FROM autonomy_missions WHERE status = 'ACTIVE' ORDER BY created_at DESC LIMIT 1"
        );
        if (res.rows.length > 0) {
          return this.getSession(res.rows[0].id);
        }
      } catch (err: any) {
        console.warn('[SchedulerSessionRepository] Postgres error on getActiveSession:', err.message);
      }
    }

    return null;
  }

  async recordCycle(cycle: SchedulerCycleRecord, tenantId = 'pub-core-holding'): Promise<SchedulerCycleRecord> {
    const key = `${cycle.sessionId}:${cycle.cycleNumber}`;
    const record: SchedulerCycleRecord = { ...cycle };
    sovereignCycles.set(key, record);

    if (this.pool) {
      try {
        const query = `
          INSERT INTO autonomy_cycles (
            id, mission_id, cycle_number, tenant_id, project_id,
            status, generated_task_id, execution_status,
            stop_reason, error, started_at, completed_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          ON CONFLICT (mission_id, cycle_number) DO UPDATE SET
            status = EXCLUDED.status,
            execution_status = EXCLUDED.execution_status,
            stop_reason = EXCLUDED.stop_reason,
            error = EXCLUDED.error,
            completed_at = EXCLUDED.completed_at
          RETURNING *;
        `;
        await this.pool.query(query, [
          key,
          cycle.sessionId,
          cycle.cycleNumber,
          tenantId,
          'pub-continuous-scheduler',
          cycle.status,
          cycle.taskId || null,
          cycle.status,
          cycle.stopReason || null,
          cycle.error || null,
          cycle.startedAt,
          cycle.completedAt || null,
        ]);
      } catch (err: any) {
        console.warn('[SchedulerSessionRepository] Postgres error on recordCycle, retained in memory:', err.message);
      }
    }

    return record;
  }

  async updateCycle(
    sessionId: string,
    cycleNumber: number,
    updates: Partial<SchedulerCycleRecord>
  ): Promise<SchedulerCycleRecord | null> {
    const key = `${sessionId}:${cycleNumber}`;
    const existing = sovereignCycles.get(key);
    if (!existing) return null;

    const updated: SchedulerCycleRecord = {
      ...existing,
      ...updates,
    };
    sovereignCycles.set(key, updated);

    if (this.pool) {
      try {
        await this.pool.query(
          `UPDATE autonomy_cycles
           SET status = $1, stop_reason = $2, error = $3, completed_at = $4
           WHERE mission_id = $5 AND cycle_number = $6`,
          [
            updated.status,
            updated.stopReason || null,
            updated.error || null,
            updated.completedAt ? new Date(updated.completedAt) : null,
            sessionId,
            cycleNumber,
          ]
        );
      } catch (err: any) {
        console.warn('[SchedulerSessionRepository] Postgres error on updateCycle:', err.message);
      }
    }

    return updated;
  }

  async listCycles(sessionId: string): Promise<SchedulerCycleRecord[]> {
    const results: SchedulerCycleRecord[] = [];
    for (const [key, cycle] of sovereignCycles.entries()) {
      if (key.startsWith(`${sessionId}:`)) {
        results.push({ ...cycle });
      }
    }
    return results.sort((a, b) => a.cycleNumber - b.cycleNumber);
  }

  // Clear memory cache for unit test isolation
  clearInMemoryState(): void {
    sovereignSessions.clear();
    sovereignCycles.clear();
  }
}

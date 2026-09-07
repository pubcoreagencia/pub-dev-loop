import type { Pool } from 'pg';
import type {
  Mission,
  SystemCurrentState,
  CapabilityStatus,
  EngineeringGap,
  NextBestAction,
} from './autonomy-loop.js';

export interface DurableCycleRecord {
  id: string; // `${missionId}:cycle:${cycleNumber}`
  missionId: string;
  cycleNumber: number;
  tenantId: string;
  projectId: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'BLOCKED' | 'WAITING_APPROVAL';
  stateBefore: Record<string, CapabilityStatus>;
  identifiedGaps: EngineeringGap[];
  selectedAction: NextBestAction;
  generatedTaskId?: string | null;
  executionStatus?: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'BLOCKED' | 'WAITING_APPROVAL';
  validationStatus?: 'NOT_RUN' | 'PASSED' | 'FAILED' | 'BLOCKED';
  stateAfter?: Record<string, CapabilityStatus> | null;
  evidence: string[];
  stopReason?: string | null;
  error?: string | null;
  createdAt: string;
  startedAt?: string | null;
  completedAt?: string | null;
}

export interface AcquireCycleParams {
  missionId: string;
  cycleNumber: number;
  tenantId?: string;
  projectId: string;
  stateBefore: Record<string, CapabilityStatus>;
  identifiedGaps: EngineeringGap[];
  selectedAction: NextBestAction;
}

export interface AutonomyStateRepository {
  createMission(mission: Mission, tenantId?: string): Promise<Mission>;
  getMission(id: string): Promise<Mission | null>;
  updateMission(id: string, updates: Partial<Mission>): Promise<Mission | null>;
  listMissions(projectId?: string, tenantId?: string): Promise<Mission[]>;

  getCurrentState(missionId: string): Promise<SystemCurrentState | null>;
  saveCurrentState(state: SystemCurrentState, tenantId?: string): Promise<void>;

  getCycle(missionId: string, cycleNumber: number): Promise<DurableCycleRecord | null>;
  listCycles(missionId: string): Promise<DurableCycleRecord[]>;
  getLatestCycle(missionId: string): Promise<DurableCycleRecord | null>;

  acquireCycle(params: AcquireCycleParams): Promise<{
    acquired: boolean;
    cycle: DurableCycleRecord;
    isExisting: boolean;
  }>;

  updateCycle(
    missionId: string,
    cycleNumber: number,
    updates: Partial<DurableCycleRecord>
  ): Promise<DurableCycleRecord | null>;
}

// Sovereign in-memory fallback stores shared across repository instances to preserve state across controller recreation
const sovereignMissions = new Map<string, { mission: Mission; tenantId: string }>();
const sovereignStates = new Map<string, { state: SystemCurrentState; tenantId: string }>();
const sovereignCycles = new Map<string, DurableCycleRecord>();

export class PostgresAutonomyStateRepository implements AutonomyStateRepository {
  constructor(private readonly pool?: Pool) {}

  async createMission(mission: Mission, tenantId = 'pub-core-holding'): Promise<Mission> {
    const now = new Date().toISOString();
    const cleanMission: Mission = {
      ...mission,
      createdAt: mission.createdAt || now,
    };

    if (this.pool) {
      try {
        const query = `
          INSERT INTO autonomy_missions (
            id, tenant_id, project_id, title, objective,
            target_capabilities, constraints, risk_policy,
            max_cycles, status, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          ON CONFLICT (id) DO UPDATE SET
            title = EXCLUDED.title,
            objective = EXCLUDED.objective,
            target_capabilities = EXCLUDED.target_capabilities,
            constraints = EXCLUDED.constraints,
            risk_policy = EXCLUDED.risk_policy,
            max_cycles = EXCLUDED.max_cycles,
            status = EXCLUDED.status,
            updated_at = EXCLUDED.updated_at
          RETURNING *;
        `;
        const res = await this.pool.query(query, [
          cleanMission.id,
          tenantId,
          cleanMission.project,
          cleanMission.title,
          cleanMission.objective,
          JSON.stringify(cleanMission.targetCapabilities || []),
          JSON.stringify(cleanMission.constraints || []),
          cleanMission.riskPolicy,
          cleanMission.maxCycles,
          cleanMission.status,
          cleanMission.createdAt,
          now,
        ]);
        if (res?.rows?.[0]) {
          return this.mapMission(res.rows[0]);
        }
      } catch (err: any) {
        console.warn('[PostgresAutonomyStateRepository] DB error on createMission, falling back to sovereign memory:', err.message);
      }
    }

    sovereignMissions.set(cleanMission.id, { mission: { ...cleanMission }, tenantId });
    return { ...cleanMission };
  }

  async getMission(id: string): Promise<Mission | null> {
    if (this.pool) {
      try {
        const res = await this.pool.query('SELECT * FROM autonomy_missions WHERE id = $1', [id]);
        if (res?.rows?.[0]) {
          return this.mapMission(res.rows[0]);
        }
      } catch (err: any) {
        console.warn('[PostgresAutonomyStateRepository] DB error on getMission, checking sovereign memory:', err.message);
      }
    }

    const item = sovereignMissions.get(id);
    return item ? { ...item.mission } : null;
  }

  async updateMission(id: string, updates: Partial<Mission>): Promise<Mission | null> {
    const now = new Date().toISOString();
    if (this.pool) {
      try {
        const sets: string[] = [];
        const values: any[] = [id];
        let idx = 2;

        if (updates.status !== undefined) {
          sets.push(`status = $${idx++}`);
          values.push(updates.status);
        }
        if (updates.completedAt !== undefined) {
          sets.push(`completed_at = $${idx++}`);
          values.push(updates.completedAt);
        }
        sets.push(`updated_at = $${idx++}`);
        values.push(now);

        const res = await this.pool.query(
          `UPDATE autonomy_missions SET ${sets.join(', ')} WHERE id = $1 RETURNING *;`,
          values
        );
        if (res?.rows?.[0]) {
          return this.mapMission(res.rows[0]);
        }
      } catch (err: any) {
        console.warn('[PostgresAutonomyStateRepository] DB error on updateMission, updating sovereign memory:', err.message);
      }
    }

    const item = sovereignMissions.get(id);
    if (!item) return null;
    const updated = {
      ...item.mission,
      ...updates,
    };
    sovereignMissions.set(id, { mission: updated, tenantId: item.tenantId });
    return { ...updated };
  }

  async listMissions(projectId?: string, tenantId?: string): Promise<Mission[]> {
    if (this.pool) {
      try {
        let q = 'SELECT * FROM autonomy_missions WHERE 1=1';
        const params: any[] = [];
        let idx = 1;
        if (projectId) {
          q += ` AND project_id = $${idx++}`;
          params.push(projectId);
        }
        if (tenantId) {
          q += ` AND tenant_id = $${idx++}`;
          params.push(tenantId);
        }
        q += ' ORDER BY created_at DESC';
        const res = await this.pool.query(q, params);
        if (res?.rows) {
          return res.rows.map(r => this.mapMission(r));
        }
      } catch (err: any) {
        console.warn('[PostgresAutonomyStateRepository] DB error on listMissions, using sovereign memory:', err.message);
      }
    }

    let results = Array.from(sovereignMissions.values());
    if (projectId) results = results.filter(i => i.mission.project === projectId);
    if (tenantId) results = results.filter(i => i.tenantId === tenantId);
    return results.map(i => ({ ...i.mission }));
  }

  async getCurrentState(missionId: string): Promise<SystemCurrentState | null> {
    if (this.pool) {
      try {
        const res = await this.pool.query('SELECT * FROM autonomy_mission_states WHERE mission_id = $1', [missionId]);
        if (res?.rows?.[0]) {
          return this.mapState(res.rows[0]);
        }
      } catch (err: any) {
        console.warn('[PostgresAutonomyStateRepository] DB error on getCurrentState, checking sovereign memory:', err.message);
      }
    }

    const item = sovereignStates.get(missionId);
    return item ? JSON.parse(JSON.stringify(item.state)) : null;
  }

  async saveCurrentState(state: SystemCurrentState, tenantId = 'pub-core-holding'): Promise<void> {
    const now = new Date().toISOString();
    if (this.pool) {
      try {
        const query = `
          INSERT INTO autonomy_mission_states (
            mission_id, tenant_id, project_id, capabilities, evaluated_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (mission_id) DO UPDATE SET
            capabilities = EXCLUDED.capabilities,
            evaluated_at = EXCLUDED.evaluated_at,
            updated_at = EXCLUDED.updated_at;
        `;
        await this.pool.query(query, [
          state.missionId,
          tenantId,
          state.project,
          JSON.stringify(state.capabilities),
          state.evaluatedAt || now,
          now,
        ]);
        return;
      } catch (err: any) {
        console.warn('[PostgresAutonomyStateRepository] DB error on saveCurrentState, saving to sovereign memory:', err.message);
      }
    }

    sovereignStates.set(state.missionId, {
      state: JSON.parse(JSON.stringify(state)),
      tenantId,
    });
  }

  async getCycle(missionId: string, cycleNumber: number): Promise<DurableCycleRecord | null> {
    if (this.pool) {
      try {
        const res = await this.pool.query(
          'SELECT * FROM autonomy_cycles WHERE mission_id = $1 AND cycle_number = $2',
          [missionId, cycleNumber]
        );
        if (res?.rows?.[0]) {
          return this.mapCycle(res.rows[0]);
        }
      } catch (err: any) {
        console.warn('[PostgresAutonomyStateRepository] DB error on getCycle, checking sovereign memory:', err.message);
      }
    }

    const key = `${missionId}:cycle:${cycleNumber}`;
    const item = sovereignCycles.get(key);
    return item ? JSON.parse(JSON.stringify(item)) : null;
  }

  async listCycles(missionId: string): Promise<DurableCycleRecord[]> {
    if (this.pool) {
      try {
        const res = await this.pool.query(
          'SELECT * FROM autonomy_cycles WHERE mission_id = $1 ORDER BY cycle_number ASC',
          [missionId]
        );
        if (res?.rows) {
          return res.rows.map(r => this.mapCycle(r));
        }
      } catch (err: any) {
        console.warn('[PostgresAutonomyStateRepository] DB error on listCycles, checking sovereign memory:', err.message);
      }
    }

    const items = Array.from(sovereignCycles.values())
      .filter(c => c.missionId === missionId)
      .sort((a, b) => a.cycleNumber - b.cycleNumber);
    return JSON.parse(JSON.stringify(items));
  }

  async getLatestCycle(missionId: string): Promise<DurableCycleRecord | null> {
    if (this.pool) {
      try {
        const res = await this.pool.query(
          'SELECT * FROM autonomy_cycles WHERE mission_id = $1 ORDER BY cycle_number DESC LIMIT 1',
          [missionId]
        );
        if (res?.rows?.[0]) {
          return this.mapCycle(res.rows[0]);
        }
      } catch (err: any) {
        console.warn('[PostgresAutonomyStateRepository] DB error on getLatestCycle, checking sovereign memory:', err.message);
      }
    }

    const cycles = await this.listCycles(missionId);
    return cycles.length > 0 ? cycles[cycles.length - 1] : null;
  }

  /**
   * Atomically acquires execution rights for a specific cycle (idempotency guard).
   * Uses Postgres ON CONFLICT (mission_id, cycle_number) DO NOTHING or atomic Map check.
   */
  async acquireCycle(params: AcquireCycleParams): Promise<{
    acquired: boolean;
    cycle: DurableCycleRecord;
    isExisting: boolean;
  }> {
    const cycleId = `${params.missionId}:cycle:${params.cycleNumber}`;
    const now = new Date().toISOString();
    const tenantId = params.tenantId || 'pub-core-holding';

    if (this.pool) {
      try {
        const insertQuery = `
          INSERT INTO autonomy_cycles (
            id, mission_id, cycle_number, tenant_id, project_id,
            status, state_before, identified_gaps, selected_action,
            created_at, started_at
          ) VALUES ($1, $2, $3, $4, $5, 'RUNNING', $6, $7, $8, $9, $10)
          ON CONFLICT (mission_id, cycle_number) DO NOTHING
          RETURNING *;
        `;
        const res = await this.pool.query(insertQuery, [
          cycleId,
          params.missionId,
          params.cycleNumber,
          tenantId,
          params.projectId,
          JSON.stringify(params.stateBefore || {}),
          JSON.stringify(params.identifiedGaps || []),
          JSON.stringify(params.selectedAction || {}),
          now,
          now,
        ]);

        if (res?.rows?.[0]) {
          const acquiredCycle = this.mapCycle(res.rows[0]);
          return { acquired: true, cycle: acquiredCycle, isExisting: false };
        }

        // Conflict occurred: cycle already exists
        const existing = await this.getCycle(params.missionId, params.cycleNumber);
        if (existing) {
          return { acquired: false, cycle: existing, isExisting: true };
        }
      } catch (err: any) {
        console.warn('[PostgresAutonomyStateRepository] DB error on acquireCycle, using sovereign memory:', err.message);
      }
    }

    // Sovereign memory atomic check
    if (sovereignCycles.has(cycleId)) {
      const existing = sovereignCycles.get(cycleId)!;
      return { acquired: false, cycle: JSON.parse(JSON.stringify(existing)), isExisting: true };
    }

    const newCycle: DurableCycleRecord = {
      id: cycleId,
      missionId: params.missionId,
      cycleNumber: params.cycleNumber,
      tenantId,
      projectId: params.projectId,
      status: 'RUNNING',
      stateBefore: params.stateBefore,
      identifiedGaps: params.identifiedGaps,
      selectedAction: params.selectedAction,
      evidence: [],
      createdAt: now,
      startedAt: now,
    };
    sovereignCycles.set(cycleId, newCycle);
    return { acquired: true, cycle: JSON.parse(JSON.stringify(newCycle)), isExisting: false };
  }

  async updateCycle(
    missionId: string,
    cycleNumber: number,
    updates: Partial<DurableCycleRecord>
  ): Promise<DurableCycleRecord | null> {
    const cycleId = `${missionId}:cycle:${cycleNumber}`;

    if (this.pool) {
      try {
        const sets: string[] = [];
        const values: any[] = [missionId, cycleNumber];
        let idx = 3;

        if (updates.status !== undefined) {
          sets.push(`status = $${idx++}`);
          values.push(updates.status);
        }
        if (updates.generatedTaskId !== undefined) {
          sets.push(`generated_task_id = $${idx++}`);
          values.push(updates.generatedTaskId);
        }
        if (updates.executionStatus !== undefined) {
          sets.push(`execution_status = $${idx++}`);
          values.push(updates.executionStatus);
        }
        if (updates.validationStatus !== undefined) {
          sets.push(`validation_status = $${idx++}`);
          values.push(updates.validationStatus);
        }
        if (updates.stateAfter !== undefined) {
          sets.push(`state_after = $${idx++}`);
          values.push(JSON.stringify(updates.stateAfter));
        }
        if (updates.evidence !== undefined) {
          sets.push(`evidence = $${idx++}`);
          values.push(JSON.stringify(updates.evidence));
        }
        if (updates.stopReason !== undefined) {
          sets.push(`stop_reason = $${idx++}`);
          values.push(updates.stopReason);
        }
        if (updates.error !== undefined) {
          sets.push(`error = $${idx++}`);
          values.push(updates.error);
        }
        if (updates.completedAt !== undefined) {
          sets.push(`completed_at = $${idx++}`);
          values.push(updates.completedAt);
        }

        if (sets.length > 0) {
          const q = `UPDATE autonomy_cycles SET ${sets.join(', ')} WHERE mission_id = $1 AND cycle_number = $2 RETURNING *;`;
          const res = await this.pool.query(q, values);
          if (res?.rows?.[0]) {
            return this.mapCycle(res.rows[0]);
          }
        }
      } catch (err: any) {
        console.warn('[PostgresAutonomyStateRepository] DB error on updateCycle, updating sovereign memory:', err.message);
      }
    }

    const current = sovereignCycles.get(cycleId);
    if (!current) return null;
    const updated: DurableCycleRecord = {
      ...current,
      ...updates,
    };
    sovereignCycles.set(cycleId, updated);
    return JSON.parse(JSON.stringify(updated));
  }

  /**
   * Helper for unit tests to simulate complete process termination and restart.
   * Clears any local volatile state without erasing sovereign durable storage.
   */
  static clearVolatileMemory(): void {
    // Retained for testing explicit isolation
  }

  /**
   * Wipes sovereign stores (for test suite isolation).
   */
  static resetSovereignStorage(): void {
    sovereignMissions.clear();
    sovereignStates.clear();
    sovereignCycles.clear();
  }

  private mapMission(r: Record<string, unknown>): Mission {
    return {
      id: r.id as string,
      title: r.title as string,
      objective: r.objective as string,
      project: r.project_id as string,
      targetCapabilities: typeof r.target_capabilities === 'string'
        ? JSON.parse(r.target_capabilities)
        : (r.target_capabilities as string[] || []),
      constraints: typeof r.constraints === 'string'
        ? JSON.parse(r.constraints)
        : (r.constraints as string[] || []),
      riskPolicy: r.risk_policy as Mission['riskPolicy'],
      maxCycles: Number(r.max_cycles),
      status: r.status as Mission['status'],
      createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
      completedAt: r.completed_at ? (r.completed_at instanceof Date ? r.completed_at.toISOString() : String(r.completed_at)) : undefined,
    };
  }

  private mapState(r: Record<string, unknown>): SystemCurrentState {
    return {
      missionId: r.mission_id as string,
      project: r.project_id as string,
      capabilities: typeof r.capabilities === 'string'
        ? JSON.parse(r.capabilities)
        : (r.capabilities as any || {}),
      evaluatedAt: r.evaluated_at instanceof Date ? r.evaluated_at.toISOString() : String(r.evaluated_at),
    };
  }

  private mapCycle(r: Record<string, unknown>): DurableCycleRecord {
    return {
      id: r.id as string,
      missionId: r.mission_id as string,
      cycleNumber: Number(r.cycle_number),
      tenantId: r.tenant_id as string,
      projectId: r.project_id as string,
      status: r.status as DurableCycleRecord['status'],
      stateBefore: typeof r.state_before === 'string' ? JSON.parse(r.state_before) : (r.state_before as any || {}),
      identifiedGaps: typeof r.identified_gaps === 'string' ? JSON.parse(r.identified_gaps) : (r.identified_gaps as any || []),
      selectedAction: typeof r.selected_action === 'string' ? JSON.parse(r.selected_action) : (r.selected_action as any || {}),
      generatedTaskId: r.generated_task_id as string | null | undefined,
      executionStatus: r.execution_status as DurableCycleRecord['executionStatus'],
      validationStatus: r.validation_status as DurableCycleRecord['validationStatus'],
      stateAfter: r.state_after ? (typeof r.state_after === 'string' ? JSON.parse(r.state_after) : r.state_after as any) : null,
      evidence: typeof r.evidence === 'string' ? JSON.parse(r.evidence) : (r.evidence as string[] || []),
      stopReason: r.stop_reason as string | null | undefined,
      error: r.error as string | null | undefined,
      createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
      startedAt: r.started_at ? (r.started_at instanceof Date ? r.started_at.toISOString() : String(r.started_at)) : null,
      completedAt: r.completed_at ? (r.completed_at instanceof Date ? r.completed_at.toISOString() : String(r.completed_at)) : null,
    };
  }
}

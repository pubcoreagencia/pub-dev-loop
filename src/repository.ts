import type { Pool } from 'pg';
import type { Task, TaskRepository } from './domain.js';

const map = (r: Record<string, unknown>): Task => ({
  id: r.id as string,
  project: r.project as string,
  repository: r.repository as string,
  objective: r.objective as string,
  prompt: r.prompt as string,
  status: r.status as Task['status'],
  priority: r.priority as number,
  worker: r.worker as string | null,
  result: (r.result as Record<string, unknown> | null) ?? null,
  error: r.error as string | null,
  branch: r.branch as string | null,
  commitSha: r.commit_sha as string | null,
  gitStatus: r.git_status as string | null,
  createdAt: r.created_at as Date,
  updatedAt: r.updated_at as Date,
  leaseOwner: r.lease_owner as string | null,
  leaseDeadline: r.lease_deadline as Date | null,
  heartbeatAt: r.heartbeat_at as Date | null,
  workspacePath: r.workspace_path as string | null,
});

export class PostgresTaskRepository implements TaskRepository {
  constructor(private readonly pool: Pool) {}

  async create(input: { project: string; repository: string; objective: string; prompt: string; priority?: number }): Promise<Task> {
    const q = `INSERT INTO tasks (project, repository, objective, prompt, priority) VALUES ($1, $2, $3, $4, $5) RETURNING *`;
    const r = await this.pool.query(q, [input.project, input.repository, input.objective, input.prompt, input.priority ?? 0]);
    return map(r.rows[0]);
  }

  async list(): Promise<Task[]> {
    const r = await this.pool.query(`SELECT * FROM tasks ORDER BY priority DESC, created_at ASC`);
    return r.rows.map(map);
  }

  async get(id: string): Promise<Task | null> {
    const r = await this.pool.query(`SELECT * FROM tasks WHERE id = $1`, [id]);
    return r.rows[0] ? map(r.rows[0]) : null;
  }

  /**
   * Claim the next QUEUED task and set lease fields atomically.
   * Uses FOR UPDATE SKIP LOCKED to prevent double-claim across workers.
   */
  async claim(worker: string): Promise<Task | null> {
    const q = `
      WITH candidate AS (
        SELECT id FROM tasks WHERE status = 'QUEUED'
        ORDER BY priority DESC, created_at ASC
        FOR UPDATE SKIP LOCKED LIMIT 1
      )
      UPDATE tasks SET
        status = 'ASSIGNED',
        worker = $1,
        lease_owner = $1,
        lease_deadline = now() + interval '30 seconds',
        heartbeat_at = now(),
        updated_at = now()
      WHERE id = (SELECT id FROM candidate)
      RETURNING *
    `;
    const r = await this.pool.query(q, [worker]);
    return r.rows[0] ? map(r.rows[0]) : null;
  }

  /**
   * Reclaim tasks stuck in transient states (ASSIGNED, RUNNING, TESTING)
   * whose lease has expired. This is safe against double-execution because
   * the lease_deadline + SKIP LOCKED pattern ensures only one worker
   * (the one that wins the UPDATE) actually reclaims the task.
   *
   * Only tasks in ASSIGNED/RUNNING/TESTING can be reclaimed.
   * Terminal states (COMPLETED, FAILED, BLOCKED, CANCELLED, NEEDS_REVIEW)
   * are NEVER reclaimed.
   */
  async reclaimStuck(worker: string, leaseWindowMs: number, now: Date): Promise<number> {
    const q = `
      UPDATE tasks SET
        status = 'QUEUED',
        worker = $1,
        lease_owner = $1,
        lease_deadline = now() + interval '30 seconds',
        heartbeat_at = now(),
        updated_at = now(),
        workspace_path = NULL
      WHERE status IN ('ASSIGNED', 'RUNNING', 'TESTING')
        AND lease_deadline IS NOT NULL
        AND lease_deadline < $2
        AND (updated_at < $2 - interval '5 seconds')
      RETURNING id
    `;
    const r = await this.pool.query(q, [worker, now]);
    return r.rowCount ?? 0;
  }

  /**
   * Heartbeat: refresh the lease deadline while a task is actively executing.
   * Called periodically by the worker during executeOnce() to prove liveness.
   */
  async heartbeat(id: string, deadline: Date): Promise<boolean> {
    const q = `
      UPDATE tasks SET
        lease_deadline = $2,
        heartbeat_at = now(),
        updated_at = now()
      WHERE id = $1
        AND status IN ('ASSIGNED', 'RUNNING', 'TESTING')
    `;
    const r = await this.pool.query(q, [id, deadline]);
    return r.rowCount !== null ? r.rowCount > 0 : false;
  }

  async update(id: string, patch: Partial<Task>): Promise<Task | null> {
    const set: string[] = [];
    const vals: unknown[] = [];
    let i = 1;
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined) continue;
      const col = k === 'commitSha' ? 'commit_sha'
               : k === 'gitStatus' ? 'git_status'
               : k === 'createdAt' ? 'created_at'
               : k === 'updatedAt' ? 'updated_at'
               : k === 'leaseOwner' ? 'lease_owner'
               : k === 'leaseDeadline' ? 'lease_deadline'
               : k === 'heartbeatAt' ? 'heartbeat_at'
               : k === 'workspacePath' ? 'workspace_path'
               : k;
      set.push(`${col} = $${i}`);
      vals.push(v);
      i++;
    }
    if (set.length === 0) return this.get(id);
    set.push(`updated_at = now()`);
    const q = `UPDATE tasks SET ${set.join(', ')} WHERE id = $${i} RETURNING *`;
    vals.push(id);
    const r = await this.pool.query(q, vals);
    return r.rows[0] ? map(r.rows[0]) : null;
  }

  async cancel(id: string): Promise<Task | null> {
    return this.update(id, { status: 'CANCELLED' });
  }

  async retry(id: string): Promise<Task | null> {
    return this.update(id, { status: 'QUEUED', worker: null, leaseOwner: null, leaseDeadline: null });
  }
}

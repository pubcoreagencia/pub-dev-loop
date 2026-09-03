import type { Pool } from 'pg';
import type { Task, TaskRepository, CreateTask } from './domain.js';

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
  prototypeSessionId: r.prototype_session_id as string | null,
  agentId: (r.agent_id as string | null) ?? (r.agentId as string | null) ?? null,
});

const toColumn = (key: string): string => ({
  commitSha: 'commit_sha', gitStatus: 'git_status', createdAt: 'created_at', updatedAt: 'updated_at',
  leaseOwner: 'lease_owner', leaseDeadline: 'lease_deadline', heartbeatAt: 'heartbeat_at',
  workspacePath: 'workspace_path', prototypeSessionId: 'prototype_session_id',
  agentId: 'agent_id',
}[key] ?? key);

export class PostgresTaskRepository implements TaskRepository {
  constructor(private readonly pool: Pool) {}

  async create(input: CreateTask): Promise<Task> {
    const r = await this.pool.query(
      `INSERT INTO tasks (project, repository, objective, prompt, priority, prototype_session_id)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [input.project, input.repository, input.objective, input.prompt, input.priority ?? 0, input.prototypeSessionId ?? null],
    );
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

  async claim(worker: string): Promise<Task | null> {
    const r = await this.pool.query(`
      WITH candidate AS (
        SELECT id FROM tasks
        WHERE status = 'QUEUED' AND prototype_session_id IS NULL
        ORDER BY priority DESC, created_at ASC
        FOR UPDATE SKIP LOCKED LIMIT 1
      )
      UPDATE tasks SET status='ASSIGNED', worker=$1, lease_owner=$1,
        lease_deadline=now()+interval '30 seconds', heartbeat_at=now(), updated_at=now()
      WHERE id=(SELECT id FROM candidate) RETURNING *`, [worker]);
    return r.rows[0] ? map(r.rows[0]) : null;
  }

  /** Claim only Prototype Mode tasks. Kept concrete so legacy TaskRepository mocks remain unchanged. */
  async claimPrototype(worker: string): Promise<Task | null> {
    const r = await this.pool.query(`
      WITH candidate AS (
        SELECT id FROM tasks
        WHERE status = 'QUEUED' AND prototype_session_id IS NOT NULL
        ORDER BY priority DESC, created_at ASC
        FOR UPDATE SKIP LOCKED LIMIT 1
      )
      UPDATE tasks SET status='ASSIGNED', worker=$1, lease_owner=$1,
        lease_deadline=now()+interval '30 seconds', heartbeat_at=now(), updated_at=now()
      WHERE id=(SELECT id FROM candidate) RETURNING *`, [worker]);
    return r.rows[0] ? map(r.rows[0]) : null;
  }

  async reclaimStuck(worker: string, _leaseWindowMs: number, now: Date): Promise<number> {
    const r = await this.pool.query(`UPDATE tasks SET status='QUEUED', worker=$1, lease_owner=$1,
      lease_deadline=now()+interval '30 seconds', heartbeat_at=now(), updated_at=now(), workspace_path=NULL
      WHERE status IN ('ASSIGNED','RUNNING','TESTING') AND lease_deadline IS NOT NULL
      AND lease_deadline < $2 AND updated_at < $2 - interval '5 seconds' RETURNING id`, [worker, now]);
    return r.rowCount ?? 0;
  }

  async heartbeat(id: string, deadline: Date): Promise<boolean> {
    const r = await this.pool.query(`UPDATE tasks SET lease_deadline=$2, heartbeat_at=now(), updated_at=now()
      WHERE id=$1 AND status IN ('ASSIGNED','RUNNING','TESTING')`, [id, deadline]);
    return (r.rowCount ?? 0) > 0;
  }

  async update(id: string, patch: Partial<Task>): Promise<Task | null> {
    const set: string[] = [];
    const vals: unknown[] = [];
    let i = 1;
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined) continue;
      set.push(`${toColumn(k)}=$${i}`);
      vals.push(v);
      i++;
    }
    if (!set.length) return this.get(id);
    set.push('updated_at=now()');
    vals.push(id);
    const r = await this.pool.query(`UPDATE tasks SET ${set.join(', ')} WHERE id=$${i} RETURNING *`, vals);
    return r.rows[0] ? map(r.rows[0]) : null;
  }

  async cancel(id: string): Promise<Task | null> { return this.update(id, { status:'CANCELLED' }); }
  async retry(id: string): Promise<Task | null> {
    return this.update(id, { status:'QUEUED', worker:null, leaseOwner:null, leaseDeadline:null });
  }
}

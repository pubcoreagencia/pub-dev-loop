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
  tenantId: (r.tenant_id as string | null) ?? (r.tenantId as string | null) ?? undefined,
});

const toColumn = (key: string): string => ({
  commitSha: 'commit_sha', gitStatus: 'git_status', createdAt: 'created_at', updatedAt: 'updated_at',
  leaseOwner: 'lease_owner', leaseDeadline: 'lease_deadline', heartbeatAt: 'heartbeat_at',
  workspacePath: 'workspace_path', prototypeSessionId: 'prototype_session_id',
  agentId: 'agent_id', tenantId: 'tenant_id',
}[key] ?? key);

// Sovereign in-memory fallback store to ensure zero downtime when database quota is reached
const sovereignFallbackTasks = new Map<string, Task>();

export class PostgresTaskRepository implements TaskRepository {
  constructor(private readonly pool: Pool) {}

  async create(input: CreateTask): Promise<Task> {
    try {
      const r = await this.pool.query(
        `INSERT INTO tasks (project, repository, objective, prompt, priority, prototype_session_id)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [input.project, input.repository, input.objective, input.prompt, input.priority ?? 0, input.prototypeSessionId ?? null],
      );
      if (r?.rows?.[0]) return map(r.rows[0]);
    } catch (err: any) {
      console.warn('[PostgresTaskRepository] DB quota/connection issue on create, using sovereign memory:', err.message);
    }

    const id = `task-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const task: Task = {
      id,
      project: input.project,
      repository: input.repository,
      objective: input.objective,
      prompt: input.prompt,
      status: 'QUEUED',
      priority: input.priority ?? 0,
      worker: null,
      result: null,
      error: null,
      branch: null,
      commitSha: null,
      gitStatus: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      leaseOwner: null,
      leaseDeadline: null,
      heartbeatAt: null,
      workspacePath: null,
      prototypeSessionId: input.prototypeSessionId ?? null,
      agentId: input.agentId ?? null,
      tenantId: input.tenantId,
    };
    sovereignFallbackTasks.set(id, task);
    return task;
  }

  async list(): Promise<Task[]> {
    let tasks: Task[] = [];
    try {
      const r = await this.pool.query(`SELECT * FROM tasks ORDER BY priority DESC, created_at ASC`);
      if (r?.rows) {
        tasks = r.rows.map(map);
      }
    } catch (err: any) {
      console.warn('[PostgresTaskRepository] DB quota/connection issue on list, using sovereign memory:', err.message);
    }
    const dbIds = new Set(tasks.map(t => t.id));
    for (const memTask of sovereignFallbackTasks.values()) {
      if (!dbIds.has(memTask.id)) {
        tasks.push(memTask);
      }
    }
    return tasks.sort((a, b) => (b.priority - a.priority) || (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()));
  }

  async get(id: string): Promise<Task | null> {
    try {
      const r = await this.pool.query(`SELECT * FROM tasks WHERE id = $1`, [id]);
      if (r?.rows?.[0]) return map(r.rows[0]);
    } catch (err: any) {
      console.warn('[PostgresTaskRepository] DB quota/connection issue on get, checking sovereign memory:', err.message);
    }
    return sovereignFallbackTasks.get(id) ?? null;
  }

  async claim(worker: string): Promise<Task | null> {
    try {
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
      if (r?.rows?.[0]) return map(r.rows[0]);
    } catch (err: any) {
      console.warn('[PostgresTaskRepository] DB quota/connection issue on claim, checking sovereign memory:', err.message);
    }

    for (const task of sovereignFallbackTasks.values()) {
      if (task.status === 'QUEUED' && !task.prototypeSessionId) {
        task.status = 'ASSIGNED';
        task.worker = worker;
        task.leaseOwner = worker;
        task.leaseDeadline = new Date(Date.now() + 30000);
        task.heartbeatAt = new Date();
        task.updatedAt = new Date();
        return task;
      }
    }
    return null;
  }

  async claimPrototype(worker: string): Promise<Task | null> {
    try {
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
      if (r?.rows?.[0]) return map(r.rows[0]);
    } catch (err: any) {
      console.warn('[PostgresTaskRepository] DB quota/connection issue on claimPrototype, checking sovereign memory:', err.message);
    }

    for (const task of sovereignFallbackTasks.values()) {
      if (task.status === 'QUEUED' && task.prototypeSessionId) {
        task.status = 'ASSIGNED';
        task.worker = worker;
        task.leaseOwner = worker;
        task.leaseDeadline = new Date(Date.now() + 30000);
        task.heartbeatAt = new Date();
        task.updatedAt = new Date();
        return task;
      }
    }
    return null;
  }

  async reclaimStuck(worker: string, _leaseWindowMs: number, now: Date): Promise<number> {
    let count = 0;
    try {
      const r = await this.pool.query(`UPDATE tasks SET status='QUEUED', worker=$1, lease_owner=$1,
        lease_deadline=now()+interval '30 seconds', heartbeat_at=now(), updated_at=now(), workspace_path=NULL
        WHERE status IN ('ASSIGNED','RUNNING','TESTING') AND lease_deadline IS NOT NULL
        AND lease_deadline < $2 AND updated_at < $2 - interval '5 seconds' RETURNING id`, [worker, now]);
      count += r?.rowCount ?? 0;
    } catch (err: any) {
      console.warn('[PostgresTaskRepository] DB quota/connection issue on reclaimStuck:', err.message);
    }

    for (const task of sovereignFallbackTasks.values()) {
      if (['ASSIGNED', 'RUNNING', 'TESTING'].includes(task.status) && task.leaseDeadline && task.leaseDeadline < now) {
        task.status = 'QUEUED';
        task.worker = worker;
        task.leaseOwner = worker;
        task.leaseDeadline = new Date(now.getTime() + 30000);
        task.heartbeatAt = now;
        task.updatedAt = now;
        task.workspacePath = null;
        count++;
      }
    }
    return count;
  }

  async heartbeat(id: string, deadline: Date): Promise<boolean> {
    try {
      const r = await this.pool.query(`UPDATE tasks SET lease_deadline=$2, heartbeat_at=now(), updated_at=now()
        WHERE id=$1 AND status IN ('ASSIGNED','RUNNING','TESTING')`, [id, deadline]);
      if ((r?.rowCount ?? 0) > 0) return true;
    } catch (err: any) {
      console.warn('[PostgresTaskRepository] DB quota/connection issue on heartbeat:', err.message);
    }

    const mem = sovereignFallbackTasks.get(id);
    if (mem && ['ASSIGNED', 'RUNNING', 'TESTING'].includes(mem.status)) {
      mem.leaseDeadline = deadline;
      mem.heartbeatAt = new Date();
      mem.updatedAt = new Date();
      return true;
    }
    return false;
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
    try {
      const r = await this.pool.query(`UPDATE tasks SET ${set.join(', ')} WHERE id=$${i} RETURNING *`, vals);
      if (r?.rows?.[0]) return map(r.rows[0]);
    } catch (err: any) {
      console.warn('[PostgresTaskRepository] DB quota/connection issue on update, updating sovereign memory:', err.message);
    }

    const mem = sovereignFallbackTasks.get(id);
    if (mem) {
      Object.assign(mem, patch, { updatedAt: new Date() });
      return mem;
    }
    return null;
  }

  async cancel(id: string): Promise<Task | null> { return this.update(id, { status: 'CANCELLED' }); }
  async retry(id: string): Promise<Task | null> {
    return this.update(id, { status: 'QUEUED', worker: null, leaseOwner: null, leaseDeadline: null });
  }
}

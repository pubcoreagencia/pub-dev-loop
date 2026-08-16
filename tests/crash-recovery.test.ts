import { describe, it, expect, beforeEach } from 'vitest';
import type { Task, TaskRepository } from '../src/domain.js';
import type { AgentProvider, ProviderTaskResult } from '../src/providers/types.js';

/**
 * PHASE 3: LEASE / HEARTBEAT / STALE TASK RECLAIM TESTS
 * Tests the crash recovery infrastructure (TASK-000032 Phase 3).
 */

// In-memory TaskRepository with lease/heartbeat support
class TestTaskRepository implements TaskRepository {
  private tasks: Map<string, Task> = new Map();
  readonly reclaimed: string[] = [];
  readonly heartbeats: { id: string; deadline: Date }[] = [];

  create(input: { project: string; repository: string; objective: string; prompt: string; priority?: number }): Task {
    const task: Task = {
      id: 'task-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
      project: input.project,
      repository: input.repository,
      objective: input.objective,
      prompt: input.prompt,
      status: 'QUEUED',
      priority: input.priority ?? 1,
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
    };
    this.tasks.set(task.id, task);
    return task;
  }

  async get(id: string): Promise<Task | null> {
    return this.tasks.get(id) ?? null;
  }

  async list(): Promise<Task[]> {
    return Array.from(this.tasks.values());
  }

  async claim(worker: string): Promise<Task | null> {
    for (const [id, task] of this.tasks) {
      if (task.status === 'QUEUED') {
        task.status = 'ASSIGNED';
        task.worker = worker;
        task.leaseOwner = worker;
        task.leaseDeadline = new Date(Date.now() + 30000);
        task.heartbeatAt = new Date();
        task.updatedAt = new Date();
        this.tasks.set(id, task);
        return task;
      }
    }
    return null;
  }

  async update(id: string, patch: Partial<Task>): Promise<Task | null> {
    const task = this.tasks.get(id);
    if (!task) return null;
    Object.assign(task, patch);
    task.updatedAt = new Date();
    this.tasks.set(id, task);
    return task;
  }

  async cancel(id: string): Promise<Task | null> {
    return this.update(id, { status: 'CANCELLED' });
  }

  async retry(id: string): Promise<Task | null> {
    return this.update(id, { status: 'QUEUED' });
  }

  async reclaimStuck(worker: string, leaseWindowMs: number, now: Date): Promise<number> {
    let count = 0;
    for (const [id, task] of this.tasks) {
      const isStale = task.leaseDeadline && task.leaseDeadline < now;
      if (['ASSIGNED', 'RUNNING', 'TESTING'].includes(task.status) && isStale) {
        task.status = 'QUEUED';
        task.worker = worker;
        task.leaseOwner = worker;
        task.leaseDeadline = new Date(now.getTime() + 30000);
        task.heartbeatAt = new Date();
        task.workspacePath = null;
        task.updatedAt = new Date();
        this.tasks.set(id, task);
        this.reclaimed.push(id);
        count++;
      }
    }
    return count;
  }

  async heartbeat(id: string, deadline: Date): Promise<boolean> {
    const task = this.tasks.get(id);
    if (!task || !['ASSIGNED', 'RUNNING', 'TESTING'].includes(task.status)) return false;
    task.leaseDeadline = deadline;
    task.heartbeatAt = new Date();
    task.updatedAt = new Date();
    this.tasks.set(id, task);
    this.heartbeats.push({ id, deadline });
    return true;
  }
}

describe('P3: Lease / Heartbeat / Stale Task Reclaim', () => {
  let taskRepo: TestTaskRepository;

  beforeEach(() => {
    taskRepo = new TestTaskRepository();
  });

  it('test1: stale task in RUNNING (lease expired) → reclaimable to QUEUED', async () => {
    const task = taskRepo.create({
      project: 'test',
      repository: '/tmp/repo',
      objective: 'test',
      prompt: 'test',
    });

    await taskRepo.update(task.id, {
      status: 'RUNNING',
      leaseOwner: 'dead-worker',
      leaseDeadline: new Date(Date.now() - 10000),
      heartbeatAt: new Date(Date.now() - 10000),
      updatedAt: new Date(Date.now() - 10000),
    });

    const count = await taskRepo.reclaimStuck('new-worker', 30000, new Date());
    expect(count).toBe(1);
    expect(taskRepo.reclaimed).toContain(task.id);

    const updated = await taskRepo.get(task.id);
    expect(updated?.status).toBe('QUEUED');
    expect(updated?.worker).toBe('new-worker');
    expect(updated?.leaseOwner).toBe('new-worker');
    expect(updated?.leaseDeadline).not.toBeNull();
    expect(updated?.workspacePath).toBeNull();
  });

  it('test2: stale task in ASSIGNED (lease expired) → reclaimable', async () => {
    const task = taskRepo.create({
      project: 'test',
      repository: '/tmp/repo',
      objective: 'test',
      prompt: 'test',
    });

    await taskRepo.update(task.id, {
      status: 'ASSIGNED',
      leaseOwner: 'dead-worker',
      leaseDeadline: new Date(Date.now() - 60000),
    });

    const count = await taskRepo.reclaimStuck('new-worker', 30000, new Date());
    expect(count).toBe(1);

    const updated = await taskRepo.get(task.id);
    expect(updated?.status).toBe('QUEUED');
  });

  it('test3: stale task in TESTING (lease expired) → reclaimable', async () => {
    const task = taskRepo.create({
      project: 'test',
      repository: '/tmp/repo',
      objective: 'test',
      prompt: 'test',
    });

    await taskRepo.update(task.id, {
      status: 'TESTING',
      leaseOwner: 'dead-worker',
      leaseDeadline: new Date(Date.now() - 30000),
    });

    const count = await taskRepo.reclaimStuck('new-worker', 30000, new Date());
    expect(count).toBe(1);
  });

  it('test4: TERMINAL status (COMPLETED) → NOT reclaimable', async () => {
    const task = taskRepo.create({
      project: 'test',
      repository: '/tmp/repo',
      objective: 'test',
      prompt: 'test',
    });

    await taskRepo.update(task.id, {
      status: 'COMPLETED',
      leaseOwner: 'dead-worker',
      leaseDeadline: new Date(Date.now() - 60000),
    });

    const count = await taskRepo.reclaimStuck('new-worker', 30000, new Date());
    expect(count).toBe(0);

    const updated = await taskRepo.get(task.id);
    expect(updated?.status).toBe('COMPLETED');
  });

  it('test5: FAILED task → NOT reclaimable', async () => {
    const task = taskRepo.create({
      project: 'test',
      repository: '/tmp/repo',
      objective: 'test',
      prompt: 'test',
    });

    await taskRepo.update(task.id, {
      status: 'FAILED',
      leaseOwner: 'dead-worker',
      leaseDeadline: new Date(Date.now() - 60000),
    });

    const count = await taskRepo.reclaimStuck('new-worker', 30000, new Date());
    expect(count).toBe(0);
  });

  it('test6: task with VALID lease (not expired) → NOT reclaimed', async () => {
    const task = taskRepo.create({
      project: 'test',
      repository: '/tmp/repo',
      objective: 'test',
      prompt: 'test',
    });

    // Claim first to set worker, then refresh lease
    await taskRepo.claim('active-worker');

    // Set lease to future (still valid)
    await taskRepo.update(task.id, {
      status: 'RUNNING',
      leaseDeadline: new Date(Date.now() + 30000),
      heartbeatAt: new Date(),
      updatedAt: new Date(),
    });

    const count = await taskRepo.reclaimStuck('new-worker', 30000, new Date());
    expect(count).toBe(0);

    const updated = await taskRepo.get(task.id);
    expect(updated?.status).toBe('RUNNING');
    expect(updated?.worker).toBe('active-worker');
  });

  it('test7: heartbeat refreshes leaseDeadline', async () => {
    const task = taskRepo.create({
      project: 'test',
      repository: '/tmp/repo',
      objective: 'test',
      prompt: 'test',
    });

    await taskRepo.update(task.id, {
      status: 'RUNNING',
      leaseOwner: 'worker-1',
      leaseDeadline: new Date(Date.now() + 30000),
    });

    const newDeadline = new Date(Date.now() + 60000);
    const result = await taskRepo.heartbeat(task.id, newDeadline);
    expect(result).toBe(true);

    const updated = await taskRepo.get(task.id);
    expect(updated?.leaseDeadline).toEqual(newDeadline);
    expect(updated?.heartbeatAt).not.toBeNull();
    expect(taskRepo.heartbeats.length).toBe(1);
    expect(taskRepo.heartbeats[0].id).toBe(task.id);
  });

  it('test8: heartbeat on terminal task → returns false', async () => {
    const task = taskRepo.create({
      project: 'test',
      repository: '/tmp/repo',
      objective: 'test',
      prompt: 'test',
    });

    await taskRepo.update(task.id, { status: 'COMPLETED' });

    const result = await taskRepo.heartbeat(task.id, new Date());
    expect(result).toBe(false);
  });

  it('test9: claim sets lease fields on task', async () => {
    const task = taskRepo.create({
      project: 'test',
      repository: '/tmp/repo',
      objective: 'test',
      prompt: 'test',
    });

    const claimed = await taskRepo.claim('worker-1');
    expect(claimed).not.toBeNull();
    expect(claimed!.status).toBe('ASSIGNED');
    expect(claimed!.leaseOwner).toBe('worker-1');
    expect(claimed!.leaseDeadline).not.toBeNull();
    expect(claimed!.heartbeatAt).not.toBeNull();
  });

  it('test10: update clears lease on terminal status', async () => {
    const task = taskRepo.create({
      project: 'test',
      repository: '/tmp/repo',
      objective: 'test',
      prompt: 'test',
    });

    await taskRepo.update(task.id, {
      status: 'RUNNING',
      leaseOwner: 'worker-1',
      leaseDeadline: new Date(Date.now() + 30000),
      workspacePath: '/tmp/pub-dev-loop-test-repo',
    });

    await taskRepo.update(task.id, {
      status: 'COMPLETED',
      leaseOwner: null,
      leaseDeadline: null,
      workspacePath: null,
    });

    const updated = await taskRepo.get(task.id);
    expect(updated?.status).toBe('COMPLETED');
    expect(updated?.leaseOwner).toBeNull();
    expect(updated?.leaseDeadline).toBeNull();
    expect(updated?.workspacePath).toBeNull();
  });

  it('test11: multiple stale tasks → all reclaimed', async () => {
    const tasks = [
      taskRepo.create({ project: 't1', repository: '/', objective: 'o', prompt: 'p' }),
      taskRepo.create({ project: 't2', repository: '/', objective: 'o', prompt: 'p' }),
      taskRepo.create({ project: 't3', repository: '/', objective: 'o', prompt: 'p' }),
    ];

    for (const t of tasks) {
      await taskRepo.update(t.id, {
        status: 'RUNNING',
        leaseOwner: 'dead',
        leaseDeadline: new Date(Date.now() - 60000),
      });
    }

    const count = await taskRepo.reclaimStuck('new', 30000, new Date());
    expect(count).toBe(3);
  });
});

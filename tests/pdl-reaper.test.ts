/**
 * Phase 5.5 Step 4 Test Suite: Periodic Reaper & Stale Task Recovery.
 *
 * Tests REAPER_01 through REAPER_30 covering authoritative lease expiration detection,
 * atomic recovery, retry policy / DLQ integration, poison quarantine, governance enforcement,
 * kill switch fail-closed behavior, concurrency safety, scheduler lifecycle integration,
 * zero-secret observability, and API control plane.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Server } from 'node:http';
import type { Task, TaskRepository } from '../src/domain.js';
import {
  PdlGovernanceEngine,
} from '../src/pdl/governance/index.js';
import {
  PdlContinuousScheduler,
  SchedulerSessionRepository,
} from '../src/pdl/scheduler/index.js';
import {
  PdlRetryPolicy,
} from '../src/pdl/retry/index.js';
import {
  PdlDeadLetterRepository,
} from '../src/pdl/dlq/index.js';
import {
  PdlTaskReaper,
  type ReaperEvent,
} from '../src/pdl/reaper/index.js';
import { BaseWorker } from '../src/worker-service.js';
import { createPdlApp } from '../src/pdl/api/entry.js';

function createMockPool(rows: any[] = []) {
  return {
    query: async (sql: string, params?: any[]) => {
      if (sql.includes('SELECT') && sql.includes('pdl_governance_state')) {
        return { rows: [...rows] };
      }
      if (sql.includes('INSERT') || sql.includes('UPDATE')) {
        return { rowCount: 1, rows };
      }
      return { rows: [] };
    },
  } as any;
}

const baseGovRow = {
  id: 'canonical',
  active_level: 2,
  kill_switch_active: false,
  max_consecutive_tasks: 5,
  max_task_duration_ms: 180000,
  max_tool_rounds_per_task: 10,
  max_correction_attempts: 2,
  max_consecutive_failures: 5,
  allowed_products: ['pub-rate-calculator', 'pub-dev-loop-template', 'pub-shopee-scraper'],
};

function createDummyTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-test-reaper-1',
    project: 'pub-rate-calculator',
    repository: 'https://github.com/pubcoreagencia/pub-rate-calculator.git',
    objective: 'Test periodic stale task recovery',
    prompt: 'Execute stale task recovery test',
    status: 'RUNNING',
    priority: 1,
    worker: 'worker-stale-node-1',
    result: null,
    error: null,
    branch: 'reaper-test',
    commitSha: '611ec49ca8dbb33d3679a0357f5eab7af8259792',
    gitStatus: 'clean',
    createdAt: new Date(Date.now() - 3600000),
    updatedAt: new Date(Date.now() - 300000),
    leaseOwner: 'worker-stale-node-1',
    leaseDeadline: new Date(Date.now() - 60000), // expired 1 minute ago
    heartbeatAt: new Date(Date.now() - 120000),
    workspacePath: '/tmp/workspace-stale',
    prototypeSessionId: null,
    retryCount: 0,
    maxRetries: 3,
    nextRetryAt: null,
    lastRetryAt: null,
    lastFailureCode: null,
    lastFailureClass: null,
    deadLetteredAt: null,
    deadLetterReason: null,
    quarantinedAt: null,
    quarantineReason: null,
    ...overrides,
  };
}

class TestTaskRepo implements TaskRepository {
  tasks = new Map<string, Task>();

  constructor(initial: Task[] = []) {
    for (const t of initial) this.tasks.set(t.id, { ...t });
  }

  async claim(workerName: string, claimTime = new Date()): Promise<Task | null> {
    for (const t of this.tasks.values()) {
      if (t.status === 'QUARANTINED') continue;
      if (t.nextRetryAt && t.nextRetryAt > claimTime) continue;
      if (t.status === 'QUEUED') {
        t.status = 'ASSIGNED';
        t.worker = workerName;
        t.leaseOwner = workerName;
        t.leaseDeadline = new Date(claimTime.getTime() + 60000);
        return { ...t };
      }
    }
    return null;
  }

  async update(id: string, patch: Partial<Task>): Promise<Task | null> {
    const t = this.tasks.get(id);
    if (!t) return null;
    Object.assign(t, patch, { updatedAt: new Date() });
    return { ...t };
  }

  async get(id: string): Promise<Task | null> {
    const t = this.tasks.get(id);
    return t ? { ...t } : null;
  }

  async list(): Promise<Task[]> {
    return Array.from(this.tasks.values()).map((t) => ({ ...t }));
  }

  async create(data: any): Promise<Task> {
    const t = createDummyTask(data);
    this.tasks.set(t.id, t);
    return { ...t };
  }

  async findStaleTasks(cutoff: Date, limit = 50): Promise<Task[]> {
    const list: Task[] = [];
    for (const t of this.tasks.values()) {
      if (
        ['ASSIGNED', 'RUNNING', 'TESTING'].includes(t.status) &&
        t.leaseDeadline &&
        new Date(t.leaseDeadline).getTime() < cutoff.getTime()
      ) {
        list.push({ ...t });
        if (list.length >= limit) break;
      }
    }
    return list;
  }

  async recoverStaleTask(id: string, patch: Partial<Task>, now: Date): Promise<Task | null> {
    const t = this.tasks.get(id);
    if (
      t &&
      ['ASSIGNED', 'RUNNING', 'TESTING'].includes(t.status) &&
      t.leaseDeadline &&
      new Date(t.leaseDeadline).getTime() < now.getTime()
    ) {
      Object.assign(t, patch, { updatedAt: new Date() });
      return { ...t };
    }
    return null;
  }
}

describe('Phase 5.5 Step 4: Periodic Reaper & Stale Task Recovery', () => {
  let server: Server | null = null;
  let port: number;

  beforeEach(() => {
    new PdlDeadLetterRepository().clearInMemoryState();
    new SchedulerSessionRepository().clearInMemoryState();
  });

  afterEach(async () => {
    if (server) {
      await new Promise<void>((resolve) => server!.close(() => resolve()));
      server = null;
    }
  });

  // REAPER_01: Authoritative stale detection - identifies tasks in ASSIGNED, RUNNING, TESTING with lease_deadline < now()
  it('REAPER_01: detects stale tasks with expired leases across ASSIGNED, RUNNING, and TESTING statuses', async () => {
    const now = new Date();
    const past = new Date(now.getTime() - 60000);
    const repo = new TestTaskRepo([
      createDummyTask({ id: 'task-assigned', status: 'ASSIGNED', leaseDeadline: past }),
      createDummyTask({ id: 'task-running', status: 'RUNNING', leaseDeadline: past }),
      createDummyTask({ id: 'task-testing', status: 'TESTING', leaseDeadline: past }),
    ]);

    const gov = new PdlGovernanceEngine({ pool: createMockPool([baseGovRow]) });
    const reaper = new PdlTaskReaper({ tasks: repo, governance: gov });

    const result = await reaper.runOnce(now);
    expect(result.staleDetected).toBe(3);
    expect(result.recovered).toBe(3);
  });

  // REAPER_02: Active task untouched - tasks with lease_deadline >= now() are NOT treated as stale
  it('REAPER_02: ignores active tasks whose lease deadlines have not expired', async () => {
    const now = new Date();
    const future = new Date(now.getTime() + 60000);
    const repo = new TestTaskRepo([
      createDummyTask({ id: 'task-active', status: 'RUNNING', leaseDeadline: future }),
    ]);

    const gov = new PdlGovernanceEngine({ pool: createMockPool([baseGovRow]) });
    const reaper = new PdlTaskReaper({ tasks: repo, governance: gov });

    const result = await reaper.runOnce(now);
    expect(result.staleDetected).toBe(0);
    expect(result.recovered).toBe(0);

    const task = await repo.get('task-active');
    expect(task?.status).toBe('RUNNING');
    expect(task?.leaseOwner).toBe('worker-stale-node-1');
  });

  // REAPER_03: Terminal tasks untouched - COMPLETED and FAILED tasks with past deadlines are ignored
  it('REAPER_03: ignores terminal tasks even if lease deadlines are in the past', async () => {
    const now = new Date();
    const past = new Date(now.getTime() - 60000);
    const repo = new TestTaskRepo([
      createDummyTask({ id: 'task-completed', status: 'COMPLETED', leaseDeadline: past }),
      createDummyTask({ id: 'task-failed', status: 'FAILED', leaseDeadline: past }),
    ]);

    const gov = new PdlGovernanceEngine({ pool: createMockPool([baseGovRow]) });
    const reaper = new PdlTaskReaper({ tasks: repo, governance: gov });

    const result = await reaper.runOnce(now);
    expect(result.staleDetected).toBe(0);
    expect(result.recovered).toBe(0);
  });

  // REAPER_04: Queued tasks untouched - status 'QUEUED' tasks are never picked up by stale detection
  it('REAPER_04: ignores queued tasks awaiting assignment', async () => {
    const now = new Date();
    const past = new Date(now.getTime() - 60000);
    const repo = new TestTaskRepo([
      createDummyTask({ id: 'task-queued', status: 'QUEUED', leaseDeadline: past, worker: null }),
    ]);

    const gov = new PdlGovernanceEngine({ pool: createMockPool([baseGovRow]) });
    const reaper = new PdlTaskReaper({ tasks: repo, governance: gov });

    const result = await reaper.runOnce(now);
    expect(result.staleDetected).toBe(0);
  });

  // REAPER_05: Safe requeue on transient retry - task with retryCount < maxRetries is reset to status 'QUEUED'
  it('REAPER_05: resets stale task to QUEUED when within retry limits', async () => {
    const now = new Date();
    const past = new Date(now.getTime() - 60000);
    const repo = new TestTaskRepo([
      createDummyTask({ id: 'task-retryable', status: 'RUNNING', leaseDeadline: past, retryCount: 0, maxRetries: 3 }),
    ]);

    const gov = new PdlGovernanceEngine({ pool: createMockPool([baseGovRow]) });
    const reaper = new PdlTaskReaper({ tasks: repo, governance: gov });

    const result = await reaper.runOnce(now);
    expect(result.recovered).toBe(1);

    const task = await repo.get('task-retryable');
    expect(task?.status).toBe('QUEUED');
  });

  // REAPER_06: Lease fields cleared on recovery - worker, leaseOwner, leaseDeadline, workspacePath set to null
  it('REAPER_06: clears worker and lease fields on recovered task', async () => {
    const now = new Date();
    const past = new Date(now.getTime() - 60000);
    const repo = new TestTaskRepo([
      createDummyTask({
        id: 'task-clean-lease',
        status: 'RUNNING',
        leaseDeadline: past,
        worker: 'crashed-worker-99',
        leaseOwner: 'crashed-worker-99',
        workspacePath: '/tmp/crashed-ws',
      }),
    ]);

    const gov = new PdlGovernanceEngine({ pool: createMockPool([baseGovRow]) });
    const reaper = new PdlTaskReaper({ tasks: repo, governance: gov });

    await reaper.runOnce(now);

    const task = await repo.get('task-clean-lease');
    expect(task?.worker).toBeNull();
    expect(task?.leaseOwner).toBeNull();
    expect(task?.leaseDeadline).toBeNull();
    expect(task?.heartbeatAt).toBeNull();
    expect(task?.workspacePath).toBeNull();
  });

  // REAPER_07: Task metadata preserved on recovery - ID, objective, repository, prompt remain unchanged
  it('REAPER_07: preserves task metadata without corruption during recovery', async () => {
    const now = new Date();
    const past = new Date(now.getTime() - 60000);
    const repo = new TestTaskRepo([
      createDummyTask({
        id: 'task-preserve-meta',
        project: 'pub-rate-calculator',
        repository: 'https://github.com/pubcoreagencia/pub-rate-calculator.git',
        objective: 'Crucial tax calculation fix',
        prompt: 'Implement precision tax round',
        commitSha: '611ec49ca8dbb33d3679a0357f5eab7af8259792',
        leaseDeadline: past,
      }),
    ]);

    const gov = new PdlGovernanceEngine({ pool: createMockPool([baseGovRow]) });
    const reaper = new PdlTaskReaper({ tasks: repo, governance: gov });

    await reaper.runOnce(now);

    const task = await repo.get('task-preserve-meta');
    expect(task?.id).toBe('task-preserve-meta');
    expect(task?.project).toBe('pub-rate-calculator');
    expect(task?.repository).toBe('https://github.com/pubcoreagencia/pub-rate-calculator.git');
    expect(task?.objective).toBe('Crucial tax calculation fix');
    expect(task?.prompt).toBe('Implement precision tax round');
    expect(task?.commitSha).toBe('611ec49ca8dbb33d3679a0357f5eab7af8259792');
  });

  // REAPER_08: Retry count incremented on recovery - retryCount increments from N to N+1
  it('REAPER_08: increments retryCount and records lastRetryAt timestamp', async () => {
    const now = new Date();
    const past = new Date(now.getTime() - 60000);
    const repo = new TestTaskRepo([
      createDummyTask({ id: 'task-inc-retry', leaseDeadline: past, retryCount: 1, maxRetries: 3 }),
    ]);

    const gov = new PdlGovernanceEngine({ pool: createMockPool([baseGovRow]) });
    const reaper = new PdlTaskReaper({ tasks: repo, governance: gov });

    await reaper.runOnce(now);

    const task = await repo.get('task-inc-retry');
    expect(task?.retryCount).toBe(2);
    expect(task?.lastRetryAt).toBeDefined();
  });

  // REAPER_09: Next retry delay / backoff respected - nextRetryAt set according to backoff policy
  it('REAPER_09: calculates exponential backoff and schedules nextRetryAt into the future', async () => {
    const now = new Date();
    const past = new Date(now.getTime() - 60000);
    const repo = new TestTaskRepo([
      createDummyTask({ id: 'task-backoff', leaseDeadline: past, retryCount: 1, maxRetries: 3 }),
    ]);

    const gov = new PdlGovernanceEngine({ pool: createMockPool([baseGovRow]) });
    const retryPolicy = new PdlRetryPolicy({ baseDelayMs: 2000, factor: 2 });
    const reaper = new PdlTaskReaper({ tasks: repo, governance: gov, retryPolicy });

    await reaper.runOnce(now);

    const task = await repo.get('task-backoff');
    expect(task?.nextRetryAt).toBeDefined();
    expect(new Date(task!.nextRetryAt!).getTime()).toBeGreaterThanOrEqual(now.getTime() + 1900);
  });

  // REAPER_10: Failure classification recorded - lastFailureCode set to LEASE_EXPIRED, lastFailureClass set to RETRYABLE
  it('REAPER_10: records lastFailureCode and lastFailureClass on requeued task', async () => {
    const now = new Date();
    const past = new Date(now.getTime() - 60000);
    const repo = new TestTaskRepo([
      createDummyTask({ id: 'task-classified', leaseDeadline: past }),
    ]);

    const gov = new PdlGovernanceEngine({ pool: createMockPool([baseGovRow]) });
    const reaper = new PdlTaskReaper({ tasks: repo, governance: gov });

    await reaper.runOnce(now);

    const task = await repo.get('task-classified');
    expect(task?.lastFailureCode).toBe('LEASE_EXPIRED');
    expect(task?.lastFailureClass).toBe('RETRYABLE');
  });

  // REAPER_11: Exhausted retries routed to DLQ - when retryCount >= maxRetries, task transitions to FAILED
  it('REAPER_11: routes task with exhausted retries to DLQ as FAILED', async () => {
    const now = new Date();
    const past = new Date(now.getTime() - 60000);
    const repo = new TestTaskRepo([
      createDummyTask({ id: 'task-exhausted', leaseDeadline: past, retryCount: 3, maxRetries: 3 }),
    ]);

    const gov = new PdlGovernanceEngine({ pool: createMockPool([baseGovRow]) });
    const dlq = new PdlDeadLetterRepository();
    const reaper = new PdlTaskReaper({ tasks: repo, governance: gov, dlq });

    const result = await reaper.runOnce(now);
    expect(result.deadLettered).toBe(1);

    const task = await repo.get('task-exhausted');
    expect(task?.status).toBe('FAILED');
    expect(task?.deadLetteredAt).toBeDefined();

    const dlqRecords = await dlq.list({ taskId: 'task-exhausted' });
    expect(dlqRecords.length).toBe(1);
    expect(dlqRecords[0].quarantined).toBe(false);
  });

  // REAPER_12: Poison task quarantine - poison failure classified task transitions to QUARANTINED
  it('REAPER_12: quarantines task with poison failure code and logs to DLQ', async () => {
    const now = new Date();
    const past = new Date(now.getTime() - 60000);
    const repo = new TestTaskRepo([
      createDummyTask({
        id: 'task-poison',
        leaseDeadline: past,
        error: 'Poison detected: Infinite loop in AST generation',
      }),
    ]);

    const gov = new PdlGovernanceEngine({ pool: createMockPool([baseGovRow]) });
    const dlq = new PdlDeadLetterRepository();
    const reaper = new PdlTaskReaper({ tasks: repo, governance: gov, dlq });

    const result = await reaper.runOnce(now);
    expect(result.quarantined).toBe(1);

    const task = await repo.get('task-poison');
    expect(task?.status).toBe('QUARANTINED');
    expect(task?.quarantinedAt).toBeDefined();

    const dlqRecords = await dlq.list({ taskId: 'task-poison' });
    expect(dlqRecords.length).toBe(1);
    expect(dlqRecords[0].quarantined).toBe(true);
  });

  // REAPER_13: Kill switch halts reaper cycle - killSwitchActive = true skips recovery
  it('REAPER_13: halts stale task recovery immediately when emergency kill switch is active', async () => {
    const now = new Date();
    const past = new Date(now.getTime() - 60000);
    const repo = new TestTaskRepo([
      createDummyTask({ id: 'task-blocked', leaseDeadline: past }),
    ]);

    const gov = new PdlGovernanceEngine({
      pool: createMockPool([{ ...baseGovRow, kill_switch_active: true }]),
    });
    const reaper = new PdlTaskReaper({ tasks: repo, governance: gov });

    const result = await reaper.runOnce(now);
    expect(result.error).toBe('KILL_SWITCH_ACTIVE');
    expect(result.recovered).toBe(0);

    const task = await repo.get('task-blocked');
    expect(task?.status).toBe('RUNNING'); // Unmodified
  });

  // REAPER_14: Kill switch activation during running reaper stops subsequent cycles
  it('REAPER_14: prevents subsequent cycle execution when kill switch activates dynamically', async () => {
    const now = new Date();
    const past = new Date(now.getTime() - 60000);
    const repo = new TestTaskRepo([
      createDummyTask({ id: 'task-ks-dyn', leaseDeadline: past }),
    ]);

    let ksActive = false;
    const pool = {
      query: async (sql: string) => {
        if (sql.includes('SELECT') && sql.includes('pdl_governance_state')) {
          return { rows: [{ ...baseGovRow, kill_switch_active: ksActive }] };
        }
        return { rows: [] };
      },
    } as any;

    const gov = new PdlGovernanceEngine({ pool });
    const reaper = new PdlTaskReaper({ tasks: repo, governance: gov });

    // Cycle 1: normal recovery
    const res1 = await reaper.runOnce(now);
    expect(res1.recovered).toBe(1);

    // Re-arm task for Cycle 2
    await repo.update('task-ks-dyn', { status: 'RUNNING', leaseDeadline: past });

    // Kill switch activates
    ksActive = true;
    const res2 = await reaper.runOnce(now);
    expect(res2.error).toBe('KILL_SWITCH_ACTIVE');
    expect(res2.recovered).toBe(0);

    const task = await repo.get('task-ks-dyn');
    expect(task?.status).toBe('RUNNING');
  });

  // REAPER_15: Governance Level 0 blocks recovery - activeLevel = 0 prevents task recovery
  it('REAPER_15: strictly blocks recovery at Governance Level 0 (OBSERVABILITY_ONLY)', async () => {
    const now = new Date();
    const past = new Date(now.getTime() - 60000);
    const repo = new TestTaskRepo([
      createDummyTask({ id: 'task-level-0', leaseDeadline: past }),
    ]);

    const gov = new PdlGovernanceEngine({
      pool: createMockPool([{ ...baseGovRow, active_level: 0 }]),
    });
    const reaper = new PdlTaskReaper({ tasks: repo, governance: gov });

    const result = await reaper.runOnce(now);
    expect(result.error).toBe('LEVEL_EXCEEDED');
    expect(result.recovered).toBe(0);

    const task = await repo.get('task-level-0');
    expect(task?.status).toBe('RUNNING');
  });

  // REAPER_16: Governance Level 1 blocks recovery - activeLevel = 1 blocks recovery
  it('REAPER_16: strictly blocks recovery at Governance Level 1 (SUPERVISED_STEP_BY_STEP)', async () => {
    const now = new Date();
    const past = new Date(now.getTime() - 60000);
    const repo = new TestTaskRepo([
      createDummyTask({ id: 'task-level-1', leaseDeadline: past }),
    ]);

    const gov = new PdlGovernanceEngine({
      pool: createMockPool([{ ...baseGovRow, active_level: 1 }]),
    });
    const reaper = new PdlTaskReaper({ tasks: repo, governance: gov });

    const result = await reaper.runOnce(now);
    expect(result.error).toBe('LEVEL_EXCEEDED');
    expect(result.recovered).toBe(0);
  });

  // REAPER_17: Governance Level 2 permits bounded recovery - activeLevel = 2 allows recovery
  it('REAPER_17: allows autonomous stale task recovery at Governance Level 2', async () => {
    const now = new Date();
    const past = new Date(now.getTime() - 60000);
    const repo = new TestTaskRepo([
      createDummyTask({ id: 'task-level-2', leaseDeadline: past }),
    ]);

    const gov = new PdlGovernanceEngine({
      pool: createMockPool([{ ...baseGovRow, active_level: 2 }]),
    });
    const reaper = new PdlTaskReaper({ tasks: repo, governance: gov });

    const result = await reaper.runOnce(now);
    expect(result.recovered).toBe(1);
    expect(result.error).toBeNull();
  });

  // REAPER_18: Governance Product Catalog enforcement - tasks for unapproved products are blocked
  it('REAPER_18: blocks recovery of stale tasks targeting products outside the Product Catalog', async () => {
    const now = new Date();
    const past = new Date(now.getTime() - 60000);
    const repo = new TestTaskRepo([
      createDummyTask({
        id: 'task-unapproved-prod',
        project: 'unauthorized-crypto-miner',
        repository: 'https://github.com/evil/crypto.git',
        leaseDeadline: past,
      }),
    ]);

    const gov = new PdlGovernanceEngine({
      pool: createMockPool([baseGovRow]), // allowed_products: pub-rate-calculator, pub-dev-loop-template, pub-shopee-scraper
    });
    const reaper = new PdlTaskReaper({ tasks: repo, governance: gov });

    const result = await reaper.runOnce(now);
    expect(result.blocked).toBe(1);
    expect(result.recovered).toBe(0);

    const task = await repo.get('task-unapproved-prod');
    expect(task?.status).toBe('RUNNING'); // Stays unchanged, blocked from requeue
  });

  // REAPER_19: Atomic recovery concurrency test - two concurrent reapers result in exactly one recovery
  it('REAPER_19: guarantees zero duplicate recoveries when two reapers run concurrently on the same task', async () => {
    const now = new Date();
    const past = new Date(now.getTime() - 60000);
    const repo = new TestTaskRepo([
      createDummyTask({ id: 'task-concurrent-race', leaseDeadline: past }),
    ]);

    const gov = new PdlGovernanceEngine({ pool: createMockPool([baseGovRow]) });
    const reaperA = new PdlTaskReaper({ tasks: repo, governance: gov });
    const reaperB = new PdlTaskReaper({ tasks: repo, governance: gov });

    // Run both reapers concurrently
    const [resA, resB] = await Promise.all([reaperA.runOnce(now), reaperB.runOnce(now)]);

    // Sum of recoveries must be exactly 1
    expect(resA.recovered + resB.recovered).toBe(1);

    const task = await repo.get('task-concurrent-race');
    expect(task?.status).toBe('QUEUED');
    expect(task?.retryCount).toBe(1);
  });

  // REAPER_20: Concurrent worker claim/completion race - reaper aborts recovery if worker updates task
  it('REAPER_20: aborts recovery safely if worker completes the task concurrently before recovery commit', async () => {
    const now = new Date();
    const past = new Date(now.getTime() - 60000);
    const repo = new TestTaskRepo([
      createDummyTask({ id: 'task-worker-race', leaseDeadline: past }),
    ]);

    // Simulate worker completing the task right before reaper's recoverStaleTask executes
    const origRecover = repo.recoverStaleTask.bind(repo);
    repo.recoverStaleTask = async (id, patch, n) => {
      // Simulate race: worker finished right now
      await repo.update(id, { status: 'COMPLETED', leaseDeadline: null });
      return origRecover(id, patch, n);
    };

    const gov = new PdlGovernanceEngine({ pool: createMockPool([baseGovRow]) });
    const reaper = new PdlTaskReaper({ tasks: repo, governance: gov });

    const result = await reaper.runOnce(now);
    expect(result.recovered).toBe(0);

    const task = await repo.get('task-worker-race');
    expect(task?.status).toBe('COMPLETED');
  });

  // REAPER_21: Worker heartbeat renewal prevents stale detection
  it('REAPER_21: leaves task running when worker heartbeat continually pushes lease deadline forward', async () => {
    const t0 = new Date();
    const repo = new TestTaskRepo([
      createDummyTask({
        id: 'task-heartbeating',
        status: 'RUNNING',
        leaseDeadline: new Date(t0.getTime() + 30000),
      }),
    ]);

    const gov = new PdlGovernanceEngine({ pool: createMockPool([baseGovRow]) });
    const reaper = new PdlTaskReaper({ tasks: repo, governance: gov });

    // Cycle 1: t0 (active)
    const res1 = await reaper.runOnce(t0);
    expect(res1.staleDetected).toBe(0);

    // Worker extends lease (heartbeat)
    await repo.update('task-heartbeating', {
      leaseDeadline: new Date(t0.getTime() + 90000),
      heartbeatAt: new Date(t0.getTime() + 20000),
    });

    // Cycle 2: t0 + 40s (still active because heartbeat renewed)
    const res2 = await reaper.runOnce(new Date(t0.getTime() + 40000));
    expect(res2.staleDetected).toBe(0);

    const task = await repo.get('task-heartbeating');
    expect(task?.status).toBe('RUNNING');
  });

  // REAPER_22: Worker crash simulation - worker dies, lease expires, reaper recovers, second worker claims
  it('REAPER_22: recovers crashed worker task to QUEUED so another worker can claim and execute it', async () => {
    const now = new Date();
    const past = new Date(now.getTime() - 60000);
    const repo = new TestTaskRepo([
      createDummyTask({
        id: 'task-crash-recovery',
        status: 'RUNNING',
        worker: 'crashed-worker-node-alpha',
        leaseOwner: 'crashed-worker-node-alpha',
        leaseDeadline: past,
      }),
    ]);

    const gov = new PdlGovernanceEngine({ pool: createMockPool([baseGovRow]) });
    const reaper = new PdlTaskReaper({ tasks: repo, governance: gov });

    // Reaper detects abandoned task and recovers to QUEUED
    const res = await reaper.runOnce(now);
    expect(res.recovered).toBe(1);

    // Second worker claims the task after the backoff window
    const claimed = await repo.claim('worker-node-beta', new Date(now.getTime() + 60000));
    expect(claimed).not.toBeNull();
    expect(claimed?.id).toBe('task-crash-recovery');
    expect(claimed?.status).toBe('ASSIGNED');
    expect(claimed?.worker).toBe('worker-node-beta');
  });

  // REAPER_23: Multi-task batch bounded recovery - reaper processes up to config.batchSize tasks per cycle
  it('REAPER_23: bounds recovery to configured batchSize per cycle', async () => {
    const now = new Date();
    const past = new Date(now.getTime() - 60000);
    const tasks: Task[] = [];
    for (let i = 0; i < 10; i++) {
      tasks.push(createDummyTask({ id: `task-batch-${i}`, leaseDeadline: past }));
    }
    const repo = new TestTaskRepo(tasks);

    const gov = new PdlGovernanceEngine({ pool: createMockPool([baseGovRow]) });
    const reaper = new PdlTaskReaper({
      tasks: repo,
      governance: gov,
      config: { batchSize: 4 },
    });

    const result = await reaper.runOnce(now);
    expect(result.staleDetected).toBe(4);
    expect(result.recovered).toBe(4);
  });

  // REAPER_24: Database failure isolation - transient repository error does not crash process or future cycles
  it('REAPER_24: isolates database errors during stale search without crashing callers', async () => {
    const repo = new TestTaskRepo();
    repo.findStaleTasks = async () => {
      throw new Error('Connection terminated unexpectedly');
    };

    const gov = new PdlGovernanceEngine({ pool: createMockPool([baseGovRow]) });
    const reaper = new PdlTaskReaper({ tasks: repo, governance: gov });

    const result = await reaper.runOnce();
    expect(result.error).toBe('Connection terminated unexpectedly');
    expect(result.recovered).toBe(0);

    const status = reaper.getStatus();
    expect(status.lastError).toBe('Connection terminated unexpectedly');
  });

  // REAPER_25: Reaper lifecycle start and stop - start() initiates loop, stop() cleanly shuts it down
  it('REAPER_25: starts and stops the periodic loop gracefully', async () => {
    const repo = new TestTaskRepo();
    const gov = new PdlGovernanceEngine({ pool: createMockPool([baseGovRow]) });
    const reaper = new PdlTaskReaper({
      tasks: repo,
      governance: gov,
      config: { intervalMs: 1000 },
    });

    expect(reaper.getStatus().running).toBe(false);

    await reaper.start();
    expect(reaper.getStatus().running).toBe(true);

    await reaper.stop();
    expect(reaper.getStatus().running).toBe(false);
  });

  // REAPER_26: Reaper interval configuration validation - rejects invalid intervals and batch sizes
  it('REAPER_26: rejects invalid configuration with fail-closed errors', () => {
    const repo = new TestTaskRepo();

    expect(() => new PdlTaskReaper({
      tasks: repo,
      config: { intervalMs: 500 }, // < 1000ms
    })).toThrowError(/INVALID_REAPER_INTERVAL/);

    expect(() => new PdlTaskReaper({
      tasks: repo,
      config: { batchSize: 0 },
    })).toThrowError(/INVALID_REAPER_BATCH_SIZE/);
  });

  // REAPER_27: Structured observability events - emits lifecycle and recovery events
  it('REAPER_27: emits structured observability events across cycle lifecycle', async () => {
    const now = new Date();
    const past = new Date(now.getTime() - 60000);
    const repo = new TestTaskRepo([
      createDummyTask({ id: 'task-obs', leaseDeadline: past }),
    ]);

    const gov = new PdlGovernanceEngine({ pool: createMockPool([baseGovRow]) });
    const reaper = new PdlTaskReaper({ tasks: repo, governance: gov });

    const events: ReaperEvent[] = [];
    reaper.onEvent((e) => events.push(e));

    await reaper.runOnce(now);

    const eventTypes = events.map((e) => e.type);
    expect(eventTypes).toContain('REAPER_CYCLE_STARTED');
    expect(eventTypes).toContain('TASK_STALE_DETECTED');
    expect(eventTypes).toContain('TASK_RECOVERED');
    expect(eventTypes).toContain('REAPER_CYCLE_COMPLETED');
  });

  // REAPER_28: Zero secret leakage in observability payloads - token, key, secret in details are redacted
  it('REAPER_28: redacts sensitive keys and values from observability payloads', async () => {
    const now = new Date();
    const past = new Date(now.getTime() - 60000);
    const repo = new TestTaskRepo([
      createDummyTask({ id: 'task-sensitive', leaseDeadline: past }),
    ]);

    const gov = new PdlGovernanceEngine({ pool: createMockPool([baseGovRow]) });
    const reaper = new PdlTaskReaper({ tasks: repo, governance: gov });

    let capturedEvent: ReaperEvent | null = null;
    reaper.onEvent((e) => {
      if (e.type === 'TASK_RECOVERED') capturedEvent = e;
    });

    await reaper.runOnce(now);

    expect(capturedEvent).not.toBeNull();
    // Test that internal emitEvent redacts secrets if present in details
    let capturedSanitizedEvent: ReaperEvent | null = null;
    reaper.onEvent((e) => {
      if (e.type === 'REAPER_CYCLE_FAILED') capturedSanitizedEvent = e;
    });

    (reaper as any).emitEvent('REAPER_CYCLE_FAILED', {
      details: {
        apiKey: 'dummy-api-key-test',
        customHeader: 'Bearer sample-auth-header-val',
        safeParam: 'public-value',
      },
    });

    expect(capturedSanitizedEvent?.details?.apiKey).toBe('[REDACTED]');
    expect(capturedSanitizedEvent?.details?.customHeader).toBe('[REDACTED]');
    expect(capturedSanitizedEvent?.details?.safeParam).toBe('public-value');
  });

  // REAPER_29: Continuous Scheduler integration - scheduler starts and stops reaper
  it('REAPER_29: coordinates reaper lifecycle with continuous scheduler', async () => {
    const repo = new TestTaskRepo();
    const gov = new PdlGovernanceEngine({ pool: createMockPool([{ ...baseGovRow, active_level: 3 }]) });
    const reaper = new PdlTaskReaper({
      tasks: repo,
      governance: gov,
      config: { intervalMs: 1000 },
    });

    const scheduler = new PdlContinuousScheduler({
      governance: gov,
      tasks: repo,
      reaper,
    });

    expect(reaper.getStatus().running).toBe(false);

    await scheduler.start();
    expect(reaper.getStatus().running).toBe(true);

    await scheduler.stop('OPERATOR_SHUTDOWN');
    expect(reaper.getStatus().running).toBe(false);
  });

  // REAPER_30: API observability endpoint - GET /reaper/status returns reaper status protected by auth
  it('REAPER_30: provides GET /reaper/status endpoint protected by READ authentication', async () => {
    const repo = new TestTaskRepo();
    const gov = new PdlGovernanceEngine({ pool: createMockPool([baseGovRow]) });
    const reaper = new PdlTaskReaper({ tasks: repo, governance: gov });

    const authConfig = {
      readKey: 'pdl-read-secret-key-123',
      adminKey: 'pdl-admin-secret-key-456',
    };

    const app = createPdlApp(undefined, repo as any, undefined, {
      governance: gov,
      reaper,
      authConfig,
    });

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        port = (server!.address() as any).port;
        resolve();
      });
    });

    // 1. Without auth: 401 Unauthorized
    const unauthRes = await fetch(`http://127.0.0.1:${port}/reaper/status`);
    expect(unauthRes.status).toBe(401);

    // 2. With valid auth: 200 OK with reaper status
    const authRes = await fetch(`http://127.0.0.1:${port}/reaper/status`, {
      headers: { Authorization: `Bearer ${authConfig.readKey}` },
    });
    expect(authRes.status).toBe(200);

    const body = await authRes.json();
    expect(body.service).toBe('pdl-api');
    expect(body.reaper).toBeDefined();
    expect(body.reaper.running).toBe(false);
    expect(body.reaper.staleDetectedCount).toBe(0);
  });
});

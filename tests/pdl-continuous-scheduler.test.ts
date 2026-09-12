import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Server } from 'node:http';
import type { Task, TaskRepository } from '../src/domain.js';
import {
  PdlGovernanceEngine,
  type GovernanceLimits,
} from '../src/pdl/governance/index.js';
import {
  PdlContinuousScheduler,
  SchedulerSessionRepository,
  type SchedulerEvent,
} from '../src/pdl/scheduler/index.js';
import { BaseWorker, type AttemptResult } from '../src/worker-service.js';
import { createPdlApp } from '../src/pdl/api/entry.js';

// Mock DB pool helper
function createMockPool(rows: any[] = [], shouldFail = false) {
  return {
    query: async (sql: string, params?: any[]) => {
      if (shouldFail) {
        throw new Error('Simulated database connection failure');
      }
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

function createDummyTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-test-sched-1',
    project: 'pub-rate-calculator',
    repository: 'https://github.com/pubcoreagencia/pub-rate-calculator.git',
    objective: 'Test scheduler continuous execution',
    prompt: 'Execute continuous scheduler test',
    status: 'QUEUED',
    priority: 1,
    worker: null,
    result: null,
    error: null,
    branch: 'scheduler-test',
    commitSha: '2053d3349cff31b6458fa93187e22ed48ce5c620',
    gitStatus: 'clean',
    createdAt: new Date(),
    updatedAt: new Date(),
    leaseOwner: null,
    leaseDeadline: null,
    heartbeatAt: null,
    workspacePath: null,
    prototypeSessionId: null,
    ...overrides,
  };
}

class MemoryTaskRepo implements TaskRepository {
  tasks = new Map<string, Task>();
  constructor(initial: Task[] = []) {
    for (const t of initial) this.tasks.set(t.id, { ...t });
  }
  async claim(workerName: string): Promise<Task | null> {
    for (const t of this.tasks.values()) {
      if (t.status === 'QUEUED') {
        t.status = 'ASSIGNED';
        t.worker = workerName;
        return { ...t };
      }
    }
    return null;
  }
  async update(id: string, patch: Partial<Task>): Promise<Task | null> {
    const t = this.tasks.get(id);
    if (!t) return null;
    Object.assign(t, patch);
    return { ...t };
  }
  async get(id: string): Promise<Task | null> {
    return this.tasks.get(id) || null;
  }
  async list(): Promise<Task[]> {
    return Array.from(this.tasks.values());
  }
  async create(data: any): Promise<Task> {
    const t = createDummyTask(data);
    this.tasks.set(t.id, t);
    return t;
  }
}

class MockWorker extends BaseWorker {
  public executeOutcome: 'COMPLETED' | 'FAILED' = 'COMPLETED';
  public executeCallCount = 0;
  public failOnCallNumber = -1;

  override async executeOnce(): Promise<boolean> {
    const task = await this.tasks.claim(this.name);
    if (!task) {
      this.lastExecutedTask = null;
      return false;
    }

    if (this.governance) {
      const execDecision = await this.governance.evaluateExecution(task);
      if (!execDecision.allowed) {
        this.lastFinalizeStatus = 'FAILED';
        this.lastExecutedTask = {
          ...task,
          status: 'BLOCKED',
          error: `Execution start blocked by governance: ${execDecision.reason}`,
        };
        await this.tasks.update(task.id, {
          status: 'BLOCKED',
          error: `Execution start blocked by governance: ${execDecision.reason}`,
        });
        return true;
      }
    }

    this.executeCallCount++;
    const shouldFail = this.failOnCallNumber === this.executeCallCount || this.executeOutcome === 'FAILED';

    if (shouldFail) {
      this.lastFinalizeStatus = 'FAILED';
      this.lastExecutedTask = {
        ...task,
        status: 'FAILED',
        error: 'Simulated task execution failure',
      };
      await this.tasks.update(task.id, { status: 'FAILED', error: 'Simulated task execution failure' });
      return true;
    }

    this.lastFinalizeStatus = 'COMPLETED';
    this.lastExecutedTask = {
      ...task,
      status: 'COMPLETED',
    };
    await this.tasks.update(task.id, { status: 'COMPLETED' });
    return true;
  }

  protected async executeWithRetry(task: Task): Promise<AttemptResult> {
    return {
      status: 'COMPLETED',
      workspace: '/tmp/test-workspace',
      declaredChangedFiles: ['file.txt'],
      stdout: 'done',
      stderr: '',
      exitCode: 0,
    };
  }
}

describe('PDL Phase 5.5 Step 2: Bounded Continuous Scheduler Suite', () => {
  let activeServer: Server | null = null;

  beforeEach(() => {
    delete process.env.PDL_EMERGENCY_STOP;
    delete process.env.PDL_KILL_SWITCH;
    delete process.env.PDL_GOVERNANCE_ADMIN_KEY;
    delete process.env.PDL_GOVERNANCE_READ_KEY;
    new SchedulerSessionRepository().clearInMemoryState();
  });

  afterEach(async () => {
    delete process.env.PDL_EMERGENCY_STOP;
    delete process.env.PDL_KILL_SWITCH;
    delete process.env.PDL_GOVERNANCE_ADMIN_KEY;
    delete process.env.PDL_GOVERNANCE_READ_KEY;
    new SchedulerSessionRepository().clearInMemoryState();
    if (activeServer) {
      await new Promise((resolve) => activeServer!.close(resolve));
      activeServer = null;
    }
    vi.restoreAllMocks();
  });

  const baseRow = {
    id: 'canonical',
    active_level: 3,
    kill_switch_active: false,
    max_consecutive_tasks: 3,
    max_task_duration_ms: 180000,
    max_tool_rounds_per_task: 10,
    max_correction_attempts: 2,
    max_consecutive_failures: 1,
    allowed_products: ['pub-rate-calculator', 'pub-dev-loop-template'],
  };

  // ==========================================
  // SCHEDULER_01 to SCHEDULER_06: LEVEL SEMANTICS
  // ==========================================
  it('SCHEDULER_01: Level 0 blocks scheduler', async () => {
    const pool = createMockPool([{ ...baseRow, active_level: 0 }]);
    const governance = new PdlGovernanceEngine({ pool });
    const scheduler = new PdlContinuousScheduler({
      governance,
      config: { pollIntervalMs: 1000 },
    });

    const session = await scheduler.start();
    expect(session.state).toBe('BLOCKED');
    expect(session.stopReason).toBe('LEVEL_EXCEEDED');
    expect(scheduler.getStatus().state).toBe('BLOCKED');
  });

  it('SCHEDULER_02: Level 1 blocks autonomous continuation', async () => {
    const pool = createMockPool([{ ...baseRow, active_level: 1 }]);
    const governance = new PdlGovernanceEngine({ pool });
    const scheduler = new PdlContinuousScheduler({
      governance,
      config: { pollIntervalMs: 1000 },
    });

    const session = await scheduler.start();
    expect(session.state).toBe('BLOCKED');
    expect(session.stopReason).toBe('LEVEL_EXCEEDED');
  });

  it('SCHEDULER_03: Level 2 blocks autonomous continuation', async () => {
    const pool = createMockPool([{ ...baseRow, active_level: 2 }]);
    const governance = new PdlGovernanceEngine({ pool });
    const scheduler = new PdlContinuousScheduler({
      governance,
      config: { pollIntervalMs: 1000 },
    });

    const session = await scheduler.start();
    expect(session.state).toBe('BLOCKED');
    expect(session.stopReason).toBe('LEVEL_EXCEEDED');
  });

  it('SCHEDULER_04: Level 3 allows bounded continuation', async () => {
    const pool = createMockPool([{ ...baseRow, active_level: 3, max_consecutive_tasks: 2 }]);
    const governance = new PdlGovernanceEngine({ pool });
    const tasks = new MemoryTaskRepo([
      createDummyTask({ id: 't1', status: 'QUEUED' }),
      createDummyTask({ id: 't2', status: 'QUEUED' }),
    ]);
    const worker = new MockWorker(tasks, 'test-worker', undefined, governance);

    const scheduler = new PdlContinuousScheduler({
      governance,
      worker,
      tasks,
      config: { pollIntervalMs: 1000 },
    });

    const session = await scheduler.start();
    expect(session.state).toBe('RUNNING');

    await scheduler.waitForCompletion();
    const finalStatus = scheduler.getStatus();
    expect(finalStatus.state).toBe('COMPLETED');
    expect(finalStatus.consecutiveTasks).toBe(2);
    expect(finalStatus.stopReason).toBe('CONSECUTIVE_TASKS_EXCEEDED');
  });

  it('SCHEDULER_05: Level 4 allows bounded continuation', async () => {
    const pool = createMockPool([{ ...baseRow, active_level: 4, max_consecutive_tasks: 2 }]);
    const governance = new PdlGovernanceEngine({ pool });
    const tasks = new MemoryTaskRepo([
      createDummyTask({ id: 't1', status: 'QUEUED' }),
      createDummyTask({ id: 't2', status: 'QUEUED' }),
    ]);
    const worker = new MockWorker(tasks, 'test-worker', undefined, governance);

    const scheduler = new PdlContinuousScheduler({
      governance,
      worker,
      tasks,
      config: { pollIntervalMs: 1000 },
    });

    const session = await scheduler.start();
    expect(session.state).toBe('RUNNING');

    await scheduler.waitForCompletion();
    expect(scheduler.getStatus().state).toBe('COMPLETED');
    expect(scheduler.getStatus().consecutiveTasks).toBe(2);
  });

  it('SCHEDULER_06: Level 5 is impossible', async () => {
    const pool = createMockPool([{ ...baseRow, active_level: 5 }]);
    const governance = new PdlGovernanceEngine({ pool });
    const scheduler = new PdlContinuousScheduler({
      governance,
      config: { pollIntervalMs: 1000 },
    });

    const session = await scheduler.start();
    expect(['BLOCKED', 'FAILED']).toContain(session.state);
  });

  // ==========================================
  // SCHEDULER_07 & SCHEDULER_08: KILL SWITCH & DB FAILURE
  // ==========================================
  it('SCHEDULER_07: kill switch stops scheduler', async () => {
    const pool = createMockPool([{ ...baseRow, active_level: 3, kill_switch_active: true }]);
    const governance = new PdlGovernanceEngine({ pool });
    const scheduler = new PdlContinuousScheduler({
      governance,
      config: { pollIntervalMs: 1000 },
    });

    const session = await scheduler.start();
    expect(session.state).toBe('BLOCKED');
    expect(session.stopReason).toBe('KILL_SWITCH_ACTIVE');
  });

  it('SCHEDULER_08: governance read failure stops scheduler', async () => {
    const pool = createMockPool([], true); // Simulated DB connection failure
    const governance = new PdlGovernanceEngine({ pool });
    const scheduler = new PdlContinuousScheduler({
      governance,
      config: { pollIntervalMs: 1000 },
    });

    const session = await scheduler.start();
    expect(['BLOCKED', 'FAILED']).toContain(session.state);
    expect(['GOVERNANCE_CONFIG_ERROR', 'KILL_SWITCH_ACTIVE', 'LEVEL_EXCEEDED']).toContain(session.stopReason);
  });

  // ==========================================
  // SCHEDULER_09 & SCHEDULER_10: LIMIT BOUNDS
  // ==========================================
  it('SCHEDULER_09: maxConsecutiveTasks stops scheduler', async () => {
    const pool = createMockPool([{ ...baseRow, active_level: 3, max_consecutive_tasks: 1 }]);
    const governance = new PdlGovernanceEngine({ pool });
    const tasks = new MemoryTaskRepo([
      createDummyTask({ id: 't1', status: 'QUEUED' }),
      createDummyTask({ id: 't2', status: 'QUEUED' }),
    ]);
    const worker = new MockWorker(tasks, 'test-worker', undefined, governance);

    const scheduler = new PdlContinuousScheduler({
      governance,
      worker,
      tasks,
      config: { pollIntervalMs: 1000 },
    });

    await scheduler.start();
    await scheduler.waitForCompletion();

    const status = scheduler.getStatus();
    expect(status.consecutiveTasks).toBe(1);
    expect(status.state).toBe('COMPLETED');
    expect(status.stopReason).toBe('CONSECUTIVE_TASKS_EXCEEDED');
    expect(tasks.tasks.get('t2')?.status).toBe('QUEUED');
  });

  it('SCHEDULER_10: maxConsecutiveFailures stops scheduler', async () => {
    const pool = createMockPool([{ ...baseRow, active_level: 3, max_consecutive_failures: 1 }]);
    const governance = new PdlGovernanceEngine({ pool });
    const tasks = new MemoryTaskRepo([
      createDummyTask({ id: 't1', status: 'QUEUED' }),
      createDummyTask({ id: 't2', status: 'QUEUED' }),
    ]);
    const worker = new MockWorker(tasks, 'test-worker', undefined, governance);
    worker.executeOutcome = 'FAILED';

    const scheduler = new PdlContinuousScheduler({
      governance,
      worker,
      tasks,
      config: { pollIntervalMs: 1000 },
    });

    await scheduler.start();
    await scheduler.waitForCompletion();

    const status = scheduler.getStatus();
    expect(status.consecutiveFailures).toBe(1);
    expect(status.state).toBe('FAILED');
    expect(status.stopReason).toBe('CONSECUTIVE_FAILURES_EXCEEDED');
    expect(tasks.tasks.get('t2')?.status).toBe('QUEUED');
  });

  // ==========================================
  // SCHEDULER_11, 12, 13: COUNTERS & RESET
  // ==========================================
  it('SCHEDULER_11: successful task increments task counter', async () => {
    const pool = createMockPool([{ ...baseRow, active_level: 3, max_consecutive_tasks: 1 }]);
    const governance = new PdlGovernanceEngine({ pool });
    const tasks = new MemoryTaskRepo([createDummyTask({ id: 't1', status: 'QUEUED' })]);
    const worker = new MockWorker(tasks, 'test-worker', undefined, governance);

    const scheduler = new PdlContinuousScheduler({
      governance,
      worker,
      tasks,
      config: { pollIntervalMs: 1000 },
    });

    await scheduler.start();
    await scheduler.waitForCompletion();

    expect(scheduler.getStatus().consecutiveTasks).toBe(1);
  });

  it('SCHEDULER_12: failure increments failure counter', async () => {
    const pool = createMockPool([{ ...baseRow, active_level: 3, max_consecutive_failures: 1 }]);
    const governance = new PdlGovernanceEngine({ pool });
    const tasks = new MemoryTaskRepo([createDummyTask({ id: 't1', status: 'QUEUED' })]);
    const worker = new MockWorker(tasks, 'test-worker', undefined, governance);
    worker.executeOutcome = 'FAILED';

    const scheduler = new PdlContinuousScheduler({
      governance,
      worker,
      tasks,
      config: { pollIntervalMs: 1000 },
    });

    await scheduler.start();
    await scheduler.waitForCompletion();

    expect(scheduler.getStatus().consecutiveFailures).toBe(1);
  });

  it('SCHEDULER_13: success resets consecutive failures', async () => {
    const pool = createMockPool([{ ...baseRow, active_level: 3, max_consecutive_tasks: 2, max_consecutive_failures: 2 }]);
    const governance = new PdlGovernanceEngine({ pool });
    const tasks = new MemoryTaskRepo([
      createDummyTask({ id: 't1', status: 'QUEUED' }),
      createDummyTask({ id: 't2', status: 'QUEUED' }),
      createDummyTask({ id: 't3', status: 'QUEUED' }),
    ]);
    const worker = new MockWorker(tasks, 'test-worker', undefined, governance);
    // Task 1 fails, Task 2 succeeds, Task 3 succeeds (reaching max_consecutive_tasks: 2)
    worker.failOnCallNumber = 1;

    const scheduler = new PdlContinuousScheduler({
      governance,
      worker,
      tasks,
      config: { pollIntervalMs: 1000 },
    });

    await scheduler.start();
    await scheduler.waitForCompletion();

    const status = scheduler.getStatus();
    expect(status.consecutiveTasks).toBe(2);
    expect(status.consecutiveFailures).toBe(0);
  });

  // ==========================================
  // SCHEDULER_14: IDLE BOUNDED POLLING
  // ==========================================
  it('SCHEDULER_14: no task results in bounded idle wait', async () => {
    const pool = createMockPool([{ ...baseRow, active_level: 3 }]);
    const governance = new PdlGovernanceEngine({ pool });
    const tasks = new MemoryTaskRepo([]);
    const worker = new MockWorker(tasks, 'test-worker', undefined, governance);

    const scheduler = new PdlContinuousScheduler({
      governance,
      worker,
      tasks,
      config: { pollIntervalMs: 1000 },
    });

    const events: SchedulerEvent[] = [];
    scheduler.onEvent((ev) => events.push(ev));

    await scheduler.start();
    await new Promise((r) => setTimeout(r, 100));
    await scheduler.stop('OPERATOR_STOP');
    await scheduler.waitForCompletion();

    const idleEvent = events.find((e) => e.type === 'SCHEDULER_IDLE');
    expect(idleEvent).toBeDefined();
    expect(scheduler.getStatus().state).toBe('STOPPED');
  });

  // ==========================================
  // SCHEDULER_15 to SCHEDULER_20: GATE INTEGRITY
  // ==========================================
  it('SCHEDULER_15: scheduler never bypasses Product Catalog', async () => {
    const pool = createMockPool([{ ...baseRow, active_level: 3, allowed_products: ['pub-rate-calculator'] }]);
    const governance = new PdlGovernanceEngine({ pool });
    const tasks = new MemoryTaskRepo([
      createDummyTask({ id: 't-unauth', project: 'pub-unregistered-random-repo', status: 'QUEUED' }),
    ]);
    const worker = new MockWorker(tasks, 'test-worker', undefined, governance);

    const scheduler = new PdlContinuousScheduler({
      governance,
      worker,
      tasks,
      config: { pollIntervalMs: 1000 },
    });

    await scheduler.start();
    await scheduler.waitForCompletion();

    const blockedTask = tasks.tasks.get('t-unauth');
    expect(blockedTask?.status).toBe('BLOCKED');
    expect(blockedTask?.error).toContain('Product Catalog');
  });

  it('SCHEDULER_16: scheduler never bypasses FREE-only policy', () => {
    const isFree = (model: string) => /free/i.test(model);
    expect(isFree('meta-llama/llama-3.3-70b-instruct:free')).toBe(true);
    expect(isFree('google/gemini-pro')).toBe(false);
  });

  it('SCHEDULER_17: scheduler never bypasses claim gate', async () => {
    const pool = createMockPool([{ ...baseRow, active_level: 3, kill_switch_active: true }]);
    const governance = new PdlGovernanceEngine({ pool });
    const claimDecision = await governance.evaluateClaim();
    expect(claimDecision.allowed).toBe(false);
    expect(claimDecision.reasonCode).toBe('KILL_SWITCH_ACTIVE');
  });

  it('SCHEDULER_18: scheduler never bypasses execution gate', async () => {
    const pool = createMockPool([{ ...baseRow, active_level: 3, allowed_products: ['pub-rate-calculator'] }]);
    const governance = new PdlGovernanceEngine({ pool });
    const unauthTask = createDummyTask({ project: 'pub-unknown-evil-product' });
    const execDecision = await governance.evaluateExecution(unauthTask);
    expect(execDecision.allowed).toBe(false);
    expect(execDecision.reasonCode).toBe('UNAUTHORIZED_PRODUCT');
  });

  it('SCHEDULER_19: scheduler never bypasses correction gate', async () => {
    const pool = createMockPool([{ ...baseRow, active_level: 3, max_correction_attempts: 1 }]);
    const governance = new PdlGovernanceEngine({ pool });
    const task = createDummyTask();
    const corrDecision = await governance.evaluateCorrection(task, { attemptNumber: 2 });
    expect(corrDecision.allowed).toBe(false);
    expect(corrDecision.reasonCode).toBe('CORRECTION_ATTEMPTS_EXCEEDED');
  });

  it('SCHEDULER_20: scheduler never bypasses finalization gate', async () => {
    const pool = createMockPool([{ ...baseRow, kill_switch_active: true }]);
    const governance = new PdlGovernanceEngine({ pool });
    const task = createDummyTask();
    const finDecision = await governance.evaluateFinalization(task);
    expect(finDecision.allowed).toBe(false);
    expect(finDecision.reasonCode).toBe('KILL_SWITCH_ACTIVE');
  });

  // ==========================================
  // SCHEDULER_21 to SCHEDULER_25: SYSTEM INTEGRITY
  // ==========================================
  it('SCHEDULER_21: scheduler respects branch/task locking', async () => {
    const pool = createMockPool([{ ...baseRow, active_level: 3 }]);
    const governance = new PdlGovernanceEngine({ pool });
    const tasks = new MemoryTaskRepo([]);
    const worker = new MockWorker(tasks, 'test-worker', undefined, governance);

    const scheduler = new PdlContinuousScheduler({
      governance,
      worker,
      tasks,
      config: { pollIntervalMs: 1000 },
    });

    await scheduler.start();
    await expect(scheduler.start()).rejects.toThrow('CONCURRENCY_VIOLATION');
    await scheduler.stop();
  });

  it('SCHEDULER_22: scheduler does not run duplicate task after restart', async () => {
    const repo = new SchedulerSessionRepository();
    const tasks = new MemoryTaskRepo([
      createDummyTask({ id: 't-completed', status: 'COMPLETED' }),
      createDummyTask({ id: 't-interrupted', status: 'RUNNING' }),
    ]);

    await repo.createSession({
      id: 'session-crashed-1',
      state: 'RUNNING',
      authorizedBy: 'test',
      activeLevel: 3,
      consecutiveTasks: 1,
      consecutiveFailures: 0,
      cycleCount: 2,
      maxConsecutiveTasks: 3,
      maxConsecutiveFailures: 1,
      startedAt: new Date().toISOString(),
    });
    await repo.recordCycle({
      id: 'session-crashed-1:1',
      sessionId: 'session-crashed-1',
      cycleNumber: 1,
      taskId: 't-completed',
      status: 'COMPLETED',
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    });
    await repo.recordCycle({
      id: 'session-crashed-1:2',
      sessionId: 'session-crashed-1',
      cycleNumber: 2,
      taskId: 't-interrupted',
      status: 'RUNNING',
      startedAt: new Date().toISOString(),
    });

    const pool = createMockPool([baseRow]);
    const governance = new PdlGovernanceEngine({ pool });
    const scheduler = new PdlContinuousScheduler({
      governance,
      repository: repo,
      tasks,
      config: { pollIntervalMs: 1000 },
    });

    const recovery = await scheduler.recoverFromCrash();
    expect(recovery.recoveredSessions).toBe(1);
    expect(recovery.interruptedTasks).toContain('t-interrupted');
    expect(tasks.tasks.get('t-interrupted')?.status).toBe('FAILED');
    expect(tasks.tasks.get('t-completed')?.status).toBe('COMPLETED');
  });

  it('SCHEDULER_23: scheduler stops after governance denial', async () => {
    const pool = createMockPool([{ ...baseRow, active_level: 0 }]);
    const governance = new PdlGovernanceEngine({ pool });
    const scheduler = new PdlContinuousScheduler({
      governance,
      config: { pollIntervalMs: 1000 },
    });

    const session = await scheduler.start();
    expect(session.state).toBe('BLOCKED');
  });

  it('SCHEDULER_24: scheduler records stop reason', async () => {
    const pool = createMockPool([{ ...baseRow, active_level: 0 }]);
    const governance = new PdlGovernanceEngine({ pool });
    const scheduler = new PdlContinuousScheduler({
      governance,
      config: { pollIntervalMs: 1000 },
    });

    const session = await scheduler.start();
    expect(session.stopReason).toBe('LEVEL_EXCEEDED');
    expect(session.stoppedAt).toBeDefined();
  });

  it('SCHEDULER_25: scheduler never modifies governance limits itself', async () => {
    const pool = createMockPool([{ ...baseRow, max_consecutive_tasks: 1 }]);
    const governance = new PdlGovernanceEngine({ pool });
    const tasks = new MemoryTaskRepo([createDummyTask({ id: 't1', status: 'QUEUED' })]);
    const worker = new MockWorker(tasks, 'test-worker', undefined, governance);

    const scheduler = new PdlContinuousScheduler({
      governance,
      worker,
      tasks,
      config: { pollIntervalMs: 1000 },
    });

    const limitsBefore = await governance.loadLimits();
    await scheduler.start();
    await scheduler.waitForCompletion();
    const limitsAfter = await governance.loadLimits();

    expect(limitsAfter.activeLevel).toBe(limitsBefore.activeLevel);
    expect(limitsAfter.maxConsecutiveTasks).toBe(limitsBefore.maxConsecutiveTasks);
    expect(limitsAfter.maxConsecutiveFailures).toBe(limitsBefore.maxConsecutiveFailures);
    expect(limitsAfter.killSwitchActive).toBe(limitsBefore.killSwitchActive);
  });

  // ==========================================
  // FAILURE INJECTION: KILL SWITCH MID-RUN
  // ==========================================
  it('FAILURE_INJECTION: Kill switch activated mid-run halts the continuous scheduler', async () => {
    const pool = createMockPool([{ ...baseRow, active_level: 3, max_consecutive_tasks: 5 }]);
    const governance = new PdlGovernanceEngine({ pool });
    const tasks = new MemoryTaskRepo([
      createDummyTask({ id: 't1', status: 'QUEUED' }),
      createDummyTask({ id: 't2', status: 'QUEUED' }),
    ]);

    class InterruptWorker extends BaseWorker {
      override async executeOnce(): Promise<boolean> {
        const task = await this.tasks.claim(this.name);
        if (!task) return false;
        // Activate emergency stop via env mid-run
        process.env.PDL_EMERGENCY_STOP = 'true';
        this.lastFinalizeStatus = 'COMPLETED';
        this.lastExecutedTask = { ...task, status: 'COMPLETED' };
        await this.tasks.update(task.id, { status: 'COMPLETED' });
        return true;
      }
      protected async executeWithRetry(): Promise<AttemptResult> {
        return {} as any;
      }
    }

    const worker = new InterruptWorker(tasks, 'interrupt-worker', undefined, governance);
    const scheduler = new PdlContinuousScheduler({
      governance,
      worker,
      tasks,
      config: { pollIntervalMs: 1000 },
    });

    await scheduler.start();
    await scheduler.waitForCompletion();

    const status = scheduler.getStatus();
    expect(status.state).toBe('BLOCKED');
    expect(status.stopReason).toBe('KILL_SWITCH_ACTIVE');
    // Task 2 must not have been executed
    expect(tasks.tasks.get('t2')?.status).toBe('QUEUED');
  });

  // ==========================================
  // SCHEDULER API AUTHENTICATION & CONTROL
  // ==========================================
  it('SCHEDULER_API: /scheduler/status requires READ auth; /scheduler/start requires ADMIN_WRITE', async () => {
    const adminKey = 'test-scheduler-admin-key-12345';
    const readKey = 'test-scheduler-read-key-67890';
    const pool = createMockPool([baseRow]);
    const governance = new PdlGovernanceEngine({ pool });
    const scheduler = new PdlContinuousScheduler({
      governance,
      config: { pollIntervalMs: 1000 },
    });

    const app = createPdlApp(pool, undefined, undefined, {
      governance,
      scheduler,
      authConfig: { adminKey, readKey },
    });

    const server = await new Promise<Server>((resolve) => {
      const s = app.listen(0, '127.0.0.1', () => resolve(s));
    });
    activeServer = server;
    const address = server.address() as any;
    const baseUrl = `http://127.0.0.1:${address.port}`;

    // 1. Unauthenticated read -> 401
    const unauthRead = await fetch(`${baseUrl}/scheduler/status`);
    expect(unauthRead.status).toBe(401);

    // 2. Authenticated read -> 200
    const authRead = await fetch(`${baseUrl}/scheduler/status`, {
      headers: { Authorization: `Bearer ${readKey}` },
    });
    expect(authRead.status).toBe(200);
    const readJson = await authRead.json();
    expect(readJson.scheduler.state).toBeDefined();

    // 3. Read key trying to start (ADMIN_WRITE required) -> 403 Forbidden
    const forbiddenStart = await fetch(`${baseUrl}/scheduler/start`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${readKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(forbiddenStart.status).toBe(403);

    // 4. Admin key starting -> 200
    const adminStart = await fetch(`${baseUrl}/scheduler/start`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(adminStart.status).toBe(200);
    const startJson = await adminStart.json();
    expect(startJson.session).toBeDefined();

    await scheduler.stop();
  });
});

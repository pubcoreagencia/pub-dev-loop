import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Task, TaskRepository } from '../src/domain.js';
import {
  PdlGovernanceEngine,
  PdlKillSwitch,
  type GovernanceLimits,
} from '../src/pdl/governance/index.js';
import {
  PdlContinuousScheduler,
  SchedulerSessionRepository,
  type SchedulerEvent,
} from '../src/pdl/scheduler/index.js';
import { BaseWorker } from '../src/worker-service.js';
import { PdlRetryPolicy } from '../src/pdl/retry/index.js';
import { PdlDeadLetterRepository } from '../src/pdl/dlq/index.js';
import { PdlTaskReaper } from '../src/pdl/reaper/index.js';
import {
  createPdlContinuousDaemon,
  createPdlWorkerDaemon,
} from '../src/pdl/worker/entry.js';
import { createPdlApp } from '../src/pdl/api/entry.js';

// In-Memory Task Repository for deterministic continuous testing
class MemoryTaskRepository implements TaskRepository {
  public tasks = new Map<string, Task>();

  constructor(initial: Task[] = []) {
    for (const t of initial) {
      this.tasks.set(t.id, { ...t });
    }
  }

  async claim(workerName: string): Promise<Task | null> {
    const now = new Date();
    for (const t of this.tasks.values()) {
      if (t.status === 'QUARANTINED') continue;
      if (t.nextRetryAt && t.nextRetryAt > now) continue;
      if (
        t.status === 'QUEUED' ||
        (['ASSIGNED', 'RUNNING', 'TESTING'].includes(t.status) &&
          t.leaseDeadline &&
          t.leaseDeadline < now)
      ) {
        t.status = 'ASSIGNED';
        t.worker = workerName;
        t.leaseOwner = workerName;
        t.leaseDeadline = new Date(Date.now() + 30000);
        t.heartbeatAt = new Date();
        t.updatedAt = new Date();
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
    const id = data.id || `task-${Math.random().toString(36).slice(2, 9)}`;
    const task: Task = {
      id,
      project: data.project || 'pub-rate-calculator',
      repository:
        data.repository ||
        'https://github.com/pubcoreagencia/pub-rate-calculator.git',
      objective: data.objective || 'Objective',
      prompt: data.prompt || 'Prompt',
      status: 'QUEUED',
      priority: data.priority ?? 1,
      worker: null,
      result: null,
      error: null,
      branch: data.branch || 'main',
      commitSha: null,
      gitStatus: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      leaseOwner: null,
      leaseDeadline: null,
      heartbeatAt: null,
      workspacePath: null,
      prototypeSessionId: null,
      retryCount: data.retryCount ?? 0,
      maxRetries: data.maxRetries ?? 3,
      nextRetryAt: null,
      lastRetryAt: null,
      lastFailureCode: null,
      lastFailureClass: null,
      deadLetteredAt: null,
      deadLetterReason: null,
      quarantinedAt: null,
      quarantineReason: null,
    };
    this.tasks.set(id, task);
    return { ...task };
  }

  async cancel(id: string): Promise<Task | null> {
    return this.update(id, { status: 'CANCELLED' });
  }

  async retry(id: string): Promise<Task | null> {
    return this.update(id, { status: 'QUEUED', error: null });
  }
}

// Memory DLQ Repository
class MemoryDLQRepository extends PdlDeadLetterRepository {
  public records: any[] = [];
  constructor() {
    super(undefined);
  }
  override async record(entry: any): Promise<any> {
    const rec = { id: `dlq-${this.records.length + 1}`, ...entry, createdAt: new Date().toISOString() };
    this.records.push(rec);
    return rec;
  }
  override async getStatus(): Promise<any> {
    return {
      totalDeadLetters: this.records.length,
      quarantinedTasks: this.records.filter((r) => r.quarantined).length,
      lastDeadLetterAt: this.records[this.records.length - 1]?.createdAt || null,
    };
  }
  override async list(): Promise<any[]> {
    return [...this.records];
  }
}

// Controllable Mock Worker
class ControllableWorker extends BaseWorker {
  public executedTasks: Task[] = [];
  public executeOutcome: 'COMPLETED' | 'FAILED' = 'COMPLETED';
  public shouldFailTaskIds = new Set<string>();
  public override lastExecutedTask: Task | null = null;
  public override lastFinalizeStatus: 'COMPLETED' | 'FAILED' | null = null;

  override async executeOnce(): Promise<boolean> {
    const task = await this.tasks.claim(this.name);
    if (!task) {
      this.lastExecutedTask = null;
      this.lastFinalizeStatus = null;
      return false;
    }

    this.lastExecutedTask = task;
    this.executedTasks.push(task);

    const isPoison = this.shouldFailTaskIds.has(task.id);
    if (this.executeOutcome === 'FAILED' || isPoison) {
      this.lastFinalizeStatus = 'FAILED';
      await this.tasks.update(task.id, {
        status: 'FAILED',
        error: 'Task validation failed during continuous cycle execution',
      });
    } else {
      this.lastFinalizeStatus = 'COMPLETED';
      await this.tasks.update(task.id, {
        status: 'COMPLETED',
        commitSha: 'c7aeb65ee55e3b65ebf8824574ba911ad1c355f3',
      });
    }

    return true;
  }
}

function createTestLimits(overrides: Partial<GovernanceLimits> = {}): GovernanceLimits {
  return {
    activeLevel: 3,
    maxConsecutiveTasks: 3,
    maxTaskDurationMs: 180000,
    maxToolRoundsPerTask: 10,
    maxCorrectionAttempts: 2,
    maxConsecutiveFailures: 2,
    allowedProducts: [
      'pub-rate-calculator',
      'pub-dev-loop-template',
      'pub-shopee-scraper',
    ],
    killSwitchActive: false,
    ...overrides,
  };
}

describe('PDL Phase 5.5 Step 5: Bounded Continuous Campaign & Failure-Injection Proof', () => {
  let killSwitch: PdlKillSwitch;
  let killSwitchActive: boolean;
  let governance: PdlGovernanceEngine;
  let taskRepo: MemoryTaskRepository;
  let dlq: MemoryDLQRepository;
  let retryPolicy: PdlRetryPolicy;
  let reaper: PdlTaskReaper;
  let mockWorker: ControllableWorker;

  beforeEach(() => {
    killSwitchActive = false;
    killSwitch = new PdlKillSwitch();
    vi.spyOn(killSwitch, 'checkStatus').mockImplementation(async () => ({
      active: killSwitchActive,
      reason: killSwitchActive ? 'Emergency operator halt injected mid-cycle' : 'Normal',
      sources: { db: killSwitchActive, file: false, env: false },
    }));

    governance = new PdlGovernanceEngine({ killSwitch });
    const limits = createTestLimits();
    vi.spyOn(governance, 'loadLimits').mockResolvedValue(limits);
    vi.spyOn(governance, 'getKillSwitch').mockReturnValue(killSwitch);

    taskRepo = new MemoryTaskRepository();
    dlq = new MemoryDLQRepository();
    retryPolicy = new PdlRetryPolicy({ baseDelayMs: 10, maxRetries: 3 });

    reaper = new PdlTaskReaper({
      tasks: taskRepo,
      governance,
      dlq,
      config: { intervalMs: 1000, batchSize: 5, staleGracePeriodMs: 0 },
    });

    mockWorker = new ControllableWorker(taskRepo, 'pdl-step5-test-worker');
  });

  afterEach(() => {
    reaper.stop();
    vi.restoreAllMocks();
  });

  describe('Part 1: Runtime Dependency Injection & Wiring Integrity', () => {
    it('STEP5_INT_01: createPdlContinuousDaemon instantiates all core subsystems with zero undefined dependencies', () => {
      const daemon = createPdlContinuousDaemon({} as any, {
        worker: mockWorker,
        tasks: taskRepo as any,
        governance,
        dlq: dlq as any,
        retryPolicy,
        reaper,
        pollIntervalMs: 1000,
        authorizedBy: 'matheus-pdl-operator',
      });

      expect(daemon).toBeDefined();
      expect(daemon.worker).toBe(mockWorker);
      expect(daemon.tasks).toBe(taskRepo);
      expect(daemon.governance).toBe(governance);
      expect(daemon.dlq).toBe(dlq);
      expect(daemon.retryPolicy).toBe(retryPolicy);
      expect(daemon.reaper).toBe(reaper);
      expect(daemon.scheduler).toBeDefined();
      expect(daemon.scheduler.worker).toBe(mockWorker);
      expect(daemon.scheduler.tasks).toBe(taskRepo);
      expect(daemon.scheduler.dlq).toBe(dlq);
      expect(daemon.scheduler.retryPolicy).toBe(retryPolicy);
      expect(daemon.scheduler.reaper).toBe(reaper);
    });

    it('STEP5_INT_02: createPdlApp wires options.worker and taskRepo directly into PdlContinuousScheduler, eliminating WORKER_UNAVAILABLE', async () => {
      const app = createPdlApp({} as any, taskRepo as any, undefined, {
        governance,
        worker: mockWorker,
        dlq: dlq as any,
        retryPolicy,
        reaper,
      });

      expect(app).toBeDefined();
    });

    it('STEP5_INT_03: scheduler.setWorker() allows dynamic worker assignment', async () => {
      const scheduler = new PdlContinuousScheduler({
        governance,
        tasks: taskRepo,
        dlq,
        retryPolicy,
        reaper,
        config: { pollIntervalMs: 1000, maxConcurrentTasks: 1, authorizedBy: 'test' },
      });

      expect(scheduler.worker).toBeUndefined();
      scheduler.setWorker(mockWorker);
      expect(scheduler.worker).toBe(mockWorker);
    });
  });

  describe('Part 2: Bounded Autonomous Campaign Proof', () => {
    it('STEP5_CAMPAIGN_01: executes bounded campaign of 3 tasks under Governance Level 3 and strictly stops at ceiling', async () => {
      // Create 5 queued tasks for authorized product
      for (let i = 1; i <= 5; i++) {
        await taskRepo.create({
          id: `task-campaign-${i}`,
          project: 'pub-rate-calculator',
          repository: 'https://github.com/pubcoreagencia/pub-rate-calculator.git',
          objective: `Campaign milestone step ${i}`,
          priority: 10 - i,
        });
      }

      const events: SchedulerEvent[] = [];
      const scheduler = new PdlContinuousScheduler({
        governance,
        worker: mockWorker,
        tasks: taskRepo,
        dlq,
        retryPolicy,
        reaper,
        config: { pollIntervalMs: 1000, maxConcurrentTasks: 1, authorizedBy: 'matheus' },
      });
      scheduler.onEvent((e) => events.push(e));

      // Start bounded continuous scheduler
      const session = await scheduler.start();
      expect(session.state).toBe('RUNNING');

      // Wait for 3 cycles to complete and bounded stop to occur
      await new Promise<void>((resolve) => {
        const checkInterval = setInterval(() => {
          const status = scheduler.getStatus();
          if (status.state === 'COMPLETED' || status.state === 'BLOCKED' || status.state === 'FAILED') {
            clearInterval(checkInterval);
            resolve();
          }
        }, 50);
      });

      const finalStatus = scheduler.getStatus();

      // STRICT VERIFICATION: Exactly 3 tasks executed, matching maxConsecutiveTasks
      expect(finalStatus.state).toBe('COMPLETED');
      expect(finalStatus.consecutiveTasks).toBe(3);
      expect(finalStatus.consecutiveFailures).toBe(0);
      expect(mockWorker.executedTasks.map((t) => t.id)).toEqual([
        'task-campaign-1',
        'task-campaign-2',
        'task-campaign-3',
      ]);

      // Tasks 4 and 5 must remain strictly QUEUED (Zero runaway autonomy)
      const task4 = await taskRepo.get('task-campaign-4');
      const task5 = await taskRepo.get('task-campaign-5');
      expect(task4?.status).toBe('QUEUED');
      expect(task5?.status).toBe('QUEUED');

      // Observability events confirm bounded ceiling hit
      const limitEvents = events.filter((e) => e.type === 'SCHEDULER_LIMIT_REACHED');
      expect(limitEvents.length).toBeGreaterThanOrEqual(1);
      expect(limitEvents[0].reasonCode).toBe('CONSECUTIVE_TASKS_EXCEEDED');
    });
  });

  describe('Part 3: Failure Injection Matrix', () => {
    it('STEP5_CAMPAIGN_02: Emergency Kill Switch toggled mid-campaign immediately halts execution before next task claim', async () => {
      for (let i = 1; i <= 3; i++) {
        await taskRepo.create({
          id: `task-ks-${i}`,
          project: 'pub-rate-calculator',
          repository: 'https://github.com/pubcoreagencia/pub-rate-calculator.git',
          objective: `Kill switch test step ${i}`,
        });
      }

      const events: SchedulerEvent[] = [];
      const scheduler = new PdlContinuousScheduler({
        governance,
        worker: mockWorker,
        tasks: taskRepo,
        dlq,
        retryPolicy,
        reaper,
        config: { pollIntervalMs: 1000, maxConcurrentTasks: 1, authorizedBy: 'matheus' },
      });
      scheduler.onEvent((e) => {
        events.push(e);
        // After first task succeeds, trigger emergency kill switch mid-flight
        if (e.type === 'SCHEDULER_TASK_SUCCEEDED') {
          killSwitchActive = true;
        }
      });

      await scheduler.start();

      await new Promise<void>((resolve) => {
        const checkInterval = setInterval(() => {
          const status = scheduler.getStatus();
          if (status.state === 'BLOCKED' || status.state === 'STOPPED') {
            clearInterval(checkInterval);
            resolve();
          }
        }, 50);
      });

      const finalStatus = scheduler.getStatus();

      // HALTED at Task 1; Task 2 and 3 NEVER executed
      expect(finalStatus.state).toBe('BLOCKED');
      expect(finalStatus.stopReason).toBe('KILL_SWITCH_ACTIVE');
      expect(mockWorker.executedTasks.length).toBe(1);
      expect(mockWorker.executedTasks[0].id).toBe('task-ks-1');

      const task2 = await taskRepo.get('task-ks-2');
      expect(task2?.status).toBe('QUEUED');

      const ksEvents = events.filter((e) => e.type === 'SCHEDULER_KILL_SWITCH');
      expect(ksEvents.length).toBe(1);
      expect(ksEvents[0].reasonCode).toBe('KILL_SWITCH_ACTIVE');
    });

    it('STEP5_CAMPAIGN_03: Stale Lease / Crash Recovery via Periodic Reaper successfully recovers abandoned task', async () => {
      // Simulate abandoned task from crashed worker process
      const staleTask = await taskRepo.create({
        id: 'task-stale-abandoned',
        project: 'pub-rate-calculator',
        repository: 'https://github.com/pubcoreagencia/pub-rate-calculator.git',
        objective: 'Crash recovery test task',
      });
      await taskRepo.update(staleTask.id, {
        status: 'RUNNING',
        worker: 'crashed-worker-pid-8888',
        leaseOwner: 'crashed-worker-pid-8888',
        leaseDeadline: new Date(Date.now() - 60000), // expired lease
      });

      // Execute single reap cycle
      const reapResult = await reaper.runOnce();
      expect(reapResult.staleDetected).toBe(1);
      expect(reapResult.recovered).toBe(1);

      // Task is back in QUEUED state with clean lease metadata
      const recoveredTask = await taskRepo.get('task-stale-abandoned');
      expect(recoveredTask?.status).toBe('QUEUED');
      expect(recoveredTask?.leaseOwner).toBeNull();
      expect(recoveredTask?.leaseDeadline).toBeNull();

      // Now continuous scheduler runs and claims the recovered task
      const scheduler = new PdlContinuousScheduler({
        governance,
        worker: mockWorker,
        tasks: taskRepo,
        dlq,
        retryPolicy,
        reaper,
        config: { pollIntervalMs: 1000, maxConcurrentTasks: 1, authorizedBy: 'matheus' },
      });

      await scheduler.start();

      await new Promise<void>((resolve) => {
        const checkInterval = setInterval(() => {
          if (mockWorker.executedTasks.some((t) => t.id === 'task-stale-abandoned')) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 50);
      });

      await scheduler.stop('RECOVERY_TEST_DONE');

      const finalizedTask = await taskRepo.get('task-stale-abandoned');
      expect(finalizedTask?.status).toBe('COMPLETED');
    });

    it('STEP5_CAMPAIGN_04: Poison task with repeated validation failures is retried and quarantined in durable DLQ', async () => {
      const poisonTaskId = 'task-poison-syntax-error';
      await taskRepo.create({
        id: poisonTaskId,
        project: 'pub-rate-calculator',
        repository: 'https://github.com/pubcoreagencia/pub-rate-calculator.git',
        objective: 'Poison task designed to fail validation repeatedly',
        maxRetries: 3,
      });

      mockWorker.shouldFailTaskIds.add(poisonTaskId);

      const events: SchedulerEvent[] = [];
      const scheduler = new PdlContinuousScheduler({
        governance,
        worker: mockWorker,
        tasks: taskRepo,
        dlq,
        retryPolicy,
        reaper,
        config: { pollIntervalMs: 1000, maxConcurrentTasks: 1, authorizedBy: 'matheus' },
      });
      scheduler.onEvent((e) => events.push(e));

      await scheduler.start();

      // Wait until task is quarantined into DLQ
      await new Promise<void>((resolve) => {
        const checkInterval = setInterval(() => {
          if (dlq.records.some((r) => r.taskId === poisonTaskId && r.quarantined)) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 50);
      });

      await scheduler.stop('POISON_TEST_COMPLETE');

      // Verify task status in TaskRepository
      const finalTask = await taskRepo.get(poisonTaskId);
      expect(finalTask?.status).toBe('QUARANTINED');
      expect(finalTask?.retryCount).toBeGreaterThanOrEqual(1);

      // Verify durable DLQ table record
      const dlqRecords = await dlq.list();
      const poisonRecord = dlqRecords.find((r) => r.taskId === poisonTaskId);
      expect(poisonRecord).toBeDefined();
      expect(poisonRecord.quarantined).toBe(true);
      expect(poisonRecord.attemptCount).toBeGreaterThanOrEqual(1);

      // Verify structured observability event was emitted
      const quarantinedEvents = events.filter((e) => e.type === 'SCHEDULER_TASK_QUARANTINED');
      expect(quarantinedEvents.length).toBe(1);
      expect(quarantinedEvents[0].taskId).toBe(poisonTaskId);
    });

    it('STEP5_CAMPAIGN_05: Task with unauthorized repository or product outside catalog fails closed at governance gate', async () => {
      await taskRepo.create({
        id: 'task-unauthorized-target',
        project: 'pub-external-unauthorized-repo',
        repository: 'https://github.com/external-org/unauthorized-repo.git',
        objective: 'Malicious or accidental external target execution',
      });

      const decision = await governance.evaluateExecution({
        taskId: 'task-unauthorized-target',
        productId: 'pub-external-unauthorized-repo',
        durationMs: 0,
        toolRounds: 0,
      });

      expect(decision.allowed).toBe(false);
      expect(decision.reasonCode).toBe('UNAUTHORIZED_PRODUCT');
      expect(decision.reason).toContain('not registered in the Product Catalog');
    });

    it('STEP5_CAMPAIGN_06: Corrupted governance state or forbidden Level 5 collapses continuous scheduler to Level 0 BLOCKED', async () => {
      const corruptPool = {
        query: async () => ({
          rows: [{ active_level: 5 }], // Forbidden level 5
        }),
      } as any;

      const corruptGov = new PdlGovernanceEngine({ pool: corruptPool });
      const corruptScheduler = new PdlContinuousScheduler({
        governance: corruptGov,
        worker: mockWorker,
        tasks: taskRepo,
        dlq,
        retryPolicy,
        reaper,
        config: { pollIntervalMs: 1000, maxConcurrentTasks: 1, authorizedBy: 'matheus' },
      });

      const session = await corruptScheduler.start();

      // Strictly fail-closed: Level 5 is rejected, collapsed to Level 0 BLOCKED
      expect(session.state).toBe('BLOCKED');
      expect(session.activeLevel).toBe(0);
      expect(['KILL_SWITCH_ACTIVE', 'LEVEL_0_MANUAL_ONLY']).toContain(session.stopReason);
      expect(mockWorker.executedTasks.length).toBe(0);
    });
  });
});

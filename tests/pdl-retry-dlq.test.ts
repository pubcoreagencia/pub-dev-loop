/**
 * Phase 5.5 Step 3 Test Suite: Retry Policy, Dead-Letter Queue & Poison Task Quarantine.
 *
 * Tests RETRY_01 through RETRY_30 covering failure classification,
 * bounded backoff, poison isolation, idempotent DLQ, and continuous scheduler integration.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Server } from 'node:http';
import type { Task, TaskRepository } from '../src/domain.js';
import {
  PdlGovernanceEngine,
} from '../src/pdl/governance/index.js';
import {
  PdlContinuousScheduler,
  SchedulerSessionRepository,
  type SchedulerEvent,
} from '../src/pdl/scheduler/index.js';
import {
  PdlRetryClassifier,
  PdlRetryPolicy,
} from '../src/pdl/retry/index.js';
import {
  PdlDeadLetterRepository,
} from '../src/pdl/dlq/index.js';
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
  active_level: 3,
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
    id: 'task-test-retry-1',
    project: 'pub-rate-calculator',
    repository: 'https://github.com/pubcoreagencia/pub-rate-calculator.git',
    objective: 'Test retry and DLQ policy',
    prompt: 'Execute retry and DLQ test',
    status: 'QUEUED',
    priority: 1,
    worker: null,
    result: null,
    error: null,
    branch: 'retry-test',
    commitSha: '2053d3349cff31b6458fa93187e22ed48ce5c620',
    gitStatus: 'clean',
    createdAt: new Date(),
    updatedAt: new Date(),
    leaseOwner: null,
    leaseDeadline: null,
    heartbeatAt: null,
    workspacePath: null,
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

  async claim(workerName: string): Promise<Task | null> {
    const now = new Date();
    for (const t of this.tasks.values()) {
      if (t.status === 'QUARANTINED') continue;
      if (t.nextRetryAt && t.nextRetryAt > now) continue;
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
    Object.assign(t, patch, { updatedAt: new Date() });
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
  public errorToReport = 'Simulated task failure';
  public executeCallCount = 0;

  override async executeOnce(): Promise<boolean> {
    const task = await this.tasks.claim(this.name);
    if (!task) {
      this.lastExecutedTask = null;
      return false;
    }

    this.executeCallCount++;
    this.lastFinalizeStatus = this.executeOutcome;
    this.lastExecutedTask = {
      ...task,
      status: this.executeOutcome === 'COMPLETED' ? 'COMPLETED' : 'FAILED',
      error: this.executeOutcome === 'FAILED' ? this.errorToReport : null,
    };

    await this.tasks.update(task.id, {
      status: this.lastExecutedTask.status,
      error: this.lastExecutedTask.error,
    });

    return true;
  }
}

describe('Phase 5.5 Step 3: Retry Policy, DLQ & Quarantine Test Suite', () => {
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

  // --- FAILURE CLASSIFICATION TAXONOMY (RETRY_01 - RETRY_12) ---

  it('RETRY_01: Failure classification: recognizes PROVIDER_TIMEOUT as RETRYABLE', () => {
    const task = createDummyTask();
    const classification = PdlRetryClassifier.classify(task, new Error('Request timed out: 504 Gateway Timeout'));
    expect(classification.failureClass).toBe('RETRYABLE');
    expect(classification.failureCode).toBe('PROVIDER_TIMEOUT');
    expect(classification.isPoison).toBe(false);
  });

  it('RETRY_02: Failure classification: recognizes PROVIDER_429 as RETRYABLE', () => {
    const task = createDummyTask();
    const classification = PdlRetryClassifier.classify(task, { code: 'PROVIDER_429', message: 'Rate limit exceeded: 429' });
    expect(classification.failureClass).toBe('RETRYABLE');
    expect(classification.failureCode).toBe('PROVIDER_429');
  });

  it('RETRY_03: Failure classification: recognizes PROVIDER_5XX as RETRYABLE', () => {
    const task = createDummyTask();
    const classification = PdlRetryClassifier.classify(task, new Error('502 Bad Gateway from upstream model provider'));
    expect(classification.failureClass).toBe('RETRYABLE');
    expect(classification.failureCode).toBe('PROVIDER_5XX');
  });

  it('RETRY_04: Failure classification: recognizes transient network blips (ECONNRESET) as RETRYABLE', () => {
    const task = createDummyTask();
    const classification = PdlRetryClassifier.classify(task, new Error('read ECONNRESET at TCP.onStreamRead'));
    expect(classification.failureClass).toBe('RETRYABLE');
    expect(classification.failureCode).toBe('TRANSIENT_NETWORK_FAILURE');
  });

  it('RETRY_05: Failure classification: recognizes temporary workspace or db lock as RETRYABLE', () => {
    const task = createDummyTask();
    const workspaceErr = PdlRetryClassifier.classify(task, new Error('EBUSY: resource locked or temporary workspace failure'));
    expect(workspaceErr.failureClass).toBe('RETRYABLE');
    expect(workspaceErr.failureCode).toBe('TEMPORARY_WORKSPACE_FAILURE');

    const dbErr = PdlRetryClassifier.classify(task, new Error('deadlock detected on query lock'));
    expect(dbErr.failureClass).toBe('RETRYABLE');
    expect(dbErr.failureCode).toBe('TEMPORARY_DATABASE_FAILURE');
  });

  it('RETRY_06: Failure classification: recognizes INVALID_EXECUTION_SPEC as NON_RETRYABLE', () => {
    const task = createDummyTask();
    const classification = PdlRetryClassifier.classify(task, new Error('ExecutionSpecValidationError: missing required field'));
    expect(classification.failureClass).toBe('NON_RETRYABLE');
    expect(classification.failureCode).toBe('INVALID_EXECUTION_SPEC');
    expect(classification.isPoison).toBe(false);
  });

  it('RETRY_07: Failure classification: recognizes UNAUTHORIZED_REPOSITORY and UNAUTHORIZED_PRODUCT as NON_RETRYABLE', () => {
    const task = createDummyTask();
    const repoErr = PdlRetryClassifier.classify(task, new Error('unauthorized repository access denied'));
    expect(repoErr.failureClass).toBe('NON_RETRYABLE');
    expect(repoErr.failureCode).toBe('UNAUTHORIZED_REPOSITORY');

    const prodErr = PdlRetryClassifier.classify(task, new Error('product not authorized: product not in catalog'));
    expect(prodErr.failureClass).toBe('NON_RETRYABLE');
    expect(prodErr.failureCode).toBe('UNAUTHORIZED_PRODUCT');
  });

  it('RETRY_08: Failure classification: recognizes PAID_MODEL_REJECTED (FREE MODELS ONLY) as NON_RETRYABLE', () => {
    const task = createDummyTask();
    const classification = PdlRetryClassifier.classify(task, new Error('paid model rejected by FREE MODELS ONLY policy'));
    expect(classification.failureClass).toBe('NON_RETRYABLE');
    expect(classification.failureCode).toBe('PAID_MODEL_REJECTED');
  });

  it('RETRY_09: Failure classification: recognizes KILL_SWITCH_ACTIVE as NON_RETRYABLE', () => {
    const task = createDummyTask();
    const classification = PdlRetryClassifier.classify(task, new Error('Emergency kill switch is currently active'));
    expect(classification.failureClass).toBe('NON_RETRYABLE');
    expect(classification.failureCode).toBe('KILL_SWITCH_ACTIVE');
  });

  it('RETRY_10: Failure classification: recognizes SECURITY_POLICY_FAILURE as NON_RETRYABLE', () => {
    const task = createDummyTask();
    const classification = PdlRetryClassifier.classify(task, new Error('security policy violation: path traversal detected'));
    expect(classification.failureClass).toBe('NON_RETRYABLE');
    expect(classification.failureCode).toBe('SECURITY_POLICY_FAILURE');
  });

  it('RETRY_11: Failure classification: recognizes poison errors as POISON', () => {
    const task = createDummyTask();
    const poison1 = PdlRetryClassifier.classify(task, { code: 'UNRECOVERABLE_EXECUTION_FAILURE', message: 'fatal unrecoverable execution crash' });
    expect(poison1.failureClass).toBe('POISON');
    expect(poison1.isPoison).toBe(true);

    const poison2 = PdlRetryClassifier.classify(task, new Error('infinite loop detected during transformation'));
    expect(poison2.failureClass).toBe('POISON');
    expect(poison2.isPoison).toBe(true);
  });

  it('RETRY_12: Failure classification: recognizes repeated syntax/validation failure on retry as POISON', () => {
    const task = createDummyTask({ retryCount: 2 });
    const classification = PdlRetryClassifier.classify(task, new Error('syntax error in generated diff'));
    expect(classification.failureClass).toBe('POISON');
    expect(classification.failureCode).toBe('REPEATED_VALIDATION_FAILURE');
    expect(classification.isPoison).toBe(true);
  });

  // --- EXPONENTIAL BACKOFF & POLICY EVALUATION (RETRY_13 - RETRY_18) ---

  it('RETRY_13: Exponential backoff: computes correct exponential delays', () => {
    const policy = new PdlRetryPolicy({ baseDelayMs: 2000, factor: 2, maxDelayMs: 60000, jitterMs: 0 });
    expect(policy.computeBackoff(0)).toBe(2000);
    expect(policy.computeBackoff(1)).toBe(4000);
    expect(policy.computeBackoff(2)).toBe(8000);
    expect(policy.computeBackoff(3)).toBe(16000);
    expect(policy.computeBackoff(4)).toBe(32000);
  });

  it('RETRY_14: Exponential backoff: strictly caps delay at maxDelayMs', () => {
    const policy = new PdlRetryPolicy({ baseDelayMs: 2000, factor: 2, maxDelayMs: 60000, jitterMs: 0 });
    expect(policy.computeBackoff(5)).toBe(60000);
    expect(policy.computeBackoff(10)).toBe(60000);
  });

  it('RETRY_15: Policy evaluation: yields RETRY action with nextRetryAt for transient error within limit', () => {
    const policy = new PdlRetryPolicy({ baseDelayMs: 3000, factor: 2, maxRetries: 3, jitterMs: 0 });
    const task = createDummyTask({ retryCount: 1, maxRetries: 3 });
    const fixedNow = new Date('2026-09-12T12:00:00.000Z');

    const decision = policy.evaluate(task, new Error('503 Service Unavailable'), { now: fixedNow });
    expect(decision.action).toBe('RETRY');
    expect(decision.failureClass).toBe('RETRYABLE');
    expect(decision.attemptCount).toBe(2);
    expect(decision.delayMs).toBe(6000); // 3000 * 2^1
    expect(decision.nextRetryAt?.toISOString()).toBe('2026-09-12T12:00:06.000Z');
  });

  it('RETRY_16: Policy evaluation: yields DEAD_LETTER action when retryCount exceeds maxRetries', () => {
    const policy = new PdlRetryPolicy({ maxRetries: 3 });
    const task = createDummyTask({ retryCount: 3, maxRetries: 3 });

    const decision = policy.evaluate(task, new Error('ECONNRESET network blip'));
    expect(decision.action).toBe('DEAD_LETTER');
    expect(decision.failureClass).toBe('RETRYABLE');
    expect(decision.failureCode).toBe('MAX_RETRIES_EXCEEDED');
    expect(decision.attemptCount).toBe(4);
  });

  it('RETRY_17: Policy evaluation: yields DEAD_LETTER action immediately for non-retryable failures', () => {
    const policy = new PdlRetryPolicy();
    const task = createDummyTask({ retryCount: 0 });

    const decision = policy.evaluate(task, new Error('paid model rejected by FREE MODELS ONLY policy'));
    expect(decision.action).toBe('DEAD_LETTER');
    expect(decision.failureClass).toBe('NON_RETRYABLE');
    expect(decision.failureCode).toBe('PAID_MODEL_REJECTED');
  });

  it('RETRY_18: Policy evaluation: yields QUARANTINE action immediately for poison tasks', () => {
    const policy = new PdlRetryPolicy();
    const task = createDummyTask({ retryCount: 0 });

    const decision = policy.evaluate(task, new Error('poison task: infinite loop in AST transform'));
    expect(decision.action).toBe('QUARANTINE');
    expect(decision.failureClass).toBe('POISON');
    expect(decision.attemptCount).toBe(1);
  });

  // --- DEAD-LETTER QUEUE REPOSITORY (RETRY_19 - RETRY_22) ---

  it('RETRY_19: DLQ Repository: successfully records dead-letter record and returns record', async () => {
    const dlq = new PdlDeadLetterRepository();
    const record = await dlq.record({
      taskId: 'task-dlq-1',
      repository: 'https://github.com/pubcoreagencia/pub-rate-calculator.git',
      product: 'pub-rate-calculator',
      failureCode: 'MAX_RETRIES_EXCEEDED',
      failureClass: 'RETRYABLE',
      attemptCount: 4,
      reason: 'Exceeded max retries',
      quarantined: false,
    });

    expect(record.id).toBeDefined();
    expect(record.taskId).toBe('task-dlq-1');
    expect(record.status).toBe('UNRESOLVED');
    expect(record.quarantined).toBe(false);

    const retrieved = await dlq.getByTaskId('task-dlq-1');
    expect(retrieved.length).toBe(1);
    expect(retrieved[0].id).toBe(record.id);
  });

  it('RETRY_20: DLQ Repository: idempotent storage — duplicate (taskId, attemptCount) does not duplicate', async () => {
    const dlq = new PdlDeadLetterRepository();
    const first = await dlq.record({
      taskId: 'task-idempotent-1',
      repository: 'https://github.com/pubcoreagencia/pub-rate-calculator.git',
      product: 'pub-rate-calculator',
      failureCode: 'PROVIDER_TIMEOUT',
      failureClass: 'RETRYABLE',
      attemptCount: 1,
      reason: 'First attempt failure',
    });

    const second = await dlq.record({
      taskId: 'task-idempotent-1',
      repository: 'https://github.com/pubcoreagencia/pub-rate-calculator.git',
      product: 'pub-rate-calculator',
      failureCode: 'PROVIDER_TIMEOUT',
      failureClass: 'RETRYABLE',
      attemptCount: 1,
      reason: 'Duplicate call attempt',
    });

    expect(second.id).toBe(first.id);
    const records = await dlq.getByTaskId('task-idempotent-1');
    expect(records.length).toBe(1);
  });

  it('RETRY_21: DLQ Repository: provides accurate aggregated metrics in getStatus()', async () => {
    const dlq = new PdlDeadLetterRepository();
    await dlq.record({
      taskId: 'task-stat-1',
      repository: 'repo',
      product: 'pub-rate-calculator',
      failureCode: 'MAX_RETRIES_EXCEEDED',
      failureClass: 'RETRYABLE',
      attemptCount: 4,
      reason: 'Max retries',
      quarantined: false,
    });
    await dlq.record({
      taskId: 'task-stat-2',
      repository: 'repo',
      product: 'pub-shopee-scraper',
      failureCode: 'REPEATED_VALIDATION_FAILURE',
      failureClass: 'POISON',
      attemptCount: 2,
      reason: 'Poison validation',
      quarantined: true,
    });

    const status = await dlq.getStatus();
    expect(status.totalCount).toBe(2);
    expect(status.quarantinedCount).toBe(1);
    expect(status.unresolvedCount).toBe(2);
    expect(status.byFailureClass['RETRYABLE']).toBe(1);
    expect(status.byFailureClass['POISON']).toBe(1);
    expect(status.byProduct['pub-rate-calculator']).toBe(1);
    expect(status.byProduct['pub-shopee-scraper']).toBe(1);
  });

  it('RETRY_22: DLQ Repository: supports resolution workflow updating status and timestamp', async () => {
    const dlq = new PdlDeadLetterRepository();
    const record = await dlq.record({
      taskId: 'task-resolve-1',
      repository: 'repo',
      product: 'pub-rate-calculator',
      failureCode: 'INVALID_EXECUTION_SPEC',
      failureClass: 'NON_RETRYABLE',
      attemptCount: 1,
      reason: 'Invalid spec',
    });

    const resolved = await dlq.resolve(record.id, 'Manually corrected spec and re-queued');
    expect(resolved).not.toBeNull();
    expect(resolved?.status).toBe('RESOLVED');
    expect(resolved?.resolution).toBe('Manually corrected spec and re-queued');
    expect(resolved?.resolvedAt).toBeInstanceOf(Date);
  });

  // --- QUARANTINE ISOLATION & CLAIM ENFORCEMENT (RETRY_23 - RETRY_24) ---

  it('RETRY_23: Quarantine isolation: quarantined tasks have status QUARANTINED and are never claimed', async () => {
    const quarantinedTask = createDummyTask({
      id: 'task-quarantined-1',
      status: 'QUARANTINED',
      quarantinedAt: new Date(),
      quarantineReason: 'Poison detected',
    });
    const repo = new TestTaskRepo([quarantinedTask]);

    const claimed = await repo.claim('worker-test');
    expect(claimed).toBeNull();

    // Verify task remains untouched
    const t = await repo.get('task-quarantined-1');
    expect(t?.status).toBe('QUARANTINED');
  });

  it('RETRY_24: Delayed retry enforcement: tasks with future nextRetryAt are NOT claimed until delay elapses', async () => {
    const futureTime = new Date(Date.now() + 60000); // 1 minute in the future
    const delayedTask = createDummyTask({
      id: 'task-delayed-1',
      status: 'QUEUED',
      retryCount: 1,
      nextRetryAt: futureTime,
    });
    const repo = new TestTaskRepo([delayedTask]);

    // Should NOT be claimed because nextRetryAt > now
    const claimedBefore = await repo.claim('worker-test');
    expect(claimedBefore).toBeNull();

    // Fast-forward nextRetryAt to past
    await repo.update('task-delayed-1', { nextRetryAt: new Date(Date.now() - 1000) });

    // Should now be claimed
    const claimedAfter = await repo.claim('worker-test');
    expect(claimedAfter).not.toBeNull();
    expect(claimedAfter?.id).toBe('task-delayed-1');
  });

  // --- CONTINUOUS SCHEDULER RETRY/DLQ INTEGRATION (RETRY_25 - RETRY_28) ---

  it('RETRY_25: Scheduler integration: schedules retry for transient failure and emits SCHEDULER_TASK_RETRY_SCHEDULED', async () => {
    const task = createDummyTask({ id: 'task-transient-1', retryCount: 0, maxRetries: 3 });
    const repo = new TestTaskRepo([task]);
    const pool = createMockPool([baseGovRow]);
    const gov = new PdlGovernanceEngine({ pool });
    const worker = new MockWorker(repo, 'worker-transient', undefined, gov);
    worker.executeOutcome = 'FAILED';
    worker.errorToReport = '504 Gateway Timeout from LLM provider';

    const events: SchedulerEvent[] = [];
    const scheduler = new PdlContinuousScheduler({
      governance: gov,
      worker,
      tasks: repo,
      config: { pollIntervalMs: 1000, authorizedBy: 'test-runner' },
    });
    scheduler.onEvent((e) => events.push(e));

    await scheduler.start();
    await new Promise<void>((resolve) => {
      scheduler.onEvent((e) => {
        if (e.type === 'SCHEDULER_TASK_RETRY_SCHEDULED') resolve();
      });
      setTimeout(resolve, 300);
    });
    await scheduler.stop('TEST_STOP');
    await scheduler.waitForCompletion();

    const retryEvent = events.find((e) => e.type === 'SCHEDULER_TASK_RETRY_SCHEDULED');
    expect(retryEvent).toBeDefined();
    expect(retryEvent?.taskId).toBe('task-transient-1');
    expect(retryEvent?.reasonCode).toBe('PROVIDER_TIMEOUT');
    expect(retryEvent?.details?.retryCount).toBe(1);

    // Verify task state in repository
    const updated = await repo.get('task-transient-1');
    expect(updated?.status).toBe('QUEUED');
    expect(updated?.retryCount).toBe(1);
    expect(updated?.nextRetryAt).toBeInstanceOf(Date);
    expect(updated?.lastFailureCode).toBe('PROVIDER_TIMEOUT');
  });

  it('RETRY_26: Scheduler integration: isolates poison failure to quarantine and DLQ', async () => {
    const task = createDummyTask({ id: 'task-poison-1', retryCount: 0 });
    const repo = new TestTaskRepo([task]);
    const dlq = new PdlDeadLetterRepository();
    const pool = createMockPool([baseGovRow]);
    const gov = new PdlGovernanceEngine({ pool });
    const worker = new MockWorker(repo, 'worker-poison', undefined, gov);
    worker.executeOutcome = 'FAILED';
    worker.errorToReport = 'poison task: unrecoverable syntax corruption loop';

    const events: SchedulerEvent[] = [];
    const scheduler = new PdlContinuousScheduler({
      governance: gov,
      worker,
      tasks: repo,
      dlq,
      config: { pollIntervalMs: 1000, authorizedBy: 'test-runner' },
    });
    scheduler.onEvent((e) => events.push(e));

    await scheduler.start();
    await new Promise<void>((resolve) => {
      scheduler.onEvent((e) => {
        if (e.type === 'SCHEDULER_TASK_QUARANTINED') resolve();
      });
      setTimeout(resolve, 300);
    });
    await scheduler.stop('TEST_STOP');
    await scheduler.waitForCompletion();

    const quarantineEvent = events.find((e) => e.type === 'SCHEDULER_TASK_QUARANTINED');
    const dlqEvent = events.find((e) => e.type === 'SCHEDULER_TASK_DEAD_LETTERED');
    expect(quarantineEvent).toBeDefined();
    expect(dlqEvent).toBeDefined();
    expect(quarantineEvent?.taskId).toBe('task-poison-1');

    // Verify task was quarantined and NOT requeued
    const updated = await repo.get('task-poison-1');
    expect(updated?.status).toBe('QUARANTINED');
    expect(updated?.quarantinedAt).toBeInstanceOf(Date);

    // Verify recorded in DLQ
    const dlqRecords = await dlq.getByTaskId('task-poison-1');
    expect(dlqRecords.length).toBe(1);
    expect(dlqRecords[0].quarantined).toBe(true);
    expect(dlqRecords[0].failureClass).toBe('POISON');
  });

  it('RETRY_27: Scheduler integration: moves exhausted task to DLQ upon exceeding max retries', async () => {
    const task = createDummyTask({ id: 'task-exhaust-1', retryCount: 3, maxRetries: 3 });
    const repo = new TestTaskRepo([task]);
    const dlq = new PdlDeadLetterRepository();
    const pool = createMockPool([baseGovRow]);
    const gov = new PdlGovernanceEngine({ pool });
    const worker = new MockWorker(repo, 'worker-exhaust', undefined, gov);
    worker.executeOutcome = 'FAILED';
    worker.errorToReport = 'ETIMEDOUT connection lost';

    const events: SchedulerEvent[] = [];
    const scheduler = new PdlContinuousScheduler({
      governance: gov,
      worker,
      tasks: repo,
      dlq,
      config: { pollIntervalMs: 1000, authorizedBy: 'test-runner' },
    });
    scheduler.onEvent((e) => events.push(e));

    await scheduler.start();
    await new Promise<void>((resolve) => {
      scheduler.onEvent((e) => {
        if (e.type === 'SCHEDULER_TASK_DEAD_LETTERED') resolve();
      });
      setTimeout(resolve, 300);
    });
    await scheduler.stop('TEST_STOP');
    await scheduler.waitForCompletion();

    const dlqEvent = events.find((e) => e.type === 'SCHEDULER_TASK_DEAD_LETTERED');
    expect(dlqEvent).toBeDefined();
    expect(dlqEvent?.reasonCode).toBe('MAX_RETRIES_EXCEEDED');

    // Task should be in FAILED status, marked deadLettered
    const updated = await repo.get('task-exhaust-1');
    expect(updated?.status).toBe('FAILED');
    expect(updated?.deadLetteredAt).toBeInstanceOf(Date);

    // DLQ should have unquarantined record
    const dlqRecords = await dlq.getByTaskId('task-exhaust-1');
    expect(dlqRecords.length).toBe(1);
    expect(dlqRecords[0].quarantined).toBe(false);
  });

  it('RETRY_28: Observability zero-secret redaction: secrets in retry/DLQ events are redacted', async () => {
    const task = createDummyTask({ id: 'task-secret-1' });
    const repo = new TestTaskRepo([task]);
    const pool = createMockPool([baseGovRow]);
    const gov = new PdlGovernanceEngine({ pool });
    const worker = new MockWorker(repo, 'worker-secret', undefined, gov);
    worker.executeOutcome = 'FAILED';
    worker.errorToReport = '500 internal error with token: ghp_1234567890abcdef1234567890abcdef123456';

    const events: SchedulerEvent[] = [];
    const scheduler = new PdlContinuousScheduler({
      governance: gov,
      worker,
      tasks: repo,
      config: { pollIntervalMs: 1000, authorizedBy: 'test-runner' },
    });
    scheduler.onEvent((e) => events.push(e));

    await scheduler.start();
    await new Promise<void>((resolve) => {
      scheduler.onEvent((e) => {
        if (e.type === 'SCHEDULER_TASK_FAILED') resolve();
      });
      setTimeout(resolve, 300);
    });
    await scheduler.stop('TEST_STOP');
    await scheduler.waitForCompletion();

    const failedEvent = events.find((e) => e.type === 'SCHEDULER_TASK_FAILED');
    expect(failedEvent).toBeDefined();
    const rawDetails = JSON.stringify(failedEvent?.details);
    expect(rawDetails).not.toContain('ghp_1234567890abcdef1234567890abcdef123456');
  });

  // --- API ENDPOINTS & RBAC (RETRY_29 - RETRY_30) ---

  it('RETRY_29: API endpoint: GET /dlq/status enforces READ authorization and returns DLQ metrics', async () => {
    const dlq = new PdlDeadLetterRepository();
    await dlq.record({
      taskId: 'task-api-1',
      repository: 'repo',
      product: 'pub-rate-calculator',
      failureCode: 'MAX_RETRIES_EXCEEDED',
      failureClass: 'RETRYABLE',
      attemptCount: 4,
      reason: 'Exhausted',
    });

    const app = createPdlApp(undefined, undefined, undefined, {
      dlq,
      authConfig: {
        readKey: 'valid-read-token',
        adminKey: 'valid-admin-token',
      },
    });

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        port = (server!.address() as any).port;
        resolve();
      });
    });

    // 1. Unauthenticated request -> 401
    const resNoAuth = await fetch(`http://127.0.0.1:${port}/dlq/status`);
    expect(resNoAuth.status).toBe(401);

    // 2. Authenticated request -> 200 with DLQ metrics
    const resAuth = await fetch(`http://127.0.0.1:${port}/dlq/status`, {
      headers: { Authorization: 'Bearer valid-read-token' },
    });
    expect(resAuth.status).toBe(200);
    const body = await resAuth.json();
    expect(body.service).toBe('pdl-api');
    expect(body.dlq.totalCount).toBe(1);
    expect(body.dlq.unresolvedCount).toBe(1);
  });

  it('RETRY_30: API endpoint: GET /dlq/records filters records by taskId, failureClass, or quarantined', async () => {
    const dlq = new PdlDeadLetterRepository();
    await dlq.record({
      taskId: 'task-filter-1',
      repository: 'repo',
      product: 'pub-rate-calculator',
      failureCode: 'MAX_RETRIES_EXCEEDED',
      failureClass: 'RETRYABLE',
      attemptCount: 4,
      reason: 'Retryable exhausted',
      quarantined: false,
    });
    await dlq.record({
      taskId: 'task-filter-2',
      repository: 'repo',
      product: 'pub-shopee-scraper',
      failureCode: 'REPEATED_VALIDATION_FAILURE',
      failureClass: 'POISON',
      attemptCount: 2,
      reason: 'Poison quarantine',
      quarantined: true,
    });

    const app = createPdlApp(undefined, undefined, undefined, {
      dlq,
      authConfig: {
        readKey: 'valid-read-token',
        adminKey: 'valid-admin-token',
      },
    });

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        port = (server!.address() as any).port;
        resolve();
      });
    });

    // Filter by quarantined=true
    const resQ = await fetch(`http://127.0.0.1:${port}/dlq/records?quarantined=true`, {
      headers: { Authorization: 'Bearer valid-read-token' },
    });
    expect(resQ.status).toBe(200);
    const bodyQ = await resQ.json();
    expect(bodyQ.count).toBe(1);
    expect(bodyQ.records[0].taskId).toBe('task-filter-2');
    expect(bodyQ.records[0].quarantined).toBe(true);

    // Filter by taskId
    const resTask = await fetch(`http://127.0.0.1:${port}/dlq/records?taskId=task-filter-1`, {
      headers: { Authorization: 'Bearer valid-read-token' },
    });
    expect(resTask.status).toBe(200);
    const bodyTask = await resTask.json();
    expect(bodyTask.count).toBe(1);
    expect(bodyTask.records[0].taskId).toBe('task-filter-1');
  });
});

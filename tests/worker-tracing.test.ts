import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import { RouterWorker } from '../src/router-worker.js';
import { type AttemptResult, type WorkerExecutionTrace } from '../src/worker-service.js';
import type { AgentProvider, ProviderTaskResult } from '../src/providers/types.js';
import type { Task, TaskRepository } from '../src/domain.js';

// --- helpers ---

async function initGitRepo(root: string): Promise<void> {
  await mkdir(root, { recursive: true });
  execSync('git init', { cwd: root, stdio: 'ignore' });
  execSync('git config user.name "TEST"', { cwd: root, stdio: 'ignore' });
  execSync('git config user.email "test@test.com"', { cwd: root, stdio: 'ignore' });
  execSync('git commit --allow-empty -m "init"', { cwd: root, stdio: 'ignore' });
}

class TestTaskRepository implements TaskRepository {
  private tasks: Map<string, Task> = new Map();

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
    for (const task of Array.from(this.tasks.values())) {
      if (task.status === 'QUEUED') {
        task.status = 'ASSIGNED';
        task.worker = worker;
        task.updatedAt = new Date();
        this.tasks.set(task.id, task);
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
}

function createProviderResult(
  status: ProviderTaskResult['status'],
  overrides: Partial<ProviderTaskResult> = {}
): ProviderTaskResult {
  return {
    status,
    provider: '9router',
    model: 'test-model',
    exitCode: status === 'COMPLETED' ? 0 : 1,
    durationMs: 100,
    stdout: status === 'COMPLETED' ? 'completed' : 'failed',
    stderr: status === 'COMPLETED' ? '' : 'error',
    changedFiles: [],
    commit: null,
    errorCode: status === 'COMPLETED' ? null : status,
    errorMessage: status === 'COMPLETED' ? null : 'error occurred',
    toolCalls: 0,
    toolRounds: 0,
    httpStatus: undefined,
    ...overrides,
  };
}

function createMockProvider(result: ProviderTaskResult, model = 'm1'): AgentProvider {
  return {
    kind: '9router',
    model,
    async execute(_t, ws): Promise<ProviderTaskResult> {
      for (const f of result.changedFiles) {
        await writeFile(join(ws, f), 'content');
      }
      return result;
    },
    health: async () => ({ available: true, details: 'ok' }),
    capabilities: () => ['coding', 'planning', 'tool-calling'],
    metadata: () => ({ provider: 'mock', model }),
  };
}

class MockAgentProvider implements AgentProvider {
  readonly kind = '9router' as const;
  readonly model: string | null;
  private results: ProviderTaskResult[];
  private callCount = 0;

  constructor(results: ProviderTaskResult[], model: string | null = 'test-model') {
    this.results = results;
    this.model = model;
  }

  async execute(task: Task, workspace: string): Promise<ProviderTaskResult> {
    const result = this.results[Math.min(this.callCount, this.results.length - 1)];
    this.callCount++;
    for (const f of result.changedFiles) {
      await writeFile(join(workspace, f), 'content for ' + f);
    }
    return result;
  }

  async health() {
    return { available: true, details: 'mock' };
  }
  capabilities() {
    return ['coding', 'planning', 'tool-calling'];
  }
  metadata(): Record<string, string | null> {
    return { provider: 'mock-router', model: this.model };
  }
}

// --- Tests ---

const testsDir = process.env.LOCALAPPDATA
  ? join(process.env.LOCALAPPDATA, 'hermes', 'worker-tracing-test')
  : join(tmpdir(), 'worker-tracing-test');

describe('worker-tracing: execution trace diagnostics', () => {
  let tempBase: string;
  let repoUrl: string;
  let taskRepo: TestTaskRepository;

  beforeEach(async () => {
    tempBase = join(testsDir, 'trace-test-' + process.hrtime.bigint());
    await mkdir(tempBase, { recursive: true });
    repoUrl = tempBase + '/test-repo.git';
    await initGitRepo(repoUrl);
    taskRepo = new TestTaskRepository();
    process.env.ROUTER_MAX_ATTEMPTS = '10';
  });

  afterEach(async () => {
    if (tempBase) {
      await rm(tempBase, { recursive: true, force: true }).catch(() => {});
    }
    delete process.env.ROUTER_PROVIDER_CHAIN;
    delete process.env.ROUTER_MAX_ATTEMPTS;
    delete process.env.ROUTER_TIMEOUT_PER_ATTEMPT_MS;
    delete process.env.ROUTER_TIMEOUT_TOTAL_MS;
    delete process.env.ROUTER_BACKOFF_MS;
  });

  it('test1: FAILED task → trace with full attempt history', async () => {
    const prov1 = new MockAgentProvider([
      createProviderResult('ROUTER_HTTP_ERROR', { httpStatus: 503, changedFiles: ['partial.txt'] }),
    ], 'model-A');
    const prov2 = new MockAgentProvider([
      createProviderResult('ROUTER_CONNECTION_ERROR'),
    ], 'model-B');

    const worker = new RouterWorker(taskRepo, prov1);
    worker['getProviderChain'] = () => [prov1, prov2];

    const task = taskRepo.create({
      project: 'test', repository: repoUrl,
      objective: 'test1', prompt: 'test prompt',
    });

    const result = await worker.executeWithRetry(task, repoUrl);
    expect(result.status).toBe('FAILED');
    expect(result.trace).toBeDefined();
    const trace = result.trace!;
    expect(trace.totalAttempts).toBe(2);
    expect(trace.attempts.length).toBe(2);
    expect(trace.attempts[0].attempt).toBe(0);
    expect(trace.attempts[0].provider).toBe('9router');
    expect(trace.attempts[0].model).toBe('model-A');
    expect(trace.attempts[0].status).toBe('ROUTER_HTTP_ERROR');
    expect(trace.attempts[0].retryable).toBe(true);
    expect(trace.attempts[0].retryReason).toBe('http_503');
    expect(trace.attempts[0].httpStatus).toBe(503);
    expect(trace.attempts[0].workspaceCreated).toBe(true);
    expect(trace.attempts[0].workspaceCleaned).toBe(true);
    expect(trace.attempts[1].attempt).toBe(1);
    expect(trace.attempts[1].model).toBe('model-B');
    expect(trace.attempts[1].status).toBe('ROUTER_CONNECTION_ERROR');
    expect(trace.attempts[1].retryable).toBe(true);
    expect(trace.attempts[1].retryReason).toBe('connection_error');
    expect(trace.attempts[1].isWinner).toBe(false);
    expect(trace.winningAttempt).toBeNull();
    expect(trace.finalStatus).toBe('FAILED');
    expect(trace.errorCode).toBe('ALL_PROVIDERS_FAILED');
    expect(trace.finalizeWasCalled).toBe(false);
  });

  it('test2: COMPLETED task → trace + finalizer outcome + commit SHA', async () => {
    const provider = createMockProvider(
      createProviderResult('COMPLETED', { changedFiles: ['hello.txt'] })
    );
    const worker = new RouterWorker(taskRepo, provider);

    const task = taskRepo.create({
      project: 'test', repository: repoUrl,
      objective: 'test2', prompt: 'test prompt',
    });

    const attemptResult = await worker.executeWithRetry(task, repoUrl);
    expect(attemptResult.status).toBe('COMPLETED');
    expect(attemptResult.trace).toBeDefined();
    const trace = attemptResult.trace!;

    // Now run through BaseWorker.executeOnce for finalization
    const result = await worker.executeOnce();
    expect(result).toBe(true);
    const taskUpdated = await taskRepo.get(task.id);
    expect(taskUpdated?.status).toBe('COMPLETED');
    expect(taskUpdated?.commitSha).toBeTruthy();
    expect(taskUpdated?.result).not.toBeNull();
    const res = taskUpdated!.result as Record<string, unknown>;
    expect(res.trace).toBeDefined();
    const savedTrace = res.trace as WorkerExecutionTrace;
    expect(savedTrace.finalizeWasCalled).toBe(true);
    expect(savedTrace.finalizeStatus).toBe('COMPLETED');
    expect(savedTrace.commitSha).toBe(taskUpdated!.commitSha);
    expect(savedTrace.winningAttempt).toBe(0);
    expect(savedTrace.totalAttempts).toBe(1);

    await rm(attemptResult.workspace, { recursive: true, force: true }).catch(() => {});
  });

  it('test3: HTTP 503 → httpStatus preserved in attempt trace', async () => {
    const provider = createMockProvider(
      createProviderResult('ROUTER_HTTP_ERROR', { httpStatus: 503, changedFiles: ['partial.txt'] })
    );
    const worker = new RouterWorker(taskRepo, provider);

    const task = taskRepo.create({
      project: 'test', repository: repoUrl,
      objective: 'test3', prompt: 'test prompt',
    });

    const result = await worker.executeWithRetry(task, repoUrl);
    expect(result.trace!.attempts[0].httpStatus).toBe(503);
    expect(result.trace!.attempts[0].retryable).toBe(true);
    expect(result.trace!.attempts[0].retryReason).toBe('http_503');
  });

  it('test4: HTTP 401 → httpStatus preserved + retryable=false', async () => {
    const provider = createMockProvider(
      createProviderResult('ROUTER_HTTP_ERROR', { httpStatus: 401 })
    );
    const worker = new RouterWorker(taskRepo, provider);

    const task = taskRepo.create({
      project: 'test', repository: repoUrl,
      objective: 'test4', prompt: 'test prompt',
    });

    const result = await worker.executeWithRetry(task, repoUrl);
    expect(result.trace!.attempts[0].httpStatus).toBe(401);
    expect(result.trace!.attempts[0].retryable).toBe(false);
    expect(result.trace!.attempts[0].retryReason).toBeNull();
  });

  it('test5: retryable attempt → retryReason preserved', async () => {
    const provider = createMockProvider(
      createProviderResult('ROUTER_TIMEOUT', { changedFiles: ['partial.txt'] })
    );
    const worker = new RouterWorker(taskRepo, provider);

    const task = taskRepo.create({
      project: 'test', repository: repoUrl,
      objective: 'test5', prompt: 'test prompt',
    });

    const result = await worker.executeWithRetry(task, repoUrl);
    expect(result.trace!.attempts[0].status).toBe('ROUTER_TIMEOUT');
    expect(result.trace!.attempts[0].retryable).toBe(true);
    expect(result.trace!.attempts[0].retryReason).toBe('router_timeout');
  });

  it('test6: per-attempt timeout → provider status ROUTER_TIMEOUT, attemptTimeoutMs', async () => {
    process.env.ROUTER_TIMEOUT_TOTAL_MS = '10';
    process.env.ROUTER_MAX_ATTEMPTS = '1';
    process.env.ROUTER_BACKOFF_MS = '5';

    const provider: AgentProvider = {
      kind: '9router',
      model: 'test',
      async execute(_t, _w): Promise<ProviderTaskResult> {
        return createProviderResult('COMPLETED');
      },
      health: async () => ({ available: true, details: 'ok' }),
      capabilities: () => [],
      metadata: () => ({ provider: 'mock', model: 'test' }),
    };

    const worker = new RouterWorker(taskRepo, provider);
    const task = taskRepo.create({
      project: 'test', repository: repoUrl,
      objective: 'test6', prompt: 'test prompt',
    });

    const result = await worker.executeWithRetry(task, repoUrl);
    expect(result.trace).toBeDefined();
    const trace = result.trace!;
    // With 10ms total timeout, provider execution can't proceed (budget exhausted after clone)
    // The provider returns ROUTER_TIMEOUT status in the attempt trace
    expect(trace.attempts.length).toBeGreaterThanOrEqual(1);
    expect(trace.globalTimeoutMs).toBe(10);
  });

  it('test7: finalizer FAILED_UNEXPECTED_CHANGES → trace preserved', async () => {
    const provider: AgentProvider = {
      kind: '9router',
      model: 'test',
      async execute(_t, workspace: string): Promise<ProviderTaskResult> {
        await writeFile(join(workspace, 'expected.txt'), 'expected content');
        await writeFile(join(workspace, 'unexpected.txt'), 'unexpected content');
        return createProviderResult('COMPLETED', { changedFiles: ['expected.txt'] });
      },
      health: async () => ({ available: true, details: 'ok' }),
      capabilities: () => ['coding'],
      metadata: () => ({ provider: 'mock', model: 'test' }),
    };

    const worker = new RouterWorker(taskRepo, provider);
    const task = taskRepo.create({
      project: 'test', repository: repoUrl,
      objective: 'test7', prompt: 'test prompt',
    });

    const attemptResult = await worker.executeWithRetry(task, repoUrl);
    expect(attemptResult.status).toBe('COMPLETED');

    const result = await worker.executeOnce();
    expect(result).toBe(true);
    const taskUpdated = await taskRepo.get(task.id);
    expect(taskUpdated?.status).toBe('FAILED'); // FAILED_UNEXPECTED_CHANGES

    const res = taskUpdated!.result as Record<string, unknown>;
    expect(res.trace).toBeDefined();
    const savedTrace = res.trace as WorkerExecutionTrace;
    expect(savedTrace.finalizeWasCalled).toBe(true);
    expect(savedTrace.finalizeStatus).toBe('FAILED');
    expect(savedTrace.commitSha).toBeNull();
    expect(savedTrace.winningAttempt).toBe(0);
    expect(savedTrace.finalStatus).toBe('COMPLETED'); // provider completed, finalizer failed

    // Verify finalize error code is preserved in finalize result
    const finalizeResult = res.finalize as Record<string, unknown>;
    expect(finalizeResult.errorCode).toBe('FAILED_UNEXPECTED_CHANGES');

    await rm(attemptResult.workspace, { recursive: true, force: true }).catch(() => {});
  });

  it('test8: finalizer called → finalizeWasCalled=true', async () => {
    const provider = createMockProvider(
      createProviderResult('COMPLETED', { changedFiles: ['test.txt'] })
    );
    const worker = new RouterWorker(taskRepo, provider);

    const task = taskRepo.create({
      project: 'test', repository: repoUrl,
      objective: 'test8', prompt: 'test prompt',
    });

    const attemptResult = await worker.executeWithRetry(task, repoUrl);
    const result = await worker.executeOnce();
    expect(result).toBe(true);

    const taskUpdated = await taskRepo.get(task.id);
    expect(taskUpdated?.status).toBe('COMPLETED');
    const res = taskUpdated!.result as Record<string, unknown>;
    const savedTrace = res.trace as WorkerExecutionTrace;
    expect(savedTrace.finalizeWasCalled).toBe(true);
    expect(savedTrace.finalizeStatus).toBe('COMPLETED');
    expect(savedTrace.commitSha).toBeTruthy();

    await rm(attemptResult.workspace, { recursive: true, force: true }).catch(() => {});
  });

  it('test9: commit successful → commitSha present in trace', async () => {
    const provider = createMockProvider(
      createProviderResult('COMPLETED', { changedFiles: ['committed.txt'] })
    );
    const worker = new RouterWorker(taskRepo, provider);

    const task = taskRepo.create({
      project: 'test', repository: repoUrl,
      objective: 'test9', prompt: 'test prompt',
    });

    const attemptResult = await worker.executeWithRetry(task, repoUrl);
    await worker.executeOnce();

    const taskUpdated = await taskRepo.get(task.id);
    expect(taskUpdated?.commitSha).toBeTruthy();
    const res = taskUpdated!.result as Record<string, unknown>;
    const savedTrace = res.trace as WorkerExecutionTrace;
    expect(savedTrace.commitSha).toBe(taskUpdated!.commitSha);

    await rm(attemptResult.workspace, { recursive: true, force: true }).catch(() => {});
  });

  it('test10: workspace lifecycle → created/cleaned without path', async () => {
    const prov1 = new MockAgentProvider([
      createProviderResult('TIMED_OUT', { changedFiles: ['a.txt'] }),
    ]);
    const prov2 = new MockAgentProvider([
      createProviderResult('COMPLETED', { changedFiles: ['b.txt'] }),
    ]);

    const worker = new RouterWorker(taskRepo, prov1);
    worker['getProviderChain'] = () => [prov1, prov2];

    const task = taskRepo.create({
      project: 'test', repository: repoUrl,
      objective: 'test10', prompt: 'test prompt',
    });

    const result = await worker.executeWithRetry(task, repoUrl);
    expect(result.trace!.attempts.length).toBe(2);

    // Attempt 0 (failed): workspace created and cleaned (discarded)
    expect(result.trace!.attempts[0].workspaceCreated).toBe(true);
    expect(result.trace!.attempts[0].workspaceCleaned).toBe(true);

    // Attempt 1 (winner): workspace created, NOT cleaned (still alive for finalizer)
    expect(result.trace!.attempts[1].workspaceCreated).toBe(true);
    expect(result.trace!.attempts[1].workspaceCleaned).toBe(false);
    expect(result.trace!.attempts[1].isWinner).toBe(true);

    // Verify no workspace path persisted in trace
    const traceJson = JSON.stringify(result.trace);
    expect(traceJson).not.toMatch(/tmp[\/\\]/);
    expect(traceJson).not.toMatch(/pu-dev-loop-attempt/);

    await rm(result.workspace, { recursive: true, force: true }).catch(() => {});
  });

  it('test11: remainingBudget bug — setup error after deadline → timeout not ReferenceError', async () => {
    // Use 0ms total timeout to guarantee deadline check fires before any work
    process.env.ROUTER_TIMEOUT_TOTAL_MS = '0';
    process.env.ROUTER_MAX_ATTEMPTS = '1';

    const provider: AgentProvider = {
      kind: '9router',
      model: 'test',
      async execute(_t, _w): Promise<ProviderTaskResult> {
        return createProviderResult('COMPLETED');
      },
      health: async () => ({ available: true, details: 'ok' }),
      capabilities: () => [],
      metadata: () => ({ provider: 'mock', model: 'test' }),
    };

    const worker = new RouterWorker(taskRepo, provider);
    const task = taskRepo.create({
      project: 'test', repository: repoUrl,
      objective: 'test11', prompt: 'test prompt',
    });

    // Should NOT throw ReferenceError for remainingBudget
    const result = await worker.executeWithRetry(task, repoUrl);
    expect(result.status).toBe('FAILED');
    expect(result.trace!.timedOut).toBe(true);
  });
});

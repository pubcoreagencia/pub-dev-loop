import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import { RouterWorker } from '../src/router-worker.js';
import type { AgentProvider, ProviderTaskResult } from '../src/providers/types.js';
import type { Task, TaskRepository } from '../src/domain.js';
import { type AttemptResult } from '../src/worker-service.js';

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
    return this.tasks.get(id) || null;
  }
  async list(): Promise<Task[]> {
    return Array.from(this.tasks.values());
  }
  async claim(worker: string): Promise<Task | null> {
    for (const [id, task] of this.tasks) {
      if (task.status === 'QUEUED') {
        task.status = 'ASSIGNED';
        task.worker = worker;
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
}

class MockAgentProvider implements AgentProvider {
  readonly kind = '9router' as const;
  readonly model: string | null;
  private results: ProviderTaskResult[];
  private callCount = 0;
  public executedWorkspaces: string[] = [];

  constructor(results: ProviderTaskResult[], model: string | null = 'test-model') {
    this.results = results;
    this.model = model;
  }

  async execute(task: Task, workspace: string): Promise<ProviderTaskResult> {
    this.executedWorkspaces.push(workspace);
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

// --- Tests ---

const testsDir = process.env.LOCALAPPDATA
  ? join(process.env.LOCALAPPDATA, 'hermes', 'worker-retry-test')
  : join(tmpdir(), 'worker-retry-test');

describe('worker-retry: retry/fallback logic', () => {
  let tempBase: string;
  let repoUrl: string;
  let taskRepo: TestTaskRepository;

  beforeEach(async () => {
    tempBase = join(testsDir, 'retry-test-' + process.hrtime.bigint());
    await mkdir(tempBase, { recursive: true });
    repoUrl = tempBase + '/test-repo.git';
    await initGitRepo(repoUrl);
    taskRepo = new TestTaskRepository();
    // Allow multiple attempts when tests override getProviderChain
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

  it('test1: single provider success — behavior unchanged (1 attempt, 1 clone)', async () => {
    const provider = createMockProvider(
      createProviderResult('COMPLETED', { changedFiles: ['hello.txt'] })
    );
    const worker = new RouterWorker(taskRepo, provider);
    const task = taskRepo.create({
      project: 'test', repository: repoUrl,
      objective: 'test1', prompt: 'test prompt',
    });

    const result = await worker.executeWithRetry(task, repoUrl);

    expect(result.status).toBe('COMPLETED');
    expect(result.declaredChangedFiles).toEqual(['hello.txt']);
    expect(result.workspace).toBeTruthy();
    expect(result.baselineSnapshot.trackedFiles).toEqual([]);

    await rm(result.workspace, { recursive: true, force: true }).catch(() => {});
  });

  it('test2: TIMED_OUT → retry to next provider with FRESH workspace', async () => {
    const prov1 = new MockAgentProvider([
      createProviderResult('TIMED_OUT', { changedFiles: ['partial.txt'] }),
    ], 'model-A');
    const prov2 = new MockAgentProvider([
      createProviderResult('COMPLETED', { changedFiles: ['hello.txt'] }),
    ], 'model-B');

    const worker = new RouterWorker(taskRepo, prov1);
    worker['getProviderChain'] = () => [prov1, prov2];

    const task = taskRepo.create({
      project: 'test', repository: repoUrl,
      objective: 'test2', prompt: 'test prompt',
    });

    const result = await worker.executeWithRetry(task, repoUrl);

    expect(result.status).toBe('COMPLETED');
    expect(result.declaredChangedFiles).toEqual(['hello.txt']);
    expect(prov1.executedWorkspaces.length).toBe(1);
    expect(prov2.executedWorkspaces.length).toBe(1);
    expect(prov1.executedWorkspaces[0]).not.toBe(prov2.executedWorkspaces[0]);

    await rm(result.workspace, { recursive: true, force: true }).catch(() => {});
  });

  it('test3: HTTP 503 → retry; HTTP 401 → fail-fast', async () => {
    const prov503 = new MockAgentProvider([
      createProviderResult('ROUTER_HTTP_ERROR', { httpStatus: 503, changedFiles: ['partial.txt'] }),
    ]);
    const prov401 = new MockAgentProvider([
      createProviderResult('ROUTER_HTTP_ERROR', { httpStatus: 401 }),
    ]);

    const worker = new RouterWorker(taskRepo, prov503);
    worker['getProviderChain'] = () => [prov503, prov401];

    const task = taskRepo.create({
      project: 'test', repository: repoUrl,
      objective: 'test3', prompt: 'test prompt',
    });

    const result = await worker.executeWithRetry(task, repoUrl);

    expect(result.status).toBe('FAILED');
    expect(result.errorCode).toBe('ROUTER_HTTP_ERROR');
    // 503 is retryable — attempt 0 executed, workspace discarded
    expect(prov503.executedWorkspaces.length).toBe(1);
    // 401 is fail-fast — attempt 1 executed (next in chain), then fails
    expect(prov401.executedWorkspaces.length).toBe(1);

    await rm(prov503.executedWorkspaces[0], { recursive: true, force: true }).catch(() => {});
    await rm(prov401.executedWorkspaces[0], { recursive: true, force: true }).catch(() => {});
  });

  it('test4: START_ERROR → fail-fast (1 attempt, no retry)', async () => {
    const prov = createMockProvider(createProviderResult('START_ERROR'));
    const worker = new RouterWorker(taskRepo, prov);
    const task = taskRepo.create({
      project: 'test', repository: repoUrl,
      objective: 'test4', prompt: 'test prompt',
    });

    const result = await worker.executeWithRetry(task, repoUrl);

    expect(result.status).toBe('FAILED');
    expect(result.errorCode).toBe('START_ERROR');
    expect(result.declaredChangedFiles).toEqual([]);

    await rm(result.workspace, { recursive: true, force: true }).catch(() => {});
  });

  it('test5: TOOL_LOOP_LIMIT → fail-fast (no retry)', async () => {
    const prov = createMockProvider(createProviderResult('TOOL_LOOP_LIMIT'));
    const worker = new RouterWorker(taskRepo, prov);
    const task = taskRepo.create({
      project: 'test', repository: repoUrl,
      objective: 'test5', prompt: 'test prompt',
    });

    const result = await worker.executeWithRetry(task, repoUrl);

    expect(result.status).toBe('FAILED');
    expect(result.errorCode).toBe('TOOL_LOOP_LIMIT');

    await rm(result.workspace, { recursive: true, force: true }).catch(() => {});
  });

  it('test6: all providers retryable → ALL_PROVIDERS_FAILED', async () => {
    const prov1 = new MockAgentProvider([createProviderResult('TIMED_OUT')]);
    const prov2 = new MockAgentProvider([
      createProviderResult('ROUTER_HTTP_ERROR', { httpStatus: 503 }),
    ]);
    const prov3 = new MockAgentProvider([createProviderResult('TIMED_OUT')]);

    const worker = new RouterWorker(taskRepo, prov1);
    worker['getProviderChain'] = () => [prov1, prov2, prov3];

    const task = taskRepo.create({
      project: 'test', repository: repoUrl,
      objective: 'test6', prompt: 'test prompt',
    });

    const result = await worker.executeWithRetry(task, repoUrl);

    expect(result.status).toBe('FAILED');
    expect(result.errorCode).toBe('ALL_PROVIDERS_FAILED');
    expect(prov1.executedWorkspaces.length).toBe(1);
    expect(prov2.executedWorkspaces.length).toBe(1);
    expect(prov3.executedWorkspaces.length).toBe(1);
  });

  it('test7: COMPLETED attempt result — workspace has declared + unexpected files', async () => {
    const prov: AgentProvider = {
      kind: '9router',
      model: 'test',
      async execute(_t, workspace: string): Promise<ProviderTaskResult> {
        await writeFile(join(workspace, 'expected.txt'), 'expected content');
        await writeFile(join(workspace, 'unexpected.txt'), 'unexpected content');
        return createProviderResult('COMPLETED', { changedFiles: ['expected.txt'] });
      },
      health: async () => ({ available: true, details: 'ok' }),
      capabilities: () => [],
      metadata: () => ({ provider: 'mock', model: 'test' }),
    };

    const worker = new RouterWorker(taskRepo, prov);
    const task = taskRepo.create({
      project: 'test', repository: repoUrl,
      objective: 'test7', prompt: 'test prompt',
    });

    const attemptResult = await worker.executeWithRetry(task, repoUrl);

    expect(attemptResult.status).toBe('COMPLETED');
    expect(attemptResult.declaredChangedFiles).toEqual(['expected.txt']);

    const fs = await import('node:fs');
    expect(fs.existsSync(join(attemptResult.workspace, 'expected.txt'))).toBe(true);
    expect(fs.existsSync(join(attemptResult.workspace, 'unexpected.txt'))).toBe(true);

    await rm(attemptResult.workspace, { recursive: true, force: true }).catch(() => {});
  });

  it('test8: global timeout exceeded → abort before attempt starts', async () => {
    // Set total timeout very short — shorter than a git clone takes
    process.env.ROUTER_TIMEOUT_TOTAL_MS = '10';
    process.env.ROUTER_MAX_ATTEMPTS = '3';
    process.env.ROUTER_BACKOFF_MS = '100';

    let providerExecuted = false;
    const mockProv: AgentProvider = {
      kind: '9router',
      model: 'test',
      async execute(_t, _w): Promise<ProviderTaskResult> {
        providerExecuted = true;
        return createProviderResult('COMPLETED');
      },
      health: async () => ({ available: true, details: 'ok' }),
      capabilities: () => [],
      metadata: () => ({ provider: 'mock', model: 'test' }),
    };

    // Override getProviderChain to return 3 slow providers
    const worker = new RouterWorker(taskRepo, mockProv);
    worker['getProviderChain'] = () => [mockProv, mockProv, mockProv];

    const task = taskRepo.create({
      project: 'test', repository: repoUrl,
      objective: 'test8', prompt: 'test prompt',
    });

    const start = Date.now();
    const result = await worker.executeWithRetry(task, repoUrl);
    const elapsed = Date.now() - start;

    expect(result.status).toBe('FAILED');
    expect(result.errorCode).toBe('ROUTER_TIMEOUT_TOTAL');
    expect(elapsed).toBeLessThan(5000);
  });

  it('test9: non-retryable after retryable → fail-fast', async () => {
    const retryableProv = new MockAgentProvider([
      createProviderResult('ROUTER_HTTP_ERROR', { httpStatus: 503, changedFiles: ['partial.txt'] }),
    ]);
    const failFastProv = new MockAgentProvider([
      createProviderResult('ROUTER_HTTP_ERROR', { httpStatus: 401 }),
    ]);

    process.env.ROUTER_PROVIDER_CHAIN = 'router:m1,router:m2';
    const worker = new RouterWorker(taskRepo, retryableProv);
    worker['getProviderChain'] = () => [retryableProv, failFastProv];

    const task = taskRepo.create({
      project: 'test', repository: repoUrl,
      objective: 'test9', prompt: 'test prompt',
    });

    const result = await worker.executeWithRetry(task, repoUrl);

    expect(result.status).toBe('FAILED');
    expect(result.errorCode).toBe('ROUTER_HTTP_ERROR');
    expect(retryableProv.executedWorkspaces.length).toBe(1);
    expect(failFastProv.executedWorkspaces.length).toBe(1);

    await rm(retryableProv.executedWorkspaces[0], { recursive: true, force: true }).catch(() => {});
    await rm(failFastProv.executedWorkspaces[0], { recursive: true, force: true }).catch(() => {});
  });

  it('test10: default chain without ROUTER_PROVIDER_CHAIN = single provider', async () => {
    const prov = createMockProvider(
      createProviderResult('COMPLETED', { changedFiles: ['ok.txt'] })
    );
    const worker = new RouterWorker(taskRepo, prov);

    const chain = worker['getProviderChain']();
    expect(chain.length).toBe(1);
    expect(chain[0]).toBe(prov);

    const task = taskRepo.create({
      project: 'test', repository: repoUrl,
      objective: 'test10', prompt: 'test prompt',
    });

    const result = await worker.executeWithRetry(task, repoUrl);
    expect(result.status).toBe('COMPLETED');

    await rm(result.workspace, { recursive: true, force: true }).catch(() => {});
  });
});

describe('worker-retry: workspace isolation', () => {
  let tempBase: string;
  let repoUrl: string;
  let taskRepo: TestTaskRepository;

  beforeEach(async () => {
    tempBase = join(testsDir, 'iso-test-' + process.hrtime.bigint());
    await mkdir(tempBase, { recursive: true });
    repoUrl = tempBase + '/test-repo.git';
    await initGitRepo(repoUrl);
    taskRepo = new TestTaskRepository();
    delete process.env.ROUTER_PROVIDER_CHAIN;
    process.env.ROUTER_MAX_ATTEMPTS = '10';
  });

  afterEach(async () => {
    if (tempBase) {
      await rm(tempBase, { recursive: true, force: true }).catch(() => {});
    }
    delete process.env.ROUTER_PROVIDER_CHAIN;
    delete process.env.ROUTER_MAX_ATTEMPTS;
    delete process.env.ROUTER_TIMEOUT_TOTAL_MS;
    delete process.env.ROUTER_TIMEOUT_PER_ATTEMPT_MS;
    delete process.env.ROUTER_BACKOFF_MS;
  });

  it('isolation: attempt 0 destroyed before attempt 1 created (no contamination)', async () => {
    let attempt1FileList: string = '';

    const prov1: AgentProvider = {
      kind: '9router',
      model: 'm1',
      async execute(_t, ws): Promise<ProviderTaskResult> {
        await writeFile(join(ws, 'file-a.txt'), 'a');
        return createProviderResult('TIMED_OUT', { changedFiles: ['file-a.txt'] });
      },
      health: async () => ({ available: true, details: 'ok' }),
      capabilities: () => [],
      metadata: () => ({ provider: 'p1', model: 'm1' }),
    };

    const prov2: AgentProvider = {
      kind: '9router',
      model: 'm2',
      async execute(_t, ws): Promise<ProviderTaskResult> {
        await writeFile(join(ws, 'file-b.txt'), 'b');
        attempt1FileList = (await import('node:fs')).readdirSync(ws).join('\n');
        return createProviderResult('COMPLETED', { changedFiles: ['file-b.txt'] });
      },
      health: async () => ({ available: true, details: 'ok' }),
      capabilities: () => [],
      metadata: () => ({ provider: 'p2', model: 'm2' }),
    };

    const worker = new RouterWorker(taskRepo, prov1);
    worker['getProviderChain'] = () => [prov1, prov2];

    const task = taskRepo.create({
      project: 'test', repository: repoUrl,
      objective: 'isolation', prompt: 'test',
    });

    const result = await worker.executeWithRetry(task, repoUrl);

    expect(result.status).toBe('COMPLETED');
    expect(attempt1FileList).not.toContain('file-a.txt');

    await rm(result.workspace, { recursive: true, force: true }).catch(() => {});
  });

  it('isolation: winner workspace stays alive until finalizer', async () => {
    const prov: AgentProvider = {
      kind: '9router',
      model: 'm1',
      async execute(_t, ws): Promise<ProviderTaskResult> {
        await writeFile(join(ws, 'winner.txt'), 'winner');
        return createProviderResult('COMPLETED', { changedFiles: ['winner.txt'] });
      },
      health: async () => ({ available: true, details: 'ok' }),
      capabilities: () => [],
      metadata: () => ({ provider: 'p1', model: 'm1' }),
    };

    const worker = new RouterWorker(taskRepo, prov);
    const task = taskRepo.create({
      project: 'test', repository: repoUrl,
      objective: 'winner-alive', prompt: 'test',
    });

    const result = await worker.executeWithRetry(task, repoUrl);

    expect(result.status).toBe('COMPLETED');
    const fs = await import('node:fs');
    expect(fs.existsSync(result.workspace)).toBe(true);

    await rm(result.workspace, { recursive: true, force: true }).catch(() => {});
  });

  it('httpStatus undefined → fail-fast (not retryable)', async () => {
    const prov: AgentProvider = {
      kind: '9router',
      model: 'm1',
      async execute(_t, _w): Promise<ProviderTaskResult> {
        return {
          status: 'ROUTER_HTTP_ERROR',
          provider: '9router',
          model: 'm1',
          httpStatus: undefined,
          exitCode: 401,
          durationMs: 100,
          stdout: '',
          stderr: 'Unauthorized',
          changedFiles: [],
          commit: null,
          errorCode: 'ROUTER_HTTP_ERROR',
          errorMessage: 'Unauthorized',
          toolCalls: 0,
          toolRounds: 0,
        };
      },
      health: async () => ({ available: true, details: 'ok' }),
      capabilities: () => [],
      metadata: () => ({ provider: 'p1', model: 'm1' }),
    };

    const worker = new RouterWorker(taskRepo, prov);
    const task = taskRepo.create({
      project: 'test', repository: repoUrl,
      objective: 'undefined-http', prompt: 'test',
    });

    const result = await worker.executeWithRetry(task, repoUrl);

    expect(result.status).toBe('FAILED');
    expect(result.errorCode).toBe('ROUTER_HTTP_ERROR');

    await rm(result.workspace, { recursive: true, force: true }).catch(() => {});
  });
});

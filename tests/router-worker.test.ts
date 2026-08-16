import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RouterWorker } from '../src/router-worker.js';
import { BaseWorker } from '../src/worker-service.js';
import type { Task, TaskRepository } from '../src/domain.js';
import type { AgentProvider, ProviderTaskResult } from '../src/providers/types.js';

/**
 * In-memory TaskRepository for unit testing RouterWorker.
 */
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

/**
 * Create a mock provider that returns a configurable result.
 */
function createMockProvider(result: Partial<ProviderTaskResult>): AgentProvider {
  return {
    kind: 'mock',
    model: result.model ?? 'test-model',
    async execute(_task: Task, _workspace: string): Promise<ProviderTaskResult> {
      return {
        status: 'COMPLETED',
        provider: 'mock',
        model: result.model ?? 'test-model',
        exitCode: 0,
        durationMs: 100,
        stdout: result.stdout ?? '',
        stderr: result.stderr ?? '',
        changedFiles: result.changedFiles ?? [],
        commit: null,
        errorCode: result.errorCode ?? null,
        errorMessage: result.errorMessage ?? null,
        toolCalls: result.toolCalls ?? 0,
        toolRounds: result.toolRounds ?? 0,
        ...result,
      } as ProviderTaskResult;
    },
    async health() {
      return { available: true, details: 'mock' };
    },
    capabilities() {
      return ['coding'];
    },
    metadata() {
      return { provider: 'mock' };
    },
  };
}

describe('RouterWorker — Unit Tests', () => {
  let taskRepo: TestTaskRepository;

  beforeEach(() => {
    taskRepo = new TestTaskRepository();
  });

  it('1. provider COMPLETED → executeTask returns COMPLETED', async () => {
    const provider = createMockProvider({
      status: 'COMPLETED',
      stdout: 'Task done',
      changedFiles: ['hello.txt'],
      toolCalls: 3,
      toolRounds: 2,
      model: 'gemini-3-flash',
    });

    const worker = new RouterWorker(taskRepo, provider);
    const task = taskRepo.create({
      project: 'test',
      repository: 'file:///tmp/test',
      objective: 'Test task',
      prompt: 'Do something',
    });

    // Call executeTask directly (not executeOnce — no real repo needed)
    const result = await worker['executeTask'](task, '/tmp/workspace');

    expect(result.status).toBe('COMPLETED');
    expect(result.stdout).toBe('Task done');
    expect(result.changedFiles).toEqual(['hello.txt']);
    expect(result.toolCalls).toBe(3);
    expect(result.toolRounds).toBe(2);
    expect(result.model).toBe('gemini-3-flash');
    expect(result.provider).toBe('mock');
  });

  it('2. provider FAILED → executeTask returns FAILED', async () => {
    const provider = createMockProvider({
      status: 'FAILED',
      stderr: 'Something went wrong',
      errorCode: 'AGENT_ERROR',
      errorMessage: 'Simulated failure',
    });

    const worker = new RouterWorker(taskRepo, provider);
    const task = taskRepo.create({
      project: 'test',
      repository: 'file:///tmp/test',
      objective: 'Test task',
      prompt: 'Do something',
    });

    const result = await worker['executeTask'](task, '/tmp/workspace');

    expect(result.status).toBe('FAILED');
  });

  it('3. provider TIMED_OUT → executeTask returns FAILED', async () => {
    const provider = createMockProvider({
      status: 'TIMED_OUT',
      stderr: 'Request timed out',
      errorCode: 'ROUTER_TIMEOUT',
      errorMessage: 'Request timed out',
    });

    const worker = new RouterWorker(taskRepo, provider);
    const task = taskRepo.create({
      project: 'test',
      repository: 'file:///tmp/test',
      objective: 'Test task',
      prompt: 'Do something',
    });

    const result = await worker['executeTask'](task, '/tmp/workspace');

    // TIMED_OUT must map to FAILED (not COMPLETED)
    expect(result.status).toBe('FAILED');
    expect(result.errorCode).toBe('ROUTER_TIMEOUT');
  });

  it('4. toolCalls propagated from provider result', async () => {
    const provider = createMockProvider({
      status: 'COMPLETED',
      toolCalls: 15,
      toolRounds: 8,
    });

    const worker = new RouterWorker(taskRepo, provider);
    const task = taskRepo.create({
      project: 'test',
      repository: 'file:///tmp/test',
      objective: 'Test',
      prompt: 'Do something',
    });

    const result = await worker['executeTask'](task, '/tmp/workspace');

    expect(result.toolCalls).toBe(15);
    expect(result.toolRounds).toBe(8);
  });

  it('5. toolRounds propagated from provider result', async () => {
    // (covered above, but explicit test for toolRounds propagation)
    const provider = createMockProvider({
      status: 'COMPLETED',
      toolCalls: 5,
      toolRounds: 3,
    });

    const worker = new RouterWorker(taskRepo, provider);
    const task = taskRepo.create({
      project: 'test',
      repository: 'file:///tmp/test',
      objective: 'Test',
      prompt: 'Do something',
    });

    const result = await worker['executeTask'](task, '/tmp/workspace');

    expect(result.toolRounds).toBe(3);
  });

  it('6. model propagated from provider result', async () => {
    const provider = createMockProvider({
      status: 'COMPLETED',
      model: 'ag/gemini-3-flash',
    });

    const worker = new RouterWorker(taskRepo, provider);
    const task = taskRepo.create({
      project: 'test',
      repository: 'file:///tmp/test',
      objective: 'Test',
      prompt: 'Do something',
    });

    const result = await worker['executeTask'](task, '/tmp/workspace');

    expect(result.model).toBe('ag/gemini-3-flash');
  });

  it('7. provider propagated from provider result', async () => {
    const provider: AgentProvider = {
      kind: '9router',
      model: 'test',
      async execute(_task, _ws): Promise<ProviderTaskResult> {
        return {
          status: 'COMPLETED',
          provider: '9router',
          model: 'test',
          exitCode: 0,
          durationMs: 0,
          stdout: 'ok',
          stderr: '',
          changedFiles: [],
          commit: null,
          errorCode: null,
          errorMessage: null,
        };
      },
      async health() {
        return { available: true, details: 'ok' };
      },
      capabilities() {
        return ['coding'];
      },
      metadata() {
        return { provider: '9router' };
      },
    };

    const worker = new RouterWorker(taskRepo, provider);
    const task = taskRepo.create({
      project: 'test',
      repository: 'file:///tmp/test',
      objective: 'Test',
      prompt: 'Do something',
    });

    const result = await worker['executeTask'](task, '/tmp/workspace');

    expect(result.provider).toBe('9router');
  });

  it('8. execution object propagated when present', async () => {
    const mockExecution = { stdout: 'exec output', stderr: '', exitCode: 0, durationMs: 100, status: 'COMPLETED' as const };

    const provider = createMockProvider({
      status: 'COMPLETED',
      execution: mockExecution,
    });

    const worker = new RouterWorker(taskRepo, provider);
    const task = taskRepo.create({
      project: 'test',
      repository: 'file:///tmp/test',
      objective: 'Test',
      prompt: 'Do something',
    });

    const result = await worker['executeTask'](task, '/tmp/workspace');

    expect(result.execution).toBeDefined();
    expect(result.execution).toEqual(mockExecution);
  });
});

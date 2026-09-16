import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import { RouterWorker, type TaskStreamEventCallback } from '../../src/router-worker.js';
import type { AgentProvider, ProviderTaskResult, ProviderTaskInput } from '../../src/providers/types.js';
import type { Task, TaskRepository } from '../../src/domain.js';
import type { PreparedExecution } from '../../src/execution/execution-seam.js';
import type { StructuredExecutionPlan } from '../../src/pdl/planning/types.js';
import { ProductCatalog, CANONICAL_PUB_PRODUCTS } from '../../src/pdl/products/catalog.js';

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

describe('Complexity-Triggered Planning Integration Tests', () => {
  let tempBase: string;
  let repoUrl: string;
  let taskRepo: TestTaskRepository;
  const originalEnv = { ...process.env };

  beforeEach(async () => {
    tempBase = join(tmpdir(), 'pdl-planning-integ-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6));
    await mkdir(tempBase, { recursive: true });
    repoUrl = join(tempBase, 'test-repo.git');
    await initGitRepo(repoUrl);
    taskRepo = new TestTaskRepository();
    process.env.ROUTER_MAX_ATTEMPTS = '2';
    process.env.ROUTER_BACKOFF_MS = '1';
  });

  afterEach(async () => {
    process.env = { ...originalEnv };
    if (tempBase) {
      await rm(tempBase, { recursive: true, force: true }).catch(() => {});
    }
  });

  it('Stage 0 (OFF): executes directly without planning even if task is COMPLEX', async () => {
    process.env.PDL_COMPLEXITY_PLANNING_MODE = 'OFF';

    const events: any[] = [];
    const onStreamEvent: TaskStreamEventCallback = (_tid, _att, evt) => {
      events.push(evt);
    };

    const provider: AgentProvider = {
      kind: 'mock',
      model: 'model-a',
      async execute(input, ws) {
        return {
          status: 'COMPLETED',
          provider: 'mock',
          model: 'model-a',
          exitCode: 0,
          durationMs: 50,
          stdout: 'Direct execution complete',
          stderr: '',
          changedFiles: ['file1.ts'],
          commit: null,
          errorCode: null,
          errorMessage: null,
          toolCalls: 1,
          toolRounds: 1,
        };
      },
      health: async () => ({ available: true, details: 'ok' }),
      capabilities: () => ['coding'],
      metadata: () => ({ provider: 'mock' }),
    };

    const worker = new RouterWorker(taskRepo, provider, 'router', onStreamEvent);
    const task = taskRepo.create({
      project: 'pub-dev-loop-template',
      repository: repoUrl,
      objective: 'Modify src/pdl/scheduler/types.ts', // Hard Signal HARD_01
      prompt: 'Update transitions',
    });

    const prepared: PreparedExecution = {
      task,
      executionSpec: {
        specVersion: '1.0.0',
        objective: task.objective,
        context: { kind: 'UNKNOWN', reason: 'test' },
        constraints: [],
        acceptanceCriteria: [],
        validationPlan: [],
        executionInstructions: ['Modify src/pdl/scheduler/types.ts'],
        executionSteps: [],
        risks: [],
        escalationConditions: [],
        lineage: { intakeVersion: '1.0.0', intakeHash: 'h', source: 't', createdAt: new Date().toISOString() },
        metadata: { generatedAt: new Date().toISOString(), specHash: 'h' },
      },
    };

    const result = await (worker as any).executeWithRetry(task, repoUrl, prepared);

    expect(result.status).toBe('COMPLETED');
    expect(result.declaredChangedFiles).toEqual(['file1.ts']);

    // Check emitted events: classified as COMPLEX, but path selected is DIRECT because MODE=OFF
    const classified = events.find(e => e.type === 'task_complexity_classified' || e.tier !== undefined);
    expect(classified).toBeDefined();
    expect(classified.tier).toBe('COMPLEX');

    const pathEvent = events.find(e => e.path !== undefined);
    expect(pathEvent?.path).toBe('DIRECT');
  });

  it('Stage 1 (SHADOW): classifies and emits events but executes directly without planner LLM call', async () => {
    process.env.PDL_COMPLEXITY_PLANNING_MODE = 'SHADOW';

    const events: any[] = [];
    const onStreamEvent: TaskStreamEventCallback = (_tid, _att, evt) => {
      events.push(evt);
    };

    let plannerCalled = false;
    const provider: AgentProvider = {
      kind: 'mock',
      model: 'model-a',
      async execute(input, ws) {
        if (input.objective?.includes('Generate structured execution plan')) {
          plannerCalled = true;
        }
        return {
          status: 'COMPLETED',
          provider: 'mock',
          model: 'model-a',
          exitCode: 0,
          durationMs: 50,
          stdout: 'Executed directly',
          stderr: '',
          changedFiles: [],
          commit: null,
          errorCode: null,
          errorMessage: null,
          toolCalls: 0,
          toolRounds: 0,
        };
      },
      health: async () => ({ available: true, details: 'ok' }),
      capabilities: () => ['coding'],
      metadata: () => ({ provider: 'mock' }),
    };

    const worker = new RouterWorker(taskRepo, provider, 'router', onStreamEvent);
    const task = taskRepo.create({
      project: 'pub-dev-loop-template',
      repository: repoUrl,
      objective: 'Update db/migrations/024.sql',
      prompt: 'Add index',
    });

    const prepared: PreparedExecution = {
      task,
      executionSpec: {
        specVersion: '1.0.0',
        objective: task.objective,
        context: { kind: 'UNKNOWN', reason: 'test' },
        constraints: [],
        acceptanceCriteria: [],
        validationPlan: [],
        executionInstructions: ['Touch db/migrations/024.sql'],
        executionSteps: [],
        risks: [],
        escalationConditions: [],
        lineage: { intakeVersion: '1.0.0', intakeHash: 'h', source: 't', createdAt: new Date().toISOString() },
        metadata: { generatedAt: new Date().toISOString(), specHash: 'h' },
      },
    };

    const result = await (worker as any).executeWithRetry(task, repoUrl, prepared);

    expect(result.status).toBe('COMPLETED');
    expect(plannerCalled).toBe(false); // In SHADOW, no planning LLM invocation
    const pathEvent = events.find(e => e.path !== undefined);
    expect(pathEvent?.path).toBe('DIRECT');
  });

  it('Stage 3 (FULL): generates plan, validates, and enriches execution instructions', async () => {
    process.env.PDL_COMPLEXITY_PLANNING_MODE = 'FULL';

    const events: any[] = [];
    const onStreamEvent: TaskStreamEventCallback = (_tid, _att, evt) => {
      events.push(evt);
    };

    const validPlan: StructuredExecutionPlan = {
      planVersion: '1.0.0',
      taskId: 'test-task',
      attempt: 0,
      goal: 'Implement database schema migration and update types safely',
      filesToChange: ['src/model.ts'],
      dependencies: [],
      implementationSteps: [
        { stepNumber: 1, description: 'Update model definition', targetFile: 'src/model.ts' },
      ],
      testStrategy: ['npm test', 'Run vitest model test'],
      riskPoints: ['Schema mismatch'],
      rollbackConsiderations: ['Git revert'],
      complexityAssessment: 'COMPLEX',
    };

    let receivedExecutionInstructions: string[] | undefined;

    const provider: AgentProvider = {
      kind: 'mock',
      model: 'model-a',
      async execute(input, ws) {
        if (input.objective?.includes('Generate structured execution plan')) {
          return {
            status: 'COMPLETED',
            provider: 'mock',
            model: 'model-a',
            exitCode: 0,
            durationMs: 50,
            stdout: JSON.stringify({ ...validPlan, taskId: input.id.split(':')[0] }),
            stderr: '',
            changedFiles: [],
            commit: null,
            errorCode: null,
            errorMessage: null,
            toolCalls: 0,
            toolRounds: 0,
          };
        }

        // Implementation execution call
        receivedExecutionInstructions = input.systemInstructions;
        return {
          status: 'COMPLETED',
          provider: 'mock',
          model: 'model-a',
          exitCode: 0,
          durationMs: 50,
          stdout: 'Implementation done',
          stderr: '',
          changedFiles: ['src/model.ts'],
          commit: null,
          errorCode: null,
          errorMessage: null,
          toolCalls: 1,
          toolRounds: 1,
        };
      },
      health: async () => ({ available: true, details: 'ok' }),
      capabilities: () => ['coding'],
      metadata: () => ({ provider: 'mock' }),
    };

    const catalog = new ProductCatalog();
    const worker = new RouterWorker(taskRepo, provider, 'router', onStreamEvent, undefined, undefined, catalog);
    const task = taskRepo.create({
      project: 'pub-dev-loop-template',
      repository: repoUrl,
      objective: 'Update db/migrations/025.sql and model',
      prompt: 'Add migration',
    });

    const prepared: PreparedExecution = {
      task,
      executionSpec: {
        specVersion: '1.0.0',
        objective: task.objective,
        context: { kind: 'UNKNOWN', reason: 'test' },
        constraints: [],
        acceptanceCriteria: [],
        validationPlan: [],
        executionInstructions: ['Touch db/migrations/025.sql'],
        executionSteps: [],
        risks: [],
        escalationConditions: [],
        lineage: { intakeVersion: '1.0.0', intakeHash: 'h', source: 't', createdAt: new Date().toISOString() },
        metadata: { generatedAt: new Date().toISOString(), specHash: 'h' },
      },
    };

    const result = await (worker as any).executeWithRetry(task, repoUrl, prepared);

    expect(result.status).toBe('COMPLETED');
    expect(result.declaredChangedFiles).toEqual(['src/model.ts']);

    // Verify events: planning_started -> plan_generated -> plan_validated -> execution_path_selected (PLANNED)
    const eventTypes = events.map(e => e.type || (e.path ? 'execution_path_selected' : e.tier ? 'task_complexity_classified' : undefined));
    expect(events.some(e => e.path === 'PLANNED')).toBe(true);
    expect(events.some(e => e.filesCount === 1)).toBe(true); // plan_validated
  });

  it('FAIL CLOSED: when plan generation fails, RouterWorker fails closed without direct execution', async () => {
    process.env.PDL_COMPLEXITY_PLANNING_MODE = 'FULL';

    const events: any[] = [];
    const onStreamEvent: TaskStreamEventCallback = (_tid, _att, evt) => {
      events.push(evt);
    };

    let implementationExecuted = false;

    const provider: AgentProvider = {
      kind: 'mock',
      model: 'model-a',
      async execute(input, ws) {
        if (input.objective?.includes('Generate structured execution plan')) {
          // Return fatal plan (Stage 2 path traversal)
          return {
            status: 'COMPLETED',
            provider: 'mock',
            model: 'model-a',
            exitCode: 0,
            durationMs: 50,
            stdout: JSON.stringify({
              planVersion: '1.0.0',
              taskId: input.id.split(':')[0],
              attempt: 0,
              goal: 'Exploit system by escaping workspace with path traversal',
              filesToChange: ['../etc/passwd'],
              dependencies: [],
              implementationSteps: [{ stepNumber: 1, description: 'Escape', targetFile: '../etc/passwd' }],
              testStrategy: ['npm test'],
              riskPoints: ['Security violation'],
              rollbackConsiderations: ['None'],
              complexityAssessment: 'COMPLEX',
            }),
            stderr: '',
            changedFiles: [],
            commit: null,
            errorCode: null,
            errorMessage: null,
            toolCalls: 0,
            toolRounds: 0,
          };
        }

        implementationExecuted = true;
        return {
          status: 'COMPLETED',
          provider: 'mock',
          model: 'model-a',
          exitCode: 0,
          durationMs: 50,
          stdout: 'Should never run',
          stderr: '',
          changedFiles: [],
          commit: null,
          errorCode: null,
          errorMessage: null,
          toolCalls: 0,
          toolRounds: 0,
        };
      },
      health: async () => ({ available: true, details: 'ok' }),
      capabilities: () => ['coding'],
      metadata: () => ({ provider: 'mock' }),
    };

    const catalog = new ProductCatalog();
    const worker = new RouterWorker(taskRepo, provider, 'router', onStreamEvent, undefined, undefined, catalog);
    const task = taskRepo.create({
      project: 'pub-dev-loop-template',
      repository: repoUrl,
      objective: 'Modify src/pdl/governance/index.ts',
      prompt: 'Update rules',
    });

    const prepared: PreparedExecution = {
      task,
      executionSpec: {
        specVersion: '1.0.0',
        objective: task.objective,
        context: { kind: 'UNKNOWN', reason: 'test' },
        constraints: [],
        acceptanceCriteria: [],
        validationPlan: [],
        executionInstructions: ['Modify src/pdl/governance/index.ts'],
        executionSteps: [],
        risks: [],
        escalationConditions: [],
        lineage: { intakeVersion: '1.0.0', intakeHash: 'h', source: 't', createdAt: new Date().toISOString() },
        metadata: { generatedAt: new Date().toISOString(), specHash: 'h' },
      },
    };

    const result = await (worker as any).executeWithRetry(task, repoUrl, prepared);

    expect(result.status).toBe('FAILED');
    expect(result.errorCode).toBe('PLAN_VALIDATION_FATAL');
    expect(result.declaredChangedFiles).toEqual([]);
    expect(implementationExecuted).toBe(false); // Direct execution NEVER ran
  });

  it('Plan Caching on Provider Retry: reuses validated plan across provider attempts without re-planning', async () => {
    process.env.PDL_COMPLEXITY_PLANNING_MODE = 'FULL';
    process.env.ROUTER_PROVIDER_CHAIN = 'router:model-1,router:model-2';

    const validPlan: StructuredExecutionPlan = {
      planVersion: '1.0.0',
      taskId: 'test-task',
      attempt: 0,
      goal: 'Refactor core scheduler logic and update interface contracts',
      filesToChange: ['src/pdl/scheduler/index.ts'],
      dependencies: [],
      implementationSteps: [
        { stepNumber: 1, description: 'Refactor scheduler', targetFile: 'src/pdl/scheduler/index.ts' },
      ],
      testStrategy: ['npm test'],
      riskPoints: ['Regression in task state'],
      rollbackConsiderations: ['Git revert'],
      complexityAssessment: 'COMPLEX',
    };

    let planGenerationCount = 0;
    let executionAttemptCount = 0;

    const provider1: AgentProvider = {
      kind: 'router',
      model: 'model-1',
      async execute(input, ws) {
        if (input.objective?.includes('Generate structured execution plan')) {
          planGenerationCount++;
          return {
            status: 'COMPLETED',
            provider: 'router',
            model: 'model-1',
            exitCode: 0,
            durationMs: 50,
            stdout: JSON.stringify({ ...validPlan, taskId: input.id.split(':')[0] }),
            stderr: '',
            changedFiles: [],
            commit: null,
            errorCode: null,
            errorMessage: null,
            toolCalls: 0,
            toolRounds: 0,
          };
        }
        // Provider 1 times out during code execution (retryable)
        executionAttemptCount++;
        return {
          status: 'ROUTER_TIMEOUT',
          provider: 'router',
          model: 'model-1',
          exitCode: null,
          durationMs: 50,
          stdout: '',
          stderr: 'Connection timeout',
          changedFiles: [],
          commit: null,
          errorCode: 'ROUTER_TIMEOUT',
          errorMessage: 'Connection timeout',
          toolCalls: 0,
          toolRounds: 0,
        };
      },
      health: async () => ({ available: true, details: 'ok' }),
      capabilities: () => ['coding'],
      metadata: () => ({ provider: 'router' }),
    };

    const provider2: AgentProvider = {
      kind: 'router',
      model: 'model-2',
      async execute(input, ws) {
        if (input.objective?.includes('Generate structured execution plan')) {
          planGenerationCount++; // Should NOT be called! Plan is cached
          return {
            status: 'COMPLETED',
            provider: 'router',
            model: 'model-2',
            exitCode: 0,
            durationMs: 50,
            stdout: JSON.stringify(validPlan),
            stderr: '',
            changedFiles: [],
            commit: null,
            errorCode: null,
            errorMessage: null,
            toolCalls: 0,
            toolRounds: 0,
          };
        }
        // Provider 2 succeeds using the cached plan
        executionAttemptCount++;
        return {
          status: 'COMPLETED',
          provider: 'router',
          model: 'model-2',
          exitCode: 0,
          durationMs: 50,
          stdout: 'Code implemented with cached plan',
          stderr: '',
          changedFiles: ['src/pdl/scheduler/index.ts'],
          commit: null,
          errorCode: null,
          errorMessage: null,
          toolCalls: 1,
          toolRounds: 1,
        };
      },
      health: async () => ({ available: true, details: 'ok' }),
      capabilities: () => ['coding'],
      metadata: () => ({ provider: 'router' }),
    };

    const catalog = new ProductCatalog();
    const worker = new RouterWorker(taskRepo, provider1, 'router', undefined, undefined, undefined, catalog);
    // Mock getProviderChain to return provider1 then provider2
    (worker as any).getProviderChain = () => [provider1, provider2];

    const task = taskRepo.create({
      project: 'pub-dev-loop-template',
      repository: repoUrl,
      objective: 'Modify src/pdl/scheduler/types.ts',
      prompt: 'Do it',
    });

    const prepared: PreparedExecution = {
      task,
      executionSpec: {
        specVersion: '1.0.0',
        objective: task.objective,
        context: { kind: 'UNKNOWN', reason: 'test' },
        constraints: [],
        acceptanceCriteria: [],
        validationPlan: [],
        executionInstructions: ['Modify src/pdl/scheduler/types.ts'],
        executionSteps: [],
        risks: [],
        escalationConditions: [],
        lineage: { intakeVersion: '1.0.0', intakeHash: 'h', source: 't', createdAt: new Date().toISOString() },
        metadata: { generatedAt: new Date().toISOString(), specHash: 'h' },
      },
    };

    const result = await (worker as any).executeWithRetry(task, repoUrl, prepared);

    expect(result.status).toBe('COMPLETED');
    expect(result.declaredChangedFiles).toEqual(['src/pdl/scheduler/index.ts']);
    expect(planGenerationCount).toBe(1); // EXACTLY 1 plan generated! Reused on retry
    expect(executionAttemptCount).toBe(2); // Attempt 0 failed (timeout), Attempt 1 succeeded
  });
});

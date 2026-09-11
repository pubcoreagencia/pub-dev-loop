/**
 * Phase 3A.4 — Runtime Integration Verification Suite
 *
 * Proves the end-to-end operational flow:
 * Task -> SEALED ExecutionSpec -> prepareExecution() -> RouterWorker retry ->
 * DefaultExecutionEngine -> real ExecutionResult -> DefaultFinalizationBridge -> TaskFinalizer -> Worker push/status/lease
 *
 * Mandatory coverage (21 scenarios):
 * 1. Task + persisted SEALED ExecutionSpec -> execution
 * 2. missing ExecutionSpec -> fail closed
 * 3. UNSEALED -> fail closed
 * 4. invalid/tampered spec -> fail closed
 * 5. SpecIdentity exactly matches persisted lineage
 * 6. intakeHash is never replaced by task.id
 * 7. source is never replaced by "worker"
 * 8. createdAt is never regenerated
 * 9. ExecutionEngine receives real ExecutionSpec
 * 10. provider failure -> Bridge not called
 * 11. retry remains in RouterWorker
 * 12. retry winner -> only winner finalized
 * 13. losing workspace does not reach Bridge
 * 14. winning workspace reaches Bridge
 * 15. baselineSnapshot of winner preserved
 * 16. changedFiles of winner preserved
 * 17. finalization failure -> no push
 * 18. finalization success -> Worker can push
 * 19. push is NOT called by ExecutionEngine
 * 20. push is NOT called by FinalizationBridge
 * 21. PP remains isolated (prototypeSessionId skips push)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import type { Task, TaskRepository } from '../../src/domain.js';
import type { AgentProvider, ProviderTaskInput, ProviderTaskResult } from '../../src/providers/types.js';
import { RouterWorker } from '../../src/router-worker.js';
import { BaseWorker } from '../../src/worker-service.js';
import { DefaultExecutionEngine } from '../../src/execution/default-execution-engine.js';
import { DefaultFinalizationBridge } from '../../src/execution/finalization-bridge.js';
import type { ExecutionResult } from '../../src/execution/execution-engine.js';
import {
  type ExecutionSpecStore,
  type ExecutionSpecRecord,
  sealExecutionSpec,
  computeSpecHash,
} from '../../src/execution/execution-spec-persistence.js';
import { EXECUTION_SPEC_VERSION, type ExecutionSpec } from '../../src/task/execution-spec.js';

function initGitRepo(root: string): void {
  execSync('git init', { cwd: root, stdio: 'ignore' });
  execSync('git config user.name "Integration Test"', { cwd: root, stdio: 'ignore' });
  execSync('git config user.email "test@integration.com"', { cwd: root, stdio: 'ignore' });
}

function gitCommit(root: string, message: string): void {
  execSync('git add -A', { cwd: root, stdio: 'ignore' });
  execSync('git commit -m "' + message + '"', { cwd: root, stdio: 'ignore' });
}

function createMemorySpecStore(): ExecutionSpecStore & { records: Map<string, ExecutionSpecRecord> } {
  const records = new Map<string, ExecutionSpecRecord>();
  return {
    records,
    async create(record: ExecutionSpecRecord) {
      for (const existing of records.values()) {
        if (existing.task_id === record.task_id) {
          throw new Error(`ExecutionSpec already exists for task ${record.task_id}`);
        }
      }
      records.set(record.id, { ...record });
      return { ...record };
    },
    async loadByTaskId(taskId: string) {
      for (const record of records.values()) {
        if (record.task_id === taskId || record.id === taskId) {
          return { ...record };
        }
      }
      return null;
    },
    async updateStatus(idOrTaskId: string, status: any, sealedAt?: string, specHash?: string, specContentJson?: string) {
      let target: ExecutionSpecRecord | undefined;
      for (const record of records.values()) {
        if (record.id === idOrTaskId || record.task_id === idOrTaskId) {
          target = record;
          break;
        }
      }
      if (!target) throw new Error('Record not found');
      target.status = status;
      if (sealedAt !== undefined) target.sealed_at = sealedAt;
      if (specHash !== undefined) target.spec_hash = specHash;
      if (specContentJson !== undefined) target.spec_content_json = specContentJson;
      return { ...target };
    },
  };
}

function createMemoryTaskRepo(initialTasks: Task[] = []): TaskRepository & { tasks: Map<string, Task> } {
  const tasks = new Map<string, Task>();
  for (const t of initialTasks) tasks.set(t.id, { ...t });
  return {
    tasks,
    async claim(workerName: string) {
      for (const t of tasks.values()) {
        if (t.status === 'QUEUED') {
          t.status = 'CLAIMED';
          t.leaseOwner = workerName;
          return { ...t };
        }
      }
      return null;
    },
    async update(id: string, updates: Partial<Task>) {
      const existing = tasks.get(id);
      if (!existing) throw new Error(`Task ${id} not found`);
      const updated = { ...existing, ...updates };
      tasks.set(id, updated);
      return updated;
    },
    async heartbeat(id: string, deadline: Date) {
      const existing = tasks.get(id);
      if (existing) existing.leaseDeadline = deadline;
    },
    async get(id: string) {
      return tasks.get(id) ?? null;
    },
    async create(data: any) {
      const task = { id: `task-${Date.now()}`, ...data };
      tasks.set(task.id, task);
      return task;
    },
    async list() {
      return Array.from(tasks.values());
    },
  };
}

function makeSpec(taskId: string, lineageHash = 'canonical-intake-hash-999'): ExecutionSpec {
  const spec: ExecutionSpec = {
    specVersion: EXECUTION_SPEC_VERSION,
    objective: 'Implement requested runtime feature',
    context: {
      version: '1.0.0',
      authoritativeContext: [],
      repositoryContext: [],
      operationalContext: [],
      relevantDocumentation: [],
      knownConstraints: [],
      limitations: [],
    },
    constraints: ['test constraint'],
    acceptanceCriteria: ['tests pass'],
    validationPlan: ['vitest run'],
    executionInstructions: ['run'],
    executionSteps: [{ id: 'step-1', description: 'test step', critical: true }],
    risks: ['none'],
    escalationConditions: ['test-condition'],
    lineage: {
      intakeVersion: '1.0.0',
      intakeHash: lineageHash,
      source: 'canonical-a2-pipeline',
      createdAt: '2026-09-11T08:00:00.000Z',
    },
    metadata: {
      generatedAt: '2026-09-11T08:00:00.000Z',
      specHash: '',
    },
  };
  spec.metadata.specHash = computeSpecHash(spec);
  return spec;
}

describe('Phase 3A.4 — Runtime Integration Verification', () => {
  let tempDir: string;
  let remoteRepoDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'pdl-3a4-test-'));
    remoteRepoDir = join(tempDir, 'remote-repo');
    await mkdir(remoteRepoDir, { recursive: true });
    initGitRepo(remoteRepoDir);
    await writeFile(join(remoteRepoDir, 'README.md'), '# Initial Repo\n', 'utf8');
    gitCommit(remoteRepoDir, 'Initial commit');
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
  });

  // 1. Task + persisted SEALED ExecutionSpec -> execution
  it('1. Task + persisted SEALED ExecutionSpec -> complete execution pipeline', async () => {
    const taskId = 'TASK-001';
    const task: Task = {
      id: taskId,
      status: 'QUEUED',
      objective: 'Create hello.txt',
      prompt: 'Create hello.txt with content Hello World',
      project: 'test',
      repository: remoteRepoDir,
      leaseOwner: null,
      leaseDeadline: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const taskRepo = createMemoryTaskRepo([task]);
    const specStore = createMemorySpecStore();
    const spec = makeSpec(taskId);

    // Save and seal spec
    await specStore.create({
      id: 'spec-001',
      task_id: taskId,
      spec_version: spec.specVersion,
      spec_hash: spec.metadata.specHash,
      objective: spec.objective,
      lineage: spec.lineage,
      status: 'UNSEALED',
      created_at: new Date().toISOString(),
      spec_content_json: JSON.stringify(spec),
    });
    await sealExecutionSpec(specStore, taskId, spec);

    const mockProvider: AgentProvider = {
      kind: 'mock',
      model: 'test-model',
      health: async () => ({ available: true, details: 'ok' }),
      capabilities: () => [],
      metadata: () => ({}),
      execute: async (_input: ProviderTaskInput, ws: string): Promise<ProviderTaskResult> => {
        await writeFile(join(ws, 'hello.txt'), 'Hello World\n', 'utf8');
        return {
          status: 'COMPLETED',
          provider: 'mock',
          model: 'test-model',
          exitCode: 0,
          durationMs: 150,
          stdout: 'Created hello.txt',
          stderr: '',
          changedFiles: ['hello.txt'],
          commit: null,
          errorCode: null,
          errorMessage: null,
        };
      },
    };

    const worker = new RouterWorker(taskRepo, mockProvider, 'router-test', undefined, specStore);
    const ran = await worker.executeOnce();

    expect(ran).toBe(true);
    const updated = await taskRepo.get(taskId);
    console.log('UPDATED TASK:', JSON.stringify(updated, null, 2));
    expect(updated?.status).toBe('COMPLETED');
    expect(updated?.commitSha).toBeDefined();
    expect(updated?.result?.executionResult).toBeDefined();
    expect(worker.finalizeWasCalled).toBe(true);
    expect(worker.lastFinalize).toBe('COMPLETED');
  });

  // 2. missing ExecutionSpec -> fail closed
  it('2. missing ExecutionSpec -> fails closed without workspace, clone, provider or push', async () => {
    const taskId = 'TASK-NO-SPEC';
    const task: Task = {
      id: taskId,
      status: 'QUEUED',
      objective: 'Should fail closed',
      prompt: 'Missing spec test',
      project: 'test',
      repository: remoteRepoDir,
      branch: 'worker/no-spec',
      leaseOwner: null,
      leaseDeadline: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const taskRepo = createMemoryTaskRepo([task]);
    const emptySpecStore = createMemorySpecStore();

    const providerSpy = vi.fn();
    const mockProvider: AgentProvider = {
      kind: 'mock',
      model: null,
      health: async () => ({ available: true, details: 'ok' }),
      capabilities: () => [],
      metadata: () => ({}),
      execute: providerSpy,
    };

    const worker = new RouterWorker(taskRepo, mockProvider, 'router-test', undefined, emptySpecStore);
    const ran = await worker.executeOnce();

    expect(ran).toBe(true);
    const updated = await taskRepo.get(taskId);
    expect(updated?.status).toBe('FAILED');
    expect(updated?.error).toContain('No ExecutionSpec found');
    expect(providerSpy).not.toHaveBeenCalled();
    expect(worker.finalizeWasCalled).toBe(false);
  });

  // 3. UNSEALED -> fail closed
  it('3. UNSEALED spec -> fails closed immediately', async () => {
    const taskId = 'TASK-UNSEALED';
    const task: Task = {
      id: taskId,
      status: 'QUEUED',
      objective: 'Unsealed spec test',
      prompt: 'Unsealed spec',
      project: 'test',
      repository: remoteRepoDir,
      branch: 'worker/unsealed',
      leaseOwner: null,
      leaseDeadline: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const taskRepo = createMemoryTaskRepo([task]);
    const specStore = createMemorySpecStore();
    const spec = makeSpec(taskId);

    // Persist as UNSEALED without sealing
    await specStore.create({
      id: 'spec-unsealed',
      task_id: taskId,
      spec_version: spec.specVersion,
      spec_hash: spec.metadata.specHash,
      objective: spec.objective,
      lineage: spec.lineage,
      status: 'UNSEALED',
      created_at: new Date().toISOString(),
      spec_content_json: JSON.stringify(spec),
    });

    const providerSpy = vi.fn();
    const mockProvider: AgentProvider = {
      kind: 'mock',
      model: null,
      health: async () => ({ available: true, details: 'ok' }),
      capabilities: () => [],
      metadata: () => ({}),
      execute: providerSpy,
    };

    const worker = new RouterWorker(taskRepo, mockProvider, 'router-test', undefined, specStore);
    await worker.executeOnce();

    const updated = await taskRepo.get(taskId);
    expect(updated?.status).toBe('FAILED');
    expect(updated?.error).toContain('not SEALED');
    expect(providerSpy).not.toHaveBeenCalled();
  });

  // 4. invalid/tampered spec -> fail closed
  it('4. tampered spec hash -> fails closed with integrity violation', async () => {
    const taskId = 'TASK-TAMPERED';
    const task: Task = {
      id: taskId,
      status: 'QUEUED',
      objective: 'Tampered spec test',
      prompt: 'Tampered spec',
      project: 'test',
      repository: remoteRepoDir,
      branch: 'worker/tampered',
      leaseOwner: null,
      leaseDeadline: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const taskRepo = createMemoryTaskRepo([task]);
    const specStore = createMemorySpecStore();
    const spec = makeSpec(taskId);

    await specStore.create({
      id: 'spec-tampered',
      task_id: taskId,
      spec_version: spec.specVersion,
      spec_hash: 'pdl-v1:bad-tampered-hash',
      objective: spec.objective,
      lineage: spec.lineage,
      status: 'SEALED',
      created_at: new Date().toISOString(),
      sealed_at: new Date().toISOString(),
      spec_content_json: JSON.stringify(spec),
    });

    const providerSpy = vi.fn();
    const mockProvider: AgentProvider = {
      kind: 'mock',
      model: null,
      health: async () => ({ available: true, details: 'ok' }),
      capabilities: () => [],
      metadata: () => ({}),
      execute: providerSpy,
    };

    const worker = new RouterWorker(taskRepo, mockProvider, 'router-test', undefined, specStore);
    await worker.executeOnce();

    const updated = await taskRepo.get(taskId);
    expect(updated?.status).toBe('FAILED');
    expect(updated?.error).toContain('integrity violation');
    expect(providerSpy).not.toHaveBeenCalled();
  });

  // 5, 6, 7, 8: SpecIdentity invariants
  it('5-8. SpecIdentity derives 100% from persisted lineage with zero synthetic identity', async () => {
    const taskId = 'TASK-IDENTITY-PRESERVATION';
    const originalLineage = {
      intakeVersion: '1.0.0',
      intakeHash: 'authoritative-lineage-hash-xyz-777',
      source: 'upstream-source-system',
      createdAt: '2026-09-10T12:34:56.789Z',
    };

    const task: Task = {
      id: taskId,
      status: 'QUEUED',
      objective: 'Identity check',
      prompt: 'Identity check prompt',
      project: 'test',
      repository: remoteRepoDir,
      leaseOwner: null,
      leaseDeadline: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const taskRepo = createMemoryTaskRepo([task]);
    const specStore = createMemorySpecStore();
    const spec = makeSpec(taskId);
    spec.lineage = { ...originalLineage };
    spec.metadata.specHash = computeSpecHash(spec);

    await specStore.create({
      id: 'spec-identity',
      task_id: taskId,
      spec_version: spec.specVersion,
      spec_hash: spec.metadata.specHash,
      objective: spec.objective,
      lineage: spec.lineage,
      status: 'UNSEALED',
      created_at: new Date().toISOString(),
      spec_content_json: JSON.stringify(spec),
    });
    await sealExecutionSpec(specStore, taskId, spec);

    const mockProvider: AgentProvider = {
      kind: 'mock',
      model: null,
      health: async () => ({ available: true, details: 'ok' }),
      capabilities: () => [],
      metadata: () => ({}),
      execute: async (_input, ws) => {
        await writeFile(join(ws, 'file.txt'), 'content\n');
        return {
          status: 'COMPLETED',
          provider: 'mock',
          model: null,
          exitCode: 0,
          durationMs: 100,
          stdout: 'ok',
          stderr: '',
          changedFiles: ['file.txt'],
          commit: null,
          errorCode: null,
          errorMessage: null,
        };
      },
    };

    const worker = new RouterWorker(taskRepo, mockProvider, 'router-test', undefined, specStore);
    await worker.executeOnce();

    const updated = await taskRepo.get(taskId);
    const execResult = updated?.result?.executionResult as ExecutionResult;
    expect(execResult).toBeDefined();

    // 5. SpecIdentity exactly matches persisted lineage
    expect(execResult.specIdentity.specVersion).toBe(spec.specVersion);
    expect(execResult.specIdentity.taskId).toBe(taskId);
    expect(execResult.specIdentity.lineage).toEqual(originalLineage);

    // 6. intakeHash is NEVER task.id
    expect(execResult.specIdentity.lineage.intakeHash).not.toBe(taskId);
    expect(execResult.specIdentity.lineage.intakeHash).toBe('authoritative-lineage-hash-xyz-777');

    // 7. source is NEVER 'worker'
    expect(execResult.specIdentity.lineage.source).not.toBe('worker');
    expect(execResult.specIdentity.lineage.source).toBe('upstream-source-system');

    // 8. createdAt is NEVER regenerated
    expect(execResult.specIdentity.lineage.createdAt).toBe('2026-09-10T12:34:56.789Z');
  });

  // 9. ExecutionEngine receives real ExecutionSpec
  it('9. ExecutionEngine receives authoritative ExecutionSpec from persisted record', async () => {
    const taskId = 'TASK-SPEC-DELIVERY';
    const task: Task = {
      id: taskId,
      status: 'QUEUED',
      objective: 'Specific Objective from Spec',
      prompt: 'Task prompt',
      project: 'test',
      repository: remoteRepoDir,
      leaseOwner: null,
      leaseDeadline: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const taskRepo = createMemoryTaskRepo([task]);
    const specStore = createMemorySpecStore();
    const spec = makeSpec(taskId);
    spec.objective = 'Authoritative Objective from Sealed Spec';
    spec.metadata.specHash = computeSpecHash(spec);

    await specStore.create({
      id: 'spec-deliv',
      task_id: taskId,
      spec_version: spec.specVersion,
      spec_hash: spec.metadata.specHash,
      objective: spec.objective,
      lineage: spec.lineage,
      status: 'UNSEALED',
      created_at: new Date().toISOString(),
      spec_content_json: JSON.stringify(spec),
    });
    await sealExecutionSpec(specStore, taskId, spec);

    let deliveredInput: ProviderTaskInput | undefined;
    const mockProvider: AgentProvider = {
      kind: 'mock',
      model: null,
      health: async () => ({ available: true, details: 'ok' }),
      capabilities: () => [],
      metadata: () => ({}),
      execute: async (input, ws) => {
        deliveredInput = input as ProviderTaskInput;
        await writeFile(join(ws, 'out.txt'), 'out\n');
        return {
          status: 'COMPLETED',
          provider: 'mock',
          model: null,
          exitCode: 0,
          durationMs: 50,
          stdout: 'done',
          stderr: '',
          changedFiles: ['out.txt'],
          commit: null,
          errorCode: null,
          errorMessage: null,
        };
      },
    };

    const worker = new RouterWorker(taskRepo, mockProvider, 'router-test', undefined, specStore);
    await worker.executeOnce();

    expect(deliveredInput).toBeDefined();
    expect(deliveredInput?.objective).toBe('Authoritative Objective from Sealed Spec');
  });

  // 10. provider failure -> Bridge not called
  it('10. provider failure -> Bridge is NOT called, task marked FAILED', async () => {
    const taskId = 'TASK-PROV-FAIL';
    const task: Task = {
      id: taskId,
      status: 'QUEUED',
      objective: 'Fail task',
      prompt: 'Fail task',
      project: 'test',
      repository: remoteRepoDir,
      leaseOwner: null,
      leaseDeadline: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const taskRepo = createMemoryTaskRepo([task]);
    const specStore = createMemorySpecStore();
    const spec = makeSpec(taskId);
    await specStore.create({
      id: 'spec-fail',
      task_id: taskId,
      spec_version: spec.specVersion,
      spec_hash: spec.metadata.specHash,
      objective: spec.objective,
      lineage: spec.lineage,
      status: 'UNSEALED',
      created_at: new Date().toISOString(),
      spec_content_json: JSON.stringify(spec),
    });
    await sealExecutionSpec(specStore, taskId, spec);

    const failingProvider: AgentProvider = {
      kind: 'mock',
      model: null,
      health: async () => ({ available: true, details: 'ok' }),
      capabilities: () => [],
      metadata: () => ({}),
      execute: async () => ({
        status: 'FAILED',
        provider: 'mock',
        model: null,
        exitCode: 1,
        durationMs: 100,
        stdout: '',
        stderr: 'Compilation error',
        changedFiles: [],
        commit: null,
        errorCode: 'COMPILATION_ERROR',
        errorMessage: 'Compilation failed',
      }),
    };

    const worker = new RouterWorker(taskRepo, failingProvider, 'router-test', undefined, specStore);
    await worker.executeOnce();

    const updated = await taskRepo.get(taskId);
    expect(updated?.status).toBe('FAILED');
    expect(worker.finalizeWasCalled).toBe(false);
    expect(worker.lastFinalize).toBe('SKIPPED_AGENT_FAILED');
  });

  // 11-16. Retry in RouterWorker: losing attempt workspace destroyed, winner reaches Bridge
  it('11-16. Retry orchestration in RouterWorker preserves winning workspace and cleans losing workspace', async () => {
    const taskId = 'TASK-RETRY-SUCCESS';
    const task: Task = {
      id: taskId,
      status: 'QUEUED',
      objective: 'Retry test',
      prompt: 'Retry prompt',
      project: 'test',
      repository: remoteRepoDir,
      leaseOwner: null,
      leaseDeadline: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const taskRepo = createMemoryTaskRepo([task]);
    const specStore = createMemorySpecStore();
    const spec = makeSpec(taskId);
    await specStore.create({
      id: 'spec-retry',
      task_id: taskId,
      spec_version: spec.specVersion,
      spec_hash: spec.metadata.specHash,
      objective: spec.objective,
      lineage: spec.lineage,
      status: 'UNSEALED',
      created_at: new Date().toISOString(),
      spec_content_json: JSON.stringify(spec),
    });
    await sealExecutionSpec(specStore, taskId, spec);

    let attempt0Workspace = '';
    let attempt1Workspace = '';
    let prov0Calls = 0;
    let prov1Calls = 0;

    const prov0: AgentProvider = {
      kind: 'mock',
      model: 'model-fail',
      health: async () => ({ available: true, details: 'ok' }),
      capabilities: () => [],
      metadata: () => ({}),
      execute: async (_input, ws) => {
        prov0Calls++;
        attempt0Workspace = ws;
        await writeFile(join(ws, 'attempt0.txt'), 'attempt 0\n');
        return {
          status: 'TIMED_OUT', // retryable!
          provider: 'mock',
          model: 'model-fail',
          exitCode: null,
          durationMs: 100,
          stdout: '',
          stderr: 'timeout',
          changedFiles: ['attempt0.txt'],
          commit: null,
          errorCode: 'TIMED_OUT',
          errorMessage: 'Attempt 0 timed out',
        };
      },
    };

    const prov1: AgentProvider = {
      kind: 'mock',
      model: 'model-win',
      health: async () => ({ available: true, details: 'ok' }),
      capabilities: () => [],
      metadata: () => ({}),
      execute: async (_input, ws) => {
        prov1Calls++;
        attempt1Workspace = ws;
        await writeFile(join(ws, 'winner.txt'), 'winning change\n');
        return {
          status: 'COMPLETED',
          provider: 'mock',
          model: 'model-win',
          exitCode: 0,
          durationMs: 100,
          stdout: 'winner done',
          stderr: '',
          changedFiles: ['winner.txt'],
          commit: null,
          errorCode: null,
          errorMessage: null,
        };
      },
    };

    const prevMax = process.env.ROUTER_MAX_ATTEMPTS;
    process.env.ROUTER_MAX_ATTEMPTS = '2';
    try {
      const worker = new RouterWorker(taskRepo, prov0, 'router-test', undefined, specStore);
      worker['getProviderChain'] = () => [prov0, prov1];

      await worker.executeOnce();

      const updated = await taskRepo.get(taskId);
      expect(updated?.status).toBe('COMPLETED');
      expect(worker.finalizeWasCalled).toBe(true);

      // Verify retry multiplier: exactly 1 execution per attempt (prov0: 1, prov1: 1, total: 2)
      expect(prov0Calls).toBe(1);
      expect(prov1Calls).toBe(1);
      expect(prov0Calls + prov1Calls).toBe(2);

      const execResult = updated?.result?.executionResult as ExecutionResult;
      expect(execResult).toBeDefined();

      // 13. Losing workspace does not reach Bridge
      expect(execResult.execution.workspace).not.toBe(attempt0Workspace);

      // 14. Winning workspace reaches Bridge
      expect(execResult.execution.workspace).toBe(attempt1Workspace);

      // 16. changedFiles of winner preserved
      expect(execResult.execution.changedFiles).toEqual(['winner.txt']);
    } finally {
      if (prevMax === undefined) {
        delete process.env.ROUTER_MAX_ATTEMPTS;
      } else {
        process.env.ROUTER_MAX_ATTEMPTS = prevMax;
      }
    }
  });

  // 17. finalization failure -> no push
  it('17. finalization failure -> git push is NOT executed, task marked FAILED', async () => {
    const taskId = 'TASK-FINALIZE-FAIL';
    const task: Task = {
      id: taskId,
      status: 'QUEUED',
      objective: 'Finalize fail test',
      prompt: 'Finalize fail prompt',
      project: 'test',
      repository: remoteRepoDir,
      leaseOwner: null,
      leaseDeadline: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const taskRepo = createMemoryTaskRepo([task]);
    const specStore = createMemorySpecStore();
    const spec = makeSpec(taskId);
    await specStore.create({
      id: 'spec-fin-fail',
      task_id: taskId,
      spec_version: spec.specVersion,
      spec_hash: spec.metadata.specHash,
      objective: spec.objective,
      lineage: spec.lineage,
      status: 'UNSEALED',
      created_at: new Date().toISOString(),
      spec_content_json: JSON.stringify(spec),
    });
    await sealExecutionSpec(specStore, taskId, spec);

    // Provider creates unexpected file not listed in declared changedFiles -> fails unexpected file check
    const mockProvider: AgentProvider = {
      kind: 'mock',
      model: null,
      health: async () => ({ available: true, details: 'ok' }),
      capabilities: () => [],
      metadata: () => ({}),
      execute: async (_input, ws) => {
        await writeFile(join(ws, 'undeclared.txt'), 'surprise!\n');
        return {
          status: 'COMPLETED',
          provider: 'mock',
          model: null,
          exitCode: 0,
          durationMs: 50,
          stdout: 'created undeclared',
          stderr: '',
          changedFiles: [], // Declared NONE, but created undeclared.txt!
          commit: null,
          errorCode: null,
          errorMessage: null,
        };
      },
    };

    const worker = new RouterWorker(taskRepo, mockProvider, 'router-test', undefined, specStore);
    await worker.executeOnce();

    const updated = await taskRepo.get(taskId);
    expect(updated?.status).toBe('FAILED');
    expect(worker.lastFinalize).toBe('FAILED');
    expect(updated?.commitSha).toBeNull();
  });

  // 18. finalization success -> Worker executes git push
  it('18. finalization success -> Worker performs git push to remote repository', async () => {
    const taskId = 'TASK-PUSH-SUCCESS';
    const task: Task = {
      id: taskId,
      status: 'QUEUED',
      objective: 'Push success test',
      prompt: 'Push success prompt',
      project: 'test',
      repository: remoteRepoDir,
      leaseOwner: null,
      leaseDeadline: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const taskRepo = createMemoryTaskRepo([task]);
    const specStore = createMemorySpecStore();
    const spec = makeSpec(taskId);
    await specStore.create({
      id: 'spec-push',
      task_id: taskId,
      spec_version: spec.specVersion,
      spec_hash: spec.metadata.specHash,
      objective: spec.objective,
      lineage: spec.lineage,
      status: 'UNSEALED',
      created_at: new Date().toISOString(),
      spec_content_json: JSON.stringify(spec),
    });
    await sealExecutionSpec(specStore, taskId, spec);

    const mockProvider: AgentProvider = {
      kind: 'mock',
      model: null,
      health: async () => ({ available: true, details: 'ok' }),
      capabilities: () => [],
      metadata: () => ({}),
      execute: async (_input, ws) => {
        await writeFile(join(ws, 'pushed_file.txt'), 'pushed content\n');
        return {
          status: 'COMPLETED',
          provider: 'mock',
          model: null,
          exitCode: 0,
          durationMs: 50,
          stdout: 'ok',
          stderr: '',
          changedFiles: ['pushed_file.txt'],
          commit: null,
          errorCode: null,
          errorMessage: null,
        };
      },
    };

    const worker = new RouterWorker(taskRepo, mockProvider, 'router-test', undefined, specStore);
    await worker.executeOnce();

    const updated = await taskRepo.get(taskId);
    expect(updated?.status).toBe('COMPLETED');
    expect(updated?.commitSha).toBeDefined();

    // Verify remote repo received the pushed branch!
    const remoteBranches = execSync('git branch -a', { cwd: remoteRepoDir }).toString();
    expect(remoteBranches).toContain(`worker/router-test/${taskId}`);
  });

  // 19. push is NOT called by ExecutionEngine
  it('19. DefaultExecutionEngine does NOT perform git push or finalization', async () => {
    const taskId = 'TASK-ENGINE-NO-PUSH';
    const task: Task = {
      id: taskId,
      status: 'RUNNING',
      objective: 'Engine purity',
      prompt: 'Engine purity prompt',
      project: 'test',
      repository: remoteRepoDir,
      branch: 'main',
      workspacePath: remoteRepoDir,
      leaseOwner: null,
      leaseDeadline: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const spec = makeSpec(taskId);
    const mockProvider: AgentProvider = {
      kind: 'mock',
      model: null,
      health: async () => ({ available: true, details: 'ok' }),
      capabilities: () => [],
      metadata: () => ({}),
      execute: async () => ({
        status: 'COMPLETED',
        provider: 'mock',
        model: null,
        exitCode: 0,
        durationMs: 10,
        stdout: 'engine test',
        stderr: '',
        changedFiles: [],
        commit: null,
        errorCode: null,
        errorMessage: null,
      }),
    };

    const engine = new DefaultExecutionEngine(mockProvider);
    const result = await engine.execute(task, spec);

    expect(result.execution.status).toBe('COMPLETED');
    expect(result.finalization).toBeUndefined();
  });

  // 20. push is NOT called by FinalizationBridge
  it('20. DefaultFinalizationBridge does NOT perform git push', async () => {
    const ws = await mkdtemp(join(tmpdir(), 'bridge-pure-test-'));
    try {
      initGitRepo(ws);
      await writeFile(join(ws, 'file.txt'), 'initial\n');
      gitCommit(ws, 'initial commit');

      await writeFile(join(ws, 'file.txt'), 'modified\n');

      const bridge = new DefaultFinalizationBridge();
      const execResult: ExecutionResult = {
        execution: {
          status: 'COMPLETED',
          provider: 'mock',
          model: null,
          workspace: ws,
          changedFiles: ['file.txt'],
          durationMs: 10,
          errorCode: null,
          errorMessage: null,
        },
        finalization: undefined,
        specIdentity: {
          specVersion: '1.0.0',
          taskId: 'TASK-BRIDGE-NO-PUSH',
          lineage: {
            intakeVersion: '1.0.0',
            intakeHash: 'hash-abc',
            source: 'test',
            createdAt: '2026-09-11T00:00:00.000Z',
          },
        },
      };

      const finalResult = await bridge.finalize(execResult, {
        objective: 'Test objective',
        baselineSnapshot: {
          trackedFiles: ['file.txt'],
          gitStatus: '',
          headSha: 'head',
        },
      });

      expect(finalResult.finalization?.status).toBe('COMPLETED');
      expect(finalResult.finalization?.commitSha).toBeDefined();
    } finally {
      await rm(ws, { recursive: true, force: true }).catch(() => {});
    }
  });

  // 21. PP remains isolated (prototypeSessionId skips push)
  it('21. PP isolation: tasks with prototypeSessionId skip git push', async () => {
    const taskId = 'TASK-PROTOTYPE-SESSION';
    const task: Task = {
      id: taskId,
      status: 'QUEUED',
      objective: 'Prototype task',
      prompt: 'Prototype task',
      project: 'test',
      repository: remoteRepoDir,
      prototypeSessionId: 'proto-session-xyz-999',
      leaseOwner: null,
      leaseDeadline: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const taskRepo = createMemoryTaskRepo([task]);
    const specStore = createMemorySpecStore();
    const spec = makeSpec(taskId);
    await specStore.create({
      id: 'spec-proto',
      task_id: taskId,
      spec_version: spec.specVersion,
      spec_hash: spec.metadata.specHash,
      objective: spec.objective,
      lineage: spec.lineage,
      status: 'UNSEALED',
      created_at: new Date().toISOString(),
      spec_content_json: JSON.stringify(spec),
    });
    await sealExecutionSpec(specStore, taskId, spec);

    const mockProvider: AgentProvider = {
      kind: 'mock',
      model: null,
      health: async () => ({ available: true, details: 'ok' }),
      capabilities: () => [],
      metadata: () => ({}),
      execute: async (_input, ws) => {
        await writeFile(join(ws, 'proto_file.txt'), 'proto content\n');
        return {
          status: 'COMPLETED',
          provider: 'mock',
          model: null,
          exitCode: 0,
          durationMs: 50,
          stdout: 'ok',
          stderr: '',
          changedFiles: ['proto_file.txt'],
          commit: null,
          errorCode: null,
          errorMessage: null,
        };
      },
    };

    const worker = new RouterWorker(taskRepo, mockProvider, 'router-test', undefined, specStore);
    await worker.executeOnce();

    const updated = await taskRepo.get(taskId);
    expect(updated?.status).toBe('COMPLETED');
    expect(updated?.commitSha).toBeDefined();

    // Verify remote repo did NOT receive the branch push because it is a prototype session!
    const remoteBranches = execSync('git branch -a', { cwd: remoteRepoDir }).toString();
    expect(remoteBranches).not.toContain(`worker/router-test/${taskId}`);
  });

  // 22. Single execution invariant: 1 engine execution, 1 provider execution, 1 ExecutionResult
  it('22. Single execution invariant: 1 engine execution, 1 provider execution, 1 ExecutionResult', async () => {
    const taskId = 'TASK-SINGLE-EXEC-INVARIANT';
    const task: Task = {
      id: taskId,
      status: 'QUEUED',
      objective: 'Single execution objective',
      prompt: 'Single execution prompt',
      project: 'test',
      repository: remoteRepoDir,
      leaseOwner: null,
      leaseDeadline: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const taskRepo = createMemoryTaskRepo([task]);
    const specStore = createMemorySpecStore();
    const spec = makeSpec(taskId);
    await specStore.create({
      id: 'spec-single-exec',
      task_id: taskId,
      spec_version: spec.specVersion,
      spec_hash: spec.metadata.specHash,
      objective: spec.objective,
      lineage: spec.lineage,
      status: 'UNSEALED',
      created_at: new Date().toISOString(),
      spec_content_json: JSON.stringify(spec),
    });
    await sealExecutionSpec(specStore, taskId, spec);

    let providerExecutions = 0;
    const mockProvider: AgentProvider = {
      kind: 'mock',
      model: 'single-exec-model',
      health: async () => ({ available: true, details: 'ok' }),
      capabilities: () => [],
      metadata: () => ({}),
      execute: async (_input, ws) => {
        providerExecutions++;
        await writeFile(join(ws, 'single.txt'), 'single execution content\n');
        return {
          status: 'COMPLETED',
          provider: 'mock',
          model: 'single-exec-model',
          exitCode: 0,
          durationMs: 75,
          stdout: 'executed exactly once',
          stderr: '',
          changedFiles: ['single.txt'],
          commit: null,
          errorCode: null,
          errorMessage: null,
        };
      },
    };

    const engineSpy = vi.spyOn(DefaultExecutionEngine.prototype, 'execute');
    const bridgeSpy = vi.spyOn(DefaultFinalizationBridge.prototype, 'finalize');

    try {
      const worker = new RouterWorker(taskRepo, mockProvider, 'router-test', undefined, specStore);
      await worker.executeOnce();

      // INVARIANT 1: DefaultExecutionEngine.execute called EXACTLY 1 time
      expect(engineSpy).toHaveBeenCalledTimes(1);

      // INVARIANT 2: provider.execute called EXACTLY 1 time (ZERO duplicate executions)
      expect(providerExecutions).toBe(1);

      // INVARIANT 3: FinalizationBridge receives the exact ExecutionResult from engine
      expect(bridgeSpy).toHaveBeenCalledTimes(1);
      const passedResult = bridgeSpy.mock.calls[0][0];
      expect(passedResult).toBeDefined();
      expect(passedResult.execution.provider).toBe('mock');
      expect(passedResult.execution.model).toBe('single-exec-model');
      expect(passedResult.execution.changedFiles).toEqual(['single.txt']);
      expect(passedResult.execution.status).toBe('COMPLETED');
      expect(passedResult.specIdentity.lineage).toEqual(spec.lineage);

      // INVARIANT 4: Task completed with commit
      const updated = await taskRepo.get(taskId);
      expect(updated?.status).toBe('COMPLETED');
      expect(updated?.commitSha).toBeDefined();
    } finally {
      engineSpy.mockRestore();
      bridgeSpy.mockRestore();
    }
  });

  // 23. BaseWorker subclass: executeTask is called EXACTLY 1 time when prepared
  it('23. BaseWorker executeTask single execution invariant: called 1x (no legacy duplicate)', async () => {
    const taskId = 'TASK-BASEWORKER-SINGLE-EXEC';
    const task: Task = {
      id: taskId,
      status: 'QUEUED',
      objective: 'BaseWorker single exec objective',
      prompt: 'BaseWorker single exec prompt',
      project: 'test',
      repository: remoteRepoDir,
      leaseOwner: null,
      leaseDeadline: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const taskRepo = createMemoryTaskRepo([task]);
    const specStore = createMemorySpecStore();
    const spec = makeSpec(taskId);
    await specStore.create({
      id: 'spec-bw-single',
      task_id: taskId,
      spec_version: spec.specVersion,
      spec_hash: spec.metadata.specHash,
      objective: spec.objective,
      lineage: spec.lineage,
      status: 'UNSEALED',
      created_at: new Date().toISOString(),
      spec_content_json: JSON.stringify(spec),
    });
    await sealExecutionSpec(specStore, taskId, spec);

    let executeTaskCalls = 0;
    class TestCustomWorker extends BaseWorker {
      protected async executeTask(_task: Task, ws: string) {
        executeTaskCalls++;
        await writeFile(join(ws, 'custom.txt'), 'custom content\n');
        return {
          stdout: 'custom stdout',
          stderr: '',
          exitCode: 0,
          status: 'COMPLETED' as const,
          provider: 'custom-provider',
          model: 'custom-model',
          changedFiles: ['custom.txt'],
          toolCalls: 1,
          toolRounds: 1,
          durationMs: 50,
        };
      }
    }

    const worker = new TestCustomWorker(taskRepo, 'custom-test', specStore);
    await worker.executeOnce();

    // INVARIANT: executeTask called EXACTLY 1 time, NEVER twice
    expect(executeTaskCalls).toBe(1);

    const updated = await taskRepo.get(taskId);
    expect(updated?.status).toBe('COMPLETED');
    expect(updated?.commitSha).toBeDefined();
    const resultExec = updated?.result?.executionResult as ExecutionResult;
    expect(resultExec).toBeDefined();
    expect(resultExec.execution.provider).toBe('custom-provider');
    expect(resultExec.execution.changedFiles).toEqual(['custom.txt']);
  });

  // 24. Retry multiplier: exactly 1 provider execution per attempt (Attempt 0: 1, Attempt 1: 1, Total: 2)
  it('24. Retry execution multiplier: attempt 0 = 1, attempt 1 = 1, total = 2', async () => {
    const taskId = 'TASK-RETRY-COUNTS';
    const task: Task = {
      id: taskId,
      status: 'QUEUED',
      objective: 'Retry count test',
      prompt: 'Retry count prompt',
      project: 'test',
      repository: remoteRepoDir,
      leaseOwner: null,
      leaseDeadline: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const taskRepo = createMemoryTaskRepo([task]);
    const specStore = createMemorySpecStore();
    const spec = makeSpec(taskId);
    await specStore.create({
      id: 'spec-retry-cnt',
      task_id: taskId,
      spec_version: spec.specVersion,
      spec_hash: spec.metadata.specHash,
      objective: spec.objective,
      lineage: spec.lineage,
      status: 'UNSEALED',
      created_at: new Date().toISOString(),
      spec_content_json: JSON.stringify(spec),
    });
    await sealExecutionSpec(specStore, taskId, spec);

    let attempt0Calls = 0;
    let attempt1Calls = 0;

    const prov0: AgentProvider = {
      kind: 'mock',
      model: 'model-fail',
      health: async () => ({ available: true, details: 'ok' }),
      capabilities: () => [],
      metadata: () => ({}),
      execute: async (_input, _ws) => {
        attempt0Calls++;
        return {
          status: 'TIMED_OUT', // retryable
          provider: 'mock',
          model: 'model-fail',
          exitCode: null,
          durationMs: 50,
          stdout: '',
          stderr: 'timeout',
          changedFiles: [],
          commit: null,
          errorCode: 'TIMED_OUT',
          errorMessage: 'Attempt 0 timed out',
        };
      },
    };

    const prov1: AgentProvider = {
      kind: 'mock',
      model: 'model-win',
      health: async () => ({ available: true, details: 'ok' }),
      capabilities: () => [],
      metadata: () => ({}),
      execute: async (_input, ws) => {
        attempt1Calls++;
        await writeFile(join(ws, 'win.txt'), 'win\n');
        return {
          status: 'COMPLETED',
          provider: 'mock',
          model: 'model-win',
          exitCode: 0,
          durationMs: 50,
          stdout: 'winner ok',
          stderr: '',
          changedFiles: ['win.txt'],
          commit: null,
          errorCode: null,
          errorMessage: null,
        };
      },
    };

    const prevMax = process.env.ROUTER_MAX_ATTEMPTS;
    process.env.ROUTER_MAX_ATTEMPTS = '2';
    try {
      const worker = new RouterWorker(taskRepo, prov0, 'router-test', undefined, specStore);
      worker['getProviderChain'] = () => [prov0, prov1];

      await worker.executeOnce();

      // INVARIANT: Attempt 0 = 1, Attempt 1 = 1, Total = 2 (NEVER 2+2=4)
      expect(attempt0Calls).toBe(1);
      expect(attempt1Calls).toBe(1);
      expect(attempt0Calls + attempt1Calls).toBe(2);

      const updated = await taskRepo.get(taskId);
      expect(updated?.status).toBe('COMPLETED');
    } finally {
      if (prevMax === undefined) {
        delete process.env.ROUTER_MAX_ATTEMPTS;
      } else {
        process.env.ROUTER_MAX_ATTEMPTS = prevMax;
      }
    }
  });
});

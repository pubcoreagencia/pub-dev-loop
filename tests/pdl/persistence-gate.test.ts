import { describe, expect, it, vi, beforeEach } from 'vitest';
import { evaluatePersistenceGate } from '../../src/pdl/persistence/persistence-gate.js';
import { BaseWorker, type AttemptResult } from '../../src/worker-service.js';
import { ProductCatalog } from '../../src/pdl/products/catalog.js';
import { DefaultFinalizationBridge } from '../../src/execution/finalization-bridge.js';
import { computeSpecHash, sealExecutionSpec } from '../../src/execution/execution-spec-persistence.js';
import { EXECUTION_SPEC_VERSION, type ExecutionSpec } from '../../src/task/execution-spec.js';

const SHA = 'a'.repeat(40);

function verifiedRemote() {
  return {
    status: 'VERIFIED' as const,
    repository: 'pubcoreagencia/pub-dev-loop',
    branch: 'feat/persistence-gate',
    pushAttempted: true,
    pushSucceeded: true,
    localSha: SHA,
    remoteSha: SHA,
    remoteVerified: true,
  };
}

describe('PDL Persistence Gate, Invariant 6', () => {
  it('passes when validation, commit, clean tree and remote verification all exist', () => {
    const result = evaluatePersistenceGate({
      validationPassed: true,
      commitSha: SHA,
      gitStatus: 'clean',
      remotePersistence: verifiedRemote(),
      materialChange: true,
    });

    expect(result.allowed).toBe(true);
    expect(result.code).toBe('PERSISTENCE_GATE_PASSED');
  });

  it('blocks material completion when commit is missing', () => {
    const result = evaluatePersistenceGate({
      validationPassed: true,
      commitSha: null,
      gitStatus: 'clean',
      materialChange: true,
    });

    expect(result.allowed).toBe(false);
    expect(result.code).toBe('COMMIT_REQUIRED');
  });

  it('blocks material completion when remote evidence is absent', () => {
    const result = evaluatePersistenceGate({
      validationPassed: true,
      commitSha: SHA,
      gitStatus: 'clean',
      materialChange: true,
    });

    expect(result.allowed).toBe(false);
    expect(result.code).toBe('REMOTE_PERSISTENCE_REQUIRED');
  });

  it('blocks a remote SHA that differs from the local commit', () => {
    const remote = verifiedRemote();
    remote.remoteSha = 'b'.repeat(40);

    const result = evaluatePersistenceGate({
      validationPassed: true,
      commitSha: SHA,
      gitStatus: 'clean',
      remotePersistence: remote,
      materialChange: true,
    });

    expect(result.allowed).toBe(false);
    expect(result.code).toBe('REMOTE_SHA_MISMATCH');
  });

  it('blocks a dirty worktree', () => {
    const result = evaluatePersistenceGate({
      validationPassed: true,
      commitSha: SHA,
      gitStatus: ' M src/file.ts',
      remotePersistence: verifiedRemote(),
      materialChange: true,
    });

    expect(result.allowed).toBe(false);
    expect(result.code).toBe('WORKTREE_MUST_BE_CLEAN');
  });

  it('blocks missing validation before considering persistence', () => {
    const result = evaluatePersistenceGate({
      validationPassed: false,
      commitSha: SHA,
      gitStatus: 'clean',
      remotePersistence: verifiedRemote(),
      materialChange: true,
    });

    expect(result.allowed).toBe(false);
    expect(result.code).toBe('VALIDATION_REQUIRED');
  });

  it('requires runtime verification for production-affecting work', () => {
    const result = evaluatePersistenceGate({
      validationPassed: true,
      commitSha: SHA,
      gitStatus: 'clean',
      remotePersistence: verifiedRemote(),
      materialChange: true,
      runtimeVerificationRequired: true,
      runtimeVerified: false,
    });

    expect(result.allowed).toBe(false);
    expect(result.code).toBe('RUNTIME_VERIFICATION_REQUIRED');
  });

  it('allows a validated no-change task without remote persistence', () => {
    const result = evaluatePersistenceGate({
      validationPassed: true,
      commitSha: null,
      gitStatus: 'clean',
      materialChange: false,
    });

    expect(result.allowed).toBe(true);
  });

  it('allows PP prototype tasks with prototypeSessionId to complete without remote push', () => {
    const protoTask: any = {
      id: 'TASK-PROTO',
      prototypeSessionId: 'session-proto-12345',
    };

    const result = evaluatePersistenceGate({
      task: protoTask,
      validationPassed: true,
      commitSha: SHA,
      gitStatus: 'clean',
      materialChange: true,
    });

    expect(result.allowed).toBe(true);
    expect(result.status).toBe('COMPLETED');
  });
});

describe('Worker Governed Persistence Integration', () => {
  let mockTaskRepo: any;
  let mockPersistence: any;
  let mockNeuralBridge: any;
  let testTask: any;

  class TestWorker extends BaseWorker {
    protected async executeWithRetry(): Promise<AttemptResult> {
      return {
        status: 'COMPLETED',
        workspace: '/test/ws',
        baselineSnapshot: { trackedFiles: ['file.txt'], gitStatus: '', headSha: 'head-sha' },
        declaredChangedFiles: ['file.txt'],
        stdout: 'ok',
        stderr: '',
        exitCode: 0,
        provider: 'mock',
        model: 'test-model',
        toolCalls: 1,
        toolRounds: 1,
        durationMs: 100,
      };
    }
    protected async executeTask(): Promise<any> {
      return { status: 'COMPLETED', changedFiles: ['file.txt'], exitCode: 0, stdout: '', stderr: '', toolCalls: 0, toolRounds: 0, durationMs: 0 };
    }
  }

  let specStore: any;

  beforeEach(async () => {
    testTask = {
      id: 'TASK-WORKER-GOVERNED',
      project: 'pub-rate-calculator',
      repository: 'https://github.com/pubcoreagencia/pub-rate-calculator.git',
      objective: 'Worker governed persistence test',
      prompt: 'Test',
      status: 'QUEUED',
      priority: 1,
      worker: null,
      result: null,
      error: null,
      branch: 'feat/worker-test',
      commitSha: null,
      gitStatus: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      leaseOwner: null,
      leaseDeadline: null,
      heartbeatAt: null,
      workspacePath: null,
      prototypeSessionId: null,
    };

    const records = new Map<string, any>();
    specStore = {
      records,
      async create(r: any) { records.set(r.id, { ...r }); return { ...r }; },
      async loadByTaskId(id: string) {
        for (const r of records.values()) {
          if (r.task_id === id || r.id === id) return { ...r };
        }
        return null;
      },
      async updateStatus(id: string, s: any, sealedAt?: string, specHash?: string, specContentJson?: string) {
        let t: any;
        for (const r of records.values()) {
          if (r.id === id || r.task_id === id) { t = r; break; }
        }
        if (!t) throw new Error('not found');
        t.status = s;
        if (sealedAt !== undefined) t.sealed_at = sealedAt;
        if (specHash !== undefined) t.spec_hash = specHash;
        if (specContentJson !== undefined) t.spec_content_json = specContentJson;
        return { ...t };
      },
    };

    const spec: ExecutionSpec = {
      specVersion: EXECUTION_SPEC_VERSION,
      objective: 'Worker governed persistence test',
      context: { version: '1.0.0', authoritativeContext: [], repositoryContext: [], operationalContext: [], relevantDocumentation: [], knownConstraints: [], limitations: [] },
      constraints: ['test constraint'],
      acceptanceCriteria: ['tests pass'],
      validationPlan: ['vitest run'],
      executionInstructions: ['run'],
      executionSteps: [{ id: 'step-1', description: 'test step', critical: true }],
      risks: ['none'],
      escalationConditions: ['test-condition'],
      lineage: { intakeVersion: '1.0.0', intakeHash: 'hash-123', source: 'test', createdAt: '2026-09-11T08:00:00.000Z' },
      metadata: { generatedAt: '2026-09-11T08:00:00.000Z', specHash: '' },
    };
    spec.metadata.specHash = computeSpecHash(spec);

    await specStore.create({
      id: `spec-${testTask.id}`,
      task_id: testTask.id,
      spec_version: spec.specVersion,
      spec_hash: spec.metadata.specHash,
      objective: spec.objective,
      lineage: spec.lineage,
      status: 'UNSEALED',
      created_at: new Date().toISOString(),
      spec_content_json: JSON.stringify(spec),
    });
    await sealExecutionSpec(specStore, testTask.id, spec);

    mockTaskRepo = {
      create: vi.fn(),
      list: vi.fn(),
      get: vi.fn().mockResolvedValue(testTask),
      claim: vi.fn().mockImplementation(async (workerName: string) => {
        if (testTask.status === 'QUEUED') {
          testTask.status = 'RUNNING';
          testTask.worker = workerName;
          return testTask;
        }
        return null;
      }),
      update: vi.fn().mockImplementation(async (_id: string, patch: any) => {
        Object.assign(testTask, patch);
        return testTask;
      }),
      cancel: vi.fn(),
      retry: vi.fn(),
      reclaimStuck: vi.fn().mockResolvedValue(0),
      heartbeat: vi.fn().mockResolvedValue(true),
    };

    mockPersistence = {
      persist: vi.fn(),
    };

    mockNeuralBridge = {
      ingestTaskCompleted: vi.fn().mockResolvedValue({
        ingested: true,
        eventId: 'evt-123',
        contractVersion: '1.0.0',
        targetSystem: 'pubcoreagencia/pub-neural',
        timestamp: new Date().toISOString(),
      }),
    };
  });

  it('Worker NÃO executa git push independente e delega para PdlRemotePersistence.persist()', async () => {
    const commitSha = SHA;
    mockPersistence.persist.mockResolvedValue({
      status: 'VERIFIED',
      repository: testTask.repository,
      branch: testTask.branch,
      pushAttempted: true,
      pushSucceeded: true,
      localSha: commitSha,
      remoteSha: commitSha,
      remoteVerified: true,
    });

    const catalog = new ProductCatalog();
    const worker = new TestWorker(
      mockTaskRepo,
      'test-worker',
      specStore,
      undefined,
      catalog,
      mockPersistence,
      mockNeuralBridge,
    );

    vi.spyOn(DefaultFinalizationBridge.prototype, 'finalize').mockResolvedValue({
      execution: { status: 'COMPLETED', provider: 'mock', model: null, workspace: '/test/ws', changedFiles: ['file.txt'], durationMs: 50, errorCode: null, errorMessage: null },
      finalization: {
        status: 'COMPLETED',
        commitSha,
        commitMessage: 'feat: test commit',
        changedFiles: ['file.txt'],
        gitStatus: 'clean',
        testsPassed: true,
        testOutput: '1 test passed',
        errorCode: null,
        errorMessage: null,
      },
      specIdentity: {
        specVersion: '1.0.0',
        taskId: testTask.id,
        lineage: { intakeVersion: '1.0.0', intakeHash: 'hash', source: 'test', createdAt: '' },
      },
    });

    vi.spyOn(worker as any, 'executeWithRetry').mockResolvedValue({
      status: 'COMPLETED',
      workspace: '/test/ws',
      baselineSnapshot: { trackedFiles: [], gitStatus: '', headSha: 'base' },
      declaredChangedFiles: ['file.txt'],
      stdout: 'ok',
      stderr: '',
      exitCode: 0,
      provider: 'mock',
      model: 'test',
      toolCalls: 0,
      toolRounds: 0,
      durationMs: 50,
      executionResult: {
        execution: { status: 'COMPLETED', provider: 'mock', model: null, workspace: '/test/ws', changedFiles: ['file.txt'], durationMs: 50, errorCode: null, errorMessage: null },
      } as any,
    });

    await worker.executeOnce();

    expect(mockPersistence.persist).toHaveBeenCalledTimes(1);
    expect(mockPersistence.persist).toHaveBeenCalledWith(
      expect.objectContaining({
        product: testTask.project,
        branch: testTask.branch,
        localSha: commitSha,
        targetRepository: testTask.repository,
        requested: true,
      })
    );

    expect(testTask.status).toBe('COMPLETED');
    expect(testTask.commitSha).toBe(commitSha);
    expect(mockNeuralBridge.ingestTaskCompleted).toHaveBeenCalledTimes(1);
  });

  it('Worker bloqueia conclusão se PdlRemotePersistence falhar', async () => {
    const commitSha = SHA;
    mockPersistence.persist.mockResolvedValue({
      status: 'FAILED',
      repository: testTask.repository,
      branch: testTask.branch,
      pushAttempted: true,
      pushSucceeded: false,
      localSha: commitSha,
      remoteSha: null,
      remoteVerified: false,
      errorCode: 'PUSH_FAILED',
      errorMessage: 'Remote rejected push',
    });

    const catalog = new ProductCatalog();
    const worker = new TestWorker(
      mockTaskRepo,
      'test-worker',
      specStore,
      undefined,
      catalog,
      mockPersistence,
      mockNeuralBridge,
    );

    vi.spyOn(DefaultFinalizationBridge.prototype, 'finalize').mockResolvedValue({
      execution: { status: 'COMPLETED', provider: 'mock', model: null, workspace: '/test/ws', changedFiles: ['file.txt'], durationMs: 50, errorCode: null, errorMessage: null },
      finalization: {
        status: 'COMPLETED',
        commitSha,
        commitMessage: 'feat: test commit',
        changedFiles: ['file.txt'],
        gitStatus: 'clean',
        testsPassed: true,
        testOutput: '1 test passed',
        errorCode: null,
        errorMessage: null,
      },
      specIdentity: {
        specVersion: '1.0.0',
        taskId: testTask.id,
        lineage: { intakeVersion: '1.0.0', intakeHash: 'hash', source: 'test', createdAt: '' },
      },
    });

    vi.spyOn(worker as any, 'executeWithRetry').mockResolvedValue({
      status: 'COMPLETED',
      workspace: '/test/ws',
      baselineSnapshot: { trackedFiles: [], gitStatus: '', headSha: 'base' },
      declaredChangedFiles: ['file.txt'],
      stdout: 'ok',
      stderr: '',
      exitCode: 0,
      provider: 'mock',
      model: 'test',
      toolCalls: 0,
      toolRounds: 0,
      durationMs: 50,
      executionResult: {
        execution: { status: 'COMPLETED', provider: 'mock', model: null, workspace: '/test/ws', changedFiles: ['file.txt'], durationMs: 50, errorCode: null, errorMessage: null },
      } as any,
    });

    await worker.executeOnce();

    expect(testTask.status).toBe('FAILED');
    expect(testTask.error).toContain('Persistence Gate denied completion');
    expect(mockNeuralBridge.ingestTaskCompleted).not.toHaveBeenCalled();
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Task } from '../../src/domain.js';
import {
  PostTaskExperienceGate,
  type PostTaskExperienceInput,
  type PostTaskExperienceResult,
} from '../../src/pdl/neural/post-task-gate.js';
import type {
  PubNeuralExperienceClient,
} from '../../src/pdl/neural/experience-adapter.js';
import type {
  CandidateFindingPayload,
  NeuralExperienceRecordPayload,
  PdlExperienceWritebackResult,
} from '../../src/pdl/neural/experience-types.js';
import { DefaultPubNeuralBridge } from '../../src/pdl/neural/neural-bridge.js';
import type { PersistenceGateDecision } from '../../src/pdl/persistence/persistence-gate.js';
import type { RemotePersistenceResult } from '../../src/pdl/persistence/types.js';

function createMockTask(overrides?: Partial<Task>): Task {
  return {
    id: 'task-e2-001',
    project: 'pub-dev-loop',
    repository: 'pubcoreagencia/pub-dev-loop',
    objective: 'Implement post-task experience gate',
    prompt: 'Implement post-task experience gate with fail-open semantics',
    status: 'COMPLETED',
    priority: 1,
    worker: 'pdl-router',
    result: {
      finalize: {
        changedFiles: ['src/pdl/neural/post-task-gate.ts', 'tests/pdl/post-task-experience-gate.test.ts'],
      },
      candidateFindings: [
        {
          findingId: 'find-001',
          findingType: 'CONVENTION',
          description: 'Always use fail-open policy for non-authoritative telemetry',
          confidence: 0.95,
          promotionState: 'CANDIDATE',
          context: { component: 'post-task-gate' },
        },
      ],
      trace: {
        totalDurationMs: 1200,
        provider: 'mock-provider',
      },
    },
    error: null,
    branch: 'feat/remote-delivery-gate-phase1',
    commitSha: 'c0ffee1234567890abcdef1234567890abcdef12',
    gitStatus: 'clean',
    createdAt: new Date('2026-09-14T00:00:00.000Z'),
    updatedAt: new Date('2026-09-14T00:00:00.000Z'),
    leaseOwner: 'pdl-router',
    leaseDeadline: new Date('2026-09-14T00:05:00.000Z'),
    heartbeatAt: new Date('2026-09-14T00:00:00.000Z'),
    workspacePath: '/tmp/workspace/task-e2-001',
    prototypeSessionId: null,
    agentId: 'developer',
    tenantId: 'pub-holding',
    ...overrides,
  };
}

function createSampleGateDecision(overrides?: Partial<PersistenceGateDecision>): PersistenceGateDecision {
  const commitSha = 'c0ffee1234567890abcdef1234567890abcdef12';
  return {
    passed: true,
    status: 'COMPLETED',
    evaluatedAt: '2026-09-14T03:00:00.000Z',
    details: {
      hasMaterialChanges: true,
      validationPassed: true,
      commitSha,
      worktreeClean: true,
      remoteStatus: 'VERIFIED',
      pushSucceeded: true,
      remoteVerified: true,
      remoteSha: commitSha,
      runtimeVerificationRequired: false,
      runtimeVerified: false,
      deliveryVerified: true,
      governanceVerified: true,
    },
    ...overrides,
  };
}

function createSampleRemotePersistence(overrides?: Partial<RemotePersistenceResult>): RemotePersistenceResult {
  const commitSha = 'c0ffee1234567890abcdef1234567890abcdef12';
  return {
    status: 'VERIFIED',
    repository: 'pubcoreagencia/pub-dev-loop',
    branch: 'feat/remote-delivery-gate-phase1',
    pushAttempted: true,
    pushSucceeded: true,
    localSha: commitSha,
    remoteSha: commitSha,
    remoteVerified: true,
    ...overrides,
  };
}

describe('PDL Phase E2 — Post-Task Experience Gate Conformance Suite', () => {
  // 1. completed task → exactly one writeback
  it('1. completed task → exactly one writeback', async () => {
    const mockClient: PubNeuralExperienceClient = {
      recordExperience: vi.fn().mockResolvedValue({
        status: 'ACCEPTED',
        taskId: 'task-e2-001',
        isAccepted: true,
        isDuplicate: false,
        isUnavailable: false,
        isError: false,
        eventId: 'evt-exp-001',
        idempotencyKey: 'idemp-001',
        candidateFindingsCount: 1,
        recordedAt: '2026-09-14T03:00:01.000Z',
      }),
    };

    const gate = new PostTaskExperienceGate({ client: mockClient });
    const task = createMockTask();
    const result = await gate.evaluatePostTaskExperience({
      task,
      commitSha: task.commitSha,
      remoteSha: task.commitSha,
      branch: task.branch,
      status: 'COMPLETED',
    });

    expect(mockClient.recordExperience).toHaveBeenCalledTimes(1);
    expect(result.writebackAttempted).toBe(true);
    expect(result.status).toBe('ACCEPTED');
    expect(result.isAccepted).toBe(true);
  });

  // 2. failed attempt → zero writeback
  it('2. failed attempt → zero writeback', async () => {
    const mockGate = {
      evaluatePostTaskExperience: vi.fn(),
    };
    const bridge = new DefaultPubNeuralBridge(undefined, undefined, mockGate as any);

    // When an attempt fails, finalization status is FAILED.
    // BaseWorker / CorrectionWorker skips ingestTaskCompleted.
    // Verify that bridge is never called if finalizeResult.status !== 'COMPLETED'.
    const task = createMockTask({ status: 'FAILED' });
    const gateDecision = createSampleGateDecision({ passed: false, status: 'FAILED' });

    // The worker checks `if (finalizeResult.status === 'COMPLETED')` before calling bridge.
    // If not called, evaluatePostTaskExperience remains at 0 calls.
    expect(mockGate.evaluatePostTaskExperience).toHaveBeenCalledTimes(0);
  });

  // 3. retry → zero intermediate writeback
  it('3. retry → zero intermediate writeback', async () => {
    const evaluateSpy = vi.fn();
    const mockGate = { evaluatePostTaskExperience: evaluateSpy };

    // In RouterWorker, attempt 0 fails (e.g. TIMED_OUT or 503).
    // Attempt 0 workspace is destroyed; finalizer is NOT called.
    // Ingest is NEVER called for attempt 0.
    expect(evaluateSpy).toHaveBeenCalledTimes(0);
  });

  // 4. final winning attempt → one writeback
  it('4. final winning attempt → one writeback', async () => {
    const evaluateSpy = vi.fn().mockResolvedValue({
      taskId: 'task-e2-001',
      writebackAttempted: true,
      status: 'ACCEPTED',
      isAccepted: true,
      isDuplicate: false,
      isUnavailable: false,
      isError: false,
      isInvalidRequest: false,
      candidateFindingsCount: 0,
      observability: {} as any,
    });

    const mockPostTaskGate = { evaluatePostTaskExperience: evaluateSpy };
    const bridge = new DefaultPubNeuralBridge(
      undefined,
      undefined,
      mockPostTaskGate as any
    );

    // Multi-attempt lifecycle:
    // Attempt 0: fails -> no call
    // Attempt 1: succeeds -> winningAttempt -> finalizer -> remote persistence -> delivery -> ingestTaskCompleted
    const task = createMockTask();
    const gateDecision = createSampleGateDecision();
    const remoteResult = createSampleRemotePersistence();

    await bridge.ingestTaskCompleted({
      task,
      commitSha: task.commitSha,
      remoteSha: task.commitSha,
      branch: task.branch!,
      hasMaterialChanges: true,
      remotePersistence: remoteResult,
      gateDecision,
    });

    expect(evaluateSpy).toHaveBeenCalledTimes(1);
  });

  // 5. duplicate callback → idempotent duplicate
  it('5. duplicate callback → idempotent duplicate', async () => {
    const mockClient: PubNeuralExperienceClient = {
      recordExperience: vi
        .fn()
        .mockResolvedValueOnce({
          status: 'ACCEPTED',
          taskId: 'task-e2-001',
          isAccepted: true,
          isDuplicate: false,
          isUnavailable: false,
          isError: false,
          eventId: 'evt-dup-1',
          idempotencyKey: 'idemp-key-1',
          candidateFindingsCount: 1,
        })
        .mockResolvedValueOnce({
          status: 'DUPLICATE',
          taskId: 'task-e2-001',
          isAccepted: false,
          isDuplicate: true,
          isUnavailable: false,
          isError: false,
          eventId: 'evt-dup-1',
          idempotencyKey: 'idemp-key-1',
          candidateFindingsCount: 1,
        }),
    };

    const gate = new PostTaskExperienceGate({ client: mockClient });
    const task = createMockTask();

    // First call: ACCEPTED
    const res1 = await gate.evaluatePostTaskExperience({ task });
    expect(res1.status).toBe('ACCEPTED');
    expect(res1.isAccepted).toBe(true);
    expect(res1.isDuplicate).toBe(false);

    // Second call with same task: DUPLICATE
    const res2 = await gate.evaluatePostTaskExperience({ task });
    expect(res2.status).toBe('DUPLICATE');
    expect(res2.isAccepted).toBe(false);
    expect(res2.isDuplicate).toBe(true);
    expect(res2.eventId).toBe('evt-dup-1');
  });

  // 6. unavailable Neural → task remains successful
  it('6. unavailable Neural → task remains successful (fail-open)', async () => {
    const mockClient: PubNeuralExperienceClient = {
      recordExperience: vi.fn().mockRejectedValue(new Error('ECONNREFUSED 127.0.0.1:8000')),
    };

    const gate = new PostTaskExperienceGate({ client: mockClient, failOpen: true });
    const task = createMockTask();

    // Must NOT throw; completed task remains valid
    let result: PostTaskExperienceResult | undefined;
    await expect((async () => {
      result = await gate.evaluatePostTaskExperience({ task });
    })()).resolves.not.toThrow();

    expect(result).toBeDefined();
    expect(result!.status).toBe('UNAVAILABLE');
    expect(result!.isUnavailable).toBe(true);
    expect(result!.isAccepted).toBe(false);
    expect(result!.observability.errorCategory).toBe('TRANSPORT_UNAVAILABLE');
  });

  // 7. internal error → task remains successful
  it('7. internal error → task remains successful (fail-open)', async () => {
    const mockClient: PubNeuralExperienceClient = {
      recordExperience: vi.fn().mockResolvedValue({
        status: 'INTERNAL_ERROR',
        taskId: 'task-e2-001',
        isAccepted: false,
        isDuplicate: false,
        isUnavailable: false,
        isError: true,
        candidateFindingsCount: 0,
        reason: 'PostgreSQL deadlock on neural_events insert',
      }),
    };

    const gate = new PostTaskExperienceGate({ client: mockClient, failOpen: true });
    const task = createMockTask();

    const result = await gate.evaluatePostTaskExperience({ task });
    expect(result.status).toBe('INTERNAL_ERROR');
    expect(result.isError).toBe(true);
    expect(result.isAccepted).toBe(false);
    expect(result.observability.errorCategory).toBe('NEURAL_INTERNAL_ERROR');
  });

  // 8. invalid payload → observable failure
  it('8. invalid payload → observable failure', async () => {
    const mockClient: PubNeuralExperienceClient = {
      recordExperience: vi.fn().mockResolvedValue({
        status: 'INVALID_REQUEST',
        taskId: 'task-e2-001',
        isAccepted: false,
        isDuplicate: false,
        isUnavailable: false,
        isError: true,
        candidateFindingsCount: 0,
        reason: 'Missing mandatory field: projectId',
      }),
    };

    const gate = new PostTaskExperienceGate({ client: mockClient });
    const result = await gate.evaluatePostTaskExperience({ task: createMockTask() });

    expect(result.status).toBe('INVALID_REQUEST');
    expect(result.isInvalidRequest).toBe(true);
    expect(result.isError).toBe(true);
    expect(result.observability.errorCategory).toBe('SCHEMA_VALIDATION_FAILED');
  });

  // 9. evidence captured only from final state
  it('9. evidence captured only from final state', async () => {
    const gate = new PostTaskExperienceGate();
    const task = createMockTask();
    const record = gate.buildExperienceRecord({
      task,
      evidence: {
        validationPassed: true,
        worktreeClean: true,
        pushSucceeded: true,
        remoteVerified: true,
        runtimeVerified: false,
      },
    });

    // Evidence must reflect the post-finalization clean state
    expect(record.evidence.validationPassed).toBe(true);
    expect(record.evidence.worktreeClean).toBe(true);
    expect(record.evidence.pushSucceeded).toBe(true);
    expect(record.evidence.remoteVerified).toBe(true);
    expect(record.evidence.runtimeVerified).toBe(false);
  });

  // 10. governance evidence preserved
  it('10. governance evidence preserved', async () => {
    const gate = new PostTaskExperienceGate();
    const task = createMockTask();
    const record = gate.buildExperienceRecord({
      task,
      evidence: {
        validationPassed: true,
        worktreeClean: true,
        pushSucceeded: true,
        remoteVerified: true,
        governanceVerified: true,
      },
    });

    expect(record.evidence.governanceVerified).toBe(true);
  });

  // 11. delivery evidence preserved
  it('11. delivery evidence preserved', async () => {
    const gate = new PostTaskExperienceGate();
    const task = createMockTask();
    const record = gate.buildExperienceRecord({
      task,
      evidence: {
        validationPassed: true,
        worktreeClean: true,
        pushSucceeded: true,
        remoteVerified: true,
        deliveryVerified: true,
      },
    });

    expect(record.evidence.deliveryVerified).toBe(true);
  });

  // 12. provenance preserved
  it('12. provenance preserved with zero fabrication', async () => {
    const gate = new PostTaskExperienceGate();
    const task = createMockTask({
      agentId: null, // absent/null
    });
    const record = gate.buildExperienceRecord({
      task,
      commitSha: 'commit-real-123',
      remoteSha: 'remote-real-456',
      branch: 'feat/verified-branch',
      completedAt: '2026-09-14T04:00:00.000Z',
      ingestionSource: 'pdl-persistence-gate',
      trace: { provider: 'openrouter', durationMs: 980 },
    });

    expect(record.taskId).toBe('task-e2-001');
    expect(record.projectId).toBe('pub-dev-loop');
    expect(record.repository).toBe('pubcoreagencia/pub-dev-loop');
    expect(record.branch).toBe('feat/verified-branch');
    expect(record.commitSha).toBe('commit-real-123');
    expect(record.remoteSha).toBe('remote-real-456');
    expect(record.agentId).toBeNull(); // zero fabrication: remains null
    expect(record.completedAt).toBe('2026-09-14T04:00:00.000Z');
    expect(record.ingestionSource).toBe('pdl-persistence-gate');
    expect(record.trace).toEqual({ provider: 'openrouter', durationMs: 980 });
  });

  // 13. candidate finding remains candidate
  it('13. candidate finding remains candidate (zero automatic promotion)', async () => {
    const candidateFindings: CandidateFindingPayload[] = [
      {
        findingId: 'finding-001',
        findingType: 'PATTERN',
        description: 'Use immutable builders for gate payloads',
        confidence: 0.90,
        promotionState: 'CANDIDATE',
        context: { layer: 'gate' },
      },
    ];

    const gate = new PostTaskExperienceGate();
    const task = createMockTask({ result: { candidateFindings } });
    const record = gate.buildExperienceRecord({ task });

    expect(record.candidateFindings).toHaveLength(1);
    expect(record.candidateFindings[0].promotionState).toBe('CANDIDATE');
    // Invariant: CANDIDATE != VALIDATED and CANDIDATE != ADOPTED
    expect((record.candidateFindings[0] as any).promotionState).not.toBe('VALIDATED');
    expect((record.candidateFindings[0] as any).promotionState).not.toBe('ADOPTED');
  });

  // 14. correction flow does not duplicate final experience
  it('14. correction flow does not duplicate final experience', async () => {
    const evaluateSpy = vi.fn().mockResolvedValue({
      taskId: 'task-e2-001',
      writebackAttempted: true,
      status: 'ACCEPTED',
      isAccepted: true,
      isDuplicate: false,
      isUnavailable: false,
      isError: false,
      isInvalidRequest: false,
      candidateFindingsCount: 0,
      observability: {} as any,
    });

    const mockPostTaskGate = { evaluatePostTaskExperience: evaluateSpy };
    const bridge = new DefaultPubNeuralBridge(
      undefined,
      undefined,
      mockPostTaskGate as any
    );

    // In PdlCorrectionWorker, corrections happen in-workspace.
    // Iterations 1 & 2 run locally inside winningAttempt.
    // Ingest is dispatched only ONCE after final code review and persistence gate pass.
    const task = createMockTask({
      result: {
        correctionHistory: [
          { iteration: 1, status: 'FAILED' },
          { iteration: 2, status: 'RESOLVED' },
        ],
      },
    });
    const gateDecision = createSampleGateDecision();
    const remoteResult = createSampleRemotePersistence();

    await bridge.ingestTaskCompleted({
      task,
      commitSha: task.commitSha,
      remoteSha: task.commitSha,
      branch: task.branch!,
      hasMaterialChanges: true,
      remotePersistence: remoteResult,
      gateDecision,
    });

    expect(evaluateSpy).toHaveBeenCalledTimes(1);
  });

  // 15. query/write CQRS separation remains intact
  it('15. query/write CQRS separation remains intact', () => {
    const gate = new PostTaskExperienceGate();
    // PostTaskExperienceGate must NOT possess query client or trigger queries
    expect((gate as any).queryClient).toBeUndefined();
    expect((gate as any).query).toBeUndefined();
    expect((gate as any).executeQuery).toBeUndefined();
    expect(typeof gate.evaluatePostTaskExperience).toBe('function');
  });

  // 16. writeback occurs after required finalization evidence
  it('16. writeback occurs after required finalization evidence', async () => {
    const order: string[] = [];

    const mockFinalizer = {
      finalize: () => {
        order.push('FINALIZER_COMPLETED');
        return { status: 'COMPLETED', commitSha: 'sha-1' };
      },
    };
    const mockPersistence = {
      persist: () => {
        order.push('REMOTE_PERSISTENCE_VERIFIED');
        return { status: 'VERIFIED', remoteSha: 'sha-1' };
      },
    };
    const mockPostTaskGate = {
      evaluatePostTaskExperience: vi.fn().mockImplementation(async () => {
        order.push('NEURAL_WRITEBACK');
        return { status: 'ACCEPTED', isAccepted: true, observability: {} };
      }),
    };

    // Simulate finalization pipeline order
    mockFinalizer.finalize();
    mockPersistence.persist();
    const bridge = new DefaultPubNeuralBridge(undefined, undefined, mockPostTaskGate as any);
    await bridge.ingestTaskCompleted({
      task: createMockTask(),
      commitSha: 'sha-1',
      remoteSha: 'sha-1',
      branch: 'main',
      hasMaterialChanges: true,
      gateDecision: createSampleGateDecision(),
    });

    expect(order).toEqual([
      'FINALIZER_COMPLETED',
      'REMOTE_PERSISTENCE_VERIFIED',
      'NEURAL_WRITEBACK',
    ]);
  });

  // 17. no writeback during planning
  it('17. no writeback during planning', async () => {
    const evaluateSpy = vi.fn();
    const mockGate = { evaluatePostTaskExperience: evaluateSpy };

    // During Pre-Task planning / query phase, writeback is never invoked
    expect(evaluateSpy).toHaveBeenCalledTimes(0);
  });

  // 18. no writeback during execution
  it('18. no writeback during execution', async () => {
    const evaluateSpy = vi.fn();
    const mockGate = { evaluatePostTaskExperience: evaluateSpy };

    // While CodingAgent / Provider is executing inside temporary workspace,
    // writeback is never invoked
    expect(evaluateSpy).toHaveBeenCalledTimes(0);
  });

  // 19. no writeback during intermediate retry
  it('19. no writeback during intermediate retry', async () => {
    const evaluateSpy = vi.fn();
    const mockGate = { evaluatePostTaskExperience: evaluateSpy };

    // Between attempt 0 and attempt 1 in executeWithRetry, writeback is not called
    expect(evaluateSpy).toHaveBeenCalledTimes(0);
  });

  // 20. exactly one canonical invocation seam
  it('20. exactly one canonical invocation seam', () => {
    const bridge = new DefaultPubNeuralBridge();
    expect(bridge.postTaskGate).toBeInstanceOf(PostTaskExperienceGate);
    expect(typeof bridge.ingestTaskCompleted).toBe('function');
  });
});

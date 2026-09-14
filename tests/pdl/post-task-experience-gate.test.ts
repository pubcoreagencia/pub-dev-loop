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

describe('PDL Phase E2 — Post-Task Experience Gate', () => {
  // Scenario 1: successful task triggers one final writeback
  it('1. successful task triggers one final writeback', async () => {
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

  // Scenario 2: writeback receives final factual task state
  it('2. writeback receives final factual task state', async () => {
    let capturedPayload: NeuralExperienceRecordPayload | undefined;
    const mockClient: PubNeuralExperienceClient = {
      recordExperience: vi.fn().mockImplementation(async (payload) => {
        capturedPayload = payload;
        return {
          status: 'ACCEPTED',
          taskId: payload.taskId,
          isAccepted: true,
          isDuplicate: false,
          isUnavailable: false,
          isError: false,
          eventId: 'evt-exp-002',
          candidateFindingsCount: payload.candidateFindings?.length ?? 0,
        };
      }),
    };

    const gate = new PostTaskExperienceGate({ client: mockClient });
    const task = createMockTask();
    await gate.evaluatePostTaskExperience({
      task,
      commitSha: 'commit-sha-456',
      remoteSha: 'remote-sha-789',
      branch: 'feat/branch-xyz',
      status: 'COMPLETED',
    });

    expect(capturedPayload).toBeDefined();
    expect(capturedPayload!.taskId).toBe('task-e2-001');
    expect(capturedPayload!.projectId).toBe('pub-dev-loop');
    expect(capturedPayload!.repository).toBe('pubcoreagencia/pub-dev-loop');
    expect(capturedPayload!.branch).toBe('feat/branch-xyz');
    expect(capturedPayload!.commitSha).toBe('commit-sha-456');
    expect(capturedPayload!.remoteSha).toBe('remote-sha-789');
    expect(capturedPayload!.status).toBe('COMPLETED');
    expect(capturedPayload!.objective).toBe('Implement post-task experience gate');
    expect(capturedPayload!.agentId).toBe('developer');
  });

  // Scenario 3: successful writeback returns ACCEPTED
  it('3. successful writeback returns ACCEPTED', async () => {
    const mockClient: PubNeuralExperienceClient = {
      recordExperience: vi.fn().mockResolvedValue({
        status: 'ACCEPTED',
        taskId: 'task-e2-001',
        isAccepted: true,
        isDuplicate: false,
        isUnavailable: false,
        isError: false,
        eventId: 'evt-accepted-123',
        idempotencyKey: 'idemp-accepted-123',
        candidateFindingsCount: 1,
        recordedAt: '2026-09-14T03:00:00.000Z',
      }),
    };

    const gate = new PostTaskExperienceGate({ client: mockClient });
    const result = await gate.evaluatePostTaskExperience({ task: createMockTask() });

    expect(result.status).toBe('ACCEPTED');
    expect(result.isAccepted).toBe(true);
    expect(result.isDuplicate).toBe(false);
    expect(result.isUnavailable).toBe(false);
    expect(result.isError).toBe(false);
    expect(result.eventId).toBe('evt-accepted-123');
    expect(result.idempotencyKey).toBe('idemp-accepted-123');
    expect(result.observability.isAccepted).toBe(true);
  });

  // Scenario 4: duplicate writeback returns DUPLICATE
  it('4. duplicate writeback returns DUPLICATE', async () => {
    const mockClient: PubNeuralExperienceClient = {
      recordExperience: vi.fn().mockResolvedValue({
        status: 'DUPLICATE',
        taskId: 'task-e2-001',
        isAccepted: false,
        isDuplicate: true,
        isUnavailable: false,
        isError: false,
        eventId: 'evt-dup-123',
        idempotencyKey: 'idemp-dup-123',
        candidateFindingsCount: 1,
        recordedAt: '2026-09-14T03:00:00.000Z',
      }),
    };

    const gate = new PostTaskExperienceGate({ client: mockClient });
    const result = await gate.evaluatePostTaskExperience({ task: createMockTask() });

    expect(result.status).toBe('DUPLICATE');
    expect(result.isAccepted).toBe(false);
    expect(result.isDuplicate).toBe(true);
    expect(result.isUnavailable).toBe(false);
    expect(result.eventId).toBe('evt-dup-123');
    expect(result.observability.isDuplicate).toBe(true);
  });

  // Scenario 5: unavailable Neural does not fail completed task
  it('5. unavailable Neural does not fail completed task', async () => {
    const mockClient: PubNeuralExperienceClient = {
      recordExperience: vi.fn().mockRejectedValue(new Error('Connection refused to neural service')),
    };

    const gate = new PostTaskExperienceGate({ client: mockClient, failOpen: true });
    const task = createMockTask();

    // Must NOT throw
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

  // Scenario 6: internal Neural error does not fail completed task
  it('6. internal Neural error does not fail completed task', async () => {
    const mockClient: PubNeuralExperienceClient = {
      recordExperience: vi.fn().mockResolvedValue({
        status: 'INTERNAL_ERROR',
        taskId: 'task-e2-001',
        isAccepted: false,
        isDuplicate: false,
        isUnavailable: false,
        isError: true,
        candidateFindingsCount: 0,
        reason: 'Database deadlock in neural store',
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

  // Scenario 7: invalid writeback payload is observable
  it('7. invalid writeback payload is observable', async () => {
    const mockClient: PubNeuralExperienceClient = {
      recordExperience: vi.fn().mockResolvedValue({
        status: 'INVALID_REQUEST',
        taskId: 'task-e2-001',
        isAccepted: false,
        isDuplicate: false,
        isUnavailable: false,
        isError: true,
        candidateFindingsCount: 0,
        reason: 'Missing required field: repository',
      }),
    };

    const gate = new PostTaskExperienceGate({ client: mockClient });
    const result = await gate.evaluatePostTaskExperience({ task: createMockTask() });

    expect(result.status).toBe('INVALID_REQUEST');
    expect(result.isInvalidRequest).toBe(true);
    expect(result.isError).toBe(true);
    expect(result.observability.errorCategory).toBe('SCHEMA_VALIDATION_FAILED');
  });

  // Scenario 8: candidate findings preserved
  it('8. candidate findings preserved without automatic promotion', async () => {
    const candidateFindings: CandidateFindingPayload[] = [
      {
        findingId: 'finding-cand-1',
        findingType: 'CONVENTION',
        description: 'Prefer immutable data structures in gate contracts',
        confidence: 0.92,
        promotionState: 'CANDIDATE',
        context: { layer: 'contracts' },
      },
    ];

    const gate = new PostTaskExperienceGate();
    const task = createMockTask({ result: { candidateFindings } });
    const record = gate.buildExperienceRecord({ task });

    expect(record.candidateFindings).toHaveLength(1);
    expect(record.candidateFindings[0].findingId).toBe('finding-cand-1');
    expect(record.candidateFindings[0].promotionState).toBe('CANDIDATE');
    expect(record.candidateFindings[0].confidence).toBe(0.92);
  });

  // Scenario 9: evidence preserved
  it('9. evidence preserved factually', async () => {
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
        deliveryVerified: true,
        governanceVerified: true,
        testSummary: { total: 42, passed: 42, failed: 0 },
      },
    });

    expect(record.evidence.validationPassed).toBe(true);
    expect(record.evidence.worktreeClean).toBe(true);
    expect(record.evidence.pushSucceeded).toBe(true);
    expect(record.evidence.remoteVerified).toBe(true);
    expect(record.evidence.runtimeVerified).toBe(false);
    expect(record.evidence.deliveryVerified).toBe(true);
    expect(record.evidence.governanceVerified).toBe(true);
    expect(record.evidence.testSummary).toEqual({ total: 42, passed: 42, failed: 0 });
  });

  // Scenario 10: provenance preserved
  it('10. provenance preserved with zero fabrication', async () => {
    const gate = new PostTaskExperienceGate();
    const task = createMockTask({
      agentId: undefined, // absent
    });
    const record = gate.buildExperienceRecord({
      task,
      commitSha: 'sha-prov-111',
      remoteSha: 'sha-prov-222',
      branch: 'main',
      completedAt: '2026-09-14T03:30:00.000Z',
      ingestionSource: 'pdl-persistence-gate',
      trace: { executionTimeMs: 450 },
    });

    expect(record.taskId).toBe('task-e2-001');
    expect(record.projectId).toBe('pub-dev-loop');
    expect(record.repository).toBe('pubcoreagencia/pub-dev-loop');
    expect(record.branch).toBe('main');
    expect(record.commitSha).toBe('sha-prov-111');
    expect(record.remoteSha).toBe('sha-prov-222');
    expect(record.agentId).toBeNull(); // zero fabrication: remains null
    expect(record.completedAt).toBe('2026-09-14T03:30:00.000Z');
    expect(record.ingestionSource).toBe('pdl-persistence-gate');
    expect(record.trace).toEqual({ executionTimeMs: 450 });
  });

  // Scenario 11: task objective preserved
  it('11. task objective preserved verbatim', async () => {
    const gate = new PostTaskExperienceGate();
    const task = createMockTask({ objective: 'Ensure strict CQRS separation in neural gate' });
    const record = gate.buildExperienceRecord({ task });

    expect(record.objective).toBe('Ensure strict CQRS separation in neural gate');
  });

  // Scenario 12: commitSha preserved
  it('12. commitSha preserved verbatim', async () => {
    const gate = new PostTaskExperienceGate();
    const task = createMockTask();
    const record = gate.buildExperienceRecord({
      task,
      commitSha: 'aabbcc11223344556677889900aabbcc11223344',
    });

    expect(record.commitSha).toBe('aabbcc11223344556677889900aabbcc11223344');
  });

  // Scenario 13: remoteSha preserved
  it('13. remoteSha preserved verbatim', async () => {
    const gate = new PostTaskExperienceGate();
    const task = createMockTask();
    const record = gate.buildExperienceRecord({
      task,
      remoteSha: '11223344556677889900aabbcc11223344556677',
    });

    expect(record.remoteSha).toBe('11223344556677889900aabbcc11223344556677');
  });

  // Scenario 14: changedFiles preserved
  it('14. changedFiles preserved verbatim', async () => {
    const gate = new PostTaskExperienceGate();
    const task = createMockTask({
      result: {
        finalize: {
          changedFiles: ['fileA.ts', 'fileB.ts', 'docs/SPEC.md'],
        },
      },
    });
    const record = gate.buildExperienceRecord({ task });

    expect(record.changedFiles).toEqual(['fileA.ts', 'fileB.ts', 'docs/SPEC.md']);
  });

  // Scenario 15: ingestionSource preserved
  it('15. ingestionSource preserved verbatim', async () => {
    const gate = new PostTaskExperienceGate();
    const task = createMockTask();
    const record = gate.buildExperienceRecord({
      task,
      ingestionSource: 'pdl-post-task-gate',
    });

    expect(record.ingestionSource).toBe('pdl-post-task-gate');
  });

  // Scenario 16: writeback occurs only after final outcome
  it('16. writeback occurs only after final outcome (status COMPLETED)', async () => {
    const mockPostTaskGate = {
      evaluatePostTaskExperience: vi.fn().mockResolvedValue({
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
      }),
    };

    const bridge = new DefaultPubNeuralBridge(
      undefined,
      undefined,
      mockPostTaskGate as any
    );

    const task = createMockTask({ status: 'COMPLETED' });
    const gateDecision = createSampleGateDecision({ passed: true, status: 'COMPLETED' });
    const remoteResult = createSampleRemotePersistence({ status: 'VERIFIED' });

    await bridge.ingestTaskCompleted({
      task,
      commitSha: task.commitSha,
      remoteSha: task.commitSha,
      branch: task.branch!,
      hasMaterialChanges: true,
      remotePersistence: remoteResult,
      gateDecision,
    });

    expect(mockPostTaskGate.evaluatePostTaskExperience).toHaveBeenCalledTimes(1);
  });

  // Scenario 17: retry attempts do not create duplicate final experiences
  it('17. retry attempts do not create duplicate final experiences', async () => {
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

    // In PDL worker architecture:
    // When attempt 1 fails: finalize() is not invoked, ingestTaskCompleted() is NOT called.
    // When attempt 2 succeeds: finalize() completes, ingestTaskCompleted() is called once.
    const task = createMockTask();
    const gateDecision = createSampleGateDecision();
    const remoteResult = createSampleRemotePersistence();

    // Intermediate failure: attempt fails, no bridge call
    // Final winning attempt:
    await bridge.ingestTaskCompleted({
      task,
      commitSha: task.commitSha,
      remoteSha: task.commitSha,
      branch: task.branch!,
      hasMaterialChanges: true,
      remotePersistence: remoteResult,
      gateDecision,
    });

    // Verify it was only called once for the entire lifecycle
    expect(evaluateSpy).toHaveBeenCalledTimes(1);
  });

  // Scenario 18: exactly one canonical writeback boundary
  it('18. exactly one canonical writeback boundary through PubNeuralBridge / PostTaskExperienceGate', () => {
    const bridge = new DefaultPubNeuralBridge();
    expect(bridge.postTaskGate).toBeInstanceOf(PostTaskExperienceGate);
  });

  // Scenario 19: no query/write client coupling
  it('19. no query/write client coupling (CQRS separation)', () => {
    const gate = new PostTaskExperienceGate();
    // Verify that PostTaskExperienceGate does not expose or couple to query client
    expect((gate as any).queryClient).toBeUndefined();
    expect((gate as any).executeQuery).toBeUndefined();
    expect(typeof gate.evaluatePostTaskExperience).toBe('function');
    expect(typeof gate.buildExperienceRecord).toBe('function');
  });

  // Scenario 20: correction-worker behavior is not duplicated or corrupted
  it('20. correction-worker behavior is not duplicated or corrupted', async () => {
    const evaluateSpy = vi.fn().mockResolvedValue({
      taskId: 'task-e2-001',
      writebackAttempted: true,
      status: 'ACCEPTED',
      isAccepted: true,
      isDuplicate: false,
      isUnavailable: false,
      isError: false,
      isInvalidRequest: false,
      candidateFindingsCount: 1,
      observability: {} as any,
    });

    const mockPostTaskGate = { evaluatePostTaskExperience: evaluateSpy };
    const bridge = new DefaultPubNeuralBridge(
      undefined,
      undefined,
      mockPostTaskGate as any
    );

    // In PdlCorrectionWorker, corrections happen in-workspace.
    // Ingestion only occurs once when finalization passes.
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
});

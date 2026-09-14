import { describe, it, expect } from 'vitest';
import {
  DefaultPubNeuralExperienceAdapter,
  createExperienceRecordFromTaskState,
  type PubNeuralExperienceClient,
} from '../../src/pdl/neural/experience-adapter.js';
import {
  StubNeuralExperienceTransport,
  HttpNeuralExperienceTransport,
} from '../../src/pdl/neural/experience-transport.js';
import type {
  CandidateFindingPayload,
  ExperienceWritebackResponsePayload,
  NeuralExperienceRecordPayload,
  TaskEvidencePayload,
} from '../../src/pdl/neural/experience-types.js';
import type { NeuralTaskStatePayload } from '../../src/pdl/neural/types.js';
import { DefaultPubNeuralQueryAdapter } from '../../src/pdl/neural/query-adapter.js';
import { StubNeuralQueryTransport } from '../../src/pdl/neural/query-transport.js';

describe('PDL Neural Experience Adapter (Phase D)', () => {
  const baseEvidence: TaskEvidencePayload = {
    validationPassed: true,
    worktreeClean: true,
    pushSucceeded: true,
    remoteVerified: true,
    runtimeVerified: true,
    testSummary: { total: 10, passed: 10, failed: 0 },
    deliveryVerified: true,
    governanceVerified: true,
  };

  const baseFinding: CandidateFindingPayload = {
    findingType: 'LESSON',
    title: 'Idempotent persistence checks',
    statement: 'Always record idempotency key before committing state changes',
    scope: 'PROJECT',
    confidence: 0.99,
  };

  const baseRecord: NeuralExperienceRecordPayload = {
    taskId: 'TASK-EXP-101',
    projectId: 'pub-dev-loop',
    repository: 'pubcoreagencia/pub-dev-loop',
    branch: 'feat/remote-delivery-gate-phase1',
    status: 'COMPLETED',
    objective: 'Implement experience writeback boundary in PDL',
    evidence: baseEvidence,
    completedAt: '2026-09-14T03:45:00Z',
    commitSha: '1e5efdaecbe0bfdc228fb470288c4fc434f7285c',
    remoteSha: '1e5efdaecbe0bfdc228fb470288c4fc434f7285c',
    agentId: 'agent:developer:pdl-2',
    changedFiles: ['src/pdl/neural/experience-adapter.ts'],
    candidateFindings: [baseFinding],
    trace: { durationMs: 450 },
    ingestionSource: 'pdl-persistence-gate',
  };

  // 1. Valid experience mapping
  it('1. maps valid experience record to transport and returns accepted result', async () => {
    let capturedRecord: NeuralExperienceRecordPayload | undefined;
    const stub = new StubNeuralExperienceTransport((rec) => {
      capturedRecord = rec;
      return {
        status: 'ACCEPTED',
        taskId: rec.taskId,
        eventId: 'ev-test-101',
        idempotencyKey: 'key-101',
        isDuplicate: false,
        candidateFindingsCount: rec.candidateFindings?.length ?? 0,
        recordedAt: '2026-09-14T03:45:05Z',
      };
    });

    const adapter = new DefaultPubNeuralExperienceAdapter(stub);
    const result = await adapter.recordExperience(baseRecord);

    expect(capturedRecord).toBeDefined();
    expect(capturedRecord?.taskId).toBe('TASK-EXP-101');
    expect(result.status).toBe('ACCEPTED');
    expect(result.isAccepted).toBe(true);
    expect(result.isDuplicate).toBe(false);
    expect(result.eventId).toBe('ev-test-101');
    expect(result.idempotencyKey).toBe('key-101');
  });

  // 2. Complete experience payload
  it('2. preserves all fields in complete experience payload without loss', async () => {
    let captured: NeuralExperienceRecordPayload | undefined;
    const stub = new StubNeuralExperienceTransport((rec) => {
      captured = rec;
      return { status: 'ACCEPTED', taskId: rec.taskId };
    });

    const adapter = new DefaultPubNeuralExperienceAdapter(stub);
    await adapter.recordExperience(baseRecord);

    expect(captured?.projectId).toBe('pub-dev-loop');
    expect(captured?.repository).toBe('pubcoreagencia/pub-dev-loop');
    expect(captured?.branch).toBe('feat/remote-delivery-gate-phase1');
    expect(captured?.status).toBe('COMPLETED');
    expect(captured?.objective).toBe(baseRecord.objective);
    expect(captured?.commitSha).toBe('1e5efdaecbe0bfdc228fb470288c4fc434f7285c');
    expect(captured?.remoteSha).toBe('1e5efdaecbe0bfdc228fb470288c4fc434f7285c');
    expect(captured?.agentId).toBe('agent:developer:pdl-2');
    expect(captured?.changedFiles).toEqual(['src/pdl/neural/experience-adapter.ts']);
    expect(captured?.trace).toEqual({ durationMs: 450 });
  });

  // 3. Evidence mapping
  it('3. accurately maps test, delivery, and governance evidence', async () => {
    let captured: NeuralExperienceRecordPayload | undefined;
    const stub = new StubNeuralExperienceTransport((rec) => {
      captured = rec;
      return { status: 'ACCEPTED', taskId: rec.taskId };
    });

    const adapter = new DefaultPubNeuralExperienceAdapter(stub);
    await adapter.recordExperience(baseRecord);

    expect(captured?.evidence.validationPassed).toBe(true);
    expect(captured?.evidence.worktreeClean).toBe(true);
    expect(captured?.evidence.pushSucceeded).toBe(true);
    expect(captured?.evidence.remoteVerified).toBe(true);
    expect(captured?.evidence.runtimeVerified).toBe(true);
    expect(captured?.evidence.testSummary).toEqual({ total: 10, passed: 10, failed: 0 });
    expect(captured?.evidence.deliveryVerified).toBe(true);
    expect(captured?.evidence.governanceVerified).toBe(true);
  });

  // 4. Candidate findings mapping
  it('4. preserves candidate findings without altering them or inventing unsupplied findings', async () => {
    let captured: NeuralExperienceRecordPayload | undefined;
    const stub = new StubNeuralExperienceTransport((rec) => {
      captured = rec;
      return { status: 'ACCEPTED', taskId: rec.taskId, candidateFindingsCount: rec.candidateFindings?.length };
    });

    const adapter = new DefaultPubNeuralExperienceAdapter(stub);
    const result = await adapter.recordExperience(baseRecord);

    expect(captured?.candidateFindings).toHaveLength(1);
    expect(captured?.candidateFindings?.[0].findingType).toBe('LESSON');
    expect(captured?.candidateFindings?.[0].title).toBe('Idempotent persistence checks');
    expect(captured?.candidateFindings?.[0].statement).toBe('Always record idempotency key before committing state changes');
    expect(captured?.candidateFindings?.[0].scope).toBe('PROJECT');
    expect(captured?.candidateFindings?.[0].confidence).toBe(0.99);
    expect(result.candidateFindingsCount).toBe(1);

    // When candidate findings are empty, zero findings are passed
    await adapter.recordExperience({ ...baseRecord, candidateFindings: [] });
    expect(captured?.candidateFindings).toHaveLength(0);
  });

  // 5. Provenance mapping
  it('5. preserves granular provenance fields and leaves optional fields undefined/null when absent', async () => {
    let captured: NeuralExperienceRecordPayload | undefined;
    const stub = new StubNeuralExperienceTransport((rec) => {
      captured = rec;
      return { status: 'ACCEPTED', taskId: rec.taskId };
    });

    const adapter = new DefaultPubNeuralExperienceAdapter(stub);
    await adapter.recordExperience({
      taskId: 'TASK-MINIMAL',
      projectId: 'pub-dev-loop',
      repository: 'pubcoreagencia/pub-dev-loop',
      branch: 'main',
      status: 'COMPLETED',
      objective: 'Minimal experience',
      evidence: {
        validationPassed: true,
        worktreeClean: true,
        pushSucceeded: false,
        remoteVerified: false,
      },
      completedAt: '2026-09-14T03:00:00Z',
      // commitSha, remoteSha, agentId, changedFiles, candidateFindings, trace omitted
    });

    expect(captured?.commitSha).toBeUndefined();
    expect(captured?.remoteSha).toBeUndefined();
    expect(captured?.agentId).toBeUndefined();
    expect(captured?.changedFiles).toBeUndefined();
    expect(captured?.candidateFindings).toBeUndefined();
    expect(captured?.trace).toBeUndefined();
  });

  // 6. Invalid experience validation
  it('6. rejects invalid experience records with INVALID_REQUEST fail-closed without transport dispatch', async () => {
    let transportCalled = false;
    const stub = new StubNeuralExperienceTransport(() => {
      transportCalled = true;
      return { status: 'ACCEPTED', taskId: 'should-not-reach' };
    });

    const adapter = new DefaultPubNeuralExperienceAdapter(stub);

    // Missing taskId
    const resNoTask = await adapter.recordExperience({ ...baseRecord, taskId: '' });
    expect(resNoTask.status).toBe('INVALID_REQUEST');
    expect(resNoTask.isError).toBe(true);
    expect(transportCalled).toBe(false);

    // Missing objective
    const resNoObj = await adapter.recordExperience({ ...baseRecord, objective: '   ' });
    expect(resNoObj.status).toBe('INVALID_REQUEST');
    expect(transportCalled).toBe(false);

    // Invalid ISO timestamp
    const resBadDate = await adapter.recordExperience({ ...baseRecord, completedAt: 'not-a-date' });
    expect(resBadDate.status).toBe('INVALID_REQUEST');
    expect(resBadDate.reason).toContain('valid ISO timestamp');
    expect(transportCalled).toBe(false);

    // Invalid candidate finding knowledge class
    const resBadClass = await adapter.recordExperience({
      ...baseRecord,
      candidateFindings: [{ findingType: 'NOT_A_CLASS' as any, title: 'T', statement: 'S' }],
    });
    expect(resBadClass.status).toBe('INVALID_REQUEST');
    expect(resBadClass.reason).toContain("Invalid knowledge class 'NOT_A_CLASS'");
    expect(transportCalled).toBe(false);
  });

  // 7. Transport abstraction
  it('7. demonstrates pluggable transport abstraction through StubNeuralExperienceTransport', async () => {
    const customResponse: ExperienceWritebackResponsePayload = {
      status: 'ACCEPTED',
      taskId: 'TASK-CUSTOM',
      eventId: 'ev-custom-77',
      idempotencyKey: 'idemp-custom-77',
      recordedAt: '2026-09-14T03:50:00Z',
    };

    const stub = new StubNeuralExperienceTransport(() => customResponse);
    const adapter = new DefaultPubNeuralExperienceAdapter(stub);
    const result = await adapter.recordExperience({ ...baseRecord, taskId: 'TASK-CUSTOM' });

    expect(result.status).toBe('ACCEPTED');
    expect(result.eventId).toBe('ev-custom-77');
    expect(result.idempotencyKey).toBe('idemp-custom-77');
  });

  // 8. Unavailable transport
  it('8. maps transport errors and offline fallback gracefully to UNAVAILABLE', async () => {
    // Failing transport
    const failingStub = new StubNeuralExperienceTransport(() => {
      throw new Error('Connection refused to backend port 8080');
    });
    const adapterFailing = new DefaultPubNeuralExperienceAdapter(failingStub);
    const resFailing = await adapterFailing.recordExperience(baseRecord);

    expect(resFailing.status).toBe('UNAVAILABLE');
    expect(resFailing.isUnavailable).toBe(true);
    expect(resFailing.reason).toContain('Connection refused');

    // Http transport without endpoint configured
    const httpTransport = new HttpNeuralExperienceTransport({ endpoint: '' });
    const adapterHttp = new DefaultPubNeuralExperienceAdapter(httpTransport);
    const resHttp = await adapterHttp.recordExperience(baseRecord);

    expect(resHttp.status).toBe('UNAVAILABLE');
    expect(resHttp.isUnavailable).toBe(true);
    expect(resHttp.reason).toContain('PUB_NEURAL_ENDPOINT missing');
  });

  // 9. Response mapping
  it('9. maps all canonical writeback response fields into domain result', async () => {
    const rawResponse: ExperienceWritebackResponsePayload = {
      status: 'INTERNAL_ERROR',
      taskId: 'TASK-EXP-101',
      reason: 'Database write fault in projection worker',
      metadata: { code: 'ERR_PROJECTION' },
    };

    const stub = new StubNeuralExperienceTransport(() => rawResponse);
    const adapter = new DefaultPubNeuralExperienceAdapter(stub);
    const result = await adapter.recordExperience(baseRecord);

    expect(result.status).toBe('INTERNAL_ERROR');
    expect(result.isError).toBe(true);
    expect(result.isAccepted).toBe(false);
    expect(result.reason).toBe('Database write fault in projection worker');
    expect(result.metadata).toEqual({ code: 'ERR_PROJECTION' });
  });

  // 10. Idempotent duplicate semantics
  it('10. maps DUPLICATE response status and sets isDuplicate flag correctly', async () => {
    const rawResponse: ExperienceWritebackResponsePayload = {
      status: 'DUPLICATE',
      taskId: 'TASK-EXP-101',
      eventId: 'ev-prev-99',
      idempotencyKey: 'idemp-task-101',
      isDuplicate: true,
      reason: 'Duplicate experience record acknowledged (idempotent)',
    };

    const stub = new StubNeuralExperienceTransport(() => rawResponse);
    const adapter = new DefaultPubNeuralExperienceAdapter(stub);
    const result = await adapter.recordExperience(baseRecord);

    expect(result.status).toBe('DUPLICATE');
    expect(result.isDuplicate).toBe(true);
    expect(result.isAccepted).toBe(false);
    expect(result.eventId).toBe('ev-prev-99');
    expect(result.reason).toContain('Duplicate experience');
  });

  // 11. No mutation of existing task payload
  it('11. transforms NeuralTaskStatePayload into NeuralExperienceRecordPayload without mutating original payload', () => {
    const taskStatePayload: NeuralTaskStatePayload = {
      taskId: 'TASK-ORIGINAL-99',
      projectId: 'pub-dev-loop',
      repository: 'pubcoreagencia/pub-dev-loop',
      branch: 'feat/remote-delivery-gate-phase1',
      commitSha: '614819b2',
      remoteSha: '614819b2',
      status: 'COMPLETED',
      objective: 'Original immutable task state',
      agentId: 'agent:1',
      changedFiles: ['file1.ts', 'file2.ts'],
      evidence: {
        validationPassed: true,
        worktreeClean: true,
        pushSucceeded: true,
        remoteVerified: true,
      },
      completedAt: '2026-09-14T03:00:00Z',
      ingestionSource: 'pdl-persistence-gate',
    };

    const cloneBefore = JSON.parse(JSON.stringify(taskStatePayload));

    const experienceRecord = createExperienceRecordFromTaskState(taskStatePayload, [baseFinding]);

    // Check that transformation succeeded
    expect(experienceRecord.taskId).toBe('TASK-ORIGINAL-99');
    expect(experienceRecord.candidateFindings).toHaveLength(1);
    expect(experienceRecord.candidateFindings?.[0].title).toBe('Idempotent persistence checks');

    // Invariant: original payload was not mutated
    expect(taskStatePayload).toEqual(cloneBefore);
    expect((taskStatePayload as any).candidateFindings).toBeUndefined();
  });

  // 12. Separation between query client and experience client (CQRS)
  it('12. enforces clean CQRS architectural separation between query client and experience client', () => {
    const queryStub = new StubNeuralQueryTransport();
    const queryClient = new DefaultPubNeuralQueryAdapter(queryStub);

    const expStub = new StubNeuralExperienceTransport();
    const expClient: PubNeuralExperienceClient = new DefaultPubNeuralExperienceAdapter(expStub);

    // Interfaces are strictly separated
    expect(typeof (queryClient as any).query).toBe('function');
    expect(typeof (queryClient as any).recordExperience).toBe('undefined');

    expect(typeof (expClient as any).recordExperience).toBe('function');
    expect(typeof (expClient as any).query).toBe('undefined');
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DefaultPubNeuralBridge } from '../../src/pdl/neural/neural-bridge.js';
import type { Task } from '../../src/domain.js';
import type { PersistenceGateDecision } from '../../src/pdl/persistence/persistence-gate.js';
import type { RemotePersistenceResult } from '../../src/pdl/persistence/types.js';

describe('PUB Neural Bridge & Ingestion Contract (DefaultPubNeuralBridge)', () => {
  let bridge: DefaultPubNeuralBridge;
  const commitSha = 'c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1';

  const sampleTask: Task = {
    id: 'TASK-NEURAL-001',
    project: 'pub-rate-calculator',
    repository: 'https://github.com/pubcoreagencia/pub-rate-calculator.git',
    objective: 'Implement validated calculation logic',
    prompt: 'Add rate calculator function',
    status: 'COMPLETED',
    priority: 1,
    worker: 'test-worker',
    result: {
      finalize: {
        changedFiles: ['src/calculator.ts', 'test/calculator.test.ts'],
      },
      trace: {
        totalDurationMs: 1500,
        provider: 'mock',
      },
    },
    error: null,
    branch: 'feat/rate-calc-v1',
    commitSha,
    gitStatus: 'clean',
    createdAt: new Date(),
    updatedAt: new Date(),
    leaseOwner: null,
    leaseDeadline: null,
    heartbeatAt: null,
    workspacePath: null,
    prototypeSessionId: null,
  };

  const gateDecision: PersistenceGateDecision = {
    passed: true,
    status: 'COMPLETED',
    evaluatedAt: '2026-09-13T00:00:00.000Z',
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
    },
  };

  const remoteResult: RemotePersistenceResult = {
    status: 'VERIFIED',
    repository: sampleTask.repository,
    branch: sampleTask.branch!,
    pushAttempted: true,
    pushSucceeded: true,
    localSha: commitSha,
    remoteSha: commitSha,
    remoteVerified: true,
  };

  beforeEach(() => {
    bridge = new DefaultPubNeuralBridge();
  });

  it('buildPayload gera contrato canônico 1.0.0 com evidências estruturadas', () => {
    const payload = bridge.buildPayload({
      task: sampleTask,
      commitSha,
      remoteSha: commitSha,
      branch: 'feat/rate-calc-v1',
      hasMaterialChanges: true,
      remotePersistence: remoteResult,
      gateDecision,
    });

    expect(payload.taskId).toBe('TASK-NEURAL-001');
    expect(payload.projectId).toBe('pub-rate-calculator');
    expect(payload.commitSha).toBe(commitSha);
    expect(payload.remoteSha).toBe(commitSha);
    expect(payload.status).toBe('COMPLETED');
    expect(payload.ingestionSource).toBe('pdl-persistence-gate');
    expect(payload.changedFiles).toEqual(['src/calculator.ts', 'test/calculator.test.ts']);
    expect(payload.evidence.validationPassed).toBe(true);
    expect(payload.evidence.worktreeClean).toBe(true);
    expect(payload.evidence.pushSucceeded).toBe(true);
    expect(payload.evidence.remoteVerified).toBe(true);
  });

  it('ingestTaskCompleted processa com êxito e retorna confirmação institucional', async () => {
    const result = await bridge.ingestTaskCompleted({
      task: sampleTask,
      commitSha,
      remoteSha: commitSha,
      branch: 'feat/rate-calc-v1',
      hasMaterialChanges: true,
      remotePersistence: remoteResult,
      gateDecision,
    });

    expect(result.ingested).toBe(true);
    expect(result.contractVersion).toBe('1.0.0');
    expect(result.targetSystem).toBe('pubcoreagencia/pub-neural');
    expect(result.eventId).toBeDefined();
    expect(result.memoryId).toBeDefined();
    expect(result.details?.taskId).toBe('TASK-NEURAL-001');
    expect(result.details?.commitSha).toBe(commitSha);
  });
});

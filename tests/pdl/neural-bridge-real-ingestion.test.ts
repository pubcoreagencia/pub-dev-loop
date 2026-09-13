import { describe, it, expect, vi } from 'vitest';
import { DefaultPubNeuralBridge, HttpPubNeuralClient } from '../../src/pdl/neural/neural-bridge.js';
import type { Task } from '../../src/domain.js';
import type { PersistenceGateDecision } from '../../src/pdl/persistence/persistence-gate.js';
import type { RemotePersistenceResult } from '../../src/pdl/persistence/types.js';

describe('Governed PUB Neural Bridge Ingestion Contract (CEO_COMMAND_12, 13, 14)', () => {
  const commitSha = 'b7b7b7b7b7b7b7b7b7b7b7b7b7b7b7b7b7b7b7b7';
  const remoteSha = 'b7b7b7b7b7b7b7b7b7b7b7b7b7b7b7b7b7b7b7b7';

  const baseTask: Task = {
    id: 'TASK-INGEST-REAL-001',
    project: 'pub-rate-calculator',
    repository: 'https://github.com/pubcoreagencia/pub-rate-calculator.git',
    objective: 'Test real neural ingestion gate',
    prompt: 'Verify neural bridge contract enforcement',
    status: 'COMPLETED',
    priority: 1,
    worker: 'pdl-worker',
    result: {
      finalize: {
        changedFiles: ['src/index.ts'],
      },
    },
    error: null,
    branch: 'main',
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
    evaluatedAt: new Date().toISOString(),
    details: {
      hasMaterialChanges: true,
      validationPassed: true,
      commitSha,
      worktreeClean: true,
      remoteStatus: 'VERIFIED',
      pushSucceeded: true,
      remoteVerified: true,
      remoteSha,
      runtimeVerificationRequired: false,
      runtimeVerified: false,
    },
  };

  const remoteResult: RemotePersistenceResult = {
    status: 'VERIFIED',
    repository: baseTask.repository,
    branch: baseTask.branch!,
    pushAttempted: true,
    pushSucceeded: true,
    localSha: commitSha,
    remoteSha,
    remoteVerified: true,
  };

  describe('CEO_COMMAND_12 & 13: Explicit Status and No Fake Ingestion Complete', () => {
    it('returns UNAVAILABLE and ingested=false when no endpoint is configured (fail-closed)', async () => {
      const bridge = new DefaultPubNeuralBridge(undefined, new HttpPubNeuralClient({ endpoint: '' }));

      const result = await bridge.ingestTaskCompleted({
        task: baseTask,
        commitSha,
        remoteSha,
        branch: 'main',
        hasMaterialChanges: true,
        remotePersistence: remoteResult,
        gateDecision,
      });

      expect(result.ingested).toBe(false);
      expect(result.status).toBe('UNAVAILABLE');
      expect(result.error).toMatch(/PUB_NEURAL_ENDPOINT missing/);
      expect(result.targetSystem).toBe('pubcoreagencia/pub-neural');
    });

    it('returns FAILED and ingested=false when pub-neural endpoint returns 500 error', async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: async () => 'Database connection timeout in pub-neural',
      } as any);

      try {
        const client = new HttpPubNeuralClient({
          endpoint: 'https://neural.pubcore.internal/api/ingest',
          token: 'secret-token',
        });
        const bridge = new DefaultPubNeuralBridge(undefined, client);

        const result = await bridge.ingestTaskCompleted({
          task: baseTask,
          commitSha,
          remoteSha,
          branch: 'main',
          hasMaterialChanges: true,
          remotePersistence: remoteResult,
          gateDecision,
        });

        expect(result.ingested).toBe(false);
        expect(result.status).toBe('FAILED');
        expect(result.error).toContain('HTTP 500');
        expect(result.error).toContain('Database connection timeout');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('returns PERSISTED and ingested=true only when external PUB Neural acknowledges persistence', async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          acknowledged: true,
          persisted: true,
          status: 'PERSISTED',
          eventId: 'evt-neural-persisted-999',
          memoryId: 'mem-pub-neural-canonical',
        }),
      } as any);

      try {
        const client = new HttpPubNeuralClient({
          endpoint: 'https://neural.pubcore.internal/api/ingest',
          token: 'secret-token',
        });
        const bridge = new DefaultPubNeuralBridge(undefined, client);

        const result = await bridge.ingestTaskCompleted({
          task: baseTask,
          commitSha,
          remoteSha,
          branch: 'main',
          hasMaterialChanges: true,
          remotePersistence: remoteResult,
          gateDecision,
        });

        expect(result.ingested).toBe(true);
        expect(result.status).toBe('PERSISTED');
        expect(result.eventId).toBe('evt-neural-persisted-999');
        expect(result.memoryId).toBe('mem-pub-neural-canonical');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  describe('CEO_COMMAND_14: Failure does NOT corrupt Git Persistence Gate', () => {
    it('records error details cleanly without altering gateDecision.passed = true', async () => {
      const failingClient = {
        isAvailable: async () => false,
        submit: vi.fn().mockResolvedValue({
          acknowledged: false,
          persisted: false,
          status: 'FAILED' as const,
          targetSystem: 'pubcoreagencia/pub-neural',
          error: 'Scout ingestion pipeline timeout',
        }),
      };

      const bridge = new DefaultPubNeuralBridge(undefined, failingClient);

      const result = await bridge.ingestTaskCompleted({
        task: baseTask,
        commitSha,
        remoteSha,
        branch: 'main',
        hasMaterialChanges: true,
        remotePersistence: remoteResult,
        gateDecision,
      });

      expect(result.ingested).toBe(false);
      expect(result.status).toBe('FAILED');
      expect(result.error).toBe('Scout ingestion pipeline timeout');
      expect(gateDecision.passed).toBe(true);
      expect(gateDecision.status).toBe('COMPLETED');
      expect(gateDecision.details.remoteVerified).toBe(true);
      expect(result.details?.gatePassed).toBe(true);
    });
  });
});

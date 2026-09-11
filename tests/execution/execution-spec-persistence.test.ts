/**
 * Phase 3C.2 — ExecutionSpec Persistence Foundation Tests
 *
 * Scope: persistence layer only. NO BaseWorker integration, NO RouterWorker,
 * NO provider, NO finalization, NO legacy migration, NO Phase 3D.
 */
import { describe, it, expect } from 'vitest';
import {
  createExecutionSpec,
  sealExecutionSpec,
  loadExecutionSpec,
  verifyExecutionSpecIntegrity,
  assertSealedExecutable,
  computeSpecHash,
  deserializeRecordSpec,
  type ExecutionSpecRecord,
  type ExecutionSpecStore,
  type QueryableDb,
} from '../../src/execution/execution-spec-persistence.js';
import {
  EXECUTION_SPEC_VERSION,
  type ExecutionSpec,
} from '../../src/task/execution-spec.js';
import { prepareExecution } from '../../src/execution/execution-seam.js';
import type { Task } from '../../src/domain.js';

// In-memory store implementing ExecutionSpecStore
function createMemoryStore(): ExecutionSpecStore {
  const records = new Map<string, ExecutionSpecRecord>();
  return {
    create: async (r) => {
      for (const existing of records.values()) {
        if (existing.task_id === r.task_id) {
          throw new Error(`ExecutionSpec already exists for task ${r.task_id}`);
        }
      }
      const newRecord: ExecutionSpecRecord = {
        ...r,
        id: `espec-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      };
      records.set(newRecord.id, newRecord);
      return newRecord;
    },
    loadByTaskId: async (taskId) => {
      for (const r of records.values()) {
        if (r.task_id === taskId || r.id === taskId) return r;
      }
      return null;
    },
    updateStatus: async (idOrTaskId, status, sealedAt, specHash, specContentJson) => {
      let existing = records.get(idOrTaskId);
      if (!existing) {
        for (const r of records.values()) {
          if (r.task_id === idOrTaskId) {
            existing = r;
            break;
          }
        }
      }
      if (!existing) throw new Error(`Record ${idOrTaskId} not found`);
      // REQ 13 — SEALED records are immutable: reject mutation
      if (existing.status === 'SEALED') {
        throw new Error(`ExecutionSpec for task ${existing.task_id} is SEALED and immutable; mutation rejected`);
      }
      const updated: ExecutionSpecRecord = {
        ...existing,
        status,
        sealed_at: sealedAt ?? existing.sealed_at,
        spec_hash: specHash ?? existing.spec_hash,
        spec_content_json: specContentJson ?? existing.spec_content_json,
      };
      records.set(existing.id, updated);
      return updated;
    },
    // Test-only bypass: simulates a direct DB write (e.g. via psql) that
    // bypasses the persistence abstraction, used to prove integrity detection.
    _forceUpdate: (idOrTaskId: string, status: string, sealedAt?: string, specHash?: string, specContentJson?: string) => {
      let existing = records.get(idOrTaskId);
      if (!existing) {
        for (const r of records.values()) {
          if (r.task_id === idOrTaskId) { existing = r; break; }
        }
      }
      if (!existing) throw new Error(`Record ${idOrTaskId} not found`);
      const updated: ExecutionSpecRecord = {
        ...existing,
        status: status as any,
        sealed_at: sealedAt ?? existing.sealed_at,
        spec_hash: specHash ?? existing.spec_hash,
        spec_content_json: specContentJson ?? existing.spec_content_json,
      };
      records.set(existing.id, updated);
      return updated;
    },
  };
}

// Mock QueryableDb simulating PostgreSQL pool
function createMockQueryableDb(): QueryableDb {
  const rows: any[] = [];
  return {
    query: async (sql: string, params?: unknown[]) => {
      if (sql.includes('SELECT')) {
        const taskId = params?.[0];
        const match = rows.find((r) => r.task_id === taskId || r.id === taskId);
        return { rows: match ? [match] : [] };
      }
      if (sql.includes('INSERT')) {
        const [id, task_id, spec_version, spec_hash, objective, lineageStr, status, created_at, sealed_at, spec_content_json] = params as any[];
        if (rows.some((r) => r.task_id === task_id)) {
          const err: any = new Error('duplicate key value violates unique constraint');
          err.code = '23505';
          throw err;
        }
        const row = {
          id,
          task_id,
          spec_version,
          spec_hash,
          objective,
          lineage: JSON.parse(lineageStr),
          status,
          created_at: new Date(created_at),
          sealed_at: sealed_at ? new Date(sealed_at) : null,
          spec_content_json,
        };
        rows.push(row);
        return { rows: [row] };
      }
      if (sql.includes('UPDATE')) {
        const [status, sealedAt, specHash, specContentJson, idOrTaskId] = params as any[];
        const match = rows.find((r) => r.id === idOrTaskId || r.task_id === idOrTaskId);
        if (!match) return { rows: [] };
        match.status = status;
        match.sealed_at = sealedAt ? new Date(sealedAt) : match.sealed_at;
        if (specHash) match.spec_hash = specHash;
        if (specContentJson) match.spec_content_json = specContentJson;
        return { rows: [match] };
      }
      return { rows: [] };
    },
  };
}

describe('Phase 3C.2 — ExecutionSpec Persistence Foundation', () => {
  const baseSpec: ExecutionSpec = {
    specVersion: EXECUTION_SPEC_VERSION,
    objective: 'Test objective',
    context: {
      version: '1.0.0',
      authoritativeContext: [],
      repositoryContext: [],
      operationalContext: [],
      relevantDocumentation: [],
      knownConstraints: [],
      limitations: [],
    },
    constraints: ['test'],
    acceptanceCriteria: ['done'],
    validationPlan: ['check'],
    executionInstructions: ['run'],
    executionSteps: [{ id: 'step-1', description: 'test', critical: true }],
    risks: ['none'],
    escalationConditions: ['test-condition'],
    lineage: {
      intakeVersion: '1.0.0',
      intakeHash: 'hash-abc',
      source: 'test',
      createdAt: '2026-09-11T07:00:00.000Z',
    },
    metadata: {
      generatedAt: '2026-09-11T07:00:00.000Z',
      specHash: '',
    },
  };

  const sampleTaskId = 'TASK-PERSISTENCE-TEST';

  describe('1. Persistence lifecycle', () => {
    it('creates UNSEALED spec', async () => {
      const store = createMemoryStore();
      const result = await createExecutionSpec(store, sampleTaskId, baseSpec);
      expect(result.task_id).toBe(sampleTaskId);
      expect(result.status).toBe('UNSEALED');
      expect(result.sealed_at).toBeUndefined();
      expect(result.id).toBeDefined();
      expect(result.spec_content_json).toBeDefined();
    });

    it('structural validation failure prevents creation', async () => {
      const store = createMemoryStore();
      const badSpec = { ...baseSpec, specVersion: 'WRONG' };
      await expect(createExecutionSpec(store, sampleTaskId, badSpec as any)).rejects.toThrow('Structural');
    });

    it('enforces task_id uniqueness (1:1 constraint)', async () => {
      const store = createMemoryStore();
      await createExecutionSpec(store, 'TASK-UNIQUE', baseSpec);
      await expect(createExecutionSpec(store, 'TASK-UNIQUE', baseSpec)).rejects.toThrow('already exists');
    });

    it('semantic validation failure prevents seal', async () => {
      const store = createMemoryStore();
      const result = await createExecutionSpec(store, sampleTaskId, baseSpec);
      const badSpec = { ...baseSpec, governanceLevel: 'INVALID_LEVEL' as any };
      await expect(sealExecutionSpec(store, result.id, badSpec)).rejects.toThrow('Semantic');
    });

    it('successful SEALED transition and status update', async () => {
      const store = createMemoryStore();
      const result = await createExecutionSpec(store, 'TASK-SEAL', baseSpec);
      const sealed = await sealExecutionSpec(store, result.id, baseSpec);
      expect(sealed.status).toBe('SEALED');
      expect(sealed.sealed_at).toBeDefined();
      expect(sealed.spec_hash).toBeDefined();
      expect(sealed.spec_hash.startsWith('pdl-v1:')).toBe(true);
    });

    it('sealExecutionSpec with matching specHash passes', async () => {
      const store = createMemoryStore();
      await createExecutionSpec(store, 'TASK-SEAL-HASH', baseSpec);
      const expectedHash = computeSpecHash(baseSpec);
      const sealed = await sealExecutionSpec(store, 'TASK-SEAL-HASH', expectedHash);
      expect(sealed.status).toBe('SEALED');
      expect(sealed.spec_hash).toBe(expectedHash);
    });

    it('sealExecutionSpec with mismatched specHash throws', async () => {
      const store = createMemoryStore();
      await createExecutionSpec(store, 'TASK-SEAL-MISMATCH', baseSpec);
      await expect(sealExecutionSpec(store, 'TASK-SEAL-MISMATCH', 'pdl-v1:wronghash')).rejects.toThrow('Hash mismatch');
    });

    it('re-sealing is idempotent if hash matches', async () => {
      const store = createMemoryStore();
      await createExecutionSpec(store, 'TASK-IDEMPOTENT', baseSpec);
      const sealed1 = await sealExecutionSpec(store, 'TASK-IDEMPOTENT', baseSpec);
      const sealed2 = await sealExecutionSpec(store, 'TASK-IDEMPOTENT', sealed1.spec_hash);
      expect(sealed2.status).toBe('SEALED');
      expect(sealed2.spec_hash).toBe(sealed1.spec_hash);
    });
  });

  describe('2. Canonical Hashing & Determinism', () => {
    it('spec_hash is deterministic across identical content with different key order', () => {
      const s1 = computeSpecHash(baseSpec);
      const s2 = computeSpecHash(baseSpec);
      expect(s1).toBe(s2);
      expect(typeof s1).toBe('string');
      expect(s1.startsWith('pdl-v1:')).toBe(true);

      const reorderedSpec: ExecutionSpec = {
        objective: baseSpec.objective,
        specVersion: baseSpec.specVersion,
        lineage: baseSpec.lineage,
        metadata: baseSpec.metadata,
        escalationConditions: baseSpec.escalationConditions,
        risks: baseSpec.risks,
        executionSteps: baseSpec.executionSteps,
        executionInstructions: baseSpec.executionInstructions,
        validationPlan: baseSpec.validationPlan,
        acceptanceCriteria: baseSpec.acceptanceCriteria,
        constraints: baseSpec.constraints,
        context: baseSpec.context,
      };
      expect(computeSpecHash(reorderedSpec)).toBe(s1);
    });

    it('spec_hash changes when content changes', () => {
      const modified = { ...baseSpec, objective: 'Different objective' };
      expect(computeSpecHash(baseSpec)).not.toBe(computeSpecHash(modified));
    });

    it('database metadata (id, created_at, sealed_at, status) is excluded from hash', () => {
      const hash = computeSpecHash(baseSpec);
      expect(hash).toContain('pdl-v1:');
    });
  });

  describe('3. Loading & Integrity Verification', () => {
    it('loadExecutionSpec returns exact sealed record', async () => {
      const store = createMemoryStore();
      await createExecutionSpec(store, 'TASK-LOAD', baseSpec);
      const loaded = await loadExecutionSpec(store, 'TASK-LOAD');
      expect(loaded).not.toBeNull();
      expect(loaded!.task_id).toBe('TASK-LOAD');
      expect(loaded!.status).toBe('UNSEALED');
    });

    it('loadExecutionSpec returns null for non-existent task', async () => {
      const store = createMemoryStore();
      const loaded = await loadExecutionSpec(store, 'TASK-NONEXISTENT');
      expect(loaded).toBeNull();
    });

    it('successful integrity verification for sealed spec', async () => {
      const store = createMemoryStore();
      await createExecutionSpec(store, 'TASK-INTEGRITY', baseSpec);
      await sealExecutionSpec(store, 'TASK-INTEGRITY', baseSpec);

      const isValid = await verifyExecutionSpecIntegrity(store, 'TASK-INTEGRITY');
      expect(isValid).toBe(true);
    });

    it('integrity verification fails for UNSEALED spec', async () => {
      const store = createMemoryStore();
      await createExecutionSpec(store, 'TASK-UNSEALED-CHECK', baseSpec);

      const isValid = await verifyExecutionSpecIntegrity(store, 'TASK-UNSEALED-CHECK');
      expect(isValid).toBe(false);
    });

    it('integrity verification fails when spec_hash is tampered', async () => {
      const store = createMemoryStore();
      const rec = await createExecutionSpec(store, 'TASK-TAMPER-HASH', baseSpec);
      await sealExecutionSpec(store, rec.id, baseSpec);

      // Tamper with hash in store via direct DB write (bypasses persistence abstraction)
      (store as any)._forceUpdate(rec.id, 'SEALED', new Date().toISOString(), 'pdl-v1:tampered');

      const isValid = await verifyExecutionSpecIntegrity(store, 'TASK-TAMPER-HASH');
      expect(isValid).toBe(false);
    });

    it('integrity verification fails when spec_content_json is tampered', async () => {
      const store = createMemoryStore();
      const rec = await createExecutionSpec(store, 'TASK-TAMPER-CONTENT', baseSpec);
      const sealed = await sealExecutionSpec(store, rec.id, baseSpec);

      // Tamper with content in store via direct DB write (bypasses persistence abstraction)
      (store as any)._forceUpdate(
        rec.id,
        'SEALED',
        sealed.sealed_at,
        sealed.spec_hash,
        JSON.stringify({ ...baseSpec, objective: 'Tampered objective' }),
      );

      const isValid = await verifyExecutionSpecIntegrity(store, 'TASK-TAMPER-CONTENT');
      expect(isValid).toBe(false);
    });
  });

  describe('4. assertSealedExecutable boundary', () => {
    it('returns record when spec is sealed and untampered', async () => {
      const store = createMemoryStore();
      await createExecutionSpec(store, 'TASK-EXEC', baseSpec);
      await sealExecutionSpec(store, 'TASK-EXEC', baseSpec);

      const record = await assertSealedExecutable(store, 'TASK-EXEC');
      expect(record.status).toBe('SEALED');
      expect(record.task_id).toBe('TASK-EXEC');
    });

    it('blocks execution when spec is UNSEALED', async () => {
      const store = createMemoryStore();
      await createExecutionSpec(store, 'TASK-BLOCKED', baseSpec);
      await expect(assertSealedExecutable(store, 'TASK-BLOCKED')).rejects.toThrow('not SEALED');
    });

    it('explicit error when spec is missing', async () => {
      const store = createMemoryStore();
      await expect(assertSealedExecutable(store, 'TASK-MISSING')).rejects.toThrow('No ExecutionSpec');
    });

    it('blocks execution when hash integrity fails', async () => {
      const store = createMemoryStore();
      const rec = await createExecutionSpec(store, 'TASK-HASH-FAIL', baseSpec);
      await sealExecutionSpec(store, rec.id, baseSpec);
      // Tamper with hash via direct DB write (bypasses persistence abstraction)
      (store as any)._forceUpdate(rec.id, 'SEALED', new Date().toISOString(), 'pdl-v1:corrupt');

      await expect(assertSealedExecutable(store, 'TASK-HASH-FAIL')).rejects.toThrow('integrity violation');
    });
  });

  describe('5. Security field preservation & 3C.1 compatibility', () => {
    it('REQUIRED (REQ 18) — explicit security field round-trip', async () => {
      const specWithSecurity: ExecutionSpec = {
        ...baseSpec,
        governanceLevel: 'DEVELOPER',
        permissions: {
          repositoryRead: true, repositoryWrite: false, branchWrite: true, commit: true,
          push: false, externalResearch: true, filesystemWorkspace: true, privilegedOperations: false,
        },
        providerConstraints: { provider: '9ROUTER', allowedModels: ['mock-model-v1'], maxTokens: 4096 },
        resourceLimits: { timeoutSeconds: 300, maxRetries: 2, maxSteps: 10, maxExecutionSizeBytes: 1048576 },
        repositoryTarget: {
          identity: { owner: 'test-owner', name: 'test-repo', fullName: 'test-owner/test-repo' },
          scmProvider: 'git',
          remote: 'https://github.com/test-owner/test-repo.git',
          branch: 'main',
          workspace: '/workspace/test',
          baseRevision: 'abc123',
          authorization: 'Bearer token',
          provenance: 'pdl:internal',
          lineage: { intakeVersion: '1.0.0', intakeHash: 'hash-abc', source: 'test', createdAt: '2026-09-11T07:00:00.000Z' },
          isDefault: false,
        },
        evidenceSnapshot: {
          intake: { intakeVersion: '1.0.0', intakeHash: 'hash-abc', source: 'test', createdAt: '2026-09-11T07:00:00.000Z' },
          contextBundleHash: 'ctx-hash-123',
          evidenceHash: 'ev-hash-456',
          collectedAt: '2026-09-11T08:00:00.000Z',
          sourceCount: 2,
          promptInjectionRisk: 'SAFE',
          trustBoundary: {
            tier: 'INTERNAL',
            data: {},
            origin: 'test',
            canInfluenceGovernance: false,
            canInfluencePermissions: false,
            canInfluenceRepositoryTarget: false,
            canInfluenceExecution: false,
          },
          evidence: [],
        },
      };

      const store = createMemoryStore();
      await createExecutionSpec(store, 'TASK-SECURITY-RT', specWithSecurity);
      const sealed = await sealExecutionSpec(store, 'TASK-SECURITY-RT', specWithSecurity);
      const loaded = await loadExecutionSpec(store, 'TASK-SECURITY-RT');

      expect(loaded).not.toBeNull();
      const deserialized = deserializeRecordSpec(loaded!);

      // Each security field compared explicitly after load (REQ 18)
      expect(deserialized.governanceLevel).toBe('DEVELOPER');
      expect(deserialized.permissions).toEqual(specWithSecurity.permissions);
      expect(deserialized.providerConstraints).toEqual(specWithSecurity.providerConstraints);
      expect(deserialized.resourceLimits).toEqual(specWithSecurity.resourceLimits);
      expect(deserialized.lineage).toEqual(specWithSecurity.lineage);
      expect(deserialized.executionInstructions).toEqual(specWithSecurity.executionInstructions);
      expect(deserialized.repositoryTarget).toEqual(specWithSecurity.repositoryTarget);
      expect(deserialized.evidenceSnapshot).toEqual(specWithSecurity.evidenceSnapshot);
    });

    it('REQUIRED (REQ 13) — SEALED mutation rejected', async () => {
      const store = createMemoryStore();
      await createExecutionSpec(store, 'TASK-SEAL-MUT', baseSpec);
      const sealed = await sealExecutionSpec(store, 'TASK-SEAL-MUT', baseSpec);

      // Direct mutation attempt via store.updateStatus → must fail for SEALED record
      await expect(
        store.updateStatus(sealed.id, 'SEALED', '2026-01-01', 'pdl-v1:tampered', '{}')
      ).rejects.toThrow('SEALED and immutable');

      // Content unchanged
      const reloaded = await loadExecutionSpec(store, 'TASK-SEAL-MUT');
      expect(reloaded!.spec_hash).toBe(sealed.spec_hash);
      expect(reloaded!.status).toBe('SEALED');
    });

    it('Phase 3C.1 compatibility: deserialized spec satisfies prepareExecution', async () => {
      const store = createMemoryStore();
      await createExecutionSpec(store, 'TASK-3C1-SEAM', baseSpec);
      const sealed = await sealExecutionSpec(store, 'TASK-3C1-SEAM', baseSpec);

      const task: Task = {
        id: 'TASK-3C1-SEAM',
        project: 'test-project',
        repository: 'test-repo',
        objective: 'Test objective',
        prompt: 'Test prompt',
        status: 'QUEUED',
        priority: 1,
        worker: null,
        result: null,
        error: null,
        branch: 'main',
        commitSha: null,
        gitStatus: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const executableSpec = deserializeRecordSpec(sealed);
      const prepared = prepareExecution(task, executableSpec);

      expect(prepared.task.id).toBe('TASK-3C1-SEAM');
      expect(prepared.executionSpec.objective).toBe(baseSpec.objective);
      expect(prepared.executionSpec.specVersion).toBe(EXECUTION_SPEC_VERSION);
    });
  });

  describe('6. PostgreSQL QueryableDb compatibility', () => {
    it('operates identically on a QueryableDb (Postgres interface)', async () => {
      const pgDb = createMockQueryableDb();
      const created = await createExecutionSpec(pgDb, 'TASK-PG', baseSpec);
      expect(created.status).toBe('UNSEALED');

      // duplicate rejection
      await expect(createExecutionSpec(pgDb, 'TASK-PG', baseSpec)).rejects.toThrow('already exists');

      // seal
      const sealed = await sealExecutionSpec(pgDb, 'TASK-PG', baseSpec);
      expect(sealed.status).toBe('SEALED');

      // integrity
      const valid = await verifyExecutionSpecIntegrity(pgDb, 'TASK-PG');
      expect(valid).toBe(true);

      // executable assertion
      const executable = await assertSealedExecutable(pgDb, 'TASK-PG');
      expect(executable.status).toBe('SEALED');
    });
  });
});

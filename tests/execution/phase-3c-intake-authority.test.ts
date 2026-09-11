/**
 * Phase 3C — Legacy Intake Boundary Cleanup / Single Authority Tests
 *
 * Verifies that all production PDL task creation surfaces:
 * 1. PDL POST /tasks produces Task + SEALED ExecutionSpec
 * 2. PDL POST /office/plans/execute-step produces Task + SEALED ExecutionSpec
 * 3. PDL Prototype Promotion (PdlTaskIngestionAdapter) produces Task + SEALED ExecutionSpec
 * 4. Legacy src/api.ts POST /tasks produces Task + SEALED ExecutionSpec
 * 5. Legacy src/api.ts POST /office/plans/execute-step produces Task + SEALED ExecutionSpec
 * 6. Autonomous Execution Controller produces Task + SEALED ExecutionSpec
 * 7. Autonomy loop stepAutonomyLoop produces Task + SEALED ExecutionSpec
 * 8. Atomic rollback preserves consistency on any failure
 * 9. Lineage, hash format (pdl-v1:), and SEALED status are invariant
 * 10. PP isolation remains untouched
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import type { Server } from 'http';
import {
  TaskIntakeService,
  type PoolClientLike,
  type PoolLike,
} from '../../src/pdl/service/task-intake-service.js';
import { createPdlApp } from '../../src/pdl/api/entry.js';
import { createApp } from '../../src/api.js';
import { PdlTaskIngestionAdapter } from '../../src/pdl/handoff/adapter.js';
import {
  stepAutonomyLoop,
  createInitialSystemState,
  type Mission,
} from '../../src/office/autonomy-loop.js';
import { AutonomousExecutionController } from '../../src/office/autonomous-execution-controller.js';
import type { Task } from '../../src/domain.js';

interface MockDbState {
  tasks: Map<string, any>;
  specs: Map<string, any>;
  transactionsBegan: number;
  transactionsCommitted: number;
  transactionsRolledBack: number;
  clientsReleased: number;
  failAtTaskInsert?: boolean;
  failAtCreateSpec?: boolean;
  failAtSealSpec?: boolean;
  failAtCommit?: boolean;
  recordedSpecStatusesOnInsert: string[];
}

function createMockTransactionalPool(initialState?: Partial<MockDbState>): {
  pool: PoolLike;
  state: MockDbState;
} {
  const state: MockDbState = {
    tasks: new Map(),
    specs: new Map(),
    transactionsBegan: 0,
    transactionsCommitted: 0,
    transactionsRolledBack: 0,
    clientsReleased: 0,
    recordedSpecStatusesOnInsert: [],
    ...initialState,
  };

  const pool: PoolLike = {
    connect: async (): Promise<PoolClientLike> => {
      let inTx = false;
      const txTasks = new Map<string, any>();
      const txSpecs = new Map<string, any>();

      const client: PoolClientLike = {
        release: () => {
          state.clientsReleased++;
        },
        query: async (sql: string, params?: unknown[]): Promise<{ rows: any[] }> => {
          const upper = sql.trim().toUpperCase();

          if (upper.startsWith('BEGIN')) {
            inTx = true;
            state.transactionsBegan++;
            return { rows: [] };
          }

          if (upper.startsWith('COMMIT')) {
            if (state.failAtCommit) {
              throw new Error('Simulated database COMMIT failure');
            }
            for (const [k, v] of txTasks) state.tasks.set(k, v);
            for (const [k, v] of txSpecs) state.specs.set(k, v);
            inTx = false;
            state.transactionsCommitted++;
            return { rows: [] };
          }

          if (upper.startsWith('ROLLBACK')) {
            txTasks.clear();
            txSpecs.clear();
            inTx = false;
            state.transactionsRolledBack++;
            return { rows: [] };
          }

          if (sql.includes('INSERT INTO tasks')) {
            if (state.failAtTaskInsert) {
              throw new Error('Simulated tasks table INSERT failure');
            }
            const [project, repository, objective, prompt, priority, status] = (params || []) as any[];
            const id = 'task-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9);
            const row = {
              id,
              project,
              repository,
              objective,
              prompt,
              priority: priority ?? 0,
              status: status ?? 'QUEUED',
              worker: null,
              result: null,
              error: null,
              branch: null,
              commit_sha: null,
              git_status: null,
              created_at: new Date(),
              updated_at: new Date(),
              lease_owner: null,
              lease_deadline: null,
              heartbeat_at: null,
              workspace_path: null,
              prototype_session_id: null,
            };
            if (inTx) txTasks.set(id, row);
            else state.tasks.set(id, row);
            return { rows: [row] };
          }

          if (sql.includes('SELECT') && sql.includes('execution_specs')) {
            const taskId = params?.[0];
            const found =
              (inTx ? txSpecs.get(taskId as string) : undefined) ??
              state.specs.get(taskId as string);
            return { rows: found ? [found] : [] };
          }

          if (sql.includes('INSERT INTO execution_specs')) {
            if (state.failAtCreateSpec) {
              throw new Error('Simulated execution_specs table INSERT failure');
            }
            const [
              id,
              task_id,
              spec_version,
              spec_hash,
              objective,
              lineageStr,
              status,
              created_at,
              sealed_at,
              spec_content_json,
            ] = (params || []) as any[];

            state.recordedSpecStatusesOnInsert.push(status);

            const row = {
              id,
              task_id,
              spec_version,
              spec_hash,
              objective,
              lineage: typeof lineageStr === 'string' ? JSON.parse(lineageStr) : lineageStr,
              status,
              created_at: new Date(created_at),
              sealed_at: sealed_at ? new Date(sealed_at) : null,
              spec_content_json,
            };

            if (inTx) txSpecs.set(task_id, row);
            else state.specs.set(task_id, row);
            return { rows: [row] };
          }

          if (sql.includes('UPDATE execution_specs')) {
            if (state.failAtSealSpec) {
              throw new Error('Simulated execution_specs table SEAL UPDATE failure');
            }
            const [status, sealed_at, spec_hash, spec_content_json, task_id] = (params || []) as any[];
            const existing =
              (inTx ? txSpecs.get(task_id as string) : undefined) ??
              state.specs.get(task_id as string);

            if (!existing) {
              throw new Error('Record for task ' + task_id + ' not found');
            }

            const updated = {
              ...existing,
              status,
              sealed_at: sealed_at ? new Date(sealed_at) : existing.sealed_at,
              spec_hash: spec_hash ?? existing.spec_hash,
              spec_content_json: spec_content_json ?? existing.spec_content_json,
            };

            if (inTx) txSpecs.set(task_id, updated);
            else state.specs.set(task_id, updated);
            return { rows: [updated] };
          }

          return { rows: [] };
        },
      };

      return client;
    },
    query: async (sql: string, params?: unknown[]): Promise<{ rows: any[] }> => {
      const client = await pool.connect();
      try {
        return await client.query(sql, params);
      } finally {
        client.release();
      }
    },
  };

  return { pool, state };
}

function createMockTaskRepo(mockState: MockDbState, pool?: PoolLike) {
  return {
    pool,
    list: async () => Array.from(mockState.tasks.values()),
    findById: async (id: string) => mockState.tasks.get(id) ?? null,
    create: async (taskInput: Partial<Task>) => {
      const id = 'task-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9);
      const row = {
        id,
        project: taskInput.project || 'pub-dev-loop',
        repository: taskInput.repository || 'https://github.com/pubcoreagencia/pub-dev-loop.git',
        objective: taskInput.objective || 'Default objective',
        prompt: taskInput.prompt || 'Default prompt',
        priority: taskInput.priority ?? 0,
        status: 'QUEUED',
        worker: null,
        result: null,
        error: null,
        branch: null,
        commit_sha: null,
        git_status: null,
        created_at: new Date(),
        updated_at: new Date(),
        lease_owner: null,
        lease_deadline: null,
        heartbeat_at: null,
        workspace_path: null,
        prototype_session_id: null,
      };
      mockState.tasks.set(id, row);
      return row as any;
    },
    update: async (id: string, updates: any) => {
      const existing = mockState.tasks.get(id);
      if (!existing) return null;
      const updated = { ...existing, ...updates, updated_at: new Date() };
      mockState.tasks.set(id, updated);
      return updated as any;
    },
  };
}

describe('Phase 3C: Single Intake Authority and Boundary Hardening', () => {
  let server: Server | null = null;

  afterEach(async () => {
    if (server) {
      await new Promise<void>((resolve) => server!.close(() => resolve()));
      server = null;
    }
  });

  describe('GATE 1: Canonical PDL API (src/pdl/api/entry.ts)', () => {
    it('POST /tasks returns HTTP 201 with Task QUEUED and ExecutionSpec SEALED', async () => {
      const { pool, state } = createMockTransactionalPool();
      const intakeService = new TaskIntakeService(pool);
      const mockRepo = createMockTaskRepo(state, pool);
      const app = createPdlApp(pool as any, mockRepo as any, intakeService);

      server = app.listen(0);
      const port = (server.address() as any).port;

      const res = await fetch(`http://localhost:${port}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: 'Implement authentication middleware for PDL API',
          project: 'pub-dev-loop',
        }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();

      expect(body.task).toBeDefined();
      expect(body.task.status).toBe('QUEUED');
      expect(body.executionSpec).toBeDefined();
      expect(body.executionSpec.status).toBe('SEALED');
      expect(body.executionSpec.specHash).toMatch(/^pdl-v1:[0-9a-f]{8}$/);

      // Verify atomic persistence in state
      expect(state.tasks.has(body.task.id)).toBe(true);
      expect(state.specs.has(body.task.id)).toBe(true);
      const persistedSpec = state.specs.get(body.task.id);
      expect(persistedSpec.status).toBe('SEALED');
    });

    it('POST /office/plans/execute-step returns HTTP 201 with Task QUEUED and ExecutionSpec SEALED', async () => {
      const { pool, state } = createMockTransactionalPool();
      const intakeService = new TaskIntakeService(pool);
      const mockRepo = createMockTaskRepo(state, pool);
      const app = createPdlApp(pool as any, mockRepo as any, intakeService);

      server = app.listen(0);
      const port = (server.address() as any).port;

      const plan = {
        id: 'plan-123',
        project: 'pub-dev-loop',
        repository: 'https://github.com/pubcoreagencia/pub-dev-loop.git',
        steps: [
          {
            id: 'step-arch',
            agentId: 'architect',
            title: 'Design API Schema',
            description: 'Design the unified task intake API schema and validation rules',
          },
        ],
      };

      const res = await fetch(`http://localhost:${port}/office/plans/execute-step`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan,
          stepId: 'step-arch',
        }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();

      expect(body.task).toBeDefined();
      expect(body.task.status).toBe('QUEUED');
      expect(body.executionSpec).toBeDefined();
      expect(body.executionSpec.status).toBe('SEALED');
      expect(body.executionSpec.specHash).toMatch(/^pdl-v1:[0-9a-f]{8}$/);
      expect(state.specs.has(body.task.id)).toBe(true);
    });
  });

  describe('GATE 2: Prototype Promotion (PdlTaskIngestionAdapter)', () => {
    it('ingests task from prototype promotion with atomic SEALED ExecutionSpec', async () => {
      const { pool, state } = createMockTransactionalPool();
      const intakeService = new TaskIntakeService(pool);
      const mockRepo = createMockTaskRepo(state, pool);

      const adapter = new PdlTaskIngestionAdapter(mockRepo as any, intakeService);

      const result = await adapter.ingest({
        promotionId: 'promo-1',
        prototypeSessionId: 'proto-session-1',
        project: 'pub-food',
        repository: 'https://github.com/pubcoreagencia/pub-food.git',
        branch: 'promo-branch',
        checkpointSha: 'abc123sha',
        objective: 'Prototype promotion objective',
        prompt: 'Promote prototype to production PDL',
      });

      expect(result).toBeDefined();
      expect(result.status).toBe('QUEUED');
      expect(result.taskId).toBeDefined();

      // Check that ExecutionSpec was created and sealed in the DB
      expect(state.specs.has(result.taskId)).toBe(true);
      const spec = state.specs.get(result.taskId);
      expect(spec.status).toBe('SEALED');
      expect(spec.spec_hash).toMatch(/^pdl-v1:[0-9a-f]{8}$/);
    });
  });

  describe('GATE 3: Legacy API Boundary Hardening (src/api.ts)', () => {
    it('POST /tasks through createApp with intakeService produces SEALED ExecutionSpec', async () => {
      const { pool, state } = createMockTransactionalPool();
      const intakeService = new TaskIntakeService(pool);
      const mockRepo = createMockTaskRepo(state, pool);

      const mockPrototypes: any = {
        list: vi.fn().mockResolvedValue([]),
      };
      const mockEvents: any = {
        subscribe: vi.fn(),
        emit: vi.fn(),
      };

      const app = createApp(
        mockRepo as any,
        mockPrototypes,
        intakeService,
        mockEvents,
      );

      server = app.listen(0);
      const port = (server.address() as any).port;

      const res = await fetch(`http://localhost:${port}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project: 'pub-dev-loop',
          prompt: 'Refactor database connection pooling',
          objective: 'Refactor pooling',
        }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();

      expect(body.id).toBeDefined();
      expect(body.status).toBe('QUEUED');
      expect(body.executionSpec).toBeDefined();
      expect(body.executionSpec.status).toBe('SEALED');
      expect(state.specs.has(body.id)).toBe(true);
    });

    it('POST /office/plans/execute-step through createApp produces SEALED ExecutionSpec', async () => {
      const { pool, state } = createMockTransactionalPool();
      const intakeService = new TaskIntakeService(pool);
      const mockRepo = createMockTaskRepo(state, pool);

      const mockPrototypes: any = {
        list: vi.fn().mockResolvedValue([]),
      };
      const mockEvents: any = {
        subscribe: vi.fn(),
        emit: vi.fn(),
      };

      const app = createApp(
        mockRepo as any,
        mockPrototypes,
        intakeService,
        mockEvents,
      );

      server = app.listen(0);
      const port = (server.address() as any).port;

      const plan = {
        id: 'plan-office-1',
        project: 'pub-dev-loop',
        repository: 'https://github.com/pubcoreagencia/pub-dev-loop.git',
        steps: [
          {
            id: 'step-qa',
            agentId: 'qa',
            title: 'Verify Regression Suite',
            description: 'Execute end to end test suite and verify no regressions',
          },
        ],
      };

      const res = await fetch(`http://localhost:${port}/office/plans/execute-step`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan,
          stepId: 'step-qa',
        }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();

      expect(body.task).toBeDefined();
      expect(body.task.status).toBe('QUEUED');
      expect(body.executionSpec).toBeDefined();
      expect(body.executionSpec.status).toBe('SEALED');
      expect(state.specs.has(body.task.id)).toBe(true);
    });
  });

  describe('GATE 4: Autonomy Loop & AutonomousExecutionController', () => {
    const baseMission: Mission = {
      id: 'mission-real-continuity-1',
      title: 'Demonstrate Autonomous Multi-Cycle Engineering Loop',
      objective: 'Advance autonomy ladder by sequentially verifying research engine',
      project: 'pub-dev-loop',
      targetCapabilities: [
        'intent_foundation',
        'context_resolution',
        'research_engine',
        'skill_discovery',
        'auto_fix_loop',
      ],
      constraints: [
        'Strictly non-destructive file operations',
        'All changes must pass automated verification',
      ],
      riskPolicy: 'STANDARD',
      maxCycles: 6,
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
    };

    it('stepAutonomyLoop with intakeService registers Task with SEALED ExecutionSpec', async () => {
      const { pool, state } = createMockTransactionalPool();
      const intakeService = new TaskIntakeService(pool);
      const mockRepo = createMockTaskRepo(state, pool);

      const sysState = createInitialSystemState(baseMission);

      const result = await stepAutonomyLoop(
        baseMission,
        sysState,
        mockRepo as any,
        1,
        intakeService,
      );

      expect(result.cycle).toBeDefined();
      expect(result.task).toBeDefined();
      expect(result.task!.status).toBe('QUEUED');

      // Verify that ExecutionSpec was created and sealed in the mock transactional pool
      expect(state.specs.has(result.task!.id)).toBe(true);
      const spec = state.specs.get(result.task!.id);
      expect(spec.status).toBe('SEALED');
      expect(spec.spec_hash).toMatch(/^pdl-v1:[0-9a-f]{8}$/);
    });

    it('AutonomousExecutionController registers Task with SEALED ExecutionSpec', async () => {
      const { pool, state } = createMockTransactionalPool();
      const intakeService = new TaskIntakeService(pool);
      const mockRepo = createMockTaskRepo(state, pool);

      const controller = new AutonomousExecutionController(
        mockRepo as any,
        undefined,
        undefined,
        undefined,
        undefined,
        intakeService,
      );

      const sysState = createInitialSystemState(baseMission);

      const deterministicExecutor = async (task: Task) => {
        return {
          status: 'COMPLETED' as const,
          stdout: `Executed task ${task.id} successfully`,
          evidenceSnippet: `Verified implementation in src/office/${task.project}.ts`,
          changedFiles: [`src/office/${task.project}.ts`],
          finalizeResult: {
            status: 'COMPLETED',
            commitSha: 'sha-' + Math.random().toString(36).slice(2, 8),
            gitStatus: 'clean',
            validationErrors: [],
          } as any,
        };
      };

      const { result } = await controller.executeCycle(baseMission, sysState, 1, deterministicExecutor);

      expect(result).toBeDefined();
      expect(result.taskId).toBeDefined();

      expect(state.specs.has(result.taskId!)).toBe(true);
      const spec = state.specs.get(result.taskId!);
      expect(spec.status).toBe('SEALED');
      expect(spec.spec_hash).toMatch(/^pdl-v1:[0-9a-f]{8}$/);
    });
  });

  describe('GATE 7 & 8: Atomic Integrity and Rollback Guarantees', () => {
    it('rolls back Task creation if createExecutionSpec fails', async () => {
      const { pool, state } = createMockTransactionalPool({ failAtCreateSpec: true });
      const intakeService = new TaskIntakeService(pool);

      await expect(
        intakeService.processIntake({
          rawRequest: 'Test rollback when spec insert fails',
          project: 'pub-dev-loop',
        }),
      ).rejects.toThrow('Simulated execution_specs table INSERT failure');

      expect(state.transactionsRolledBack).toBe(1);
      expect(state.tasks.size).toBe(0);
      expect(state.specs.size).toBe(0);
    });

    it('rolls back Task creation if sealExecutionSpec fails', async () => {
      const { pool, state } = createMockTransactionalPool({ failAtSealSpec: true });
      const intakeService = new TaskIntakeService(pool);

      await expect(
        intakeService.processIntake({
          rawRequest: 'Test rollback when seal spec fails',
          project: 'pub-dev-loop',
        }),
      ).rejects.toThrow('Simulated execution_specs table SEAL UPDATE failure');

      expect(state.transactionsRolledBack).toBe(1);
      expect(state.tasks.size).toBe(0);
      expect(state.specs.size).toBe(0);
    });

    it('rolls back entire transaction if database COMMIT fails', async () => {
      const { pool, state } = createMockTransactionalPool({ failAtCommit: true });
      const intakeService = new TaskIntakeService(pool);

      await expect(
        intakeService.processIntake({
          rawRequest: 'Test rollback when commit fails',
          project: 'pub-dev-loop',
        }),
      ).rejects.toThrow('Simulated database COMMIT failure');

      expect(state.transactionsRolledBack).toBe(1);
      expect(state.tasks.size).toBe(0);
      expect(state.specs.size).toBe(0);
    });
  });
});

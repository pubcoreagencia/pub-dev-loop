import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Pool } from 'pg';
import { createPdlWorkerDaemon } from '../../src/pdl/worker/entry.js';
import { createProductionWorker } from '../../src/worker.js';
import { RouterWorker } from '../../src/router-worker.js';
import { CodexWorker, BaseWorker } from '../../src/worker-service.js';
import { DefaultExecutionEngine } from '../../src/execution/default-execution-engine.js';
import type { Task, TaskRepository } from '../../src/domain.js';
import type { ExecutionSpec } from '../../src/task/execution-spec.js';
import type { AgentProvider, ProviderTaskInput, ProviderTaskResult } from '../../src/providers/types.js';
import type { PreparedExecution } from '../../src/execution/execution-seam.js';

describe('Phase 3A.5 — Hardening Verification Suite', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  // ==========================================
  // GATE 1: Production Daemon Wiring
  // ==========================================
  describe('Gate 1: Production Daemon ExecutionSpecDatabase Wiring', () => {
    it('1.1 createPdlWorkerDaemon(pool) injects executionSpecDb into RouterWorker when AGENT_PROVIDER is set', () => {
      process.env.AGENT_PROVIDER = 'mock';
      const fakePool = { query: vi.fn() } as unknown as Pool;

      const worker = createPdlWorkerDaemon(fakePool);

      expect(worker).toBeInstanceOf(RouterWorker);
      expect((worker as any).executionSpecDb).toBe(fakePool);
    });

    it('1.2 createPdlWorkerDaemon(pool) injects executionSpecDb into CodexWorker when AGENT_PROVIDER is empty', () => {
      delete process.env.AGENT_PROVIDER;
      const fakePool = { query: vi.fn() } as unknown as Pool;

      const worker = createPdlWorkerDaemon(fakePool);

      expect(worker).toBeInstanceOf(CodexWorker);
      expect((worker as any).executionSpecDb).toBe(fakePool);
    });

    it('1.3 createProductionWorker() injects pool into RouterWorker when AGENT_PROVIDER is set', () => {
      process.env.DATABASE_URL = 'postgres://user:pass@localhost:5432/testdb';
      process.env.AGENT_PROVIDER = 'mock';

      const worker = createProductionWorker();

      expect(worker).toBeInstanceOf(RouterWorker);
      expect((worker as any).executionSpecDb).toBeDefined();
    });

    it('1.4 createProductionWorker() injects pool into CodexWorker when AGENT_PROVIDER is empty', () => {
      process.env.DATABASE_URL = 'postgres://user:pass@localhost:5432/testdb';
      delete process.env.AGENT_PROVIDER;

      const worker = createProductionWorker();

      expect(worker).toBeInstanceOf(CodexWorker);
      expect((worker as any).executionSpecDb).toBeDefined();
    });

    it('1.5 RouterWorker constructor wires executionSpecDb correctly', () => {
      const fakePool = { query: vi.fn() } as unknown as Pool;
      const fakeTasks = { pool: fakePool } as any;
      const fakeProvider: AgentProvider = {
        kind: 'mock',
        model: 'test',
        execute: vi.fn(),
        health: vi.fn(),
        capabilities: vi.fn().mockReturnValue([]),
        metadata: vi.fn().mockReturnValue({}),
      };

      const routerWorker = new RouterWorker(
        fakeTasks,
        fakeProvider,
        'router',
        undefined,
        fakePool as any,
      );

      expect((routerWorker as any).executionSpecDb).toBe(fakePool);
    });
  });

  // ==========================================
  // GATE 2: Removal of Dead Legacy Execution Path
  // ==========================================
  describe('Gate 2: Removal of Dead Legacy Execution Path in RouterWorker', () => {
    it('2.1 executeWithRetry throws immediately when PreparedExecution is missing', async () => {
      const fakeTasks = {} as TaskRepository;
      const fakeProvider: AgentProvider = {
        kind: 'mock',
        model: 'test',
        execute: vi.fn(),
        health: vi.fn(),
        capabilities: vi.fn().mockReturnValue([]),
        metadata: vi.fn().mockReturnValue({}),
      };

      const router = new RouterWorker(fakeTasks, fakeProvider, 'test-router');
      const dummyTask: Task = {
        id: 'TASK-FAIL-CLOSED',
        project: 'test-project',
        repository: 'https://github.com/example/repo.git',
        prompt: 'test',
        status: 'ASSIGNED',
      };

      await expect(
        (router as any).executeWithRetry(dummyTask, 'https://github.com/example/repo.git', undefined)
      ).rejects.toThrow(
        'RouterWorker: PreparedExecution is required; execution without sealed ExecutionSpec is prohibited'
      );

      // Verify provider was never called
      expect(fakeProvider.execute).not.toHaveBeenCalled();
    });
  });

  // ==========================================
  // GATE 3: Rich ExecutionSpec Delivery
  // ==========================================
  describe('Gate 3: Rich ExecutionSpec Delivery via DefaultExecutionEngine', () => {
    const baseSpec: ExecutionSpec = {
      specVersion: '1.0.0',
      objective: 'Implement secure payment webhook handling',
      context: {
        version: '1.0.0',
        authoritativeContext: [],
        repositoryContext: [],
        operationalContext: [],
        relevantDocumentation: [],
        knownConstraints: [],
        limitations: [],
      },
      constraints: [
        'Must verify Stripe HMAC-SHA256 signature',
        'Idempotency key must be checked before processing',
      ],
      acceptanceCriteria: [
        'Returns HTTP 200 on valid signature and processes event',
        'Returns HTTP 400 on signature verification failure without throwing 500',
      ],
      validationPlan: [
        'Run npm test tests/stripe-webhook.test.ts',
        'Verify zero unhandled rejections under invalid payload test',
      ],
      executionInstructions: [
        'Create src/webhooks/stripe.ts',
        'Export handleStripeWebhook handler',
      ],
      executionSteps: [
        { id: 'step-1', description: 'Create webhook route', critical: true },
      ],
      risks: ['Replay attacks if idempotency is omitted'],
      escalationConditions: ['Stripe webhook secret is missing'],
      lineage: {
        intakeVersion: '1.0.0',
        intakeHash: 'hash-stripe-webhook-001',
        source: 'api',
        createdAt: '2026-09-11T12:00:00.000Z',
      },
      metadata: {
        generatedAt: '2026-09-11T12:00:00.000Z',
        specHash: 'hash-spec-rich-001',
      },
    };

    const baseTask: Task = {
      id: 'TASK-RICH-SPEC-001',
      project: 'payments-service',
      repository: 'https://github.com/example/payments.git',
      objective: 'Implement secure payment webhook handling',
      prompt: 'Implement Stripe webhook handler in src/webhooks/stripe.ts',
      status: 'ASSIGNED',
    };

    it('3.1 buildProviderInput formats constraints, acceptanceCriteria, and validationPlan into prompt', () => {
      const fakeProvider: AgentProvider = {
        kind: 'mock',
        model: 'test-model',
        execute: vi.fn(),
        health: vi.fn(),
        capabilities: vi.fn().mockReturnValue([]),
        metadata: vi.fn().mockReturnValue({}),
      };

      const engine = new DefaultExecutionEngine(fakeProvider);
      const input = engine.buildProviderInput(baseTask, baseSpec);

      // Check prompt enrichment
      expect(input.prompt).toContain(baseTask.prompt);
      expect(input.prompt).toContain('### Constraints');
      expect(input.prompt).toContain('- Must verify Stripe HMAC-SHA256 signature');
      expect(input.prompt).toContain('- Idempotency key must be checked before processing');

      expect(input.prompt).toContain('### Acceptance Criteria');
      expect(input.prompt).toContain('- Returns HTTP 200 on valid signature and processes event');
      expect(input.prompt).toContain('- Returns HTTP 400 on signature verification failure without throwing 500');

      expect(input.prompt).toContain('### Validation Plan');
      expect(input.prompt).toContain('- Run npm test tests/stripe-webhook.test.ts');
      expect(input.prompt).toContain('- Verify zero unhandled rejections under invalid payload test');

      // Check preservation of objective and executionInstructions
      expect(input.objective).toBe(baseSpec.objective);
      expect(input.systemInstructions).toEqual([
        'Create src/webhooks/stripe.ts',
        'Export handleStripeWebhook handler',
      ]);
    });

    it('3.2 buildProviderInput handles ExplicitUnknown gracefully without producing corrupted sections', () => {
      const specWithUnknowns: ExecutionSpec = {
        ...baseSpec,
        constraints: { kind: 'UNKNOWN', reason: 'No constraints specified' },
        acceptanceCriteria: { kind: 'UNKNOWN', reason: 'Criteria omitted' },
        validationPlan: { kind: 'UNKNOWN', reason: 'No validation plan' },
        executionInstructions: { kind: 'UNKNOWN', reason: 'No execution instructions' },
      };

      const fakeProvider: AgentProvider = {
        kind: 'mock',
        model: 'test-model',
        execute: vi.fn(),
        health: vi.fn(),
        capabilities: vi.fn().mockReturnValue([]),
        metadata: vi.fn().mockReturnValue({}),
      };

      const engine = new DefaultExecutionEngine(fakeProvider);
      const input = engine.buildProviderInput(baseTask, specWithUnknowns);

      // Must NOT contain sections for unknowns
      expect(input.prompt).toBe(baseTask.prompt);
      expect(input.prompt).not.toContain('### Constraints');
      expect(input.prompt).not.toContain('### Acceptance Criteria');
      expect(input.prompt).not.toContain('### Validation Plan');
      expect(input.systemInstructions).toBeUndefined();
    });

    it('3.3 buildProviderInput leaves prompt untouched when spec fields are empty arrays', () => {
      const specWithEmptyArrays: ExecutionSpec = {
        ...baseSpec,
        constraints: [],
        acceptanceCriteria: [],
        validationPlan: [],
        executionInstructions: [],
      };

      const fakeProvider: AgentProvider = {
        kind: 'mock',
        model: 'test-model',
        execute: vi.fn(),
        health: vi.fn(),
        capabilities: vi.fn().mockReturnValue([]),
        metadata: vi.fn().mockReturnValue({}),
      };

      const engine = new DefaultExecutionEngine(fakeProvider);
      const input = engine.buildProviderInput(baseTask, specWithEmptyArrays);

      expect(input.prompt).toBe(baseTask.prompt);
      expect(input.systemInstructions).toEqual([]);
    });

    it('3.4 engine.execute dispatches enriched ProviderTaskInput to provider.execute', async () => {
      let capturedInput: ProviderTaskInput | null = null;
      let capturedWorkspace: string | null = null;

      const fakeProvider: AgentProvider = {
        kind: 'mock',
        model: 'test-model',
        execute: vi.fn().mockImplementation(async (input: ProviderTaskInput, ws: string): Promise<ProviderTaskResult> => {
          capturedInput = input;
          capturedWorkspace = ws;
          return {
            status: 'COMPLETED',
            provider: 'mock',
            model: 'test-model',
            exitCode: 0,
            durationMs: 42,
            stdout: 'done',
            stderr: '',
            changedFiles: ['src/webhooks/stripe.ts'],
            commit: null,
            errorCode: null,
            errorMessage: null,
          };
        }),
        health: vi.fn(),
        capabilities: vi.fn().mockReturnValue([]),
        metadata: vi.fn().mockReturnValue({}),
      };

      const engine = new DefaultExecutionEngine(fakeProvider);
      const taskWithWs = { ...baseTask, workspacePath: '/tmp/test-workspace' };

      const result = await engine.execute(taskWithWs, baseSpec);

      expect(result.execution.status).toBe('COMPLETED');
      expect(capturedWorkspace).toBe('/tmp/test-workspace');
      expect(capturedInput).not.toBeNull();
      expect(capturedInput!.prompt).toContain('### Constraints');
      expect(capturedInput!.prompt).toContain('### Acceptance Criteria');
      expect(capturedInput!.prompt).toContain('### Validation Plan');
      expect(capturedInput!.objective).toBe(baseSpec.objective);
      expect(capturedInput!.systemInstructions).toEqual(baseSpec.executionInstructions);
    });
  });
});

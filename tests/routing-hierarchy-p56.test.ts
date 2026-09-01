import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { buildRoutingPolicy, resolveCandidateModels, DEFAULT_TIER1_MODELS, canUsePaidFallback } from '../src/routing/engine.js';
import { classifyTaskProfile } from '../src/routing/classifier.js';
import { loadOpenRouterConfig } from '../src/providers/openrouterConfig.js';
import { OpenRouterProvider } from '../src/providers/openrouter.js';
import { RouterProvider } from '../src/providers/router.js';
import { DualGatewayProvider } from '../src/providers/gateway.js';
import type { Task } from '../src/domain.js';
import { StreamEventSink } from '../src/providers/streaming/index.js';
import type { OperationalEventEnvelope } from '../src/providers/streaming/types.js';

describe('P5.6 Model Routing Hierarchy on OpenRouter Primary', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    delete process.env.OPENROUTER_MODEL;
    delete process.env.OPENROUTER_FALLBACK_MODELS;
    delete process.env.OPENROUTER_TIER1_MODELS;
    delete process.env.OPENROUTER_PAID_FALLBACK_ENABLED;
    delete process.env.OPENROUTER_FREE_POOL_ENABLED;
    process.env.OPENROUTER_MAX_RETRIES = '1';
    process.env.OPENROUTER_RETRY_BASE_DELAY_MS = '10';
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe('Scenario A to D: Profile Classification & Tier 1 Deterministic Selection', () => {
    it('Scenario A: fast_prototype selects minimax / cohere free models first, then Tier 2 free pool', () => {
      const task: Partial<Task> = {
        objective: 'Build mockup layout landingpage and visual design preview',
        prototypeSessionId: 'proto-session-123',
      };
      const profile = classifyTaskProfile(task);
      expect(profile).toBe('fast_prototype');

      const policy = buildRoutingPolicy(task);
      const candidates = resolveCandidateModels(policy);

      expect(candidates.length).toBeGreaterThan(1);
      // Tier 1 models first
      expect(candidates[0].tier).toBe(1);
      expect(candidates[0].model).toBe('cohere/north-mini-code:free');
      expect(candidates[1].tier).toBe(1);
      expect(candidates[1].model).toBe('minimax/minimax-m2.7:free');
      // Tier 2 free pool is next
      expect(candidates[2].tier).toBe(2);
      expect(candidates[2].model).toBe('openrouter/free');
      // No Tier 3 paid models when paid fallback is OFF
      expect(candidates.some(c => c.tier === 3)).toBe(false);
    });

    it('Scenario B: coding selects minimax-m2.7:free as primary coding model', () => {
      const task: Partial<Task> = {
        objective: 'Implement typescript algorithm and database logic',
      };
      const profile = classifyTaskProfile(task);
      expect(profile).toBe('coding');

      const policy = buildRoutingPolicy(task);
      const candidates = resolveCandidateModels(policy);

      expect(candidates[0].tier).toBe(1);
      expect(candidates[0].model).toBe('minimax/minimax-m2.7:free');
      expect(candidates[1].tier).toBe(1);
      expect(candidates[1].model).toBe('poolside/laguna-s-2.1-20260720:free');
      expect(candidates[2].tier).toBe(1);
      expect(candidates[2].model).toBe('cohere/north-mini-code:free');
      // Tier 2 free pool follows
      expect(candidates[3].tier).toBe(2);
      expect(candidates[3].model).toBe('openrouter/free');
    });

    it('Scenario C: reasoning selects minimax-m3:free as primary architecture/reasoning model', () => {
      const task: Partial<Task> = {
        objective: 'Analyze and audit system architecture bottlenecks and investigate race conditions',
      };
      const profile = classifyTaskProfile(task);
      expect(profile).toBe('reasoning');

      const policy = buildRoutingPolicy(task);
      const candidates = resolveCandidateModels(policy);

      expect(candidates[0].tier).toBe(1);
      expect(candidates[0].model).toBe('minimax/minimax-m3:free');
      expect(candidates[1].tier).toBe(1);
      expect(candidates[1].model).toBe('nvidia/nemotron-3-ultra-550b-a55b:free');
      expect(candidates[2].tier).toBe(2);
      expect(candidates[2].model).toBe('openrouter/free');
    });

    it('Scenario D: general selects minimax-m2.7:free as balanced general model', () => {
      const task: Partial<Task> = {
        objective: 'General summary of tasks and progress overview',
      };
      const profile = classifyTaskProfile(task);
      expect(profile).toBe('general');

      const policy = buildRoutingPolicy(task);
      const candidates = resolveCandidateModels(policy);

      expect(candidates[0].tier).toBe(1);
      expect(candidates[0].model).toBe('minimax/minimax-m2.7:free');
      expect(candidates[1].tier).toBe(1);
      expect(candidates[1].model).toBe('minimax/minimax-m3:free');
      expect(candidates[2].tier).toBe(2);
      expect(candidates[2].model).toBe('openrouter/free');
    });
  });

  describe('Scenario E & F: Tier 2 Free Pool & OpenRouter Config Loading', () => {
    it('Scenario E: openrouter/free in OPENROUTER_MODEL env does NOT override Tier 1 hierarchy', () => {
      process.env.OPENROUTER_MODEL = 'openrouter/free';
      const task: Partial<Task> = { objective: 'Refactor typescript classes' };

      const cfg = loadOpenRouterConfig(undefined, task);
      // Coding profile Tier 1 should be selected, NOT openrouter/free
      expect(cfg.primaryModel).toBe('minimax/minimax-m2.7:free');
      expect(cfg.fallbackModels).toContain('openrouter/free');
    });

    it('Scenario F: openrouter/free is never placed before Tier 1 models', () => {
      const task: Partial<Task> = { objective: 'Debug race condition' };
      const policy = buildRoutingPolicy(task);
      const candidates = resolveCandidateModels(policy);

      const freePoolIndex = candidates.findIndex(c => c.model === 'openrouter/free');
      const tier1Indices = candidates
        .map((c, i) => (c.tier === 1 ? i : -1))
        .filter(i => i !== -1);

      expect(freePoolIndex).toBeGreaterThan(Math.max(...tier1Indices));
    });
  });

  describe('Scenario G & H: Cost Guard Sovereignty & Paid Fallback Protection', () => {
    it('Scenario G: Tier 3 Paid models strictly excluded when OPENROUTER_PAID_FALLBACK_ENABLED is false/unset', () => {
      const task: Partial<Task> = { objective: 'Coding task' };
      const policy = buildRoutingPolicy(task);
      const candidates = resolveCandidateModels(policy);

      expect(candidates.every(c => c.free === true)).toBe(true);
      expect(candidates.every(c => c.tier !== 3)).toBe(true);
      expect(canUsePaidFallback(policy, 0, 0)).toBe(false);
    });

    it('Scenario H: Tier 3 Paid models included only when enabled and guarded by limits', () => {
      process.env.OPENROUTER_PAID_FALLBACK_ENABLED = 'true';
      process.env.OPENROUTER_PAID_MAX_ATTEMPTS = '1';
      process.env.OPENROUTER_MAX_COST_PER_TASK_USD = '0.10';

      const task: Partial<Task> = { objective: 'Complex refactor' };
      const policy = buildRoutingPolicy(task);
      const candidates = resolveCandidateModels(policy);

      const tier3 = candidates.filter(c => c.tier === 3);
      expect(tier3.length).toBe(1); // capped by maxPaidAttempts = 1
      expect(tier3[0].model).toBe('openai/gpt-4o-mini');
      expect(tier3[0].maxRetries).toBe(1); // single-shot to protect budget

      // canUsePaidFallback verification
      expect(canUsePaidFallback(policy, 0, 0.02, 0.01)).toBe(true);
      expect(canUsePaidFallback(policy, 1, 0.02, 0.01)).toBe(false); // attempt limit reached
      expect(canUsePaidFallback(policy, 0, 0.09, 0.02)).toBe(false); // budget limit (0.11 > 0.10) exceeded
    });
  });

  describe('Scenario I & J: DualGateway Hierarchy & Gateway Fallback Distinction', () => {
    it('Scenario I: DualGatewayProvider executes OpenRouter as primary and 9router as fallback', async () => {
      const openRouterMock = {
        kind: 'openrouter' as const,
        model: null,
        execute: vi.fn().mockResolvedValue({
          status: 'COMPLETED',
          provider: 'openrouter',
          model: 'minimax/minimax-m2.7:free',
          durationMs: 150,
          toolCalls: 0,
        }),
      };
      const routerMock = {
        kind: 'router' as const,
        model: 'gemini/gemini-3.6-flash',
        execute: vi.fn(),
      };

      const gateway = new DualGatewayProvider(openRouterMock as any, routerMock as any);
      const task: Task = {
        id: 'task-p56-gateway-1',
        objective: 'Test gateway precedence',
        status: 'PENDING',
        workspacePath: '/tmp/test',
        repoUrl: 'https://github.com/test/repo.git',
        branch: 'main',
        baseCommit: 'sha-001',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await gateway.execute(task, '/tmp/test');
      expect(result.status).toBe('COMPLETED');
      expect(result.provider).toBe('openrouter');
      expect(openRouterMock.execute).toHaveBeenCalledTimes(1);
      expect(routerMock.execute).not.toHaveBeenCalled();
    });

    it('Scenario J: Clean failure of OpenRouter triggers 9router gateway fallback', async () => {
      const openRouterMock = {
        kind: 'openrouter' as const,
        model: null,
        execute: vi.fn().mockResolvedValue({
          status: 'ROUTER_HTTP_ERROR',
          provider: 'openrouter',
          model: 'minimax/minimax-m2.7:free',
          durationMs: 200,
          changedFiles: [],
          toolCalls: 0,
          toolRounds: 0,
        }),
      };
      const routerMock = {
        kind: 'router' as const,
        model: 'gemini/gemini-3.6-flash',
        execute: vi.fn().mockResolvedValue({
          status: 'COMPLETED',
          provider: 'router',
          model: 'gemini/gemini-3.6-flash',
          durationMs: 300,
          changedFiles: ['app.ts'],
          toolCalls: 1,
        }),
      };

      const gateway = new DualGatewayProvider(openRouterMock as any, routerMock as any);
      const task: Task = {
        id: 'task-p56-gateway-2',
        objective: 'Test gateway fallback',
        status: 'PENDING',
        workspacePath: '/tmp/test',
        repoUrl: 'https://github.com/test/repo.git',
        branch: 'main',
        baseCommit: 'sha-001',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await gateway.execute(task, '/tmp/test');
      expect(result.status).toBe('COMPLETED');
      expect(result.provider).toBe('router');
      expect(openRouterMock.execute).toHaveBeenCalledTimes(1);
      expect(routerMock.execute).toHaveBeenCalledTimes(1);
    });
  });

  describe('Scenario K & L: Model Fallback Loop Intra-OpenRouter', () => {
    it('Scenario K: OpenRouterProvider iterates through candidateEntries on 500 server error', async () => {
      const attemptedModels: string[] = [];

      global.fetch = vi.fn().mockImplementation(async (_url, options: any) => {
        const body = JSON.parse(options.body);
        attemptedModels.push(body.model);

        if (body.model === 'minimax/minimax-m2.7:free') {
          return {
            ok: false,
            status: 500,
            text: async () => JSON.stringify({ error: { message: 'Internal server error upstream' } }),
          };
        }

        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({
            choices: [{ message: { role: 'assistant', content: 'Fallback model resolved successfully' } }],
            usage: { prompt_tokens: 20, completion_tokens: 10, total_tokens: 30 },
          }),
        };
      });

      const provider = new OpenRouterProvider(
        'https://openrouter.ai/api/v1',
        'test-key',
        10000,
        undefined,
        false
      );

      const task: Task = {
        id: 'task-p56-fallback',
        objective: 'Implement typescript algorithm',
        status: 'PENDING',
        workspacePath: '/tmp/test',
        repoUrl: 'https://github.com/test/repo.git',
        branch: 'main',
        baseCommit: 'sha-001',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await provider.execute(task, '/tmp/test');
      expect(result.status).toBe('COMPLETED');
      expect(attemptedModels[0]).toBe('minimax/minimax-m2.7:free');
      expect(attemptedModels[1]).toBe('poolside/laguna-s-2.1-20260720:free');
      expect(result.model).toBe('poolside/laguna-s-2.1-20260720:free');
    });
  });

  describe('Scenario M & N: Operational Streaming & Lifecycle Envelope Model Parity', () => {
    it('Scenario M: StreamEventSink receives the winning selected model and emits accurate attempt envelopes', async () => {
      const envelopesEmitted: OperationalEventEnvelope[] = [];
      const sink = new StreamEventSink(
        {
          onEnvelope: (env) => {
            envelopesEmitted.push(env);
          },
        },
        { taskId: 'task-sink-test', attempt: 0 }
      );

      sink.emitEnvelope('attempt_started', {
        attempt: 0,
        provider: 'openrouter',
        model: 'minimax/minimax-m2.7:free',
      });

      sink.emitEnvelope('stream_text_delta', {
        attempt: 0,
        delta: 'console.log("hello world");',
        accumulatedLength: 27,
      });

      sink.emitEnvelope('attempt_completed', {
        attempt: 0,
        status: 'COMPLETED',
        durationMs: 120,
      });

      expect(envelopesEmitted.length).toBe(3);
      expect(envelopesEmitted[0].type).toBe('attempt_started');
      expect(envelopesEmitted[0].payload.model).toBe('minimax/minimax-m2.7:free');
      expect(envelopesEmitted[0].payload.provider).toBe('openrouter');
      expect(envelopesEmitted[1].type).toBe('stream_text_delta');
      expect(envelopesEmitted[2].type).toBe('attempt_completed');
    });
  });
});

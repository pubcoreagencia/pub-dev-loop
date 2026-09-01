// tests/routing-engine.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  classifyTaskProfile,
  buildRoutingPolicy,
  resolveCandidateModels,
  canUsePaidFallback,
  getModelCapability,
  filterCapableModels,
  DEFAULT_TIER1_MODELS,
  DEFAULT_PAID_MODELS,
} from '../src/routing/index.js';
import { loadOpenRouterConfig } from '../src/providers/openrouterConfig.js';
import { OpenRouterProvider } from '../src/providers/openrouter.js';
import type { Task } from '../src/domain.js';

describe('Model Routing Policy Engine (P4 & P4.1)', () => {
  describe('1. Deterministic Task Classification', () => {
    it('classifies prototype tasks as fast_prototype', () => {
      expect(classifyTaskProfile({ prototypeSessionId: 'sess-123' })).toBe('fast_prototype');
      expect(classifyTaskProfile({ objective: 'Create dashboard prototype for barber shop' })).toBe('fast_prototype');
      expect(classifyTaskProfile({ prompt: 'Build a new landing page layout with buttons' })).toBe('fast_prototype');
    });

    it('classifies coding tasks as coding', () => {
      expect(classifyTaskProfile({ objective: 'Implement authentication API endpoint' })).toBe('coding');
      expect(classifyTaskProfile({ prompt: 'Write TypeScript function to parse postgres connection string' })).toBe('coding');
      expect(classifyTaskProfile({ prompt: 'Bugfix: resolve null pointer exception in worker service' })).toBe('coding');
    });

    it('classifies reasoning tasks as reasoning', () => {
      expect(classifyTaskProfile({ objective: 'System architecture audit and migration review' })).toBe('reasoning');
      expect(classifyTaskProfile({ prompt: 'Investigate root cause of concurrency deadlocks in database pool' })).toBe('reasoning');
      expect(classifyTaskProfile({ objective: 'Redesign state management pipeline' })).toBe('reasoning');
    });

    it('falls back to general for unclassified tasks', () => {
      expect(classifyTaskProfile({})).toBe('general');
      expect(classifyTaskProfile({ objective: 'Hello world', prompt: 'Summarize text' })).toBe('general');
    });
  });

  describe('2. Capability Registry', () => {
    it('retrieves known model capabilities correctly', () => {
      const minimax = getModelCapability('minimax/minimax-m2.7:free');
      expect(minimax).toBeDefined();
      expect(minimax?.tier).toBe(1);
      expect(minimax?.free).toBe(true);
      expect(minimax?.toolCalling).toBe(true);
      expect(minimax?.contextWindow).toBeGreaterThanOrEqual(32768);

      const gpt4o = getModelCapability('openai/gpt-4o-mini');
      expect(gpt4o).toBeDefined();
      expect(gpt4o?.tier).toBe(3);
      expect(gpt4o?.free).toBe(false);
    });

    it('filters models requiring toolCalling and minimum context window', () => {
      const filtered = filterCapableModels(
        ['minimax/minimax-m2.7:free', 'openai/gpt-4o-mini'],
        { requireToolCalling: true, minContextTokens: 32768 }
      );
      expect(filtered).toContain('minimax/minimax-m2.7:free');
      expect(filtered).toContain('openai/gpt-4o-mini');
    });
  });

  describe('3. Tier Routing Sequence', () => {
    it('produces Tier 1 -> Tier 2 default sequence when paid fallback is disabled', () => {
      const policy = buildRoutingPolicy({ objective: 'Implement database repository' }, {
        OPENROUTER_PAID_FALLBACK_ENABLED: 'false',
        OPENROUTER_FREE_POOL_ENABLED: 'true',
      });

      expect(policy.profile).toBe('coding');
      expect(policy.tiers.tier1ExplicitFree).toEqual(DEFAULT_TIER1_MODELS.coding);
      expect(policy.tiers.tier2OpenRouterFreePool).toBe(true);
      expect(policy.tiers.tier3PaidFallback).toEqual([]);

      const candidates = resolveCandidateModels(policy);
      const tier1s = candidates.filter(c => c.tier === 1);
      const tier2s = candidates.filter(c => c.tier === 2);
      const tier3s = candidates.filter(c => c.tier === 3);

      expect(tier1s.length).toBeGreaterThanOrEqual(1);
      expect(tier2s.length).toBe(1);
      expect(tier2s[0].model).toBe('openrouter/free');
      expect(tier3s.length).toBe(0); // Paid fallback disabled
    });

    it('includes Tier 3 paid models when OPENROUTER_PAID_FALLBACK_ENABLED is true', () => {
      const policy = buildRoutingPolicy({ objective: 'Implement backend router' }, {
        OPENROUTER_PAID_FALLBACK_ENABLED: 'true',
        OPENROUTER_PAID_MAX_ATTEMPTS: '2',
      });

      const candidates = resolveCandidateModels(policy);
      const tier3s = candidates.filter(c => c.tier === 3);

      expect(tier3s.length).toBe(2);
      expect(tier3s[0].free).toBe(false);
      expect(DEFAULT_PAID_MODELS).toContain(tier3s[0].model);
    });

    it('preserves single-model override compatibility', () => {
      const policy = buildRoutingPolicy();
      const candidates = resolveCandidateModels(policy, 'anthropic/claude-3.5-sonnet');

      expect(candidates.length).toBe(1);
      expect(candidates[0].model).toBe('anthropic/claude-3.5-sonnet');
      expect(candidates[0].tier).toBe(3);
    });
  });

  describe('4. Cost Guard & Paid Fallback Control (P4.1)', () => {
    it('blocks paid fallback when paid attempts limit is reached', () => {
      const policy = buildRoutingPolicy(undefined, {
        OPENROUTER_PAID_FALLBACK_ENABLED: 'true',
        OPENROUTER_PAID_MAX_ATTEMPTS: '1',
      });

      expect(canUsePaidFallback(policy, 0)).toBe(true);
      expect(canUsePaidFallback(policy, 1)).toBe(false);
    });

    it('blocks paid fallback when accumulated + estimated cost exceeds safety ceiling', () => {
      const policy = buildRoutingPolicy(undefined, {
        OPENROUTER_PAID_FALLBACK_ENABLED: 'true',
        OPENROUTER_PAID_MAX_ATTEMPTS: '2',
        OPENROUTER_MAX_COST_PER_TASK_USD: '0.10',
      });

      // Spent $0.04, next projected $0.03 -> $0.07 <= $0.10 -> allowed
      expect(canUsePaidFallback(policy, 0, 0.04, 0.03)).toBe(true);
      // Spent $0.08, next projected $0.03 -> $0.11 > $0.10 -> blocked
      expect(canUsePaidFallback(policy, 0, 0.08, 0.03)).toBe(false);
    });

    it('blocks paid fallback unconditionally when OPENROUTER_PAID_FALLBACK_ENABLED is false', () => {
      const policy = buildRoutingPolicy(undefined, {
        OPENROUTER_PAID_FALLBACK_ENABLED: 'false',
        OPENROUTER_PAID_MAX_ATTEMPTS: '5',
      });
      expect(canUsePaidFallback(policy, 0, 0, 0)).toBe(false);
    });
  });

  describe('5. openrouterConfig Integration', () => {
    it('loads policy-resolved candidate queue seamlessly', () => {
      const dummyTask: Partial<Task> = { objective: 'Prototype modern SaaS dashboard' };
      const config = loadOpenRouterConfig(undefined, dummyTask, {
        OPENROUTER_PAID_FALLBACK_ENABLED: 'false',
        OPENROUTER_FREE_POOL_ENABLED: 'true',
      });

      expect(config.primaryModel).toBe('cohere/north-mini-code:free');
      expect(config.fallbackModels).toContain('minimax/minimax-m2.7:free');
      expect(config.fallbackModels).toContain('openrouter/free');
      expect(config.policy?.profile).toBe('fast_prototype');
    });
  });

  describe('6. OpenRouterProvider E2E Simulation & Token/Cost Capture (P4.1)', () => {
    const dummyTask: Task = {
      id: 'task-e2e-1',
      project: 'test-project',
      repository: 'https://github.com/test/repo',
      objective: 'Implement database connection layer',
      prompt: 'Write database adapter in typescript',
      status: 'QUEUED',
      priority: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it('captures token usage, cost, and succeeds on Tier 1 model', async () => {
      const provider = new OpenRouterProvider('http://localhost:19999/v1', 'dummy-key', 5000);

      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          model: 'minimax/minimax-m2.7:free',
          choices: [{ message: { role: 'assistant', content: 'Database adapter created successfully.' }, finish_reason: 'stop' }],
          usage: {
            prompt_tokens: 350,
            completion_tokens: 120,
            total_tokens: 470,
            cost: 0,
          },
          total_cost: 0,
        }),
      });

      const result = await provider.execute(dummyTask, process.cwd());

      expect(result.status).toBe('COMPLETED');
      expect(result.model).toBe('minimax/minimax-m2.7:free');
      expect(result.promptTokens).toBe(350);
      expect(result.completionTokens).toBe(120);
      expect(result.totalTokens).toBe(470);
      expect(result.costUsd).toBe(0);
    });

    it('tolerates absence of usage object without breaking', async () => {
      const provider = new OpenRouterProvider('http://localhost:19999/v1', 'dummy-key', 5000);

      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          model: 'minimax/minimax-m2.7:free',
          choices: [{ message: { role: 'assistant', content: 'Done without usage info.' }, finish_reason: 'stop' }],
        }),
      });

      const result = await provider.execute(dummyTask, process.cwd());

      expect(result.status).toBe('COMPLETED');
      expect(result.promptTokens).toBeUndefined();
      expect(result.completionTokens).toBeUndefined();
      expect(result.totalTokens).toBeUndefined();
      expect(result.costUsd).toBe(0); // Identified as free model
    });

    it('simulates multi-tier escalation: Tier 1 (429/500) -> Tier 2 (429) -> Tier 3 PAID (SUCCESS)', async () => {
      // Configure env with Paid Fallback ENABLED
      const originalEnv = process.env;
      process.env = {
        ...originalEnv,
        OPENROUTER_TIER1_MODELS: 'model-free-a:free,model-free-b:free',
        OPENROUTER_FREE_POOL_ENABLED: 'true',
        OPENROUTER_PAID_FALLBACK_ENABLED: 'true',
        OPENROUTER_PAID_MAX_ATTEMPTS: '1',
        OPENROUTER_MAX_RETRIES: '1',
        OPENROUTER_RETRY_BASE_DELAY_MS: '1',
      };

      const provider = new OpenRouterProvider('http://localhost:19999/v1', 'dummy-key', 5000);

      let callCount = 0;
      const calledModels: string[] = [];

      globalThis.fetch = vi.fn().mockImplementation(async (_url, options) => {
        callCount++;
        const body = JSON.parse(options.body);
        calledModels.push(body.model);

        // 1. Tier 1 Model A -> 429
        if (body.model === 'model-free-a:free') {
          return { ok: false, status: 429, headers: new Headers(), text: async () => 'Rate limit exceeded' };
        }
        // 2. Tier 1 Model B -> 500
        if (body.model === 'model-free-b:free') {
          return { ok: false, status: 500, headers: new Headers(), text: async () => 'Internal Server Error' };
        }
        // 3. Tier 2 openrouter/free -> 429
        if (body.model === 'openrouter/free') {
          return { ok: false, status: 429, headers: new Headers(), text: async () => 'Community pool exhausted' };
        }
        // 4. Tier 3 Paid gpt-4o-mini -> Success with usage and cost
        if (body.model === 'openai/gpt-4o-mini') {
          return {
            ok: true,
            status: 200,
            text: async () => JSON.stringify({
              model: 'openai/gpt-4o-mini',
              choices: [{ message: { role: 'assistant', content: 'Paid execution completed.' }, finish_reason: 'stop' }],
              usage: { prompt_tokens: 800, completion_tokens: 200, total_tokens: 1000 },
              total_cost: 0.0003,
            }),
          };
        }

        return { ok: false, status: 400, text: async () => 'Unexpected model' };
      });

      const result = await provider.execute(dummyTask, process.cwd());

      expect(calledModels).toEqual([
        'model-free-a:free',
        'model-free-b:free',
        'openrouter/free',
        'openai/gpt-4o-mini',
      ]);
      expect(result.status).toBe('COMPLETED');
      expect(result.model).toBe('openai/gpt-4o-mini');
      expect(result.totalTokens).toBe(1000);
      expect(result.costUsd).toBe(0.0003);

      process.env = originalEnv;
    });

    it('GUARANTEES paid models are NEVER called when OPENROUTER_PAID_FALLBACK_ENABLED=false', async () => {
      const originalEnv = process.env;
      process.env = {
        ...originalEnv,
        OPENROUTER_TIER1_MODELS: 'model-free-a:free',
        OPENROUTER_FREE_POOL_ENABLED: 'true',
        OPENROUTER_PAID_FALLBACK_ENABLED: 'false', // STRICTLY DISABLED
        OPENROUTER_MAX_RETRIES: '1',
        OPENROUTER_RETRY_BASE_DELAY_MS: '1',
      };

      const provider = new OpenRouterProvider('http://localhost:19999/v1', 'dummy-key', 5000);
      const calledModels: string[] = [];

      globalThis.fetch = vi.fn().mockImplementation(async (_url, options) => {
        const body = JSON.parse(options.body);
        calledModels.push(body.model);
        return { ok: false, status: 500, headers: new Headers(), text: async () => 'Server error' };
      });

      const result = await provider.execute(dummyTask, process.cwd());

      expect(calledModels).toEqual(['model-free-a:free', 'openrouter/free']);
      expect(calledModels).not.toContain('openai/gpt-4o-mini');
      expect(calledModels).not.toContain('anthropic/claude-3.5-haiku');
      expect(result.status).toBe('ROUTER_HTTP_ERROR');
      expect(result.errorCode).toBe('ALL_PROVIDERS_FAILED');

      process.env = originalEnv;
    });
  });
});

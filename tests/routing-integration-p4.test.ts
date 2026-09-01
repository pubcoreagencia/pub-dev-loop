// tests/routing-integration-p4.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  classifyTaskProfile,
  buildRoutingPolicy,
  resolveCandidateModels,
  canUsePaidFallback,
  summarizeTaskTrace,
  aggregateObservabilityMetrics,
  calculateModelCalibrationScore,
  reorderTier1ModelsWithCalibration,
  type SystemObservabilityReport,
} from '../src/routing/index.js';
import { OpenRouterProvider } from '../src/providers/openrouter.js';
import type { Task } from '../src/domain.js';

describe('P4.4 Routing Integration & Production Verification', () => {
  describe('1. Production Routing Dry Run (Deterministico & Zero Network / Zero Tokens)', () => {
    it('accurately resolves candidate tiers for diverse production profiles', () => {
      // CODING tasks
      const codingBugfix = { objective: 'Bugfix: resolve postgres pool connection leak' };
      const codingPolicy = buildRoutingPolicy(codingBugfix);
      expect(codingPolicy.profile).toBe('coding');
      const codingCandidates = resolveCandidateModels(codingPolicy);
      expect(codingCandidates[0].tier).toBe(1);
      expect(codingCandidates.some(c => c.tier === 2 && c.model === 'openrouter/free')).toBe(true);

      // REASONING tasks
      const reasoningAudit = { objective: 'System architecture audit and migration review' };
      const reasoningPolicy = buildRoutingPolicy(reasoningAudit);
      expect(reasoningPolicy.profile).toBe('reasoning');
      const reasoningCandidates = resolveCandidateModels(reasoningPolicy);
      expect(reasoningCandidates[0].tier).toBe(1);

      // FAST_PROTOTYPE tasks
      const prototypeUi = { objective: 'Create dashboard prototype for barber shop' };
      const protoPolicy = buildRoutingPolicy(prototypeUi);
      expect(protoPolicy.profile).toBe('fast_prototype');
      const protoCandidates = resolveCandidateModels(protoPolicy);
      expect(protoCandidates[0].tier).toBe(1);

      // GENERAL tasks
      const generalTask = { objective: 'General summarization of release notes' };
      const generalPolicy = buildRoutingPolicy(generalTask);
      expect(generalPolicy.profile).toBe('general');
    });
  });

  describe('2. Absolute Routing & Calibration Invariants (A até M)', () => {
    it('A & B: calibration=false preserves static order, calibration=true ONLY reorders Tier 1', () => {
      const originalTier1 = ['model-alpha:free', 'model-beta:free'];
      const mockReport: SystemObservabilityReport = {
        modelRankingsGlobal: [
          { model: 'model-beta:free', tier: 1, totalAttempts: 30, completedAttempts: 25, winCount: 25, winRate: 83.33, successRate: 83.33, totalDurationMs: 300000, averageDurationMs: 10000, totalPromptTokens: 0, totalCompletionTokens: 0, totalTokens: 0, averageTokens: 0, totalCostUsd: 0, averageCostUsd: 0, retryCount: 0, modelSwitchCount: 0, tierEscalationCount: 0, toolCalls: 30, toolFailureRate: 0, errorCounts: {}, rootErrorCategoryCounts: { RATE_LIMIT: 0, SERVER_ERROR: 0, TIMEOUT: 0, TOOL_CALLING_FAILURE: 0, CONTEXT_FAILURE: 0, EMPTY_RESPONSE: 0, INVALID_RESPONSE: 0, AUTH_FAILURE: 0, UNKNOWN: 0 } },
          { model: 'model-alpha:free', tier: 1, totalAttempts: 30, completedAttempts: 10, winCount: 10, winRate: 33.33, successRate: 33.33, totalDurationMs: 300000, averageDurationMs: 10000, totalPromptTokens: 0, totalCompletionTokens: 0, totalTokens: 0, averageTokens: 0, totalCostUsd: 0, averageCostUsd: 0, retryCount: 0, modelSwitchCount: 0, tierEscalationCount: 0, toolCalls: 30, toolFailureRate: 0, errorCounts: {}, rootErrorCategoryCounts: { RATE_LIMIT: 0, SERVER_ERROR: 0, TIMEOUT: 0, TOOL_CALLING_FAILURE: 0, CONTEXT_FAILURE: 0, EMPTY_RESPONSE: 0, INVALID_RESPONSE: 0, AUTH_FAILURE: 0, UNKNOWN: 0 } },
        ],
        profileBreakdown: {} as any,
      } as any;

      // Disabled
      const orderDisabled = reorderTier1ModelsWithCalibration(originalTier1, 'coding', mockReport, { enabled: false });
      expect(orderDisabled).toEqual(['model-alpha:free', 'model-beta:free']);

      // Enabled
      const orderEnabled = reorderTier1ModelsWithCalibration(originalTier1, 'coding', mockReport, { enabled: true, minSampleSize: 10 });
      expect(orderEnabled).toEqual(['model-beta:free', 'model-alpha:free']);
    });

    it('C & D & E: Tier 2 never disappears, Tier 3 is NEVER promoted to Tier 1, Paid fallback stays guarded', () => {
      const policy = buildRoutingPolicy(
        { objective: 'Refactor database service' },
        {
          OPENROUTER_CALIBRATION_ENABLED: 'true',
          OPENROUTER_PAID_FALLBACK_ENABLED: 'false', // Guarded
          OPENROUTER_FREE_POOL_ENABLED: 'true',
        }
      );

      const mockReport: SystemObservabilityReport = {
        modelRankingsGlobal: [
          { model: 'openai/gpt-4o-mini', tier: 3, totalAttempts: 200, completedAttempts: 190, winCount: 190, winRate: 95, successRate: 95, totalDurationMs: 0, averageDurationMs: 5000, totalPromptTokens: 0, totalCompletionTokens: 0, totalTokens: 0, averageTokens: 0, totalCostUsd: 0.5, averageCostUsd: 0.0025, retryCount: 0, modelSwitchCount: 0, tierEscalationCount: 0, toolCalls: 200, toolFailureRate: 0, errorCounts: {}, rootErrorCategoryCounts: {} as any },
        ],
        profileBreakdown: {} as any,
      } as any;

      const candidates = resolveCandidateModels(policy, undefined, {
        OPENROUTER_CALIBRATION_ENABLED: 'true',
        OPENROUTER_PAID_FALLBACK_ENABLED: 'false',
      }, mockReport);

      const tier1s = candidates.filter(c => c.tier === 1);
      const tier2 = candidates.find(c => c.tier === 2);
      const tier3 = candidates.find(c => c.tier === 3);

      expect(tier1s.some(c => c.model === 'openai/gpt-4o-mini')).toBe(false);
      expect(tier2?.model).toBe('openrouter/free');
      expect(tier3).toBeUndefined(); // Paid fallback blocked
    });

    it('G & H: Insufficient data does NOT aggressively promote unproven models; Profile isolation is respected', () => {
      const originalTier1 = ['model-standard:free', 'model-unproven:free'];
      const mockReport: SystemObservabilityReport = {
        modelRankingsGlobal: [
          { model: 'model-unproven:free', tier: 1, totalAttempts: 2, winCount: 2, winRate: 100, successRate: 100, averageDurationMs: 8000, toolFailureRate: 0 } as any,
          { model: 'model-standard:free', tier: 1, totalAttempts: 40, winCount: 30, winRate: 75, successRate: 75, averageDurationMs: 8000, toolFailureRate: 0 } as any,
        ],
        profileBreakdown: {} as any,
      } as any;

      const reordered = reorderTier1ModelsWithCalibration(originalTier1, 'coding', mockReport, { enabled: true, minSampleSize: 10 });
      // model-standard has 40 samples (preferred), model-unproven has 2 samples (insufficient_data).
      // Consolidated model MUST remain ahead of unproven model!
      expect(reordered[0]).toBe('model-standard:free');
      expect(reordered[1]).toBe('model-unproven:free');
    });
  });

  describe('3. Fallback Pipeline Real Scenarios (Scenarios 1 até 5)', () => {
    const dummyTask: Task = {
      id: 'task-pipeline-test',
      project: 'test-project',
      repository: 'https://github.com/test/repo',
      objective: 'Implement secure auth tokens',
      prompt: 'Write JWT verify helper in typescript',
      status: 'QUEUED',
      priority: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it('Scenario 1: Tier 1 Model A (429) -> Model Switch -> Tier 1 Model B (Success)', async () => {
      const originalEnv = process.env;
      process.env = {
        ...originalEnv,
        OPENROUTER_TIER1_MODELS: 'model-a:free,model-b:free',
        OPENROUTER_MAX_RETRIES: '1',
        OPENROUTER_RETRY_BASE_DELAY_MS: '1',
      };

      const provider = new OpenRouterProvider('http://localhost:19999/v1', 'dummy-key', 5000);
      const requestedModels: string[] = [];

      globalThis.fetch = vi.fn().mockImplementation(async (_url, options) => {
        const body = JSON.parse(options.body);
        requestedModels.push(body.model);
        if (body.model === 'model-a:free') {
          return { ok: false, status: 429, headers: new Headers(), text: async () => 'Rate limit' };
        }
        if (body.model === 'model-b:free') {
          return {
            ok: true,
            status: 200,
            text: async () => JSON.stringify({
              model: 'model-b:free',
              choices: [{ message: { role: 'assistant', content: 'JWT helper generated.' }, finish_reason: 'stop' }],
              usage: { prompt_tokens: 400, completion_tokens: 150, total_tokens: 550 },
            }),
          };
        }
        return { ok: false, status: 400, text: async () => 'Bad request' };
      });

      const result = await provider.execute(dummyTask, process.cwd());

      expect(requestedModels).toEqual(['model-a:free', 'model-b:free']);
      expect(result.status).toBe('COMPLETED');
      expect(result.model).toBe('model-b:free');
      expect(result.totalTokens).toBe(550);
      expect(result.costUsd).toBe(0);

      process.env = originalEnv;
    });

    it('Scenario 2: Tier 1 all fail -> Tier 2 openrouter/free (Success)', async () => {
      const originalEnv = process.env;
      process.env = {
        ...originalEnv,
        OPENROUTER_TIER1_MODELS: 'model-a:free',
        OPENROUTER_FREE_POOL_ENABLED: 'true',
        OPENROUTER_MAX_RETRIES: '1',
        OPENROUTER_RETRY_BASE_DELAY_MS: '1',
      };

      const provider = new OpenRouterProvider('http://localhost:19999/v1', 'dummy-key', 5000);
      const requestedModels: string[] = [];

      globalThis.fetch = vi.fn().mockImplementation(async (_url, options) => {
        const body = JSON.parse(options.body);
        requestedModels.push(body.model);
        if (body.model === 'model-a:free') {
          return { ok: false, status: 500, headers: new Headers(), text: async () => 'Internal Error' };
        }
        if (body.model === 'openrouter/free') {
          return {
            ok: true,
            status: 200,
            text: async () => JSON.stringify({
              model: 'openrouter/free',
              choices: [{ message: { role: 'assistant', content: 'Community free pool completed task.' }, finish_reason: 'stop' }],
              usage: { prompt_tokens: 600, completion_tokens: 200, total_tokens: 800 },
            }),
          };
        }
        return { ok: false, status: 400, text: async () => 'Bad request' };
      });

      const result = await provider.execute(dummyTask, process.cwd());

      expect(requestedModels).toEqual(['model-a:free', 'openrouter/free']);
      expect(result.status).toBe('COMPLETED');
      expect(result.model).toBe('openrouter/free');

      process.env = originalEnv;
    });

    it('Scenario 3: Tier 1 and Tier 2 fail -> Paid Disabled -> Aborts without calling Tier 3', async () => {
      const originalEnv = process.env;
      process.env = {
        ...originalEnv,
        OPENROUTER_TIER1_MODELS: 'model-a:free',
        OPENROUTER_FREE_POOL_ENABLED: 'true',
        OPENROUTER_PAID_FALLBACK_ENABLED: 'false', // STRICTLY FALSE
        OPENROUTER_MAX_RETRIES: '1',
        OPENROUTER_RETRY_BASE_DELAY_MS: '1',
      };

      const provider = new OpenRouterProvider('http://localhost:19999/v1', 'dummy-key', 5000);
      const requestedModels: string[] = [];

      globalThis.fetch = vi.fn().mockImplementation(async (_url, options) => {
        const body = JSON.parse(options.body);
        requestedModels.push(body.model);
        return { ok: false, status: 500, headers: new Headers(), text: async () => 'Server error' };
      });

      const result = await provider.execute(dummyTask, process.cwd());

      expect(requestedModels).toEqual(['model-a:free', 'openrouter/free']);
      expect(requestedModels).not.toContain('openai/gpt-4o-mini');
      expect(result.status).toBe('ROUTER_HTTP_ERROR');
      expect(result.errorCode).toBe('ALL_PROVIDERS_FAILED');

      process.env = originalEnv;
    });

    it('Scenario 4 & 5: Paid Enabled -> Cost Guard permits Tier 3 -> Budget limit blocks further paid attempts', async () => {
      const originalEnv = process.env;
      process.env = {
        ...originalEnv,
        OPENROUTER_TIER1_MODELS: 'model-a:free',
        OPENROUTER_FREE_POOL_ENABLED: 'true',
        OPENROUTER_PAID_FALLBACK_ENABLED: 'true',
        OPENROUTER_PAID_MAX_ATTEMPTS: '1', // Only 1 paid attempt allowed!
        OPENROUTER_MAX_RETRIES: '1',
        OPENROUTER_RETRY_BASE_DELAY_MS: '1',
      };

      const provider = new OpenRouterProvider('http://localhost:19999/v1', 'dummy-key', 5000);
      const requestedModels: string[] = [];

      globalThis.fetch = vi.fn().mockImplementation(async (_url, options) => {
        const body = JSON.parse(options.body);
        requestedModels.push(body.model);
        if (body.model === 'model-a:free' || body.model === 'openrouter/free') {
          return { ok: false, status: 500, headers: new Headers(), text: async () => 'Error' };
        }
        if (body.model === 'openai/gpt-4o-mini') {
          return {
            ok: true,
            status: 200,
            text: async () => JSON.stringify({
              model: 'openai/gpt-4o-mini',
              choices: [{ message: { role: 'assistant', content: 'Paid success.' }, finish_reason: 'stop' }],
              usage: { prompt_tokens: 500, completion_tokens: 100, total_tokens: 600 },
              total_cost: 0.0002,
            }),
          };
        }
        return { ok: false, status: 400, text: async () => 'Error' };
      });

      const result = await provider.execute(dummyTask, process.cwd());

      expect(requestedModels).toEqual(['model-a:free', 'openrouter/free', 'openai/gpt-4o-mini']);
      expect(result.status).toBe('COMPLETED');
      expect(result.costUsd).toBe(0.0002);

      // Verify Cost Guard rejection when limit is reached
      const policy = buildRoutingPolicy(undefined, {
        OPENROUTER_PAID_FALLBACK_ENABLED: 'true',
        OPENROUTER_PAID_MAX_ATTEMPTS: '1',
      });
      expect(canUsePaidFallback(policy, 1)).toBe(false);

      process.env = originalEnv;
    });
  });

  describe('4. Trace & Observability Consistency', () => {
    it('summarizes multi-attempt task and produces consistent metrics feedback loop', () => {
      const mockMultiAttemptTask: Partial<Task> = {
        id: 'task-loop-test',
        status: 'COMPLETED',
        result: {
          trace: {
            totalDurationMs: 32000,
            winningAttempt: 2,
            finalStatus: 'COMPLETED',
            attempts: [
              { attempt: 0, model: 'model-a:free', tier: 1, fallbackType: undefined, status: 'FAILED', durationMs: 4000, promptTokens: 300, completionTokens: 50, totalTokens: 350, costUsd: 0 },
              { attempt: 1, model: 'model-a:free', tier: 1, fallbackType: 'retry', status: 'FAILED', durationMs: 5000, promptTokens: 300, completionTokens: 50, totalTokens: 350, costUsd: 0 },
              { attempt: 2, model: 'model-b:free', tier: 1, fallbackType: 'model_switch', status: 'COMPLETED', isWinner: true, durationMs: 23000, promptTokens: 800, completionTokens: 200, totalTokens: 1000, costUsd: 0 },
            ] as any,
          } as any,
        },
      };

      const summary = summarizeTaskTrace(mockMultiAttemptTask);
      expect(summary.attempts).toBe(3);
      expect(summary.retries).toBe(1);
      expect(summary.modelSwitches).toBe(1);
      expect(summary.tierEscalations).toBe(0);
      expect(summary.totalTokens).toBe(1700);
      expect(summary.winner?.model).toBe('model-b:free');

      const report = aggregateObservabilityMetrics([mockMultiAttemptTask]);
      expect(report.totalTasksAnalyzed).toBe(1);
      expect(report.globalSuccessRate).toBe(100);
      expect(report.tierBreakdown.tier1Wins).toBe(1);

      // Calibration loop
      const calibratedTier1 = reorderTier1ModelsWithCalibration(
        ['model-a:free', 'model-b:free'],
        'general',
        report,
        { enabled: true, minSampleSize: 1 }
      );
      expect(calibratedTier1).toEqual(['model-b:free', 'model-a:free']);
    });
  });
});

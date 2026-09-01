// tests/routing-calibration.test.ts
import { describe, it, expect } from 'vitest';
import {
  calculateModelCalibrationScore,
  reorderTier1ModelsWithCalibration,
  type CalibrationRecommendation,
  type SystemObservabilityReport,
  type ModelMetricsSummary,
} from '../src/routing/index.js';
import { resolveCandidateModels, buildRoutingPolicy } from '../src/routing/engine.js';

function createMockModelMetrics(overrides: Partial<ModelMetricsSummary>): ModelMetricsSummary {
  return {
    model: overrides.model || 'test-model',
    tier: overrides.tier || 1,
    totalAttempts: overrides.totalAttempts || 0,
    completedAttempts: overrides.completedAttempts || 0,
    failedAttempts: overrides.failedAttempts || 0,
    winCount: overrides.winCount || 0,
    winRate: overrides.winRate ?? (overrides.totalAttempts ? ((overrides.winCount || 0) / overrides.totalAttempts) * 100 : 0),
    successRate: overrides.successRate ?? (overrides.totalAttempts ? ((overrides.completedAttempts || 0) / overrides.totalAttempts) * 100 : 0),
    totalDurationMs: overrides.totalDurationMs || 0,
    averageDurationMs: overrides.averageDurationMs || 10000,
    totalPromptTokens: overrides.totalPromptTokens || 0,
    totalCompletionTokens: overrides.totalCompletionTokens || 0,
    totalTokens: overrides.totalTokens || 0,
    averageTokens: overrides.averageTokens || 1000,
    totalCostUsd: overrides.totalCostUsd || 0,
    averageCostUsd: overrides.averageCostUsd || 0,
    retryCount: overrides.retryCount || 0,
    modelSwitchCount: overrides.modelSwitchCount || 0,
    tierEscalationCount: overrides.tierEscalationCount || 0,
    toolCalls: overrides.toolCalls || 10,
    toolFailureRate: overrides.toolFailureRate || 0,
    errorCounts: overrides.errorCounts || {},
    rootErrorCategoryCounts: overrides.rootErrorCategoryCounts || {
      RATE_LIMIT: 0,
      SERVER_ERROR: 0,
      TIMEOUT: 0,
      TOOL_CALLING_FAILURE: 0,
      CONTEXT_FAILURE: 0,
      EMPTY_RESPONSE: 0,
      INVALID_RESPONSE: 0,
      AUTH_FAILURE: 0,
      UNKNOWN: 0,
    },
  };
}

describe('P4.3 Routing Calibration & Empirical Model Policy', () => {
  describe('A & B: Small Sample Protection & Bayesian Shrinkage', () => {
    it('A: Model with 1 win / 1 attempt does NOT outscore a consolidated model with 20/25 wins', () => {
      const modelSmall = createMockModelMetrics({
        model: 'one-hit-wonder:free',
        totalAttempts: 1,
        completedAttempts: 1,
        winCount: 1,
        winRate: 100,
        successRate: 100,
      });

      const modelConsolidated = createMockModelMetrics({
        model: 'workhorse:free',
        totalAttempts: 25,
        completedAttempts: 20,
        winCount: 20,
        winRate: 80,
        successRate: 80,
      });

      const scoreSmall = calculateModelCalibrationScore(modelSmall, 'coding', { minSampleSize: 10 });
      const scoreConsolidated = calculateModelCalibrationScore(modelConsolidated, 'coding', { minSampleSize: 10 });

      expect(scoreSmall.recommendation).toBe('insufficient_data');
      expect(scoreConsolidated.recommendation).toBe('preferred');
      expect(scoreConsolidated.score).toBeGreaterThan(scoreSmall.score);
    });

    it('B: Model with 20/25 attempts outperforms model with 2/2 attempts', () => {
      const model2of2 = createMockModelMetrics({
        model: 'model-2-samples:free',
        totalAttempts: 2,
        winCount: 2,
        winRate: 100,
      });

      const model20of25 = createMockModelMetrics({
        model: 'model-25-samples:free',
        totalAttempts: 25,
        winCount: 20,
        winRate: 80,
      });

      const score2of2 = calculateModelCalibrationScore(model2of2, 'coding');
      const score20of25 = calculateModelCalibrationScore(model20of25, 'coding');

      expect(score20of25.score).toBeGreaterThan(score2of2.score);
    });
  });

  describe('C & D: Tool Failure & Extreme Latency Penalties', () => {
    it('C: Tool failure rate significantly reduces calibration score', () => {
      const modelClean = createMockModelMetrics({
        model: 'clean-tool-model:free',
        totalAttempts: 20,
        winCount: 16,
        toolFailureRate: 0,
      });

      const modelBrokenTools = createMockModelMetrics({
        model: 'broken-tool-model:free',
        totalAttempts: 20,
        winCount: 16,
        toolFailureRate: 60, // 60% tool failure
      });

      const scoreClean = calculateModelCalibrationScore(modelClean, 'coding');
      const scoreBroken = calculateModelCalibrationScore(modelBrokenTools, 'coding');

      expect(scoreClean.score).toBeGreaterThan(scoreBroken.score);
      expect(scoreClean.recommendation).toBe('preferred');
      expect(scoreBroken.recommendation).toBe('deprioritize');
    });

    it('D: Extreme latency penalizes calibration score', () => {
      const modelFast = createMockModelMetrics({
        model: 'fast-model:free',
        totalAttempts: 20,
        winCount: 16,
        averageDurationMs: 15000,
      });

      const modelSlow = createMockModelMetrics({
        model: 'slow-model:free',
        totalAttempts: 20,
        winCount: 16,
        averageDurationMs: 90000, // 90s average latency
      });

      const scoreFast = calculateModelCalibrationScore(modelFast, 'coding', { targetDurationMs: 20000 });
      const scoreSlow = calculateModelCalibrationScore(modelSlow, 'coding', { targetDurationMs: 20000 });

      expect(scoreFast.score).toBeGreaterThan(scoreSlow.score);
    });
  });

  describe('E & F & G & H: Profile Separation & Cost Boundaries', () => {
    it('E: Calibration never promotes a paid model over free tier', () => {
      const originalTier1 = ['model-a:free', 'model-b:free'];
      const mockReport: SystemObservabilityReport = {
        modelRankingsGlobal: [
          createMockModelMetrics({ model: 'openai/gpt-4o-mini', tier: 3, totalAttempts: 100, winCount: 95 }),
          createMockModelMetrics({ model: 'model-b:free', tier: 1, totalAttempts: 30, winCount: 25 }),
          createMockModelMetrics({ model: 'model-a:free', tier: 1, totalAttempts: 30, winCount: 15 }),
        ],
        profileBreakdown: {} as any,
      } as any;

      const reordered = reorderTier1ModelsWithCalibration(originalTier1, 'coding', mockReport, { enabled: true });

      expect(reordered).toEqual(['model-b:free', 'model-a:free']);
      expect(reordered).not.toContain('openai/gpt-4o-mini');
    });

    it('F & G: Profiles maintain independent rankings', () => {
      const originalTier1 = ['model-coding-best:free', 'model-reasoning-best:free'];
      const mockReport: SystemObservabilityReport = {
        modelRankingsGlobal: [],
        profileBreakdown: {
          coding: {
            modelRankings: [
              createMockModelMetrics({ model: 'model-coding-best:free', totalAttempts: 20, winCount: 18 }),
              createMockModelMetrics({ model: 'model-reasoning-best:free', totalAttempts: 20, winCount: 8 }),
            ],
          } as any,
          reasoning: {
            modelRankings: [
              createMockModelMetrics({ model: 'model-reasoning-best:free', totalAttempts: 20, winCount: 19 }),
              createMockModelMetrics({ model: 'model-coding-best:free', totalAttempts: 20, winCount: 5 }),
            ],
          } as any,
        } as any,
      } as any;

      const codingOrder = reorderTier1ModelsWithCalibration(originalTier1, 'coding', mockReport, { enabled: true });
      const reasoningOrder = reorderTier1ModelsWithCalibration(originalTier1, 'reasoning', mockReport, { enabled: true });

      expect(codingOrder).toEqual(['model-coding-best:free', 'model-reasoning-best:free']);
      expect(reasoningOrder).toEqual(['model-reasoning-best:free', 'model-coding-best:free']);
    });

    it('H: Insufficient data yields recommendation="insufficient_data"', () => {
      const metric = createMockModelMetrics({ model: 'rare:free', totalAttempts: 3, winCount: 3 });
      const cal = calculateModelCalibrationScore(metric, 'coding', { minSampleSize: 10 });
      expect(cal.recommendation).toBe('insufficient_data');
    });
  });

  describe('I & J & K & L & P: Safe Invariants & Disabled State', () => {
    it('I: Calibration disabled strictly preserves original static order', () => {
      const originalTier1 = ['model-static-1:free', 'model-static-2:free'];
      const mockReport: SystemObservabilityReport = {
        modelRankingsGlobal: [
          createMockModelMetrics({ model: 'model-static-2:free', totalAttempts: 50, winCount: 50 }),
        ],
        profileBreakdown: {} as any,
      } as any;

      const reordered = reorderTier1ModelsWithCalibration(originalTier1, 'coding', mockReport, { enabled: false });
      expect(reordered).toEqual(originalTier1);
    });

    it('J & O: Models without valid name or unknown error traces are ignored', () => {
      const originalTier1 = ['valid-model:free'];
      const mockReport: SystemObservabilityReport = {
        modelRankingsGlobal: [
          createMockModelMetrics({ model: 'unknown', totalAttempts: 500, winCount: 0 }),
        ],
        profileBreakdown: {} as any,
      } as any;

      const reordered = reorderTier1ModelsWithCalibration(originalTier1, 'coding', mockReport, { enabled: true });
      expect(reordered).toEqual(['valid-model:free']);
    });

    it('K & L & P: Tier 2 remains safety net and Tier 3 remains guarded', () => {
      const policy = buildRoutingPolicy(
        { objective: 'Build complex backend api' },
        {
          OPENROUTER_CALIBRATION_ENABLED: 'true',
          OPENROUTER_PAID_FALLBACK_ENABLED: 'false', // STRICTLY FALSE
          OPENROUTER_FREE_POOL_ENABLED: 'true',
        }
      );

      const mockReport: SystemObservabilityReport = {
        modelRankingsGlobal: [
          createMockModelMetrics({ model: 'openai/gpt-4o-mini', tier: 3, totalAttempts: 100, winCount: 100 }),
        ],
        profileBreakdown: {} as any,
      } as any;

      const candidates = resolveCandidateModels(policy, undefined, {
        OPENROUTER_CALIBRATION_ENABLED: 'true',
        OPENROUTER_PAID_FALLBACK_ENABLED: 'false',
      }, mockReport);

      const tier2 = candidates.find(c => c.tier === 2);
      const tier3 = candidates.find(c => c.tier === 3);

      expect(tier2?.model).toBe('openrouter/free');
      expect(tier3).toBeUndefined(); // Paid fallback blocked
    });
  });

  describe('M & N: Determinism and Tie-breaking', () => {
    it('M: Identical input yields identical calibrated score and order', () => {
      const metric = createMockModelMetrics({ model: 'det:free', totalAttempts: 15, winCount: 12 });
      const res1 = calculateModelCalibrationScore(metric, 'coding');
      const res2 = calculateModelCalibrationScore(metric, 'coding');
      expect(res1).toEqual(res2);
    });

    it('N: Tie-break preserves original static order deterministically', () => {
      const originalTier1 = ['tie-a:free', 'tie-b:free'];
      const mockReport: SystemObservabilityReport = {
        modelRankingsGlobal: [
          createMockModelMetrics({ model: 'tie-a:free', totalAttempts: 20, winCount: 15 }),
          createMockModelMetrics({ model: 'tie-b:free', totalAttempts: 20, winCount: 15 }),
        ],
        profileBreakdown: {} as any,
      } as any;

      const reordered = reorderTier1ModelsWithCalibration(originalTier1, 'coding', mockReport, { enabled: true });
      expect(reordered).toEqual(['tie-a:free', 'tie-b:free']);
    });
  });
});

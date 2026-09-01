// tests/routing-observability.test.ts
import { describe, it, expect } from 'vitest';
import {
  summarizeTaskTrace,
  aggregateObservabilityMetrics,
  classifyRootError,
  type RootErrorCategory,
} from '../src/routing/index.js';
import type { Task } from '../src/domain.js';

describe('P4.2 Routing Observability & Shadow Metrics', () => {
  describe('A & B & C & D: Model and Profile Aggregation & Rates', () => {
    it('aggregates metrics per model and profile with success & win rates', () => {
      const mockTasks: Partial<Task>[] = [
        {
          id: 'task-1',
          status: 'COMPLETED',
          result: {
            trace: {
              totalDurationMs: 12000,
              totalAttempts: 1,
              providerChainLength: 1,
              winningAttempt: 0,
              finalStatus: 'COMPLETED',
              attempts: [
                {
                  attempt: 0,
                  provider: 'openrouter',
                  model: 'minimax/minimax-m2.7:free',
                  tier: 1,
                  profile: 'coding',
                  status: 'COMPLETED',
                  retryable: false,
                  retryReason: null,
                  httpStatus: 200,
                  errorCode: null,
                  errorMessage: null,
                  toolCalls: 4,
                  toolRounds: 4,
                  durationMs: 12000,
                  exitCode: 0,
                  attemptTimeoutMs: 60000,
                  isWinner: true,
                  workspaceCreated: true,
                  workspaceCleaned: false,
                  promptTokens: 1000,
                  completionTokens: 250,
                  totalTokens: 1250,
                  costUsd: 0,
                },
              ],
            } as any,
          },
        },
        {
          id: 'task-2',
          status: 'COMPLETED',
          result: {
            trace: {
              totalDurationMs: 18000,
              totalAttempts: 2,
              providerChainLength: 2,
              winningAttempt: 1,
              finalStatus: 'COMPLETED',
              attempts: [
                {
                  attempt: 0,
                  provider: 'openrouter',
                  model: 'minimax/minimax-m2.7:free',
                  tier: 1,
                  profile: 'coding',
                  status: 'ROUTER_HTTP_ERROR',
                  retryable: true,
                  retryReason: '429 Rate Limit',
                  httpStatus: 429,
                  errorCode: 'RATE_LIMIT',
                  errorMessage: 'Too many requests',
                  toolCalls: 0,
                  toolRounds: 0,
                  durationMs: 3000,
                  exitCode: 429,
                  attemptTimeoutMs: 60000,
                  isWinner: false,
                  workspaceCreated: true,
                  workspaceCleaned: true,
                  promptTokens: 0,
                  completionTokens: 0,
                  totalTokens: 0,
                  costUsd: 0,
                },
                {
                  attempt: 1,
                  provider: 'openrouter',
                  model: 'cohere/north-mini-code:free',
                  tier: 1,
                  profile: 'coding',
                  fallbackType: 'model_switch',
                  status: 'COMPLETED',
                  retryable: false,
                  retryReason: null,
                  httpStatus: 200,
                  errorCode: null,
                  errorMessage: null,
                  toolCalls: 6,
                  toolRounds: 6,
                  durationMs: 15000,
                  exitCode: 0,
                  attemptTimeoutMs: 60000,
                  isWinner: true,
                  workspaceCreated: true,
                  workspaceCleaned: false,
                  promptTokens: 1400,
                  completionTokens: 300,
                  totalTokens: 1700,
                  costUsd: 0,
                },
              ],
            } as any,
          },
        },
      ];

      const report = aggregateObservabilityMetrics(mockTasks);

      expect(report.totalTasksAnalyzed).toBe(2);
      expect(report.totalCompletedTasks).toBe(2);
      expect(report.globalSuccessRate).toBe(100);

      // Model Metrics
      const minimax = report.modelRankingsGlobal.find(m => m.model === 'minimax/minimax-m2.7:free');
      expect(minimax).toBeDefined();
      expect(minimax?.totalAttempts).toBe(2);
      expect(minimax?.completedAttempts).toBe(1);
      expect(minimax?.winCount).toBe(1);
      expect(minimax?.successRate).toBe(50);
      expect(minimax?.winRate).toBe(50);

      const cohere = report.modelRankingsGlobal.find(m => m.model === 'cohere/north-mini-code:free');
      expect(cohere).toBeDefined();
      expect(cohere?.totalAttempts).toBe(1);
      expect(cohere?.completedAttempts).toBe(1);
      expect(cohere?.winCount).toBe(1);
      expect(cohere?.successRate).toBe(100);
      expect(cohere?.winRate).toBe(100);

      // Profile Metrics
      const codingProf = report.profileBreakdown.coding;
      expect(codingProf.totalTasks).toBe(2);
      expect(codingProf.completedTasks).toBe(2);
      expect(codingProf.successRate).toBe(100);
    });
  });

  describe('E & F & G: Average Duration, Token Sums and Cost Sums', () => {
    it('calculates average durations, token sums and exact cost totals', () => {
      const mockTask: Partial<Task> = {
        id: 'task-paid-1',
        status: 'COMPLETED',
        result: {
          trace: {
            totalDurationMs: 25000,
            winningAttempt: 0,
            attempts: [
              {
                attempt: 0,
                provider: 'openrouter',
                model: 'openai/gpt-4o-mini',
                tier: 3,
                profile: 'reasoning',
                status: 'COMPLETED',
                durationMs: 25000,
                isWinner: true,
                promptTokens: 2000,
                completionTokens: 500,
                totalTokens: 2500,
                costUsd: 0.00045,
              } as any,
            ],
          } as any,
        },
      };

      const summary = summarizeTaskTrace(mockTask);
      expect(summary.totalDurationMs).toBe(25000);
      expect(summary.totalPromptTokens).toBe(2000);
      expect(summary.totalCompletionTokens).toBe(500);
      expect(summary.totalTokens).toBe(2500);
      expect(summary.totalCostUsd).toBe(0.00045);
      expect(summary.winner?.costUsd).toBe(0.00045);
      expect(summary.winner?.model).toBe('openai/gpt-4o-mini');
    });
  });

  describe('H & I & J: Fallback Classification Counts (retry, model_switch, tier_escalation)', () => {
    it('correctly tracks retry, model_switch and tier_escalation counts', () => {
      const mockTask: Partial<Task> = {
        id: 'task-fallback-chain',
        status: 'COMPLETED',
        result: {
          trace: {
            totalDurationMs: 40000,
            winningAttempt: 3,
            attempts: [
              { attempt: 0, model: 'model-a:free', tier: 1, fallbackType: undefined, status: 'FAILED' },
              { attempt: 1, model: 'model-a:free', tier: 1, fallbackType: 'retry', status: 'FAILED' },
              { attempt: 2, model: 'model-b:free', tier: 1, fallbackType: 'model_switch', status: 'FAILED' },
              { attempt: 3, model: 'openrouter/free', tier: 2, fallbackType: 'tier_escalation', status: 'COMPLETED', isWinner: true },
            ] as any,
          } as any,
        },
      };

      const summary = summarizeTaskTrace(mockTask);
      expect(summary.attempts).toBe(4);
      expect(summary.retries).toBe(1);
      expect(summary.modelSwitches).toBe(1);
      expect(summary.tierEscalations).toBe(1);
      expect(summary.winner?.model).toBe('openrouter/free');
      expect(summary.winner?.tier).toBe(2);
    });
  });

  describe('K: Root Error Category Classification', () => {
    it('classifies error codes and HTTP responses into standard categories', () => {
      expect(classifyRootError(429)).toBe('RATE_LIMIT');
      expect(classifyRootError(undefined, 'RATE_LIMIT')).toBe('RATE_LIMIT');
      expect(classifyRootError(undefined, null, 'Rate limit exceeded for model')).toBe('RATE_LIMIT');

      expect(classifyRootError(500)).toBe('SERVER_ERROR');
      expect(classifyRootError(503)).toBe('SERVER_ERROR');

      expect(classifyRootError(408)).toBe('TIMEOUT');
      expect(classifyRootError(undefined, 'ROUTER_TIMEOUT')).toBe('TIMEOUT');

      expect(classifyRootError(400, 'CAPABILITY_ERROR', 'Nvidia does not support tool-message format')).toBe('TOOL_CALLING_FAILURE');
      expect(classifyRootError(undefined, 'TOOL_LOOP_LIMIT')).toBe('TOOL_CALLING_FAILURE');

      expect(classifyRootError(undefined, null, 'Maximum context length exceeded')).toBe('CONTEXT_FAILURE');
      expect(classifyRootError(undefined, 'EMPTY_RESPONSE')).toBe('EMPTY_RESPONSE');
      expect(classifyRootError(undefined, 'INVALID_RESPONSE')).toBe('INVALID_RESPONSE');
      expect(classifyRootError(401)).toBe('AUTH_FAILURE');
      expect(classifyRootError(undefined, 'SOME_UNKNOWN_CODE', 'unexpected error')).toBe('UNKNOWN');
    });
  });

  describe('L & M & N & O: Multi-Tier Evolution Scenarios', () => {
    it('handles single-attempt task gracefully (L)', () => {
      const task: Partial<Task> = {
        id: 'single-1',
        status: 'COMPLETED',
        result: { model: 'minimax/minimax-m2.7:free', durationMs: 4000 } as any,
      };
      const summary = summarizeTaskTrace(task);
      expect(summary.attempts).toBe(1);
      expect(summary.retries).toBe(0);
      expect(summary.modelSwitches).toBe(0);
      expect(summary.tierEscalations).toBe(0);
    });

    it('handles Tier 1 -> Tier 2 -> Tier 3 multi-tier escalation (O)', () => {
      const mockTask: Partial<Task> = {
        id: 'multi-tier-task',
        status: 'COMPLETED',
        result: {
          trace: {
            winningAttempt: 2,
            attempts: [
              { attempt: 0, model: 'minimax/minimax-m2.7:free', tier: 1, status: 'FAILED' },
              { attempt: 1, model: 'openrouter/free', tier: 2, fallbackType: 'tier_escalation', status: 'FAILED' },
              { attempt: 2, model: 'openai/gpt-4o-mini', tier: 3, fallbackType: 'tier_escalation', status: 'COMPLETED', isWinner: true, costUsd: 0.0002, totalTokens: 850 },
            ] as any,
          } as any,
        },
      };

      const report = aggregateObservabilityMetrics([mockTask]);
      expect(report.tierBreakdown.tier1Attempts).toBe(1);
      expect(report.tierBreakdown.tier2Attempts).toBe(1);
      expect(report.tierBreakdown.tier3Attempts).toBe(1);
      expect(report.tierBreakdown.tier3Wins).toBe(1);
      expect(report.totalCostUsd).toBe(0.0002);
      expect(report.totalTokens).toBe(850);
    });
  });

  describe('P: Absence of Usage and Cost Without Crash', () => {
    it('tolerates missing tokens/cost fields safely', () => {
      const mockTask: Partial<Task> = {
        id: 'no-tokens-task',
        status: 'COMPLETED',
        result: {
          trace: {
            winningAttempt: 0,
            attempts: [
              {
                attempt: 0,
                provider: 'openrouter',
                model: 'minimax/minimax-m2.7:free',
                tier: 1,
                status: 'COMPLETED',
                isWinner: true,
                durationMs: 5000,
              } as any,
            ],
          } as any,
        },
      };

      const summary = summarizeTaskTrace(mockTask);
      expect(summary.totalPromptTokens).toBe(0);
      expect(summary.totalCompletionTokens).toBe(0);
      expect(summary.totalTokens).toBe(0);
      expect(summary.totalCostUsd).toBe(0);
      expect(summary.winner?.totalTokens).toBe(0);
      expect(summary.winner?.costUsd).toBe(0);

      const report = aggregateObservabilityMetrics([mockTask]);
      expect(report.totalCostUsd).toBe(0);
      expect(report.totalTokens).toBe(0);
    });
  });
});

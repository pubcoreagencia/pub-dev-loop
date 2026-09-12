// tests/model-routing-policy.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import {
  NINE_ROUTER_FREE_MODELS,
  OPENROUTER_FREE_MODELS,
  getModelRegistryEntry,
  getRegisteredModels,
  type ModelRegistryEntry,
} from '../src/providers/model-registry.js';
import {
  ModelHealthTracker,
  classifyFailure,
  filterCapableModelsForTask,
  rankCandidateModels,
  resolveModelQueue,
} from '../src/providers/model-routing-policy.js';

describe('Model Routing Policy & Registry (Cases A through M)', () => {
  let tracker: ModelHealthTracker;

  beforeEach(() => {
    tracker = new ModelHealthTracker();
  });

  // CASE A: BEST_FREE healthy -> selects BEST
  it('Case A: BEST_FREE healthy -> selects BEST', () => {
    const queue9 = resolveModelQueue('9router', undefined, { healthTracker: tracker });
    expect(queue9.primaryModel).toBe('gemini/gemini-3.7-flash');
    expect(queue9.candidateQueue[0]).toBe('gemini/gemini-3.7-flash');

    const queueOpen = resolveModelQueue('openrouter', undefined, { healthTracker: tracker });
    expect(queueOpen.primaryModel).toBe('cohere/north-mini-code:free');
    expect(queueOpen.candidateQueue[0]).toBe('cohere/north-mini-code:free');
  });

  // CASE B: BEST unavailable (404 / 503) -> selects #2
  it('Case B: BEST unavailable (404/503) -> selects #2', () => {
    tracker.recordFailure('9router', 'gemini/gemini-3.7-flash', 'MODEL_UNAVAILABLE', '404 model not found');
    const queue9 = resolveModelQueue('9router', undefined, { healthTracker: tracker });
    expect(queue9.primaryModel).toBe('gemini/gemini-3.6-flash');

    const traceBest = queue9.decisionTrace.find(t => t.modelId === 'gemini/gemini-3.7-flash');
    expect(traceBest?.selected).toBe(false);
    expect(traceBest?.rejectionReason).toContain('CIRCUIT_BREAKER_DISABLED');
  });

  // CASE C: BEST rate limited (429) -> enters COOLDOWN, selects #2
  it('Case C: BEST rate limited -> selects #2', () => {
    const now = 1000000;
    tracker.recordFailure('9router', 'gemini/gemini-3.7-flash', 'RATE_LIMIT', 'HTTP 429 Too Many Requests', 60000, now);

    expect(tracker.getState('9router', 'gemini/gemini-3.7-flash', now)).toBe('COOLDOWN');
    expect(tracker.isAvailable('9router', 'gemini/gemini-3.7-flash', now)).toBe(false);

    const queue = resolveModelQueue('9router', undefined, { healthTracker: tracker, now });
    expect(queue.primaryModel).toBe('gemini/gemini-3.6-flash');

    const traceBest = queue.decisionTrace.find(t => t.modelId === 'gemini/gemini-3.7-flash');
    expect(traceBest?.selected).toBe(false);
    expect(traceBest?.rejectionReason).toBe('CIRCUIT_BREAKER_COOLDOWN');
  });

  // CASE D: BEST timeout -> selects #2
  it('Case D: BEST timeout -> selects #2', () => {
    const now = 1000000;
    // Two consecutive timeouts place model in cooldown
    tracker.recordFailure('9router', 'gemini/gemini-3.7-flash', 'TIMEOUT', 'Router timeout', 60000, now);
    tracker.recordFailure('9router', 'gemini/gemini-3.7-flash', 'TIMEOUT', 'Router timeout', 60000, now);

    expect(tracker.getState('9router', 'gemini/gemini-3.7-flash', now)).toBe('COOLDOWN');
    const queue = resolveModelQueue('9router', undefined, { healthTracker: tracker, now });
    expect(queue.primaryModel).toBe('gemini/gemini-3.6-flash');
  });

  // CASE E: BEST without tool support -> discarded, selects #2
  it('Case E: Model lacking tool calling support is discarded by capability filter', () => {
    const syntheticModels: ModelRegistryEntry[] = [
      {
        provider: '9router',
        modelId: 'synthetic/best-text-only',
        tier: 'BEST_FREE',
        priority: 1,
        capabilities: ['coding', 'reasoning'],
        supportsTools: false, // NO tool support!
        supportsStructuredOutput: false,
        supportsLongContext: true,
        contextWindow: 1048576,
        codingScore: 99,
        reasoningScore: 99,
        reliabilityScore: 99,
        enabled: true,
        cooldownMs: 60000,
        maxRetries: 2,
        notes: 'Text only model',
      },
      {
        provider: '9router',
        modelId: 'synthetic/second-best-with-tools',
        tier: 'FALLBACK_2',
        priority: 2,
        capabilities: ['coding', 'agent', 'tool_calling'],
        supportsTools: true,
        supportsStructuredOutput: false,
        supportsLongContext: true,
        contextWindow: 1048576,
        codingScore: 90,
        reasoningScore: 90,
        reliabilityScore: 90,
        enabled: true,
        cooldownMs: 60000,
        maxRetries: 2,
        notes: 'Tool-capable model',
      },
    ];

    const { capable, rejected } = filterCapableModelsForTask(syntheticModels, { requireTools: true });
    expect(capable.length).toBe(1);
    expect(capable[0].modelId).toBe('synthetic/second-best-with-tools');
    expect(rejected[0].model.modelId).toBe('synthetic/best-text-only');
    expect(rejected[0].reason).toBe('LACKS_TOOL_CALLING_SUPPORT');
  });

  // CASE F: Protocol failure -> does NOT mask as model failure
  it('Case F: Protocol failure is classified as TOOL_PROTOCOL_FAILURE and not masked as model failure', () => {
    const errorMsg = 'HTTP 400: Requests ending with a model turn are not supported.';
    const failureType = classifyFailure(400, errorMsg);

    expect(failureType).toBe('TOOL_PROTOCOL_FAILURE');

    // Health tracker should NOT disable or cooldown the model for protocol formatting failures
    tracker.recordFailure('9router', 'gemini/gemini-3.7-flash', failureType, errorMsg);
    expect(tracker.getState('9router', 'gemini/gemini-3.7-flash')).not.toBe('DISABLED');
    expect(tracker.getState('9router', 'gemini/gemini-3.7-flash')).not.toBe('COOLDOWN');
    expect(tracker.isAvailable('9router', 'gemini/gemini-3.7-flash')).toBe(true);

    const record = tracker.getRecord('9router', 'gemini/gemini-3.7-flash');
    expect(record?.protocolFailureTrace).toBe(errorMsg);
  });

  // CASE G: All fail -> fail-closed audit trail
  it('Case G: All models fail -> returns empty queue with fail-closed audit trail', () => {
    const models = getRegisteredModels('9router');
    for (const m of models) {
      tracker.recordFailure('9router', m.modelId, 'AUTH_FAILURE', 'Key revoked');
    }

    const queue = resolveModelQueue('9router', undefined, { healthTracker: tracker, allowEmergency: true });
    expect(queue.candidateQueue.length).toBe(0);
    expect(queue.primaryModel).toBe('');
    expect(queue.decisionTrace.every(t => !t.selected)).toBe(true);
  });

  // CASE H: Cooldown prevents immediate retry
  it('Case H: Cooldown prevents immediate retry of failed model', () => {
    const now = 1000000;
    tracker.recordFailure('9router', 'gemini/gemini-3.7-flash', 'RATE_LIMIT', '429', 60000, now);

    // After 10 seconds, model is STILL in cooldown
    expect(tracker.isAvailable('9router', 'gemini/gemini-3.7-flash', now + 10000)).toBe(false);
    expect(tracker.getState('9router', 'gemini/gemini-3.7-flash', now + 10000)).toBe('COOLDOWN');

    const queue = resolveModelQueue('9router', undefined, { healthTracker: tracker, now: now + 10000 });
    expect(queue.candidateQueue).not.toContain('gemini/gemini-3.7-flash');
  });

  // CASE I: Recovery clears cooldown
  it('Case I: Recovery clears cooldown after expiry or explicit success', () => {
    const now = 1000000;
    tracker.recordFailure('9router', 'gemini/gemini-3.7-flash', 'RATE_LIMIT', '429', 60000, now);

    // After 61 seconds (cooldown expired)
    expect(tracker.isAvailable('9router', 'gemini/gemini-3.7-flash', now + 61000)).toBe(true);
    expect(tracker.getState('9router', 'gemini/gemini-3.7-flash', now + 61000)).toBe('HEALTHY');

    // Or explicit success resets state immediately
    tracker.recordFailure('9router', 'gemini/gemini-3.6-flash', 'RATE_LIMIT', '429', 60000, now);
    expect(tracker.isAvailable('9router', 'gemini/gemini-3.6-flash', now)).toBe(false);
    tracker.recordSuccess('9router', 'gemini/gemini-3.6-flash');
    expect(tracker.isAvailable('9router', 'gemini/gemini-3.6-flash', now)).toBe(true);
    expect(tracker.getState('9router', 'gemini/gemini-3.6-flash', now)).toBe('HEALTHY');
  });

  // CASE J: openrouter/free only used when allowed as EMERGENCY
  it('Case J: Emergency models are not placed in standard queue unless explicitly allowed or required', () => {
    // Standard resolution without emergency
    const queueNormal = resolveModelQueue('openrouter', undefined, { healthTracker: tracker, allowEmergency: false });
    expect(queueNormal.candidateQueue).not.toContain('openrouter/free');
    expect(queueNormal.primaryModel).toBe('cohere/north-mini-code:free');

    // Resolution with emergency allowed
    const queueEmergency = resolveModelQueue('openrouter', undefined, { healthTracker: tracker, allowEmergency: true });
    expect(queueEmergency.candidateQueue).toContain('openrouter/free');
    // But it must be at the tail as emergency fallback, not primary!
    expect(queueEmergency.primaryModel).toBe('cohere/north-mini-code:free');
    expect(queueEmergency.candidateQueue[queueEmergency.candidateQueue.length - 1]).toBe('openrouter/free');
  });

  // CASE K: 9Router and OpenRouter have independent chains
  it('Case K: 9Router and OpenRouter have strictly independent candidate chains', () => {
    const queue9 = resolveModelQueue('9router', undefined, { healthTracker: tracker });
    const queueOpen = resolveModelQueue('openrouter', undefined, { healthTracker: tracker });

    for (const m of queue9.candidateQueue) {
      expect(queueOpen.candidateQueue).not.toContain(m);
    }
    for (const m of queueOpen.candidateQueue) {
      expect(queue9.candidateQueue).not.toContain(m);
    }
  });

  // CASE L: Fallback between providers only occurs when explicitly authorized
  it('Case L: Cross-provider fallback only occurs when explicitly authorized', () => {
    // Disable all 9Router models
    for (const m of getRegisteredModels('9router')) {
      tracker.recordFailure('9router', m.modelId, 'AUTH_FAILURE', 'Outage');
    }

    // Default: cross-provider fallback false
    const queueWithoutCross = resolveModelQueue('9router', undefined, {
      healthTracker: tracker,
      allowCrossProviderFallback: false,
    });
    expect(queueWithoutCross.candidateQueue.length).toBe(0);

    // With cross-provider fallback explicitly authorized
    const queueWithCross = resolveModelQueue('9router', undefined, {
      healthTracker: tracker,
      allowCrossProviderFallback: true,
    });
    expect(queueWithCross.candidateQueue.length).toBeGreaterThan(0);
    expect(queueWithCross.primaryModel).toBe('cohere/north-mini-code:free');
  });

  // CASE M: Decision trace telemetry recorded in result
  it('Case M: Decision trace telemetry records complete evaluation chain', () => {
    tracker.recordFailure('9router', 'gemini/gemini-3.7-flash', 'RATE_LIMIT', '429', 60000);
    const queue = resolveModelQueue('9router', undefined, { healthTracker: tracker, allowEmergency: true });

    expect(queue.decisionTrace.length).toBeGreaterThan(0);

    const bestTrace = queue.decisionTrace.find(t => t.modelId === 'gemini/gemini-3.7-flash');
    expect(bestTrace).toBeDefined();
    expect(bestTrace?.selected).toBe(false);
    expect(bestTrace?.rejectionReason).toBe('CIRCUIT_BREAKER_COOLDOWN');
    expect(bestTrace?.priority).toBe(1);

    const winnerTrace = queue.decisionTrace.find(t => t.modelId === 'gemini/gemini-3.6-flash');
    expect(winnerTrace).toBeDefined();
    expect(winnerTrace?.selected).toBe(true);
    expect(winnerTrace?.role).toBe('primary');

    const fallbackTrace = queue.decisionTrace.find(t => t.modelId === 'gemini/gemini-3.5-flash-lite');
    expect(fallbackTrace?.selected).toBe(true);
    expect(fallbackTrace?.role).toBe('fallback');
  });
});

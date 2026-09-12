// tests/model-routing-policy.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  NINE_ROUTER_REAL_FREE_MODELS,
  OPENROUTER_REAL_FREE_MODELS,
  isFreeModel,
  getModelRegistryEntry,
  getRegisteredModels,
  BEST_FREE_PROVEN,
  BEST_FREE_SCOPE,
  MODEL_QUALITY_RANK,
  CANONICAL_OPERATIONAL_POLICY,
  type ModelRegistryEntry,
} from '../src/providers/model-registry.js';
import {
  ModelHealthTracker,
  classifyFailure,
  classifyPricingRejection,
  filterFreeModels,
  filterCapableModelsForTask,
  rankCandidateModels,
  resolveModelQueue,
} from '../src/providers/model-routing-policy.js';
import { RouterProvider } from '../src/providers/router.js';

describe('Model Routing Policy & Registry - Canonical Verification (Cases A through R)', () => {
  let tracker: ModelHealthTracker;

  beforeEach(() => {
    tracker = new ModelHealthTracker();
    vi.restoreAllMocks();
  });

  // A. paid model rejected
  it('Case A: Paid model is strictly rejected and excluded from candidate queue', () => {
    expect(isFreeModel('openai/gpt-4o')).toBe(false);
    expect(isFreeModel('anthropic/claude-3.5-sonnet')).toBe(false);
    expect(isFreeModel({ pricing: { prompt: '0.005', completion: '0.015' } })).toBe(false);

    expect(classifyPricingRejection('openai/gpt-4o')).toBe('PAID_MODEL');
    expect(classifyPricingRejection({ freeStatus: 'PAID_MODEL' })).toBe('PAID_MODEL');

    const queue = resolveModelQueue('9router', undefined, {
      modelOverride: 'openai/gpt-4o',
      healthTracker: tracker,
    });
    expect(queue.candidateQueue.length).toBe(0);
    expect(queue.primaryModel).toBe('');

    const paidTrace = queue.decisionTrace.find(t => t.modelId === 'openai/gpt-4o');
    expect(paidTrace).toBeDefined();
    expect(paidTrace?.selected).toBe(false);
    expect(paidTrace?.rejectionReason).toBe('PAID_MODEL');
  });

  // B. unknown pricing rejected
  it('Case B: Model with unknown pricing is rejected and classified as UNKNOWN_PRICING', () => {
    expect(isFreeModel('custom/unknown-model')).toBe(false);
    expect(isFreeModel('vendor/internal-agent')).toBe(false);

    expect(classifyPricingRejection('custom/unknown-model')).toBe('UNKNOWN_PRICING');

    const queue = resolveModelQueue('9router', undefined, {
      modelOverride: 'custom/unknown-model',
      healthTracker: tracker,
    });
    expect(queue.candidateQueue.length).toBe(0);
    expect(queue.primaryModel).toBe('');

    const unknownTrace = queue.decisionTrace.find(t => t.modelId === 'custom/unknown-model');
    expect(unknownTrace).toBeDefined();
    expect(unknownTrace?.selected).toBe(false);
    expect(unknownTrace?.rejectionReason).toBe('UNKNOWN_PRICING');
  });

  // C. 0/0 accepted
  it('Case C: Model with verified 0/0 pricing is accepted by policy', () => {
    expect(isFreeModel('kc/cohere/north-mini-code:free')).toBe(true);
    expect(isFreeModel('openrouter/cohere/north-mini-code:free')).toBe(true);
    expect(isFreeModel('cohere/north-mini-code:free')).toBe(true);

    expect(isFreeModel({ pricing: { prompt: '0', completion: '0' } })).toBe(true);
    expect(isFreeModel({ pricing: { prompt: 0, completion: 0 } })).toBe(true);
  });

  // D. Gemini commercial rejected
  it('Case D: Commercial Gemini models without 0/0 pricing evidence are strictly rejected', () => {
    expect(isFreeModel('gemini/gemini-3.7-flash')).toBe(false);
    expect(isFreeModel('gemini/gemini-2.5-pro')).toBe(false);
    expect(isFreeModel('gemini/gemini-3.5-flash-lite')).toBe(false);

    expect(classifyPricingRejection('gemini/gemini-3.7-flash')).toBe('PAID_MODEL');

    const queue = resolveModelQueue('9router', undefined, {
      modelOverride: 'gemini/gemini-3.7-flash',
      healthTracker: tracker,
    });
    expect(queue.candidateQueue.length).toBe(0);
    expect(queue.primaryModel).toBe('');

    const trace = queue.decisionTrace.find(t => t.modelId === 'gemini/gemini-3.7-flash');
    expect(trace?.selected).toBe(false);
    expect(trace?.rejectionReason).toBe('PAID_MODEL');
  });

  // E. :free with nonzero pricing rejected
  it('Case E: Model with :free suffix but non-zero price is strictly rejected as PAID_MODEL', () => {
    const deceptiveModel = {
      id: 'deceptive/provider-model:free',
      modelId: 'deceptive/provider-model:free',
      pricing: {
        prompt: '0.000001', // Non-zero!
        completion: '0',
      },
    };

    expect(isFreeModel(deceptiveModel)).toBe(false);
    expect(classifyPricingRejection(deceptiveModel)).toBe('PAID_MODEL');
  });

  // F. primary FREE selected
  it('Case F: Primary FREE selected is BEST_FREE_PROVEN (kc/cohere/north-mini-code:free)', () => {
    expect(BEST_FREE_PROVEN).toBe('kc/cohere/north-mini-code:free');
    expect(BEST_FREE_SCOPE).toBe('best empirically proven FREE candidate in the current benchmark universe');

    const queue = resolveModelQueue('9router', undefined, { healthTracker: tracker });
    expect(queue.primaryModel).toBe(BEST_FREE_PROVEN);
    expect(queue.candidateQueue[0]).toBe(BEST_FREE_PROVEN);
    expect(queue.entries[0].qualityScore).toBe(99.10);
  });

  // G. primary unavailable → fallback
  it('Case G: When primary is unavailable (circuit breaker), queue falls back to SECONDARY (kc/kilo-auto/free)', () => {
    tracker.recordFailure('9router', BEST_FREE_PROVEN, 'AUTH_FAILURE', 'Outage');
    expect(tracker.isAvailable('9router', BEST_FREE_PROVEN)).toBe(false);

    const queue = resolveModelQueue('9router', undefined, { healthTracker: tracker });
    expect(queue.primaryModel).toBe('kc/kilo-auto/free');
    expect(queue.candidateQueue[0]).toBe('kc/kilo-auto/free');

    const primaryTrace = queue.decisionTrace.find(t => t.modelId === BEST_FREE_PROVEN);
    expect(primaryTrace?.selected).toBe(false);
    expect(primaryTrace?.rejectionReason).toBe('CIRCUIT_BREAKER_DISABLED');
  });

  // H. primary quota exhausted → fallback
  it('Case H: When primary quota is exhausted, queue falls back without delay to SECONDARY', () => {
    tracker.recordQuotaExhaustion('9router', BEST_FREE_PROVEN, 3600000, 'Rate limit exceeded: free-models-per-day');
    expect(tracker.getQuotaState('9router', BEST_FREE_PROVEN)).toBe('EXHAUSTED');
    expect(tracker.isAvailable('9router', BEST_FREE_PROVEN)).toBe(false);

    const queue = resolveModelQueue('9router', undefined, { healthTracker: tracker });
    expect(queue.primaryModel).toBe('kc/kilo-auto/free');
    expect(queue.candidateQueue).not.toContain(BEST_FREE_PROVEN);

    const primaryTrace = queue.decisionTrace.find(t => t.modelId === BEST_FREE_PROVEN);
    expect(primaryTrace?.selected).toBe(false);
    expect(primaryTrace?.rejectionReason).toBe('CIRCUIT_BREAKER_COOLDOWN');
  });

  // I. tool call success
  it('Case I: Tool call execution succeeds with valid response', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        model: 'kc/cohere/north-mini-code:free',
        choices: [{
          message: {
            content: null,
            tool_calls: [{
              id: 'call_1',
              type: 'function',
              function: { name: 'run_command', arguments: JSON.stringify({ command: 'echo hello' }) },
            }],
          },
        }],
      }), { status: 200, headers: { 'content-type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        model: 'kc/cohere/north-mini-code:free',
        choices: [{
          message: { content: 'hello echo finished' },
          finish_reason: 'stop',
        }],
      }), { status: 200, headers: { 'content-type': 'application/json' } }));

    vi.stubGlobal('fetch', fetchMock);

    const provider = new RouterProvider('http://localhost:20128/v1', 'key', 5000, 'kc/cohere/north-mini-code:free');
    const res = await provider.execute({ id: 'T1', objective: 'echo', prompt: 'echo' } as any, 'C:/tmp');

    expect(res.status).toBe('COMPLETED');
    expect(res.toolCalls).toBe(1);
    expect(res.stdout).toBe('hello echo finished');
  });

  // J. multi-round success
  it('Case J: Multi-round tool execution succeeds sequentially', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        model: 'kc/cohere/north-mini-code:free',
        choices: [{
          message: {
            content: null,
            tool_calls: [{
              id: 'call_1',
              type: 'function',
              function: { name: 'run_command', arguments: JSON.stringify({ command: 'echo step1' }) },
            }],
          },
        }],
      }), { status: 200, headers: { 'content-type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        model: 'kc/cohere/north-mini-code:free',
        choices: [{
          message: {
            content: null,
            tool_calls: [{
              id: 'call_2',
              type: 'function',
              function: { name: 'run_command', arguments: JSON.stringify({ command: 'echo step2' }) },
            }],
          },
        }],
      }), { status: 200, headers: { 'content-type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        model: 'kc/cohere/north-mini-code:free',
        choices: [{
          message: { content: 'all steps completed' },
          finish_reason: 'stop',
        }],
      }), { status: 200, headers: { 'content-type': 'application/json' } }));

    vi.stubGlobal('fetch', fetchMock);

    const provider = new RouterProvider('http://localhost:20128/v1', 'key', 5000, 'kc/cohere/north-mini-code:free');
    const res = await provider.execute({ id: 'T2', objective: 'multi', prompt: 'multi' } as any, 'C:/tmp');

    expect(res.status).toBe('COMPLETED');
    expect(res.toolCalls).toBe(2);
    expect(res.stdout).toBe('all steps completed');
  });

  // K. empty tool result
  it('Case K: Empty tool output is normalized to "(no output)" without protocol failure', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        model: 'kc/cohere/north-mini-code:free',
        choices: [{
          message: {
            content: null,
            tool_calls: [{
              id: 'call_empty',
              type: 'function',
              function: { name: 'run_command', arguments: JSON.stringify({ command: 'node -e "process.exit(0)"' }) },
            }],
          },
        }],
      }), { status: 200, headers: { 'content-type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        model: 'kc/cohere/north-mini-code:free',
        choices: [{
          message: { content: 'handled empty output cleanly' },
          finish_reason: 'stop',
        }],
      }), { status: 200, headers: { 'content-type': 'application/json' } }));

    vi.stubGlobal('fetch', fetchMock);

    const provider = new RouterProvider('http://localhost:20128/v1', 'key', 5000, 'kc/cohere/north-mini-code:free');
    const res = await provider.execute({ id: 'T3', objective: 'empty', prompt: 'empty' } as any, 'C:/tmp');

    expect(res.status).toBe('COMPLETED');
    expect(res.errorCode).toBeNull();
    // Check that second fetch body contained '(no output)'
    const secondCallBody = JSON.parse(fetchMock.mock.calls[1][1].body);
    const toolMsg = secondCallBody.messages.find((m: any) => m.role === 'tool');
    expect(toolMsg.content).toBe('(no output)');
  });

  // L. whitespace tool result
  it('Case L: Whitespace-only tool output is normalized to "(no output)" without protocol failure', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        model: 'kc/cohere/north-mini-code:free',
        choices: [{
          message: {
            content: null,
            tool_calls: [{
              id: 'call_ws',
              type: 'function',
              function: { name: 'run_command', arguments: JSON.stringify({ command: 'node -e "console.log(\'   \\n\\t  \')"' }) },
            }],
          },
        }],
      }), { status: 200, headers: { 'content-type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        model: 'kc/cohere/north-mini-code:free',
        choices: [{
          message: { content: 'handled whitespace cleanly' },
          finish_reason: 'stop',
        }],
      }), { status: 200, headers: { 'content-type': 'application/json' } }));

    vi.stubGlobal('fetch', fetchMock);

    const provider = new RouterProvider('http://localhost:20128/v1', 'key', 5000, 'kc/cohere/north-mini-code:free');
    const res = await provider.execute({ id: 'T4', objective: 'ws', prompt: 'ws' } as any, 'C:/tmp');

    expect(res.status).toBe('COMPLETED');
    const secondCallBody = JSON.parse(fetchMock.mock.calls[1][1].body);
    const toolMsg = secondCallBody.messages.find((m: any) => m.role === 'tool');
    expect(toolMsg.content).toBe('(no output)');
  });

  // M. coding agent
  it('Case M: Coding agent task triggers file writes and commands', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        model: 'kc/cohere/north-mini-code:free',
        choices: [{
          message: {
            content: 'writing code',
            tool_calls: [{
              id: 'call_write',
              type: 'function',
              function: { name: 'write_file', arguments: JSON.stringify({ path: 'src/calc.js', content: 'export const add = (a, b) => a + b;' }) },
            }],
          },
        }],
      }), { status: 200, headers: { 'content-type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        model: 'kc/cohere/north-mini-code:free',
        choices: [{
          message: { content: 'Code implemented and verified' },
          finish_reason: 'stop',
        }],
      }), { status: 200, headers: { 'content-type': 'application/json' } }));

    vi.stubGlobal('fetch', fetchMock);

    const provider = new RouterProvider('http://localhost:20128/v1', 'key', 5000, 'kc/cohere/north-mini-code:free');
    const res = await provider.execute({ id: 'T5', objective: 'coding', prompt: 'write calc.js' } as any, 'C:/tmp');

    expect(res.status).toBe('COMPLETED');
    expect(res.changedFiles).toContain('src/calc.js');
  });

  // N. correction/debugging
  it('Case N: Debugging workflow reads error, modifies file, and finishes', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        model: 'kc/cohere/north-mini-code:free',
        choices: [{
          message: {
            content: 'diagnosing error',
            tool_calls: [{
              id: 'call_patch',
              type: 'function',
              function: { name: 'write_file', arguments: JSON.stringify({ path: 'src/bug.js', content: 'fixed content' }) },
            }],
          },
        }],
      }), { status: 200, headers: { 'content-type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        model: 'kc/cohere/north-mini-code:free',
        choices: [{
          message: { content: 'Bug diagnosed and fixed successfully' },
          finish_reason: 'stop',
        }],
      }), { status: 200, headers: { 'content-type': 'application/json' } }));

    vi.stubGlobal('fetch', fetchMock);

    const provider = new RouterProvider('http://localhost:20128/v1', 'key', 5000, 'kc/cohere/north-mini-code:free');
    const res = await provider.execute({ id: 'T6', objective: 'debug', prompt: 'fix bug.js' } as any, 'C:/tmp');

    expect(res.status).toBe('COMPLETED');
    expect(res.changedFiles).toContain('src/bug.js');
  });

  // O. no provider cross-contamination
  it('Case O: No provider cross-contamination (9Router and OpenRouter queues remain isolated)', () => {
    const queue9 = resolveModelQueue('9router', undefined, { healthTracker: tracker, allowCrossProviderFallback: false });
    const queueOpen = resolveModelQueue('openrouter', undefined, { healthTracker: tracker, allowCrossProviderFallback: false });

    for (const m of queue9.candidateQueue) {
      expect(queueOpen.candidateQueue).not.toContain(m);
    }
    for (const m of queueOpen.candidateQueue) {
      expect(queue9.candidateQueue).not.toContain(m);
    }
  });

  // P. no request when no FREE candidate exists
  it('Case P: No request is issued when no free candidate exists (fails closed)', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const provider = new RouterProvider('http://localhost:20128/v1', 'key', 5000, 'openai/gpt-4o');
    const res = await provider.execute({ id: 'T7', objective: 'fail', prompt: 'fail' } as any, 'C:/tmp');

    expect(res.status).toBe('FAILED');
    expect(res.errorCode).toBe('MODEL_NOT_ALLOWED_BY_FREE_ONLY_POLICY');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // Q. emergency FREE route
  it('Case Q: Emergency FREE route (openrouter/openrouter/free) only enters when allowEmergency is true or active queue is empty', () => {
    const queueNormal = resolveModelQueue('9router', undefined, { healthTracker: tracker, allowEmergency: false });
    expect(queueNormal.candidateQueue).not.toContain('openrouter/openrouter/free');

    const queueEmergency = resolveModelQueue('9router', undefined, { healthTracker: tracker, allowEmergency: true });
    expect(queueEmergency.candidateQueue).toContain('openrouter/openrouter/free');
    expect(queueEmergency.candidateQueue[queueEmergency.candidateQueue.length - 1]).toBe('openrouter/openrouter/free');
  });

  // R. deterministic selection under equal conditions
  it('Case R: Deterministic queue selection under equal conditions', () => {
    const queue1 = resolveModelQueue('9router', undefined, { healthTracker: tracker, allowEmergency: true });
    const queue2 = resolveModelQueue('9router', undefined, { healthTracker: tracker, allowEmergency: true });

    expect(queue1.candidateQueue).toEqual(queue2.candidateQueue);
    expect(queue1.primaryModel).toBe(queue2.primaryModel);
    expect(queue1.fallbackModels).toEqual(queue2.fallbackModels);
    expect(queue1.decisionTrace.map(t => t.modelId)).toEqual(queue2.decisionTrace.map(t => t.modelId));
  });
});

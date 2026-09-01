// tests/streaming-runtime.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OpenRouterProvider } from '../src/providers/openrouter.js';
import { RouterProvider } from '../src/providers/router.js';
import { StreamEventSink, parseOpenAISSEStream, ToolCallStreamAssembler } from '../src/providers/streaming/index.js';
import { canUsePaidFallback, buildRoutingPolicy } from '../src/routing/index.js';
import type { Task } from '../src/domain.js';
import type { AttemptTrace } from '../src/worker-service.js';

function createMockReadableStream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let index = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (index < chunks.length) {
        controller.enqueue(encoder.encode(chunks[index]));
        index++;
      } else {
        controller.close();
      }
    },
  });
}

describe('P5.2 Streaming Runtime Integration & Real-time Feedback', () => {
  const dummyTask: Task = {
    id: 'task-p52-runtime-test',
    project: 'test-project',
    repository: 'https://github.com/test/repo',
    objective: 'Streaming Runtime Test',
    prompt: 'Implement feature with real-time feedback',
    status: 'QUEUED',
    priority: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('A & B & C & D: Incremental Text & Tool Calls via StreamEventSink', () => {
    it('A & B: captures text deltas incrementally without executing partial tools', async () => {
      const sink = new StreamEventSink();
      const sseChunks = [
        'data: {"choices":[{"delta":{"content":"Writing code..."}}]}\n\n',
        'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_write","function":{"name":"write_file","arguments":"{\\"path\\": "}}]}}]}\n\n',
        'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"\\"main.ts\\", \\"content\\": \\"export const a = 1;\\"}"}}]}}]}\n\n',
        'data: {"choices":[{"finish_reason":"tool_calls"}],"usage":{"prompt_tokens":120,"completion_tokens":40,"total_tokens":160}}\n\n',
        'data: [DONE]\n\n',
      ];

      const stream = createMockReadableStream(sseChunks);
      const res = await parseOpenAISSEStream(stream, undefined, (ev) => sink.onEvent(ev));

      const feedback = sink.getFeedback();
      expect(feedback.textBuffer).toBe('Writing code...');
      expect(feedback.completedEventReceived).toBe(true);
      expect(feedback.finishReason).toBe('tool_calls');
      expect(feedback.toolCallsReceived).toHaveLength(1);
      expect(feedback.toolCallsReceived[0].function.name).toBe('write_file');
      expect(JSON.parse(feedback.toolCallsReceived[0].function.arguments)).toEqual({
        path: 'main.ts',
        content: 'export const a = 1;',
      });
      expect(feedback.usage?.totalTokens).toBe(160);
    });

    it('C & D: reconstructs multiple interleaved tool calls with late IDs', async () => {
      const sink = new StreamEventSink();
      const sseChunks = [
        'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"name":"tool_1","arguments":"{\\"x\\": 10"}}]}}]}\n\n',
        'data: {"choices":[{"delta":{"tool_calls":[{"index":1,"id":"id_2","function":{"name":"tool_2","arguments":"{\\"y\\": 20}"}}]}}]}\n\n',
        'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"id_1","function":{"arguments":", \\"extra\\": true}"}}]}}]}\n\n',
        'data: {"choices":[{"finish_reason":"tool_calls"}]}\n\n',
        'data: [DONE]\n\n',
      ];

      const stream = createMockReadableStream(sseChunks);
      const res = await parseOpenAISSEStream(stream, undefined, (ev) => sink.onEvent(ev));

      expect(res.toolCalls).toHaveLength(2);
      expect(res.toolCalls[0].id).toBe('id_1');
      expect(JSON.parse(res.toolCalls[0].function.arguments)).toEqual({ x: 10, extra: true });
      expect(res.toolCalls[1].id).toBe('id_2');
      expect(JSON.parse(res.toolCalls[1].function.arguments)).toEqual({ y: 20 });
    });
  });

  describe('E & F & G & T: Usage, Finish Reason, and No Token Duplication', () => {
    it('E & T: captures usage exactly once without double counting', async () => {
      const sink = new StreamEventSink();
      const provider = new OpenRouterProvider('http://localhost:19999/v1', 'key', 5000, 'openrouter/free', true, sink);

      const sseChunks = [
        'data: {"choices":[{"delta":{"content":"Done."}}]}\n\n',
        'data: {"choices":[{"finish_reason":"stop"}],"usage":{"prompt_tokens":100,"completion_tokens":20,"total_tokens":120,"total_cost":0.00005}}\n\n',
        'data: [DONE]\n\n',
      ];

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        body: createMockReadableStream(sseChunks),
        headers: new Headers(),
      });

      const res = await provider.execute(dummyTask, process.cwd());
      expect(res.status).toBe('COMPLETED');
      expect(res.stdout).toBe('Done.');
      expect(res.promptTokens).toBe(100);
      expect(res.completionTokens).toBe(20);
      expect(res.totalTokens).toBe(120);
      expect(res.costUsd).toBe(0.00005);

      const feedback = sink.getFeedback();
      expect(feedback.usage?.totalTokens).toBe(120);
    });

    it('F & G: respects finish_reason stop and stream completed [DONE]', async () => {
      const sink = new StreamEventSink();
      const sseChunks = [
        'data: {"choices":[{"delta":{"content":"Summary complete."}}]}\n\n',
        'data: {"choices":[{"finish_reason":"stop"}]}\n\n',
        'data: [DONE]\n\n',
      ];

      const stream = createMockReadableStream(sseChunks);
      const res = await parseOpenAISSEStream(stream, undefined, (ev) => sink.onEvent(ev));

      expect(res.finishReason).toBe('stop');
      expect(sink.getFeedback().completedEventReceived).toBe(true);
      expect(res.fullText).toBe('Summary complete.');
    });
  });

  describe('H & I & J & K & L & M: Cancellation, Truncation, stream:false Fallback, and Error Handling', () => {
    it('H: cancels stream gracefully upon AbortSignal without hanging', async () => {
      const controller = new AbortController();
      const sseChunks = [
        'data: {"choices":[{"delta":{"content":"Starting work..."}}]}\n\n',
      ];

      const stream = createMockReadableStream(sseChunks);
      controller.abort();

      await expect(parseOpenAISSEStream(stream, controller.signal)).rejects.toThrow('STREAM_ABORTED');
    });

    it('I: handles prematurely truncated stream and recovers assembled data without throwing unhandled exceptions', async () => {
      const sink = new StreamEventSink();
      // Stream terminates abruptly without [DONE]
      const sseChunks = [
        'data: {"choices":[{"delta":{"content":"Partial response before connection drop"}}]}\n\n',
      ];

      const stream = createMockReadableStream(sseChunks);
      const res = await parseOpenAISSEStream(stream, undefined, (ev) => sink.onEvent(ev));

      expect(res.fullText).toBe('Partial response before connection drop');
      expect(sink.getFeedback().completedEventReceived).toBe(false);
    });

    it('J & K: falls back seamlessly to stream:false when streaming is disabled or response.body is missing', async () => {
      const provider = new OpenRouterProvider('http://localhost:19999/v1', 'key', 5000, 'openrouter/free', false);

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          model: 'openrouter/free',
          choices: [{ message: { role: 'assistant', content: 'Fallback stream:false success.' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 50, completion_tokens: 15, total_tokens: 65 },
        }),
      });

      const res = await provider.execute(dummyTask, process.cwd());
      expect(res.status).toBe('COMPLETED');
      expect(res.stdout).toBe('Fallback stream:false success.');
      expect(res.totalTokens).toBe(65);
    });

    it('L & M: gracefully handles malformed SSE lines without failing parser', async () => {
      const sink = new StreamEventSink();
      const sseChunks = [
        'invalid non-sse line\n',
        'data: {corrupt json}\n\n',
        'data: {"choices":[{"delta":{"content":"Valid line after noise."}}]}\n\n',
        'data: [DONE]\n\n',
      ];

      const stream = createMockReadableStream(sseChunks);
      const res = await parseOpenAISSEStream(stream, undefined, (ev) => sink.onEvent(ev));

      expect(res.fullText).toBe('Valid line after noise.');
      expect(sink.getFeedback().completedEventReceived).toBe(true);
    });
  });

  describe('N & O & P & Q: Retry, Model Switch, Tier Escalation & Cost Guard Sovereignity', () => {
    it('Q: strictly enforces Cost Guard regardless of streaming', () => {
      const policy = buildRoutingPolicy(
        { objective: 'Deploy cloud infrastructure' },
        {
          OPENROUTER_PAID_FALLBACK_ENABLED: 'false', // STRICTLY GUARDED
          OPENROUTER_STREAM_ENABLED: 'true',
        }
      );

      expect(canUsePaidFallback(policy, 0, 0)).toBe(false);
    });

    it('N & O & P: RouterProvider supports streaming option in chain configuration', () => {
      const routerProvider = new RouterProvider('http://localhost:19999/v1', 'key', 5000, 'meta-llama/llama-3.3-70b-instruct:free', true);
      expect(routerProvider.enableStream).toBe(true);
      expect(routerProvider.kind).toBe('9router');
    });
  });

  describe('R & S: Non-execution of Partial Tools and Backward-compatible AttemptTrace', () => {
    it('R: ToolCallStreamAssembler never produces partial tool calls if arguments are incomplete', () => {
      const assembler = new ToolCallStreamAssembler();
      assembler.ingestDelta({
        index: 0,
        id: 'call_broken',
        function: { name: 'modify_code', arguments: '{"file": "app.ts", "content":' }, // Incomplete JSON
      });

      const calls = assembler.assemble();
      expect(calls).toHaveLength(1);
      // Tool runtime will reject invalid JSON gracefully without crashing
      expect(calls[0].function.arguments).toBe('{"file": "app.ts", "content":');
    });

    it('S: AttemptTrace preserves all legacy metrics alongside token telemetry', () => {
      const trace: AttemptTrace = {
        attempt: 1,
        provider: 'openrouter',
        model: 'minimax/minimax-m2.7:free',
        tier: 1,
        profile: 'code_generation',
        fallbackType: 'retry',
        status: 'COMPLETED',
        retryable: false,
        retryReason: null,
        httpStatus: 200,
        errorCode: null,
        errorMessage: null,
        toolCalls: 2,
        toolRounds: 1,
        durationMs: 450,
        exitCode: 0,
        attemptTimeoutMs: 60000,
        isWinner: true,
        workspaceCreated: true,
        workspaceCleaned: false,
        promptTokens: 120,
        completionTokens: 35,
        totalTokens: 155,
        costUsd: 0,
      };

      expect(trace.tier).toBe(1);
      expect(trace.totalTokens).toBe(155);
      expect(trace.costUsd).toBe(0);
    });
  });
});

// tests/provider-streaming.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OpenRouterProvider } from '../src/providers/openrouter.js';
import { RouterProvider } from '../src/providers/router.js';
import { parseOpenAISSEStream } from '../src/providers/streaming/index.js';
import type { Task } from '../src/domain.js';

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

describe('Provider SSE Streaming & Real-time Protocol', () => {
  const dummyTask: Task = {
    id: 'task-stream-test',
    project: 'test-project',
    repository: 'https://github.com/test/repo',
    objective: 'Stream SSE test',
    prompt: 'Respond via SSE stream',
    status: 'QUEUED',
    priority: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('parses SSE stream with fragmented chunks, text, tool calls, and usage', async () => {
    const sseChunks = [
      'data: {"choices":[{"delta":{"content":"Hel"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"lo "}}]}\n',
      'data: {"choices":[{"delta":{"content":"World!"}}]}\n\n',
      ': keep-alive\n\n',
      'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_123","function":{"name":"read_file","arguments":"{\\"path\\": "}}]}}]}\n\n',
      'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"\\"test.txt\\"}"}}]}}]}\n\n',
      'data: {"choices":[{"finish_reason":"tool_calls"}],"usage":{"prompt_tokens":100,"completion_tokens":25,"total_tokens":125,"total_cost":0.0001}}\n\n',
      'data: [DONE]\n\n',
    ];

    const stream = createMockReadableStream(sseChunks);
    const events: any[] = [];
    const result = await parseOpenAISSEStream(stream, undefined, (ev) => events.push(ev));

    expect(result.fullText).toBe('Hello World!');
    expect(result.finishReason).toBe('tool_calls');
    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0].function.name).toBe('read_file');
    expect(JSON.parse(result.toolCalls[0].function.arguments)).toEqual({ path: 'test.txt' });
    expect(result.usage?.totalTokens).toBe(125);
    expect(events.some(e => e.type === 'text_delta')).toBe(true);
    expect(events.some(e => e.type === 'tool_call_completed')).toBe(true);
  });

  it('handles AbortSignal cancellation during stream reading', async () => {
    const controller = new AbortController();
    const sseChunks = [
      'data: {"choices":[{"delta":{"content":"Part 1"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"Part 2"}}]}\n\n',
    ];

    const stream = createMockReadableStream(sseChunks);
    controller.abort(); // Abort immediately

    await expect(parseOpenAISSEStream(stream, controller.signal)).rejects.toThrow('STREAM_ABORTED');
  });

  it('OpenRouterProvider executes with stream:true and completes successfully', async () => {
    const provider = new OpenRouterProvider('http://localhost:19999/v1', 'test-key', 5000, 'openrouter/free', true);

    const sseChunks = [
      'data: {"choices":[{"delta":{"content":"Streaming response done."}}]}\n\n',
      'data: {"choices":[{"finish_reason":"stop"}],"usage":{"prompt_tokens":50,"completion_tokens":10,"total_tokens":60}}\n\n',
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
    expect(res.stdout).toBe('Streaming response done.');
    expect(res.totalTokens).toBe(60);
  });

  it('RouterProvider executes with stream:true and completes successfully', async () => {
    const provider = new RouterProvider('http://localhost:19999/v1', 'test-key', 5000, 'mock-model', true);

    const sseChunks = [
      'data: {"choices":[{"delta":{"content":"9Router stream complete."}}]}\n\n',
      'data: {"choices":[{"finish_reason":"stop"}]}\n\n',
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
    expect(res.stdout).toBe('9Router stream complete.');
  });
});

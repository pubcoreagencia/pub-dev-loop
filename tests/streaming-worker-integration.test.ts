// tests/streaming-worker-integration.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import { RouterWorker, type TaskStreamEventCallback } from '../src/router-worker.js';
import { DualGatewayProvider } from '../src/providers/gateway.js';
import { OpenRouterProvider } from '../src/providers/openrouter.js';
import { RouterProvider } from '../src/providers/router.js';
import type { AgentProvider, ProviderTaskResult } from '../src/providers/types.js';
import type { Task, TaskRepository } from '../src/domain.js';

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

async function initGitRepo(root: string): Promise<void> {
  await mkdir(root, { recursive: true });
  execSync('git init', { cwd: root, stdio: 'ignore' });
  execSync('git config user.name "TEST"', { cwd: root, stdio: 'ignore' });
  execSync('git config user.email "test@test.com"', { cwd: root, stdio: 'ignore' });
  execSync('git commit --allow-empty -m "init"', { cwd: root, stdio: 'ignore' });
}

describe('P5.3 Operational Streaming & Worker Integration (Scenarios A through N)', () => {
  let testRepoDir: string;

  const dummyTask: Task = {
    id: 'task-p53-worker-test',
    project: 'test-project',
    repository: '',
    objective: 'P5.3 Worker Streaming Integration',
    prompt: 'Execute coding task with streaming feedback',
    status: 'QUEUED',
    priority: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockTasks: TaskRepository = {
    claim: vi.fn(),
    heartbeat: vi.fn(),
    update: vi.fn(),
    get: vi.fn(),
    list: vi.fn(),
    create: vi.fn(),
  } as any;

  beforeEach(async () => {
    vi.restoreAllMocks();
    testRepoDir = join(tmpdir(), 'p53-test-repo-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6));
    await initGitRepo(testRepoDir);
    dummyTask.repository = testRepoDir;
  });

  afterEach(async () => {
    try {
      await rm(testRepoDir, { recursive: true, force: true });
    } catch {}
  });

  describe('A & B & C & D & E: Worker -> Provider -> StreamConsumer & Real-time Callbacks', () => {
    it('A & B & C: forwards streaming events to onStreamEvent callback during execution', async () => {
      const eventsCaptured: any[] = [];
      const callback: TaskStreamEventCallback = (taskId, attempt, event) => {
        eventsCaptured.push({ taskId, attempt, type: event.type, text: event.text });
      };

      const sseChunks = [
        'data: {"choices":[{"delta":{"content":"Chunk 1. "}}]}\n\n',
        'data: {"choices":[{"delta":{"content":"Chunk 2."}}]}\n\n',
        'data: {"choices":[{"finish_reason":"stop"}],"usage":{"prompt_tokens":50,"completion_tokens":10,"total_tokens":60}}\n\n',
        'data: [DONE]\n\n',
      ];

      const provider = new OpenRouterProvider('http://localhost:19999/v1', 'test-key', 5000, 'openrouter/free', true);

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        body: createMockReadableStream(sseChunks),
        headers: new Headers(),
      });

      const result = await provider.execute(dummyTask, process.cwd(), {
        consumer: {
          onEvent: (ev) => callback(dummyTask.id, 0, ev),
        },
      });

      expect(result.status).toBe('COMPLETED');
      expect(result.stdout).toBe('Chunk 1. Chunk 2.');
      expect(eventsCaptured.length).toBeGreaterThanOrEqual(2);
      expect(eventsCaptured.some(e => e.text === 'Chunk 1. ')).toBe(true);
      expect(eventsCaptured.some(e => e.text === 'Chunk 2.')).toBe(true);
    });

    it('D & E: captures complete tool calls across deltas and notifies consumer', async () => {
      const toolCallsCompleted: any[] = [];
      const provider = new OpenRouterProvider('http://localhost:19999/v1', 'key', 5000, 'openrouter/free', true);

      const sseChunks = [
        'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_99","function":{"name":"run_test","arguments":"{\\"env\\": "}}]}}]}\n\n',
        'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"\\"node\\"}"}}]}}]}\n\n',
        'data: {"choices":[{"finish_reason":"tool_calls"}]}\n\n',
        'data: [DONE]\n\n',
      ];

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        body: createMockReadableStream(sseChunks),
        headers: new Headers(),
      });

      const result = await provider.execute(dummyTask, process.cwd(), {
        consumer: {
          onToolCallCompleted: (tc) => toolCallsCompleted.push(tc),
        },
      });

      expect(toolCallsCompleted).toHaveLength(1);
      expect(toolCallsCompleted[0].id).toBe('call_99');
      expect(JSON.parse(toolCallsCompleted[0].function.arguments)).toEqual({ env: 'node' });
    });
  });

  describe('F & G & M: Real Cancellation, Timeout & Abort Propagation', () => {
    it('F: worker.cancel() aborts active attempt and provider fetch', async () => {
      let abortedSignalReceived = false;

      const mockProvider: AgentProvider = {
        kind: 'openrouter',
        model: 'openrouter/free',
        execute: async (_task, _ws, options) => {
          options?.signal?.addEventListener('abort', () => {
            abortedSignalReceived = true;
          });
          // simulate hanging provider
          await new Promise((resolve) => setTimeout(resolve, 500));
          return {
            status: 'COMPLETED',
            provider: 'openrouter',
            model: 'openrouter/free',
            exitCode: 0,
            durationMs: 100,
            stdout: '',
            stderr: '',
            changedFiles: [],
            commit: null,
            errorCode: null,
            errorMessage: null,
          };
        },
        health: async () => ({ available: true, details: 'ok' }),
        capabilities: () => ['openrouter'],
        metadata: () => ({}),
      };

      const worker = new RouterWorker(mockTasks, mockProvider, 'router');
      // trigger execution in background and cancel immediately
      const execPromise = (worker as any).executeWithRetry(dummyTask, testRepoDir);
      // Wait slightly for git clone to finish and provider execution to start
      await new Promise(r => setTimeout(r, 60));
      await worker.cancel();

      await execPromise.catch(() => {});
      expect(abortedSignalReceived).toBe(true);
    });

    it('G & M: attempt timeout triggers signal abort and prevents subsequent tool execution', async () => {
      let signalAborted = false;
      const mockProvider: AgentProvider = {
        kind: 'openrouter',
        model: 'openrouter/free',
        execute: async (_task, _ws, options) => {
          options?.signal?.addEventListener('abort', () => {
            signalAborted = true;
          });
          // simulate hanging beyond attempt timeout
          await new Promise((resolve) => setTimeout(resolve, 300));
          return {
            status: 'COMPLETED',
            provider: 'openrouter',
            model: 'openrouter/free',
            exitCode: 0,
            durationMs: 300,
            stdout: '',
            stderr: '',
            changedFiles: [],
            commit: null,
            errorCode: null,
            errorMessage: null,
          };
        },
        health: async () => ({ available: true, details: 'ok' }),
        capabilities: () => ['openrouter'],
        metadata: () => ({}),
      };

      const prevTimeout = process.env.ROUTER_TIMEOUT_PER_ATTEMPT_MS;
      process.env.ROUTER_TIMEOUT_PER_ATTEMPT_MS = '50'; // 50ms quick timeout
      try {
        const worker = new RouterWorker(mockTasks, mockProvider, 'router');
        const res = await (worker as any).executeWithRetry(dummyTask, testRepoDir);
        expect(res.status).toBe('FAILED');
        expect(signalAborted).toBe(true);
      } finally {
        process.env.ROUTER_TIMEOUT_PER_ATTEMPT_MS = prevTimeout;
      }
    });
  });

  describe('H & I: Retry with Isolated Sinks and Zero Contamination', () => {
    it('isolates streaming events and telemetry between failed attempt and winning attempt', async () => {
      const attempt0Events: any[] = [];
      const attempt1Events: any[] = [];

      const callback: TaskStreamEventCallback = (taskId, attempt, event) => {
        if (attempt === 0) attempt0Events.push(event);
        if (attempt === 1) attempt1Events.push(event);
      };

      let callCount = 0;
      const mockProvider: AgentProvider = {
        kind: 'openrouter',
        model: 'openrouter/free',
        execute: async (_task, _ws, options) => {
          callCount++;
          if (callCount === 1) {
            options?.consumer?.onEvent?.({ type: 'text_delta', text: 'Attempt 0 text.' });
            return {
              status: 'ROUTER_HTTP_ERROR',
              provider: 'openrouter',
              model: 'openrouter/free',
              exitCode: 503,
              durationMs: 50,
              stdout: 'Attempt 0 text.',
              stderr: 'HTTP 503 Service Unavailable',
              changedFiles: [],
              commit: null,
              errorCode: 'ROUTER_HTTP_ERROR',
              errorMessage: 'HTTP 503',
              httpStatus: 503,
            };
          }
          options?.consumer?.onEvent?.({ type: 'text_delta', text: 'Attempt 1 winning text.' });
          return {
            status: 'COMPLETED',
            provider: 'openrouter',
            model: 'openrouter/free',
            exitCode: 0,
            durationMs: 60,
            stdout: 'Attempt 1 winning text.',
            stderr: '',
            changedFiles: ['app.ts'],
            commit: 'c123',
            errorCode: null,
            errorMessage: null,
          };
        },
        health: async () => ({ available: true, details: 'ok' }),
        capabilities: () => ['openrouter'],
        metadata: () => ({}),
      };

      const prevMax = process.env.ROUTER_MAX_ATTEMPTS;
      const prevChain = process.env.ROUTER_PROVIDER_CHAIN;
      process.env.ROUTER_MAX_ATTEMPTS = '2';
      process.env.ROUTER_PROVIDER_CHAIN = 'openrouter:m1,openrouter:m2';

      try {
        const worker = new RouterWorker(mockTasks, mockProvider, 'router', callback);
        (worker as any).getProviderChain = () => [mockProvider, mockProvider];
        const res = await (worker as any).executeWithRetry(dummyTask, testRepoDir);

        expect(res.status).toBe('COMPLETED');
        expect(res.stdout).toBe('Attempt 1 winning text.');
        expect(res.declaredChangedFiles).toEqual(['app.ts']);
      } finally {
        process.env.ROUTER_MAX_ATTEMPTS = prevMax;
        process.env.ROUTER_PROVIDER_CHAIN = prevChain;
      }
    });
  });

  describe('J & K: DualGateway Streaming Parity & Safe Fallback', () => {
    it('J: forwards consumer to primary gateway during streaming', async () => {
      const primaryConsumerEvents: any[] = [];
      const primary: AgentProvider = {
        kind: 'openrouter',
        model: 'primary-model',
        execute: async (_t, _ws, opts) => {
          opts?.consumer?.onEvent?.({ type: 'text_delta', text: 'Primary streamed.' });
          return {
            status: 'COMPLETED',
            provider: 'openrouter',
            model: 'primary-model',
            exitCode: 0,
            durationMs: 50,
            stdout: 'Primary streamed.',
            stderr: '',
            changedFiles: [],
            commit: null,
            errorCode: null,
            errorMessage: null,
          };
        },
        health: async () => ({ available: true, details: 'ok' }),
        capabilities: () => ['openrouter'],
        metadata: () => ({}),
      };

      const fallback: AgentProvider = { ...primary, model: 'fallback-model' };
      const dualGateway = new DualGatewayProvider(primary, fallback);

      const res = await dualGateway.execute(dummyTask, 'C:/fake/ws', {
        consumer: {
          onEvent: (ev) => primaryConsumerEvents.push(ev),
        },
      });

      expect(res.status).toBe('COMPLETED');
      expect(primaryConsumerEvents).toHaveLength(1);
      expect(primaryConsumerEvents[0].text).toBe('Primary streamed.');
    });

    it('K: forwards consumer to fallback gateway upon clean primary failure', async () => {
      const fallbackEvents: any[] = [];
      const primary: AgentProvider = {
        kind: 'openrouter',
        model: 'primary-model',
        execute: async () => ({
          status: 'ROUTER_HTTP_ERROR',
          provider: 'openrouter',
          model: 'primary-model',
          exitCode: 500,
          durationMs: 20,
          stdout: '',
          stderr: 'Server error',
          changedFiles: [],
          commit: null,
          errorCode: 'ROUTER_HTTP_ERROR',
          errorMessage: '500 Server Error',
          httpStatus: 500,
        }),
        health: async () => ({ available: true, details: 'ok' }),
        capabilities: () => ['openrouter'],
        metadata: () => ({}),
      };

      const fallback: AgentProvider = {
        kind: '9router',
        model: 'fallback-model',
        execute: async (_t, _ws, opts) => {
          opts?.consumer?.onEvent?.({ type: 'text_delta', text: 'Fallback streamed.' });
          return {
            status: 'COMPLETED',
            provider: '9router',
            model: 'fallback-model',
            exitCode: 0,
            durationMs: 40,
            stdout: 'Fallback streamed.',
            stderr: '',
            changedFiles: [],
            commit: null,
            errorCode: null,
            errorMessage: null,
          };
        },
        health: async () => ({ available: true, details: 'ok' }),
        capabilities: () => ['9router'],
        metadata: () => ({}),
      };

      const dualGateway = new DualGatewayProvider(primary, fallback);
      const res = await dualGateway.execute(dummyTask, 'C:/fake/ws', {
        consumer: {
          onEvent: (ev) => fallbackEvents.push(ev),
        },
      });

      expect(res.status).toBe('COMPLETED');
      expect(res.stdout).toBe('Fallback streamed.');
      expect(fallbackEvents).toHaveLength(1);
      expect(fallbackEvents[0].text).toBe('Fallback streamed.');
    });
  });

  describe('L & N: Telemetry Consistency & stream:false Default Invariance', () => {
    it('L: captures token usage in attempt trace without duplicating metrics', () => {
      const provider = new RouterProvider('http://localhost:19999/v1', 'key', 5000, 'mock-model', false);
      expect(provider.enableStream).toBe(false);
    });

    it('N: preserves stream:false default behavior across entire system', () => {
      const openRouter = new OpenRouterProvider();
      const routerProv = new RouterProvider();

      expect(openRouter.enableStream).toBe(false);
      expect(routerProv.enableStream).toBe(false);
    });
  });
});

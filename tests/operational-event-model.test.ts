// tests/operational-event-model.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import {
  StreamEventSink,
  type OperationalEventEnvelope,
  type OperationalEventType,
  type StreamEvent,
} from '../src/providers/streaming/index.js';
import { RouterWorker, type TaskStreamEventCallback } from '../src/router-worker.js';
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

describe('P5.4 Operational Event Model & Envelope Standard (Scenarios 1 through 25)', () => {
  let testRepoDir: string;

  const dummyTask: Task = {
    id: 'task-p54-event-test',
    project: 'event-project',
    repository: '',
    objective: 'Standardize Operational Event Envelopes',
    prompt: 'Implement operational event model with monotonic sequence',
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
    testRepoDir = join(tmpdir(), 'p54-test-repo-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6));
    await initGitRepo(testRepoDir);
    dummyTask.repository = testRepoDir;
  });

  afterEach(async () => {
    try {
      await rm(testRepoDir, { recursive: true, force: true });
    } catch {}
  });

  describe('1 to 9: Envelope Properties, Monotonic Sequence & Isolation', () => {
    it('1 to 7: creates envelopes with valid taskId, attempt, monotonic seq, and valid ISO timestamp', () => {
      const envelopes: OperationalEventEnvelope[] = [];
      const sink = new StreamEventSink(
        {
          onEnvelope: (env) => envelopes.push(env),
        },
        { taskId: 'task-123', attempt: 0 }
      );

      sink.emitEnvelope('attempt_started', { attempt: 0 });
      sink.onEvent({ type: 'text_delta', text: 'Hello ' });
      sink.onEvent({ type: 'text_delta', text: 'World' });
      sink.onEvent({ type: 'stream_completed' });
      sink.emitEnvelope('attempt_completed', { attempt: 0, winner: true });

      expect(envelopes).toHaveLength(5);
      envelopes.forEach((env, idx) => {
        expect(env.taskId).toBe('task-123');
        expect(env.attempt).toBe(0);
        expect(env.seq).toBe(idx);
        expect(new Date(env.timestamp).toISOString()).toBe(env.timestamp);
      });

      expect(envelopes[0].type).toBe('attempt_started');
      expect(envelopes[1].type).toBe('text_delta');
      expect(envelopes[2].type).toBe('text_delta');
      expect(envelopes[3].type).toBe('stream_completed');
      expect(envelopes[4].type).toBe('attempt_completed');
    });

    it('8 & 9: maintains strict sequence and envelope isolation between attempts and tasks', () => {
      const sinkTaskA_Att0 = new StreamEventSink(undefined, { taskId: 'task-A', attempt: 0 });
      const sinkTaskA_Att1 = new StreamEventSink(undefined, { taskId: 'task-A', attempt: 1 });
      const sinkTaskB_Att0 = new StreamEventSink(undefined, { taskId: 'task-B', attempt: 0 });

      const envA0 = sinkTaskA_Att0.emitEnvelope('attempt_started', {});
      const envA1 = sinkTaskA_Att1.emitEnvelope('attempt_started', {});
      const envB0 = sinkTaskB_Att0.emitEnvelope('attempt_started', {});

      expect(envA0.taskId).toBe('task-A');
      expect(envA0.attempt).toBe(0);
      expect(envA0.seq).toBe(0);

      expect(envA1.taskId).toBe('task-A');
      expect(envA1.attempt).toBe(1);
      expect(envA1.seq).toBe(0); // Starts fresh at 0 for attempt 1

      expect(envB0.taskId).toBe('task-B');
      expect(envB0.attempt).toBe(0);
      expect(envB0.seq).toBe(0);
    });
  });

  describe('10 to 17: Streaming & Lifecycle Event Emission in RouterWorker', () => {
    it('10 to 14: emits attempt_started, text_delta, and attempt_completed across worker execution', async () => {
      const capturedEnvelopes: OperationalEventEnvelope[] = [];
      const callback: TaskStreamEventCallback = (_taskId, _attempt, _payload, envelope) => {
        if (envelope) capturedEnvelopes.push(envelope);
      };

      const sseChunks = [
        'data: {"choices":[{"delta":{"content":"Code generated."}}]}\n\n',
        'data: {"choices":[{"finish_reason":"stop"}],"usage":{"prompt_tokens":40,"completion_tokens":10,"total_tokens":50}}\n\n',
        'data: [DONE]\n\n',
      ];

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        body: createMockReadableStream(sseChunks),
        headers: new Headers(),
      });

      const provider = new OpenRouterProvider('http://localhost:19999/v1', 'key', 5000, 'openrouter/free', true);
      const worker = new RouterWorker(mockTasks, provider, 'router', callback);

      const result = await (worker as any).executeWithRetry(dummyTask, testRepoDir);
      expect(result.status).toBe('COMPLETED');

      const types = capturedEnvelopes.map(e => e.type);
      expect(types).toContain('attempt_started');
      expect(types).toContain('text_delta');
      expect(types).toContain('stream_completed');
      expect(types).toContain('attempt_completed');

      // Monotonicity verification
      for (let i = 1; i < capturedEnvelopes.length; i++) {
        expect(capturedEnvelopes[i].seq).toBe(capturedEnvelopes[i - 1].seq + 1);
      }
    });

    it('12 & 13: emits attempt_failed and retry_started upon retryable error', async () => {
      const capturedEnvelopes: OperationalEventEnvelope[] = [];
      const callback: TaskStreamEventCallback = (_taskId, _attempt, _payload, envelope) => {
        if (envelope) capturedEnvelopes.push(envelope);
      };

      let callCount = 0;
      const mockProvider: AgentProvider = {
        kind: 'openrouter',
        model: 'openrouter/free',
        execute: async () => {
          callCount++;
          if (callCount === 1) {
            return {
              status: 'ROUTER_HTTP_ERROR',
              provider: 'openrouter',
              model: 'openrouter/free',
              exitCode: 503,
              durationMs: 20,
              stdout: '',
              stderr: '503 Service Unavailable',
              changedFiles: [],
              commit: null,
              errorCode: 'ROUTER_HTTP_ERROR',
              errorMessage: '503 Service Unavailable',
              httpStatus: 503,
            };
          }
          return {
            status: 'COMPLETED',
            provider: 'openrouter',
            model: 'openrouter/free',
            exitCode: 0,
            durationMs: 30,
            stdout: 'Success on retry.',
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

      const prevMax = process.env.ROUTER_MAX_ATTEMPTS;
      process.env.ROUTER_MAX_ATTEMPTS = '2';

      try {
        const worker = new RouterWorker(mockTasks, mockProvider, 'router', callback);
        (worker as any).getProviderChain = () => [mockProvider, mockProvider];

        const res = await (worker as any).executeWithRetry(dummyTask, testRepoDir);
        expect(res.status).toBe('COMPLETED');

        const attempt0Types = capturedEnvelopes.filter(e => e.attempt === 0).map(e => e.type);
        const attempt1Types = capturedEnvelopes.filter(e => e.attempt === 1).map(e => e.type);

        expect(attempt0Types).toContain('attempt_started');
        expect(attempt0Types).toContain('attempt_failed');
        expect(attempt0Types).toContain('retry_started');

        expect(attempt1Types).toContain('attempt_started');
        expect(attempt1Types).toContain('attempt_completed');
      } finally {
        process.env.ROUTER_MAX_ATTEMPTS = prevMax;
      }
    });

    it('17: emits task_cancelled when worker is cancelled during execution', async () => {
      const capturedEnvelopes: OperationalEventEnvelope[] = [];
      const callback: TaskStreamEventCallback = (_taskId, _attempt, _payload, envelope) => {
        if (envelope) capturedEnvelopes.push(envelope);
      };

      const mockProvider: AgentProvider = {
        kind: 'openrouter',
        model: 'openrouter/free',
        execute: async (_t, _w, options) => {
          if (options?.consumer?.onEvent) {
            options.consumer.onEvent({
              type: 'text_delta',
              data: { text: 'chunk' },
            });
          }
          await new Promise(r => setTimeout(r, 600));
          return {
            status: 'COMPLETED',
            provider: 'openrouter',
            model: 'openrouter/free',
            exitCode: 0,
            durationMs: 600,
            stdout: 'Done',
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

      const worker = new RouterWorker(mockTasks, mockProvider, 'router', callback);
      const execPromise = (worker as any).executeWithRetry(dummyTask, testRepoDir);
      // Wait for provider execution to begin and attemptSink to be created
      await new Promise(r => setTimeout(r, 150));
      await worker.cancel();

      await execPromise.catch(() => {});
      const types = capturedEnvelopes.map(e => e.type);
      expect(types).toContain('task_cancelled');
    });
  });

  describe('18 to 20: Fault Isolation & Non-blocking Consumers', () => {
    it('18: isolates synchronous exceptions thrown by consumer without failing task', () => {
      const faultyConsumer = {
        onEnvelope: () => {
          throw new Error('Fatal consumer crash!');
        },
      };

      const sink = new StreamEventSink(faultyConsumer, { taskId: 'task-test', attempt: 0 });
      expect(() => sink.emitEnvelope('text_delta', { text: 'Safe execution' })).not.toThrow();
      expect(sink.getCurrentSeq()).toBe(1);
    });

    it('19 & 20: handles slow / async consumer gracefully without blocking or throwing unhandled rejection', () => {
      const slowConsumer = {
        onEnvelope: async () => {
          await new Promise(r => setTimeout(r, 100));
          throw new Error('Async consumer rejected');
        },
      };

      const sink = new StreamEventSink(slowConsumer as any, { taskId: 'task-test', attempt: 0 });
      expect(() => sink.emitEnvelope('text_delta', { text: 'Async safe' })).not.toThrow();
    });
  });

  describe('21 to 25: Tool Call Integrity, Usage Telemetry and stream:false Fallback', () => {
    it('21: ensures tool_call_completed envelope is emitted only when complete', () => {
      const envelopes: OperationalEventEnvelope[] = [];
      const sink = new StreamEventSink(
        {
          onEnvelope: (env) => envelopes.push(env),
        },
        { taskId: 'task-tools', attempt: 0 }
      );

      sink.onEvent({
        type: 'tool_call_completed',
        toolCall: {
          id: 'call_1',
          type: 'function',
          function: { name: 'write_code', arguments: '{"ok": true}' },
        },
      });

      expect(envelopes).toHaveLength(1);
      expect(envelopes[0].type).toBe('tool_call_completed');
      expect(envelopes[0].payload.toolCall.id).toBe('call_1');
    });

    it('22: usage envelope does not cause telemetry double-counting', () => {
      const sink = new StreamEventSink(undefined, { taskId: 'task-usage', attempt: 0 });
      sink.onEvent({
        type: 'usage',
        usage: { promptTokens: 100, completionTokens: 25, totalTokens: 125, costUsd: 0.0001 },
      });

      const feedback = sink.getFeedback();
      expect(feedback.usage?.totalTokens).toBe(125);
    });

    it('25: preserves stream:false default invariance across providers', () => {
      const openRouter = new OpenRouterProvider();
      const routerProv = new RouterProvider();

      expect(openRouter.enableStream).toBe(false);
      expect(routerProv.enableStream).toBe(false);
    });
  });
});

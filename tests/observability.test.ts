import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import { OpenRouterProvider } from '../src/providers/openrouter.js';
import { RouterWorker } from '../src/router-worker.js';
import type { Task } from '../src/domain.js';
import type { AgentProvider, ProviderTaskResult } from '../src/providers/types.js';

async function initGitRepo(root: string): Promise<void> {
  await mkdir(root, { recursive: true });
  execSync('git init', { cwd: root, stdio: 'ignore' });
  execSync('git config user.name "TEST"', { cwd: root, stdio: 'ignore' });
  execSync('git config user.email "test@test.com"', { cwd: root, stdio: 'ignore' });
  execSync('git commit --allow-empty -m "init"', { cwd: root, stdio: 'ignore' });
}

function baseTask(id = 'TASK-OBSERVABILITY'): Task {
  return {
    id,
    project: 'test-project',
    repository: 'https://github.com/test/repo',
    objective: 'test-observability',
    prompt: 'test prompt',
    status: 'QUEUED',
    priority: 1,
    worker: null,
    result: null,
    error: null,
    branch: null,
    commitSha: null,
    gitStatus: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    leaseOwner: null,
    leaseDeadline: null,
    heartbeatAt: null,
    workspacePath: null,
    prototypeSessionId: 'sess-obs',
  };
}

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

describe('Observability Test Suite (A-E)', () => {
  let tempBase: string;
  let testRepoUrl: string;

  beforeEach(async () => {
    vi.restoreAllMocks();
    tempBase = join(tmpdir(), 'obs-test-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6));
    await mkdir(tempBase, { recursive: true });
    testRepoUrl = join(tempBase, 'test-repo.git');
    await initGitRepo(testRepoUrl);
  });

  afterEach(async () => {
    if (tempBase) {
      await rm(tempBase, { recursive: true, force: true }).catch(() => {});
    }
  });

  /**
   * Test A — OpenRouter candidate loop creates modelAttempts
   * model-A:free fails with fallback-eligible error (capability/schema mismatch), model-B:free succeeds.
   * Expect: modelAttempts === ['model-A:free', 'model-B:free']
   */
  it('Test A: records attempts for each candidate model in candidate loop', async () => {
    process.env.OPENROUTER_MODEL = 'model-A:free';
    process.env.OPENROUTER_FALLBACK_MODELS = 'model-B:free';
    process.env.OPENROUTER_API_KEY = 'sk-test';
    process.env.OPENROUTER_MAX_RETRIES = '0';
    process.env.OPENROUTER_RETRY_BASE_DELAY_MS = '0';

    const fetchMock = vi.fn(async (_url: string, options: any) => {
      const body = JSON.parse(options.body);
      const model = body.model;
      if (model === 'model-A:free') {
        return new Response(
          JSON.stringify({ error: { message: 'tool message unsupported: schema mismatch', code: 400 } }),
          { status: 400, headers: { 'content-type': 'application/json' } }
        );
      }
      return new Response(
        JSON.stringify({
          model: 'model-B:free',
          choices: [{ message: { role: 'assistant', content: 'completed by model-B' }, finish_reason: 'stop' }],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    const provider = new OpenRouterProvider('https://openrouter.ai/api/v1', 'sk-test', 2000);
    const result = await provider.execute(baseTask(), tempBase);

    expect(result.status).toBe('COMPLETED');
    expect((result as any).modelAttempts).toEqual(['model-A:free', 'model-B:free']);
  });

  /**
   * Test B — HTTP retries for the same model do NOT duplicate modelAttempts
   * Single model configured, first HTTP call fails (500), second succeeds.
   * Expect: modelAttempts === ['model-A:free']
   */
  it('Test B: retry of same model does not duplicate entries in modelAttempts', async () => {
    process.env.OPENROUTER_MODEL = 'model-A:free';
    process.env.OPENROUTER_FALLBACK_MODELS = '';
    process.env.OPENROUTER_API_KEY = 'sk-test';
    process.env.OPENROUTER_MAX_RETRIES = '2';
    process.env.OPENROUTER_RETRY_BASE_DELAY_MS = '0';

    let callCount = 0;
    const fetchMock = vi.fn(async (_url: string, _options: any) => {
      callCount++;
      if (callCount === 1) {
        return new Response('Internal Server Error', { status: 500 });
      }
      return new Response(
        JSON.stringify({
          model: 'model-A:free',
          choices: [{ message: { role: 'assistant', content: 'completed after retry' }, finish_reason: 'stop' }],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    const provider = new OpenRouterProvider('https://openrouter.ai/api/v1', 'sk-test', 2000);
    const result = await provider.execute(baseTask(), tempBase);

    expect(result.status).toBe('COMPLETED');
    expect(callCount).toBe(2);
    expect((result as any).modelAttempts).toEqual(['model-A:free']);
  });

  /**
   * Test C — RouterWorker + gateway fallback
   * OpenRouter tries model-A:free and model-B:free (both fail with 500 server error).
   * Gateway fallback to 9router succeeds with model-C.
   * Expect: fallbackChain === ['openrouter/model-A:free', 'openrouter/model-B:free', '9router/model-C']
   * and does NOT contain generic 'openrouter/openrouter', '9router/9router', or 'openrouter/unknown'.
   */
  it('Test C: builds complete fallbackChain with candidate model fallback and gateway fallback', async () => {
    process.env.ROUTER_MAX_ATTEMPTS = '2';
    process.env.ROUTER_BACKOFF_MS = '0';
    process.env.OPENROUTER_MODEL = 'model-A:free';
    process.env.OPENROUTER_FALLBACK_MODELS = 'model-B:free';
    process.env.OPENROUTER_API_KEY = 'sk-test';
    process.env.OPENROUTER_MAX_RETRIES = '0';
    process.env.OPENROUTER_RETRY_BASE_DELAY_MS = '0';

    const fetchMock = vi.fn(async (_url: string, options: any) => {
      const body = JSON.parse(options.body);
      const model = body.model;
      return new Response(
        JSON.stringify({ error: { message: `temporary 500 failure on ${model}`, code: 500 } }),
        { status: 500, headers: { 'content-type': 'application/json' } }
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    const openRouterProvider = new OpenRouterProvider('https://openrouter.ai/api/v1', 'sk-test', 2000);

    const success9RouterProvider: AgentProvider = {
      kind: '9router',
      model: 'model-C',
      timeoutMs: 2000,
      async execute(_task: Task, _workspace: string): Promise<ProviderTaskResult> {
        return {
          status: 'COMPLETED',
          provider: '9router',
          model: 'model-C',
          exitCode: 0,
          durationMs: 15,
          stdout: 'success from 9router',
          stderr: '',
          changedFiles: [],
          commit: null,
          httpStatus: 200,
        };
      },
    };

    const task = baseTask('TASK-OBS-C');
    const worker = new RouterWorker();
    worker.getProviderChain = () => [openRouterProvider, success9RouterProvider];

    const result = await (worker as any).executeWithRetry(task, testRepoUrl);
    expect(result.status).toBe('COMPLETED');
    const lastTrace = result.trace.attempts[result.trace.attempts.length - 1];

    expect(lastTrace.fallbackChain).toEqual([
      'openrouter/model-A:free',
      'openrouter/model-B:free',
      '9router/model-C',
    ]);
    expect(lastTrace.fallbackChain).not.toContain('openrouter/openrouter');
    expect(lastTrace.fallbackChain).not.toContain('9router/9router');
    expect(lastTrace.fallbackChain).not.toContain('openrouter/unknown');
  });

  /**
   * Test D — Backward compatibility
   * Provider that does NOT return modelAttempts.
   * RouterWorker must continue functioning smoothly without throwing or producing invalid trace.
   */
  it('Test D: supports providers without modelAttempts field (backward compatibility)', async () => {
    const legacyProvider: AgentProvider = {
      kind: 'codex-api',
      model: 'legacy-model',
      timeoutMs: 2000,
      async execute(_task: Task, _workspace: string): Promise<ProviderTaskResult> {
        return {
          status: 'COMPLETED',
          provider: 'codex-api',
          model: 'legacy-model',
          exitCode: 0,
          durationMs: 10,
          stdout: 'legacy ok',
          stderr: '',
          changedFiles: [],
          commit: null,
          httpStatus: 200,
          // modelAttempts intentionally undefined
        };
      },
    };

    const task = baseTask('TASK-OBS-D');
    const worker = new RouterWorker();
    worker.getProviderChain = () => [legacyProvider];

    const result = await (worker as any).executeWithRetry(task, testRepoUrl);
    expect(result.status).toBe('COMPLETED');
    const lastTrace = result.trace.attempts[0];
    expect(lastTrace).toBeDefined();
    expect(Array.isArray(lastTrace.fallbackChain)).toBe(true);
  });

  /**
   * Test E — Streaming
   * Validates OpenRouter streaming path with modelAttempts.
   * Verifies that modelAttempts is correctly populated and not duplicated during streaming chunk processing.
   */
  it('Test E: preserves modelAttempts and produces valid result in streaming mode', async () => {
    process.env.OPENROUTER_MODEL = 'model-stream-A:free';
    process.env.OPENROUTER_FALLBACK_MODELS = '';
    process.env.OPENROUTER_API_KEY = 'sk-test';
    process.env.OPENROUTER_STREAM_ENABLED = 'true';
    process.env.OPENROUTER_MAX_RETRIES = '0';
    process.env.OPENROUTER_RETRY_BASE_DELAY_MS = '0';

    const sseChunks = [
      'data: {"choices":[{"delta":{"content":"streaming response chunk 1"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":" chunk 2"}}]}\n\n',
      'data: {"choices":[{"finish_reason":"stop"}],"usage":{"prompt_tokens":10,"completion_tokens":5,"total_tokens":15}}\n\n',
      'data: [DONE]\n\n',
    ];

    const fetchMock = vi.fn(async (_url: string, _options: any) => {
      const stream = createMockReadableStream(sseChunks);
      return new Response(stream, {
        status: 200,
        headers: { 'content-type': 'text/event-stream' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const provider = new OpenRouterProvider('https://openrouter.ai/api/v1', 'sk-test', 2000, undefined, true);
    const result = await provider.execute(baseTask(), tempBase);

    expect(result.status).toBe('COMPLETED');
    expect((result as any).modelAttempts).toEqual(['model-stream-A:free']);
    expect(result.stdout).toContain('streaming response chunk 1 chunk 2');
  });
});

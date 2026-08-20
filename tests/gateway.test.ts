import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DualGatewayProvider } from '../src/providers/gateway.js';
import { RouterProvider } from '../src/providers/router.js';
import { OpenRouterProvider } from '../src/providers/openrouter.js';
import { createProvider, createSingleProvider } from '../src/agent.js';
import type { AgentProvider, ProviderTaskResult } from '../src/providers/types.js';

function baseTask() {
  return {
    id: 'TASK-GATEWAY-1',
    project: 'dual-gw-project',
    repository: 'https://github.com/test/repo.git',
    objective: 'Test dual inference gateway',
    prompt: 'Implement gateway fallback',
    status: 'RUNNING',
    priority: 0,
    worker: null,
    result: null,
    error: null,
    branch: null,
    commitSha: null,
    gitStatus: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as any;
}

class MockGatewayProvider implements AgentProvider {
  constructor(
    readonly kind: '9router' | 'openrouter' | 'mock',
    readonly model: string | null,
    private readonly results: ProviderTaskResult[],
  ) {}

  executeCalls = 0;

  async execute(): Promise<ProviderTaskResult> {
    this.executeCalls++;
    const res = this.results.shift();
    if (!res) throw new Error('No more mock results');
    return res;
  }

  async health() {
    return { available: true, details: `health for ${this.kind}` };
  }

  capabilities() {
    return ['coding', 'gateway-test'];
  }

  metadata() {
    return { kind: this.kind, model: this.model };
  }
}

describe('Dual Gateway Provider & Fallback Policy', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('Gateway Selection: instantiates 9router, openrouter or dual gateway correctly', () => {
    const prov9 = createSingleProvider('9router');
    expect(prov9.kind).toBe('9router');

    const provOR = createSingleProvider('openrouter');
    expect(provOR.kind).toBe('openrouter');

    // Dual gateway selection via env
    const prevPrimary = process.env.PRIMARY_GATEWAY;
    const prevFallback = process.env.FALLBACK_GATEWAY;
    try {
      process.env.PRIMARY_GATEWAY = '9router';
      process.env.FALLBACK_GATEWAY = 'openrouter';
      const dual = createProvider();
      expect(dual).toBeInstanceOf(DualGatewayProvider);
      expect((dual as DualGatewayProvider).primary.kind).toBe('9router');
      expect((dual as DualGatewayProvider).fallback.kind).toBe('openrouter');
    } finally {
      process.env.PRIMARY_GATEWAY = prevPrimary;
      process.env.FALLBACK_GATEWAY = prevFallback;
    }
  });

  it('Primary success (200) completes directly without calling fallback gateway', async () => {
    const primary = new MockGatewayProvider('9router', 'gemini/gemini-3.5-flash-lite', [
      {
        status: 'COMPLETED',
        provider: '9router',
        model: 'gemini/gemini-3.5-flash-lite',
        exitCode: 0,
        durationMs: 150,
        stdout: 'Success from 9router',
        stderr: '',
        changedFiles: ['file.ts'],
        commit: null,
        errorCode: null,
        errorMessage: null,
      },
    ]);

    const fallback = new MockGatewayProvider('openrouter', 'openrouter/free', [
      {
        status: 'COMPLETED',
        provider: 'openrouter',
        model: 'openrouter/free',
        exitCode: 0,
        durationMs: 200,
        stdout: 'Success from openrouter',
        stderr: '',
        changedFiles: ['file.ts'],
        commit: null,
        errorCode: null,
        errorMessage: null,
      },
    ]);

    const gateway = new DualGatewayProvider(primary, fallback);
    const result = await gateway.execute(baseTask(), 'C:/tmp/ws');

    expect(result.status).toBe('COMPLETED');
    expect(result.provider).toBe('9router');
    expect(result.stdout).toBe('Success from 9router');
    expect(primary.executeCalls).toBe(1);
    expect(fallback.executeCalls).toBe(0);
  });

  it('Fallback 9Router -> OpenRouter when primary encounters HTTP 429 rate limit', async () => {
    const primary = new MockGatewayProvider('9router', 'gemini/gemini-3.5-flash-lite', [
      {
        status: 'ROUTER_HTTP_ERROR',
        provider: '9router',
        model: 'gemini/gemini-3.5-flash-lite',
        exitCode: 429,
        httpStatus: 429,
        durationMs: 100,
        stdout: '',
        stderr: '9Router rate limit exceeded',
        changedFiles: [],
        commit: null,
        errorCode: 'ROUTER_HTTP_ERROR',
        errorMessage: 'HTTP 429: quota exhausted',
      },
    ]);

    const fallback = new MockGatewayProvider('openrouter', 'anthropic/claude-3.5-haiku', [
      {
        status: 'COMPLETED',
        provider: 'openrouter',
        model: 'anthropic/claude-3.5-haiku',
        exitCode: 0,
        durationMs: 220,
        stdout: 'Recovered via OpenRouter fallback',
        stderr: '',
        changedFiles: ['fix.ts'],
        commit: null,
        errorCode: null,
        errorMessage: null,
      },
    ]);

    const gateway = new DualGatewayProvider(primary, fallback);
    const result = await gateway.execute(baseTask(), 'C:/tmp/ws');

    expect(result.status).toBe('COMPLETED');
    expect(result.provider).toBe('openrouter');
    expect(result.model).toBe('anthropic/claude-3.5-haiku');
    expect(result.stdout).toBe('Recovered via OpenRouter fallback');
    expect(primary.executeCalls).toBe(1);
    expect(fallback.executeCalls).toBe(1);
  });

  it('Fallback 9Router -> OpenRouter when primary encounters HTTP 5xx server error', async () => {
    const primary = new MockGatewayProvider('9router', 'gemini/gemini-3.5-flash-lite', [
      {
        status: 'ROUTER_HTTP_ERROR',
        provider: '9router',
        model: 'gemini/gemini-3.5-flash-lite',
        exitCode: 503,
        httpStatus: 503,
        durationMs: 80,
        stdout: '',
        stderr: '9Router service unavailable',
        changedFiles: [],
        commit: null,
        errorCode: 'ROUTER_HTTP_ERROR',
        errorMessage: 'HTTP 503 Service Unavailable',
      },
    ]);

    const fallback = new MockGatewayProvider('openrouter', 'google/gemini-2.5-flash', [
      {
        status: 'COMPLETED',
        provider: 'openrouter',
        model: 'google/gemini-2.5-flash',
        exitCode: 0,
        durationMs: 180,
        stdout: 'Handled by OpenRouter',
        stderr: '',
        changedFiles: [],
        commit: null,
        errorCode: null,
        errorMessage: null,
      },
    ]);

    const gateway = new DualGatewayProvider(primary, fallback);
    const result = await gateway.execute(baseTask(), 'C:/tmp/ws');

    expect(result.status).toBe('COMPLETED');
    expect(result.provider).toBe('openrouter');
    expect(fallback.executeCalls).toBe(1);
  });

  it('Fallback 9Router -> OpenRouter when primary encounters timeout (ROUTER_TIMEOUT)', async () => {
    const primary = new MockGatewayProvider('9router', 'gemini/gemini-3.5-flash-lite', [
      {
        status: 'ROUTER_TIMEOUT',
        provider: '9router',
        model: 'gemini/gemini-3.5-flash-lite',
        exitCode: null,
        durationMs: 60000,
        stdout: '',
        stderr: 'Request timed out',
        changedFiles: [],
        commit: null,
        errorCode: 'ROUTER_TIMEOUT',
        errorMessage: '9Router request timed out',
      },
    ]);

    const fallback = new MockGatewayProvider('openrouter', 'openrouter/free', [
      {
        status: 'COMPLETED',
        provider: 'openrouter',
        model: 'openrouter/free',
        exitCode: 0,
        durationMs: 300,
        stdout: 'OpenRouter succeeded after primary timeout',
        stderr: '',
        changedFiles: [],
        commit: null,
        errorCode: null,
        errorMessage: null,
      },
    ]);

    const gateway = new DualGatewayProvider(primary, fallback);
    const result = await gateway.execute(baseTask(), 'C:/tmp/ws');

    expect(result.status).toBe('COMPLETED');
    expect(result.provider).toBe('openrouter');
    expect(fallback.executeCalls).toBe(1);
  });

  it('Fallback OpenRouter -> 9Router when OpenRouter is primary and fails with 429', async () => {
    const primary = new MockGatewayProvider('openrouter', 'openrouter/free', [
      {
        status: 'ROUTER_HTTP_ERROR',
        provider: 'openrouter',
        model: 'openrouter/free',
        exitCode: 429,
        httpStatus: 429,
        durationMs: 120,
        stdout: '',
        stderr: 'OpenRouter quota exceeded',
        changedFiles: [],
        commit: null,
        errorCode: 'ROUTER_HTTP_ERROR',
        errorMessage: 'HTTP 429',
      },
    ]);

    const fallback = new MockGatewayProvider('9router', 'gemini/gemini-3.5-flash-lite', [
      {
        status: 'COMPLETED',
        provider: '9router',
        model: 'gemini/gemini-3.5-flash-lite',
        exitCode: 0,
        durationMs: 250,
        stdout: 'Recovered on 9Router local provider',
        stderr: '',
        changedFiles: ['app.ts'],
        commit: null,
        errorCode: null,
        errorMessage: null,
      },
    ]);

    // Primary is OpenRouter, Fallback is 9Router
    const gateway = new DualGatewayProvider(primary, fallback);
    const result = await gateway.execute(baseTask(), 'C:/tmp/ws');

    expect(result.status).toBe('COMPLETED');
    expect(result.provider).toBe('9router');
    expect(result.stdout).toBe('Recovered on 9Router local provider');
    expect(primary.executeCalls).toBe(1);
    expect(fallback.executeCalls).toBe(1);
  });

  it('Both gateways fail -> returns final consistent error from fallback', async () => {
    const primary = new MockGatewayProvider('9router', 'gemini/gemini-3.5-flash-lite', [
      {
        status: 'ROUTER_HTTP_ERROR',
        provider: '9router',
        model: 'gemini/gemini-3.5-flash-lite',
        exitCode: 500,
        httpStatus: 500,
        durationMs: 100,
        stdout: '',
        stderr: '9Router failed',
        changedFiles: [],
        commit: null,
        errorCode: 'ROUTER_HTTP_ERROR',
        errorMessage: '500 Server Error',
      },
    ]);

    const fallback = new MockGatewayProvider('openrouter', 'openrouter/free', [
      {
        status: 'ROUTER_HTTP_ERROR',
        provider: 'openrouter',
        model: 'openrouter/free',
        exitCode: 503,
        httpStatus: 503,
        durationMs: 150,
        stdout: '',
        stderr: 'OpenRouter also failed',
        changedFiles: [],
        commit: null,
        errorCode: 'ROUTER_HTTP_ERROR',
        errorMessage: '503 Service Unavailable',
      },
    ]);

    const gateway = new DualGatewayProvider(primary, fallback);
    const result = await gateway.execute(baseTask(), 'C:/tmp/ws');

    expect(result.status).toBe('ROUTER_HTTP_ERROR');
    expect(result.provider).toBe('openrouter');
    expect(primary.executeCalls).toBe(1);
    expect(fallback.executeCalls).toBe(1);
  });

  it('Supports completely independent models per gateway', () => {
    const primary = new MockGatewayProvider('9router', 'oc/laguna-s-2.1-free', []);
    const fallback = new MockGatewayProvider('openrouter', 'meta-llama/llama-3.3-70b-instruct', []);

    const gateway = new DualGatewayProvider(primary, fallback);
    const metadata = gateway.metadata();

    expect(metadata.primaryModel).toBe('oc/laguna-s-2.1-free');
    expect(metadata.fallbackModel).toBe('meta-llama/llama-3.3-70b-instruct');
    expect(metadata.primaryProvider).toBe('9router');
    expect(metadata.fallbackProvider).toBe('openrouter');
  });
});

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
    objective: 'Test dual inference gateway hardening',
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

describe('Dual Gateway Provider & Hardened Fallback Policy', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('1. Gateway Selection: instantiates 9router, openrouter or dual gateway correctly', () => {
    const prov9 = createSingleProvider('9router');
    expect(prov9.kind).toBe('9router');

    const provOR = createSingleProvider('openrouter');
    expect(provOR.kind).toBe('openrouter');

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

  it('2. Primary success (COMPLETED) does NOT execute fallback', async () => {
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
    expect(primary.executeCalls).toBe(1);
    expect(fallback.executeCalls).toBe(0);
  });

  it('3. Primary fails BEFORE any tool call (clean workspace) -> Fallback is ALLOWED', async () => {
    const primary = new MockGatewayProvider('9router', 'gemini/gemini-3.5-flash-lite', [
      {
        status: 'ROUTER_HTTP_ERROR',
        provider: '9router',
        model: 'gemini/gemini-3.5-flash-lite',
        exitCode: 500,
        httpStatus: 500,
        durationMs: 80,
        stdout: '',
        stderr: 'Infrastructure error before start',
        changedFiles: [],
        toolCalls: 0,
        toolRounds: 0,
        commit: null,
        errorCode: 'ROUTER_HTTP_ERROR',
        errorMessage: 'HTTP 500',
      },
    ]);

    const fallback = new MockGatewayProvider('openrouter', 'openrouter/free', [
      {
        status: 'COMPLETED',
        provider: 'openrouter',
        model: 'openrouter/free',
        exitCode: 0,
        durationMs: 190,
        stdout: 'Completed via fallback',
        stderr: '',
        changedFiles: ['main.ts'],
        commit: null,
        errorCode: null,
        errorMessage: null,
      },
    ]);

    const gateway = new DualGatewayProvider(primary, fallback);
    const result = await gateway.execute(baseTask(), 'C:/tmp/ws');

    expect(result.status).toBe('COMPLETED');
    expect(result.provider).toBe('openrouter');
    expect(primary.executeCalls).toBe(1);
    expect(fallback.executeCalls).toBe(1);
  });

  it('4. Primary returns 429 BEFORE any tool call -> Fallback is ALLOWED', async () => {
    const primary = new MockGatewayProvider('9router', 'gemini/gemini-3.5-flash-lite', [
      {
        status: 'ROUTER_HTTP_ERROR',
        provider: '9router',
        model: 'gemini/gemini-3.5-flash-lite',
        exitCode: 429,
        httpStatus: 429,
        durationMs: 100,
        stdout: '',
        stderr: 'Rate limited before tool execution',
        changedFiles: [],
        toolCalls: 0,
        toolRounds: 0,
        commit: null,
        errorCode: 'ROUTER_HTTP_ERROR',
        errorMessage: 'HTTP 429: rate limit',
      },
    ]);

    const fallback = new MockGatewayProvider('openrouter', 'anthropic/claude-3.5-haiku', [
      {
        status: 'COMPLETED',
        provider: 'openrouter',
        model: 'anthropic/claude-3.5-haiku',
        exitCode: 0,
        durationMs: 250,
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
    expect(primary.executeCalls).toBe(1);
    expect(fallback.executeCalls).toBe(1);
  });

  it('5. Primary returns timeout BEFORE any tool call -> Fallback is ALLOWED', async () => {
    const primary = new MockGatewayProvider('9router', 'gemini/gemini-3.5-flash-lite', [
      {
        status: 'ROUTER_TIMEOUT',
        provider: '9router',
        model: 'gemini/gemini-3.5-flash-lite',
        exitCode: null,
        durationMs: 60000,
        stdout: '',
        stderr: 'Initial connection timed out',
        changedFiles: [],
        toolCalls: 0,
        toolRounds: 0,
        commit: null,
        errorCode: 'ROUTER_TIMEOUT',
        errorMessage: 'ROUTER_TIMEOUT',
      },
    ]);

    const fallback = new MockGatewayProvider('openrouter', 'openrouter/free', [
      {
        status: 'COMPLETED',
        provider: 'openrouter',
        model: 'openrouter/free',
        exitCode: 0,
        durationMs: 220,
        stdout: 'Recovered via fallback',
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
    expect(primary.executeCalls).toBe(1);
    expect(fallback.executeCalls).toBe(1);
  });

  it('6. Primary modifies file (changedFiles non-empty) and then fails -> Fallback is BLOCKED (PARTIAL_EXECUTION_REQUIRES_REVIEW)', async () => {
    const primary = new MockGatewayProvider('9router', 'gemini/gemini-3.5-flash-lite', [
      {
        status: 'ROUTER_HTTP_ERROR',
        provider: '9router',
        model: 'gemini/gemini-3.5-flash-lite',
        exitCode: 500,
        httpStatus: 500,
        durationMs: 4000,
        stdout: 'Wrote partial code',
        stderr: 'Server error on round 2',
        changedFiles: ['src/feature.ts'],
        toolCalls: 1,
        toolRounds: 1,
        commit: null,
        errorCode: 'ROUTER_HTTP_ERROR',
        errorMessage: '500 Server Error on second turn',
      },
    ]);

    const fallback = new MockGatewayProvider('openrouter', 'openrouter/free', [
      {
        status: 'COMPLETED',
        provider: 'openrouter',
        model: 'openrouter/free',
        exitCode: 0,
        durationMs: 100,
        stdout: 'Should not run on dirty workspace',
        stderr: '',
        changedFiles: [],
        commit: null,
        errorCode: null,
        errorMessage: null,
      },
    ]);

    const gateway = new DualGatewayProvider(primary, fallback);
    const result = await gateway.execute(baseTask(), 'C:/tmp/ws');

    // Hardening check: fallback MUST be blocked
    expect(result.status).toBe('FAILED');
    expect(result.errorCode).toBe('PARTIAL_EXECUTION_REQUIRES_REVIEW');
    expect(result.errorMessage).toContain('Partial execution detected');
    expect(result.errorMessage).toContain('src/feature.ts');
    expect(result.changedFiles).toEqual(['src/feature.ts']);
    expect(primary.executeCalls).toBe(1);
    expect(fallback.executeCalls).toBe(0); // Fallback was NEVER called
  });

  it('7. Primary executes tool call (toolCalls > 0) without changedFiles and fails -> Fallback is BLOCKED (Conservative Safety)', async () => {
    const primary = new MockGatewayProvider('9router', 'gemini/gemini-3.5-flash-lite', [
      {
        status: 'ROUTER_TIMEOUT',
        provider: '9router',
        model: 'gemini/gemini-3.5-flash-lite',
        exitCode: null,
        durationMs: 15000,
        stdout: 'Executed tool',
        stderr: 'Timeout during round 2',
        changedFiles: [],
        toolCalls: 2,
        toolRounds: 1,
        commit: null,
        errorCode: 'ROUTER_TIMEOUT',
        errorMessage: 'Timeout on round 2',
      },
    ]);

    const fallback = new MockGatewayProvider('openrouter', 'openrouter/free', [
      {
        status: 'COMPLETED',
        provider: 'openrouter',
        model: 'openrouter/free',
        exitCode: 0,
        durationMs: 100,
        stdout: 'Should not run',
        stderr: '',
        changedFiles: [],
        commit: null,
        errorCode: null,
        errorMessage: null,
      },
    ]);

    const gateway = new DualGatewayProvider(primary, fallback);
    const result = await gateway.execute(baseTask(), 'C:/tmp/ws');

    expect(result.status).toBe('FAILED');
    expect(result.errorCode).toBe('PARTIAL_EXECUTION_REQUIRES_REVIEW');
    expect(primary.executeCalls).toBe(1);
    expect(fallback.executeCalls).toBe(0);
  });

  it('8. Fallback OpenRouter -> 9Router when OpenRouter is primary and fails cleanly (0 tool calls)', async () => {
    const primary = new MockGatewayProvider('openrouter', 'openrouter/free', [
      {
        status: 'ROUTER_HTTP_ERROR',
        provider: 'openrouter',
        model: 'openrouter/free',
        exitCode: 429,
        httpStatus: 429,
        durationMs: 120,
        stdout: '',
        stderr: 'OpenRouter quota exceeded before start',
        changedFiles: [],
        toolCalls: 0,
        toolRounds: 0,
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

    const gateway = new DualGatewayProvider(primary, fallback);
    const result = await gateway.execute(baseTask(), 'C:/tmp/ws');

    expect(result.status).toBe('COMPLETED');
    expect(result.provider).toBe('9router');
    expect(result.stdout).toBe('Recovered on 9Router local provider');
    expect(primary.executeCalls).toBe(1);
    expect(fallback.executeCalls).toBe(1);
  });

  it('9. Both gateways fail cleanly -> returns consistent combined error', async () => {
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
        toolCalls: 0,
        toolRounds: 0,
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
        toolCalls: 0,
        toolRounds: 0,
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

  it('10. Observability: registers primary provider, model, changedFiles, toolCalls on blocked fallback', async () => {
    const primary = new MockGatewayProvider('9router', 'gemini/gemini-3.5-flash-lite', [
      {
        status: 'ROUTER_HTTP_ERROR',
        provider: '9router',
        model: 'gemini/gemini-3.5-flash-lite',
        exitCode: 429,
        httpStatus: 429,
        durationMs: 3500,
        stdout: 'First step completed',
        stderr: 'Quota exceeded on second step',
        changedFiles: ['lib/auth.ts'],
        toolCalls: 1,
        toolRounds: 1,
        commit: null,
        errorCode: 'ROUTER_HTTP_ERROR',
        errorMessage: 'Rate limit after tool execution',
      },
    ]);

    const fallback = new MockGatewayProvider('openrouter', 'openrouter/free', []);

    const gateway = new DualGatewayProvider(primary, fallback);
    const result = await gateway.execute(baseTask(), 'C:/tmp/ws');

    expect(result.errorCode).toBe('PARTIAL_EXECUTION_REQUIRES_REVIEW');
    expect(result.provider).toBe('9router');
    expect(result.model).toBe('gemini/gemini-3.5-flash-lite');
    expect(result.toolCalls).toBe(1);
    expect(result.toolRounds).toBe(1);
    expect(result.changedFiles).toEqual(['lib/auth.ts']);
    expect(result.stderr).toContain('PARTIAL_EXECUTION_REQUIRES_REVIEW');
    expect(fallback.executeCalls).toBe(0);
  });

  it('11. Fallback result fidelity: preserves all fields from fallback provider when fallback executes', async () => {
    const primary = new MockGatewayProvider('9router', 'gemini/gemini-3.5-flash-lite', [
      {
        status: 'ROUTER_HTTP_ERROR',
        provider: '9router',
        model: 'gemini/gemini-3.5-flash-lite',
        exitCode: 429,
        httpStatus: 429,
        durationMs: 50,
        stdout: '',
        stderr: 'Initial 429',
        changedFiles: [],
        toolCalls: 0,
        toolRounds: 0,
        commit: null,
        errorCode: 'ROUTER_HTTP_ERROR',
        errorMessage: 'Initial rate limit',
      },
    ]);

    const fallback = new MockGatewayProvider('openrouter', 'poolside/laguna-s-2.1:free', [
      {
        status: 'COMPLETED',
        provider: 'openrouter',
        model: 'poolside/laguna-s-2.1:free',
        exitCode: 0,
        durationMs: 450,
        stdout: 'Generated full response',
        stderr: 'no error',
        changedFiles: ['src/app.ts', 'src/types.ts'],
        toolCalls: 2,
        toolRounds: 2,
        commit: null,
        errorCode: null,
        errorMessage: null,
        httpStatus: 200,
      },
    ]);

    const gateway = new DualGatewayProvider(primary, fallback);
    const result = await gateway.execute(baseTask(), 'C:/tmp/ws');

    expect(result.status).toBe('COMPLETED');
    expect(result.provider).toBe('openrouter');
    expect(result.model).toBe('poolside/laguna-s-2.1:free');
    expect(result.stdout).toBe('Generated full response');
    expect(result.stderr).toBe('no error');
    expect(result.changedFiles).toEqual(['src/app.ts', 'src/types.ts']);
    expect(result.toolCalls).toBe(2);
    expect(result.toolRounds).toBe(2);
    expect(result.httpStatus).toBe(200);
  });

  it('12. Two-tier fallback: OpenRouter completes on internal model retry without touching 9Router', async () => {
    // OpenRouter internally tried model 1 (failed), then model 2 (succeeded)
    const openrouterPrimary = new MockGatewayProvider('openrouter', 'poolside/laguna-s-2.1:free', [
      {
        status: 'COMPLETED',
        provider: 'openrouter',
        model: 'poolside/laguna-s-2.1:free',
        exitCode: 0,
        durationMs: 350,
        stdout: 'Success on second internal OpenRouter model',
        stderr: '',
        changedFiles: ['test.ts'],
        commit: null,
        errorCode: null,
        errorMessage: null,
      },
    ]);

    const nineRouterSecondary = new MockGatewayProvider('9router', 'gemini/gemini-3.7-flash', []);

    const gateway = new DualGatewayProvider(openrouterPrimary, nineRouterSecondary);
    const result = await gateway.execute(baseTask(), 'C:/tmp/ws');

    expect(result.status).toBe('COMPLETED');
    expect(result.provider).toBe('openrouter');
    expect(result.model).toBe('poolside/laguna-s-2.1:free');
    expect(openrouterPrimary.executeCalls).toBe(1);
    expect(nineRouterSecondary.executeCalls).toBe(0);
  });

  it('13. Two-tier fallback: OpenRouter exhausts all internal models (GATEWAY_EXHAUSTED) -> triggers 9Router secondary which completes', async () => {
    const openrouterPrimary = new MockGatewayProvider('openrouter', 'openrouter/free', [
      {
        status: 'FAILED',
        provider: 'openrouter',
        model: 'openrouter/free',
        exitCode: null,
        durationMs: 400,
        stdout: '',
        stderr: 'All configured OpenRouter models failed',
        changedFiles: [],
        toolCalls: 0,
        toolRounds: 0,
        commit: null,
        errorCode: 'GATEWAY_EXHAUSTED',
        errorMessage: 'All configured OpenRouter models failed',
      },
    ]);

    const nineRouterSecondary = new MockGatewayProvider('9router', 'gemini/gemini-3.7-flash', [
      {
        status: 'COMPLETED',
        provider: '9router',
        model: 'gemini/gemini-3.7-flash',
        exitCode: 0,
        durationMs: 280,
        stdout: 'Success from 9Router secondary gateway',
        stderr: '',
        changedFiles: ['index.ts'],
        commit: null,
        errorCode: null,
        errorMessage: null,
      },
    ]);

    const gateway = new DualGatewayProvider(openrouterPrimary, nineRouterSecondary);
    const result = await gateway.execute(baseTask(), 'C:/tmp/ws');

    expect(result.status).toBe('COMPLETED');
    expect(result.provider).toBe('9router');
    expect(result.model).toBe('gemini/gemini-3.7-flash');
    expect(openrouterPrimary.executeCalls).toBe(1);
    expect(nineRouterSecondary.executeCalls).toBe(1);
  });

  it('14. Two-tier fallback: OpenRouter and 9Router both exhaust all models -> returns terminal failure without leaking secrets', async () => {
    const openrouterPrimary = new MockGatewayProvider('openrouter', 'openrouter/free', [
      {
        status: 'FAILED',
        provider: 'openrouter',
        model: 'openrouter/free',
        exitCode: null,
        durationMs: 300,
        stdout: '',
        stderr: 'All OpenRouter models failed with Bearer [REDACTED]',
        changedFiles: [],
        toolCalls: 0,
        toolRounds: 0,
        commit: null,
        errorCode: 'ALL_PROVIDERS_FAILED',
        errorMessage: 'All configured OpenRouter models failed',
      },
    ]);

    const nineRouterSecondary = new MockGatewayProvider('9router', 'gemini/gemini-3.7-flash', [
      {
        status: 'FAILED',
        provider: '9router',
        model: 'gemini/gemini-3.7-flash',
        exitCode: null,
        durationMs: 250,
        stdout: '',
        stderr: 'All 9Router models failed',
        changedFiles: [],
        toolCalls: 0,
        toolRounds: 0,
        commit: null,
        errorCode: 'ALL_PROVIDERS_FAILED',
        errorMessage: 'All configured 9Router models failed',
      },
    ]);

    const gateway = new DualGatewayProvider(openrouterPrimary, nineRouterSecondary);
    const result = await gateway.execute(baseTask(), 'C:/tmp/ws');

    expect(result.status).toBe('FAILED');
    expect(result.provider).toBe('9router');
    expect(result.errorCode).toBe('ALL_PROVIDERS_FAILED');
    expect(result.stderr).not.toContain('sk-or-v1');
    expect(openrouterPrimary.executeCalls).toBe(1);
    expect(nineRouterSecondary.executeCalls).toBe(1);
  });
});

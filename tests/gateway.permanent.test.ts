import { describe, expect, it, beforeEach, vi } from 'vitest';
import { DualGatewayProvider } from '../src/providers/gateway.js';
import type { AgentProvider, ProviderTaskResult } from '../src/providers/types.js';

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
  capabilities() { return ['test']; }
  metadata() { return { kind: this.kind, model: this.model }; }
}

function baseTask() {
  return {
    id: 'TASK-GATEWAY-PERMANENT',
    project: 'dual-gw-permanent',
    repository: 'https://github.com/test/repo.git',
    objective: 'Validate fallback behaviour',
    prompt: 'fallback test',
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

describe('Permanent DualGatewayProvider fallback tests', () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it('retryable primary failure triggers fallback (COMPLETED)', async () => {
    const primary = new MockGatewayProvider('openrouter', 'openrouter/free', [{
      status: 'ROUTER_CONNECTION_ERROR', provider: 'openrouter', model: 'openrouter/free',
      exitCode: null, httpStatus: undefined, durationMs: 50, stdout: '', stderr: 'connection lost',
      changedFiles: [], toolCalls: 0, toolRounds: 0, commit: null,
      errorCode: 'ROUTER_CONNECTION_ERROR', errorMessage: 'connection lost',
    }]);
    const fallback = new MockGatewayProvider('9router', 'gpt-3.5-turbo', [{
      status: 'COMPLETED', provider: '9router', model: 'gpt-3.5-turbo', exitCode: 0, durationMs: 120,
      stdout: 'fallback success', stderr: '', changedFiles: [], toolCalls: 0, toolRounds: 0, commit: null,
      errorCode: null, errorMessage: null,
    }]);
    const gw = new DualGatewayProvider(primary, fallback);
    const result = await gw.execute(baseTask(), 'C:/tmp/ws');
    expect(result.status).toBe('COMPLETED');
    expect(result.provider).toBe('9router');
    expect(result.model).toBe('gpt-3.5-turbo');
    expect(primary.executeCalls).toBe(1);
    expect(fallback.executeCalls).toBe(1);
  });

  it('non-retryable primary (TOOL_LOOP_LIMIT) does NOT fallback', async () => {
    const primary = new MockGatewayProvider('openrouter', 'openrouter/free', [{
      status: 'TOOL_LOOP_LIMIT', provider: 'openrouter', model: 'openrouter/free', exitCode: 1,
      durationMs: 200, stdout: '', stderr: 'too many tool rounds', changedFiles: [], toolCalls: 0,
      toolRounds: 0, commit: null, errorCode: null, errorMessage: null,
    }]);
    const fallback = new MockGatewayProvider('9router', 'gpt-3.5-turbo', []);
    const gw = new DualGatewayProvider(primary, fallback);
    const result = await gw.execute(baseTask(), 'C:/tmp/ws');
    expect(result.status).toBe('TOOL_LOOP_LIMIT');
    expect(result.provider).toBe('openrouter');
    expect(primary.executeCalls).toBe(1);
    expect(fallback.executeCalls).toBe(0);
  });

  it('mutable-effects guard blocks fallback', async () => {
    const primary = new MockGatewayProvider('openrouter', 'openrouter/free', [{
      status: 'ROUTER_HTTP_ERROR', provider: 'openrouter', model: 'openrouter/free', exitCode: 500,
      httpStatus: 500, durationMs: 80, stdout: '', stderr: 'failed after file write',
      changedFiles: ['src/dirty.ts'], toolCalls: 1, toolRounds: 1, commit: null,
      errorCode: 'ROUTER_HTTP_ERROR', errorMessage: '500 error',
    }]);
    const fallback = new MockGatewayProvider('9router', 'gpt-3.5-turbo', []);
    const gw = new DualGatewayProvider(primary, fallback);
    const result = await gw.execute(baseTask(), 'C:/tmp/ws');
    expect(result.status).toBe('FAILED');
    expect(result.errorCode).toBe('PARTIAL_EXECUTION_REQUIRES_REVIEW');
    expect(result.changedFiles).toEqual(['src/dirty.ts']);
    expect(primary.executeCalls).toBe(1);
    expect(fallback.executeCalls).toBe(0);
  });

  it('fallback result fields are preserved exactly', async () => {
    const primary = new MockGatewayProvider('openrouter', 'openrouter/free', [{
      status: 'ROUTER_TIMEOUT', provider: 'openrouter', model: 'openrouter/free', exitCode: null,
      durationMs: 60000, stdout: '', stderr: 'timeout', changedFiles: [], toolCalls: 0,
      toolRounds: 0, commit: null, errorCode: 'ROUTER_TIMEOUT', errorMessage: 'timeout',
    }]);
    const fallback = new MockGatewayProvider('9router', 'gpt-3.5-turbo', [{
      status: 'COMPLETED', provider: '9router', model: 'gpt-3.5-turbo', exitCode: 0, durationMs: 150,
      stdout: 'final answer', stderr: '', changedFiles: ['src/result.ts'], toolCalls: 2, toolRounds: 2,
      commit: null, errorCode: null, errorMessage: null, httpStatus: 200,
    }]);
    const gw = new DualGatewayProvider(primary, fallback);
    const result = await gw.execute(baseTask(), 'C:/tmp/ws');
    expect(result.status).toBe('COMPLETED');
    expect(result.provider).toBe('9router');
    expect(result.model).toBe('gpt-3.5-turbo');
    expect(result.stdout).toBe('final answer');
    expect(result.stderr).toBe('');
    expect(result.changedFiles).toEqual(['src/result.ts']);
    expect(result.toolCalls).toBe(2);
    expect(result.toolRounds).toBe(2);
    expect(result.httpStatus).toBe(200);
  });
});

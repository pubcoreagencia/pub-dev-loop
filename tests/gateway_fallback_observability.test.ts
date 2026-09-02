// tests/gateway_fallback_observability.test.ts
import { test, expect, describe } from 'vitest';
import { DualGatewayProvider } from '../src/providers/gateway.js';
import type { ProviderTaskResult, AgentProvider, ProviderKind, Task } from '../src/providers/types.js';
import type { Task as DomainTask } from '../src/domain.js';

// Minimal mock task definition
const mockTask: DomainTask = {
  id: 'test-task',
  objective: 'test',
} as any;

class MockProvider implements AgentProvider {
  readonly kind: ProviderKind;
  readonly model: string | null;
  private result: ProviderTaskResult;
  constructor(kind: ProviderKind, model: string | null, result: ProviderTaskResult) {
    this.kind = kind;
    this.model = model;
    this.result = result;
  }
  async execute(_: Task, __: string, ___?: any): Promise<ProviderTaskResult> {
    return this.result;
  }
  async health() { return { available: true, details: '' }; }
  capabilities() { return []; }
  metadata() { return {}; }
}

/** Helper to invoke the dual gateway and return its ProviderTaskResult */
async function runDual(primary: AgentProvider, fallback: AgentProvider) {
  const dual = new DualGatewayProvider(primary, fallback);
  return await dual.execute(mockTask, '/tmp/ws', {});
}

describe('Gateway fallback observability contract', () => {
  test('A. Primary COMPLETED → fallback not called', async () => {
    const primary = new MockProvider('openrouter', 'modelA', {
      status: 'COMPLETED', provider: 'openrouter', model: 'modelA', exitCode: 0, durationMs: 10, stdout: '', stderr: ''
    });
    const fallback = new MockProvider('9router', 'modelB', {
      status: 'COMPLETED', provider: '9router', model: 'modelB', exitCode: 0, durationMs: 5, stdout: '', stderr: ''
    });
    const result = await runDual(primary, fallback);
    expect(result.fallbackUsed).toBeUndefined();
  });

  test('B. Primary FAILED without mutable effects → fallback succeeds → fallbackUsed true', async () => {
    const primary = new MockProvider('openrouter', 'modelA', {
      status: 'FAILED', provider: 'openrouter', model: 'modelA', exitCode: 1, durationMs: 10, stdout: '', stderr: ''
    });
    const fallback = new MockProvider('9router', 'modelB', {
      status: 'COMPLETED', provider: '9router', model: 'modelB', exitCode: 0, durationMs: 5, stdout: '', stderr: ''
    });
    const result = await runDual(primary, fallback);
    expect(result.fallbackUsed).toBe(true);
    expect(result.validationResult == null).toBe(true);
    expect(result.errorClass == null).toBe(true);
  });

  test('C. Primary FAILED without mutable effects → fallback throws → fallbackUsed true', async () => {
    const primary = new MockProvider('openrouter', 'modelA', {
      status: 'FAILED', provider: 'openrouter', model: 'modelA', exitCode: 1, durationMs: 10, stdout: '', stderr: ''
    });
    const fallback: AgentProvider = {
      kind: '9router',
      model: 'modelB',
      async execute() { throw new Error('fallback error'); },
      async health() { return { available: true, details: '' }; },
      capabilities() { return []; },
      metadata() { return {}; },
    } as any;
    const result = await runDual(primary, fallback);
    expect(result.fallbackUsed).toBe(true);
    expect(result.validationResult == null).toBe(true);
    expect(result.errorClass == null).toBe(true);
  });

  test('D. Primary FAILED with mutable effects → fallback not called', async () => {
    const primary = new MockProvider('openrouter', 'modelA', {
      status: 'FAILED',
      provider: 'openrouter',
      model: 'modelA',
      exitCode: 1,
      durationMs: 10,
      stdout: '',
      stderr: '',
      changedFiles: ['file.txt'],
      toolCalls: 1,
    } as any);
    const fallback = new MockProvider('9router', 'modelB', {
      status: 'COMPLETED', provider: '9router', model: 'modelB', exitCode: 0, durationMs: 5, stdout: '', stderr: ''
    });
    const result = await runDual(primary, fallback);
    expect(result.fallbackUsed).toBeUndefined();
  });

  test('E. Model fallback within same gateway → fallbackUsed undefined', async () => {
    // Same kind for primary and fallback (model switch inside same provider)
    const provider = new MockProvider('openrouter', null, {
      status: 'COMPLETED', provider: 'openrouter', model: 'modelB', exitCode: 0, durationMs: 5, stdout: '', stderr: ''
    });
    const dual = new DualGatewayProvider(provider, provider);
    const result = await dual.execute(mockTask, '/tmp/ws', {});
    expect(result.fallbackUsed).toBeUndefined();
  });

  test('F. Retry of same model without gateway fallback → fallbackUsed undefined', async () => {
    // Primary provider succeeds (e.g. after internal retry) without invoking gateway fallback
    const primary = new MockProvider('openrouter', 'modelA', {
      status: 'COMPLETED', provider: 'openrouter', model: 'modelA', exitCode: 0, durationMs: 10, stdout: '', stderr: ''
    });
    const unusedFallback = new MockProvider('9router', 'modelB', {
      status: 'COMPLETED', provider: '9router', model: 'modelB', exitCode: 0, durationMs: 5, stdout: '', stderr: ''
    });
    const dual = new DualGatewayProvider(primary, unusedFallback);
    const result = await dual.execute(mockTask, '/tmp/ws', {});
    expect(result.fallbackUsed).toBeUndefined();
  });

  test('G. Compatibility when ProviderTaskResult lacks new fields', async () => {
    const primary: AgentProvider = {
      kind: 'openrouter',
      model: 'modelA',
      async execute() {
        return { status: 'FAILED', provider: 'openrouter', model: 'modelA', exitCode: 1, durationMs: 10, stdout: '', stderr: '' } as any;
      },
      async health() { return { available: true, details: '' }; },
      capabilities() { return []; },
      metadata() { return {}; },
    } as any;
    const fallback = new MockProvider('9router', 'modelB', {
      status: 'COMPLETED', provider: '9router', model: 'modelB', exitCode: 0, durationMs: 5, stdout: '', stderr: ''
    });
    const dual = new DualGatewayProvider(primary, fallback);
    const result = await dual.execute(mockTask, '/tmp/ws', {});
    expect(result.fallbackUsed).toBe(true);
    expect((result as any).validationResult).toBeUndefined();
    expect((result as any).errorClass).toBeUndefined();
  });
});

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createProvider, createAgent } from '../src/agent.js';
import { DualGatewayProvider } from '../src/providers/gateway.js';
import { RouterProvider } from '../src/providers/router.js';
import type { Task } from '../src/domain.js';
import type { AgentProvider, ProviderTaskResult } from '../src/providers/types.js';

describe('P1-CFG-01: Dual Gateway Runtime Selection & Integration', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('9. DualGatewayProvider é selecionado quando AGENT_PROVIDER_FALLBACK está configurado', () => {
    process.env.AGENT_PROVIDER = '9router';
    process.env.AGENT_PROVIDER_FALLBACK = 'openrouter';
    process.env.OPENROUTER_API_KEY = 'sk-or-v1-test';
    process.env.ROUTER_MODEL = 'openai/gpt-4o-mini';

    const provider = createProvider('9router');
    expect(provider).toBeInstanceOf(DualGatewayProvider);
    const dual = provider as DualGatewayProvider;
    expect(dual.primary).toBeInstanceOf(RouterProvider);
    expect(dual.fallback).toBeInstanceOf(RouterProvider);
    expect(dual.metadata().fallbackProvider).toBe('9router');
  });

  it('10. DualGatewayProvider é selecionado automaticamente quando OPENROUTER_API_KEY está presente com 9router', () => {
    process.env.AGENT_PROVIDER = '9router';
    delete process.env.AGENT_PROVIDER_FALLBACK;
    process.env.OPENROUTER_API_KEY = 'sk-or-v1-test';
    process.env.ROUTER_MODEL = 'openai/gpt-4o-mini';

    const provider = createProvider('9router');
    expect(provider).toBeInstanceOf(DualGatewayProvider);
  });

  it('11. RouterProvider continua sendo usado quando fallback não está configurado', () => {
    process.env.AGENT_PROVIDER = '9router';
    delete process.env.AGENT_PROVIDER_FALLBACK;
    delete process.env.OPENROUTER_API_KEY;
    process.env.ROUTER_MODEL = 'openai/gpt-4o-mini';

    const provider = createProvider('9router');
    expect(provider).toBeInstanceOf(RouterProvider);
    expect(provider).not.toBeInstanceOf(DualGatewayProvider);
  });

  it('12. DualGatewayProvider executa fallback quando primário sofre falha de gateway retryable', async () => {
    const dummyTask: Task = {
      id: 'task-gw-1',
      project: 'p',
      repository: 'https://example.com/repo.git',
      objective: 'test',
      prompt: 'do something',
      priority: 0,
      status: 'QUEUED',
      worker: null,
      result: null,
      error: null,
      branch: null,
      commitSha: null,
      gitStatus: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    class MockFailingPrimary implements AgentProvider {
      readonly kind = '9router' as const;
      readonly model = 'primary-model';
      async execute(_task: Task, _workspace: string): Promise<ProviderTaskResult> {
        return {
          status: 'ROUTER_HTTP_ERROR',
          provider: this.kind,
          model: this.model,
          exitCode: 503,
          durationMs: 100,
          stdout: '',
          stderr: 'Primary gateway overloaded 503',
          changedFiles: [],
          commit: null,
          errorCode: 'ROUTER_HTTP_ERROR',
          errorMessage: '503 Service Unavailable',
          httpStatus: 503,
        };
      }
      async health() { return { available: false, details: '503' }; }
      capabilities() { return ['coding']; }
      metadata() { return {}; }
    }

    class MockWorkingFallback implements AgentProvider {
      readonly kind = '9router' as const;
      readonly model = 'fallback-openrouter-model';
      async execute(_task: Task, _workspace: string): Promise<ProviderTaskResult> {
        return {
          status: 'COMPLETED',
          provider: this.kind,
          model: this.model,
          exitCode: 0,
          durationMs: 150,
          stdout: 'Success via fallback gateway',
          stderr: '',
          changedFiles: ['app.ts'],
          commit: null,
          errorCode: null,
          errorMessage: null,
          toolCalls: 1,
        };
      }
      async health() { return { available: true, details: 'ok' }; }
      capabilities() { return ['coding']; }
      metadata() { return {}; }
    }

    const dualGateway = new DualGatewayProvider(new MockFailingPrimary(), new MockWorkingFallback());
    const result = await dualGateway.execute(dummyTask, '/tmp');

    expect(result.status).toBe('COMPLETED');
    expect(result.stdout).toBe('Success via fallback gateway');
    expect(result.model).toBe('fallback-openrouter-model');
  });

  it('13. DualGatewayProvider bloqueia fallback quando primário realizou alterações parciais', async () => {
    const dummyTask: Task = {
      id: 'task-gw-2',
      project: 'p',
      repository: 'https://example.com/repo.git',
      objective: 'test',
      prompt: 'do something',
      priority: 0,
      status: 'QUEUED',
      worker: null,
      result: null,
      error: null,
      branch: null,
      commitSha: null,
      gitStatus: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    class MockPartialPrimary implements AgentProvider {
      readonly kind = '9router' as const;
      readonly model = 'primary-model';
      async execute(_task: Task, _workspace: string): Promise<ProviderTaskResult> {
        return {
          status: 'FAILED',
          provider: this.kind,
          model: this.model,
          exitCode: 1,
          durationMs: 100,
          stdout: '',
          stderr: 'Failed after tool calls',
          changedFiles: ['dirty.txt'],
          commit: null,
          errorCode: 'PARTIAL_FAIL',
          errorMessage: 'Partial error',
          toolCalls: 2,
        };
      }
      async health() { return { available: true, details: 'ok' }; }
      capabilities() { return ['coding']; }
      metadata() { return {}; }
    }

    let fallbackCalled = false;
    class MockUncalledFallback implements AgentProvider {
      readonly kind = '9router' as const;
      readonly model = 'fallback-model';
      async execute(_task: Task, _workspace: string): Promise<ProviderTaskResult> {
        fallbackCalled = true;
        return { status: 'COMPLETED', provider: this.kind, model: this.model, exitCode: 0, durationMs: 0, stdout: '', stderr: '', changedFiles: [], commit: null, errorCode: null, errorMessage: null };
      }
      async health() { return { available: true, details: 'ok' }; }
      capabilities() { return ['coding']; }
      metadata() { return {}; }
    }

    const dualGateway = new DualGatewayProvider(new MockPartialPrimary(), new MockUncalledFallback());
    const result = await dualGateway.execute(dummyTask, '/tmp');

    expect(result.status).toBe('FAILED');
    expect(result.errorCode).toBe('PARTIAL_EXECUTION_REQUIRES_REVIEW');
    expect(fallbackCalled).toBe(false);
  });
});

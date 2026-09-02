import { describe, it, expect } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import { RouterWorker } from '../src/router-worker';
import { Task } from '../src/types';
import { ProviderTaskResult } from '../src/providers';
import { OpenRouterProvider } from '../src/providers/openrouter';

async function createLocalRepo(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'test-repo-'));
  execSync('git init', { cwd: dir, stdio: 'ignore' });
  execSync('git config user.name "TEST"', { cwd: dir, stdio: 'ignore' });
  execSync('git config user.email "test@test.com"', { cwd: dir, stdio: 'ignore' });
  execSync('git commit --allow-empty -m "init"', { cwd: dir, stdio: 'ignore' });
  return dir;
}

class ErrorProvider extends OpenRouterProvider {
  constructor(public readonly kind: string, public readonly model: string) {
    super('', '', 1000, model);
  }
  async execute(_: Task, __: string, ___: any): Promise<ProviderTaskResult> {
    throw new Error('simulated provider failure');
  }
}

class SuccessProvider extends OpenRouterProvider {
  constructor(public readonly kind: string, public readonly model: string) {
    super('', '', 1000, model);
  }
  async execute(_: Task, __: string, ___: any): Promise<ProviderTaskResult> {
    return {
      status: 'COMPLETED',
      provider: this.kind,
      model: this.model,
      exitCode: 0,
      durationMs: 10,
      stdout: 'ok',
      stderr: '',
      changedFiles: [],
      commit: null,
      errorCode: undefined,
      errorMessage: undefined,
      toolCalls: 0,
      toolRounds: 0,
      httpStatus: 200,
    };
  }
}

describe('RouterWorker fallbackChain on error/timeout', () => {
  it('records both attempts when first provider fails', async () => {
    const origMaxAttempts = process.env.ROUTER_MAX_ATTEMPTS;
    process.env.ROUTER_MAX_ATTEMPTS = '2';
    const localRepo = await createLocalRepo();
    try {
      const task: Task = {
        id: 'dummy',
        prototypeSessionId: 'sess',
        objective: 'test-action',
        branch: undefined,
      };

      const worker = new RouterWorker();
      // @ts-ignore – replace internal method for the test
      worker.getProviderChain = () => [
        new ErrorProvider('openrouter', 'model-A'),
        new SuccessProvider('openrouter', 'model-B'),
      ];

      const result = await (worker as any).executeWithRetry(task, localRepo);
      const lastTrace = result.trace.attempts[result.trace.attempts.length - 1];
      expect(lastTrace.fallbackChain).toEqual([
        'openrouter/model-A',
        'openrouter/model-B',
      ]);
      expect(lastTrace.action).toBe('test-action');
      expect(lastTrace.gateway).toBe('openrouter');
    } finally {
      if (origMaxAttempts !== undefined) {
        process.env.ROUTER_MAX_ATTEMPTS = origMaxAttempts;
      } else {
        delete process.env.ROUTER_MAX_ATTEMPTS;
      }
      await rm(localRepo, { recursive: true, force: true }).catch(() => {});
    }
  });
});

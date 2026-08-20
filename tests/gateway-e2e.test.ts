import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { DualGatewayProvider } from '../src/providers/gateway.js';
import { ToolRuntime } from '../src/tools/runtime.js';
import type { AgentProvider, ProviderTaskResult } from '../src/providers/types.js';
import type { Task } from '../src/domain.js';

function createTask(): Task {
  return {
    id: 'TASK-E2E-GW-1',
    project: 'e2e-project',
    repository: 'https://github.com/test/repo.git',
    objective: 'Validate realistic dual gateway fallback hardening',
    prompt: 'Create index.ts and styles.css',
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
  };
}

describe('Realistic Dual Gateway Fallback Hardening E2E', () => {
  let workspace: string;

  beforeEach(async () => {
    workspace = await mkdtemp(join(tmpdir(), 'pdl-gateway-e2e-'));
  });

  afterEach(async () => {
    if (workspace) {
      await rm(workspace, { recursive: true, force: true }).catch(() => undefined);
    }
  });

  it('Realistic E2E Scenario 1: Primary provider writes file to workspace and then fails on turn 2 -> Fallback is BLOCKED', async () => {
    let fallbackWasCalled = false;

    // Primary provider: performs real write_file on disk in round 1, then gets a gateway 500 error on round 2
    const primaryProvider: AgentProvider = {
      kind: '9router',
      model: 'gemini/gemini-3.5-flash-lite',
      async execute(task, ws): Promise<ProviderTaskResult> {
        const runtime = new ToolRuntime({ workspaceRoot: ws, maxRounds: 10, maxToolCalls: 10 });
        // Model executes write_file on workspace
        await runtime.executeTool('call_1', 'write_file', {
          path: 'index.ts',
          content: 'export const hello = "world";',
        });

        // Mid-execution network/gateway drop occurs
        return {
          status: 'ROUTER_HTTP_ERROR',
          provider: '9router',
          model: 'gemini/gemini-3.5-flash-lite',
          exitCode: 500,
          httpStatus: 500,
          durationMs: 1200,
          stdout: 'Created index.ts',
          stderr: 'Gateway dropped during subsequent reasoning step',
          changedFiles: runtime.getChangedFiles(),
          toolCalls: 1,
          toolRounds: 1,
          commit: null,
          errorCode: 'ROUTER_HTTP_ERROR',
          errorMessage: '500 Server Error',
        };
      },
      async health() { return { available: true, details: 'ok' }; },
      capabilities() { return ['coding']; },
      metadata() { return {}; },
    };

    const fallbackProvider: AgentProvider = {
      kind: 'openrouter',
      model: 'openrouter/free',
      async execute(): Promise<ProviderTaskResult> {
        fallbackWasCalled = true;
        return {
          status: 'COMPLETED',
          provider: 'openrouter',
          model: 'openrouter/free',
          exitCode: 0,
          durationMs: 500,
          stdout: 'Fallback completed',
          stderr: '',
          changedFiles: [],
          commit: null,
          errorCode: null,
          errorMessage: null,
        };
      },
      async health() { return { available: true, details: 'ok' }; },
      capabilities() { return ['coding']; },
      metadata() { return {}; },
    };

    const gateway = new DualGatewayProvider(primaryProvider, fallbackProvider);
    const result = await gateway.execute(createTask(), workspace);

    // Assert that the file was written to disk
    const content = await readFile(join(workspace, 'index.ts'), 'utf8');
    expect(content).toBe('export const hello = "world";');

    // Assert that the fallback was BLOCKED due to partial execution
    expect(result.status).toBe('FAILED');
    expect(result.errorCode).toBe('PARTIAL_EXECUTION_REQUIRES_REVIEW');
    expect(result.changedFiles).toEqual(['index.ts']);
    expect(result.toolCalls).toBe(1);
    expect(fallbackWasCalled).toBe(false);
  });

  it('Realistic E2E Scenario 2: Primary provider fails BEFORE writing anything to disk -> Fallback is executed and succeeds', async () => {
    let fallbackWasCalled = false;

    // Primary provider: fails with HTTP 429 immediately before touching the workspace
    const primaryProvider: AgentProvider = {
      kind: '9router',
      model: 'gemini/gemini-3.5-flash-lite',
      async execute(): Promise<ProviderTaskResult> {
        return {
          status: 'ROUTER_HTTP_ERROR',
          provider: '9router',
          model: 'gemini/gemini-3.5-flash-lite',
          exitCode: 429,
          httpStatus: 429,
          durationMs: 150,
          stdout: '',
          stderr: 'Rate limit exceeded on primary gateway',
          changedFiles: [],
          toolCalls: 0,
          toolRounds: 0,
          commit: null,
          errorCode: 'ROUTER_HTTP_ERROR',
          errorMessage: 'HTTP 429',
        };
      },
      async health() { return { available: false, details: 'rate limited' }; },
      capabilities() { return ['coding']; },
      metadata() { return {}; },
    };

    // Fallback provider: runs cleanly on the clean workspace and writes index.ts
    const fallbackProvider: AgentProvider = {
      kind: 'openrouter',
      model: 'openrouter/free',
      async execute(task, ws): Promise<ProviderTaskResult> {
        fallbackWasCalled = true;
        const runtime = new ToolRuntime({ workspaceRoot: ws, maxRounds: 10, maxToolCalls: 10 });
        await runtime.executeTool('call_2', 'write_file', {
          path: 'index.ts',
          content: 'export const helloFromFallback = true;',
        });

        return {
          status: 'COMPLETED',
          provider: 'openrouter',
          model: 'openrouter/free',
          exitCode: 0,
          durationMs: 800,
          stdout: 'Fallback completed successfully',
          stderr: '',
          changedFiles: runtime.getChangedFiles(),
          toolCalls: 1,
          toolRounds: 1,
          commit: null,
          errorCode: null,
          errorMessage: null,
        };
      },
      async health() { return { available: true, details: 'ok' }; },
      capabilities() { return ['coding']; },
      metadata() { return {}; },
    };

    const gateway = new DualGatewayProvider(primaryProvider, fallbackProvider);
    const result = await gateway.execute(createTask(), workspace);

    // Assert fallback executed and succeeded
    expect(fallbackWasCalled).toBe(true);
    expect(result.status).toBe('COMPLETED');
    expect(result.provider).toBe('openrouter');
    expect(result.changedFiles).toEqual(['index.ts']);

    // Assert file exists with fallback content
    const content = await readFile(join(workspace, 'index.ts'), 'utf8');
    expect(content).toBe('export const helloFromFallback = true;');
  });
});

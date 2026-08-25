import { access } from 'node:fs/promises';
import { delimiter } from 'node:path';
import { AgentExecutor, type ExecutionResult } from './executor.js';
import type { Task } from './domain.js';
import { CodexApiProvider } from './providers/codex-api.js';
import { RouterProvider } from './providers/router.js';
import { DualGatewayProvider } from './providers/gateway.js';
import type { AgentProvider, ProviderTaskResult } from './providers/types.js';

export interface AgentOutcome {
  summary: string;
  execution?: ExecutionResult;
}

export interface CodingAgent {
  execute(task: Task, workspace: string): Promise<AgentOutcome>;
}

export class AgentExecutionError extends Error {
  constructor(message: string, readonly execution: ExecutionResult) {
    super(message);
  }
}

export class MockCodingAgent implements CodingAgent {
  async execute(task: Task) {
    return { summary: `Mock agent completed task ${task.id}; no source changes were made.` };
  }
}

class MockProvider implements AgentProvider {
  readonly kind = 'mock' as const;
  readonly model = null;
  async execute(task: Task, _workspace: string): Promise<ProviderTaskResult> {
    return {
      status: 'COMPLETED',
      provider: this.kind,
      model: null,
      exitCode: 0,
      durationMs: 0,
      stdout: `Mock provider completed task ${task.id}; no source changes were made.`,
      stderr: '',
      changedFiles: [],
      commit: null,
      errorCode: null,
      errorMessage: null,
    };
  }
  async health() {
    return { available: true, details: 'mock provider' };
  }
  capabilities() {
    return ['planning'];
  }
  metadata() {
    return { provider: 'mock' };
  }
}

export async function commandExists(command: string, environment: NodeJS.ProcessEnv = process.env) {
  if (command.includes('/') || command.includes('\\')) {
    try {
      await access(command);
      return true;
    } catch {
      return false;
    }
  }

  for (const directory of (environment.PATH ?? '').split(delimiter)) {
    for (const extension of process.platform === 'win32' ? ['', '.exe', '.cmd', '.bat'] : ['']) {
      try {
        await access(`${directory}/${command}${extension}`);
        return true;
      } catch {
        /* continue */
      }
    }
  }

  return false;
}

function providerFromResult(result: ProviderTaskResult): AgentOutcome {
  return {
    summary: result.stdout.slice(-8000),
    execution: result.execution,
  };
}

export class CodexCliAgent implements CodingAgent {
  constructor(
    private readonly executor = new AgentExecutor(),
    private readonly command = process.env.CODEX_COMMAND ?? 'codex',
    private readonly timeoutMs = Number(process.env.AGENT_TIMEOUT_MS ?? 900000),
  ) {}

  async execute(task: Task, workspace: string): Promise<AgentOutcome> {
    if (!(await commandExists(this.command))) {
      const execution: ExecutionResult = {
        exitCode: null,
        stdout: '',
        stderr: `Codex CLI is unavailable: ${this.command}`,
        durationMs: 0,
        status: 'START_ERROR',
      };
      throw new AgentExecutionError('CODEX_CLI_UNAVAILABLE', execution);
    }

    const execution = await this.executor.execute({
      command: this.command,
      args: ['-c', 'approval_policy=never', '-c', 'sandbox_mode=workspace-write', 'exec', task.prompt],
      cwd: workspace,
      timeoutMs: this.timeoutMs,
    });

    if (execution.status !== 'COMPLETED') throw new AgentExecutionError(`CODEX_EXECUTION_${execution.status}`, execution);
    return { summary: execution.stdout.slice(-8000), execution };
  }
}

class ProviderCodingAgent implements CodingAgent {
  constructor(private readonly provider: AgentProvider) {}

  async execute(task: Task, workspace: string): Promise<AgentOutcome> {
    return providerFromResult(await this.provider.execute(task, workspace));
  }
}

export function createProvider(provider = process.env.AGENT_PROVIDER ?? 'mock'): AgentProvider {
  let primaryProvider: AgentProvider;

  if (provider === 'mock') {
    primaryProvider = new MockProvider();
  } else if (provider === 'codex-api') {
    primaryProvider = new CodexApiProvider(new AgentExecutor());
  } else if (provider === '9router') {
    primaryProvider = new RouterProvider();
  } else if (provider === 'openrouter') {
    const openRouterBaseUrl = process.env.OPENROUTER_BASE_URL ?? 'https://openrouter.ai/api/v1';
    const openRouterApiKey = process.env.OPENROUTER_API_KEY;
    const openRouterModel = process.env.OPENROUTER_MODEL;
    primaryProvider = new RouterProvider(openRouterBaseUrl, openRouterApiKey, undefined, openRouterModel);
  } else {
    primaryProvider = new MockProvider();
  }

  // Fallback gateway configuration:
  // If explicitly configured via AGENT_PROVIDER_FALLBACK or if OPENROUTER_API_KEY is provided alongside a primary 9router
  const fallbackName = process.env.AGENT_PROVIDER_FALLBACK || (process.env.OPENROUTER_API_KEY && provider === '9router' ? 'openrouter' : undefined);

  if (fallbackName && fallbackName !== provider) {
    let fallbackProvider: AgentProvider | null = null;
    if (fallbackName === 'openrouter') {
      const openRouterBaseUrl = process.env.OPENROUTER_BASE_URL ?? 'https://openrouter.ai/api/v1';
      const openRouterApiKey = process.env.OPENROUTER_API_KEY;
      const openRouterModel = process.env.OPENROUTER_MODEL;
      fallbackProvider = new RouterProvider(openRouterBaseUrl, openRouterApiKey, undefined, openRouterModel);
    } else if (fallbackName === '9router') {
      fallbackProvider = new RouterProvider();
    } else if (fallbackName === 'mock') {
      fallbackProvider = new MockProvider();
    }

    if (fallbackProvider) {
      return new DualGatewayProvider(primaryProvider, fallbackProvider);
    }
  }

  return primaryProvider;
}

export function createAgent(): CodingAgent {
  if (process.env.AGENT_PROVIDER) {
    return new ProviderCodingAgent(createProvider(process.env.AGENT_PROVIDER));
  }

  return process.env.AGENT_MODE === 'codex' ? new CodexCliAgent() : new MockCodingAgent();
}


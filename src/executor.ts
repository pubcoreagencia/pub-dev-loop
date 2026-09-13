import { spawn } from 'node:child_process';
import { WorkspaceEnvironmentSecurity, WorkspaceCommandSecurity } from './tools/security.js';
import { SandboxUnavailableError, type WorkerSandboxAdapter } from './pdl/sandbox/types.js';
import { DockerWorkerSandboxAdapter } from './pdl/sandbox/docker-worker-sandbox-adapter.js';

export type ExecutionStatus = 'COMPLETED' | 'FAILED' | 'TIMED_OUT' | 'START_ERROR';

export interface ExecutionRequest {
  command: string;
  args: string[];
  cwd: string;
  timeoutMs: number;
  environment?: NodeJS.ProcessEnv;
  detached?: boolean;
}

export interface ExecutionResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  durationMs: number;
  status: ExecutionStatus;
}

const secretPattern = /((?:api[_-]?key|token|password|secret|credential|private[_-]?key)\s*(?:=|:|\s)\s*)([^\s'"'`]+)/gi;

export const redact = (value: string, environment: NodeJS.ProcessEnv = process.env) => {
  let result = value.replace(secretPattern, '$1[REDACTED]');
  result = result.replace(/postgres(?:ql)?:\/\/[^\s'"`]+/gi, 'postgres://[REDACTED]');
  for (const [key, secret] of Object.entries(environment)) {
    if (secret && /(api[_-]?key|token|password|secret|credential|private[_-]?key|database|postgres)/i.test(key) && secret.length >= 4) {
      result = result.split(secret).join('[REDACTED]');
    }
  }
  return result;
};

export interface AgentExecutorOptions {
  /**
   * Internal security switch:
   * When true, allows direct host spawn (strictly reserved for trusted internal engine operations or test harnesses).
   * When false (default), arbitrary agent execution MUST run inside the container sandbox.
   * If sandbox is unavailable and allowHostExecution is false, execution fails closed with SandboxUnavailableError.
   */
  allowHostExecution?: boolean;
}

/**
 * Agent executor: runs commands through an isolated ephemeral container sandbox (P0.4.3/P0.4.4).
 *
 * For arbitrary LLM-generated agent code, container execution is MANDATORY.
 * If the container sandbox is unavailable, execution fails closed with SandboxUnavailableError.
 * Host fallback is strictly prohibited.
 *
 * Direct host execution is strictly restricted to trusted internal engine operations
 * where allowHostExecution is explicitly set to true.
 */
export class AgentExecutor {
  private readonly sandbox?: WorkerSandboxAdapter;
  private readonly options: AgentExecutorOptions;

  constructor(
    sandbox?: WorkerSandboxAdapter,
    options?: AgentExecutorOptions,
  ) {
    this.options = { allowHostExecution: false, ...options };
    if (sandbox !== undefined) {
      this.sandbox = sandbox ?? undefined;
    } else if (!this.options.allowHostExecution) {
      this.sandbox = new DockerWorkerSandboxAdapter();
    }
  }

  async execute(request: ExecutionRequest): Promise<ExecutionResult> {
    const started = Date.now();

    // Validate command security at executable boundary before spawning
    const cmdSecurity = WorkspaceCommandSecurity.validateCommand(request.command, request.args);
    if (!cmdSecurity.allowed) {
      return {
        exitCode: 1,
        stdout: '',
        stderr: cmdSecurity.reason || '[SECURITY_VIOLATION] Execution blocked by workspace security policy.',
        durationMs: 0,
        status: 'FAILED',
      };
    }

    const rawEnv = request.environment ?? process.env;
    const environment = WorkspaceEnvironmentSecurity.sanitizeWorkspaceEnv(rawEnv);
    WorkspaceEnvironmentSecurity.assertNoGovernanceCredentials(environment);

    // P0.4.4 Invariant: Arbitrary agent code execution requires container sandbox.
    // Host execution fallback is strictly prohibited.
    if (!this.options.allowHostExecution) {
      if (!this.sandbox) {
        throw new SandboxUnavailableError(
          'No sandbox adapter configured and host execution is disabled.',
          'SANDBOX_ADAPTER_INIT_FAILED',
        );
      }
      this.sandbox.assertAvailable();
      return this.sandbox.execute(request, environment);
    }

    // Trusted host execution path (ONLY reachable when allowHostExecution is explicitly true)
    return new Promise(resolve => {
      let stdout = '';
      let stderr = '';
      let settled = false;
      let timedOut = false;

      const finish = (exitCode: number | null, status: ExecutionStatus) => {
        if (settled) return;
        settled = true;
        resolve({
          exitCode,
          stdout: redact(stdout, environment),
          stderr: redact(stderr, environment),
          durationMs: Date.now() - started,
          status,
        });
      };

      let child: ReturnType<typeof spawn>;

      try {
        child = spawn(request.command, request.args, {
          cwd: request.cwd,
          env: environment,
          shell: false,
          detached: request.detached ?? false,
          stdio: ['ignore', 'pipe', 'pipe'],
        });
      } catch (error) {
        stderr = error instanceof Error ? error.message : 'Unable to start process';
        finish(null, 'START_ERROR');
        return;
      }

      const terminate = (signal: NodeJS.Signals) => {
        try {
          if (child.pid) {
            process.kill(-child.pid, signal);
          } else {
            child.kill(signal);
          }
        } catch {
          child.kill(signal);
        }
      };

      const timer = setTimeout(() => {
        timedOut = true;
        terminate('SIGTERM');
        setTimeout(() => terminate('SIGKILL'), 500).unref();
      }, request.timeoutMs);

      child.stdout?.on('data', data => stdout += data.toString());
      child.stderr?.on('data', data => stderr += data.toString());
      child.on('error', error => {
        stderr += error.message;
        clearTimeout(timer);
        finish(null, 'START_ERROR');
      });
      child.on('close', code => {
        clearTimeout(timer);
        finish(code, timedOut ? 'TIMED_OUT' : code === 0 ? 'COMPLETED' : 'FAILED');
      });
    });
  }
}

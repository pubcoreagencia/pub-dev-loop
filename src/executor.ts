import { spawn } from 'node:child_process';
import { WorkspaceEnvironmentSecurity, WorkspaceCommandSecurity } from './tools/security.js';
import type { WorkerSandboxAdapter } from './pdl/sandbox/types.js';

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

/**
 * Agent executor: runs commands via spawn with shell: false or through an isolated container sandbox.
 *
 * When a WorkerSandboxAdapter is provided and available, execution is delegated
 * to an ephemeral, unprivileged container sandbox (P0.4.3 Capability Boundary).
 *
 * On Windows fallback (no container), spawn with shell: false executes locally.
 */
export class AgentExecutor {
  constructor(private readonly sandbox?: WorkerSandboxAdapter) {}

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

    // If sandbox adapter is configured and active, execute within the container capability boundary
    if (this.sandbox && this.sandbox.isAvailable) {
      return this.sandbox.execute(request, environment);
    }

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

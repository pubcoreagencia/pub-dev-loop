import { execSync, spawn } from 'node:child_process';
import { WorkspaceSecurity } from './tools/security.js';
import type { ToolExecutionContext } from './tools/types.js';
import { sanitizeCommitMessage } from './tools/runtime.js';

// Git subcommands that are explicitly blocked for security
const BLOCKED_GIT_COMMANDS = [
  'push', 'remote', 'reset', 'clean', 'checkout --', 'restore .',
  'branch -D', 'branch -d', 'fetch', 'pull', 'merge',
];

/**
 * Result of task finalization (validation + auto-commit).
 */
export interface FinalizeResult {
  status: 'COMPLETED' | 'FAILED';
  commitSha: string | null;
  commitMessage: string | null;
  changedFiles: string[];
  gitStatus: string;
  testsPassed: boolean | null;
  testOutput: string;
  errorCode: string | null;
  errorMessage: string | null;
}

/**
 * Options for task finalization.
 */
export interface FinalizeOptions {
  testCommand?: string | null;   // TASK_TEST_COMMAND — if null, skip tests
  commitMessage?: string | null;  // TASK_COMMIT_MESSAGE — if null, auto-generate
  expectChanges?: boolean;         // If true, require changes (else FAIL)
  allowUnexpectedFiles?: boolean;  // If false, only commit changedFiles
}

/**
 * TaskFinalizer: validates task results and performs automatic git commit.
 *
 * Flow:
 * 1. Check git status
 * 2. If no changes → COMPLETED (no commit)
 * 3. If changes → run tests (if configured)
 * 4. If tests pass → auto-commit with sanitized message
 * 5. Block all dangerous git operations
 */
export class TaskFinalizer {
  private readonly security: WorkspaceSecurity;
  private readonly ctx: ToolExecutionContext;

  constructor(workspace: string, ctx?: Partial<ToolExecutionContext>) {
    this.ctx = {
      workspaceRoot: workspace,
      maxRounds: 20,
      maxToolCalls: 50,
      commandTimeoutMs: Number(process.env.ROUTER_COMMAND_TIMEOUT_MS ?? 60000),
      maxFileBytes: 1024 * 1024,
      maxWriteBytes: 256 * 1024,
      redactSecrets: true,
      ...ctx,
    };
    this.security = new WorkspaceSecurity(workspace);
  }

  /**
   * Finalize the task: validate changes, run tests, and auto-commit.
   */
  async finalize(
    taskObjective: string,
    taskPrompt: string,
    options: FinalizeOptions,
  ): Promise<FinalizeResult> {
    // Check git status
    const gitStatusResult = await this.exec('git', ['status', '--short']);
    const gitStatus = gitStatusResult.stdout || '';

    const changedFiles = gitStatus
      .trim()
      .split('\n')
      .filter(Boolean)
      .map(line => {
        const filename = line.substring(3);
        const arrowIdx = filename.indexOf(' -> ');
        return arrowIdx >= 0 ? filename.substring(arrowIdx + 4) : filename;
      });

    // No changes — task is complete, no commit needed
    if (changedFiles.length === 0) {
      return {
        status: 'COMPLETED',
        commitSha: null,
        commitMessage: null,
        changedFiles: [],
        gitStatus: 'clean',
        testsPassed: null,
        testOutput: '',
        errorCode: null,
        errorMessage: null,
      };
    }

    // Run tests if configured
    let testsPassed: boolean | null = null;
    let testOutput = '';

    if (options.testCommand) {
      const testResult = await this.execShell(options.testCommand, {
        timeoutMs: this.ctx.commandTimeoutMs,
      });

      testOutput = testResult.stdout + testResult.stderr;
      testsPassed = testResult.exitCode === 0;

      if (!testsPassed) {
        return {
          status: 'FAILED',
          commitSha: null,
          commitMessage: null,
          changedFiles,
          gitStatus,
          testsPassed: false,
          testOutput: this.redactSecrets(testOutput),
          errorCode: 'TASK_TESTS_FAILED',
          errorMessage: `Tests failed (exit code ${testResult.exitCode})`,
        };
      }
    }

    // Generate commit message
    let commitMessage: string;
    if (options.commitMessage) {
      commitMessage = sanitizeCommitMessage(options.commitMessage);
    } else {
      const shortObjective = taskObjective.length > 80
        ? taskObjective.substring(0, 77) + '...'
        : taskObjective;
      commitMessage = sanitizeCommitMessage(`feat: ${shortObjective}`);
    }

    if (!commitMessage || !commitMessage.trim()) {
      commitMessage = `feat: task ${Date.now()}`;
    }

    // Run git add -A
    await this.exec('git', ['add', '-A']);

    // Get diff stat before commit
    const diffStatResult = await this.exec('git', ['diff', '--cached', '--stat']);
    const diffStat = diffStatResult.stdout || '';

    // Execute git commit
    const commitResult = await this.exec('git', ['commit', '-m', commitMessage]);

    if (commitResult.status !== 'COMPLETED') {
      return {
        status: 'FAILED',
        commitSha: null,
        commitMessage: null,
        changedFiles,
        gitStatus,
        testsPassed,
        testOutput: '',
        errorCode: 'COMMIT_FAILED',
        errorMessage: `git commit failed: ${commitResult.stderr || 'unknown error'}`,
      };
    }

    // Get commit SHA
    const shaResult = await this.exec('git', ['rev-parse', 'HEAD']);
    const commitSha = shaResult.stdout?.trim() || null;

    // Verify working tree is clean after commit
    const finalStatusResult = await this.exec('git', ['status', '--short']);
    const workingTreeClean = (finalStatusResult.stdout || '').trim() === '';

    return {
      status: 'COMPLETED',
      commitSha,
      commitMessage,
      changedFiles,
      gitStatus: workingTreeClean ? 'clean' : finalStatusResult.stdout || '',
      testsPassed,
      testOutput: this.redactSecrets(testOutput),
      errorCode: null,
      errorMessage: null,
    };
  }

  /**
   * Execute a command in the workspace.
   */
  private async exec(command: string, args: string[]): Promise<{ status: string; stdout: string; stderr: string; exitCode: number | null }> {
    const result = await this.ctx.redactSecrets
      ? this.execWithRedaction(command, args)
      : this.execRaw(command, args);
    return result;
  }

  private async execRaw(command: string, args: string[]): Promise<{ status: string; stdout: string; stderr: string; exitCode: number | null }> {
    return new Promise(resolve => {
      try {
        // execSync uses shell:true on Windows automatically for PATH resolution
        const output = execSync(command + ' ' + args.map(a => '"' + a.replace(/"/g, '\\"') + '"').join(' '), {
          cwd: this.security.root,
          stdio: ['pipe', 'pipe', 'pipe'],
          timeout: this.ctx.commandTimeoutMs,
        });
        resolve({
          status: 'COMPLETED',
          stdout: output.toString(),
          stderr: '',
          exitCode: 0,
        });
      } catch (error: any) {
        resolve({
          status: error.status === 0 ? 'COMPLETED' : 'FAILED',
          stdout: error.stdout?.toString() || '',
          stderr: error.stderr?.toString() || error.message || 'Command failed',
          exitCode: typeof error.status === 'number' ? error.status : null,
        });
      }
    });
  }

  private async execWithRedaction(command: string, args: string[]): Promise<{ status: string; stdout: string; stderr: string; exitCode: number | null }> {
    const result = await this.execRaw(command, args);
    return {
      status: result.status,
      stdout: this.redactSecrets(result.stdout),
      stderr: this.redactSecrets(result.stderr),
      exitCode: result.exitCode,
    };
  }

  /**
   * Execute a shell command (test command) in the workspace.
   */
  private async execShell(command: string, opts: { timeoutMs?: number }): Promise<{ stdout: string; stderr: string; exitCode: number | null }> {
    return new Promise(resolve => {
      const proc = spawn(command, {
        cwd: this.security.root,
        shell: true,
        timeout: opts.timeoutMs ?? this.ctx.commandTimeoutMs,
      });

      let stdout = '';
      let stderr = '';

      proc.stdout?.on('data', d => stdout += d);
      proc.stderr?.on('data', d => stderr += d);

      proc.on('error', () => {
        resolve({ stdout: '', stderr: 'Command not found', exitCode: null });
      });

      proc.on('close', code => {
        resolve({
          stdout: this.redactSecrets(stdout),
          stderr: this.redactSecrets(stderr),
          exitCode: code,
        });
      });
    });
  }

  /**
   * Redact known secret patterns from output.
   */
  private redactSecrets(value: string): string {
    if (!value) return value;
    let result = value;
    for (const [key, secret] of Object.entries(process.env)) {
      if (secret && /(api[_-]?key|token|password|secret|credential|private[_-]?key)/i.test(key) && secret.length >= 4) {
        result = result.split(secret).join('[REDACTED]');
      }
    }
    // Also redact Bearer tokens
    result = result.replace(/Bearer [A-Za-z0-9_-]{8,}/g, 'Bearer [REDACTED]');
    return result;
  }
}

/**
 * Check if a git command is blocked.
 */
export function isBlockedGitCommand(cmd: string): string | null {
  const lower = cmd.toLowerCase();
  for (const blocked of BLOCKED_GIT_COMMANDS) {
    if (lower.includes(blocked)) {
      return blocked;
    }
  }
  return null;
}

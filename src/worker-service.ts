import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import { AgentExecutionError } from './agent.js';
import type { CodingAgent } from './agent.js';
import type { TaskRepository, Task } from './domain.js';
import { TaskFinalizer, type FinalizeResult } from './finalizer.js';

function run(cmd: string, args: string[], cwd?: string): Promise<string> {
  // Use execSync for cross-platform PATH resolution reliability.
  // spawn with shell: false doesn't find git on Windows/MSYS,
  // and spawn with shell: true tries cmd.exe which may not exist.
  // execSync (spawnSync with shell:true on Windows) handles both.
  const escaped = args.map(a => '"' + String(a).replace(/"/g, '\\"') + '"').join(' ');
  return new Promise((resolve, reject) => {
    try {
      const output = execSync(cmd + ' ' + escaped, {
        cwd,
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 60000,
      });
      resolve(output.toString());
    } catch (error: any) {
      reject(new Error(`${cmd} failed (${error.status ?? 'err'}): ${error.stderr || error.message}`));
    }
  });
}

export interface Worker {
  executeOnce(): Promise<boolean>;
  status(): string;
  cancel(): Promise<void>;
}

export interface WorkerResult {
  status: Task['status'];
  provider: string | null;
  model: string | null;
  changedFiles: string[];
  commitSha: string | null;
  commitMessage: string | null;
  testsPassed: boolean | null;
  toolCalls: number;
  toolRounds: number;
  durationMs: number;
  gitStatus: string;
  errorCode: string | null;
  errorMessage: string | null;
  stdout: string;
  stderr: string;
}

/**
 * Base worker that handles task execution, validation, and auto-commit.
 * Can be extended for Codex, 9Router, or mock providers.
 */
export abstract class BaseWorker implements Worker {
  protected state = 'IDLE';
  protected active = false;
  /**
   * Tracks whether TaskFinalizer.finalize() was called for the last
   * executeOnce() cycle. Exposed for testing.
   */
  protected lastFinalizeStatus: 'SKIPPED_AGENT_FAILED' | 'COMPLETED' | 'FAILED' | null = null;

  constructor(
    protected readonly tasks: TaskRepository,
    protected readonly name: string,
  ) {}

  status(): string {
    return this.state;
  }

  /** Whether TaskFinalizer.finalize() was called in the last executeOnce() cycle. */
  get finalizeWasCalled(): boolean {
    return this.lastFinalizeStatus !== null && this.lastFinalizeStatus !== 'SKIPPED_AGENT_FAILED';
  }

  /** The status of the last finalize() call, or 'SKIPPED_AGENT_FAILED' if agent failed. */
  get lastFinalize(): 'SKIPPED_AGENT_FAILED' | 'COMPLETED' | 'FAILED' | null {
    return this.lastFinalizeStatus;
  }

  async cancel(): Promise<void> {
    this.active = false;
    this.state = 'CANCELLED';
  }

  /**
   * Execute one task cycle:
   * 1. Claim task
   * 2. Clone repo + create branch
   * 3. Run agent
   * 4. If agent FAILED → mark FAILED (no finalize, no commit)
   * 5. If agent COMPLETED → finalize (validate + auto-commit)
   * 6. Update task status
   */
  async executeOnce(): Promise<boolean> {
    const task = await this.tasks.claim(this.name);
    if (!task) return false;

    this.active = true;

    let workspace: string | undefined;
    let branch: string | undefined;

    try {
      await this.tasks.update(task.id, { status: 'RUNNING' });

      workspace = await mkdtemp(join(tmpdir(), 'pub-dev-loop-'));
      const repo = join(workspace, 'repo');
      branch = `worker/${this.name}/${task.id}`;

      // Clone and create branch
      await run('git', ['clone', task.repository, repo]);
      await run('git', ['checkout', '-b', branch], repo);

      // Execute the agent
      const result = await this.executeTask(task, repo);

      if (!this.active) {
        throw new Error('Worker cancelled');
      }

      // CRITICAL: Do not finalize or commit if the agent failed
      if (result.status === 'FAILED') {
        this.lastFinalizeStatus = 'SKIPPED_AGENT_FAILED';
        await this.tasks.update(task.id, {
          status: 'FAILED',
          branch,
          gitStatus: 'skipped — agent returned FAILED',
          error: `Agent returned FAILED status. No finalization or commit was performed.`,
          result: {
            stdout: result.stdout,
            stderr: result.stderr,
            exitCode: result.exitCode,
            finalize: null,
          },
        });
        return true;
      }

      await this.tasks.update(task.id, { status: 'TESTING' });

      // Finalize: validate + auto-commit (only when agent COMPLETED)
      const finalizeResult = await this.finalize(task, repo, result);
      this.lastFinalizeStatus = finalizeResult.status;

      // Update task with final status
      await this.tasks.update(task.id, {
        status: finalizeResult.status as Task['status'],
        branch,
        commitSha: finalizeResult.commitSha,
        gitStatus: finalizeResult.gitStatus,
        result: {
          summary: result.stdout.slice(-8000),
          execution: result.execution,
          finalize: finalizeResult,
        },
      });

      return true;
    } catch (error) {
      const details = error instanceof AgentExecutionError
        ? { code: error.message, execution: error.execution }
        : undefined;

      await this.tasks.update(task.id, {
        status: 'FAILED',
        error: error instanceof Error ? error.message.slice(0, 4000) : 'Unknown worker error',
        result: details,
      });

      return true;
    } finally {
      this.active = false;
      this.state = 'IDLE';
      if (workspace) {
        await rm(workspace, { recursive: true, force: true });
      }
    }
  }

  /**
   * Execute the task via the provider/agent. Returns the raw execution result.
   */
  protected abstract executeTask(task: Task, workspace: string): Promise<{
    stdout: string;
    stderr: string;
    exitCode: number | null;
    status: 'COMPLETED' | 'FAILED';
    provider: string | null;
    model: string | null;
    changedFiles: string[];
    toolCalls: number;
    toolRounds: number;
    durationMs: number;
    execution?: Record<string, unknown>;
  }>;

  /**
   * Finalize: run tests + auto-commit.
   */
  protected async finalize(
    task: Task,
    repo: string,
    result: { stdout: string; stderr: string; status: 'COMPLETED' | 'FAILED' },
  ): Promise<FinalizeResult> {
    const finalizer = new TaskFinalizer(repo, {
      commandTimeoutMs: this.ctx.commandTimeoutMs,
    });

    const testCommand = process.env.TASK_TEST_COMMAND || null;
    const commitMessage = process.env.TASK_COMMIT_MESSAGE || null;

    return finalizer.finalize(task.objective, task.prompt, {
      testCommand,
      commitMessage,
      expectChanges: false,
      allowUnexpectedFiles: false,
    });
  }

  protected get ctx() {
    return {
      commandTimeoutMs: Number(process.env.ROUTER_COMMAND_TIMEOUT_MS ?? 60000),
    };
  }
}

/**
 * CodexWorker: uses Codex CLI as the coding agent.
 */
export class CodexWorker extends BaseWorker {
  protected readonly agent: CodingAgent;

  constructor(tasks: TaskRepository, agent: CodingAgent, name = 'codex') {
    super(tasks, name);
    this.agent = agent;
  }

  protected async executeTask(task: Task, repo: string): Promise<{
    stdout: string;
    stderr: string;
    exitCode: number | null;
    status: 'COMPLETED' | 'FAILED';
    provider: string | null;
    model: string | null;
    changedFiles: string[];
    toolCalls: number;
    toolRounds: number;
    durationMs: number;
    execution?: Record<string, unknown>;
  }> {
    const outcome = await this.agent.execute(task, repo);
    return {
      stdout: outcome.summary,
      stderr: '',
      exitCode: 0,
      status: 'COMPLETED',
      provider: 'codex',
      model: null,
      changedFiles: [],
      toolCalls: 0,
      toolRounds: 0,
      durationMs: 0,
    };
  }
}

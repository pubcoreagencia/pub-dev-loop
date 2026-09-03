import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import type { ProviderTaskResult, ProviderResultStatus } from './providers/types.js';
import { AgentExecutionError } from './agent.js';
import type { CodingAgent } from './agent.js';
import type { TaskRepository, Task } from './domain.js';
import { TaskFinalizer, type FinalizeResult, type WorkspaceSnapshot, WorkspaceValidator } from './finalizer.js';
import { captureWorkspaceSnapshot } from './finalizer.js';
import { createAgentExecutionContext, type AgentExecutionContext } from './office/execution-context.js';
import { resolveAgentAssignment, type AgentAssignmentDecision } from './office/assignment.js';

const LEASE_TIMEOUT_MS = Number(process.env.WORKER_LEASE_TIMEOUT_MS ?? 30000);
const HEARTBEAT_INTERVAL_MS = Number(process.env.WORKER_HEARTBEAT_MS ?? 10000);

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

/**
 * Result of a single provider attempt, including the workspace that produced it.
 * The workspace, baselineSnapshot, and declaredChangedFiles form an inseparable unit.
 */
export interface AttemptResult {
  status: 'COMPLETED' | 'FAILED';
  /** Path to the attempt's workspace (repo directory). */
  workspace: string;
  /** Baseline snapshot of THIS attempt's workspace. */
  baselineSnapshot: WorkspaceSnapshot;
  /** Changed files declared by THIS attempt's provider. */
  declaredChangedFiles: string[];
  stdout: string;
  stderr: string;
  exitCode: number | null;
  provider: string | null;
  model: string | null;
  toolCalls: number;
  toolRounds: number;
  durationMs: number;
  execution?: Record<string, unknown>;
  errorCode?: string | null;
  errorMessage?: string | null;
  /** Full execution trace for diagnostics (populated by retry-capable workers) */
  trace?: WorkerExecutionTrace;
}

/**
 * Trace of a single provider attempt within an execution.
 * Preserved for diagnostics even when retryable (attempt was destroyed).
 */
export interface AttemptTrace {
  /** Zero-based attempt index */
  attempt: number;
  /** Provider kind (e.g., '9router') */
  provider: string;
  /** Model used */
  model: string | null;
  /** Original provider result status BEFORE mapping to COMPLETED/FAILED */
  status: ProviderResultStatus;
  /** Whether this attempt's failure was retryable */
  retryable: boolean;
  /** Human-readable reason if retryable (e.g., 'provider_timeout', 'http_503', 'connection_error') */
  retryReason: string | null;
  /** HTTP status code (if ROUTER_HTTP_ERROR), undefined otherwise */
  httpStatus: number | undefined;
  /** Error code (if failed) */
  errorCode: string | null;
  /** Error message (if failed) */
  errorMessage: string | null;
  /** Tool calls made in this attempt */
  toolCalls: number;
  /** Tool rounds consumed in this attempt */
  toolRounds: number;
  /** Duration of this attempt in milliseconds */
  durationMs: number;
  /** Exit code from provider */
  exitCode: number | null;
  /** Per-attempt timeout applied (ms) */
  attemptTimeoutMs: number;
  /** Whether this attempt was the winner */
  isWinner: boolean;
  /** Lifecycle: workspace was created for this attempt */
  workspaceCreated: boolean;
  /** Lifecycle: workspace was cleaned up after this attempt */
  workspaceCleaned: boolean;
  /** Model routing tier (1 = Curated Free, 2 = Free Pool, 3 = Paid Fallback) */
  tier?: 1 | 2 | 3;
  /** Task routing profile */
  profile?: string;
  /** Fallback classification type */
  fallbackType?: 'retry' | 'model_switch' | 'tier_escalation';
  /** Token usage statistics when provided by gateway */
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  /** Actual cost in USD if available or 0 for verified free models */
  costUsd?: number;
  /** Gateway used for this attempt (e.g., 'openrouter', '9router') */
  gateway?: string;
  /** Action derived from task.objective (if available) */
  action?: string;
  /** Real chain of attempts as "gateway/model" strings */
  fallbackChain?: string[];
  /**
   * true → gateway fallback was invoked (regardless of success).
   * false / undefined → no gateway fallback.
   */
  fallbackUsed?: boolean;
  /** Validation result – currently always null; placeholder for future */
  validationResult?: string | null;
  /** Formal error classification – currently always null; placeholder */
  errorClass?: string | null;
  /** Optional assigned organizational agent ID from The Office (P5.7.5) */
  agentId?: string | null;
}


/**
 * Full execution trace for diagnostic purposes.
 * Persisted in task.result.trace.
 */
export interface WorkerExecutionTrace {
  /** Total elapsed time across all attempts */
  totalDurationMs: number;
  /** Number of attempts executed */
  totalAttempts: number;
  /** Number of providers in the chain */
  providerChainLength: number;
  /** Per-attempt traces */
  attempts: AttemptTrace[];
  /** Index of the winning attempt (if COMPLETED) */
  winningAttempt: number | null;
  /** Final task result status */
  finalStatus: 'COMPLETED' | 'FAILED';
  /** Final error code */
  errorCode: string | null;
  /** Final error message */
  errorMessage: string | null;
  /** Whether global timeout was hit */
  timedOut: boolean;
  /** Global timeout in ms (ROUTER_TIMEOUT_TOTAL_MS) */
  globalTimeoutMs: number;
  /** Whether TaskFinalizer.finalize() was called */
  finalizeWasCalled: boolean;
  /** Finalize result status */
  finalizeStatus: 'COMPLETED' | 'FAILED' | 'SKIPPED_AGENT_FAILED' | null;
  /** Commit SHA (if committed) */
  commitSha: string | null;
  /** Optional assigned organizational agent ID from The Office (P5.7.5) */
  agentId?: string | null;
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
 * Retryable provider statuses — per TASK-000030 v4.3
 */
const RETRYABLE_STATUSES: ProviderResultStatus[] = [
  'TIMED_OUT',
  'ROUTER_TIMEOUT',
  'ROUTER_CONNECTION_ERROR',
];

function isRetryableHttpStatus(statusCode: number | undefined): boolean {
  // Fail closed: undefined httpStatus → NOT retryable
  if (statusCode === undefined) return false;
  // 429 (Too Many Requests) → retryable
  if (statusCode === 429) return true;
  // 5xx → retryable
  if (statusCode >= 500 && statusCode < 600) return true;
  // 4xx (except 429) → fail-fast
  return false;
}

/**
 * Determine if a ProviderTaskResult is retryable.
 * Uses the original ProviderTaskResult BEFORE status mapping.
 */
function isRetryableProviderResult(result: ProviderTaskResult): boolean {
  if (RETRYABLE_STATUSES.includes(result.status)) return true;
  if (result.status === 'ROUTER_HTTP_ERROR') {
    return isRetryableHttpStatus(result.httpStatus);
  }
  // FAILED, START_ERROR, TOOL_LOOP_LIMIT, COMPLETED → non-retryable
  return false;
}

/**
 * Sleep helper with duration cap.
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry config from environment — per TASK-000030 v4.3
 */
interface RetryConfig {
  maxAttempts: number;
  timeoutPerAttemptMs: number;
  timeoutTotalMs: number;
  backoffMs: number;
}

function getRetryConfig(): RetryConfig {
  return {
    maxAttempts: Number(process.env.ROUTER_MAX_ATTEMPTS ?? 3),
    timeoutPerAttemptMs: Number(process.env.ROUTER_TIMEOUT_PER_ATTEMPT_MS ?? 60000),
    timeoutTotalMs: Number(process.env.ROUTER_TIMEOUT_TOTAL_MS ?? 180000),
    backoffMs: Number(process.env.ROUTER_BACKOFF_MS ?? 1000),
  };
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

  /**
   * Resolve the organizational AgentExecutionContext for a task, if assigned.
   * Returns null for legacy tasks without agentId or unknown IDs.
   */
  protected getAgentContext(task: Task): AgentExecutionContext | null {
    return createAgentExecutionContext(task.agentId);
  }

  /**
   * Resolve the deterministic organizational assignment decision for a task.
   */
  protected getAssignmentDecision(task: Task): AgentAssignmentDecision {
    return resolveAgentAssignment(task);
  }

  async cancel(): Promise<void> {
    this.active = false;
    this.state = 'CANCELLED';
  }

  /**
   * Execute one task cycle:
   * 1. Claim task
   * 2. Delegate to executeWithRetry — subclasses create attempt workspaces, run providers, handle retry
   * 3. If FAILED → mark FAILED (no finalize, no commit)
   * 4. If COMPLETED → finalize (validate + auto-commit) using WINNING attempt's workspace + baseline
   * 5. Update task status
   * 6. Cleanup (only the winning workspace)
   */
  async executeOnce(): Promise<boolean> {
    const task = await this.tasks.claim(this.name);
    if (!task) return false;

    this.active = true;

    let winningAttempt: AttemptResult | undefined;
    let branch: string | undefined;
    // TASK-000032: Heartbeat for crash recovery / lease management
    let heartbeat: NodeJS.Timeout | undefined;

    const startHeartbeat = (id: string) => {
      heartbeat = setInterval(async () => {
        await this.tasks.heartbeat(id, new Date(Date.now() + LEASE_TIMEOUT_MS)).catch(() => {});
      }, HEARTBEAT_INTERVAL_MS);
      heartbeat.unref();
    };

    const stopHeartbeat = () => {
      if (heartbeat) {
        clearInterval(heartbeat);
        heartbeat = undefined;
      }
    };

    // Refresh lease when transitioning to RUNNING
    const leaseDeadline = new Date(Date.now() + LEASE_TIMEOUT_MS);
    await this.tasks.update(task.id, {
      status: 'RUNNING',
      leaseOwner: this.name,
      leaseDeadline,
    });
    startHeartbeat(task.id);

    try {
      // Delegate ALL attempt/workspace lifecycle to subclass.
      winningAttempt = await this.executeWithRetry(task, task.repository);

      if (!this.active) {
        throw new Error('Worker cancelled');
      }

      // FAILED guard — do not finalize or commit if agent failed
      if (winningAttempt.status === 'FAILED') {
        this.lastFinalizeStatus = 'SKIPPED_AGENT_FAILED';
        await this.tasks.update(task.id, {
          status: 'FAILED',
          branch,
          gitStatus: 'skipped — agent returned FAILED',
          error: winningAttempt.errorCode
            ? `(${winningAttempt.errorCode}) ${winningAttempt.errorMessage || ''}`
            : winningAttempt.errorMessage || 'Agent returned FAILED status. No finalization or commit was performed.',
          result: {
            stdout: winningAttempt.stdout,
            stderr: winningAttempt.stderr,
            exitCode: winningAttempt.exitCode,
            provider: winningAttempt.provider,
            model: winningAttempt.model,
            toolCalls: winningAttempt.toolCalls,
            toolRounds: winningAttempt.toolRounds,
            durationMs: winningAttempt.durationMs,
            finalize: null,
            trace: winningAttempt.trace,
          },
          // Clear lease — task is terminal
          leaseOwner: null,
          leaseDeadline: null,
          workspacePath: null,
        });
        return true;
      }

      branch = task.branch ?? `worker/${this.name}/${task.id}`;

      // Refresh lease when transitioning to TESTING
      await this.tasks.update(task.id, {
        status: 'TESTING',
        leaseOwner: this.name,
        leaseDeadline: new Date(Date.now() + LEASE_TIMEOUT_MS),
        workspacePath: winningAttempt.workspace,
      });

      // Finalize: validate + auto-commit (only when agent COMPLETED)
      // Uses EXACTLY the winning attempt's workspace + baseline + declaredChangedFiles
      const finalizeResult = await this.finalize(
        task,
        winningAttempt.workspace,           // ← winning attempt workspace
        winningAttempt,
        winningAttempt.baselineSnapshot,     // ← winning attempt baseline
        winningAttempt.declaredChangedFiles,  // ← winning attempt declared files
      );
      this.lastFinalizeStatus = finalizeResult.status;

      if (finalizeResult.status === 'COMPLETED' && !task.prototypeSessionId && finalizeResult.commitSha) {
        try {
          console.log(`[Worker] Pushing branch ${branch} to remote...`);
          await run('git', ['push', 'origin', `HEAD:${branch}`], winningAttempt.workspace);
          console.log(`[Worker] Successfully pushed branch ${branch} to remote.`);
        } catch (pushError: any) {
          console.error(`[Worker] GITHUB_PUSH_FAILED:`, pushError.message);
          finalizeResult.status = 'FAILED';
          finalizeResult.errorCode = 'GITHUB_PUSH_FAILED';
          finalizeResult.errorMessage = `GitHub push failed: ${pushError.message}`;
          this.lastFinalizeStatus = 'FAILED';
        }
      }

      // Enrich trace with finalization outcome
      if (winningAttempt.trace) {
        winningAttempt.trace.finalizeWasCalled = this.finalizeWasCalled;
        winningAttempt.trace.finalizeStatus = this.lastFinalize;
        winningAttempt.trace.commitSha = finalizeResult.commitSha;
        winningAttempt.trace.agentId = task.agentId ?? null;
      }

      // Update task with final status
      await this.tasks.update(task.id, {
        status: finalizeResult.status as Task['status'],
        branch,
        commitSha: finalizeResult.commitSha,
        gitStatus: finalizeResult.gitStatus,
        result: {
          summary: winningAttempt.stdout.slice(-8000),
          execution: winningAttempt.execution,
          finalize: finalizeResult,
          trace: winningAttempt.trace,
          provider: winningAttempt.provider,
          model: winningAttempt.model,
          toolCalls: winningAttempt.toolCalls,
          toolRounds: winningAttempt.toolRounds,
          durationMs: winningAttempt.durationMs,
        },
        // Clear lease — task is terminal
        leaseOwner: null,
        leaseDeadline: null,
        workspacePath: null,
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
        // Clear lease — task is terminal
        leaseOwner: null,
        leaseDeadline: null,
        workspacePath: null,
      });

      return true;
    } finally {
      stopHeartbeat();
      this.active = false;
      this.state = 'IDLE';
      // Cleanup ONLY the winning workspace — attempt workspaces destroyed by subclasses
      if (winningAttempt?.workspace) {
        await rm(winningAttempt.workspace, { recursive: true, force: true }).catch(() => {});
      }
    }
  }

  /**
   * Subclasses implement retry/fallback logic.
   * Must manage workspace lifecycle for each attempt:
   * - Create fresh workspace per attempt
   * - Clone repository into it
   * - Capture baseline BEFORE provider execution
   * - Execute provider on SAME workspace
   * - Return AttemptResult with workspace + baseline + declaredChangedFiles as unified unit
   *
   * Default implementation: single attempt, no retry (CodexWorker behavior).
   */
  protected async executeWithRetry(
    task: Task,
    repository: string,
  ): Promise<AttemptResult> {
    // Default: single attempt, single workspace — current behavior
    const ws = await mkdtemp(join(tmpdir(), 'pub-dev-loop-'));
    const repo = join(ws, 'repo');
    const branch = task.branch ?? `worker/${this.name}/${task.id}`;

    await run('git', ['clone', repository, repo]);
    if (task.branch) {
      await run('git', ['fetch', 'origin', task.branch], repo);
      await run('git', ['checkout', '-B', task.branch, `origin/${task.branch}`], repo);
    } else {
      await run('git', ['checkout', '-b', branch], repo);
    }

    const baseline = captureWorkspaceSnapshot(repo);

    const result = await this.executeTask(task, repo);
    const globalStart = Date.now();
    return {
      status: result.status,
      workspace: repo,
      baselineSnapshot: baseline,
      declaredChangedFiles: result.changedFiles,
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
      provider: result.provider,
      model: result.model,
      toolCalls: result.toolCalls,
      toolRounds: result.toolRounds,
      durationMs: result.durationMs,
      execution: result.execution,
      errorCode: 'errorCode' in result ? result.errorCode : undefined,
      trace: {
        totalDurationMs: Date.now() - globalStart,
        totalAttempts: 1,
        providerChainLength: 1,
        attempts: [{
          attempt: 0,
          provider: String(result.provider ?? 'unknown'),
          model: result.model,
          status: result.status === 'COMPLETED' ? 'COMPLETED' : 'FAILED',
          retryable: false,
          retryReason: null,
          httpStatus: undefined,
          errorCode: ('errorCode' in result ? result.errorCode : null) ?? null,
          errorMessage: null,
          toolCalls: result.toolCalls,
          toolRounds: result.toolRounds,
          durationMs: result.durationMs,
          exitCode: result.exitCode,
          attemptTimeoutMs: 0,
          isWinner: result.status === 'COMPLETED',
          workspaceCreated: true,
          workspaceCleaned: false,
        }],
        winningAttempt: result.status === 'COMPLETED' ? 0 : null,
        finalStatus: result.status,
        errorCode: ('errorCode' in result ? result.errorCode : null) ?? null,
        errorMessage: null,
        timedOut: false,
        globalTimeoutMs: Number(process.env.ROUTER_TIMEOUT_TOTAL_MS ?? 180000),
        finalizeWasCalled: false,
        finalizeStatus: null,
        commitSha: null,
      },
    };
  }

  /**
   * Execute the task via the provider/agent. Returns the raw execution result.
   * Subclasses may keep this for single-attempt use (CodexWorker).
   * Deprecated in favor of executeWithRetry — retained for backward compatibility.
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
    errorCode?: string | null;
  }>;

  /**
   * Finalize: run tests + auto-commit.
   */
  protected async finalize(
    task: Task,
    repo: string,
    result: AttemptResult,
    baselineSnapshot?: WorkspaceSnapshot,
    declaredChangedFiles?: string[],
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
      baselineSnapshot,
      declaredChangedFiles,
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

  protected async executeWithRetry(
    task: Task,
    repository: string,
  ): Promise<AttemptResult> {
    // CodexWorker: NO retry — single attempt, single workspace
    const ws = await mkdtemp(join(tmpdir(), 'pub-dev-loop-'));
    const repo = join(ws, 'repo');
    const branch = `worker/${this.name}/${task.id}`;

    await run('git', ['clone', repository, repo]);
    await run('git', ['checkout', '-b', branch], repo);

    const baseline = captureWorkspaceSnapshot(repo);

    const outcome = await this.agent.execute(task, repo);
    const started = Date.now();
    return {
      status: 'COMPLETED',
      workspace: repo,
      baselineSnapshot: baseline,
      declaredChangedFiles: [],
      stdout: outcome.summary,
      stderr: '',
      exitCode: 0,
      provider: 'codex',
      model: null,
      toolCalls: 0,
      toolRounds: 0,
      durationMs: 0,
      execution: outcome as unknown as Record<string, unknown>,
      trace: {
        totalDurationMs: Date.now() - started,
        totalAttempts: 1,
        providerChainLength: 1,
        attempts: [{
          attempt: 0,
          provider: 'codex',
          model: null,
          status: 'COMPLETED',
          retryable: false,
          retryReason: null,
          httpStatus: undefined,
          errorCode: null,
          errorMessage: null,
          toolCalls: 0,
          toolRounds: 0,
          durationMs: 0,
          exitCode: 0,
          attemptTimeoutMs: 0,
          isWinner: true,
          workspaceCreated: true,
          workspaceCleaned: false,
        }],
        winningAttempt: 0,
        finalStatus: 'COMPLETED',
        errorCode: null,
        errorMessage: null,
        timedOut: false,
        globalTimeoutMs: 0,
        finalizeWasCalled: false,
        finalizeStatus: null,
        commitSha: null,
      },
    };
  }

  // executeTask is still required by BaseWorker (abstract)
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
    errorCode?: string | null;
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

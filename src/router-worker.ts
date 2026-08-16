import type { AgentProvider, ProviderTaskResult } from './providers/types.js';
import type { Task, TaskRepository } from './domain.js';
import { BaseWorker, type AttemptResult } from './worker-service.js';
import type { WorkspaceSnapshot } from './finalizer.js';
import { captureWorkspaceSnapshot } from './finalizer.js';
import { RouterProvider } from './providers/router.js';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

function run(cmd: string, args: string[], cwd?: string): Promise<string> {
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

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Retryable provider statuses — per TASK-000030 v4.3
const RETRYABLE_PROVIDER_STATUSES: ProviderTaskResult['status'][] = [
  'TIMED_OUT',
  'ROUTER_TIMEOUT',
  'ROUTER_CONNECTION_ERROR',
];

function isRetryableHttpStatus(statusCode: number | undefined): boolean {
  if (statusCode === undefined) return false;
  if (statusCode === 429) return true;
  if (statusCode >= 500 && statusCode < 600) return true;
  return false;
}

/**
 * Determine if a ProviderTaskResult is retryable.
 * Uses original ProviderTaskResult status BEFORE status mapping.
 */
function isRetryableProviderResult(result: ProviderTaskResult): boolean {
  if (RETRYABLE_PROVIDER_STATUSES.includes(result.status)) return true;
  if (result.status === 'ROUTER_HTTP_ERROR') {
    return isRetryableHttpStatus(result.httpStatus);
  }
  return false;
}

function getRetryConfig(): {
  maxAttempts: number;
  timeoutPerAttemptMs: number;
  timeoutTotalMs: number;
  backoffMs: number;
} {
  return {
    maxAttempts: Number(process.env.ROUTER_MAX_ATTEMPTS ?? 1),
    timeoutPerAttemptMs: Number(process.env.ROUTER_TIMEOUT_PER_ATTEMPT_MS ?? 60000),
    timeoutTotalMs: Number(process.env.ROUTER_TIMEOUT_TOTAL_MS ?? 180000),
    backoffMs: Number(process.env.ROUTER_BACKOFF_MS ?? 1000),
  };
}

/**
 * RouterWorker: uses AgentProvider instances (typically RouterProvider) as the coding agent.
 *
 * Extends BaseWorker — inherits all finalization, auto-commit, and FAILED guard
 * logic from BaseWorker + TaskFinalizer. Does NOT duplicate any of that logic.
 *
 * RESPONSIBILITY: implement `executeWithRetry(task, repository)` with retry/fallback
 * between multiple RouterProvider instances via ROUTER_PROVIDER_CHAIN.
 *
 * Each attempt gets its own fresh workspace + clone + baseline.
 * The winning attempt's workspace + baseline + declaredChangedFiles are returned
 * as a unified AttemptResult to BaseWorker.executeOnce() for finalization.
 */
export class RouterWorker extends BaseWorker {
  protected readonly provider: AgentProvider;

  constructor(tasks: TaskRepository, provider: AgentProvider, name = 'router') {
    super(tasks, name);
    this.provider = provider;
  }

  /**
   * Build provider chain from ROUTER_PROVIDER_CHAIN env.
   * Supports only RouterProvider instances (per TASK-000030 v4.3 scope).
   *
   * Format: "router:modelA,router:modelB"
   * Default (no env): [this.provider] — current behavior preserved
   */
  protected getProviderChain(): AgentProvider[] {
    const chain = process.env.ROUTER_PROVIDER_CHAIN;
    if (!chain) {
      return [this.provider];
    }

    const providers: AgentProvider[] = [];
    const specs = chain.split(',').map(s => s.trim()).filter(Boolean);

    for (const spec of specs) {
      const [kind, ...rest] = spec.split(':');
      const modelOverride = rest.join(':');

      if (kind === 'router') {
        providers.push(
          new RouterProvider(
            process.env.ROUTER_BASE_URL,
            process.env.ROUTER_API_KEY,
            Number(process.env.ROUTER_TIMEOUT_MS ?? 900000),
            modelOverride || undefined,
          )
        );
      }
    }

    return providers.length > 0 ? providers : [this.provider];
  }

  /**
   * Execute task with retry/fallback between RouterProvider instances.
   *
   * Each attempt:
   * 1. Creates fresh workspace
   * 2. Clones repository
   * 3. Captures baseline
   * 4. Executes provider on SAME workspace
   *
   * If retryable -> destroy workspace, backoff, try next provider
   * If non-retryable -> destroy workspace, return FAILED (no finalize)
   * If COMPLETED -> return attempt result (winner)
   *
   * TaskFinalizer receives EXACTLY the winning attempt's workspace + baseline + changedFiles.
   */
  protected async executeWithRetry(
    task: Task,
    repository: string,
  ): Promise<AttemptResult> {
    this.active = true;
    const config = getRetryConfig();
    const providers = this.getProviderChain();
    const maxAttempts = Math.min(config.maxAttempts, providers.length);
    const effectiveProviders = providers.slice(0, maxAttempts);

    const globalStart = Date.now();
    const deadline = globalStart + config.timeoutTotalMs;

    const errors: { provider: string; status: string; message: string; attempt: number }[] = [];

    for (let attempt = 0; attempt < effectiveProviders.length; attempt++) {
      const provider = effectiveProviders[attempt];

      // 1. CHECK GLOBAL DEADLINE BEFORE ANY OPERATION
      const remainingBudget = deadline - Date.now();
      if (remainingBudget <= 0) {
        return {
          status: 'FAILED',
          workspace: '',
          baselineSnapshot: { trackedFiles: [], gitStatus: '', headSha: null },
          declaredChangedFiles: [],
          stdout: '',
          stderr: 'Total timeout exceeded before starting attempt ' + (attempt + 1),
          exitCode: null,
          provider: provider.kind,
          model: provider.model,
          toolCalls: 0,
          toolRounds: 0,
          durationMs: Date.now() - globalStart,
          errorCode: 'ROUTER_TIMEOUT_TOTAL',
          errorMessage: 'Total timeout exceeded',
        };
      }

      // 2. CREATE FRESH WORKSPACE FOR THIS ATTEMPT
      const attemptWS = await mkdtemp(join(tmpdir(), 'pu-dev-loop-attempt-'));
      const repo = join(attemptWS, 'repo');
      const branch = 'worker/' + this.name + '/' + task.id + '-attempt-' + attempt;

      let attemptBaseline: WorkspaceSnapshot | undefined;

      try {
        // 3. CLONE (respecting deadline)
        const cloneRemaining = deadline - Date.now();
        if (cloneRemaining <= 0) {
          await rm(attemptWS, { recursive: true, force: true });
          return this.createTotalTimeoutResult(globalStart, config.timeoutTotalMs);
        }

        await run('git', ['clone', repository, repo]);
        await run('git', ['checkout', '-b', branch], repo);

        // 4. CAPTURE BASELINE (of THIS attempt's workspace)
        attemptBaseline = captureWorkspaceSnapshot(repo);

        // 5. EXECUTE PROVIDER ON THIS ATTEMPT'S WORKSPACE
        // Provider timeout: min(per-attempt, remaining budget) — hard ceiling
        const providerRemaining = deadline - Date.now();
        const effectiveTimeout = Math.min(
          config.timeoutPerAttemptMs,
          Math.max(0, providerRemaining)
        );

        let subResult: ProviderTaskResult;
        if (effectiveTimeout <= 0) {
          subResult = {
            status: 'ROUTER_TIMEOUT',
            provider: provider.kind,
            model: provider.model,
            exitCode: null,
            durationMs: Date.now() - globalStart,
            stdout: '',
            stderr: 'No time budget remaining for provider execution',
            changedFiles: [],
            commit: null,
            errorCode: 'ROUTER_TIMEOUT',
            errorMessage: 'Remaining budget exhausted before provider execution',
            toolCalls: 0,
            toolRounds: 0,
          };
        } else {
          subResult = await Promise.race([
            provider.execute(task, repo),
            new Promise<ProviderTaskResult>((_, reject) => {
              setTimeout(() => {
                reject(new Error('Provider timeout after ' + effectiveTimeout + 'ms'));
              }, effectiveTimeout);
            }),
          ]);
        }

        if (!this.active) {
          await rm(attemptWS, { recursive: true, force: true });
          return {
            status: 'FAILED',
            workspace: attemptWS,
            baselineSnapshot: attemptBaseline,
            declaredChangedFiles: [],
            stdout: '',
            stderr: 'Worker cancelled',
            exitCode: null,
            provider: provider.kind,
            model: provider.model,
            toolCalls: 0,
            toolRounds: 0,
            durationMs: Date.now() - globalStart,
            errorCode: 'WORKER_CANCELLED',
            errorMessage: 'Worker was cancelled',
          };
        }

        // 6. CLASSIFY RESULT
        const status: 'COMPLETED' | 'FAILED' =
          subResult.status === 'COMPLETED' ? 'COMPLETED' : 'FAILED';

        if (status === 'COMPLETED') {
          return {
            status: 'COMPLETED',
            workspace: repo,
            baselineSnapshot: attemptBaseline,
            declaredChangedFiles: subResult.changedFiles,
            stdout: subResult.stdout,
            stderr: subResult.stderr,
            exitCode: subResult.exitCode ?? 0,
            provider: subResult.provider.toString(),
            model: subResult.model,
            toolCalls: subResult.toolCalls ?? 0,
            toolRounds: subResult.toolRounds ?? 0,
            durationMs: subResult.durationMs,
            execution: subResult.execution as Record<string, unknown> | undefined,
            errorCode: subResult.errorCode,
            errorMessage: subResult.errorMessage,
          };
        }

        // Non-COMPLETED — check retryable
        if (!isRetryableProviderResult(subResult)) {
          await rm(attemptWS, { recursive: true, force: true });
          return {
            status: 'FAILED',
            workspace: attemptWS,
            baselineSnapshot: attemptBaseline,
            declaredChangedFiles: subResult.changedFiles,
            stdout: subResult.stdout,
            stderr: subResult.stderr,
            exitCode: subResult.exitCode,
            provider: subResult.provider.toString(),
            model: subResult.model,
            toolCalls: subResult.toolCalls ?? 0,
            toolRounds: subResult.toolRounds ?? 0,
            durationMs: subResult.durationMs,
            execution: subResult.execution as Record<string, unknown> | undefined,
            errorCode: subResult.errorCode,
            errorMessage: subResult.errorMessage,
          };
        }

        // RETRYABLE: record error, discard workspace, backoff
        errors.push({
          provider: subResult.provider.toString(),
          status: subResult.status,
          message: subResult.errorMessage || '',
          attempt,
        });

        // Destroy this attempt's workspace BEFORE creating next attempt
        await rm(attemptWS, { recursive: true, force: true });

        // BACKOFF (respecting deadline)
        if (attempt < effectiveProviders.length - 1) {
          const backoffRemaining = deadline - Date.now();
          if (backoffRemaining <= 0) {
            return this.createTotalTimeoutResult(globalStart, config.timeoutTotalMs);
          }
          const backoffMs = Math.min(
            config.backoffMs * (attempt + 1),
            backoffRemaining
          );
          await sleep(backoffMs);

          if (deadline - Date.now() <= 0) {
            return this.createTotalTimeoutResult(globalStart, config.timeoutTotalMs);
          }
        }

      } catch (error) {
        await rm(attemptWS, { recursive: true, force: true }).catch(() => {});
        const elapsed = Date.now() - globalStart;

        if (remainingBudget - elapsed <= 0) {
          return this.createTotalTimeoutResult(globalStart, config.timeoutTotalMs);
        }

        // Other setup errors — START_ERROR (fail-fast)
        return {
          status: 'FAILED',
          workspace: attemptWS,
          baselineSnapshot: attemptBaseline || { trackedFiles: [], gitStatus: '', headSha: null },
          declaredChangedFiles: [],
          stdout: '',
          stderr: String(error),
          exitCode: null,
          provider: provider.kind,
          model: provider.model,
          toolCalls: 0,
          toolRounds: 0,
          durationMs: elapsed,
          errorCode: 'START_ERROR',
          errorMessage: error instanceof Error ? error.message : String(error),
        };
      }
    }

    // ALL PROVIDERS EXHAUSTED (all retryable failures)
    return {
      status: 'FAILED',
      workspace: '',
      baselineSnapshot: { trackedFiles: [], gitStatus: '', headSha: null },
      declaredChangedFiles: [],
      stdout: '',
      stderr: 'All ' + effectiveProviders.length + ' providers failed:\n' +
        errors.map(e => '  Attempt ' + e.attempt + ' [' + e.provider + ']: ' + e.status + ' - ' + e.message).join('\n'),
      exitCode: null,
      provider: 'all-providers-failed',
      model: null,
      toolCalls: 0,
      toolRounds: 0,
      durationMs: Date.now() - globalStart,
      errorCode: 'ALL_PROVIDERS_FAILED',
      errorMessage: 'All ' + effectiveProviders.length + ' providers failed:\n' +
        errors.map(e => '  Attempt ' + e.attempt + ' [' + e.provider + ']: ' + e.status + ' - ' + e.message).join('\n'),
    };
  }

  // Retain executeTask for backward compatibility with tests that may stub it
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
    const result: ProviderTaskResult = await this.provider.execute(task, repo);
    const status: 'COMPLETED' | 'FAILED' =
      result.status === 'COMPLETED' ? 'COMPLETED' : 'FAILED';
    return {
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
      status,
      provider: result.provider,
      model: result.model,
      changedFiles: result.changedFiles,
      toolCalls: result.toolCalls ?? 0,
      toolRounds: result.toolRounds ?? 0,
      durationMs: result.durationMs,
      execution: result.execution as Record<string, unknown> | undefined,
      errorCode: result.errorCode,
    };
  }

  private createTotalTimeoutResult(globalStart: number, totalMs: number): AttemptResult {
    return {
      status: 'FAILED',
      workspace: '',
      baselineSnapshot: { trackedFiles: [], gitStatus: '', headSha: null },
      declaredChangedFiles: [],
      stdout: '',
      stderr: 'Total timeout exceeded (' + (Date.now() - globalStart) + 'ms >= ' + totalMs + 'ms)',
      exitCode: null,
      provider: null,
      model: null,
      toolCalls: 0,
      toolRounds: 0,
      durationMs: Date.now() - globalStart,
      errorCode: 'ROUTER_TIMEOUT_TOTAL',
      errorMessage: 'Total timeout exceeded',
    };
  }
}

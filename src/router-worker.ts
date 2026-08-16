import type { AgentProvider, ProviderTaskResult } from './providers/types.js';
import type { Task, TaskRepository } from './domain.js';
import { BaseWorker } from './worker-service.js';

/**
 * RouterWorker: uses an AgentProvider (e.g., RouterProvider) as the coding agent.
 *
 * Extends BaseWorker — inherits all finalization, auto-commit, and FAILED guard
 * logic from BaseWorker + TaskFinalizer. Does NOT duplicate any of that logic.
 *
 * RESPONSIBILITY: implement `executeTask(task, workspace)` using the provider.
 *
 * Status mapping (ProviderTaskResult → Worker):
 *   COMPLETED → COMPLETED (→ finalize() → auto-commit)
 *   FAILED    → FAILED    (→ NO finalize, NO commit)
 *   TIMED_OUT → FAILED    (→ NO finalize, NO commit)
 *   START_ERROR → FAILED  (→ NO finalize, NO commit)
 *
 * Any non-COMPLETED status becomes FAILED — never convert errors to COMPLETED.
 */
export class RouterWorker extends BaseWorker {
  protected readonly provider: AgentProvider;

  constructor(tasks: TaskRepository, provider: AgentProvider, name = 'router') {
    super(tasks, name);
    this.provider = provider;
  }

  /**
   * Execute the task via the configured AgentProvider.
   *
   * Returns the raw execution result — BaseWorker.executeOnce() checks
   * `result.status` and decides whether to finalize (COMPLETED)
   * or skip finalize (FAILED).
   *
   * Status mapping:
   *   - ProviderTaskResult.status === 'COMPLETED' → COMPLETED
   *   - Any other status (FAILED, TIMED_OUT, START_ERROR) → FAILED
   *
   * NEVER convert a non-COMPLETED status to COMPLETED.
   */
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
}

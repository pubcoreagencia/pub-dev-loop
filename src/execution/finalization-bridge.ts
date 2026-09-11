/**
 * FinalizationBridge — PDL execution-to-finalization coordination bridge (Phase 3A.3).
 *
 * Responsibilities:
 * - Coordinates transition between ExecutionOutcome and TaskFinalizer.
 * - Enforces the execution success guard: only COMPLETED executions reach TaskFinalizer.
 * - Enforces workspace authority: target workspace is strictly execution.workspace.
 * - Passes execution.changedFiles as declaredChangedFiles for unexpected change detection.
 * - Safely captures finalizer outcomes and exceptions without crashing the worker.
 * - Preserves SpecIdentity without mutation.
 *
 * Exclusions:
 * - Does NOT interact with database, TaskRepository, leases, or heartbeats (Worker duty).
 * - Does NOT manage retries or provider fallback (Worker duty).
 * - Does NOT execute Git commands directly (TaskFinalizer duty).
 * - Does NOT couple with Pub Prototype (PP) or prototype push mechanisms.
 */

import {
  TaskFinalizer,
  type WorkspaceSnapshot,
  type FinalizeResult,
  type FinalizeOptions,
} from '../finalizer.js';
import type { ExecutionResult } from './execution-engine.js';

export interface FinalizationContext {
  objective: string;
  prompt?: string;
  testCommand?: string | null;
  commitMessage?: string | null;
  baselineSnapshot?: WorkspaceSnapshot;
  allowUnexpectedFiles?: boolean;
  commandTimeoutMs?: number;
}

export interface FinalizationBridge {
  finalize(
    executionResult: ExecutionResult,
    context: FinalizationContext,
  ): Promise<ExecutionResult>;
}

export type FinalizerFactory = (
  workspace: string,
  options?: { commandTimeoutMs?: number },
) => {
  finalize(
    taskObjective: string,
    taskPrompt: string,
    options: FinalizeOptions,
  ): Promise<FinalizeResult>;
};

export class DefaultFinalizationBridge implements FinalizationBridge {
  private readonly finalizerFactory: FinalizerFactory;

  constructor(finalizerFactory?: FinalizerFactory) {
    this.finalizerFactory =
      finalizerFactory ??
      ((workspace, opts) => new TaskFinalizer(workspace, opts));
  }

  async finalize(
    executionResult: ExecutionResult,
    context: FinalizationContext,
  ): Promise<ExecutionResult> {
    // 1. Guard: If execution failed, do NOT call finalizer
    if (executionResult.execution.status !== 'COMPLETED') {
      return {
        execution: executionResult.execution,
        finalization: undefined,
        specIdentity: executionResult.specIdentity,
      };
    }

    const workspace = executionResult.execution.workspace?.trim();
    if (!workspace) {
      const errResult: FinalizeResult = {
        status: 'FAILED',
        commitSha: null,
        commitMessage: null,
        changedFiles: [],
        gitStatus: '',
        testsPassed: null,
        testOutput: '',
        errorCode: 'FINALIZATION_ERROR',
        errorMessage: 'ExecutionOutcome workspace is missing or empty',
      };
      return {
        execution: executionResult.execution,
        finalization: errResult,
        specIdentity: executionResult.specIdentity,
      };
    }

    const declaredChangedFiles = Array.isArray(executionResult.execution.changedFiles)
      ? [...executionResult.execution.changedFiles]
      : [];

    const taskObjective = context.objective?.trim() || 'Task execution';
    const taskPrompt = context.prompt?.trim() || taskObjective;

    const finalizeOptions: FinalizeOptions = {
      testCommand: context.testCommand ?? null,
      commitMessage: context.commitMessage ?? null,
      expectChanges: false,
      allowUnexpectedFiles: context.allowUnexpectedFiles ?? false,
      baselineSnapshot: context.baselineSnapshot,
      declaredChangedFiles,
    };

    let finalization: FinalizeResult;
    try {
      const finalizer = this.finalizerFactory(workspace, {
        commandTimeoutMs: context.commandTimeoutMs,
      });
      finalization = await finalizer.finalize(taskObjective, taskPrompt, finalizeOptions);
    } catch (error: any) {
      finalization = {
        status: 'FAILED',
        commitSha: null,
        commitMessage: null,
        changedFiles: [],
        gitStatus: '',
        testsPassed: null,
        testOutput: '',
        errorCode: 'FINALIZATION_ERROR',
        errorMessage: error instanceof Error ? error.message : String(error),
      };
    }

    return {
      execution: executionResult.execution,
      finalization,
      specIdentity: executionResult.specIdentity,
    };
  }
}

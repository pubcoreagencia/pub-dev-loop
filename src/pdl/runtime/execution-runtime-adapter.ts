import type { Task } from '../../domain.js';
import type { ExecutionSpec } from '../../task/execution-spec.js';
import type {
  ExecutionEngine,
  ExecutionResult,
} from '../../execution/execution-engine.js';
import {
  PDL_AGENT_RUNTIME_CONTRACT_VERSION,
  type AgentRuntime,
  type RuntimeContext,
  type RuntimeEvidence,
  type RuntimeResult,
} from './runtime-contract.js';

function now(): string {
  return new Date().toISOString();
}

/**
 * Adapter from the existing PDL ExecutionEngine into AgentRuntime.
 *
 * This is an adapter, not a second execution runtime:
 * - ExecutionEngine remains authoritative for physical provider execution.
 * - Task/ExecutionSpec validation remains upstream.
 * - Finalization remains downstream.
 * - No provider/model selection is introduced here.
 */
export class ExecutionEngineRuntimeAdapter implements AgentRuntime {
  constructor(
    private readonly task: Task,
    private readonly executionSpec: ExecutionSpec,
    private readonly engine: ExecutionEngine,
  ) {}

  async execute(context: RuntimeContext): Promise<RuntimeResult> {
    const evidence: RuntimeEvidence[] = [];

    if (context.contractVersion !== PDL_AGENT_RUNTIME_CONTRACT_VERSION) {
      return this.blocked(context, evidence, 'RUNTIME_CONTRACT_VERSION_MISMATCH', 'Unsupported runtime contract version');
    }

    if (context.taskId !== this.task.id) {
      return this.blocked(context, evidence, 'RUNTIME_TASK_ID_MISMATCH', 'Runtime task identity does not match Task');
    }


    evidence.push({
      phase: 'RECEIVED',
      timestamp: now(),
      event: 'runtime.received',
      summary: 'Existing ExecutionEngine execution adapted to AgentRuntime contract',
    });

    evidence.push({
      phase: 'AUTHORIZED',
      timestamp: now(),
      event: 'runtime.authorized',
      summary: 'Task and sealed ExecutionSpec identity accepted by adapter',
    });

    let result: ExecutionResult;
    try {
      evidence.push({
        phase: 'EXECUTING',
        timestamp: now(),
        event: 'runtime.execution.started',
      });

      result = await this.engine.execute(this.task, this.executionSpec);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      evidence.push({
        phase: 'FAILED',
        timestamp: now(),
        event: 'runtime.execution.failed',
        summary: message,
      });
      return {
        status: 'FAILED',
        context,
        evidence,
        errorCode: 'EXECUTION_ENGINE_ERROR',
        errorMessage: message,
      };
    }

    if (result.execution.status === 'COMPLETED') {
      evidence.push({
        phase: 'COMPLETED',
        timestamp: now(),
        event: 'runtime.execution.completed',
        summary: 'Existing ExecutionEngine completed provider execution',
        data: {
          provider: result.execution.provider,
          model: result.execution.model,
          workspace: result.execution.workspace,
          changedFiles: result.execution.changedFiles,
          durationMs: result.execution.durationMs,
        },
      });
      return { status: 'COMPLETED', context, evidence };
    }

    evidence.push({
      phase: 'FAILED',
      timestamp: now(),
      event: 'runtime.execution.failed',
      summary: result.execution.errorMessage || 'ExecutionEngine returned FAILED',
      data: {
        errorCode: result.execution.errorCode,
        provider: result.execution.provider,
        model: result.execution.model,
        workspace: result.execution.workspace,
        durationMs: result.execution.durationMs,
      },
    });

    return {
      status: 'FAILED',
      context,
      evidence,
      errorCode: result.execution.errorCode,
      errorMessage: result.execution.errorMessage,
    };
  }

  private blocked(
    context: RuntimeContext,
    evidence: RuntimeEvidence[],
    errorCode: string,
    errorMessage: string,
  ): RuntimeResult {
    evidence.push({
      phase: 'BLOCKED',
      timestamp: now(),
      event: 'runtime.blocked',
      summary: errorMessage,
    });
    return {
      status: 'BLOCKED',
      context,
      evidence,
      errorCode,
      errorMessage,
    };
  }
}

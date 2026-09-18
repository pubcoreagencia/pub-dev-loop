import { describe, expect, it } from 'vitest';
import type { Task } from '../../src/domain.js';
import type { ExecutionSpec } from '../../src/task/execution-spec.js';
import type { ExecutionEngine, ExecutionResult } from '../../src/execution/execution-engine.js';
import {
  ExecutionEngineRuntimeAdapter,
} from '../../src/pdl/runtime/execution-runtime-adapter.js';
import {
  PDL_AGENT_RUNTIME_CONTRACT_VERSION,
  type RuntimeContext,
} from '../../src/pdl/runtime/runtime-contract.js';

const task = {
  id: 'TASK-RUNTIME-001',
  repository: 'https://github.com/pubcoreagencia/pub-dev-loop',
  prompt: 'runtime adapter proof',
  objective: 'prove adapter behavior',
} as Task;

const executionSpec = {
  specVersion: 'execution-spec-v1',
  lineage: {
    taskId: task.id,
    intakeHash: 'test-hash',
    source: 'test',
    createdAt: '2026-09-18T00:00:00.000Z',
  },
} as ExecutionSpec;

const context: RuntimeContext = {
  contractVersion: PDL_AGENT_RUNTIME_CONTRACT_VERSION,
  runId: 'run-runtime-001',
  taskId: task.id,
  repository: task.repository,
};

function engineReturning(result: ExecutionResult): ExecutionEngine {
  return {
    async execute() {
      return result;
    },
  };
}

describe('ExecutionEngineRuntimeAdapter', () => {
  it('adapts a completed existing ExecutionEngine result without reimplementing execution', async () => {
    const engineResult: ExecutionResult = {
      execution: {
        status: 'COMPLETED',
        provider: 'test-provider',
        model: 'test-model',
        workspace: '/tmp/runtime-proof',
        changedFiles: ['src/example.ts'],
        durationMs: 12,
        errorCode: null,
        errorMessage: null,
      },
      finalization: undefined,
      specIdentity: {
        specVersion: executionSpec.specVersion,
        taskId: task.id,
        lineage: executionSpec.lineage,
      },
    };

    const runtime = new ExecutionEngineRuntimeAdapter(
      task,
      executionSpec,
      engineReturning(engineResult),
    );

    const result = await runtime.execute(context);

    expect(result.status).toBe('COMPLETED');
    expect(result.evidence.map(item => item.event)).toEqual([
      'runtime.received',
      'runtime.authorized',
      'runtime.execution.started',
      'runtime.execution.completed',
    ]);
    expect(result.evidence.at(-1)?.data).toMatchObject({
      provider: 'test-provider',
      model: 'test-model',
      workspace: '/tmp/runtime-proof',
      changedFiles: ['src/example.ts'],
    });
  });

  it('fails closed on task identity mismatch', async () => {
    const runtime = new ExecutionEngineRuntimeAdapter(
      task,
      executionSpec,
      engineReturning({
        execution: {
          status: 'COMPLETED',
          provider: null,
          model: null,
          workspace: '/tmp/runtime-proof',
          changedFiles: [],
          durationMs: 1,
          errorCode: null,
          errorMessage: null,
        },
        finalization: undefined,
        specIdentity: {
          specVersion: executionSpec.specVersion,
          taskId: task.id,
          lineage: executionSpec.lineage,
        },
      }),
    );

    const result = await runtime.execute({
      ...context,
      taskId: 'TASK-WRONG',
    });

    expect(result.status).toBe('BLOCKED');
    expect(result.errorCode).toBe('RUNTIME_TASK_ID_MISMATCH');
  });

  it('maps an existing ExecutionEngine failure to a terminal FAILED result', async () => {
    const runtime = new ExecutionEngineRuntimeAdapter(
      task,
      executionSpec,
      engineReturning({
        execution: {
          status: 'FAILED',
          provider: 'test-provider',
          model: 'test-model',
          workspace: '/tmp/runtime-proof',
          changedFiles: [],
          durationMs: 4,
          errorCode: 'EXECUTION_FAILED',
          errorMessage: 'provider failed',
        },
        finalization: undefined,
        specIdentity: {
          specVersion: executionSpec.specVersion,
          taskId: task.id,
          lineage: executionSpec.lineage,
        },
      }),
    );

    const result = await runtime.execute(context);

    expect(result.status).toBe('FAILED');
    expect(result.errorCode).toBe('EXECUTION_FAILED');
    expect(result.errorMessage).toBe('provider failed');
    expect(result.evidence.at(-1)?.event).toBe('runtime.execution.failed');
  });
});

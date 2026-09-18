import { describe, expect, it } from 'vitest';
import type { Task, TaskRepository } from '../../src/domain.js';
import { BaseWorker, type AttemptResult } from '../../src/worker-service.js';
import type { PreparedExecution } from '../../src/execution/execution-seam.js';
import type { GovernanceDecision } from '../../src/pdl/governance/types.js';
import { PdlGovernanceEngine } from '../../src/pdl/governance/policy-engine.js';

function makeTask(): Task {
  return {
    id: 'TASK-PROD-GOV-001',
    project: 'pub-rate-calculator',
    repository: 'pub-rate-calculator',
    objective: 'production governance integration proof',
    prompt: 'prove BaseWorker governance boundary',
    status: 'QUEUED',
    priority: 1,
    worker: null,
    result: null,
    error: null,
    branch: 'main',
    commitSha: null,
    gitStatus: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    leaseOwner: null,
    leaseDeadline: null,
    heartbeatAt: null,
    workspacePath: null,
    prototypeSessionId: null,
  } as Task;
}

function permittedPolicy(): PdlGovernanceEngine {
  return {
    evaluateClaim: async () => ({
      allowed: true,
      gate: 'CLAIM',
      reasonCode: 'PERMITTED',
      reason: 'claim permitted',
      activeLevel: 3,
      killSwitchActive: false,
      limits: {} as any,
      timestamp: new Date().toISOString(),
    }),
    evaluateExecution: async (task: Task) => ({
      allowed: true,
      gate: 'EXECUTION',
      reasonCode: 'PERMITTED',
      reason: 'execution permitted',
      activeLevel: 3,
      killSwitchActive: false,
      limits: {} as any,
      timestamp: new Date().toISOString(),
      taskId: task.id,
      productId: task.project,
    }),
  } as PdlGovernanceEngine;
}

function repoFor(task: Task): TaskRepository & { getCurrent: () => Task } {
  let current = task;
  return {
    claim: async () => ({ ...current, status: 'ASSIGNED' }),
    update: async (_id: string, patch: Partial<Task>) => {
      current = { ...current, ...patch } as Task;
      return current;
    },
    heartbeat: async () => current,
    getCurrent: () => current,
  } as TaskRepository & { getCurrent: () => Task };
}

class ProductionGovernanceProbe extends BaseWorker {
  events: string[] = [];

  constructor(tasks: TaskRepository, governance: PdlGovernanceEngine) {
    super(tasks, 'governance-probe', undefined, governance);
    this.executionGovernance!.constructor;
  }

  protected async executeWithRetry(
    _task: Task,
    _repository: string,
    _prepared?: PreparedExecution,
  ): Promise<AttemptResult> {
    this.events.push('EXECUTION_ENGINE_PATH');
    return {
      status: 'FAILED',
      workspace: '',
      baselineSnapshot: { trackedFiles: [], gitStatus: '', headSha: null },
      declaredChangedFiles: [],
      stdout: '',
      stderr: 'deterministic production-path probe',
      exitCode: 1,
      provider: 'probe',
      model: 'probe',
      toolCalls: 1,
      toolRounds: 1,
      durationMs: 4,
      errorCode: 'PROBE_COMPLETE',
      errorMessage: 'probe',
      trace: {
        totalDurationMs: 4,
        totalAttempts: 1,
        providerChainLength: 1,
        attempts: [],
        winningAttempt: null,
        finalStatus: 'FAILED',
        errorCode: 'PROBE_COMPLETE',
        errorMessage: 'probe',
        timedOut: false,
        globalTimeoutMs: 1000,
        finalizeWasCalled: false,
        finalizeStatus: null,
        commitSha: null,
      },
    };
  }

  protected async executeTask(): Promise<any> {
    throw new Error('executeTask must not be called by this probe');
  }
}

describe('P1.2 BaseWorker production governance integration', () => {
  it('runs the governance boundary around the existing worker execution seam and persists post evidence', async () => {
    const task = makeTask();
    const tasks = repoFor(task);
    const worker = new ProductionGovernanceProbe(tasks, permittedPolicy());

    const handled = await worker.executeOnce();

    expect(handled).toBe(true);
    expect(worker.events).toEqual(['EXECUTION_ENGINE_PATH']);
    expect((tasks as any).getCurrent().status).toBe('FAILED');
    const persisted = (tasks as any).getCurrent().result as any;
    expect(persisted.governance.event).toBe('POST_EXECUTION');
    expect(persisted.governance.executionStatus).toBe('FAILED');
    expect(persisted.governance.decisionCode).toBe('EXECUTION_OBSERVED');
  });
});

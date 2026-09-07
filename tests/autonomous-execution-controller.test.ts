import { describe, it, expect } from 'vitest';
import {
  AutonomousExecutionController,
  WorkerRuntimeAdapter,
  type WorkerTaskExecutor,
} from '../src/office/autonomous-execution-controller.js';
import {
  type Mission,
  createInitialSystemState,
  applyStateUpdate,
} from '../src/office/autonomy-loop.js';
import { ApprovalManager, defaultApprovalManager } from '../src/office/approval.js';
import type { Task, TaskRepository } from '../src/domain.js';
import { BaseWorker, type AttemptResult } from '../src/worker-service.js';
import type { FinalizeResult } from '../src/finalizer.js';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

class MockTaskRepository implements TaskRepository {
  private tasks: Map<string, Task> = new Map();

  async create(task: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'status'> & { id?: string }): Promise<Task> {
    const id = task.id || `task-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const now = new Date();
    const created: Task = {
      id,
      project: task.project,
      repository: task.repository,
      objective: task.objective,
      prompt: task.prompt,
      status: 'QUEUED',
      priority: task.priority ?? 1,
      worker: null,
      result: task.result ?? null,
      error: null,
      branch: null,
      commitSha: null,
      gitStatus: null,
      createdAt: now,
      updatedAt: now,
      leaseOwner: null,
      leaseDeadline: null,
      heartbeatAt: null,
      workspacePath: null,
      prototypeSessionId: null,
      tenantId: task.tenantId || 'pub-core-holding',
      agentId: task.agentId || null,
    };
    this.tasks.set(id, created);
    return created;
  }

  async findById(id: string): Promise<Task | null> {
    return this.tasks.get(id) || null;
  }

  async list(): Promise<Task[]> {
    return Array.from(this.tasks.values());
  }

  async claim(workerName: string): Promise<Task | null> {
    for (const task of this.tasks.values()) {
      if (task.status === 'QUEUED') {
        task.status = 'ASSIGNED';
        task.worker = workerName;
        return task;
      }
    }
    return null;
  }

  async update(id: string, updates: Partial<Task>): Promise<Task | null> {
    const task = this.tasks.get(id);
    if (!task) return null;
    Object.assign(task, updates, { updatedAt: new Date() });
    return task;
  }

  async updateStatus(): Promise<Task | null> { return null; }
  async updateResult(): Promise<Task | null> { return null; }
  async acquireLease(): Promise<Task | null> { return null; }
  async heartbeat(): Promise<boolean> { return true; }
  async releaseLease(): Promise<boolean> { return true; }
  async reclaimStuck(): Promise<number> { return 0; }
  async findByProject(): Promise<Task[]> { return []; }
}

describe('PDL Autonomous Execution Controller — Continuity Loop', () => {
  const baseMission: Mission = {
    id: 'mission-real-continuity-1',
    title: 'Demonstrate Autonomous Multi-Cycle Engineering Loop',
    objective: 'Advance autonomy ladder by sequentially verifying research engine, auto-fix loop, and skill discovery without human intervention',
    project: 'pub-dev-loop',
    targetCapabilities: [
      'intent_foundation',
      'context_resolution',
      'research_engine',
      'skill_discovery',
      'auto_fix_loop',
    ],
    constraints: [
      'Strictly non-destructive file operations',
      'All changes must pass automated verification',
    ],
    riskPolicy: 'STANDARD',
    maxCycles: 6,
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
  };

  it('1. Environment Boundary: Accurately identifies BLOCKED execution when no live LLM gateway is present', async () => {
    const repo = new MockTaskRepository();
    const controller = new AutonomousExecutionController(repo);
    const state = createInitialSystemState(baseMission);

    // Call without a workerExecutor -> Controller must not fake LLM execution!
    const { result } = await controller.executeCycle(baseMission, state, 1, undefined);

    expect(result.executionStatus).toBe('BLOCKED');
    expect(result.validationStatus).toBe('BLOCKED');
    expect(result.stateUpdated).toBe(false);
    expect(result.stopReason).toBe('ENVIRONMENT_BLOCKED');
    expect(result.evidence[0]).toContain('No worker executor provided and external LLM gateway credentials not configured');
  });

  it('2. Multi-Cycle Autonomous Continuity: Advances across multiple cycles with 0 human interventions', async () => {
    const repo = new MockTaskRepository();
    const controller = new AutonomousExecutionController(repo);
    const initialState = createInitialSystemState(baseMission);

    // Deterministic test executor simulating worker execution + finalizer validation
    const deterministicExecutor: WorkerTaskExecutor = async (task: Task) => {
      // Simulate real file modification and test verification
      return {
        status: 'COMPLETED',
        stdout: `Executed task ${task.id} successfully`,
        evidenceSnippet: `Verified implementation in src/office/${task.project}.ts`,
        changedFiles: [`src/office/${task.project}.ts`],
        finalizeResult: {
          status: 'COMPLETED',
          commitSha: 'sha-' + Math.random().toString(36).slice(2, 8),
          gitStatus: 'clean',
          validationErrors: [],
        } as any,
      };
    };

    const outcome = await controller.executeMissionContinuously(baseMission, initialState, {
      maxCycles: 5,
      workerExecutor: deterministicExecutor,
    });

    expect(outcome.totalHumanInterventions).toBe(0);
    expect(outcome.cycles.length).toBeGreaterThanOrEqual(3);

    // Cycle 1 must have implemented research_engine
    expect(outcome.cycles[0].cycleNumber).toBe(1);
    expect(outcome.cycles[0].updatedCapabilityId).toBe('research_engine');
    expect(outcome.cycles[0].executionStatus).toBe('COMPLETED');
    expect(outcome.cycles[0].validationStatus).toBe('PASSED');
    expect(outcome.cycles[0].stateUpdated).toBe(true);

    // Cycle 2 must have automatically selected and implemented auto_fix_loop (which was previously blocked)
    expect(outcome.cycles[1].cycleNumber).toBe(2);
    expect(outcome.cycles[1].updatedCapabilityId).toBe('auto_fix_loop');
    expect(outcome.cycles[1].executionStatus).toBe('COMPLETED');
    expect(outcome.cycles[1].validationStatus).toBe('PASSED');

    // Cycle 3 must have implemented skill_discovery
    expect(outcome.cycles[2].cycleNumber).toBe(3);
    expect(outcome.cycles[2].updatedCapabilityId).toBe('skill_discovery');

    // Final cycle completes the mission
    const lastCycle = outcome.cycles[outcome.cycles.length - 1];
    expect(lastCycle.stopReason).toBe('MISSION_COMPLETED');
    expect(outcome.completed).toBe(true);
    expect(baseMission.status).toBe('COMPLETED');
  });

  it('3. Evidence-First Principle: Task completed does NOT equal capability verified without valid evidence', async () => {
    const repo = new MockTaskRepository();
    const controller = new AutonomousExecutionController(repo);
    const state = createInitialSystemState(baseMission);

    // Flawed executor: returns COMPLETED but finalizer failed (e.g. tests broke)
    const failingFinalizerExecutor: WorkerTaskExecutor = async () => {
      return {
        status: 'COMPLETED',
        stdout: 'Agent finished editing files',
        finalizeResult: {
          status: 'FAILED',
          commitSha: null,
          gitStatus: 'unclean',
          validationErrors: ['TypeScript compilation failed: 2 errors'],
        } as any,
        failureReason: 'Finalizer test verification failed',
      };
    };

    const { result, nextState } = await controller.executeCycle(baseMission, state, 1, failingFinalizerExecutor);

    // Must NOT be verified!
    expect(result.validationStatus).toBe('FAILED');
    expect(result.stateUpdated).toBe(true); // State records PARTIAL attempt
    expect(nextState.capabilities['research_engine'].status).toBe('PARTIAL');
    expect(nextState.capabilities['research_engine'].status).not.toBe('VERIFIED');
  });

  it('4. CEO Sovereignty & Safety: Traps HIGH or CRITICAL risk actions and halts at WAITING_APPROVAL', async () => {
    const repo = new MockTaskRepository();
    const approvalManager = new ApprovalManager();
    const controller = new AutonomousExecutionController(repo, approvalManager);

    const sensitiveMission: Mission = {
      ...baseMission,
      id: 'mission-sensitive-auth',
      title: 'Update Production Payment Gateway and Drop Deprecated Tables',
      targetCapabilities: ['payment_gateway_migration'],
    };

    const state = createInitialSystemState(sensitiveMission, {
      payment_gateway_migration: {
        id: 'payment_gateway_migration',
        name: 'Drop old tables and migrate production payment gateway',
        category: 'FOUNDATION',
        status: 'ABSENT',
        dependencies: [],
      },
    });

    const { result } = await controller.executeCycle(sensitiveMission, state, 1, undefined);

    expect(result.executionStatus).toBe('WAITING_APPROVAL');
    expect(result.stopped).toBe(true);
    expect(result.stopReason).toBe('WAITING_APPROVAL');
    expect(result.evidence[0]).toContain('CEO approval required');
  });

  it('5. Idempotency Guard: Rejects concurrent or duplicate executions of the same cycle key', async () => {
    const repo = new MockTaskRepository();
    const controller = new AutonomousExecutionController(repo);
    const state = createInitialSystemState(baseMission);

    // Simulate slow executor to trigger concurrent invocation
    let finishExecution: () => void;
    const slowExecutor: WorkerTaskExecutor = () => new Promise(resolve => {
      finishExecution = () => resolve({ status: 'COMPLETED', evidenceSnippet: 'done' });
    });

    const promise1 = controller.executeCycle(baseMission, state, 1, slowExecutor);
    const promise2 = controller.executeCycle(baseMission, state, 1, slowExecutor);

    // Second call with same cycleNumber while first is active must be rejected
    const { result: result2 } = await promise2;
    expect(result2.stopped).toBe(true);
    expect(result2.stopReason).toBe('DUPLICATE_CYCLE_CALL');

    finishExecution!();
    await promise1;
  });

  it('6. Max Cycles Limit: Halts gracefully when max cycles budget is exceeded', async () => {
    const repo = new MockTaskRepository();
    const controller = new AutonomousExecutionController(repo);
    const state = createInitialSystemState(baseMission);

    const { result } = await controller.executeCycle(baseMission, state, 999, undefined);

    expect(result.stopped).toBe(true);
    expect(result.stopReason).toBe('MAX_CYCLES_REACHED');
    expect(baseMission.status).toBe('PAUSED');
  });

  it('7. Real Worker Runtime Adapter: Integrates BaseWorker lifecycle (claim -> retry -> finalize -> state update)', async () => {
    class TestBaseWorker extends BaseWorker {
      constructor(tasks: TaskRepository) {
        super(tasks, 'test-worker-alpha');
      }

      protected async executeWithRetry(task: Task, repository: string): Promise<AttemptResult> {
        const dummyWs = join(tmpdir(), 'test-ws-' + Date.now() + '-' + Math.random().toString(36).slice(2));
        return {
          status: 'COMPLETED',
          workspace: dummyWs,
          baselineSnapshot: { trackedFiles: [], gitStatus: '', headSha: null },
          declaredChangedFiles: ['src/office/research.ts'],
          stdout: 'Executed task via BaseWorker',
          stderr: '',
          exitCode: 0,
          provider: 'openrouter',
          model: 'anthropic/claude-3.5-sonnet',
          toolCalls: 3,
          toolRounds: 1,
          durationMs: 250,
          execution: {},
        };
      }

      protected async executeTask() {
        return {
          stdout: 'done',
          stderr: '',
          exitCode: 0,
          status: 'COMPLETED' as const,
          provider: 'openrouter',
          model: 'anthropic/claude-3.5-sonnet',
          changedFiles: ['src/office/research.ts'],
          toolCalls: 3,
          toolRounds: 1,
          durationMs: 250,
        };
      }

      protected override async finalize(): Promise<FinalizeResult> {
        return {
          status: 'COMPLETED',
          commitSha: null,
          gitStatus: 'clean',
          validationErrors: [],
          testOutput: 'All tests passed',
          declaredChangedFiles: ['src/office/research.ts'],
        } as any;
      }
    }

    const repo = new MockTaskRepository();
    const worker = new TestBaseWorker(repo);
    const adapter = new WorkerRuntimeAdapter(worker, repo);
    const controller = new AutonomousExecutionController(repo, defaultApprovalManager, adapter);
    const state = createInitialSystemState(baseMission);

    // Run cycle without workerExecutor -> controller must invoke workerRuntime adapter
    const { result, nextState } = await controller.executeCycle(baseMission, state, 1, undefined);

    expect(result.executionStatus).toBe('COMPLETED');
    expect(result.validationStatus).toBe('PASSED');
    expect(result.stateUpdated).toBe(true);
    expect(result.updatedCapabilityId).toBe('research_engine');
    expect(nextState.capabilities['research_engine'].status).toBe('VERIFIED');
    expect(result.evidence.some(e => e.includes('src/office/research.ts'))).toBe(true);
  });

  it('8. Evidence Integrity: Rejects weak evidence (stdout only) from being marked VERIFIED', async () => {
    const repo = new MockTaskRepository();
    const controller = new AutonomousExecutionController(repo);
    const state = createInitialSystemState(baseMission);

    // Weak executor: claims COMPLETED with stdout, but has NO changed files, NO commit SHA, NO evidence snippet
    const weakExecutor: WorkerTaskExecutor = async () => {
      return {
        status: 'COMPLETED',
        stdout: 'I fixed everything and all looks great!',
        changedFiles: [],
        evidenceSnippet: undefined,
        finalizeResult: {
          status: 'COMPLETED',
          commitSha: null,
          gitStatus: 'clean',
          validationErrors: [],
        } as any,
      };
    };

    const { result, nextState } = await controller.executeCycle(baseMission, state, 1, weakExecutor);

    // Weak evidence must NOT verify the capability!
    expect(result.executionStatus).toBe('COMPLETED');
    expect(result.validationStatus).toBe('FAILED');
    expect(result.evidence.some(e => e.includes('Insufficient evidence: only weak evidence'))).toBe(true);
    expect(result.stateUpdated).toBe(true); // Recorded as PARTIAL
    expect(nextState.capabilities['research_engine'].status).toBe('PARTIAL');
  });

  it('9. Worker Claim Failure: Returns BLOCKED when Worker is unable to claim task', async () => {
    const repo = new MockTaskRepository();
    const mockWorker = {
      executeOnce: async () => false,
      status: () => 'IDLE',
      cancel: async () => {},
    };
    const adapter = new WorkerRuntimeAdapter(mockWorker, repo);
    const controller = new AutonomousExecutionController(repo, defaultApprovalManager, adapter);
    const state = createInitialSystemState(baseMission);

    const { result } = await controller.executeCycle(baseMission, state, 1, undefined);

    expect(result.executionStatus).toBe('BLOCKED');
    expect(result.validationStatus).toBe('BLOCKED');
    expect(result.stopReason).toBe('ENVIRONMENT_BLOCKED');
    expect(result.evidence[0]).toContain('Worker was unable to claim task');
  });
});

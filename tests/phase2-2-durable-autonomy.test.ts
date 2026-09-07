import { describe, it, expect, beforeEach } from 'vitest';
import {
  AutonomousExecutionController,
  WorkerRuntimeAdapter,
  type WorkerTaskExecutor,
} from '../src/office/autonomous-execution-controller.js';
import {
  PostgresAutonomyStateRepository,
  type DurableCycleRecord,
} from '../src/office/autonomy-state-repository.js';
import {
  type Mission,
  createInitialSystemState,
  applyStateUpdate,
} from '../src/office/autonomy-loop.js';
import { ApprovalManager } from '../src/office/approval.js';
import type { Task, TaskRepository } from '../src/domain.js';

class TestTaskRepository implements TaskRepository {
  private tasks: Map<string, Task> = new Map();
  public createCallCount = 0;

  async create(task: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'status'> & { id?: string }): Promise<Task> {
    this.createCallCount++;
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

  async get(id: string): Promise<Task | null> {
    return this.tasks.get(id) || null;
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
  async cancel(id: string): Promise<Task | null> { return null; }
  async retry(id: string): Promise<Task | null> { return null; }
}

describe('PDL Phase 2.2 — Durable Autonomy State & Cycle Idempotency', () => {
  const baseMission: Mission = {
    id: 'mission-durable-e2e',
    title: 'Verify Autonomous Engineering State Durability',
    objective: 'Demonstrate restart recovery, cycle idempotency, and atomic concurrency',
    project: 'pub-dev-loop',
    targetCapabilities: [
      'intent_foundation',
      'context_resolution',
      'research_engine',
      'auto_fix_loop',
      'skill_discovery',
    ],
    constraints: [
      'Strictly non-destructive operations',
      'Full state persistence across process restart',
    ],
    riskPolicy: 'STANDARD',
    maxCycles: 5,
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
  };

  beforeEach(() => {
    PostgresAutonomyStateRepository.resetSovereignStorage();
  });

  it('1. Main Recovery Test: Survives complete process destruction and resumes from durable state', async () => {
    const taskRepo = new TestTaskRepository();
    const stateRepo = new PostgresAutonomyStateRepository();
    const state = createInitialSystemState(baseMission);

    // Executor for Cycle 1
    const deterministicExecutor: WorkerTaskExecutor = async (task: Task) => ({
      status: 'COMPLETED',
      stdout: `Executed ${task.id}`,
      changedFiles: ['src/office/research.ts'],
      finalizeResult: {
        status: 'COMPLETED',
        commitSha: 'sha-research-1234',
        gitStatus: 'clean',
        changedFiles: ['src/office/research.ts'],
        testsPassed: true,
      } as any,
    });

    // === PROCESS 1 ===
    const controller1 = new AutonomousExecutionController(taskRepo, undefined, undefined, stateRepo);
    const { result: res1, nextState: stateAfter1 } = await controller1.executeCycle(
      baseMission,
      state,
      1,
      deterministicExecutor
    );

    expect(res1.executionStatus).toBe('COMPLETED');
    expect(res1.validationStatus).toBe('PASSED');
    expect(res1.updatedCapabilityId).toBe('research_engine');
    expect(stateAfter1.capabilities['research_engine'].status).toBe('VERIFIED');

    // === PROCESS CRASH / TERMINATION SIMULATION ===
    // controller1 and stateAfter1 in-memory variables are discarded!
    PostgresAutonomyStateRepository.clearVolatileMemory();

    // === PROCESS 2 (POST-RESTART) ===
    // A completely new Controller instance is created pointing to durable storage
    const controller2 = new AutonomousExecutionController(taskRepo, undefined, undefined, stateRepo);

    // Recover mission state directly from durable storage
    const recovered = await controller2.recoverMission(baseMission.id);
    expect(recovered.mission).not.toBeNull();
    expect(recovered.mission?.id).toBe(baseMission.id);
    expect(recovered.state).not.toBeNull();
    expect(recovered.state?.capabilities['research_engine'].status).toBe('VERIFIED');
    expect(recovered.latestCycle?.cycleNumber).toBe(1);
    expect(recovered.latestCycle?.status).toBe('COMPLETED');

    // Crucial: Next action must be dynamically derived from the recovered state!
    expect(recovered.nextAction).toBeDefined();
    expect(recovered.nextAction?.targetCapabilityId).toBe('auto_fix_loop');

    // Process 2 executes Cycle 2 seamlessly continuing from the durable state
    const { result: res2, nextState: stateAfter2 } = await controller2.executeCycle(
      recovered.mission!,
      recovered.state!,
      2,
      deterministicExecutor
    );

    expect(res2.cycleNumber).toBe(2);
    expect(res2.executionStatus).toBe('COMPLETED');
    expect(res2.updatedCapabilityId).toBe('auto_fix_loop');
    expect(stateAfter2.capabilities['auto_fix_loop'].status).toBe('VERIFIED');
  });

  it('2. Durable Cycle Idempotency: Duplicate calls to a completed cycle never re-execute', async () => {
    const taskRepo = new TestTaskRepository();
    const stateRepo = new PostgresAutonomyStateRepository();
    const state = createInitialSystemState(baseMission);

    let executionCalls = 0;
    const trackingExecutor: WorkerTaskExecutor = async (task: Task) => {
      executionCalls++;
      return {
        status: 'COMPLETED',
        stdout: 'Executed once',
        changedFiles: ['src/office/research.ts'],
        finalizeResult: {
          status: 'COMPLETED',
          commitSha: 'sha-idempotency-abc',
          gitStatus: 'clean',
          changedFiles: ['src/office/research.ts'],
          testsPassed: true,
        } as any,
      };
    };

    const controller = new AutonomousExecutionController(taskRepo, undefined, undefined, stateRepo);

    // First invocation: executes cycle 1
    const { result: resFirst } = await controller.executeCycle(baseMission, state, 1, trackingExecutor);
    expect(resFirst.executionStatus).toBe('COMPLETED');
    expect(executionCalls).toBe(1);
    expect(taskRepo.createCallCount).toBe(1);

    // Second invocation: EXACT same mission and cycle number
    const { result: resSecond } = await controller.executeCycle(baseMission, state, 1, trackingExecutor);

    // Must be completely idempotent: NO second execution, NO second task created!
    expect(executionCalls).toBe(1);
    expect(taskRepo.createCallCount).toBe(1);
    expect(resSecond.executionStatus).toBe('COMPLETED');
    expect(resSecond.taskId).toBe(resFirst.taskId);
    expect(resSecond.cycleNumber).toBe(1);
  });

  it('3. Concurrency Safety: Atomic acquisition permits exactly one execution under race conditions', async () => {
    const taskRepo = new TestTaskRepository();
    const stateRepo = new PostgresAutonomyStateRepository();
    const state = createInitialSystemState(baseMission);

    let executionCount = 0;
    const slowExecutor: WorkerTaskExecutor = async () => {
      executionCount++;
      await new Promise(r => setTimeout(r, 80));
      return {
        status: 'COMPLETED',
        changedFiles: ['src/office/research.ts'],
        finalizeResult: { status: 'COMPLETED', testsPassed: true, changedFiles: ['src/office/research.ts'] } as any,
      };
    };

    const controller = new AutonomousExecutionController(taskRepo, undefined, undefined, stateRepo);

    // Trigger two simultaneous executeCycle calls for the exact same cycle
    const [call1, call2] = await Promise.all([
      controller.executeCycle(baseMission, state, 1, slowExecutor),
      controller.executeCycle(baseMission, state, 1, slowExecutor),
    ]);

    // Exactly one must execute
    expect(executionCount).toBe(1);
    expect(taskRepo.createCallCount).toBe(1);

    // One must have completed, the other blocked by concurrency guard
    const completed = call1.result.executionStatus === 'COMPLETED' ? call1 : call2;
    const blocked = call1.result.executionStatus === 'BLOCKED' ? call1 : call2;

    expect(completed.result.executionStatus).toBe('COMPLETED');
    expect(blocked.result.executionStatus).toBe('BLOCKED');
    expect(blocked.result.stopReason).toBe('DUPLICATE_CYCLE_CALL');
  });

  it('4. Crash Recovery: Recovers safely if process crashes while cycle is RUNNING', async () => {
    const taskRepo = new TestTaskRepository();
    const stateRepo = new PostgresAutonomyStateRepository();
    const state = createInitialSystemState(baseMission);

    // Create mission and acquire cycle 1 as RUNNING in durable storage
    await stateRepo.createMission(baseMission);
    await stateRepo.saveCurrentState(state);
    const { cycle } = await stateRepo.acquireCycle({
      missionId: baseMission.id,
      cycleNumber: 1,
      projectId: baseMission.project,
      stateBefore: { intent_foundation: 'VERIFIED', research_engine: 'ABSENT' },
      identifiedGaps: [],
      selectedAction: {
        id: 'act-1',
        title: 'Implement Research',
        actionType: 'IMPLEMENT_CAPABILITY',
        targetCapabilityId: 'research_engine',
        priority: 1,
        estimatedRisk: 'LOW',
        rationale: 'Foundation',
        suggestedPrompt: 'prompt',
        description: 'desc',
      },
    });

    // Scenario A: A task was created and finished successfully in repo before crash
    const task = await taskRepo.create({
      project: baseMission.project,
      repository: 'repo',
      objective: 'Research',
      prompt: 'prompt',
    });
    await taskRepo.update(task.id, {
      status: 'COMPLETED',
      commitSha: 'sha-crashed-recovery',
      result: {
        changedFiles: ['src/office/research.ts'],
        finalize: { status: 'COMPLETED', testsPassed: true, changedFiles: ['src/office/research.ts'] },
      },
    });

    await stateRepo.updateCycle(baseMission.id, 1, { generatedTaskId: task.id });

    // A brand new controller restarts and encounters cycle 1 in RUNNING state
    const newController = new AutonomousExecutionController(taskRepo, undefined, undefined, stateRepo);
    const { result } = await newController.executeCycle(baseMission, state, 1, undefined);

    // Should inspect taskRepo, verify clean evidence, and recover to COMPLETED
    expect(result.executionStatus).toBe('COMPLETED');
    expect(result.validationStatus).toBe('PASSED');
    expect(result.updatedCapabilityId).toBe('research_engine');
    expect(result.evidence.some(e => e.includes('recovered from prior process run'))).toBe(true);

    // Durable cycle record must now be COMPLETED
    const updatedCycle = await stateRepo.getCycle(baseMission.id, 1);
    expect(updatedCycle?.status).toBe('COMPLETED');
  });

  it('5. Crash Recovery: Does NOT fabricate success if task was unverified during crash', async () => {
    const taskRepo = new TestTaskRepository();
    const stateRepo = new PostgresAutonomyStateRepository();
    const state = createInitialSystemState(baseMission);

    // Create mission and acquire cycle 1 as RUNNING
    await stateRepo.createMission(baseMission);
    await stateRepo.saveCurrentState(state);
    await stateRepo.acquireCycle({
      missionId: baseMission.id,
      cycleNumber: 1,
      projectId: baseMission.project,
      stateBefore: { intent_foundation: 'VERIFIED', research_engine: 'ABSENT' },
      identifiedGaps: [],
      selectedAction: {
        id: 'act-1',
        title: 'Implement Research',
        actionType: 'IMPLEMENT_CAPABILITY',
        targetCapabilityId: 'research_engine',
        priority: 1,
        estimatedRisk: 'LOW',
        rationale: 'Foundation',
        suggestedPrompt: 'prompt',
        description: 'desc',
      },
    });

    // Task was NOT created or remained FAILED/incomplete in taskRepo
    const newController = new AutonomousExecutionController(taskRepo, undefined, undefined, stateRepo);
    const { result, nextState } = await newController.executeCycle(baseMission, state, 1, undefined);

    // Must NEVER claim success without evidence!
    expect(result.executionStatus).toBe('FAILED');
    expect(result.validationStatus).toBe('FAILED');
    expect(result.stopReason).toBe('CRASH_RECOVERY_REQUIRED');
    expect(nextState.capabilities['research_engine'].status).not.toBe('VERIFIED');
  });

  it('6. CEO Governance Across Restart: Preserves WAITING_APPROVAL without re-execution', async () => {
    const taskRepo = new TestTaskRepository();
    const stateRepo = new PostgresAutonomyStateRepository();
    const approvalManager = new ApprovalManager();
    const state = createInitialSystemState(baseMission);

    const sensitiveMission: Mission = {
      ...baseMission,
      id: 'mission-sensitive-durable',
      targetCapabilities: ['payment_migration'],
    };
    const sensitiveState = createInitialSystemState(sensitiveMission, {
      payment_migration: {
        id: 'payment_migration',
        name: 'Critical payment migration',
        category: 'FOUNDATION',
        status: 'ABSENT',
        dependencies: [],
      },
    });

    // Process 1 encounters HIGH/CRITICAL action
    const controller1 = new AutonomousExecutionController(taskRepo, approvalManager, undefined, stateRepo);
    const { result: res1 } = await controller1.executeCycle(sensitiveMission, sensitiveState, 1, undefined);

    expect(res1.executionStatus).toBe('WAITING_APPROVAL');
    expect(res1.stopReason).toBe('WAITING_APPROVAL');

    // Process 1 dies. Process 2 restarts.
    PostgresAutonomyStateRepository.clearVolatileMemory();

    const controller2 = new AutonomousExecutionController(taskRepo, approvalManager, undefined, stateRepo);
    const { result: res2 } = await controller2.executeCycle(sensitiveMission, sensitiveState, 1, undefined);

    // Must strictly remain WAITING_APPROVAL without executing
    expect(res2.executionStatus).toBe('WAITING_APPROVAL');
    expect(res2.stopReason).toBe('WAITING_APPROVAL');
    expect(taskRepo.createCallCount).toBe(0);
  });

  it('7. Multi-Tenancy & Project Isolation: Projects and tenants are strictly segregated', async () => {
    const stateRepo = new PostgresAutonomyStateRepository();

    const missionA: Mission = { ...baseMission, id: 'm-tenant-a', project: 'proj-alpha' };
    const missionB: Mission = { ...baseMission, id: 'm-tenant-b', project: 'proj-beta' };

    await stateRepo.createMission(missionA, 'tenant-holding');
    await stateRepo.createMission(missionB, 'tenant-subsidiary');

    const holdingMissions = await stateRepo.listMissions(undefined, 'tenant-holding');
    const subsidiaryMissions = await stateRepo.listMissions(undefined, 'tenant-subsidiary');

    expect(holdingMissions.length).toBe(1);
    expect(holdingMissions[0].id).toBe('m-tenant-a');

    expect(subsidiaryMissions.length).toBe(1);
    expect(subsidiaryMissions[0].id).toBe('m-tenant-b');
  });
});

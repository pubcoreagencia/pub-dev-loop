import { describe, it, expect } from 'vitest';
import {
  type Mission,
  type SystemCurrentState,
  type CapabilityDefinition,
  createInitialSystemState,
  analyzeGaps,
  selectNextBestAction,
  generateEngineeringTaskFromAction,
  applyStateUpdate,
  stepAutonomyLoop,
  DEFAULT_PDL_CAPABILITIES,
} from '../src/office/autonomy-loop.js';
import type { Task, TaskRepository } from '../src/domain.js';

class MockTaskRepository implements TaskRepository {
  private tasks: Map<string, Task> = new Map();
  public readonly intakeService = {
    processIntake: async (input: any) => {
      const task = await this.create({
        project: input.project,
        repository: input.repository,
        objective: input.objective || input.rawRequest,
        prompt: input.prompt || input.rawRequest,
        priority: input.priority ?? 1,
        agentId: input.agentId,
      });
      return {
        task,
        spec: {} as any,
        executionSpec: {
          id: `spec-${task.id}`,
          task_id: task.id,
          spec_version: '1.0.0',
          spec_hash: 'mockspec',
          objective: task.objective,
          lineage: { intakeHash: 'mockintake', source: 'autonomy-loop-test' },
          status: 'SEALED',
          created_at: new Date().toISOString(),
          sealed_at: new Date().toISOString(),
          spec_content_json: '{}',
        },
      };
    },
  } as any;

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

  async update(): Promise<Task | null> { return null; }
  async updateStatus(): Promise<Task | null> { return null; }
  async updateResult(): Promise<Task | null> { return null; }
  async acquireLease(): Promise<Task | null> { return null; }
  async heartbeat(): Promise<boolean> { return true; }
  async releaseLease(): Promise<boolean> { return true; }
  async reclaimStuck(): Promise<number> { return 0; }
  async findByProject(): Promise<Task[]> { return []; }
}

describe('PDL Autonomy Loop Core — Continuous Engineering Engine', () => {
  const sampleMission: Mission = {
    id: 'mission-autonomy-lvl4',
    title: 'Achieve Level 4 Self-Correcting Engineering',
    objective: 'Transform PDL into a self-correcting engineering system by verifying research, auto-fix, and continuous loop capabilities',
    project: 'pub-dev-loop',
    targetCapabilities: [
      'intent_foundation',
      'context_resolution',
      'research_engine',
      'skill_discovery',
      'auto_fix_loop',
      'autonomous_mission_loop',
    ],
    constraints: [
      'Do not modify production databases without CEO confirmation',
      'All code changes must pass npm run typecheck and vitest',
    ],
    riskPolicy: 'STANDARD',
    maxCycles: 10,
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
  };

  it('1. Gap Analysis: Accurately identifies gaps and differentiates actionable vs blocked capabilities', () => {
    const state = createInitialSystemState(sampleMission);
    const gaps = analyzeGaps(sampleMission, state);

    // Intent and Context are already VERIFIED in baseline, so they must not appear as gaps
    const gapCapIds = gaps.map(g => g.capabilityId);
    expect(gapCapIds).not.toContain('intent_foundation');
    expect(gapCapIds).not.toContain('context_resolution');

    // research_engine depends on context_resolution (which is VERIFIED) -> actionable!
    const researchGap = gaps.find(g => g.capabilityId === 'research_engine');
    expect(researchGap).toBeDefined();
    expect(researchGap?.isActionable).toBe(true);
    expect(researchGap?.blockedBy).toHaveLength(0);

    // auto_fix_loop depends on context_resolution AND research_engine.
    // Because research_engine is ABSENT, auto_fix_loop must be BLOCKED!
    const autoFixGap = gaps.find(g => g.capabilityId === 'auto_fix_loop');
    expect(autoFixGap).toBeDefined();
    expect(autoFixGap?.isActionable).toBe(false);
    expect(autoFixGap?.blockedBy).toContain('research_engine');
  });

  it('2. Action Selection: Selects Next Best Action dynamically based on unblocking leverage, not hardcoded rules', () => {
    const state = createInitialSystemState(sampleMission);
    const gaps = analyzeGaps(sampleMission, state);
    const action = selectNextBestAction(sampleMission, gaps, state);

    // research_engine unblocks auto_fix_loop, so it has higher leverage score than skill_discovery
    expect(action.actionType).toBe('IMPLEMENT_CAPABILITY');
    expect(action.targetCapabilityId).toBe('research_engine');
    expect(action.rationale).toContain('unblocks 1 downstream capabilities');
  });

  it('3. Task Generation: Derives canonical EngineeringTask enriched with mission context and constraints', () => {
    const state = createInitialSystemState(sampleMission);
    const gaps = analyzeGaps(sampleMission, state);
    const action = selectNextBestAction(sampleMission, gaps, state);

    const engTask = generateEngineeringTaskFromAction(action, sampleMission);

    expect(engTask.id).toMatch(/^eng-task-/);
    expect(engTask.project).toBe('pub-dev-loop');
    expect(engTask.known_context.some(c => c.includes(sampleMission.title))).toBe(true);
    expect(engTask.known_context.some(c => c.includes('Target Capability: research_engine'))).toBe(true);

    // Inherited constraints
    expect(engTask.constraints).toContain('Do not modify production databases without CEO confirmation');
  });

  it('4. State Update: Accurately mutates capability status with immutable state progression', () => {
    const state = createInitialSystemState(sampleMission);
    expect(state.capabilities['research_engine'].status).toBe('ABSENT');

    const updated = applyStateUpdate(
      state,
      'research_engine',
      'VERIFIED',
      'Implemented file search, AST symbol resolver, and verification suite'
    );

    expect(updated.capabilities['research_engine'].status).toBe('VERIFIED');
    expect(updated.capabilities['research_engine'].evidence).toContain('AST symbol resolver');
    // Original state must remain untouched (immutability)
    expect(state.capabilities['research_engine'].status).toBe('ABSENT');
  });

  it('5. Continuous Autonomous Loop: Advances across multiple cycles without human prompt input', async () => {
    const mockRepo = new MockTaskRepository();
    let currentState = createInitialSystemState(sampleMission);

    // === CYCLE 1 ===
    // Initial state: research_engine is ABSENT
    const step1 = await stepAutonomyLoop(sampleMission, currentState, mockRepo, 1);
    expect(step1.cycle.cycleNumber).toBe(1);
    expect(step1.cycle.selectedAction.targetCapabilityId).toBe('research_engine');
    expect(step1.task).toBeDefined();
    expect(step1.task?.status).toBe('QUEUED');

    // Simulate Worker execution & verification of research_engine
    currentState = applyStateUpdate(currentState, 'research_engine', 'VERIFIED', 'Research engine tests passed');

    // === CYCLE 2 (Automatic progression without human prompt!) ===
    // Now that research_engine is VERIFIED, auto_fix_loop is no longer blocked!
    const step2 = await stepAutonomyLoop(sampleMission, currentState, mockRepo, 2);
    expect(step2.cycle.cycleNumber).toBe(2);
    // Dynamic selection now picks auto_fix_loop because it unblocks verified_learning
    expect(step2.cycle.selectedAction.targetCapabilityId).toBe('auto_fix_loop');
    expect(step2.task).toBeDefined();

    // Simulate completion of auto_fix_loop and remaining capabilities
    currentState = applyStateUpdate(currentState, 'auto_fix_loop', 'VERIFIED', 'Auto fix loop verified');
    currentState = applyStateUpdate(currentState, 'skill_discovery', 'VERIFIED', 'Skill discovery verified');
    currentState = applyStateUpdate(currentState, 'autonomous_mission_loop', 'VERIFIED', 'Mission loop verified');

    // === CYCLE 3: Mission Completion ===
    const stepFinal = await stepAutonomyLoop(sampleMission, currentState, mockRepo, 3);
    expect(stepFinal.missionStatus).toBe('COMPLETED');
    expect(stepFinal.cycle.selectedAction.actionType).toBe('COMPLETE_MISSION');
    expect(sampleMission.status).toBe('COMPLETED');
  });

  it('6. Observability: Every cycle records deterministic audit trail', async () => {
    const state = createInitialSystemState(sampleMission);
    const step = await stepAutonomyLoop(sampleMission, state, undefined, 1);

    expect(step.cycle.cycleId).toMatch(/^cycle-/);
    expect(step.cycle.missionId).toBe(sampleMission.id);
    expect(step.cycle.currentState).toBeDefined();
    expect(step.cycle.identifiedGaps.length).toBeGreaterThan(0);
    expect(step.cycle.selectedAction).toBeDefined();
    expect(step.cycle.timestamp).toBeDefined();
  });
});

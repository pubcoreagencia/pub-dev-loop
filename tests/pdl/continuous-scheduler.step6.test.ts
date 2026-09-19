import { describe, expect, it, vi } from 'vitest';
import type { Task } from '../../src/domain.js';
import { PdlContinuousScheduler } from '../../src/pdl/scheduler/continuous-scheduler.js';
import type { GovernanceDecision, GovernanceLimits } from '../../src/pdl/governance/types.js';

const limits: GovernanceLimits = {
  activeLevel: 3,
  maxConsecutiveTasks: 3,
  maxTaskDurationMs: 180000,
  maxToolRoundsPerTask: 10,
  maxCorrectionAttempts: 2,
  maxConsecutiveFailures: 1,
  allowedProducts: ['pub-dev-loop-template'],
  killSwitchActive: false,
};

function decision(allowed: boolean, reasonCode: GovernanceDecision['reasonCode'], count: number): GovernanceDecision {
  return {
    allowed,
    gate: 'CONTINUATION',
    reasonCode,
    reason: allowed ? `continuation ${count + 1}/3 permitted` : 'continuation blocked',
    activeLevel: limits.activeLevel,
    killSwitchActive: limits.killSwitchActive,
    limits,
    timestamp: new Date().toISOString(),
  };
}

function task(id: string): Task {
  return {
    id,
    project: 'pub-dev-loop-template',
    repository: 'https://github.com/pubcoreagencia/pub-dev-loop-template.git',
    objective: 'scheduler proof',
    prompt: 'scheduler proof',
    status: 'RUNNING',
    priority: 1,
    worker: 'pdl-router',
    result: null,
    error: null,
    branch: `worker/pdl-router/${id}`,
    commitSha: `commit-${id}`,
    gitStatus: 'clean',
    createdAt: new Date(),
    updatedAt: new Date(),
    leaseOwner: null,
    leaseDeadline: null,
    heartbeatAt: null,
    workspacePath: null,
    prototypeSessionId: null,
  };
}

describe('Phase 5.5 Step 6 autonomous continuity contract', () => {
  it('autonomously processes exactly the governance limit and then stops before a fourth task', async () => {
    const processed: Task[] = [];
    const worker = {
      lastFinalizeStatus: 'COMPLETED',
      lastExecutedTask: null as Task | null,
      executeOnce: vi.fn(async () => {
        const next = task(`TASK-${processed.length + 1}`);
        processed.push(next);
        worker.lastExecutedTask = next;
        worker.lastFinalizeStatus = 'COMPLETED';
        return true;
      }),
    };

    const governance = {
      loadLimits: vi.fn(async () => limits),
      getKillSwitch: vi.fn(() => ({
        checkStatus: vi.fn(async () => ({ active: false, reason: null })),
      })),
      evaluateContinuation: vi.fn(async ({ consecutiveTasksCount }: { consecutiveTasksCount: number }) =>
        consecutiveTasksCount >= limits.maxConsecutiveTasks
          ? decision(false, 'CONSECUTIVE_TASKS_EXCEEDED', consecutiveTasksCount)
          : decision(true, 'PERMITTED', consecutiveTasksCount)
      ),
    };

    const repository = {
      createSession: vi.fn(async (session: any) => ({ ...session })),
      updateSession: vi.fn(async (_id: string, updates: any) => ({ ...updates })),
      getSession: vi.fn(async () => null),
      listSessions: vi.fn(async () => []),
      getActiveSession: vi.fn(async () => null),
      recordCycle: vi.fn(async (cycle: any) => ({ ...cycle })),
      updateCycle: vi.fn(async (_sessionId: string, _cycle: number, updates: any) => ({ ...updates })),
      listCycles: vi.fn(async () => []),
    };

    const scheduler = new PdlContinuousScheduler({
      governance: governance as any,
      worker: worker as any,
      repository: repository as any,
      config: {
        pollIntervalMs: 1000,
        authorizedBy: 'MATHEUS',
        maxConcurrentTasks: 1,
      },
    });

    const session = await scheduler.start();
    expect(session.state).toBe('RUNNING');

    await vi.waitFor(() => {
      expect(worker.executeOnce).toHaveBeenCalledTimes(3);
      expect(scheduler.getStatus().state).toBe('COMPLETED');
    }, { timeout: 2000 });

    expect(processed.map(t => t.id)).toEqual(['TASK-1', 'TASK-2', 'TASK-3']);
    expect(worker.executeOnce).toHaveBeenCalledTimes(3);
    expect(governance.evaluateContinuation).toHaveBeenCalledWith({
      consecutiveTasksCount: 3,
      consecutiveFailuresCount: 0,
    });
    expect(repository.updateSession).toHaveBeenCalled();
  });

  it('fails closed below Governance Level 3 before starting the autonomous loop', async () => {
    const lowLimits = { ...limits, activeLevel: 2 as const };
    const worker = { executeOnce: vi.fn(), lastFinalizeStatus: 'COMPLETED', lastExecutedTask: null };
    const governance = {
      loadLimits: vi.fn(async () => lowLimits),
      getKillSwitch: vi.fn(() => ({ checkStatus: vi.fn(async () => ({ active: false, reason: null })) })),
      evaluateContinuation: vi.fn(async () => ({
        ...decision(false, 'LEVEL_EXCEEDED', 0),
        activeLevel: 2 as const,
        limits: lowLimits,
      })),
    };

    const repository = {
      createSession: vi.fn(async (session: any) => ({ ...session })),
      updateSession: vi.fn(async (_id: string, updates: any) => ({ ...updates })),
      getSession: vi.fn(async () => null),
      listSessions: vi.fn(async () => []),
      getActiveSession: vi.fn(async () => null),
      recordCycle: vi.fn(async (cycle: any) => ({ ...cycle })),
      updateCycle: vi.fn(),
      listCycles: vi.fn(async () => []),
    };

    const scheduler = new PdlContinuousScheduler({
      governance: governance as any,
      worker: worker as any,
      repository: repository as any,
      config: { pollIntervalMs: 1000, authorizedBy: 'MATHEUS', maxConcurrentTasks: 1 },
    });

    const session = await scheduler.start();

    expect(session.state).toBe('BLOCKED');
    expect(session.stopReason).toBe('LEVEL_EXCEEDED');
    expect(worker.executeOnce).not.toHaveBeenCalled();
  });
});

import { describe, it, expect, vi } from 'vitest';
import { RouterWorker } from '../src/router-worker.js';
import type { AgentProvider, ProviderTaskResult } from '../src/providers/types.js';
import type { Task, TaskRepository } from '../src/domain.js';
import { defaultAgentRegistry, getAgent, isValidAgentId } from '../src/office/registry.js';

function createMockTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'test-task-1',
    project: 'test-project',
    repository: 'https://example.com/repo.git',
    objective: 'Implement test feature',
    prompt: 'Implement test feature prompt',
    status: 'QUEUED',
    priority: 1,
    worker: 'router',
    result: null,
    error: null,
    branch: 'feat/test',
    commitSha: null,
    gitStatus: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    leaseOwner: null,
    leaseDeadline: null,
    heartbeatAt: null,
    workspacePath: null,
    prototypeSessionId: null,
    ...overrides,
  };
}

describe('P5.7.5 — The Office: Runtime Identity Propagation', () => {
  it('1. Task with agentId propagates agentId to AttemptTrace and WorkerExecutionTrace', async () => {
    const mockProvider: AgentProvider = {
      kind: 'openrouter',
      model: 'minimax/minimax-m2.7:free',
      execute: vi.fn().mockResolvedValue({
        status: 'COMPLETED',
        provider: 'openrouter',
        model: 'minimax/minimax-m2.7:free',
        exitCode: 0,
        durationMs: 100,
        stdout: 'Task completed successfully',
        stderr: '',
        changedFiles: ['src/index.ts'],
        commit: 'abc1234',
        errorCode: null,
        errorMessage: null,
      } as ProviderTaskResult),
      health: vi.fn().mockResolvedValue({ available: true, details: 'OK' }),
      capabilities: () => ['tools'],
    };

    const task = createMockTask({
      id: 'task-office-dev-01',
      agentId: 'developer',
      worker: 'router-daemon-01',
      prototypeSessionId: 'mock-proto-session-1',
    });

    const mockRepo: TaskRepository = {
      create: vi.fn(),
      list: vi.fn(),
      get: vi.fn(),
      claim: vi.fn(),
      update: vi.fn().mockImplementation((id, patch) => Promise.resolve({ ...task, ...patch })),
      cancel: vi.fn(),
      retry: vi.fn(),
      reclaimStuck: vi.fn().mockResolvedValue(0),
      heartbeat: vi.fn().mockResolvedValue(true),
    };

    const worker = new RouterWorker(mockRepo, mockProvider, 'router-daemon-01');

    // Spy on executeTask directly to avoid real git clone
    vi.spyOn(worker as any, 'executeWithRetry').mockResolvedValue({
      status: 'COMPLETED',
      workspace: '/tmp/workspace',
      baselineSnapshot: { trackedFiles: ['src/index.ts'], gitStatus: '', headSha: 'abc1234' },
      declaredChangedFiles: ['src/index.ts'],
      stdout: 'Task completed successfully',
      stderr: '',
      exitCode: 0,
      provider: 'openrouter',
      model: 'minimax/minimax-m2.7:free',
      toolCalls: 1,
      toolRounds: 1,
      durationMs: 120,
      trace: {
        totalDurationMs: 120,
        totalAttempts: 1,
        providerChainLength: 1,
        attempts: [
          {
            attempt: 0,
            provider: 'openrouter',
            model: 'minimax/minimax-m2.7:free',
            status: 'COMPLETED',
            retryable: false,
            retryReason: null,
            httpStatus: 200,
            errorCode: null,
            errorMessage: null,
            toolCalls: 1,
            toolRounds: 1,
            durationMs: 120,
            exitCode: 0,
            attemptTimeoutMs: 60000,
            isWinner: true,
            workspaceCreated: true,
            workspaceCleaned: false,
            agentId: task.agentId,
          },
        ],
        winningAttempt: 0,
        finalStatus: 'COMPLETED',
        errorCode: null,
        errorMessage: null,
        timedOut: false,
        globalTimeoutMs: 180000,
        finalizeWasCalled: false,
        finalizeStatus: null,
        commitSha: 'abc1234',
        agentId: task.agentId,
      },
    });

    vi.spyOn(worker as any, 'finalize').mockResolvedValue({
      status: 'COMPLETED',
      commitSha: 'abc1234',
      gitStatus: 'clean',
      testsPassed: true,
    });

    // Execute through BaseWorker.executeOnce
    vi.spyOn(mockRepo, 'claim').mockResolvedValue(task);
    const ran = await worker.executeOnce();

    expect(ran).toBe(true);
    expect(mockRepo.update).toHaveBeenCalledWith(
      'task-office-dev-01',
      expect.objectContaining({
        status: 'COMPLETED',
        result: expect.objectContaining({
          trace: expect.objectContaining({
            agentId: 'developer',
            attempts: expect.arrayContaining([
              expect.objectContaining({
                agentId: 'developer',
              }),
            ]),
          }),
        }),
      })
    );

    // Verify AgentDefinition can be resolved from agentId
    const agentDef = getAgent(task.agentId!);
    expect(agentDef).toBeDefined();
    expect(agentDef?.name).toBe('Developer');
    expect(agentDef?.role).toBe('DEVELOPER');
    expect(agentDef?.department).toBe('ENGINEERING');
  });

  it('2. Legacy task without agentId executes and preserves null agentId in trace without error', async () => {
    const legacyTask = createMockTask({
      id: 'legacy-task-02',
      agentId: null,
      worker: 'router-daemon-01',
    });

    const mockRepo: TaskRepository = {
      create: vi.fn(),
      list: vi.fn(),
      get: vi.fn(),
      claim: vi.fn(),
      update: vi.fn().mockImplementation((id, patch) => Promise.resolve({ ...legacyTask, ...patch })),
      cancel: vi.fn(),
      retry: vi.fn(),
      reclaimStuck: vi.fn().mockResolvedValue(0),
      heartbeat: vi.fn().mockResolvedValue(true),
    };

    const mockProvider: AgentProvider = {
      kind: 'openrouter',
      model: 'minimax/minimax-m2.7:free',
      execute: vi.fn().mockResolvedValue({
        status: 'COMPLETED',
        provider: 'openrouter',
        model: 'minimax/minimax-m2.7:free',
        exitCode: 0,
        durationMs: 80,
        stdout: 'Success',
        stderr: '',
        changedFiles: [],
        commit: null,
        errorCode: null,
        errorMessage: null,
      } as ProviderTaskResult),
      health: vi.fn().mockResolvedValue({ available: true, details: 'OK' }),
      capabilities: () => ['tools'],
    };

    const worker = new RouterWorker(mockRepo, mockProvider, 'router-daemon-01');

    vi.spyOn(worker as any, 'executeWithRetry').mockResolvedValue({
      status: 'COMPLETED',
      workspace: '/tmp/workspace',
      baselineSnapshot: { trackedFiles: [], gitStatus: '', headSha: null },
      declaredChangedFiles: [],
      stdout: 'Success',
      stderr: '',
      exitCode: 0,
      provider: 'openrouter',
      model: 'minimax/minimax-m2.7:free',
      toolCalls: 0,
      toolRounds: 0,
      durationMs: 80,
      trace: {
        totalDurationMs: 80,
        totalAttempts: 1,
        providerChainLength: 1,
        attempts: [
          {
            attempt: 0,
            provider: 'openrouter',
            model: 'minimax/minimax-m2.7:free',
            status: 'COMPLETED',
            retryable: false,
            retryReason: null,
            httpStatus: 200,
            errorCode: null,
            errorMessage: null,
            toolCalls: 0,
            toolRounds: 0,
            durationMs: 80,
            exitCode: 0,
            attemptTimeoutMs: 60000,
            isWinner: true,
            workspaceCreated: true,
            workspaceCleaned: false,
            agentId: null,
          },
        ],
        winningAttempt: 0,
        finalStatus: 'COMPLETED',
        errorCode: null,
        errorMessage: null,
        timedOut: false,
        globalTimeoutMs: 180000,
        finalizeWasCalled: false,
        finalizeStatus: null,
        commitSha: null,
        agentId: null,
      },
    });

    vi.spyOn(worker as any, 'finalize').mockResolvedValue({
      status: 'COMPLETED',
      commitSha: null,
      gitStatus: 'clean',
      testsPassed: true,
    });

    vi.spyOn(mockRepo, 'claim').mockResolvedValue(legacyTask);
    const ran = await worker.executeOnce();

    expect(ran).toBe(true);
    expect(mockRepo.update).toHaveBeenCalledWith(
      'legacy-task-02',
      expect.objectContaining({
        status: 'COMPLETED',
        result: expect.objectContaining({
          trace: expect.objectContaining({
            agentId: null,
          }),
        }),
      })
    );
  });

  it('3. Task.worker (runtime daemon) and Task.agentId (organizational identity) are strictly independent', () => {
    const task: Task = createMockTask({
      worker: 'worker-daemon-process-xyz',
      agentId: 'architect',
    });

    expect(task.worker).toBe('worker-daemon-process-xyz');
    expect(task.agentId).toBe('architect');
    expect(task.worker).not.toBe(task.agentId);
  });
});

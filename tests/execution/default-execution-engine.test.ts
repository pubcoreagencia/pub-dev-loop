/**
 * Phase 3A.2 — Unit tests for DefaultExecutionEngine.
 *
 * Covers:
 * 1. completed provider execution
 * 2. failed provider execution
 * 3. provider exception handling
 * 4. ExecutionOutcome field mapping
 * 5. SpecIdentity preservation
 * 6. RepositoryTarget preservation
 * 7. duration measurement
 * 8. changedFiles propagation
 * 9. errorCode propagation
 * 10. errorMessage propagation
 * 11. execution/finalization separation (finalization is undefined)
 * 12. PP isolation
 * 13. provider neutrality (passes neutral ProviderTaskInput)
 * 14. engine does not mutate ExecutionSpec
 * 15. defensive immutability: provider mutation of systemInstructions does NOT affect ExecutionSpec
 * 16. workspace authority: task.workspacePath takes absolute precedence over repositoryTarget.workspace
 * 17. workspace authority fallback: uses repositoryTarget.workspace when task.workspacePath is absent
 * 18. workspace authority safety: fails deterministically when no workspace is defined (no silent process.cwd())
 */

import { describe, it, expect, vi } from 'vitest';
import { DefaultExecutionEngine } from '../../src/execution/default-execution-engine.js';
import type { Task } from '../../src/domain.js';
import type { ExecutionSpec } from '../../src/task/execution-spec.js';
import type { AgentProvider, ProviderTaskInput, ProviderTaskResult } from '../../src/providers/types.js';

describe('DefaultExecutionEngine (Phase 3A.2)', () => {
  const sampleSpec: ExecutionSpec = {
    specVersion: '1.0.0',
    objective: 'Implement user auth module',
    context: {
      version: '1.0.0',
      authoritativeContext: [],
      repositoryContext: [],
      operationalContext: [],
      relevantDocumentation: [],
      knownConstraints: [],
      limitations: [],
    },
    constraints: ['no external libraries'],
    acceptanceCriteria: ['tests pass'],
    validationPlan: ['npm test'],
    executionInstructions: ['add auth.ts', 'run tests'],
    executionSteps: [{ id: 'step-1', description: 'create auth module', critical: true }],
    risks: ['token expiration'],
    escalationConditions: ['unauthorized request'],
    lineage: {
      intakeVersion: '1.0.0',
      intakeHash: 'hash-abc-123',
      source: 'api-request',
      createdAt: '2026-09-11T07:00:00.000Z',
    },
    metadata: {
      generatedAt: '2026-09-11T07:01:00.000Z',
      specHash: 'spec-hash-xyz',
    },
    repositoryTarget: {
      identity: {
        owner: 'pubcoreagencia',
        name: 'pub-dev-loop',
        fullName: 'pubcoreagencia/pub-dev-loop',
      },
      scmProvider: 'git',
      remote: 'https://github.com/pubcoreagencia/pub-dev-loop.git',
      branch: 'feature/auth',
      workspace: '/tmp/workspaces/target-spec-workspace',
      baseRevision: 'sha-base-123',
      authorization: 'bearer-token',
      provenance: 'intake',
      lineage: {
        intakeVersion: '1.0.0',
        intakeHash: 'hash-abc-123',
        source: 'api-request',
        createdAt: '2026-09-11T07:00:00.000Z',
      },
      isDefault: true,
    },
    governanceLevel: 'DEVELOPER',
    permissions: {
      repositoryRead: true,
      repositoryWrite: true,
      branchWrite: true,
      commit: true,
      push: false,
      externalResearch: false,
      filesystemWorkspace: true,
      privilegedOperations: false,
    },
  };

  const sampleTask: Task = {
    id: 'TASK-100',
    project: 'pub-dev-loop',
    repository: 'https://github.com/pubcoreagencia/pub-dev-loop.git',
    objective: 'Implement user auth module',
    prompt: 'Create JWT auth in auth.ts',
    status: 'ASSIGNED',
    priority: 1,
    worker: 'pdl-router',
    result: null,
    error: null,
    branch: 'feature/auth',
    commitSha: null,
    gitStatus: null,
    createdAt: new Date('2026-09-11T07:00:00.000Z'),
    updatedAt: new Date('2026-09-11T07:00:00.000Z'),
    leaseOwner: 'pdl-router',
    leaseDeadline: new Date(Date.now() + 60000),
    heartbeatAt: new Date(),
    workspacePath: '/tmp/workspaces/physical-worker-clone-100',
    prototypeSessionId: null,
  };

  function createMockProvider(overrides: Partial<ProviderTaskResult> = {}, executeFn?: any): AgentProvider {
    return {
      kind: 'openrouter',
      model: 'anthropic/claude-3.5-sonnet',
      execute: executeFn ?? vi.fn().mockResolvedValue({
        status: 'COMPLETED',
        provider: 'openrouter',
        model: 'anthropic/claude-3.5-sonnet',
        exitCode: 0,
        durationMs: 250,
        stdout: 'Success',
        stderr: '',
        changedFiles: ['src/auth.ts', 'tests/auth.test.ts'],
        commit: null,
        errorCode: null,
        errorMessage: null,
        ...overrides,
      }),
      health: vi.fn().mockResolvedValue({ available: true, details: 'OK' }),
      capabilities: vi.fn().mockReturnValue(['toolCalling']),
      metadata: vi.fn().mockReturnValue({}),
    };
  }

  // 1. completed provider execution
  it('1. handles completed provider execution successfully', async () => {
    const provider = createMockProvider({ status: 'COMPLETED' });
    const engine = new DefaultExecutionEngine(provider);

    const result = await engine.execute(sampleTask, sampleSpec);

    expect(result.execution.status).toBe('COMPLETED');
    expect(result.execution.errorCode).toBeNull();
    expect(result.execution.errorMessage).toBeNull();
  });

  // 2. failed provider execution
  it('2. handles failed provider execution gracefully', async () => {
    const provider = createMockProvider({
      status: 'FAILED',
      errorCode: 'TOOL_EXECUTION_ERROR',
      errorMessage: 'Syntax error in generated code',
    });
    const engine = new DefaultExecutionEngine(provider);

    const result = await engine.execute(sampleTask, sampleSpec);

    expect(result.execution.status).toBe('FAILED');
    expect(result.execution.errorCode).toBe('TOOL_EXECUTION_ERROR');
    expect(result.execution.errorMessage).toBe('Syntax error in generated code');
  });

  // 3. provider exception
  it('3. isolates provider runtime exceptions into FAILED ExecutionOutcome', async () => {
    const executeFn = vi.fn().mockRejectedValue(new Error('Network connection terminated'));
    const provider = createMockProvider({}, executeFn);
    const engine = new DefaultExecutionEngine(provider);

    const result = await engine.execute(sampleTask, sampleSpec);

    expect(result.execution.status).toBe('FAILED');
    expect(result.execution.errorCode).toBe('EXECUTION_ERROR');
    expect(result.execution.errorMessage).toContain('Network connection terminated');
    expect(result.execution.changedFiles).toEqual([]);
  });

  // 4. ExecutionOutcome mapping
  it('4. maps all ExecutionOutcome fields accurately with physical workspace authority', async () => {
    const provider = createMockProvider({
      provider: '9router',
      model: 'openai/gpt-4o',
      durationMs: 1234,
      changedFiles: ['fileA.ts', 'fileB.ts'],
    });
    const engine = new DefaultExecutionEngine(provider);

    const result = await engine.execute(sampleTask, sampleSpec);

    expect(result.execution.provider).toBe('9router');
    expect(result.execution.model).toBe('openai/gpt-4o');
    expect(result.execution.workspace).toBe('/tmp/workspaces/physical-worker-clone-100');
    expect(result.execution.durationMs).toBe(1234);
    expect(result.execution.changedFiles).toEqual(['fileA.ts', 'fileB.ts']);
  });

  // 5. SpecIdentity preservation
  it('5. preserves SpecIdentity with exact lineage from ExecutionSpec and Task', async () => {
    const provider = createMockProvider();
    const engine = new DefaultExecutionEngine(provider);

    const result = await engine.execute(sampleTask, sampleSpec);

    expect(result.specIdentity.specVersion).toBe('1.0.0');
    expect(result.specIdentity.taskId).toBe(sampleTask.id);
    expect(result.specIdentity.lineage).toEqual(sampleSpec.lineage);
    expect(result.specIdentity.lineage.intakeHash).toBe('hash-abc-123');
  });

  // 6. RepositoryTarget preservation
  it('6. preserves RepositoryTarget without mutation or reduction', async () => {
    const provider = createMockProvider();
    const engine = new DefaultExecutionEngine(provider);

    await engine.execute(sampleTask, sampleSpec);

    expect(typeof sampleSpec.repositoryTarget).toBe('object');
    expect((sampleSpec.repositoryTarget as any).identity.owner).toBe('pubcoreagencia');
    expect((sampleSpec.repositoryTarget as any).workspace).toBe('/tmp/workspaces/target-spec-workspace');
  });

  // 7. duration measurement
  it('7. measures elapsed duration when provider does not report durationMs', async () => {
    const provider = createMockProvider({ durationMs: 0 });
    const engine = new DefaultExecutionEngine(provider);

    const result = await engine.execute(sampleTask, sampleSpec);

    expect(result.execution.durationMs).toBeGreaterThan(0);
  });

  // 8. changedFiles propagation
  it('8. propagates changedFiles list to ExecutionOutcome', async () => {
    const provider = createMockProvider({
      changedFiles: ['src/a.ts', 'src/b.ts', 'src/c.ts'],
    });
    const engine = new DefaultExecutionEngine(provider);

    const result = await engine.execute(sampleTask, sampleSpec);

    expect(result.execution.changedFiles).toEqual(['src/a.ts', 'src/b.ts', 'src/c.ts']);
  });

  // 9. errorCode propagation
  it('9. propagates errorCode on timeout or failure status', async () => {
    const provider = createMockProvider({
      status: 'TIMED_OUT',
      errorCode: 'TIMEOUT_EXCEEDED',
      errorMessage: 'Operation timed out after 60s',
    });
    const engine = new DefaultExecutionEngine(provider);

    const result = await engine.execute(sampleTask, sampleSpec);

    expect(result.execution.status).toBe('FAILED');
    expect(result.execution.errorCode).toBe('TIMEOUT_EXCEEDED');
  });

  // 10. errorMessage propagation
  it('10. propagates errorMessage on provider failure', async () => {
    const provider = createMockProvider({
      status: 'ROUTER_HTTP_ERROR',
      errorMessage: 'Rate limit exceeded on upstream model (429)',
    });
    const engine = new DefaultExecutionEngine(provider);

    const result = await engine.execute(sampleTask, sampleSpec);

    expect(result.execution.status).toBe('FAILED');
    expect(result.execution.errorMessage).toContain('Rate limit exceeded');
  });

  // 11. execution/finalization separation
  it('11. strictly separates execution from finalization (finalization is undefined)', async () => {
    const provider = createMockProvider({ status: 'COMPLETED' });
    const engine = new DefaultExecutionEngine(provider);

    const result = await engine.execute(sampleTask, sampleSpec);

    expect(result.execution).toBeDefined();
    expect(result.finalization).toBeUndefined();
    // Outcome does not carry commit fields
    expect((result.execution as any).commitSha).toBeUndefined();
    expect((result.execution as any).commitMessage).toBeUndefined();
  });

  // 12. PP isolation
  it('12. respects PP isolation (no prototypeSessionId or prototype artifacts in execution call)', async () => {
    let capturedTaskInput: ProviderTaskInput | null = null;
    const provider: AgentProvider = {
      kind: 'openrouter',
      model: 'claude',
      execute: vi.fn().mockImplementation(async (input: any) => {
        capturedTaskInput = input;
        return {
          status: 'COMPLETED',
          provider: 'openrouter',
          model: 'claude',
          exitCode: 0,
          durationMs: 10,
          stdout: '',
          stderr: '',
          changedFiles: [],
          commit: null,
          errorCode: null,
          errorMessage: null,
        };
      }),
      health: vi.fn(),
      capabilities: vi.fn().mockReturnValue([]),
      metadata: vi.fn().mockReturnValue({}),
    };

    const engine = new DefaultExecutionEngine(provider);
    await engine.execute(sampleTask, sampleSpec);

    expect(capturedTaskInput).not.toBeNull();
    expect((capturedTaskInput as any).prototypeSessionId).toBeUndefined();
    expect((capturedTaskInput as any).isPrototypeTask).toBeUndefined();
  });

  // 13. provider neutrality
  it('13. passes neutral ProviderTaskInput with system instructions from spec', async () => {
    let capturedTaskInput: ProviderTaskInput | null = null;
    const provider: AgentProvider = {
      kind: 'openrouter',
      model: 'claude',
      execute: vi.fn().mockImplementation(async (input: any) => {
        capturedTaskInput = input;
        return {
          status: 'COMPLETED',
          provider: 'openrouter',
          model: 'claude',
          exitCode: 0,
          durationMs: 10,
          stdout: '',
          stderr: '',
          changedFiles: [],
          commit: null,
          errorCode: null,
          errorMessage: null,
        };
      }),
      health: vi.fn(),
      capabilities: vi.fn().mockReturnValue([]),
      metadata: vi.fn().mockReturnValue({}),
    };

    const engine = new DefaultExecutionEngine(provider);
    await engine.execute(sampleTask, sampleSpec);

    expect(capturedTaskInput?.id).toBe(sampleTask.id);
    expect(capturedTaskInput?.objective).toBe(sampleSpec.objective);
    expect(capturedTaskInput?.systemInstructions).toEqual(['add auth.ts', 'run tests']);
  });

  // 14. engine does not mutate ExecutionSpec
  it('14. guarantees ExecutionSpec is not mutated during execution', async () => {
    const frozenSpec = JSON.parse(JSON.stringify(sampleSpec));
    Object.freeze(frozenSpec);
    Object.freeze(frozenSpec.lineage);
    Object.freeze(frozenSpec.metadata);
    Object.freeze(frozenSpec.repositoryTarget);

    const provider = createMockProvider();
    const engine = new DefaultExecutionEngine(provider);

    const result = await engine.execute(sampleTask, frozenSpec);

    expect(result.execution.status).toBe('COMPLETED');
    expect(frozenSpec.objective).toBe(sampleSpec.objective);
    expect(frozenSpec.specVersion).toBe(sampleSpec.specVersion);
  });

  // 15. defensive immutability: provider mutation of systemInstructions does NOT affect ExecutionSpec
  it('15. defensive immutability: provider mutating systemInstructions does NOT affect ExecutionSpec', async () => {
    const testSpec: ExecutionSpec = {
      ...sampleSpec,
      executionInstructions: ['instruction 1', 'instruction 2'],
    };

    const mutatingProvider: AgentProvider = {
      kind: 'openrouter',
      model: 'claude',
      execute: vi.fn().mockImplementation(async (input: ProviderTaskInput) => {
        // Provider mutates its received array
        if (input.systemInstructions) {
          input.systemInstructions.push('INJECTED_INSTRUCTION');
          input.systemInstructions[0] = 'CORRUPTED';
        }
        return {
          status: 'COMPLETED',
          provider: 'openrouter',
          model: 'claude',
          exitCode: 0,
          durationMs: 10,
          stdout: '',
          stderr: '',
          changedFiles: [],
          commit: null,
          errorCode: null,
          errorMessage: null,
        };
      }),
      health: vi.fn(),
      capabilities: vi.fn().mockReturnValue([]),
      metadata: vi.fn().mockReturnValue({}),
    };

    const engine = new DefaultExecutionEngine(mutatingProvider);
    await engine.execute(sampleTask, testSpec);

    // Spec's original instructions array must be completely untouched!
    expect(testSpec.executionInstructions).toEqual(['instruction 1', 'instruction 2']);
    expect(testSpec.executionInstructions).not.toContain('INJECTED_INSTRUCTION');
    expect((testSpec.executionInstructions as string[])[0]).toBe('instruction 1');
  });

  // 16. workspace authority: task.workspacePath takes precedence over repositoryTarget.workspace
  it('16. workspace authority: task.workspacePath takes absolute precedence when defined', async () => {
    let capturedWorkspace: string | null = null;
    const provider: AgentProvider = {
      kind: 'openrouter',
      model: 'claude',
      execute: vi.fn().mockImplementation(async (_input: any, workspace: string) => {
        capturedWorkspace = workspace;
        return {
          status: 'COMPLETED',
          provider: 'openrouter',
          model: 'claude',
          exitCode: 0,
          durationMs: 10,
          stdout: '',
          stderr: '',
          changedFiles: [],
          commit: null,
          errorCode: null,
          errorMessage: null,
        };
      }),
      health: vi.fn(),
      capabilities: vi.fn().mockReturnValue([]),
      metadata: vi.fn().mockReturnValue({}),
    };

    const taskWithWorkspace: Task = {
      ...sampleTask,
      workspacePath: '/tmp/physical-worker-clone-789',
    };
    const specWithTarget: ExecutionSpec = {
      ...sampleSpec,
      repositoryTarget: {
        ...sampleSpec.repositoryTarget!,
        workspace: '/declarative/target/workspace',
      },
    };

    const engine = new DefaultExecutionEngine(provider);
    const result = await engine.execute(taskWithWorkspace, specWithTarget);

    expect(capturedWorkspace).toBe('/tmp/physical-worker-clone-789');
    expect(result.execution.workspace).toBe('/tmp/physical-worker-clone-789');
  });

  // 17. workspace authority fallback: uses repositoryTarget.workspace when task.workspacePath is absent
  it('17. workspace authority fallback: uses repositoryTarget.workspace when task.workspacePath is absent', async () => {
    let capturedWorkspace: string | null = null;
    const provider: AgentProvider = {
      kind: 'openrouter',
      model: 'claude',
      execute: vi.fn().mockImplementation(async (_input: any, workspace: string) => {
        capturedWorkspace = workspace;
        return {
          status: 'COMPLETED',
          provider: 'openrouter',
          model: 'claude',
          exitCode: 0,
          durationMs: 10,
          stdout: '',
          stderr: '',
          changedFiles: [],
          commit: null,
          errorCode: null,
          errorMessage: null,
        };
      }),
      health: vi.fn(),
      capabilities: vi.fn().mockReturnValue([]),
      metadata: vi.fn().mockReturnValue({}),
    };

    const taskWithoutWorkspace: Task = {
      ...sampleTask,
      workspacePath: null,
    };
    const specWithTarget: ExecutionSpec = {
      ...sampleSpec,
      repositoryTarget: {
        ...sampleSpec.repositoryTarget!,
        workspace: '/declarative/target/workspace',
      },
    };

    const engine = new DefaultExecutionEngine(provider);
    const result = await engine.execute(taskWithoutWorkspace, specWithTarget);

    expect(capturedWorkspace).toBe('/declarative/target/workspace');
    expect(result.execution.workspace).toBe('/declarative/target/workspace');
  });

  // 18. workspace authority safety: fails deterministically when neither workspace is defined
  it('18. workspace authority safety: fails deterministically when neither task.workspacePath nor repositoryTarget.workspace is defined', async () => {
    const provider = createMockProvider();
    const taskWithoutWorkspace: Task = {
      ...sampleTask,
      workspacePath: null,
    };
    const specWithoutWorkspace: ExecutionSpec = {
      ...sampleSpec,
      repositoryTarget: undefined,
    };

    const engine = new DefaultExecutionEngine(provider);
    const result = await engine.execute(taskWithoutWorkspace, specWithoutWorkspace);

    expect(result.execution.status).toBe('FAILED');
    expect(result.execution.errorCode).toBe('EXECUTION_ERROR');
    expect(result.execution.errorMessage).toContain('No execution workspace defined');
    // Provider was never called
    expect(provider.execute).not.toHaveBeenCalled();
  });
});

import { describe, it, expect, vi } from 'vitest';
import { TaskPlanner } from '../../src/pdl/planning/planner.js';
import type { StructuredExecutionPlan } from '../../src/pdl/planning/types.js';
import type { AgentProvider, ProviderTaskResult, ProviderTaskInput } from '../../src/providers/types.js';
import type { Task } from '../../src/domain.js';
import type { ExecutionSpec } from '../../src/task/execution-spec.js';
import type { ProductManifest } from '../../src/pdl/products/catalog.js';

const mockProduct: ProductManifest = {
  productId: 'pub-dev-loop-template',
  repository: 'https://github.com/pubcoreagencia/pub-dev-loop-template.git',
  organization: 'pubcoreagencia',
  defaultBranch: 'main',
  developmentBranchPolicy: ['feat/*', 'fix/*'],
  testCommand: 'npm test',
  allowedPaths: ['src/**', 'test/**'],
  protectedPaths: ['.github/**', '.env*'],
  maxAutonomyLevel: 5,
};

const mockTask: Task = {
  id: 'task-test-planner',
  project: 'pub-dev-loop-template',
  repository: 'https://github.com/pubcoreagencia/pub-dev-loop-template.git',
  objective: 'Refactor and test auth module',
  prompt: 'Do it properly',
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
};

const mockSpec: ExecutionSpec = {
  specVersion: '1.0.0',
  objective: 'Refactor and test auth module',
  context: { kind: 'UNKNOWN', reason: 'test' },
  constraints: [],
  acceptanceCriteria: ['Valid tests'],
  validationPlan: ['npm test'],
  executionInstructions: ['Edit src/auth.ts and test/auth.test.ts'],
  executionSteps: [],
  risks: [],
  escalationConditions: [],
  lineage: {
    intakeVersion: '1.0.0',
    intakeHash: 'hash',
    source: 'test',
    createdAt: new Date().toISOString(),
  },
  metadata: {
    generatedAt: new Date().toISOString(),
    specHash: 'hash',
  },
};

const validPlanObject: StructuredExecutionPlan = {
  planVersion: '1.0.0',
  taskId: 'task-test-planner',
  attempt: 0,
  goal: 'Refactor authentication module cleanly and add thorough tests',
  filesToChange: ['src/auth.ts', 'test/auth.test.ts'],
  dependencies: [],
  implementationSteps: [
    { stepNumber: 1, description: 'Refactor auth function', targetFile: 'src/auth.ts' },
    { stepNumber: 2, description: 'Verify test suite', targetFile: 'test/auth.test.ts' },
  ],
  testStrategy: ['npm test', 'run vitest suite'],
  riskPoints: ['Regression on edge cases'],
  rollbackConsiderations: ['Git revert'],
  complexityAssessment: 'COMPLEX',
};

function createMockProvider(executeFn: (input: ProviderTaskInput) => Promise<ProviderTaskResult>): AgentProvider {
  return {
    kind: 'mock',
    model: 'mock-planner-model',
    execute: executeFn,
    async health() {
      return { available: true, details: 'mock' };
    },
    capabilities() {
      return ['coding'];
    },
    metadata() {
      return { provider: 'mock' };
    },
  };
}

describe('TaskPlanner — Unit Tests', () => {
  it('generates a valid plan on first attempt without revisions', async () => {
    const provider = createMockProvider(async () => ({
      status: 'COMPLETED',
      provider: 'mock',
      model: 'mock-planner-model',
      exitCode: 0,
      durationMs: 50,
      stdout: JSON.stringify(validPlanObject),
      stderr: '',
      changedFiles: [],
      commit: null,
      errorCode: null,
      errorMessage: null,
      toolCalls: 0,
      toolRounds: 0,
    }));

    const onPlanningStarted = vi.fn();
    const onPlanGenerated = vi.fn();
    const onPlanValidated = vi.fn();
    const onPlanRejected = vi.fn();

    const result = await TaskPlanner.generatePlan({
      task: mockTask,
      spec: mockSpec,
      provider,
      attempt: 0,
      product: mockProduct,
      authorizedScope: mockProduct.allowedPaths,
      onPlanningStarted,
      onPlanGenerated,
      onPlanValidated,
      onPlanRejected,
    });

    expect(result.status).toBe('SUCCESS');
    expect(result.revisionsAttempted).toBe(0);
    expect(result.plan).toBeDefined();
    expect(result.plan?.goal).toBe(validPlanObject.goal);
    expect(onPlanningStarted).toHaveBeenCalled();
    expect(onPlanGenerated).toHaveBeenCalled();
    expect(onPlanValidated).toHaveBeenCalled();
    expect(onPlanRejected).not.toHaveBeenCalled();
  });

  it('handles markdown fences in JSON output cleanly', async () => {
    const provider = createMockProvider(async () => ({
      status: 'COMPLETED',
      provider: 'mock',
      model: 'mock-planner-model',
      exitCode: 0,
      durationMs: 50,
      stdout: `\`\`\`json\n${JSON.stringify(validPlanObject, null, 2)}\n\`\`\``,
      stderr: '',
      changedFiles: [],
      commit: null,
      errorCode: null,
      errorMessage: null,
      toolCalls: 0,
      toolRounds: 0,
    }));

    const result = await TaskPlanner.generatePlan({
      task: mockTask,
      spec: mockSpec,
      provider,
      attempt: 0,
      product: mockProduct,
      authorizedScope: mockProduct.allowedPaths,
    });

    expect(result.status).toBe('SUCCESS');
    expect(result.plan?.filesToChange).toEqual(validPlanObject.filesToChange);
  });

  it('fails closed immediately when Stage 2 (Scope) or Stage 3 (Governance) is fatal without using revision budget', async () => {
    const fatalPlan = {
      ...validPlanObject,
      filesToChange: ['../escaped.ts'],
    };

    let callCount = 0;
    const provider = createMockProvider(async () => {
      callCount++;
      return {
        status: 'COMPLETED',
        provider: 'mock',
        model: 'mock-planner-model',
        exitCode: 0,
        durationMs: 50,
        stdout: JSON.stringify(fatalPlan),
        stderr: '',
        changedFiles: [],
        commit: null,
        errorCode: null,
        errorMessage: null,
        toolCalls: 0,
        toolRounds: 0,
      };
    });

    const result = await TaskPlanner.generatePlan({
      task: mockTask,
      spec: mockSpec,
      provider,
      attempt: 0,
      product: mockProduct,
    });

    expect(result.status).toBe('FAILED');
    expect(result.errorCode).toBe('PLAN_VALIDATION_FATAL');
    expect(result.revisionsAttempted).toBe(0);
    expect(callCount).toBe(1); // Revision was NOT attempted because Stage 2 is fatal
  });

  it('uses revision budget (max 1) for non-fatal errors (Stage 1 or Stage 4) and succeeds if revised plan is valid', async () => {
    let callCount = 0;
    const provider = createMockProvider(async () => {
      callCount++;
      if (callCount === 1) {
        // First attempt: Stage 1 error (goal too short, revision allowed)
        return {
          status: 'COMPLETED',
          provider: 'mock',
          model: 'mock-planner-model',
          exitCode: 0,
          durationMs: 50,
          stdout: JSON.stringify({ ...validPlanObject, goal: 'Short' }),
          stderr: '',
          changedFiles: [],
          commit: null,
          errorCode: null,
          errorMessage: null,
          toolCalls: 0,
          toolRounds: 0,
        };
      }
      // Second attempt (revision): valid plan
      return {
        status: 'COMPLETED',
        provider: 'mock',
        model: 'mock-planner-model',
        exitCode: 0,
        durationMs: 50,
        stdout: JSON.stringify(validPlanObject),
        stderr: '',
        changedFiles: [],
        commit: null,
        errorCode: null,
        errorMessage: null,
        toolCalls: 0,
        toolRounds: 0,
      };
    });

    const result = await TaskPlanner.generatePlan({
      task: mockTask,
      spec: mockSpec,
      provider,
      attempt: 0,
      product: mockProduct,
    });

    expect(result.status).toBe('SUCCESS');
    expect(result.revisionsAttempted).toBe(1);
    expect(callCount).toBe(2);
  });

  it('fails closed when revision attempt also fails validation (budget exhausted)', async () => {
    let callCount = 0;
    const provider = createMockProvider(async () => {
      callCount++;
      return {
        status: 'COMPLETED',
        provider: 'mock',
        model: 'mock-planner-model',
        exitCode: 0,
        durationMs: 50,
        stdout: JSON.stringify({ ...validPlanObject, goal: 'Still short' }),
        stderr: '',
        changedFiles: [],
        commit: null,
        errorCode: null,
        errorMessage: null,
        toolCalls: 0,
        toolRounds: 0,
      };
    });

    const result = await TaskPlanner.generatePlan({
      task: mockTask,
      spec: mockSpec,
      provider,
      attempt: 0,
      product: mockProduct,
    });

    expect(result.status).toBe('FAILED');
    expect(result.errorCode).toBe('PLAN_VALIDATION_FAILED');
    expect(result.revisionsAttempted).toBe(1);
    expect(callCount).toBe(2);
  });
});

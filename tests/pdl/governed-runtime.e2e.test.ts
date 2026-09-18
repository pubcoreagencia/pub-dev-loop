import { describe, expect, it, vi } from 'vitest';
import type { Task } from '../../src/domain.js';
import type { ExecutionResult } from '../../src/execution/execution-engine.js';
import { DefaultExecutionEngine } from '../../src/execution/default-execution-engine.js';
import type { AgentProvider, ProviderTaskInput, ProviderTaskResult } from '../../src/providers/types.js';
import type { ExecutionSpec } from '../../src/task/execution-spec.js';
import { PDL_EXECUTION_GOVERNANCE_VERSION, PdlExecutionGovernance } from '../../src/pdl/governance/execution-governance.js';
import { GovernedRuntime } from '../../src/pdl/governance/governed-runtime.js';
import { PDL_AGENT_RUNTIME_CONTRACT_VERSION, type RuntimeContext } from '../../src/pdl/runtime/runtime-contract.js';
import type { GovernanceDecision } from '../../src/pdl/governance/types.js';
import { ExecutionEngineRuntimeAdapter } from '../../src/pdl/runtime/execution-runtime-adapter.js';

const task = {
  id: 'TASK-GOV-E2E-001',
  project: 'pub-rate-calculator',
  repository: 'https://github.com/pubcoreagencia/pub-rate-calculator',
  prompt: 'governance runtime proof',
  objective: 'prove governed execution path',
  branch: 'main',
  workspacePath: '/tmp/pdl-governance-e2e',
} as Task;

const spec = {
  specVersion: '1.0.0',
  objective: 'prove governed execution path',
  context: { version: '1.0.0', authoritativeContext: [], repositoryContext: [], operationalContext: [], relevantDocumentation: [], knownConstraints: [], limitations: [] },
  constraints: [],
  acceptanceCriteria: ['provider execution completes'],
  validationPlan: ['assert governance and runtime evidence'],
  executionInstructions: [],
  executionSteps: [],
  risks: [],
  escalationConditions: [],
  lineage: {
    intakeVersion: '1.0.0',
    intakeHash: 'governance-e2e-hash',
    source: 'governance-e2e',
    createdAt: '2026-09-18T00:00:00.000Z',
  },
  metadata: {
    generatedAt: '2026-09-18T00:00:00.000Z',
    specHash: 'governance-e2e-spec',
  },
} as ExecutionSpec;

function permittedPolicy(): { evaluateExecution: (task: Task) => Promise<GovernanceDecision> } {
  return {
    evaluateExecution: vi.fn(async (t: Task) => ({
      allowed: true,
      gate: 'EXECUTION',
      reasonCode: 'PERMITTED',
      reason: 'permitted for E2E proof',
      activeLevel: 3,
      killSwitchActive: false,
      limits: {
        activeLevel: 3,
        maxConsecutiveTasks: 3,
        maxTaskDurationMs: 180000,
        maxToolRoundsPerTask: 10,
        maxCorrectionAttempts: 2,
        maxConsecutiveFailures: 1,
        allowedProducts: [t.project],
        killSwitchActive: false,
      },
      timestamp: new Date().toISOString(),
      taskId: t.id,
      productId: t.project,
    })),
  };
}

class ProofProvider implements AgentProvider {
  readonly kind = 'mock' as const;
  readonly model = 'governance-proof-model';
  private readonly calls: ProviderTaskInput[] = [];

  async execute(input: Task | ProviderTaskInput, workspace: string): Promise<ProviderTaskResult> {
    this.calls.push(input as ProviderTaskInput);
    return {
      status: 'COMPLETED',
      provider: 'mock',
      model: this.model,
      exitCode: 0,
      durationMs: 7,
      stdout: 'PROOF_OK',
      stderr: '',
      changedFiles: ['proof.txt'],
      commit: null,
      errorCode: null,
      errorMessage: null,
    };
  }

  async health() { return { available: true, details: 'proof provider' }; }
  capabilities() { return ['workspace']; }
  metadata() { return { test: 'true' }; }
  callCount() { return this.calls.length; }
}

describe('P1.2 governed runtime E2E', () => {
  it('authorizes governance, executes the real DefaultExecutionEngine path, then records post evidence', async () => {
    const provider = new ProofProvider();
    const engine = new DefaultExecutionEngine(provider);
    const adapter = new ExecutionEngineRuntimeAdapter(task, spec, engine);

    const prePost: string[] = [];
    const governance = new PdlExecutionGovernance({
      policyEngine: permittedPolicy() as never,
      capabilityGrants: {
        WORKSPACE_READ: true,
        WORKSPACE_WRITE: true,
        COMMAND_EXECUTION: true,
      },
      preHook: ({ audit }) => prePost.push('pre:' + audit.authorization),
      postHook: ({ audit }) => prePost.push('post:' + audit.executionStatus),
    });

    const governed = new GovernedRuntime(governance, adapter);
    const context: RuntimeContext = {
      contractVersion: PDL_AGENT_RUNTIME_CONTRACT_VERSION,
      runId: 'RUN-GOV-E2E-001',
      taskId: task.id,
      repository: task.repository,
      branch: task.branch,
      workspace: task.workspacePath,
      provider: provider.kind,
      model: provider.model,
    };

    const result = await governed.execute({
      governanceVersion: PDL_EXECUTION_GOVERNANCE_VERSION,
      task,
      gate: 'EXECUTION',
      action: 'TOOL_EXECUTION',
      requestedCapabilities: ['WORKSPACE_READ', 'WORKSPACE_WRITE', 'COMMAND_EXECUTION'],
      grantedCapabilities: ['WORKSPACE_READ', 'WORKSPACE_WRITE', 'COMMAND_EXECUTION'],
    }, context);

    expect(result.authorization.authorization).toBe('ALLOW');
    expect(result.runtime.status).toBe('COMPLETED');
    expect(result.runtime.evidence.map(e => e.event)).toEqual([
      'runtime.received',
      'runtime.authorized',
      'runtime.execution.started',
      'runtime.execution.completed',
    ]);
    expect(result.postExecutionAudit?.event).toBe('POST_EXECUTION');
    expect(result.postExecutionAudit?.executionStatus).toBe('COMPLETED');
    expect(result.postExecutionAudit?.evidence).toEqual({
      runtimeStatus: 'COMPLETED',
      evidenceCount: 4,
    });
    expect(prePost).toEqual(['pre:ALLOW', 'post:COMPLETED']);
    expect(provider.callCount()).toBe(1);
  });

  it('blocks before the real execution engine when governance denies', async () => {
    const provider = new ProofProvider();
    const engine = new DefaultExecutionEngine(provider);
    const adapter = new ExecutionEngineRuntimeAdapter(task, spec, engine);
    const governance = new PdlExecutionGovernance({
      policyEngine: {
        evaluateExecution: vi.fn(async () => ({
          allowed: false,
          gate: 'EXECUTION',
          reasonCode: 'KILL_SWITCH_ACTIVE',
          reason: 'blocked for proof',
          activeLevel: 0,
          killSwitchActive: true,
          limits: {
            activeLevel: 0,
            maxConsecutiveTasks: 1,
            maxTaskDurationMs: 180000,
            maxToolRoundsPerTask: 10,
            maxCorrectionAttempts: 2,
            maxConsecutiveFailures: 1,
            allowedProducts: [],
            killSwitchActive: true,
          },
          timestamp: new Date().toISOString(),
          taskId: task.id,
          productId: task.project,
        })) as never,
      } as never,
      capabilityGrants: {
        WORKSPACE_READ: true,
        WORKSPACE_WRITE: true,
        COMMAND_EXECUTION: true,
      },
    });

    const governed = new GovernedRuntime(governance, adapter);
    const result = await governed.execute({
      governanceVersion: PDL_EXECUTION_GOVERNANCE_VERSION,
      task,
      gate: 'EXECUTION',
      action: 'TOOL_EXECUTION',
      requestedCapabilities: ['WORKSPACE_READ', 'WORKSPACE_WRITE', 'COMMAND_EXECUTION'],
      grantedCapabilities: ['WORKSPACE_READ', 'WORKSPACE_WRITE', 'COMMAND_EXECUTION'],
    }, {
      contractVersion: PDL_AGENT_RUNTIME_CONTRACT_VERSION,
      runId: 'RUN-GOV-E2E-002',
      taskId: task.id,
      repository: task.repository,
    });

    expect(result.authorization.authorization).toBe('DENY');
    expect(result.runtime.status).toBe('BLOCKED');
    expect(result.postExecutionAudit).toBeUndefined();
    expect(provider.callCount()).toBe(0);
  });
});

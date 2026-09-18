import { describe, expect, it, vi } from 'vitest';
import type { Task } from '../../src/domain.js';
import {
  PDL_EXECUTION_GOVERNANCE_VERSION,
  PdlExecutionGovernance,
  type ExecutionGovernanceRequest,
} from '../../src/pdl/governance/execution-governance.js';
import type { GovernanceDecision } from '../../src/pdl/governance/types.js';

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-governance-001',
    project: 'pub-rate-calculator',
    repository: 'pub-rate-calculator',
    objective: 'governance proof',
    prompt: 'prove governance boundary',
    status: 'ASSIGNED',
    priority: 1,
    worker: 'worker-1',
    result: null,
    error: null,
    branch: 'main',
    commitSha: null,
    gitStatus: null,
    createdAt: new Date('2026-09-17T00:00:00.000Z'),
    updatedAt: new Date('2026-09-17T00:00:00.000Z'),
    leaseOwner: 'worker-1',
    leaseDeadline: null,
    heartbeatAt: null,
    workspacePath: '/tmp/pdl-governance',
    prototypeSessionId: null,
    ...overrides,
  };
}

function permittedPolicy(): { evaluateExecution: (task: Task) => Promise<GovernanceDecision> } {
  return {
    evaluateExecution: vi.fn(async (t: Task) => ({
      allowed: true,
      gate: 'EXECUTION',
      reasonCode: 'PERMITTED',
      reason: 'permitted',
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

function request(overrides: Partial<ExecutionGovernanceRequest> = {}): ExecutionGovernanceRequest {
  return {
    governanceVersion: PDL_EXECUTION_GOVERNANCE_VERSION,
    task: task(),
    gate: 'EXECUTION',
    action: 'TOOL_EXECUTION',
    requestedCapabilities: ['WORKSPACE_READ', 'WORKSPACE_WRITE', 'COMMAND_EXECUTION'],
    grantedCapabilities: ['WORKSPACE_READ', 'WORKSPACE_WRITE', 'COMMAND_EXECUTION'],
    ...overrides,
  };
}

describe('PdlExecutionGovernance', () => {
  it('allows execution only when policy and capabilities both permit it', async () => {
    const result = await new PdlExecutionGovernance({
      policyEngine: permittedPolicy() as never,
      capabilityGrants: {
        WORKSPACE_READ: true,
        WORKSPACE_WRITE: true,
        COMMAND_EXECUTION: true,
      },
    }).authorize(request());

    expect(result.authorization).toBe('ALLOW');
    expect(result.audit.decisionCode).toBe('PERMITTED');
  });

  it('fails closed when a requested capability is not granted', async () => {
    const result = await new PdlExecutionGovernance({
      policyEngine: permittedPolicy() as never,
      capabilityGrants: {
        WORKSPACE_READ: true,
        COMMAND_EXECUTION: true,
      },
    }).authorize(request());

    expect(result.authorization).toBe('DENY');
    expect(result.audit.decisionCode).toBe('CAPABILITY_NOT_GRANTED');
  });

  it('requires scoped approval for credential access', async () => {
    const result = await new PdlExecutionGovernance({
      policyEngine: permittedPolicy() as never,
      capabilityGrants: { CREDENTIAL_ACCESS: true },
    }).authorize(request({
      requestedCapabilities: ['CREDENTIAL_ACCESS'],
      grantedCapabilities: ['CREDENTIAL_ACCESS'],
      action: 'CREDENTIAL_USE',
    }));

    expect(result.authorization).toBe('APPROVAL_REQUIRED');
    expect(result.audit.decisionCode).toBe('APPROVAL_REQUIRED');
  });

  it('accepts a valid scoped approval', async () => {
    const result = await new PdlExecutionGovernance({
      policyEngine: permittedPolicy() as never,
      capabilityGrants: { CREDENTIAL_ACCESS: true },
      now: () => new Date('2026-09-17T12:00:00.000Z'),
    }).authorize(request({
      requestedCapabilities: ['CREDENTIAL_ACCESS'],
      grantedCapabilities: ['CREDENTIAL_ACCESS'],
      action: 'CREDENTIAL_USE',
      approval: {
        approvalId: 'approval-001',
        approvedBy: 'operator',
        approvedAt: '2026-09-17T11:59:00.000Z',
        expiresAt: '2026-09-17T12:05:00.000Z',
        scope: ['CREDENTIAL_ACCESS'],
      },
    }));

    expect(result.authorization).toBe('ALLOW');
  });

  it('rejects unbounded delegation', async () => {
    const result = await new PdlExecutionGovernance({
      policyEngine: permittedPolicy() as never,
      capabilityGrants: { SUBAGENT_DELEGATION: true },
    }).authorize(request({
      requestedCapabilities: ['SUBAGENT_DELEGATION'],
      grantedCapabilities: ['SUBAGENT_DELEGATION'],
      action: 'SUBAGENT_DELEGATION',
      delegation: {
        enabled: true,
        maxDepth: 4,
        maxChildren: 8,
      },
    }));

    expect(result.authorization).toBe('DENY');
    expect(result.audit.decisionCode).toBe('DELEGATION_BOUNDS_INVALID');
  });

  it('emits post-execution evidence without accepting secrets', async () => {
    const hook = vi.fn();
    const governance = new PdlExecutionGovernance({ postHook: hook });
    const event = await governance.recordPostExecution(
      request(),
      'COMPLETED',
      { durationMs: 1234, testsPassed: true }
    );

    expect(event.event).toBe('POST_EXECUTION');
    expect(event.executionStatus).toBe('COMPLETED');
    expect(event.evidence).toEqual({ durationMs: 1234, testsPassed: true });
    expect(hook).toHaveBeenCalledOnce();
  });

  it('fails closed on governance version mismatch', async () => {
    const result = await new PdlExecutionGovernance({
      policyEngine: permittedPolicy() as never,
      capabilityGrants: {
        WORKSPACE_READ: true,
        WORKSPACE_WRITE: true,
        COMMAND_EXECUTION: true,
      },
    }).authorize(request({ governanceVersion: 'wrong-version' }));

    expect(result.authorization).toBe('DENY');
    expect(result.audit.decisionCode).toBe('GOVERNANCE_VERSION_MISMATCH');
  });
});

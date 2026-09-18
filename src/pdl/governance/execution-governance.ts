/**
 * PDL Execution Governance Contract — P1.2
 *
 * Governance is an authorization/audit boundary around the existing PDL
 * runtime. It is not a second executor and does not replace the existing
 * PdlGovernanceEngine, SafetyGate-equivalent controls, ExecutionEngine,
 * provider, scheduler, or correction loop.
 */

import type { Task } from '../../domain.js';
import type { GovernanceDecision, GovernanceGate } from './types.js';
import { PdlGovernanceEngine } from './policy-engine.js';

export const PDL_EXECUTION_GOVERNANCE_VERSION = 'pdl-execution-governance-v1';

export type GovernanceCapability =
  | 'WORKSPACE_READ'
  | 'WORKSPACE_WRITE'
  | 'COMMAND_EXECUTION'
  | 'GIT_WRITE'
  | 'REMOTE_PERSISTENCE'
  | 'CREDENTIAL_ACCESS'
  | 'SUBAGENT_DELEGATION';

export type GovernanceAction =
  | 'TOOL_EXECUTION'
  | 'WORKSPACE_OPERATION'
  | 'GIT_OPERATION'
  | 'REMOTE_PERSISTENCE'
  | 'CREDENTIAL_USE'
  | 'SUBAGENT_DELEGATION';

export type GovernanceAuthorization =
  | 'ALLOW'
  | 'DENY'
  | 'APPROVAL_REQUIRED';

export interface GovernanceApproval {
  approvalId: string;
  approvedBy: string;
  approvedAt: string;
  expiresAt: string;
  scope: string[];
}

export interface GovernanceDelegation {
  enabled: boolean;
  maxDepth: number;
  maxChildren: number;
  requestedDepth?: number;
  requestedChildren?: number;
}

export interface ExecutionGovernanceRequest {
  governanceVersion: string;
  task: Task;
  gate: GovernanceGate;
  action: GovernanceAction;
  requestedCapabilities: GovernanceCapability[];
  grantedCapabilities: GovernanceCapability[];
  approval?: GovernanceApproval;
  delegation?: GovernanceDelegation;
  metadata?: Record<string, string>;
}

export interface GovernanceAuditEvent {
  governanceVersion: string;
  event: 'PRE_AUTHORIZATION' | 'POST_EXECUTION';
  timestamp: string;
  taskId: string;
  gate: GovernanceGate;
  action: GovernanceAction;
  authorization: GovernanceAuthorization;
  decisionCode: string;
  capabilityCount: number;
  approvalId?: string;
  executionStatus?: 'COMPLETED' | 'FAILED' | 'BLOCKED' | 'CANCELLED';
  evidence?: Record<string, string | number | boolean>;
}

export interface GovernanceHookContext {
  request: ExecutionGovernanceRequest;
  decision: GovernanceAuthorization;
  audit: GovernanceAuditEvent;
}

export type GovernanceHook = (context: GovernanceHookContext) => void | Promise<void>;

export interface ExecutionGovernanceOptions {
  policyEngine?: PdlGovernanceEngine;
  capabilityGrants?: Partial<Record<GovernanceCapability, boolean>>;
  approvalRequiredCapabilities?: GovernanceCapability[];
  preHook?: GovernanceHook;
  postHook?: GovernanceHook;
  now?: () => Date;
}

export interface AuthorizationResult {
  authorization: GovernanceAuthorization;
  decision: GovernanceDecision | null;
  audit: GovernanceAuditEvent;
}

const DEFAULT_APPROVAL_REQUIRED: GovernanceCapability[] = [
  'CREDENTIAL_ACCESS',
  'SUBAGENT_DELEGATION',
];

const ALL_CAPABILITIES: GovernanceCapability[] = [
  'WORKSPACE_READ',
  'WORKSPACE_WRITE',
  'COMMAND_EXECUTION',
  'GIT_WRITE',
  'REMOTE_PERSISTENCE',
  'CREDENTIAL_ACCESS',
  'SUBAGENT_DELEGATION',
];

export class PdlExecutionGovernance {
  private readonly policy: PdlGovernanceEngine;
  private readonly grants: Partial<Record<GovernanceCapability, boolean>>;
  private readonly approvalRequired: Set<GovernanceCapability>;
  private readonly preHook?: GovernanceHook;
  private readonly postHook?: GovernanceHook;
  private readonly now: () => Date;

  constructor(options: ExecutionGovernanceOptions = {}) {
    this.policy = options.policyEngine ?? new PdlGovernanceEngine();
    this.grants = options.capabilityGrants ?? {};
    this.approvalRequired = new Set(options.approvalRequiredCapabilities ?? DEFAULT_APPROVAL_REQUIRED);
    this.preHook = options.preHook;
    this.postHook = options.postHook;
    this.now = options.now ?? (() => new Date());
  }

  /**
   * Pre-execution authorization. Every unknown capability, malformed contract,
   * denied policy decision, or missing approval fails closed.
   */
  public async authorize(request: ExecutionGovernanceRequest): Promise<AuthorizationResult> {
    const baseAudit = {
      governanceVersion: PDL_EXECUTION_GOVERNANCE_VERSION,
      event: 'PRE_AUTHORIZATION' as const,
      timestamp: this.now().toISOString(),
      taskId: request?.task?.id ?? 'unknown',
      gate: request?.gate,
      action: request?.action,
      authorization: 'DENY' as GovernanceAuthorization,
      decisionCode: 'GOVERNANCE_REQUEST_INVALID',
      capabilityCount: request?.requestedCapabilities?.length ?? 0,
    };

    if (!this.isValidRequest(request)) {
      const audit = baseAudit;
      await this.runPreHook(request, 'DENY', audit);
      return { authorization: 'DENY', decision: null, audit };
    }

    if (request.governanceVersion !== PDL_EXECUTION_GOVERNANCE_VERSION) {
      const audit = { ...baseAudit, decisionCode: 'GOVERNANCE_VERSION_MISMATCH' };
      await this.runPreHook(request, 'DENY', audit);
      return { authorization: 'DENY', decision: null, audit };
    }

    const unknown = request.requestedCapabilities.filter((cap) => !ALL_CAPABILITIES.includes(cap));
    if (unknown.length > 0) {
      const audit = { ...baseAudit, decisionCode: 'UNKNOWN_CAPABILITY' };
      await this.runPreHook(request, 'DENY', audit);
      return { authorization: 'DENY', decision: null, audit };
    }

    for (const capability of request.requestedCapabilities) {
      if (!request.grantedCapabilities.includes(capability) || this.grants[capability] !== true) {
        const audit = { ...baseAudit, decisionCode: 'CAPABILITY_NOT_GRANTED' };
        await this.runPreHook(request, 'DENY', audit);
        return { authorization: 'DENY', decision: null, audit };
      }
    }

    const delegationResult = this.validateDelegation(request);
    if (!delegationResult.allowed) {
      const audit = { ...baseAudit, decisionCode: delegationResult.code };
      await this.runPreHook(request, 'DENY', audit);
      return { authorization: 'DENY', decision: null, audit };
    }

    const approvalResult = this.validateApproval(request);
    if (!approvalResult.allowed) {
      const audit = { ...baseAudit, decisionCode: approvalResult.code };
      await this.runPreHook(request, 'APPROVAL_REQUIRED', audit);
      return { authorization: 'APPROVAL_REQUIRED', decision: null, audit };
    }

    const decision = await this.policy.evaluateExecution(request.task);
    if (!decision.allowed) {
      const audit = {
        ...baseAudit,
        decisionCode: decision.reasonCode,
      };
      await this.runPreHook(request, 'DENY', audit);
      return { authorization: 'DENY', decision, audit };
    }

    const audit = {
      ...baseAudit,
      authorization: 'ALLOW' as const,
      decisionCode: decision.reasonCode,
      approvalId: request.approval?.approvalId,
    };
    await this.runPreHook(request, 'ALLOW', audit);
    return { authorization: 'ALLOW', decision, audit };
  }

  /**
   * Post-execution audit hook. The event contains evidence metadata only.
   * Raw credentials, prompts, tokens, and command output are never accepted
   * as governance evidence through this contract.
   */
  public async recordPostExecution(
    request: ExecutionGovernanceRequest,
    executionStatus: GovernanceAuditEvent['executionStatus'],
    evidence: Record<string, string | number | boolean> = {}
  ): Promise<GovernanceAuditEvent> {
    const audit: GovernanceAuditEvent = {
      governanceVersion: PDL_EXECUTION_GOVERNANCE_VERSION,
      event: 'POST_EXECUTION',
      timestamp: this.now().toISOString(),
      taskId: request.task.id,
      gate: request.gate,
      action: request.action,
      authorization: 'ALLOW',
      decisionCode: 'EXECUTION_OBSERVED',
      capabilityCount: request.requestedCapabilities.length,
      approvalId: request.approval?.approvalId,
      executionStatus,
      evidence: { ...evidence },
    };
    await this.postHook?.({ request, decision: 'ALLOW', audit });
    return audit;
  }

  private async runPreHook(
    request: ExecutionGovernanceRequest,
    decision: GovernanceAuthorization,
    audit: GovernanceAuditEvent
  ): Promise<void> {
    if (!this.preHook) return;
    try {
      await this.preHook({ request, decision, audit });
    } catch {
      // Hook failures are governance failures. Do not authorize execution.
      throw new Error('GOVERNANCE_PRE_HOOK_FAILED');
    }
  }

  private isValidRequest(request: ExecutionGovernanceRequest): boolean {
    return Boolean(
      request &&
      request.task &&
      typeof request.task.id === 'string' &&
      request.task.id.length > 0 &&
      Array.isArray(request.requestedCapabilities) &&
      Array.isArray(request.grantedCapabilities)
    );
  }

  private validateApproval(
    request: ExecutionGovernanceRequest
  ): { allowed: boolean; code: string } {
    const requiresApproval = request.requestedCapabilities.some((cap) =>
      this.approvalRequired.has(cap)
    );
    if (!requiresApproval) return { allowed: true, code: 'APPROVAL_NOT_REQUIRED' };

    const approval = request.approval;
    if (!approval) return { allowed: false, code: 'APPROVAL_REQUIRED' };

    const now = this.now().getTime();
    const expires = Date.parse(approval.expiresAt);
    if (
      !approval.approvalId ||
      !approval.approvedBy ||
      !Number.isFinite(expires) ||
      expires <= now
    ) {
      return { allowed: false, code: 'APPROVAL_INVALID_OR_EXPIRED' };
    }

    const requested = new Set(request.requestedCapabilities);
    const approved = new Set(approval.scope);
    for (const capability of requested) {
      if (this.approvalRequired.has(capability) && !approved.has(capability)) {
        return { allowed: false, code: 'APPROVAL_SCOPE_MISMATCH' };
      }
    }
    return { allowed: true, code: 'APPROVAL_VALID' };
  }

  private validateDelegation(
    request: ExecutionGovernanceRequest
  ): { allowed: boolean; code: string } {
    const delegation = request.delegation;
    if (!delegation?.enabled) return { allowed: true, code: 'DELEGATION_DISABLED' };

    if (!request.requestedCapabilities.includes('SUBAGENT_DELEGATION')) {
      return { allowed: false, code: 'DELEGATION_CAPABILITY_MISSING' };
    }

    if (
      !Number.isInteger(delegation.maxDepth) ||
      !Number.isInteger(delegation.maxChildren) ||
      delegation.maxDepth < 1 ||
      delegation.maxDepth > 3 ||
      delegation.maxChildren < 1 ||
      delegation.maxChildren > 8
    ) {
      return { allowed: false, code: 'DELEGATION_BOUNDS_INVALID' };
    }

    if (
      (delegation.requestedDepth ?? 0) > delegation.maxDepth ||
      (delegation.requestedChildren ?? 0) > delegation.maxChildren
    ) {
      return { allowed: false, code: 'DELEGATION_BOUNDS_EXCEEDED' };
    }

    return { allowed: true, code: 'DELEGATION_BOUNDED' };
  }
}

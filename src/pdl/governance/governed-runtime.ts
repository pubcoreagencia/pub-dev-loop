import type { ExecutionSpec } from '../../task/execution-spec.js';
import type { Task } from '../../domain.js';
import type { AgentRuntime, RuntimeContext, RuntimeResult } from '../runtime/runtime-contract.js';
import {
  PdlExecutionGovernance,
  type ExecutionGovernanceRequest,
} from './execution-governance.js';

export interface GovernedRuntimeResult {
  runtime: RuntimeResult;
  authorization: Awaited<ReturnType<PdlExecutionGovernance['authorize']>>;
  postExecutionAudit?: Awaited<ReturnType<PdlExecutionGovernance['recordPostExecution']>>;
}

/**
 * Governance wrapper for the existing AgentRuntime boundary.
 *
 * It authorizes before execution, delegates physical execution unchanged to
 * the supplied runtime, and records structured post-execution evidence.
 * It is orchestration, not a second executor.
 */
export class GovernedRuntime {
  constructor(
    private readonly governance: PdlExecutionGovernance,
    private readonly runtime: AgentRuntime,
  ) {}

  async execute(
    request: ExecutionGovernanceRequest,
    context: RuntimeContext,
  ): Promise<GovernedRuntimeResult> {
    const authorization = await this.governance.authorize(request);

    if (authorization.authorization !== 'ALLOW') {
      const runtime: RuntimeResult = {
        status: authorization.authorization === 'APPROVAL_REQUIRED' ? 'BLOCKED' : 'BLOCKED',
        context,
        evidence: [{
          phase: 'BLOCKED',
          timestamp: authorization.audit.timestamp,
          event: 'governance.execution.blocked',
          summary: authorization.audit.decisionCode,
          data: {
            authorization: authorization.authorization,
            decisionCode: authorization.audit.decisionCode,
          },
        }],
        errorCode: authorization.audit.decisionCode,
        errorMessage: 'Execution blocked by governance',
      };
      return { runtime, authorization };
    }

    const runtime = await this.runtime.execute(context);
    const executionStatus =
      runtime.status === 'COMPLETED' ? 'COMPLETED' :
      runtime.status === 'CANCELLED' ? 'CANCELLED' :
      runtime.status === 'BLOCKED' ? 'BLOCKED' : 'FAILED';

    const postExecutionAudit = await this.governance.recordPostExecution(
      request,
      executionStatus,
      {
        runtimeStatus: runtime.status,
        evidenceCount: runtime.evidence.length,
      },
    );

    return { runtime, authorization, postExecutionAudit };
  }
}

export function buildGovernanceRequest(
  task: Task,
  governanceVersion: ExecutionGovernanceRequest['governanceVersion'],
  capabilities: ExecutionGovernanceRequest['requestedCapabilities'],
  gate: ExecutionGovernanceRequest['gate'] = 'EXECUTION',
): ExecutionGovernanceRequest {
  return {
    governanceVersion,
    task,
    gate,
    action: 'TOOL_EXECUTION',
    requestedCapabilities: capabilities,
    grantedCapabilities: capabilities,
  };
}

export type GovernedExecutionSpec = ExecutionSpec;

/**
 * DefaultExecutionEngine — Concrete implementation of ExecutionEngine contract (Phase 3A.2).
 *
 * Responsibilities:
 * - Accepts validated Task and ExecutionSpec pair.
 * - Resolves execution workspace from repositoryTarget or task context without mutation.
 * - Dispatches task to the neutral AgentProvider abstraction.
 * - Maps provider execution outcome to ExecutionOutcome.
 * - Preserves SpecIdentity and RepositoryTarget integrity.
 * - Decouples execution outcome from finalization (finalization remains undefined in 3A.2).
 * - Isolates exceptions and failures into explicit FAILED ExecutionOutcome.
 *
 * Explicitly Excluded:
 * - Does NOT validate or generate ExecutionSpec (A.2 responsibility).
 * - Does NOT perform git commit or push (TaskFinalizer responsibility).
 * - Does NOT manage database claims, leases, or heartbeats (Worker responsibility).
 * - Does NOT couple with Pub Prototype (PP) or domain heuristics.
 */

import type { Task } from '../domain.js';
import type { ExecutionSpec } from '../task/execution-spec.js';
import { isExplicitUnknown } from '../task/execution-spec.js';
import type { AgentProvider, ProviderTaskInput, ProviderTaskResult } from '../providers/types.js';
import type {
  ExecutionEngine,
  ExecutionResult,
  ExecutionOutcome,
  SpecIdentity,
} from './execution-engine.js';

export class DefaultExecutionEngine implements ExecutionEngine {
  constructor(private readonly provider: AgentProvider) {}

  async execute(task: Task, executionSpec: ExecutionSpec): Promise<ExecutionResult> {
    const startTime = Date.now();

    // 1. Preserve SpecIdentity deterministically from input spec and task
    const specIdentity: SpecIdentity = {
      specVersion: executionSpec.specVersion,
      taskId: task.id,
      lineage: executionSpec.lineage,
    };

    let outcome: ExecutionOutcome;
    try {
      // 2. Resolve physical workspace: task.workspacePath takes absolute precedence
      const workspace = this.resolveWorkspace(task, executionSpec);

      // 3. Build neutral ProviderTaskInput with defensive copy of system instructions
      const providerInput = this.buildProviderInput(task, executionSpec);

      // 4. Dispatch execution to provider with failure containment
      const result = await this.provider.execute(providerInput, workspace);
      const durationMs = result.durationMs > 0 ? result.durationMs : Math.max(1, Date.now() - startTime);
      outcome = this.mapProviderResultToOutcome(result, workspace, durationMs);
    } catch (error) {
      const durationMs = Math.max(1, Date.now() - startTime);
      const fallbackWorkspace = task.workspacePath || '';
      outcome = this.mapErrorToOutcome(error, fallbackWorkspace, durationMs);
    }

    // 5. Construct ExecutionResult (finalization remains undefined in 3A.2)
    return {
      execution: outcome,
      finalization: undefined,
      specIdentity,
    };
  }

  private resolveWorkspace(task: Task, spec: ExecutionSpec): string {
    // 1. Physical workspace prepared by worker runtime takes absolute precedence
    if (task.workspacePath && task.workspacePath.trim().length > 0) {
      return task.workspacePath.trim();
    }

    // 2. Fallback to authorized workspace in repositoryTarget if present
    if (
      spec.repositoryTarget &&
      !isExplicitUnknown(spec.repositoryTarget) &&
      spec.repositoryTarget.workspace &&
      spec.repositoryTarget.workspace.trim().length > 0
    ) {
      return spec.repositoryTarget.workspace.trim();
    }

    // 3. No silent fallback to process.cwd() — explicit deterministic error
    throw new Error('ExecutionEngine: No execution workspace defined on task or repositoryTarget');
  }

  public buildProviderInput(task: Task, spec: ExecutionSpec): ProviderTaskInput {
    const target = spec.repositoryTarget && !isExplicitUnknown(spec.repositoryTarget)
      ? spec.repositoryTarget
      : undefined;

    let enrichedPrompt = task.prompt ?? '';
    const sections: string[] = [];

    const constraints = spec.constraints && !isExplicitUnknown(spec.constraints) && Array.isArray(spec.constraints)
      ? spec.constraints
      : [];
    if (constraints.length > 0) {
      sections.push('### Constraints\n' + constraints.map(c => `- ${c}`).join('\n'));
    }

    const acceptanceCriteria = spec.acceptanceCriteria && !isExplicitUnknown(spec.acceptanceCriteria) && Array.isArray(spec.acceptanceCriteria)
      ? spec.acceptanceCriteria
      : [];
    if (acceptanceCriteria.length > 0) {
      sections.push('### Acceptance Criteria\n' + acceptanceCriteria.map(ac => `- ${ac}`).join('\n'));
    }

    const validationPlan = spec.validationPlan && !isExplicitUnknown(spec.validationPlan) && Array.isArray(spec.validationPlan)
      ? spec.validationPlan
      : [];
    if (validationPlan.length > 0) {
      sections.push('### Validation Plan\n' + validationPlan.map(vp => `- ${vp}`).join('\n'));
    }

    if (sections.length > 0) {
      enrichedPrompt = enrichedPrompt.length > 0
        ? `${enrichedPrompt}\n\n${sections.join('\n\n')}`
        : sections.join('\n\n');
    }

    return {
      id: task.id,
      objective: spec.objective || task.objective,
      prompt: enrichedPrompt,
      project: task.project,
      repository: target?.remote || task.repository,
      branch: target?.branch || task.branch,
      systemInstructions: (
        spec.executionInstructions && !isExplicitUnknown(spec.executionInstructions) && Array.isArray(spec.executionInstructions)
          ? [...spec.executionInstructions]
          : undefined
      ),
      routingProfile: (task as any).routingProfile,
    };
  }

  private mapProviderResultToOutcome(
    result: ProviderTaskResult,
    workspace: string,
    durationMs: number
  ): ExecutionOutcome {
    const isSuccess = result.status === 'COMPLETED';

    return {
      status: isSuccess ? 'COMPLETED' : 'FAILED',
      provider: result.provider || this.provider.kind || null,
      model: result.model ?? this.provider.model ?? null,
      workspace,
      changedFiles: Array.isArray(result.changedFiles) ? [...result.changedFiles] : [],
      durationMs,
      errorCode: isSuccess ? null : (result.errorCode || result.status || 'EXECUTION_FAILED'),
      errorMessage: isSuccess ? null : (result.errorMessage || result.stderr || `Provider finished with status: ${result.status}`),
    };
  }

  private mapErrorToOutcome(
    error: unknown,
    workspace: string,
    durationMs: number
  ): ExecutionOutcome {
    const message = error instanceof Error ? error.message : String(error);
    const code = (error as any)?.code || (error as any)?.errorCode || 'EXECUTION_ERROR';

    return {
      status: 'FAILED',
      provider: this.provider.kind || null,
      model: this.provider.model || null,
      workspace,
      changedFiles: [],
      durationMs,
      errorCode: typeof code === 'string' ? code : 'EXECUTION_ERROR',
      errorMessage: message || 'Unknown execution error occurred',
    };
  }
}

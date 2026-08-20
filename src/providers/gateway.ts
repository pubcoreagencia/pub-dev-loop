import type { Task } from '../domain.js';
import type { AgentProvider, ProviderKind, ProviderTaskResult } from './types.js';

export class DualGatewayProvider implements AgentProvider {
  readonly kind: ProviderKind;
  readonly model: string | null;

  constructor(
    readonly primary: AgentProvider,
    readonly fallback: AgentProvider,
  ) {
    this.kind = primary.kind;
    this.model = primary.model;
  }

  private hasMutableEffects(result: ProviderTaskResult): boolean {
    return Boolean(
      (result.changedFiles?.length ?? 0) > 0 ||
      (result.toolCalls ?? 0) > 0 ||
      (result.toolRounds ?? 0) > 0,
    );
  }

  private isRetryableGatewayFailure(result: ProviderTaskResult): boolean {
    if (result.status === 'COMPLETED' || result.status === 'TOOL_LOOP_LIMIT') return false;
    if (result.status === 'ROUTER_HTTP_ERROR' || result.status === 'ROUTER_TIMEOUT' || result.status === 'ROUTER_CONNECTION_ERROR' || result.status === 'TIMED_OUT' || result.status === 'FAILED') return true;
    if (result.httpStatus && (result.httpStatus === 429 || result.httpStatus === 402 || result.httpStatus >= 500)) return true;
    return ['EMPTY_RESPONSE', 'INVALID_RESPONSE', 'ALL_PROVIDERS_FAILED', 'GATEWAY_EXHAUSTED'].includes(result.errorCode ?? '');
  }

  async execute(task: Task, workspace: string): Promise<ProviderTaskResult> {
    const primaryResult = await this.primary.execute(task, workspace);
    if (primaryResult.status === 'COMPLETED') return primaryResult;

    if (this.hasMutableEffects(primaryResult)) {
      return {
        ...primaryResult,
        status: 'FAILED',
        errorCode: 'PARTIAL_EXECUTION_REQUIRES_REVIEW',
        errorMessage: `Partial execution detected on primary gateway (${this.primary.kind}/${primaryResult.model ?? 'unknown'}). Automatic gateway fallback blocked to prevent workspace corruption.`,
        stderr: `${primaryResult.stderr}\n[DualGateway] Blocked fallback: PARTIAL_EXECUTION_REQUIRES_REVIEW`,
      };
    }

    if (!this.isRetryableGatewayFailure(primaryResult)) return primaryResult;

    try {
      return await this.fallback.execute(task, workspace);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Fallback gateway failed';
      return {
        status: 'FAILED',
        provider: this.fallback.kind,
        model: this.fallback.model,
        exitCode: null,
        durationMs: primaryResult.durationMs,
        stdout: primaryResult.stdout,
        stderr: `${primaryResult.stderr}\nFallback gateway error (${this.fallback.kind}): ${message}`.trim(),
        changedFiles: primaryResult.changedFiles ?? [],
        commit: null,
        errorCode: 'ALL_PROVIDERS_FAILED',
        errorMessage: `Primary gateway (${this.primary.kind}) failed; fallback (${this.fallback.kind}) also failed: ${message}`,
        toolCalls: primaryResult.toolCalls ?? 0,
        toolRounds: primaryResult.toolRounds ?? 0,
      };
    }
  }

  async health() {
    const primaryHealth = await this.primary.health();
    if (primaryHealth.available) return { available: true, details: `Primary (${this.primary.kind}): ${primaryHealth.details}` };
    const fallbackHealth = await this.fallback.health();
    return { available: fallbackHealth.available, details: `Primary (${this.primary.kind}) down: ${primaryHealth.details}; Fallback (${this.fallback.kind}): ${fallbackHealth.details}` };
  }

  capabilities() {
    return Array.from(new Set([...this.primary.capabilities(), ...this.fallback.capabilities()]));
  }

  metadata() {
    return {
      primaryProvider: this.primary.kind,
      primaryModel: this.primary.model,
      fallbackProvider: this.fallback.kind,
      fallbackModel: this.fallback.model,
    };
  }
}

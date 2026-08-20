import type { Task } from '../domain.js';
import type { AgentProvider, ProviderKind, ProviderTaskResult } from './types.js';

export interface DualGatewayConfig {
  primary: AgentProvider;
  fallback: AgentProvider;
}

export class DualGatewayProvider implements AgentProvider {
  readonly kind: ProviderKind;
  readonly model: string | null;
  readonly primary: AgentProvider;
  readonly fallback: AgentProvider;

  constructor(primary: AgentProvider, fallback: AgentProvider) {
    this.primary = primary;
    this.fallback = fallback;
    this.kind = primary.kind;
    this.model = primary.model;
  }

  private isRetryableGatewayFailure(result: ProviderTaskResult): boolean {
    if (result.status === 'COMPLETED') return false;
    if (result.status === 'TOOL_LOOP_LIMIT') return false;

    // Retryable statuses:
    if (
      result.status === 'ROUTER_HTTP_ERROR' ||
      result.status === 'ROUTER_TIMEOUT' ||
      result.status === 'ROUTER_CONNECTION_ERROR' ||
      result.status === 'TIMED_OUT' ||
      result.status === 'FAILED'
    ) {
      return true;
    }

    if (result.httpStatus) {
      if (result.httpStatus === 429 || result.httpStatus === 402 || result.httpStatus >= 500) {
        return true;
      }
    }

    if (result.errorCode === 'EMPTY_RESPONSE' || result.errorCode === 'INVALID_RESPONSE' || result.errorCode === 'ALL_PROVIDERS_FAILED') {
      return true;
    }

    return true;
  }

  async execute(task: Task, workspace: string): Promise<ProviderTaskResult> {
    const primaryResult = await this.primary.execute(task, workspace);

    if (primaryResult.status === 'COMPLETED' || !this.isRetryableGatewayFailure(primaryResult)) {
      return primaryResult;
    }

    // Attempt fallback gateway
    try {
      const fallbackResult = await this.fallback.execute(task, workspace);
      return fallbackResult;
    } catch (fallbackError) {
      const message = fallbackError instanceof Error ? fallbackError.message : 'Fallback gateway failed';
      return {
        ...primaryResult,
        stderr: `${primaryResult.stderr}\nFallback gateway error: ${message}`,
      };
    }
  }

  async health(): Promise<{ available: boolean; details: string }> {
    const primaryHealth = await this.primary.health();
    if (primaryHealth.available) {
      return { available: true, details: `Primary (${this.primary.kind}): ${primaryHealth.details}` };
    }
    const fallbackHealth = await this.fallback.health();
    return {
      available: fallbackHealth.available,
      details: `Primary (${this.primary.kind}) down: ${primaryHealth.details}; Fallback (${this.fallback.kind}): ${fallbackHealth.details}`,
    };
  }

  capabilities(): string[] {
    return Array.from(new Set([...this.primary.capabilities(), ...this.fallback.capabilities()]));
  }

  metadata(): Record<string, string | null> {
    return {
      primaryProvider: this.primary.kind,
      primaryModel: this.primary.model,
      fallbackProvider: this.fallback.kind,
      fallbackModel: this.fallback.model,
    };
  }
}

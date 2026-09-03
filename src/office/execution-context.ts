import type { AgentDefinition } from './types.js';
import { defaultAgentRegistry, AgentRegistry } from './registry.js';

export interface AgentExecutionContext {
  readonly agentId: string;
  readonly agent: AgentDefinition;
  readonly resolvedAt: Date;
}

/**
 * Resolve an AgentExecutionContext from an optional agentId using the AgentRegistry.
 *
 * Rules:
 * - Returns null if agentId is null, undefined, or empty string (legacy task compatible).
 * - Returns null if agentId is invalid, not found, or 'ceo'.
 * - If strict mode is enabled, throws an Error on invalid/unknown agentId.
 * - Returns a resolved AgentExecutionContext when agentId matches a registered agent.
 */
export function createAgentExecutionContext(
  agentId?: string | null,
  registry: AgentRegistry = defaultAgentRegistry,
  options?: { strict?: boolean }
): AgentExecutionContext | null {
  if (agentId === undefined || agentId === null || typeof agentId !== 'string' || !agentId.trim()) {
    return null;
  }

  const normalizedId = agentId.trim();

  if (normalizedId.toLowerCase() === 'ceo') {
    if (options?.strict) {
      throw new Error("Invalid agentId: 'ceo' represents the human operator, not an executable agent.");
    }
    return null;
  }

  const agent = registry.getAgent(normalizedId);
  if (!agent) {
    if (options?.strict) {
      throw new Error(`Unknown agentId: '${agentId}'. Agent is not registered in The Office.`);
    }
    return null;
  }

  return {
    agentId: agent.id,
    agent,
    resolvedAt: new Date(),
  };
}

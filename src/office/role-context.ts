import type { AgentDepartment, AgentRole } from './types.js';
import { defaultAgentRegistry, AgentRegistry } from './registry.js';
import { createAgentExecutionContext, type AgentExecutionContext } from './execution-context.js';

export interface AgentRoleContext {
  readonly agentId: string;
  readonly name: string;
  readonly title: string;
  readonly department: AgentDepartment;
  readonly role: AgentRole;
  readonly specialty: string;
  readonly personalitySummary: string;
  readonly responsibilities: readonly string[];
  readonly capabilities: readonly string[];
}

/**
 * Convert an existing AgentExecutionContext into an immutable AgentRoleContext.
 */
export function toRoleContext(ctx: AgentExecutionContext): AgentRoleContext {
  const { agent } = ctx;
  return {
    agentId: agent.id,
    name: agent.name,
    title: agent.title,
    department: agent.department,
    role: agent.role,
    specialty: agent.specialty,
    personalitySummary: agent.personalitySummary,
    responsibilities: Object.freeze([...agent.responsibilities]),
    capabilities: Object.freeze([...agent.capabilities]),
  };
}

/**
 * Resolve an immutable AgentRoleContext for an agentId using the AgentRegistry.
 *
 * Rules:
 * - Returns null if agentId is null, undefined, or empty string.
 * - Returns null if agentId is invalid, not found, or 'ceo'.
 * - If strict mode is enabled, throws an Error on invalid/unknown agentId or 'ceo'.
 * - Clones responsibilities and capabilities arrays to guarantee immutability of the Registry.
 */
export function createAgentRoleContext(
  agentId?: string | null,
  registry: AgentRegistry = defaultAgentRegistry,
  options?: { strict?: boolean }
): AgentRoleContext | null {
  const execCtx = createAgentExecutionContext(agentId, registry, options);
  if (!execCtx) {
    return null;
  }
  return toRoleContext(execCtx);
}

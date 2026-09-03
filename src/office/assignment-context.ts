import type { Task } from '../domain.js';
import { defaultAgentRegistry, AgentRegistry } from './registry.js';
import { createAgentExecutionContext } from './execution-context.js';
import { toRoleContext, type AgentRoleContext } from './role-context.js';
import { evaluateAgentTaskCompatibility, type AgentTaskCompatibility } from './task-compatibility.js';

export interface AgentAssignmentDecisionContext {
  readonly taskId: string;
  readonly project: string;
  readonly agentId: string;
  readonly roleContext: AgentRoleContext;
  readonly compatibility: AgentTaskCompatibility;
}

/**
 * Creates an immutable AgentAssignmentDecisionContext for a given Task and agentId.
 *
 * Pipeline:
 * Task -> AgentRegistry -> AgentExecutionContext -> AgentRoleContext -> AgentTaskCompatibility -> AgentAssignmentDecisionContext
 *
 * Pure function:
 * - Deterministic, in-memory evaluation only.
 * - Does NOT make assignment decisions automatically.
 * - Does NOT modify Task, AgentRegistry, or worker identity.
 * - Zero LLM, provider, database, or network calls.
 *
 * Returns:
 * - null if agentId is missing, empty, invalid, unknown, or 'ceo' (or throws in strict mode).
 * - AgentAssignmentDecisionContext when agentId resolves to a valid registered agent.
 */
export function createAgentAssignmentDecisionContext(
  task: Task,
  agentId: string,
  registry: AgentRegistry = defaultAgentRegistry,
  options?: { strict?: boolean }
): AgentAssignmentDecisionContext | null {
  if (!agentId || typeof agentId !== 'string' || !agentId.trim()) {
    return null;
  }

  const execContext = createAgentExecutionContext(agentId, registry, options);
  if (!execContext) {
    return null;
  }

  const roleContext = toRoleContext(execContext);
  const compatibility = evaluateAgentTaskCompatibility(task, roleContext, registry);

  return {
    taskId: task.id,
    project: task.project,
    agentId: roleContext.agentId,
    roleContext,
    compatibility,
  };
}

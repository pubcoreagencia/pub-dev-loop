import type { Task } from '../domain.js';
import { defaultAgentRegistry, AgentRegistry } from './registry.js';
import {
  createAgentAssignmentDecisionContext,
  type AgentAssignmentDecisionContext,
} from './assignment-context.js';

export type AssignmentSource = 'EXPLICIT' | 'ORGANIZATIONAL_SUGGESTION' | 'UNRESOLVED';

export interface AgentAssignmentDecision {
  readonly taskId: string;
  readonly agentId: string | null;
  readonly compatible: boolean;
  readonly score: number;
  readonly reasons: readonly string[];
  readonly source: AssignmentSource;
  readonly context: AgentAssignmentDecisionContext | null;
}

/**
 * Resolves an organizational assignment decision for a Task:
 *
 * Rules:
 * - Case A: Task has explicit 	ask.agentId:
 *   Respects the explicit identity. Never silently swaps or overrides the agent.
 *   Returns source: 'EXPLICIT' with exact compatibility evaluation.
 * - Case B: Task has no 	ask.agentId (null/undefined):
 *   Performs deterministic capability matching across all agents in the AgentRegistry.
 *   If a single agent clearly scores above confidence threshold (score >= 0.60) with a margin over second place,
 *   returns source: 'ORGANIZATIONAL_SUGGESTION'.
 *   If ambiguous, tied, or below threshold, returns gentId: null, source: 'UNRESOLVED'.
 * - Case C: gentId === 'ceo':
 *   CEO is the human operator and cannot be assigned as an executable agent. Returns source: 'UNRESOLVED'.
 * - Case D: Invalid / unregistered agentId:
 *   Returns gentId: null, compatible: false, source: 'UNRESOLVED'.
 *
 * Pure function: zero I/O, zero network, zero LLM calls, zero mutations.
 */
export function resolveAgentAssignment(
  task: Task,
  registry: AgentRegistry = defaultAgentRegistry
): AgentAssignmentDecision {
  if (task.agentId && typeof task.agentId === 'string' && task.agentId.trim()) {
    const normalizedId = task.agentId.trim();

    if (normalizedId.toLowerCase() === 'ceo') {
      return {
        taskId: task.id,
        agentId: null,
        compatible: false,
        score: 0.0,
        reasons: Object.freeze(['CEO represents the human operator and cannot be assigned as an executable agent']),
        source: 'UNRESOLVED',
        context: null,
      };
    }

    const decisionContext = createAgentAssignmentDecisionContext(task, normalizedId, registry);
    if (!decisionContext) {
      return {
        taskId: task.id,
        agentId: null,
        compatible: false,
        score: 0.0,
        reasons: Object.freeze([`Agent '${task.agentId}' could not be resolved from registry`]),
        source: 'UNRESOLVED',
        context: null,
      };
    }

    return {
      taskId: task.id,
      agentId: decisionContext.agentId,
      compatible: decisionContext.compatibility.compatible,
      score: decisionContext.compatibility.score,
      reasons: decisionContext.compatibility.reasons,
      source: 'EXPLICIT',
      context: decisionContext,
    };
  }

  // Automatic deterministic evaluation across registry for unassigned tasks
  const candidates = registry.listAgents();
  if (candidates.length === 0) {
    return {
      taskId: task.id,
      agentId: null,
      compatible: false,
      score: 0.0,
      reasons: Object.freeze(['No agents registered in The Office']),
      source: 'UNRESOLVED',
      context: null,
    };
  }

  const evaluations = candidates.map(agent => {
    const ctx = createAgentAssignmentDecisionContext(task, agent.id, registry);
    return {
      agentId: agent.id,
      score: ctx?.compatibility.score ?? 0.0,
      compatible: ctx?.compatibility.compatible ?? false,
      reasons: ctx?.compatibility.reasons ?? [],
      ctx,
    };
  });

  evaluations.sort((a, b) => b.score - a.score);
  const best = evaluations[0];
  const secondBest = evaluations[1];

  const CONFIDENCE_THRESHOLD = 0.60;
  const MARGIN_THRESHOLD = 0.15;

  const hasStrongMatch = best.score >= CONFIDENCE_THRESHOLD;
  const hasClearWinner = !secondBest || (best.score - secondBest.score >= MARGIN_THRESHOLD);

  if (hasStrongMatch && hasClearWinner && best.ctx) {
    return {
      taskId: task.id,
      agentId: best.agentId,
      compatible: best.compatible,
      score: best.score,
      reasons: Object.freeze([
        `Deterministically suggested ${best.agentId} based on organizational capabilities`,
        ...best.reasons,
      ]),
      source: 'ORGANIZATIONAL_SUGGESTION',
      context: best.ctx,
    };
  }

  return {
    taskId: task.id,
    agentId: null,
    compatible: false,
    score: best.score,
    reasons: Object.freeze(
      best.score === 0
        ? ['No matching capabilities found among registered agents']
        : [`Ambiguous assignment: top candidates (${best.agentId}: ${best.score}, ${secondBest?.agentId}: ${secondBest?.score}) have insufficient separation`]
    ),
    source: 'UNRESOLVED',
    context: null,
  };
}

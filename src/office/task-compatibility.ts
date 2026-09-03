import type { Task } from '../domain.js';
import type { AgentDefinition } from './types.js';
import { defaultAgentRegistry, AgentRegistry } from './registry.js';
import { createAgentRoleContext, type AgentRoleContext } from './role-context.js';

export interface AgentTaskCompatibility {
  readonly agentId: string;
  readonly compatible: boolean;
  readonly score: number;
  readonly reasons: readonly string[];
}

const ROLE_SIGNAL_MAP: Record<string, { primary: string[]; related: string[]; baseReason: string }> = {
  DEVELOPER: {
    primary: ['implement', 'build', 'create', 'write', 'feature', 'fix', 'bug', 'code', 'refactor', 'develop', 'component', 'function', 'endpoint'],
    related: ['typescript', 'javascript', 'api', 'backend', 'frontend', 'ui', 'add', 'update', 'modify'],
    baseReason: 'Task aligns with software implementation and code development',
  },
  ARCHITECT: {
    primary: ['architect', 'architecture', 'design', 'domain model', 'system design', 'technical design', 'contract', 'boundary', 'schema design', 'structure'],
    related: ['specification', 'boundary', 'tradeoff', 'modularity', 'decomposition', 'scalability', 'blueprint'],
    baseReason: 'Task aligns with system architecture and technical domain design',
  },
  REVIEWER: {
    primary: ['review', 'code review', 'security', 'audit', 'vulnerability', 'compliance', 'inspect', 'code quality', 'pr review'],
    related: ['linter', 'flaw', 'safety', 'guidelines', 'risk', 'remediation'],
    baseReason: 'Task aligns with code quality, security review, and design compliance',
  },
  QA_ENGINEER: {
    primary: ['test', 'tests', 'testing', 'unit test', 'e2e', 'integration test', 'qa', 'coverage', 'vitest', 'regression', 'validate behavior'],
    related: ['assert', 'mock', 'edge case', 'flaky', 'test suite', 'automation'],
    baseReason: 'Task aligns with quality assurance, testing, and test automation',
  },
  CHIEF_OF_STAFF: {
    primary: ['plan', 'planning', 'coordinate', 'coordination', 'delegate', 'delegation', 'roadmap', 'strategy', 'organize', 'orchestrate', 'break down'],
    related: ['prioritize', 'milestone', 'oversight', 'status report', 'operational health'],
    baseReason: 'Task aligns with strategic planning, operational orchestration, and task decomposition',
  },
};

/**
 * Evaluate compatibility between a Task and an Agent's role/capabilities.
 *
 * Deterministic matching scale:
 * - Score range: 0.0 (no evidence) to 1.0 (strong evidence)
 * - Threshold for compatible === true: score >= 0.50
 *
 * Pure function: zero I/O, zero network, zero LLM calls.
 */
export function evaluateAgentTaskCompatibility(
  task: Task,
  agentOrContext: AgentRoleContext | AgentDefinition | string,
  registry: AgentRegistry = defaultAgentRegistry
): AgentTaskCompatibility {
  let roleContext: AgentRoleContext | null = null;

  if (typeof agentOrContext === 'string') {
    roleContext = createAgentRoleContext(agentOrContext, registry);
  } else if ('personalitySummary' in agentOrContext && 'specialty' in agentOrContext) {
    if ('responsibilities' in agentOrContext) {
      const resolvedId = 'agentId' in agentOrContext ? agentOrContext.agentId : agentOrContext.id;
      roleContext = {
        agentId: resolvedId,
        name: agentOrContext.name,
        title: agentOrContext.title,
        department: agentOrContext.department,
        role: agentOrContext.role,
        specialty: agentOrContext.specialty,
        personalitySummary: agentOrContext.personalitySummary,
        responsibilities: agentOrContext.responsibilities,
        capabilities: agentOrContext.capabilities,
      };
    }
  }

  if (!roleContext || !roleContext.agentId) {
    return {
      agentId: typeof agentOrContext === 'string' ? agentOrContext : 'unknown',
      compatible: false,
      score: 0.0,
      reasons: ['Agent could not be resolved from registry'],
    };
  }

  const textToAnalyze = ((task.objective || '') + ' ' + (task.prompt || '')).toLowerCase();
  const reasons: string[] = [];
  let signalScore = 0.0;

  const roleSignals = ROLE_SIGNAL_MAP[roleContext.role];
  if (roleSignals) {
    let primaryMatches = 0;
    let relatedMatches = 0;

    for (const kw of roleSignals.primary) {
      if (textToAnalyze.includes(kw.toLowerCase())) {
        primaryMatches++;
      }
    }

    for (const kw of roleSignals.related) {
      if (textToAnalyze.includes(kw.toLowerCase())) {
        relatedMatches++;
      }
    }

    if (primaryMatches > 0) {
      signalScore += Math.min(0.60, primaryMatches * 0.25);
      reasons.push(roleSignals.baseReason + ' (matched signals: ' + primaryMatches + ')');
    }

    if (relatedMatches > 0) {
      signalScore += Math.min(0.20, relatedMatches * 0.10);
      reasons.push('Matched ' + relatedMatches + ' domain-related keyword(s) for ' + roleContext.role);
    }
  }

  // Capability matching from canonical AgentDefinition
  let capabilityMatches = 0;
  for (const cap of roleContext.capabilities) {
    const capTokens = cap.toLowerCase().split('_');
    const matchedToken = capTokens.some(t => t.length > 2 && textToAnalyze.includes(t));
    if (matchedToken) {
      capabilityMatches++;
    }
  }

  if (capabilityMatches > 0) {
    signalScore += Math.min(0.30, capabilityMatches * 0.15);
    reasons.push('Matched ' + capabilityMatches + ' declared agent capability signal(s)');
  }

  // Base fallback baseline: if no strong opposing mismatch, provide neutral baseline if developer or task is generic
  if (signalScore === 0.0) {
    if (textToAnalyze.trim().length === 0) {
      reasons.push('Task contains no objective or prompt text to evaluate');
    } else {
      reasons.push('No direct alignment signals found for role ' + roleContext.role);
    }
  }

  // Normalize score between 0.0 and 1.0, rounded to 2 decimal places
  const finalScore = Math.min(1.0, Math.max(0.0, Math.round(signalScore * 100) / 100));
  const isCompatible = finalScore >= 0.50;

  return {
    agentId: roleContext.agentId,
    compatible: isCompatible,
    score: finalScore,
    reasons: Object.freeze(reasons),
  };
}

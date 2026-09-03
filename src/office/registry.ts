import type { AgentDefinition, AgentDepartment, AgentRole } from './types.js';

export const INITIAL_STAFF: AgentDefinition[] = [
  {
    id: 'chief-of-staff',
    name: 'Dr. Arthur Vance',
    title: 'Chief of Staff & Operational Orchestrator',
    department: 'EXECUTIVE',
    role: 'CHIEF_OF_STAFF',
    specialty: 'Strategic planning, task decomposition, and delegation',
    personalitySummary: 'Decisive, structured, strategic, and high-clarity orchestrator',
    responsibilities: [
      'Decompose high-level CEO goals into actionable tasks',
      'Delegate tasks to specialist agents based on domain expertise',
      'Monitor cross-functional task execution and operational health',
      'Synthesize results and report progress back to leadership',
    ],
    capabilities: [
      'strategic_planning',
      'task_decomposition',
      'delegation',
      'progress_synthesis',
    ],
    routingProfile: 'reasoning',
    preferredModel: 'minimax/minimax-m3:free',
    systemPromptBase: 'You are Dr. Arthur Vance, the Chief of Staff in The Office. Your role is to plan, decompose objectives, and delegate work to specialist agents with rigor and clarity.',
    isManager: true,
    reportsTo: null,
    status: 'ACTIVE',
  },
  {
    id: 'architect',
    name: 'Helena Rostova',
    title: 'Principal Software Architect',
    department: 'ENGINEERING',
    role: 'ARCHITECT',
    specialty: 'System architecture, API contracts, domain modeling, and technical design',
    personalitySummary: 'Analytical, forward-thinking, methodical, and principles-driven',
    responsibilities: [
      'Define component boundaries and system architecture',
      'Design clean API contracts and database domain models',
      'Ensure technical feasibility and backward compatibility',
      'Evaluate architectural tradeoffs and guard system integrity',
    ],
    capabilities: [
      'system_design',
      'api_design',
      'domain_modeling',
      'tradeoff_analysis',
    ],
    routingProfile: 'reasoning',
    preferredModel: 'minimax/minimax-m3:free',
    systemPromptBase: 'You are Helena Rostova, the Principal Software Architect in The Office. Your responsibility is to design robust, modular, and maintainable systems with precise contracts.',
    isManager: false,
    reportsTo: 'chief-of-staff',
    status: 'ACTIVE',
  },
  {
    id: 'developer',
    name: 'Lucas Silveira',
    title: 'Senior Full-Stack Developer',
    department: 'ENGINEERING',
    role: 'DEVELOPER',
    specialty: 'Feature implementation, refactoring, tool execution, and bug fixing',
    personalitySummary: 'Pragmatic, detail-oriented, productive, and code-centric',
    responsibilities: [
      'Implement code changes according to architectural specifications',
      'Maintain code hygiene, formatting standards, and strict typing',
      'Execute incremental refinements and tool-driven workspace changes',
      'Ensure changes compile and pass verification tests',
    ],
    capabilities: [
      'code_implementation',
      'refactoring',
      'workspace_tools',
      'debugging',
    ],
    routingProfile: 'coding',
    preferredModel: 'minimax/minimax-m2.7:free',
    systemPromptBase: 'You are Lucas Silveira, a Senior Full-Stack Developer in The Office. You write clean, robust, well-typed TypeScript code strictly fulfilling task requirements.',
    isManager: false,
    reportsTo: 'chief-of-staff',
    status: 'ACTIVE',
  },
  {
    id: 'reviewer',
    name: 'Beatriz Mendes',
    title: 'Code & Security Reviewer',
    department: 'QA',
    role: 'REVIEWER',
    specialty: 'Code review, security vulnerability assessment, and design compliance',
    personalitySummary: 'Vigilant, constructive, meticulous, and security-conscious',
    responsibilities: [
      'Review code changes against requirements and architecture',
      'Identify potential regression bugs, security flaws, and edge cases',
      'Verify strict linting, typing, and safety standards',
      'Provide clear, actionable feedback for remediation',
    ],
    capabilities: [
      'code_review',
      'security_audit',
      'compliance_check',
      'regression_detection',
    ],
    routingProfile: 'review',
    preferredModel: 'minimax/minimax-m3:free',
    systemPromptBase: 'You are Beatriz Mendes, the Code & Security Reviewer in The Office. You inspect code changes with high vigilance to ensure security, compliance, and correctness.',
    isManager: false,
    reportsTo: 'chief-of-staff',
    status: 'ACTIVE',
  },
  {
    id: 'qa-engineer',
    name: 'Tiago Rocha',
    title: 'Quality Assurance & Test Automation Engineer',
    department: 'QA',
    role: 'QA_ENGINEER',
    specialty: 'Test suite design, automated testing, edge-case coverage, and validation',
    personalitySummary: 'Thorough, skeptical, systematic, and quality-driven',
    responsibilities: [
      'Design and write automated unit, integration, and E2E tests',
      'Validate system behavior against acceptance criteria',
      'Identify edge cases, performance bottlenecks, and flaky paths',
      'Ensure test coverage and build stability across releases',
    ],
    capabilities: [
      'test_automation',
      'edge_case_analysis',
      'regression_testing',
      'quality_validation',
    ],
    routingProfile: 'review',
    preferredModel: 'minimax/minimax-m2.7:free',
    systemPromptBase: 'You are the QA Engineer in The Office. You design comprehensive automated tests, discover edge cases, and ensure robust quality.',
    isManager: false,
    reportsTo: 'chief-of-staff',
    status: 'ACTIVE',
  },
];

/**
 * In-memory Agent Registry.
 * Pure, deterministic, side-effect free catalog of The Office workforce.
 */
export class AgentRegistry {
  private readonly agents: Map<string, AgentDefinition>;

  constructor(initialAgents: AgentDefinition[] = INITIAL_STAFF) {
    this.agents = new Map(initialAgents.map(a => [a.id, a]));
  }

  /**
   * Retrieve an agent definition by unique ID.
   */
  getAgent(id: string): AgentDefinition | undefined {
    return this.agents.get(id);
  }

  /**
   * List all registered agents in canonical order.
   */
  listAgents(): AgentDefinition[] {
    return Array.from(this.agents.values());
  }

  /**
   * Retrieve all agents belonging to a specific department.
   */
  getAgentsByDepartment(department: AgentDepartment): AgentDefinition[] {
    return this.listAgents().filter(a => a.department === department);
  }

  /**
   * Retrieve all agents matching a specific functional role.
   */
  getAgentsByRole(role: AgentRole): AgentDefinition[] {
    return this.listAgents().filter(a => a.role === role);
  }
}

/** Global singleton instance */
export const defaultAgentRegistry = new AgentRegistry();

/** Convenience helper functions delegating to default registry */
export const getAgent = (id: string) => defaultAgentRegistry.getAgent(id);
export const listAgents = () => defaultAgentRegistry.listAgents();
export const getAgentsByDepartment = (department: AgentDepartment) => defaultAgentRegistry.getAgentsByDepartment(department);
export const getAgentsByRole = (role: AgentRole) => defaultAgentRegistry.getAgentsByRole(role);

/**
 * Validate whether an agentId corresponds to a registered agent in The Office.
 * Rejects undefined, null, unknown IDs, and non-agent roles such as 'ceo'.
 */
export function isValidAgentId(
  agentId: unknown,
  registry: AgentRegistry = defaultAgentRegistry
): agentId is string {
  if (typeof agentId !== 'string' || !agentId.trim()) return false;
  const normalized = agentId.trim().toLowerCase();
  if (normalized === 'ceo') return false;
  return registry.getAgent(agentId.trim()) !== undefined;
}

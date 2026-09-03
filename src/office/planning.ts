import type { Task } from '../domain.js';
import { defaultAgentRegistry, AgentRegistry } from './registry.js';
import { resolveAgentAssignment, type AssignmentSource } from './assignment.js';
import type { AgentAssignmentDecisionContext } from './assignment-context.js';

export interface OrganizationalObjective {
  readonly id?: string;
  readonly objective: string;
  readonly project?: string;
  readonly repository?: string;
  readonly context?: Record<string, unknown> | string;
}

export type PlanStepStatus = 'PENDING' | 'READY' | 'ASSIGNED' | 'UNRESOLVED';

export interface PlanStep {
  readonly id: string;
  readonly description: string;
  readonly prompt: string;
  readonly agentId: string | null;
  readonly assignmentSource: AssignmentSource;
  readonly compatibility: {
    readonly compatible: boolean;
    readonly score: number;
    readonly reasons: readonly string[];
  };
  readonly dependsOn: readonly string[];
  readonly status: PlanStepStatus;
  readonly decisionContext?: AgentAssignmentDecisionContext | null;
}

export interface PlanStepInput {
  readonly id?: string;
  readonly description: string;
  readonly prompt?: string;
  readonly agentId?: string | null;
  readonly dependsOn?: readonly string[];
}

export type OrganizationalPlanStatus = 'DRAFT' | 'READY' | 'INVALID';

export interface OrganizationalPlan {
  readonly id: string;
  readonly objective: string;
  readonly project: string;
  readonly repository: string;
  readonly createdBy: 'chief-of-staff';
  readonly steps: readonly PlanStep[];
  readonly status: OrganizationalPlanStatus;
  readonly validationErrors: readonly string[];
  readonly createdAt: Date;
}

export interface DependencyValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
  readonly executionOrder: readonly string[];
}

/**
 * Validates dependency graph for plan steps:
 * 1. Checks for unknown dependencies
 * 2. Checks for self-dependencies
 * 3. Checks for cyclic dependencies (DFS)
 * 4. Produces deterministic topological execution order
 */
export function validateStepDependencies(
  steps: readonly (PlanStep | PlanStepInput)[]
): DependencyValidationResult {
  const errors: string[] = [];
  const stepMap = new Map<string, (PlanStep | PlanStepInput)>();
  const graph = new Map<string, string[]>();

  for (const step of steps) {
    if (!step.id || !step.id.trim()) {
      errors.push('Step ID cannot be empty');
      continue;
    }
    const id = step.id.trim();
    if (stepMap.has(id)) {
      errors.push(`Duplicate step ID detected: '${id}'`);
    }
    stepMap.set(id, step);
    const deps = (step.dependsOn || []).map(d => d.trim()).filter(Boolean);
    graph.set(id, Array.from(new Set(deps)));
  }

  // Check unknown dependencies and self-dependencies
  for (const [id, deps] of graph.entries()) {
    for (const dep of deps) {
      if (dep === id) {
        errors.push(`Self-dependency detected in step '${id}'`);
      } else if (!stepMap.has(dep)) {
        errors.push(`Step '${id}' depends on non-existent step '${dep}'`);
      }
    }
  }

  // Detect cycles using DFS (3-color tracking: 0=unvisited, 1=visiting, 2=visited)
  const state = new Map<string, number>();
  const executionOrder: string[] = [];
  let hasCycle = false;

  function dfs(node: string, path: string[]) {
    state.set(node, 1);
    const neighbors = graph.get(node) || [];
    for (const neighbor of neighbors) {
      if (!stepMap.has(neighbor)) continue;
      const neighborState = state.get(neighbor) || 0;
      if (neighborState === 1) {
        hasCycle = true;
        errors.push(`Cyclic dependency detected: ${[...path, node, neighbor].join(' -> ')}`);
      } else if (neighborState === 0) {
        dfs(neighbor, [...path, node]);
      }
    }
    state.set(node, 2);
    executionOrder.push(node);
  }

  for (const node of graph.keys()) {
    if ((state.get(node) || 0) === 0) {
      dfs(node, []);
    }
  }

  if (hasCycle || errors.length > 0) {
    return {
      valid: false,
      errors: Object.freeze(errors),
      executionOrder: Object.freeze([]),
    };
  }

  return {
    valid: true,
    errors: Object.freeze([]),
    executionOrder: Object.freeze(executionOrder),
  };
}

export interface CreateOrganizationalPlanOptions {
  readonly planId?: string;
  readonly steps?: readonly PlanStepInput[];
  readonly defaultRepository?: string;
  readonly defaultProject?: string;
}

/**
 * Creates an immutable, deterministic OrganizationalPlan from the Chief of Staff.
 *
 * Rules:
 * - createdBy is always "chief-of-staff".
 * - CEO is never assigned as an executable agent.
 * - Resolves agent assignments and compatibility through AgentRegistry and resolveAgentAssignment.
 * - Validates all step dependencies strictly.
 * - Pure function: 0 LLM calls, 0 network, 0 database, 0 mutations.
 */
export function createOrganizationalPlan(
  objectiveInput: OrganizationalObjective | string,
  options?: CreateOrganizationalPlanOptions,
  registry: AgentRegistry = defaultAgentRegistry
): OrganizationalPlan {
  const objectiveObj: OrganizationalObjective =
    typeof objectiveInput === 'string'
      ? { objective: objectiveInput }
      : objectiveInput;

  const rawObjective = (objectiveObj.objective || '').trim();
  const project = objectiveObj.project?.trim() || options?.defaultProject || 'pub-dev-loop';
  const repository =
    objectiveObj.repository?.trim() ||
    options?.defaultRepository ||
    'https://github.com/pubcoreagencia/pub-dev-loop.git';
  const planId = options?.planId || `plan-${Date.now()}`;

  const planErrors: string[] = [];

  if (!rawObjective) {
    planErrors.push('Objective description cannot be empty');
  }

  // Determine steps to evaluate: either explicit options.steps or standard lifecycle decomposition
  let stepInputs: readonly PlanStepInput[] = options?.steps || [];

  if (stepInputs.length === 0 && rawObjective) {
    // Canonical default 4-stage engineering lifecycle decomposition
    stepInputs = [
      {
        id: 'step-1-architect',
        description: `Define system architecture and technical design specifications for: ${rawObjective}`,
        prompt: `Act as Principal Architect. Specify architectural boundaries and domain contracts for: ${rawObjective}`,
        agentId: 'architect',
        dependsOn: [],
      },
      {
        id: 'step-2-developer',
        description: `Implement core domain logic and features for: ${rawObjective}`,
        prompt: `Act as Senior Developer. Implement TypeScript/Node components for: ${rawObjective}`,
        agentId: 'developer',
        dependsOn: ['step-1-architect'],
      },
      {
        id: 'step-3-reviewer',
        description: `Review code quality, architecture compliance, and security for: ${rawObjective}`,
        prompt: `Act as Code Reviewer. Inspect implementation against architecture for: ${rawObjective}`,
        agentId: 'reviewer',
        dependsOn: ['step-2-developer'],
      },
      {
        id: 'step-4-qa-engineer',
        description: `Design and execute automated unit, integration, and regression tests for: ${rawObjective}`,
        prompt: `Act as QA Engineer. Build test automation suite for: ${rawObjective}`,
        agentId: 'qa-engineer',
        dependsOn: ['step-3-reviewer'],
      },
    ];
  }

  const depValidation = validateStepDependencies(stepInputs);
  if (!depValidation.valid) {
    planErrors.push(...depValidation.errors);
  }

  const resolvedSteps: PlanStep[] = [];

  for (let i = 0; i < stepInputs.length; i++) {
    const input = stepInputs[i];
    const stepId = input.id?.trim() || `step-${i + 1}`;
    const desc = (input.description || '').trim();
    const prompt = (input.prompt || input.description || '').trim();

    // Create ephemeral task representation to evaluate assignment deterministically
    const tempTask: Task = {
      id: `task-eval-${stepId}`,
      project,
      repository,
      objective: desc,
      prompt,
      status: 'QUEUED',
      priority: 1,
      worker: 'eval-worker',
      result: null,
      error: null,
      branch: null,
      commitSha: null,
      gitStatus: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      leaseOwner: null,
      leaseDeadline: null,
      heartbeatAt: null,
      workspacePath: null,
      prototypeSessionId: null,
      agentId: input.agentId ?? null,
    };

    const assignment = resolveAgentAssignment(tempTask, registry);

    const stepStatus: PlanStepStatus =
      assignment.source === 'UNRESOLVED' || !assignment.agentId
        ? 'UNRESOLVED'
        : input.dependsOn && input.dependsOn.length > 0
        ? 'PENDING'
        : 'READY';

    resolvedSteps.push({
      id: stepId,
      description: desc,
      prompt,
      agentId: assignment.agentId,
      assignmentSource: assignment.source,
      compatibility: {
        compatible: assignment.compatible,
        score: assignment.score,
        reasons: assignment.reasons,
      },
      dependsOn: Object.freeze(Array.from(new Set(input.dependsOn || []))),
      status: stepStatus,
      decisionContext: assignment.context,
    });
  }

  const overallStatus: OrganizationalPlanStatus =
    planErrors.length > 0
      ? 'INVALID'
      : resolvedSteps.some(s => s.status === 'UNRESOLVED')
      ? 'DRAFT'
      : 'READY';

  return {
    id: planId,
    objective: rawObjective,
    project,
    repository,
    createdBy: 'chief-of-staff',
    steps: Object.freeze(resolvedSteps),
    status: overallStatus,
    validationErrors: Object.freeze(planErrors),
    createdAt: new Date(),
  };
}

/**
 * Converts a validated PlanStep into a Task contract for the runtime.
 * Pure mapping function: does NOT enqueue or persist the Task.
 */
export function planStepToTask(
  step: PlanStep,
  plan: OrganizationalPlan,
  overrides?: Partial<Task>
): Task {
  return {
    id: `task-${plan.id}-${step.id}`,
    project: plan.project,
    repository: plan.repository,
    objective: step.description,
    prompt: step.prompt || step.description,
    status: 'QUEUED',
    priority: 1,
    worker: 'unassigned',
    result: null,
    error: null,
    branch: null,
    commitSha: null,
    gitStatus: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    leaseOwner: null,
    leaseDeadline: null,
    heartbeatAt: null,
    workspacePath: null,
    prototypeSessionId: null,
    agentId: step.agentId,
    ...overrides,
  };
}

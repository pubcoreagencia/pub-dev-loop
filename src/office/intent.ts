import { randomUUID } from 'node:crypto';
import type { Task } from '../domain.js';
import { PUB_HOLDING_SECTORS } from './squads.js';
import type { ResolvedContext } from './context-resolver.js';

export type TaskType =
  | 'QUESTION'
  | 'RESEARCH'
  | 'INVESTIGATION'
  | 'BUG'
  | 'FEATURE'
  | 'REFACTOR'
  | 'ARCHITECTURE'
  | 'OPTIMIZATION'
  | 'UX'
  | 'SECURITY'
  | 'MAINTENANCE'
  | 'EXPLORATION';

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface EngineeringTask {
  id: string;
  intent: string;
  domain: string;
  objective: string;
  user_observation?: string;
  user_proposed_solution?: string;
  expected_outcome?: string;
  task_type: TaskType;
  project?: string;
  scope: string[];
  constraints: string[];
  known_context: string[];
  unknowns: string[];
  assumptions: string[];
  risk_level: RiskLevel;
  research_required: boolean;
  skill_discovery_required: boolean;
  human_approval_required: boolean;
  acceptance_criteria: string[];
  created_at: string;
}

export type LifecyclePhaseName =
  | 'DISCOVERY'
  | 'ANALYSIS'
  | 'PLANNING'
  | 'IMPLEMENTATION'
  | 'TEST'
  | 'VALIDATION';

export interface EngineeringPlanPhase {
  phase: LifecyclePhaseName;
  objective: string;
  actions: string[];
  expected_evidence: string[];
}

export interface EngineeringPlan {
  taskId: string;
  phases: EngineeringPlanPhase[];
  createdAt: string;
}

export interface RawUserIntent {
  prompt: string;
  project?: string;
  context?: Record<string, unknown>;
  author?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

const VALID_TASK_TYPES: ReadonlySet<TaskType> = new Set([
  'QUESTION',
  'RESEARCH',
  'INVESTIGATION',
  'BUG',
  'FEATURE',
  'REFACTOR',
  'ARCHITECTURE',
  'OPTIMIZATION',
  'UX',
  'SECURITY',
  'MAINTENANCE',
  'EXPLORATION',
]);

const VALID_RISK_LEVELS: ReadonlySet<RiskLevel> = new Set(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);

/**
 * Classifies the task type focusing on actual engineering intent rather than simple keyword matches.
 */
export function classifyTaskType(prompt: string): TaskType {
  const p = prompt.toLowerCase();

  // 1. Investigation / Discovery of root cause
  if (
    p.includes('descubra por que') ||
    p.includes('investigar') ||
    p.includes('investigue') ||
    p.includes('por que está falhando') ||
    p.includes('qual a causa') ||
    p.includes('diagnostique') ||
    p.includes('diagnosticar')
  ) {
    return 'INVESTIGATION';
  }

  // 2. Questions / Explanations
  if (
    p.startsWith('como ') ||
    p.startsWith('o que é') ||
    p.startsWith('qual a diferença') ||
    p.includes('explicar o fluxo') ||
    p.includes('como funciona') ||
    p.endsWith('?')
  ) {
    return 'QUESTION';
  }

  // 3. Security vulnerabilities
  if (
    p.includes('vulnerabilidade') ||
    p.includes('security') ||
    p.includes('segurança') ||
    p.includes('sql injection') ||
    p.includes('cve') ||
    p.includes('brecha')
  ) {
    return 'SECURITY';
  }

  // 4. Bugs and errors to fix
  if (
    p.includes('corrija o bug') ||
    p.includes('corrigir bug') ||
    p.includes('está quebrado') ||
    p.includes('consertar') ||
    p.includes('corrija o erro') ||
    p.includes('corrija o checkout') ||
    p.includes('falha ao') ||
    p.includes('falha') ||
    p.includes('falhando') ||
    p.includes('erro') ||
    p.includes('fix ') ||
    p.includes('bug')
  ) {
    return 'BUG';
  }

  // 5. Optimization & Performance
  if (
    p.includes('melhore a performance') ||
    p.includes('otimizar') ||
    p.includes('otimize') ||
    p.includes('reduzir latência') ||
    p.includes('mais rápido') ||
    p.includes('60 fps') ||
    p.includes('gargalo')
  ) {
    return 'OPTIMIZATION';
  }

  // 6. UX / UI specific
  if (
    p.includes('layout') ||
    p.includes('css') ||
    p.includes('responsividade') ||
    p.includes('experiência do usuário') ||
    p.includes('visual do')
  ) {
    return 'UX';
  }

  // 7. Exploration of alternatives / benchmarking
  if (
    p.includes('veja se existe') ||
    p.includes('existe uma biblioteca melhor') ||
    p.includes('existe uma solução melhor') ||
    p.includes('explorar') ||
    p.includes('analisar alternativas')
  ) {
    return 'EXPLORATION';
  }

  // 8. Architecture comparison / system design
  if (
    p.includes('arquitetura') ||
    p.includes('compare duas') ||
    p.includes('design do sistema') ||
    p.includes('diagrama') ||
    p.includes('adr')
  ) {
    return 'ARCHITECTURE';
  }

  // 9. Research & deep evaluation
  if (
    p.includes('pesquisar') ||
    p.includes('pesquise') ||
    p.includes('estudo sobre') ||
    p.includes('documentação')
  ) {
    return 'RESEARCH';
  }

  // 10. Refactoring
  if (
    p.includes('refatore') ||
    p.includes('refatorar') ||
    p.includes('modularizar') ||
    p.includes('limpar código') ||
    p.includes('reduzir complexidade')
  ) {
    return 'REFACTOR';
  }

  // 11. Maintenance & dependencies
  if (
    p.includes('dependência') ||
    p.includes('package.json') ||
    p.includes('atualizar lib') ||
    p.includes('manutenção') ||
    p.includes('migrar versão')
  ) {
    return 'MAINTENANCE';
  }

  // 12. New feature / implementation
  if (
    p.includes('adicione') ||
    p.includes('criar') ||
    p.includes('crie') ||
    p.includes('implemente') ||
    p.includes('novo endpoint') ||
    p.includes('nova tela') ||
    p.includes('adicionar')
  ) {
    return 'FEATURE';
  }

  return 'FEATURE';
}

/**
 * Resolves holding domain and project name from raw input and known 52 catalog repos.
 */
function resolveProjectAndDomain(rawPrompt: string, explicitProject?: string): { project: string; domain: string } {
  const p = rawPrompt.toLowerCase();

  // Direct check against explicit project
  if (explicitProject && explicitProject.trim()) {
    const cleanProj = explicitProject.trim();
    for (const sector of PUB_HOLDING_SECTORS) {
      if (sector.repos.includes(cleanProj)) {
        return { project: cleanProj, domain: sector.id.toUpperCase().replace(/-/g, '_') };
      }
    }
    return { project: cleanProj, domain: 'CORE_ENGINEERING' };
  }

  // Scan prompt for known repos in holding sectors
  for (const sector of PUB_HOLDING_SECTORS) {
    for (const repo of sector.repos) {
      if (p.includes(repo.toLowerCase())) {
        return { project: repo, domain: sector.id.toUpperCase().replace(/-/g, '_') };
      }
    }
  }

  // Common keywords fallback
  if (p.includes('worker') || p.includes('office') || p.includes('pdl') || p.includes('devloop')) {
    return { project: 'pub-dev-loop', domain: 'NEURAL_KERNEL_INFRA' };
  }

  return { project: 'pub-dev-loop', domain: 'CORE_ENGINEERING' };
}

/**
 * Separates user observation from user-proposed technical solution.
 */
function extractObservationAndSolution(rawPrompt: string): {
  observation?: string;
  proposedSolution?: string;
  objective: string;
} {
  const clean = rawPrompt.trim();

  // Pattern: Observation +  Acho que precisa / Sugiro / Deveria / Criar...
  const splitRegex = /(?:acho que (?:precisa|deveria|tem que)|sugiro (?:que )?|sugeriu (?:que )?|o usuário (?:disse|sugeriu|pediu) para |deveria ser feito|solução proposta:|minha ideia é|recomendo (?:que )?)\s*(.*)/i;
  const match = clean.match(splitRegex);

  if (match && match.index !== undefined) {
    const observationPart = clean.slice(0, match.index).trim().replace(/[.,;:]$/, '');
    const solutionPart = match[1].trim();

    // The engineering objective focuses on the underlying goal, NOT on the unverified proposed solution
    const objective = observationPart
      ? 'Investigar e resolver: ' + observationPart
      : 'Atender objetivo técnico relacionado a: ' + clean;

    return {
      observation: observationPart || undefined,
      proposedSolution: solutionPart || undefined,
      objective,
    };
  }

  return {
    observation: clean,
    proposedSolution: undefined,
    objective: clean,
  };
}

/**
 * Evaluates operational risk level and whether human approval is required.
 */
export function evaluateRisk(
  prompt: string,
  taskType: TaskType,
  scope: string[]
): { riskLevel: RiskLevel; humanApprovalRequired: boolean } {
  const p = prompt.toLowerCase();

  // CRITICAL: Production deployment, dropping database tables, deleting branches/repos
  if (
    p.includes('produção') ||
    p.includes('production') ||
    p.includes('drop table') ||
    p.includes('delete branch') ||
    p.includes('force push')
  ) {
    return { riskLevel: 'CRITICAL', humanApprovalRequired: true };
  }

  // LOW: Documentation, questions, README updates take precedence before general feature logic
  if (
    p.includes('readme') ||
    p.includes('documentar') ||
    p.includes('documentação') ||
    taskType === 'QUESTION'
  ) {
    return { riskLevel: 'LOW', humanApprovalRequired: false };
  }

  // HIGH: Database migrations, security changes, financial/Pix/payment logic, auth tokens
  if (
    p.includes('banco de dados') ||
    p.includes('database') ||
    p.includes('migra') ||
    p.includes('migration') ||
    p.includes('pix') ||
    p.includes('pagamento') ||
    p.includes('cartão') ||
    p.includes('gateway') ||
    p.includes('payment') ||
    p.includes('auth') ||
    p.includes('senha') ||
    p.includes('secret') ||
    taskType === 'SECURITY'
  ) {
    return { riskLevel: 'HIGH', humanApprovalRequired: true };
  }

  // MEDIUM: Refactoring, new features across multiple files, optimization
  if (
    taskType === 'REFACTOR' ||
    taskType === 'FEATURE' ||
    taskType === 'OPTIMIZATION' ||
    taskType === 'ARCHITECTURE' ||
    scope.length > 3
  ) {
    return { riskLevel: 'MEDIUM', humanApprovalRequired: false };
  }

  // LOW: Questions, pure exploration, simple bug investigation, documentation
  return { riskLevel: 'LOW', humanApprovalRequired: false };
}

/**
 * Performs requirements analysis identifying knowns, unknowns, assumptions, constraints, and acceptance criteria.
 */
export function analyzeRequirements(task: Partial<EngineeringTask>): {
  known_context: string[];
  unknowns: string[];
  assumptions: string[];
  constraints: string[];
  acceptance_criteria: string[];
} {
  const known_context: string[] = [];
  const unknowns: string[] = [];
  const assumptions: string[] = [];
  const constraints: string[] = [];
  const acceptance_criteria: string[] = [];

  // Known
  if (task.intent) known_context.push('User intent: ' + task.intent);
  if (task.project) known_context.push('Target repository/project: ' + task.project);
  if (task.user_observation) known_context.push('Reported observation: ' + task.user_observation);
  if (task.task_type) known_context.push('Classified task category: ' + task.task_type);

  // Unknowns (discovery requirements before execution)
  if (!task.scope || task.scope.length === 0) {
    unknowns.push('Exact files and modules requiring modification not explicitly enumerated');
  }
  if (!task.expected_outcome) {
    unknowns.push('Detailed expected runtime output / payload not explicitly specified');
  }
  if (task.task_type === 'BUG' || task.task_type === 'INVESTIGATION') {
    unknowns.push('Underlying root cause and reproduction stack trace to be verified in workspace');
  }

  // Assumptions
  if (task.user_proposed_solution) {
    assumptions.push('User proposed solution: ' + task.user_proposed_solution + ' (UNVERIFIED — requires engineering validation)');
  } else {
    assumptions.push('Existing unit and integration tests are accurate baselines of expected behavior');
  }

  // Constraints
  constraints.push('Zero modification of files outside declared task scope');
  constraints.push('No destructive git operations (no force push, no hard reset)');
  constraints.push('No embedding of plaintext secrets or API keys');
  if (task.risk_level === 'HIGH' || task.risk_level === 'CRITICAL') {
    constraints.push('CEO / Human approval mandatory before applying changes to production or database');
  }

  // Testable Acceptance Criteria
  acceptance_criteria.push('npm run typecheck passes');
  acceptance_criteria.push('Targeted automated tests pass');
  acceptance_criteria.push('No regression in unrelated files or modules');
  if (task.task_type === 'BUG') {
    acceptance_criteria.push('Reported error scenario is reproduced and verified resolved by automated test');
  }

  return {
    known_context,
    unknowns,
    assumptions,
    constraints,
    acceptance_criteria,
  };
}

/**
 * Transforms raw user intent into a canonical, structured EngineeringTask.
 */
export function parseEngineeringTask(input: RawUserIntent): EngineeringTask {
  const rawPrompt = input.prompt || '';
  const taskType = classifyTaskType(rawPrompt);
  const { project, domain } = resolveProjectAndDomain(rawPrompt, input.project);
  const { observation, proposedSolution, objective } = extractObservationAndSolution(rawPrompt);

  // Derive initial scope
  const scope: string[] = [];
  const lower = rawPrompt.toLowerCase();
  if (lower.includes('api')) scope.push('api');
  if (lower.includes('frontend') || lower.includes('ui')) scope.push('frontend');
  if (lower.includes('worker')) scope.push('worker');
  if (lower.includes('database') || lower.includes('banco')) scope.push('db');
  if (scope.length === 0) scope.push('src');

  const { riskLevel, humanApprovalRequired } = evaluateRisk(rawPrompt, taskType, scope);

  const partialTask: Partial<EngineeringTask> = {
    id: 'eng-task-' + Date.now() + '-' + randomUUID().slice(0, 8),
    intent: rawPrompt,
    domain,
    objective,
    user_observation: observation,
    user_proposed_solution: proposedSolution,
    task_type: taskType,
    project,
    scope,
    risk_level: riskLevel,
    human_approval_required: humanApprovalRequired,
  };

  const reqs = analyzeRequirements(partialTask);

  const engineeringTask: EngineeringTask = {
    id: partialTask.id!,
    intent: partialTask.intent!,
    domain: partialTask.domain!,
    objective: partialTask.objective!,
    user_observation: partialTask.user_observation,
    user_proposed_solution: partialTask.user_proposed_solution,
    expected_outcome: 'Expected resolution of ' + taskType + ' in ' + project,
    task_type: taskType,
    project,
    scope,
    constraints: reqs.constraints,
    known_context: reqs.known_context,
    unknowns: reqs.unknowns,
    assumptions: reqs.assumptions,
    risk_level: riskLevel,
    research_required: taskType === 'RESEARCH' || taskType === 'EXPLORATION' || reqs.unknowns.length > 1,
    skill_discovery_required: taskType === 'SECURITY' || taskType === 'EXPLORATION' || taskType === 'OPTIMIZATION',
    human_approval_required: humanApprovalRequired,
    acceptance_criteria: reqs.acceptance_criteria,
    created_at: new Date().toISOString(),
  };

  return engineeringTask;
}

/**
 * Validates that an EngineeringTask adheres to structural invariants and non-empty required fields.
 */
export function validateEngineeringTask(task: any): ValidationResult {
  const errors: string[] = [];

  if (!task || typeof task !== 'object') {
    return { valid: false, errors: ['Task must be a non-null object'] };
  }

  if (!task.id || typeof task.id !== 'string' || !task.id.trim()) {
    errors.push('id is required and must be a non-empty string');
  }

  if (!task.intent || typeof task.intent !== 'string' || !task.intent.trim()) {
    errors.push('intent is required and must be a non-empty string');
  }

  if (!task.domain || typeof task.domain !== 'string' || !task.domain.trim()) {
    errors.push('domain is required and must be a non-empty string');
  }

  if (!task.objective || typeof task.objective !== 'string' || !task.objective.trim()) {
    errors.push('objective is required and must be a non-empty string');
  }

  if (!task.task_type || !VALID_TASK_TYPES.has(task.task_type)) {
    errors.push('task_type must be one of: ' + Array.from(VALID_TASK_TYPES).join(', '));
  }

  if (!task.risk_level || !VALID_RISK_LEVELS.has(task.risk_level)) {
    errors.push('risk_level must be one of: ' + Array.from(VALID_RISK_LEVELS).join(', '));
  }

  if (!Array.isArray(task.scope)) {
    errors.push('scope must be an array of strings');
  }

  if (!Array.isArray(task.acceptance_criteria) || task.acceptance_criteria.length === 0) {
    errors.push('acceptance_criteria must be a non-empty array of testable strings');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Creates canonical structured lifecycle phases for executing an EngineeringTask, enriched with resolved context.
 */
export function createEngineeringPlan(task: EngineeringTask, resolvedContext?: ResolvedContext): EngineeringPlan {
  const discoveredFilesList = resolvedContext?.relevant_files && resolvedContext.relevant_files.length > 0
    ? resolvedContext.relevant_files
    : ['List of discovered files'];

  const phases: EngineeringPlanPhase[] = [
    {
      phase: 'DISCOVERY',
      objective: 'Discover project structure, dependencies, and inspect relevant files in ' + (task.project || 'repository'),
      actions: [
        'Inspect workspace root and package.json',
        'Read files associated with scope: [' + task.scope.join(', ') + ']',
        'Clarify unknowns: [' + task.unknowns.join('; ') + ']',
        ...(resolvedContext?.resolved_unknowns.map(r => 'Investigate discovered candidate path: ' + r.discoveredPaths.slice(0, 3).join(', ')) || []),
      ],
      expected_evidence: [
        'Workspace snapshot verification',
        ...discoveredFilesList.slice(0, 5),
      ],
    },
    {
      phase: 'ANALYSIS',
      objective: 'Perform root cause or architectural analysis for ' + task.task_type + ': ' + task.objective,
      actions: [
        task.user_observation ? 'Verify reported observation: ' + task.user_observation : 'Evaluate current behavior',
        task.user_proposed_solution ? 'Validate feasibility of proposed idea: ' + task.user_proposed_solution : 'Identify technical options',
        'Evaluate constraints: [' + task.constraints.join('; ') + ']',
      ],
      expected_evidence: [
        'Technical rationale',
        'Selected implementation approach',
        ...(resolvedContext?.unresolved_unknowns.map(u => 'Unresolved discovery flag: ' + u) || []),
      ],
    },
    {
      phase: 'PLANNING',
      objective: 'Define discrete, non-destructive file modifications and test plan',
      actions: [
        'Enumerate target files to modify',
        'Verify required tests and build commands',
        task.human_approval_required ? 'REQUEST_CEO_APPROVAL before modifying protected systems' : 'Proceed with low-risk execution',
      ],
      expected_evidence: ['Plan checklist', 'Risk mitigation confirmation'],
    },
    {
      phase: 'IMPLEMENTATION',
      objective: 'Implement technical solution for ' + task.objective,
      actions: [
        'Apply scoped code changes',
        'Ensure formatting and TypeScript conformance',
      ],
      expected_evidence: ['Git diff of modified files'],
    },
    {
      phase: 'TEST',
      objective: 'Run automated tests to verify solution and guard against regressions',
      actions: [
        'Execute npm run typecheck',
        'Run targeted automated test suite',
        'Verify acceptance criteria',
        ...(resolvedContext?.existing_tests.map(t => 'Run test: ' + t) || []),
      ],
      expected_evidence: ['Test execution logs with 100% pass', 'Zero compilation errors'],
    },
    {
      phase: 'VALIDATION',
      objective: 'Finalize workspace, capture SHA-256 snapshot, and prepare clean commit',
      actions: [
        'TaskFinalizer workspace snapshot comparison',
        'Confirm only declared changed files were touched',
      ],
      expected_evidence: ['Commit SHA', 'Final Task result summary'],
    },
  ];

  return {
    taskId: task.id,
    phases,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Bridges an EngineeringTask seamlessly into the existing runtime Task contract.
 * Preserves full compatibility with WorkerService and TaskRepository.
 */
export function engineeringTaskToTask(
  engTask: EngineeringTask,
  overrides?: Partial<Task>,
  resolvedContext?: ResolvedContext,
  plan?: EngineeringPlan
): Task {
  const structuredPrompt = [
    'OBJETIVO DE ENGENHARIA: ' + engTask.objective,
    engTask.user_observation ? 'OBSERVAÇÃO DO USUÁRIO: ' + engTask.user_observation : '',
    engTask.user_proposed_solution ? 'SUGESTÃO DO USUÁRIO: ' + engTask.user_proposed_solution + ' (Validar tecnicamente antes de aplicar)' : '',
    'TIPO DE TAREFA: ' + engTask.task_type + ' | NÍVEL DE RISCO: ' + engTask.risk_level,
    'ESCOPO: ' + engTask.scope.join(', '),
    resolvedContext && resolvedContext.relevant_files.length > 0 ? 'ARQUIVOS RELEVANTES IDENTIFICADOS:\n' + resolvedContext.relevant_files.slice(0, 8).map(f => '  - ' + f).join('\n') : '',
    'CRITÉRIOS DE ACEITE OBRIGATÓRIOS:',
    ...engTask.acceptance_criteria.map((c, i) => '  ' + (i + 1) + '. ' + c),
    'RESTRIÇÕES:',
    ...engTask.constraints.map((c) => '  - ' + c),
  ]
    .filter(Boolean)
    .join('\n');

  return {
    id: engTask.id,
    project: engTask.project || 'pub-dev-loop',
    repository: overrides?.repository || resolvedContext?.repository || 'https://github.com/pubcoreagencia/pub-dev-loop.git',
    objective: engTask.objective,
    prompt: structuredPrompt,
    status: 'QUEUED',
    priority: engTask.risk_level === 'CRITICAL' ? 3 : engTask.risk_level === 'HIGH' ? 2 : 1,
    worker: null,
    result: {
      engineeringTask: engTask,
      resolvedContext: resolvedContext || null,
      engineeringPlan: plan || null,
    },
    error: null,
    branch: null,
    commitSha: null,
    gitStatus: null,
    createdAt: new Date(engTask.created_at),
    updatedAt: new Date(engTask.created_at),
    leaseOwner: null,
    leaseDeadline: null,
    heartbeatAt: null,
    workspacePath: null,
    prototypeSessionId: null,
    tenantId: 'pub-core-holding',
    ...overrides,
  };
}

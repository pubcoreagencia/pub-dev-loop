import type { Pool } from 'pg';
import type { Task, TaskStatus } from '../../domain.js';
import {
  EXECUTION_SPEC_VERSION,
  type ExecutionSpec,
  type ExecutionStep,
} from '../../task/execution-spec.js';
import type { ContextBundle } from '../../task/context-discovery.js';
import {
  normalizeTaskIntake,
  type TaskIntake,
  type TaskIntakeInput,
  TaskIntakeError,
} from '../../task/intake.js';
import {
  validateExecutionSpec,
  ExecutionSpecValidationError,
} from '../../task/spec-validator.js';
import {
  createExecutionSpec,
  sealExecutionSpec,
  type ExecutionSpecRecord,
  type QueryableDb,
} from '../../execution/execution-spec-persistence.js';
import {
  createRepositoryTarget,
  type RepositoryTarget,
} from '../../task/trust-contracts.js';
import { PdlPreflightEngine } from '../research/index.js';
import { PdlRefinementEngine } from '../refinement/index.js';
import { defaultRepositoryAuthorizationPolicy } from '../security/repo-authorization.js';


export interface PoolClientLike extends QueryableDb {
  release(): void;
}

export interface PoolLike {
  connect(): Promise<PoolClientLike>;
  query?(sql: string, params?: unknown[]): Promise<{ rows: any[] }>;
}

export interface TaskIntakeOptions {
  project?: string;
  repository?: string;
  branch?: string;
  priority?: number;
  agentId?: string;
  source?: string;
  executionInstructions?: string[];
  acceptanceCriteria?: string[];
  validationPlan?: string[];
  executionSteps?: ExecutionStep[];
  constraints?: string[];
  context?: ContextBundle;
  risks?: string[];
  escalationConditions?: string[];
}

export interface TaskIntakePayload {
  rawRequest?: string;
  prompt?: string;
  objective?: string;
  source?: string;
  createdAt?: string | Date;
  project?: string;
  repository?: string;
  priority?: number;
  agentId?: string | null;
  branch?: string | null;
  workspacePath?: string | null;
  executionInstructions?: string[];
  acceptanceCriteria?: string[];
  validationPlan?: string[];
  executionSteps?: ExecutionStep[];
  constraints?: string[];
  context?: ContextBundle;
  risks?: string[];
  escalationConditions?: string[];
}

export interface AtomicIntakeResult {
  task: Task;
  executionSpec: ExecutionSpecRecord;
}

export function isTaskIntake(value: unknown): value is TaskIntake {
  return (
    typeof value === 'object' &&
    value !== null &&
    'intakeVersion' in value &&
    'rawRequest' in value &&
    'normalizedRequest' in value &&
    'objective' in value &&
    'lineage' in value
  );
}

export function buildCanonicalExecutionSpec(
  intake: TaskIntake,
  options?: TaskIntakeOptions,
): ExecutionSpec {
  const project = options?.project?.trim() || 'pub-dev-loop';
  const repository =
    options?.repository?.trim() ||
    'https://github.com/pubcoreagencia/pub-dev-loop.git';

  const constraints =
    options?.constraints && options.constraints.length > 0
      ? options.constraints
      : intake.constraints;

  const acceptanceCriteria =
    options?.acceptanceCriteria && options.acceptanceCriteria.length > 0
      ? options.acceptanceCriteria
      : intake.requestedOutcome
        ? [intake.requestedOutcome]
        : ['Fulfill objective: ' + intake.objective];

  const validationPlan =
    options?.validationPlan && options.validationPlan.length > 0
      ? options.validationPlan
      : ['Verify implementation against objective: ' + intake.objective];

  const executionInstructions =
    options?.executionInstructions && options.executionInstructions.length > 0
      ? options.executionInstructions
      : [intake.normalizedRequest];

  const executionSteps: ExecutionStep[] =
    options?.executionSteps && options.executionSteps.length > 0
      ? options.executionSteps
      : [
          {
            id: 'step-1',
            description: 'Execute task: ' + intake.objective,
            critical: true,
          },
        ];

  const context: ContextBundle = options?.context ?? {
    version: '1.0.0',
    authoritativeContext: [
      { key: 'source', value: intake.source, source: 'intake' },
      { key: 'project', value: project, source: 'intake' },
    ],
    repositoryContext: [
      { key: 'repository', value: repository, source: 'intake' },
    ],
    operationalContext: [],
    relevantDocumentation: [],
    knownConstraints: constraints,
    limitations: [],
    evidence: [],
  };

  const targetBranch = options?.branch?.trim() || 'feat/autonomous-task';
  const authResult = defaultRepositoryAuthorizationPolicy.authorize({
    repository,
    branch: targetBranch,
  });
  if (!authResult.authorized) {
    throw new TaskIntakeError('INVALID_TASK', `Repository authorization rejected: ${authResult.reason}`);
  }

  const owner = authResult.owner || (repository.includes('/')
    ? repository.split('/').slice(-2, -1)[0] || 'pubcoreagencia'
    : 'pubcoreagencia');
  const repoName = authResult.name || project || 'pub-dev-loop';

  const repositoryTarget: RepositoryTarget = createRepositoryTarget(
    { owner, name: repoName, fullName: `${owner}/${repoName}` },
    'git',
    repository,
    targetBranch,
    `projects/${repoName}`,
    'HEAD',
    'pdl:internal:token',
    'pdl:internal:intake',
    intake.lineage,
    true,
  );

  const risks =
    options?.risks && options.risks.length > 0
      ? options.risks
      : intake.ambiguityFlags.length > 0 ? [...intake.ambiguityFlags] : [];

  const escalationConditions =
    options?.escalationConditions && options.escalationConditions.length > 0
      ? options.escalationConditions
      : [
          'Unrecoverable execution error or failure',
          'Safety or constraint violation',
        ];

  const spec: ExecutionSpec = {
    specVersion: EXECUTION_SPEC_VERSION,
    objective: intake.objective,
    context,
    constraints,
    acceptanceCriteria,
    validationPlan,
    executionInstructions,
    executionSteps,
    risks,
    escalationConditions,
    lineage: intake.lineage,
    metadata: {
      generatedAt: new Date().toISOString(),
      specHash: '',
    },
    repositoryTarget,
  };

  return spec;
}

export function mapTaskRow(r: Record<string, unknown>): Task {
  return {
    id: String(r.id),
    project: String(r.project),
    repository: String(r.repository),
    objective: String(r.objective),
    prompt: String(r.prompt),
    status: (r.status as TaskStatus) ?? 'QUEUED',
    priority: Number(r.priority ?? 0),
    worker: (r.worker as string | null) ?? null,
    result: (r.result as Record<string, unknown> | null) ?? null,
    error: (r.error as string | null) ?? null,
    branch: (r.branch as string | null) ?? null,
    commitSha: (r.commit_sha as string | null) ?? null,
    gitStatus: (r.git_status as string | null) ?? null,
    createdAt:
      r.created_at instanceof Date
        ? r.created_at
        : new Date(String(r.created_at)),
    updatedAt:
      r.updated_at instanceof Date
        ? r.updated_at
        : new Date(String(r.updated_at)),
    leaseOwner: (r.lease_owner as string | null) ?? null,
    leaseDeadline: r.lease_deadline
      ? r.lease_deadline instanceof Date
        ? r.lease_deadline
        : new Date(String(r.lease_deadline))
      : null,
    heartbeatAt: r.heartbeat_at
      ? r.heartbeat_at instanceof Date
        ? r.heartbeat_at
        : new Date(String(r.heartbeat_at))
      : null,
    workspacePath: (r.workspace_path as string | null) ?? null,
    prototypeSessionId: (r.prototype_session_id as string | null) ?? null,
    agentId: (r.agent_id as string | null) ?? null,
    tenantId: (r.tenant_id as string | null) ?? undefined,
  };
}

export class TaskIntakeService {
  constructor(private readonly pool: PoolLike | Pool) {}

  async processIntake(
    input: TaskIntakePayload | TaskIntake | Task,
    options?: TaskIntakeOptions,
  ): Promise<AtomicIntakeResult> {
    const rawReq = isTaskIntake(input)
      ? input.rawRequest
      : (input as TaskIntakePayload).rawRequest ||
        (input as TaskIntakePayload).prompt ||
        (input as TaskIntakePayload).objective ||
        'Execute task';
    const intakeSource = isTaskIntake(input)
      ? input.source
      : (input as TaskIntakePayload).source || options?.source || 'pdl-api';
    const intakeCreatedAt = isTaskIntake(input)
      ? input.createdAt
      : typeof (input as TaskIntakePayload).createdAt === 'string'
        ? ((input as TaskIntakePayload).createdAt as string)
        : (input as TaskIntakePayload).createdAt instanceof Date
          ? ((input as TaskIntakePayload).createdAt as Date).toISOString()
          : new Date().toISOString();

    const intake: TaskIntake = isTaskIntake(input)
      ? input
      : normalizeTaskIntake({
          rawRequest: rawReq,
          source: intakeSource,
          createdAt: intakeCreatedAt,
        });

    const combinedOptions: TaskIntakeOptions = {
      ...options,
      project:
        options?.project ??
        (isTaskIntake(input)
          ? undefined
          : (input as TaskIntakePayload).project),
      repository:
        options?.repository ??
        (isTaskIntake(input)
          ? undefined
          : (input as TaskIntakePayload).repository),
      priority:
        options?.priority ??
        (isTaskIntake(input)
          ? undefined
          : (input as TaskIntakePayload).priority),
      branch:
        options?.branch ??
        (isTaskIntake(input)
          ? undefined
          : ((input as TaskIntakePayload).branch ?? undefined)),
      agentId:
        options?.agentId ??
        (isTaskIntake(input)
          ? undefined
          : ((input as TaskIntakePayload).agentId ?? undefined)),
      executionInstructions:
        options?.executionInstructions ??
        (isTaskIntake(input)
          ? undefined
          : (input as TaskIntakePayload).executionInstructions),
      acceptanceCriteria:
        options?.acceptanceCriteria ??
        (isTaskIntake(input)
          ? undefined
          : (input as TaskIntakePayload).acceptanceCriteria),
      validationPlan:
        options?.validationPlan ??
        (isTaskIntake(input)
          ? undefined
          : (input as TaskIntakePayload).validationPlan),
      executionSteps:
        options?.executionSteps ??
        (isTaskIntake(input)
          ? undefined
          : (input as TaskIntakePayload).executionSteps),
      constraints:
        options?.constraints ??
        (isTaskIntake(input)
          ? undefined
          : (input as TaskIntakePayload).constraints),
      context:
        options?.context ??
        (isTaskIntake(input)
          ? undefined
          : (input as TaskIntakePayload).context),
      risks:
        options?.risks ??
        (isTaskIntake(input)
          ? undefined
          : (input as TaskIntakePayload).risks),
      escalationConditions:
        options?.escalationConditions ??
        (isTaskIntake(input)
          ? undefined
          : (input as TaskIntakePayload).escalationConditions),
    };

    let preflightResult: any;
    let enrichedContext: ContextBundle | undefined = combinedOptions.context;

    try {
      const preflightEngine = new PdlPreflightEngine({
        project: combinedOptions.project,
        repository: combinedOptions.repository,
        agentRole: combinedOptions.agentId as any,
      });
      const research = await preflightEngine.run(intake);
      enrichedContext = research.context;
      preflightResult = research.preflight;
    } catch {
      // Safe fallback to canonical static context
    }

    let refinedAcceptanceCriteria = combinedOptions.acceptanceCriteria;
    let refinedValidationPlan = combinedOptions.validationPlan;
    let refinedExecutionSteps = combinedOptions.executionSteps;
    let refinedConstraints = combinedOptions.constraints;
    let refinedInstructions = combinedOptions.executionInstructions;
    let refinedRisks = combinedOptions.risks;
    let refinedEscalations = combinedOptions.escalationConditions;
    let refinedObjective = (!isTaskIntake(input) && (input as TaskIntakePayload).objective)
      ? (input as TaskIntakePayload).objective!
      : undefined;

    if (enrichedContext && preflightResult && (!refinedAcceptanceCriteria || !refinedValidationPlan || !refinedExecutionSteps)) {
      try {
        const refinementEngine = new PdlRefinementEngine();
        const refinedSpec = await refinementEngine.refine(intake, enrichedContext, preflightResult);

        if (!refinedAcceptanceCriteria && Array.isArray(refinedSpec.acceptanceCriteria)) {
          refinedAcceptanceCriteria = refinedSpec.acceptanceCriteria;
        }
        if (!refinedValidationPlan && Array.isArray(refinedSpec.validationPlan)) {
          refinedValidationPlan = refinedSpec.validationPlan;
        }
        if (!refinedExecutionSteps && Array.isArray(refinedSpec.executionSteps)) {
          refinedExecutionSteps = refinedSpec.executionSteps;
        }
        if (!refinedConstraints && Array.isArray(refinedSpec.constraints)) {
          refinedConstraints = refinedSpec.constraints;
        }
        if (!refinedInstructions && Array.isArray(refinedSpec.executionInstructions)) {
          refinedInstructions = refinedSpec.executionInstructions;
        }
        if (!refinedRisks && Array.isArray(refinedSpec.risks)) {
          refinedRisks = refinedSpec.risks;
        }
        if (!refinedEscalations && Array.isArray(refinedSpec.escalationConditions)) {
          refinedEscalations = refinedSpec.escalationConditions;
        }
        if (!refinedObjective && typeof refinedSpec.objective === 'string' && refinedSpec.objective.trim()) {
          refinedObjective = refinedSpec.objective.trim();
        }
      } catch {
        // Safe fallback to canonical static spec
      }
    }

    const spec = buildCanonicalExecutionSpec(intake, {
      ...combinedOptions,
      context: enrichedContext,
      acceptanceCriteria: refinedAcceptanceCriteria,
      validationPlan: refinedValidationPlan,
      executionSteps: refinedExecutionSteps,
      constraints: refinedConstraints,
      executionInstructions: refinedInstructions,
      risks: refinedRisks,
      escalationConditions: refinedEscalations,
    });

    if (refinedObjective) {
      spec.objective = refinedObjective;
    }

    const validation = validateExecutionSpec(spec);
    if (!validation.valid) {
      throw new ExecutionSpecValidationError(validation.errors);
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const taskProject = combinedOptions.project?.trim() || 'pub-dev-loop';
      const taskRepoUrl =
        combinedOptions.repository?.trim() ||
        'https://github.com/pubcoreagencia/pub-dev-loop.git';
      const taskPriority =
        typeof combinedOptions.priority === 'number'
          ? combinedOptions.priority
          : 0;

      const finalObjective =
        !isTaskIntake(input) && (input as TaskIntakePayload).objective
          ? (input as TaskIntakePayload).objective!
          : intake.objective;
      const finalPrompt =
        !isTaskIntake(input) && (input as TaskIntakePayload).prompt
          ? (input as TaskIntakePayload).prompt!
          : intake.rawRequest;

      const taskBranch = combinedOptions.branch?.trim() || null;

      const taskRes = await client.query(
        `INSERT INTO tasks (project, repository, objective, prompt, priority, status, branch)
         VALUES ($1, $2, $3, $4, $5, 'QUEUED', $6)
         RETURNING *`,
        [
          taskProject,
          taskRepoUrl,
          finalObjective,
          finalPrompt,
          taskPriority,
          taskBranch,
        ],
      );

      if (!taskRes.rows || taskRes.rows.length === 0) {
        throw new Error('Failed to create task: no row returned from database');
      }

      const task = mapTaskRow(taskRes.rows[0]);

      await createExecutionSpec(client, task.id, spec);

      const sealedRecord = await sealExecutionSpec(client, task.id, spec);

      await client.query('COMMIT');

      return {
        task,
        executionSpec: sealedRecord,
      };
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch {
      }
      throw error;
    } finally {
      client.release();
    }
  }
}

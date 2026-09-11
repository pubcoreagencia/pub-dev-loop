import { isContextBundle, type ContextBundle } from './context-discovery.js';
import {
  EXECUTION_SPEC_VERSION,
  isExplicitUnknown,
  isExecutionStep,
  isTaskLineage,
  isExecutionSpecMetadata,
  MAX_EXECUTION_SPEC_OBJECTIVE_LENGTH,
  type ExecutionSpec,
  type ExecutionStep,
  type KnownOrUnknown,
  type TaskLineage,
  type ExecutionSpecMetadata,
} from './execution-spec.js';
import type { GovernanceLevel, PermissionSet } from './trust-contracts.js';
import { normalizeTaskIntake, type TaskIntake, type TaskIntakeInput } from './intake.js';
import type { Preflight, PreflightResult } from './preflight.js';
import {
  validateExecutionSpec,
  ExecutionSpecValidationError,
  type ValidationResult,
} from './spec-validator.js';
import { createEvidenceSnapshot, type TrustBoundary, type EvidenceSnapshot, type Evidence, type ExecutionInstruction } from './trust-contracts.js';

export interface RefinementProviderResponse {
  objective?: string | null;
  context?: KnownOrUnknown<ContextBundle> | null;
  constraints?: KnownOrUnknown<string[]> | null;
  acceptanceCriteria?: KnownOrUnknown<string[]> | null;
  validationPlan?: KnownOrUnknown<string[]> | null;
  executionInstructions?: KnownOrUnknown<string[]> | null;
  structuredExecutionInstructions?: KnownOrUnknown<ExecutionInstruction[]> | null;
  executionSteps?: KnownOrUnknown<ExecutionStep[]> | null;
  risks?: KnownOrUnknown<string[]> | null;
  escalationConditions?: KnownOrUnknown<string[]> | null;
  governanceLevel?: GovernanceLevel | null;
  permissions?: PermissionSet | null;
}

export interface RefinementRequest {
  intake: TaskIntake;
  context: ContextBundle;
  preflight: PreflightResult;
  evidenceSnapshot: EvidenceSnapshot;
}

export interface RefinementProvider {
  refine(request: RefinementRequest): Promise<RefinementProviderResponse>;
}

export type RefinementErrorCategory = 'REFINEMENT_FAILED' | 'PREFLIGHT_FAILED';

export class TaskRefinementError extends Error {
  constructor(
    readonly category: RefinementErrorCategory,
    message: string,
    readonly details: string[] = [],
  ) {
    super(message);
    this.name = 'TaskRefinementError';
  }
}

export interface PromptRefinement {
  refine(
    intake: TaskIntake,
    context: ContextBundle,
    preflight: PreflightResult,
    evidenceSnapshot?: EvidenceSnapshot,
  ): Promise<ExecutionSpec>;
}

export class StructuredPromptRefinement implements PromptRefinement {
  constructor(private readonly provider: RefinementProvider) {}

  async refine(
    intake: TaskIntake,
    context: ContextBundle,
    preflight: PreflightResult,
    evidenceSnapshot?: EvidenceSnapshot,
  ): Promise<ExecutionSpec> {
    if (preflight.status === 'FAILED') {
      throw new TaskRefinementError(
        'PREFLIGHT_FAILED',
        'Preflight did not complete successfully',
        preflight.failures.map((failure) => `${failure.category}: ${failure.message}`),
      );
    }

    let response: unknown;
    try {
      response = await this.provider.refine({ intake, context, preflight, evidenceSnapshot: evidenceSnapshot ?? createEvidenceSnapshot({ intakeVersion: '1.0.0', intakeHash: '', source: '', createdAt: '' }, '', '', 0, 'SAFE', { tier: 'TRUSTED_CONTROL', data: null, origin: 'pipeline', canInfluenceGovernance: false, canInfluencePermissions: false, canInfluenceRepositoryTarget: false, canInfluenceExecution: false }) });
    } catch (error) {
      throw new TaskRefinementError('REFINEMENT_FAILED', 'Refinement provider failed', [error instanceof Error ? error.message : String(error)]);
    }

    if (!isRecord(response)) {
      throw new TaskRefinementError('REFINEMENT_FAILED', 'Refinement provider returned a malformed response');
    }

    const objective = response.objective;
    if (typeof objective !== 'string' || objective.trim().length === 0) {
      throw new TaskRefinementError('REFINEMENT_FAILED', 'Refinement response must contain a non-empty objective');
    }

    const governanceLevel = response.governanceLevel === undefined || response.governanceLevel === null
      ? undefined
      : normalizeGovernanceLevel(response.governanceLevel, 'governanceLevel');
    const permissions = response.permissions === undefined || response.permissions === null
      ? undefined
      : normalizePermissions(response.permissions, 'permissions');

    // Only include governanceLevel and permissions if they are known (not ExplicitUnknown)
    return {
      specVersion: EXECUTION_SPEC_VERSION,
      objective: objective.trim(),
      context: normalizeUnknownOr(response.context, 'context'),
      constraints: normalizeUnknownOrStringArray(response.constraints, 'constraints', true),
      acceptanceCriteria: normalizeUnknownOrStringArray(response.acceptanceCriteria, 'acceptanceCriteria', false),
      validationPlan: normalizeUnknownOrStringArray(response.validationPlan, 'validationPlan', false),
      executionInstructions: normalizeUnknownOrStringArray(response.executionInstructions, 'executionInstructions', false),
      executionSteps: normalizeUnknownOrExecutionStepArray(response.executionSteps, 'executionSteps', false),
      risks: normalizeUnknownOrStringArray(response.risks, 'risks', true),
      escalationConditions: normalizeUnknownOrStringArray(response.escalationConditions, 'escalationConditions', false),
      lineage: generateLineage(intake, context),
      metadata: generateMetadata(),
      ...(governanceLevel !== undefined && !isExplicitUnknown(governanceLevel) ? { governanceLevel: governanceLevel as GovernanceLevel } : {}),
      ...(permissions !== undefined && !isExplicitUnknown(permissions) ? { permissions: permissions as PermissionSet } : {}),
    };
  }
}

export interface TaskIntakePipelineDependencies {
  contextDiscovery: import('./context-discovery.js').ContextDiscovery;
  preflight: Preflight;
  refinement: PromptRefinement;
}

export class TaskIntakePipeline {
  constructor(private readonly dependencies: TaskIntakePipelineDependencies) {}

  async run(input: TaskIntakeInput): Promise<ExecutionSpec> {
    const intake = normalizeTaskIntake(input);
    const context = await this.dependencies.contextDiscovery.discover(intake);
    const preflight = await this.dependencies.preflight.run(intake, context);
    const evidenceSnapshot = createEvidenceSnapshot(
      intake.lineage,
      'pdl-v1:',
      'pdl-v1:',
      0,
      'SAFE',
      { tier: 'TRUSTED_CONTROL', data: null, origin: 'preflight', canInfluenceGovernance: false, canInfluencePermissions: false, canInfluenceRepositoryTarget: false, canInfluenceExecution: false },
    );
    const spec = await this.dependencies.refinement.refine(intake, context, preflight, evidenceSnapshot);
    const validation: ValidationResult<ExecutionSpec> = validateExecutionSpec(spec);
    if (!validation.valid) {
      throw new ExecutionSpecValidationError(validation.errors);
    }
    return validation.value;
  }
}

export async function runTaskIntakePipeline(
  input: TaskIntakeInput,
  dependencies: TaskIntakePipelineDependencies,
): Promise<ExecutionSpec> {
  return new TaskIntakePipeline(dependencies).run(input);
}

function generateLineage(intake: TaskIntake, context: ContextBundle): TaskLineage {
  return {
    intakeVersion: intake.intakeVersion,
    intakeHash: intake.lineage.intakeHash,
    source: intake.lineage.source,
    createdAt: intake.lineage.createdAt,
  };
}

function generateMetadata(): ExecutionSpecMetadata {
  const generatedAt = new Date().toISOString();
  return { generatedAt, specHash: `pdl-v1:${generatedAt}` };
}

function normalizeUnknownOr(value: unknown, field: string): KnownOrUnknown<ContextBundle> {
  if (value === null || value === undefined) return unknownFor(field);
  if (isExplicitUnknown(value)) return value;
  if (isContextBundle(value)) return value;
  throw new TaskRefinementError('REFINEMENT_FAILED', `Refinement response field is malformed: ${field}`);
}

function normalizeUnknownOrStringArray(
  value: unknown,
  field: string,
  allowEmpty: boolean,
): KnownOrUnknown<string[]> {
  if (value === null || value === undefined) return unknownFor(field);
  if (isExplicitUnknown(value)) return value;
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) {
    throw new TaskRefinementError('REFINEMENT_FAILED', `Refinement response field is malformed: ${field}`);
  }
  if (!allowEmpty && value.length === 0) {
    throw new TaskRefinementError('REFINEMENT_FAILED', `Refinement response field must not be empty: ${field}`);
  }
  return value.map((item) => item.trim()).filter((item) => item.length > 0);
}

function normalizeUnknownOrExecutionStepArray(
  value: unknown,
  field: string,
  allowEmpty: boolean,
): KnownOrUnknown<ExecutionStep[]> {
  if (value === null || value === undefined) return unknownFor(field);
  if (isExplicitUnknown(value)) return value;
  if (!Array.isArray(value)) {
    throw new TaskRefinementError('REFINEMENT_FAILED', `Refinement response field is malformed: ${field}`);
  }
  if (!allowEmpty && value.length === 0) {
    throw new TaskRefinementError('REFINEMENT_FAILED', `Refinement response field must not be empty: ${field}`);
  }
  const steps = value.map((item) => {
    if (isRecord(item) && typeof item.id === 'string' && typeof item.description === 'string' && typeof item.critical === 'boolean') {
      const step: ExecutionStep = {
        id: item.id,
        description: item.description,
        critical: item.critical,
      };
      if (Array.isArray(item.dependsOn) && item.dependsOn.every((d: unknown) => typeof d === 'string')) {
        step.dependsOn = item.dependsOn as string[];
      }
      if (typeof item.timeoutSeconds === 'number') {
        step.timeoutSeconds = item.timeoutSeconds;
      }
      return step;
    }
    throw new TaskRefinementError('REFINEMENT_FAILED', `Refinement response field is malformed: ${field}`);
  });
  return steps;
}

function normalizeUnknownOrForType<T>(value: unknown, field: string, isValid: (value: unknown) => value is T): KnownOrUnknown<T> {
  if (value === null || value === undefined) return unknownFor(field);
  if (isExplicitUnknown(value)) return value;
  if (isValid(value)) return value as T;
  throw new TaskRefinementError('REFINEMENT_FAILED', `Refinement response field is malformed: ${field}`);
}

function normalizeGovernanceLevel(value: unknown, field: string): KnownOrUnknown<GovernanceLevel> {
  if (value === null || value === undefined) return unknownFor(field);
  if (isExplicitUnknown(value)) return value;
  const governanceLevels: GovernanceLevel[] = ['SYSTEM', 'ADMIN', 'DEVELOPER', 'READONLY'];
  if (typeof value === 'string' && governanceLevels.includes(value as GovernanceLevel)) {
    return value as GovernanceLevel;
  }
  throw new TaskRefinementError('REFINEMENT_FAILED', `Refinement response field is malformed: ${field}`);
}

function normalizePermissions(value: unknown, field: string): KnownOrUnknown<PermissionSet> {
  if (value === null || value === undefined) return unknownFor(field);
  if (isExplicitUnknown(value)) return value;
  if (isRecord(value)) {
    const perms = value as Record<string, unknown>;
    return {
      repositoryRead: typeof perms.repositoryRead === 'boolean' ? perms.repositoryRead : false,
      repositoryWrite: typeof perms.repositoryWrite === 'boolean' ? perms.repositoryWrite : false,
      branchWrite: typeof perms.branchWrite === 'boolean' ? perms.branchWrite : false,
      commit: typeof perms.commit === 'boolean' ? perms.commit : false,
      push: typeof perms.push === 'boolean' ? perms.push : false,
      externalResearch: typeof perms.externalResearch === 'boolean' ? perms.externalResearch : false,
      filesystemWorkspace: typeof perms.filesystemWorkspace === 'boolean' ? perms.filesystemWorkspace : false,
      privilegedOperations: typeof perms.privilegedOperations === 'boolean' ? perms.privilegedOperations : false,
    };
  }
  throw new TaskRefinementError('REFINEMENT_FAILED', `Refinement response field is malformed: ${field}`);
}

function unknownFor(field: string) {
  return { kind: 'UNKNOWN' as const, reason: `No evidence was provided for ${field}` };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
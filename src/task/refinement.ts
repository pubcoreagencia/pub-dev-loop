import { isContextBundle, type ContextBundle } from './context-discovery.js';
import {
  EXECUTION_SPEC_VERSION,
  isExplicitUnknown,
  type ExecutionSpec,
  type KnownOrUnknown,
} from './execution-spec.js';
import { normalizeTaskIntake, type TaskIntake, type TaskIntakeInput } from './intake.js';
import type { Preflight, PreflightResult } from './preflight.js';
import {
  validateExecutionSpec,
  ExecutionSpecValidationError,
  type ValidationResult,
} from './spec-validator.js';

export interface RefinementProviderResponse {
  objective?: string | null;
  context?: KnownOrUnknown<ContextBundle> | null;
  constraints?: KnownOrUnknown<string[]> | null;
  acceptanceCriteria?: KnownOrUnknown<string[]> | null;
  validationPlan?: KnownOrUnknown<string[]> | null;
  executionInstructions?: KnownOrUnknown<string[]> | null;
  risks?: KnownOrUnknown<string[]> | null;
  escalationConditions?: KnownOrUnknown<string[]> | null;
}

export interface RefinementRequest {
  intake: TaskIntake;
  context: ContextBundle;
  preflight: PreflightResult;
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
  ): Promise<ExecutionSpec>;
}

export class StructuredPromptRefinement implements PromptRefinement {
  constructor(private readonly provider: RefinementProvider) {}

  async refine(
    intake: TaskIntake,
    context: ContextBundle,
    preflight: PreflightResult,
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
      response = await this.provider.refine({ intake, context, preflight });
    } catch (error) {
      throw new TaskRefinementError(
        'REFINEMENT_FAILED',
        'Refinement provider failed',
        [error instanceof Error ? error.message : String(error)],
      );
    }

    if (!isRecord(response)) {
      throw new TaskRefinementError('REFINEMENT_FAILED', 'Refinement provider returned a malformed response');
    }

    const objective = response.objective;
    if (typeof objective !== 'string' || objective.trim().length === 0) {
      throw new TaskRefinementError('REFINEMENT_FAILED', 'Refinement response must contain a non-empty objective');
    }

    return {
      specVersion: EXECUTION_SPEC_VERSION,
      objective: objective.trim(),
      context: normalizeUnknownOr(response.context, 'context'),
      constraints: normalizeUnknownOrStringArray(response.constraints, 'constraints', true),
      acceptanceCriteria: normalizeUnknownOrStringArray(response.acceptanceCriteria, 'acceptanceCriteria', false),
      validationPlan: normalizeUnknownOrStringArray(response.validationPlan, 'validationPlan', false),
      executionInstructions: normalizeUnknownOrStringArray(response.executionInstructions, 'executionInstructions', false),
      risks: normalizeUnknownOrStringArray(response.risks, 'risks', true),
      escalationConditions: normalizeUnknownOrStringArray(response.escalationConditions, 'escalationConditions', false),
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
    const spec = await this.dependencies.refinement.refine(intake, context, preflight);
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

function normalizeUnknownOr(
  value: unknown,
  field: string,
): KnownOrUnknown<ContextBundle> {
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

function unknownFor(field: string) {
  return { kind: 'UNKNOWN' as const, reason: `No evidence was provided for ${field}` };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

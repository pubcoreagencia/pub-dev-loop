import { isContextBundle } from './context-discovery.js';
import {
  EXECUTION_SPEC_VERSION,
  isExplicitUnknown,
  MAX_EXECUTION_SPEC_OBJECTIVE_LENGTH,
  type ExecutionSpec,
  type ExecutionStep,
  type TaskLineage,
  type ExecutionSpecMetadata,
} from './execution-spec.js';

export interface ValidationIssue {
  path: string;
  code: string;
  message: string;
}

export type ValidationResult<T> =
  | { valid: true; value: T; errors: [] }
  | { valid: false; errors: ValidationIssue[] };

export class ExecutionSpecValidationError extends Error {
  constructor(readonly issues: ValidationIssue[]) {
    super(`ExecutionSpec validation failed: ${issues.map((issue) => issue.code).join(', ')}`);
    this.name = 'ExecutionSpecValidationError';
  }
}

export function validateExecutionSpec(value: unknown): ValidationResult<ExecutionSpec> {
  const errors: ValidationIssue[] = [];
  if (!isRecord(value)) {
    return { valid: false, errors: [{ path: '$', code: 'SPEC_NOT_OBJECT', message: 'ExecutionSpec must be an object' }] };
  }

  try {
    JSON.stringify(value);
  } catch {
    errors.push({ path: '$', code: 'SPEC_CIRCULAR_REFERENCE', message: 'ExecutionSpec contains a circular reference' });
  }

  if (value.specVersion !== EXECUTION_SPEC_VERSION) {
    errors.push({ path: '$.specVersion', code: 'INVALID_VERSION', message: `Expected ${EXECUTION_SPEC_VERSION}` });
  }
  if (typeof value.objective !== 'string' || value.objective.trim().length === 0 || value.objective.length > MAX_EXECUTION_SPEC_OBJECTIVE_LENGTH) {
    errors.push({ path: '$.objective', code: 'MISSING_OBJECTIVE', message: 'objective must be a non-empty string' });
  }
  validateContext(value.context, '$.context', errors);
  validateStringArrayField(value.constraints, '$.constraints', errors, { allowEmpty: true });
  validateStringArrayField(value.acceptanceCriteria, '$.acceptanceCriteria', errors, { allowEmpty: false });
  validateStringArrayField(value.validationPlan, '$.validationPlan', errors, { allowEmpty: false });
  validateStringArrayField(value.executionInstructions, '$.executionInstructions', errors, { allowEmpty: false });
  validateExecutionStepsField(value.executionSteps, '$.executionSteps', errors, { allowEmpty: false });
  validateStringArrayField(value.risks, '$.risks', errors, { allowEmpty: true });
  validateStringArrayField(value.escalationConditions, '$.escalationConditions', errors, { allowEmpty: false });
  validateLineageField(value.lineage, '$.lineage', errors);
  validateMetadataField(value.metadata, '$.metadata', errors);

  return errors.length === 0
    ? { valid: true, value: value as unknown as ExecutionSpec, errors: [] }
    : { valid: false, errors };
}

export function assertValidExecutionSpec(value: unknown): ExecutionSpec {
  const result = validateExecutionSpec(value);
  if (!result.valid) throw new ExecutionSpecValidationError(result.errors);
  return result.value;
}

function validateContext(
  value: unknown,
  path: string,
  errors: ValidationIssue[],
): void {
  if (isExplicitUnknown(value)) {
    if (value.reason.trim().length === 0) {
      errors.push({ path, code: 'INVALID_UNKNOWN', message: 'Explicit unknown reason must not be empty' });
    }
    return;
  }
  if (!isContextBundle(value)) {
    errors.push({ path, code: 'MISSING_CONTEXT', message: 'context must be a ContextBundle or explicit unknown' });
  }
}

function validateStringArrayField(
  value: unknown,
  path: string,
  errors: ValidationIssue[],
  options: { allowEmpty: boolean },
): void {
  if (isExplicitUnknown(value)) {
    if (value.reason.trim().length === 0) {
      errors.push({ path, code: 'INVALID_UNKNOWN', message: 'Explicit unknown reason must not be empty' });
    }
    return;
  }
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) {
    errors.push({ path, code: 'MALFORMED_FIELD', message: `${path} must be an array of strings or explicit unknown` });
    return;
  }
  if (!options.allowEmpty && value.length === 0) {
    errors.push({ path, code: 'MISSING_REQUIRED_VALUES', message: `${path} must contain at least one value` });
  }
}

function validateExecutionStepsField(
  value: unknown,
  path: string,
  errors: ValidationIssue[],
  options: { allowEmpty: boolean },
): void {
  if (isExplicitUnknown(value)) {
    if (value.reason.trim().length === 0) {
      errors.push({ path, code: 'INVALID_UNKNOWN', message: 'Explicit unknown reason must not be empty' });
    }
    return;
  }
  if (!Array.isArray(value) || !value.every((item) => isExecutionStep(item))) {
    errors.push({ path, code: 'MALFORMED_FIELD', message: `${path} must be an array of ExecutionStep or explicit unknown` });
    return;
  }
  if (!options.allowEmpty && value.length === 0) {
    errors.push({ path, code: 'MISSING_REQUIRED_VALUES', message: `${path} must contain at least one step` });
  }
}

function validateLineageField(
  value: unknown,
  path: string,
  errors: ValidationIssue[],
): void {
  if (value === undefined || value === null) return;
  if (!isExplicitUnknown(value) && !isTaskLineage(value)) {
    errors.push({ path, code: 'MALFORMED_FIELD', message: `${path} must be a TaskLineage or explicit unknown` });
  }
}

function validateMetadataField(
  value: unknown,
  path: string,
  errors: ValidationIssue[],
): void {
  if (value === undefined || value === null) return;
  if (!isExplicitUnknown(value) && !isExecutionSpecMetadata(value)) {
    errors.push({ path, code: 'MALFORMED_FIELD', message: `${path} must be an ExecutionSpecMetadata or explicit unknown` });
  }
}

function isExecutionStep(value: unknown): value is ExecutionStep {
  return isRecord(value) && typeof value.id === 'string' && typeof value.description === 'string' && typeof value.critical === 'boolean';
}

function isTaskLineage(value: unknown): value is TaskLineage {
  return isRecord(value) && typeof value.intakeVersion === 'string' && typeof value.intakeHash === 'string' && typeof value.source === 'string' && typeof value.createdAt === 'string';
}

function isExecutionSpecMetadata(value: unknown): value is ExecutionSpecMetadata {
  return isRecord(value) && typeof value.generatedAt === 'string' && typeof value.specHash === 'string';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

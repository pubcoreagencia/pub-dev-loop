import type { ContextBundle } from './context-discovery.js';

export const EXECUTION_SPEC_VERSION = '1.0.0' as const;
export type ExecutionSpecVersion = typeof EXECUTION_SPEC_VERSION;

export interface ExplicitUnknown {
  kind: 'UNKNOWN';
  reason: string;
}

export type KnownOrUnknown<T> = T | ExplicitUnknown;

export interface ExecutionSpec {
  specVersion: ExecutionSpecVersion;
  objective: string;
  context: KnownOrUnknown<ContextBundle>;
  constraints: KnownOrUnknown<string[]>;
  acceptanceCriteria: KnownOrUnknown<string[]>;
  validationPlan: KnownOrUnknown<string[]>;
  executionInstructions: KnownOrUnknown<string[]>;
  risks: KnownOrUnknown<string[]>;
  escalationConditions: KnownOrUnknown<string[]>;
}

export type ExecutionSpecErrorCategory =
  | 'INVALID_EXECUTION_SPEC'
  | 'EXECUTION_SPEC_SERIALIZATION_FAILED';

export class ExecutionSpecError extends Error {
  constructor(
    readonly category: ExecutionSpecErrorCategory,
    message: string,
    readonly details: string[] = [],
  ) {
    super(message);
    this.name = 'ExecutionSpecError';
  }
}

export function isExplicitUnknown(value: unknown): value is ExplicitUnknown {
  return isRecord(value)
    && value.kind === 'UNKNOWN'
    && typeof value.reason === 'string';
}

export function serializeExecutionSpec(spec: ExecutionSpec): string {
  try {
    return JSON.stringify(spec);
  } catch (error) {
    throw new ExecutionSpecError(
      'EXECUTION_SPEC_SERIALIZATION_FAILED',
      'ExecutionSpec must be serializable',
      [error instanceof Error ? error.message : String(error)],
    );
  }
}

export function deserializeExecutionSpec(serialized: string): ExecutionSpec {
  let value: unknown;
  try {
    value = JSON.parse(serialized) as unknown;
  } catch (error) {
    throw new ExecutionSpecError(
      'INVALID_EXECUTION_SPEC',
      'Serialized ExecutionSpec is not valid JSON',
      [error instanceof Error ? error.message : String(error)],
    );
  }

  if (!isExecutionSpecValue(value)) {
    throw new ExecutionSpecError(
      'INVALID_EXECUTION_SPEC',
      'Serialized value does not satisfy the ExecutionSpec contract',
    );
  }

  return value;
}

export function isExecutionSpecValue(value: unknown): value is ExecutionSpec {
  if (!isRecord(value) || value.specVersion !== EXECUTION_SPEC_VERSION) return false;
  if (typeof value.objective !== 'string' || value.objective.trim().length === 0) return false;
  if (!isContextBundle(value.context) && !isExplicitUnknown(value.context)) return false;
  if (!isStringArray(value.constraints) && !isExplicitUnknown(value.constraints)) return false;
  if (!isStringArray(value.acceptanceCriteria) && !isExplicitUnknown(value.acceptanceCriteria)) return false;
  if (!isStringArray(value.validationPlan) && !isExplicitUnknown(value.validationPlan)) return false;
  if (!isStringArray(value.executionInstructions) && !isExplicitUnknown(value.executionInstructions)) return false;
  if (!isStringArray(value.risks) && !isExplicitUnknown(value.risks)) return false;
  if (!isStringArray(value.escalationConditions) && !isExplicitUnknown(value.escalationConditions)) return false;

  try {
    JSON.stringify(value);
  } catch {
    return false;
  }

  return true;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isContextBundle(value: unknown): value is ContextBundle {
  if (!isRecord(value) || typeof value.version !== 'string') return false;
  if (!isRecordArray(value.authoritativeContext) || !isRecordArray(value.repositoryContext)) return false;
  if (!isRecordArray(value.operationalContext) || !isRecordArray(value.relevantDocumentation)) return false;
  if (!isStringArray(value.knownConstraints) || !isRecordArray(value.limitations)) return false;
  return true;
}

function isRecordArray(value: unknown): value is Record<string, unknown>[] {
  return Array.isArray(value) && value.every(isRecord);
}

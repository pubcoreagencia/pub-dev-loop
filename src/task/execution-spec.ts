import type { ContextBundle } from './context-discovery.js';

export const EXECUTION_SPEC_VERSION = '1.0.0' as const;
export type ExecutionSpecVersion = typeof EXECUTION_SPEC_VERSION;

export const MAX_EXECUTION_SPEC_OBJECTIVE_LENGTH = 4_000;
export const MAX_EXECUTION_STEPS = 100;
export const MAX_EXECUTION_STEP_DESCRIPTION_LENGTH = 2_000;
export const MAX_EXECUTION_STEP_ID_LENGTH = 128;
export const MAX_STRING_ARRAY_LENGTH = 100;
export const MAX_STRING_VALUE_LENGTH = 4_000;
export const MAX_LINEAGE_SOURCE_LENGTH = 200;
export const MAX_SPEC_HASH_LENGTH = 128;

export interface ExplicitUnknown {
  kind: 'UNKNOWN';
  reason: string;
}

export type KnownOrUnknown<T> = T | ExplicitUnknown;

export interface ExecutionStep {
  id: string;
  description: string;
  dependsOn?: string[];
  timeoutSeconds?: number;
  critical: boolean;
}

export interface TaskLineage {
  intakeVersion: '1.0.0';
  intakeHash: string;
  source: string;
  createdAt: string;
}

export interface ExecutionSpecMetadata {
  generatedAt: string;
  specHash: string;
}

export interface ExecutionSpec {
  specVersion: ExecutionSpecVersion;
  objective: string;
  context: KnownOrUnknown<ContextBundle>;
  constraints: KnownOrUnknown<string[]>;
  acceptanceCriteria: KnownOrUnknown<string[]>;
  validationPlan: KnownOrUnknown<string[]>;
  executionInstructions: KnownOrUnknown<string[]>;
  executionSteps: KnownOrUnknown<ExecutionStep[]>;
  risks: KnownOrUnknown<string[]>;
  escalationConditions: KnownOrUnknown<string[]>;
  lineage: TaskLineage;
  metadata: ExecutionSpecMetadata;
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
    && typeof value.reason === 'string'
    && value.reason.trim().length > 0;
}

export function isExecutionStep(value: unknown): value is ExecutionStep {
  if (!isRecord(value)) return false;
  if (typeof value.id !== 'string' || value.id.trim().length === 0 || value.id.length > MAX_EXECUTION_STEP_ID_LENGTH) return false;
  if (typeof value.description !== 'string' || value.description.trim().length === 0 || value.description.length > MAX_EXECUTION_STEP_DESCRIPTION_LENGTH) return false;
  if (typeof value.critical !== 'boolean') return false;
  if (value.dependsOn !== undefined) {
    if (!Array.isArray(value.dependsOn) || value.dependsOn.length > MAX_STRING_ARRAY_LENGTH) return false;
    if (!value.dependsOn.every((item) => typeof item === 'string' && item.trim().length > 0 && item.length <= MAX_EXECUTION_STEP_ID_LENGTH)) return false;
    if (new Set(value.dependsOn).size !== value.dependsOn.length) return false;
  }
  if (value.timeoutSeconds !== undefined) {
    if (typeof value.timeoutSeconds !== 'number' || !Number.isFinite(value.timeoutSeconds) || value.timeoutSeconds <= 0 || value.timeoutSeconds > 86_400) return false;
  }
  return true;
}

export function isTaskLineage(value: unknown): value is TaskLineage {
  return isRecord(value)
    && value.intakeVersion === '1.0.0'
    && typeof value.intakeHash === 'string'
    && value.intakeHash.trim().length > 0
    && value.intakeHash.length <= MAX_SPEC_HASH_LENGTH
    && typeof value.source === 'string'
    && value.source.trim().length > 0
    && value.source.length <= MAX_LINEAGE_SOURCE_LENGTH
    && typeof value.createdAt === 'string'
    && isValidIsoDate(value.createdAt);
}

export function isExecutionSpecMetadata(value: unknown): value is ExecutionSpecMetadata {
  return isRecord(value)
    && typeof value.generatedAt === 'string'
    && isValidIsoDate(value.generatedAt)
    && typeof value.specHash === 'string'
    && value.specHash.trim().length > 0
    && value.specHash.length <= MAX_SPEC_HASH_LENGTH;
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
  if (typeof value.objective !== 'string' || value.objective.trim().length === 0 || value.objective.length > MAX_EXECUTION_SPEC_OBJECTIVE_LENGTH) return false;
  if (!isContextBundle(value.context) && !isExplicitUnknown(value.context)) return false;
  if (!isStringArray(value.constraints, true) && !isExplicitUnknown(value.constraints)) return false;
  if (!isStringArray(value.acceptanceCriteria, false) && !isExplicitUnknown(value.acceptanceCriteria)) return false;
  if (!isStringArray(value.validationPlan, false) && !isExplicitUnknown(value.validationPlan)) return false;
  if (!isStringArray(value.executionInstructions, false) && !isExplicitUnknown(value.executionInstructions)) return false;
  if (!isStringArrayOrUnknown(value.executionSteps, false) && !isExplicitUnknown(value.executionSteps)) return false;
  if (!isStringArray(value.risks, true) && !isExplicitUnknown(value.risks)) return false;
  if (!isStringArray(value.escalationConditions, false) && !isExplicitUnknown(value.escalationConditions)) return false;
  if (!isTaskLineage(value.lineage) || !isExecutionSpecMetadata(value.metadata)) return false;

  try {
    JSON.stringify(value);
  } catch {
    return false;
  }

  return true;
}

export function stableHash(value: string): string {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return `pdl-v1:${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown, allowEmpty: boolean): value is string[] {
  return Array.isArray(value)
    && (allowEmpty || value.length > 0)
    && value.length <= MAX_STRING_ARRAY_LENGTH
    && value.every((item) => typeof item === 'string' && item.trim().length > 0 && item.length <= MAX_STRING_VALUE_LENGTH);
}

function isStringArrayOrUnknown(value: unknown, allowEmpty: boolean): value is KnownOrUnknown<ExecutionStep[]> {
  if (isExplicitUnknown(value)) return true;
  if (!Array.isArray(value)) return false;
  return value.every((item) => typeof item === 'object' && item !== null && isRecord(item) && isExecutionStep(item));
}

function isContextBundle(value: unknown): value is ContextBundle {
  if (!isRecord(value) || value.version !== '1.0.0') return false;
  if (!isRecordArray(value.authoritativeContext) || !isRecordArray(value.repositoryContext)) return false;
  if (!isRecordArray(value.operationalContext) || !isRecordArray(value.relevantDocumentation)) return false;
  if (!isStringArray(value.knownConstraints, true) || !isRecordArray(value.limitations)) return false;
  return true;
}

function isRecordArray(value: unknown): value is Record<string, unknown>[] {
  return Array.isArray(value) && value.every(isRecord);
}

function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return false;
  return Number.isFinite(Date.parse(value));
}
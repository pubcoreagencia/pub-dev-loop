export const TASK_INTAKE_VERSION = '1.0.0' as const;

export type AmbiguityFlag =
  | 'MISSING_REQUESTED_OUTCOME'
  | 'MISSING_CONSTRAINTS'
  | 'AMBIGUOUS_OBJECTIVE';

export interface TaskIntakeInput {
  rawRequest: string;
  source: string;
  createdAt: string;
}

export interface TaskIntake {
  intakeVersion: typeof TASK_INTAKE_VERSION;
  rawRequest: string;
  normalizedRequest: string;
  objective: string;
  constraints: string[];
  requestedOutcome: string | null;
  ambiguityFlags: AmbiguityFlag[];
  source: string;
  createdAt: string;
}

export type TaskIntakeErrorCategory = 'INVALID_TASK';

export class TaskIntakeError extends Error {
  constructor(
    readonly category: TaskIntakeErrorCategory,
    message: string,
    readonly details: string[] = [],
  ) {
    super(message);
    this.name = 'TaskIntakeError';
  }
}

export interface TaskIntakeNormalizer {
  normalize(input: TaskIntakeInput): TaskIntake;
}

export class DefaultTaskIntake implements TaskIntakeNormalizer {
  normalize(input: TaskIntakeInput): TaskIntake {
    return normalizeTaskIntake(input);
  }
}

export function normalizeTaskIntake(input: TaskIntakeInput): TaskIntake {
  if (typeof input?.rawRequest !== 'string') {
    throw new TaskIntakeError('INVALID_TASK', 'rawRequest must be a string');
  }

  const rawRequest = input.rawRequest;
  const normalizedRequest = normalizeRequest(rawRequest);
  if (normalizedRequest.length === 0) {
    throw new TaskIntakeError('INVALID_TASK', 'rawRequest must not be empty or whitespace');
  }

  if (typeof input.source !== 'string' || input.source.trim().length === 0) {
    throw new TaskIntakeError('INVALID_TASK', 'source must not be empty');
  }

  const createdAt = normalizeCreatedAt(input.createdAt);
  const objective = extractObjective(normalizedRequest);
  if (objective.length === 0) {
    throw new TaskIntakeError('INVALID_TASK', 'objective could not be derived from rawRequest');
  }

  const constraints = parseConstraints(normalizedRequest);
  const requestedOutcome = extractRequestedOutcome(normalizedRequest);
  const ambiguityFlags = detectAmbiguityFlags(objective, requestedOutcome, constraints);

  return {
    intakeVersion: TASK_INTAKE_VERSION,
    rawRequest,
    normalizedRequest,
    objective,
    constraints,
    requestedOutcome,
    ambiguityFlags,
    source: input.source.trim(),
    createdAt,
  };
}

export function normalizeRequest(rawRequest: string): string {
  return rawRequest
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function extractObjective(normalizedRequest: string): string {
  const firstLine = normalizedRequest
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.length > 0) ?? '';

  return firstLine
    .replace(/^#{1,6}\s+/, '')
    .replace(/^>\s+/, '')
    .trim();
}

export function parseConstraints(normalizedRequest: string): string[] {
  const constraints: string[] = [];
  for (const line of normalizedRequest.split('\n')) {
    const match = line.match(/^\s*(?:[-*•]|\d+[.)])\s+(.+)$/);
    if (!match) continue;
    const value = match[1]?.trim();
    if (value && !constraints.includes(value)) constraints.push(value);
  }
  return constraints;
}

export function extractRequestedOutcome(normalizedRequest: string): string | null {
  const labels = /(?:requested outcome|requested deliverable|resultado esperado|entreg[aá]vel|definition of done|acceptance criteria|crit[eé]rios de aceite)\s*[:\-]\s*(.*)/i;
  for (const line of normalizedRequest.split('\n')) {
    const match = line.match(labels);
    const value = match?.[1]?.trim();
    if (value) return value;
  }
  return null;
}

export function detectAmbiguityFlags(
  objective: string,
  requestedOutcome: string | null,
  constraints: string[],
): AmbiguityFlag[] {
  const flags: AmbiguityFlag[] = [];
  if (!requestedOutcome) flags.push('MISSING_REQUESTED_OUTCOME');
  if (constraints.length === 0) flags.push('MISSING_CONSTRAINTS');
  if (
    objective.length < 8
    || objective.endsWith('?')
    || /\b(?:maybe|perhaps|etc|talvez|etc)\b/i.test(objective)
  ) {
    flags.push('AMBIGUOUS_OBJECTIVE');
  }
  return flags;
}

function normalizeCreatedAt(createdAt: string): string {
  if (typeof createdAt !== 'string') {
    throw new TaskIntakeError('INVALID_TASK', 'createdAt must be an ISO date string');
  }
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) {
    throw new TaskIntakeError('INVALID_TASK', 'createdAt must be an ISO date string');
  }
  return date.toISOString();
}

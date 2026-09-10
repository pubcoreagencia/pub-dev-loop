import type { TaskIntake } from './intake.js';

export const CONTEXT_BUNDLE_VERSION = '1.0.0' as const;

export interface ContextFact {
  key: string;
  value: string;
  source: string;
}

export interface ContextReference {
  title: string;
  path: string;
  relevance: string;
}

export type ContextLimitationCategory = 'MISSING_CONTEXT' | 'CONTEXT_TRUNCATED';

export interface ContextLimitation {
  category: ContextLimitationCategory;
  message: string;
  source?: string;
}

export interface ContextBundle {
  version: typeof CONTEXT_BUNDLE_VERSION;
  authoritativeContext: ContextFact[];
  repositoryContext: ContextFact[];
  operationalContext: ContextFact[];
  relevantDocumentation: ContextReference[];
  knownConstraints: string[];
  limitations: ContextLimitation[];
}

export interface ContextSource {
  getAuthoritativeContext(intake: TaskIntake): Promise<ContextFact[]>;
  getRepositoryContext(intake: TaskIntake): Promise<ContextFact[]>;
  getOperationalContext(intake: TaskIntake): Promise<ContextFact[]>;
  getRelevantDocumentation(intake: TaskIntake): Promise<ContextReference[]>;
  getKnownConstraints(intake: TaskIntake): Promise<string[]>;
}

export interface ContextDiscovery {
  discover(intake: TaskIntake): Promise<ContextBundle>;
}

export interface BoundedContextDiscoveryOptions {
  maxFactsPerSection?: number;
  maxDocumentationReferences?: number;
  maxConstraintLength?: number;
  maxFactValueLength?: number;
}

export type ContextDiscoveryErrorCategory = 'CONTEXT_UNAVAILABLE';

export class ContextDiscoveryError extends Error {
  constructor(
    readonly category: ContextDiscoveryErrorCategory,
    message: string,
    readonly section?: string,
  ) {
    super(message);
    this.name = 'ContextDiscoveryError';
  }
}

export class BoundedContextDiscovery implements ContextDiscovery {
  constructor(
    private readonly source: ContextSource,
    private readonly options: BoundedContextDiscoveryOptions = {},
  ) {}

  async discover(intake: TaskIntake): Promise<ContextBundle> {
    let authoritativeContext: ContextFact[];
    let repositoryContext: ContextFact[];
    let operationalContext: ContextFact[];
    let relevantDocumentation: ContextReference[];
    let knownConstraints: string[];

    try {
      [
        authoritativeContext,
        repositoryContext,
        operationalContext,
        relevantDocumentation,
        knownConstraints,
      ] = await Promise.all([
        this.source.getAuthoritativeContext(intake),
        this.source.getRepositoryContext(intake),
        this.source.getOperationalContext(intake),
        this.source.getRelevantDocumentation(intake),
        this.source.getKnownConstraints(intake),
      ]);
    } catch (error) {
      throw new ContextDiscoveryError(
        'CONTEXT_UNAVAILABLE',
        error instanceof Error ? error.message : String(error),
      );
    }

    const maxFacts = this.options.maxFactsPerSection ?? 10;
    const maxDocumentation = this.options.maxDocumentationReferences ?? 10;
    const maxConstraintLength = this.options.maxConstraintLength ?? 500;
    const maxFactValueLength = this.options.maxFactValueLength ?? 1_000;

    const boundedAuthoritative = boundedFacts(authoritativeContext, maxFacts, maxFactValueLength);
    const boundedRepository = boundedFacts(repositoryContext, maxFacts, maxFactValueLength);
    const boundedOperational = boundedFacts(operationalContext, maxFacts, maxFactValueLength);
    const boundedDocumentation = boundedReferences(relevantDocumentation, maxDocumentation);
    const boundedConstraints = boundedStrings(knownConstraints, 20, maxConstraintLength);
    const limitations: ContextLimitation[] = [];

    addMissingContextLimitations(limitations, 'authoritativeContext', boundedAuthoritative.length);
    addMissingContextLimitations(limitations, 'repositoryContext', boundedRepository.length);
    addMissingContextLimitations(limitations, 'operationalContext', boundedOperational.length);
    addMissingContextLimitations(limitations, 'relevantDocumentation', boundedDocumentation.length);
    if (boundedConstraints.length === 0) {
      limitations.push({
        category: 'MISSING_CONTEXT',
        message: 'No known constraints were returned by the context source',
        source: 'knownConstraints',
      });
    }
    if (
      boundedAuthoritative.length !== authoritativeContext.length
      || boundedRepository.length !== repositoryContext.length
      || boundedOperational.length !== operationalContext.length
      || boundedDocumentation.length !== relevantDocumentation.length
      || boundedConstraints.length !== knownConstraints.length
    ) {
      limitations.push({
        category: 'CONTEXT_TRUNCATED',
        message: 'One or more context sections exceeded their configured bounds',
      });
    }

    return {
      version: CONTEXT_BUNDLE_VERSION,
      authoritativeContext: boundedAuthoritative,
      repositoryContext: boundedRepository,
      operationalContext: boundedOperational,
      relevantDocumentation: boundedDocumentation,
      knownConstraints: boundedConstraints,
      limitations,
    };
  }
}

export function isContextBundle(value: unknown): value is ContextBundle {
  return typeof value === 'object'
    && value !== null
    && 'version' in value
    && Array.isArray((value as ContextBundle).authoritativeContext)
    && Array.isArray((value as ContextBundle).repositoryContext)
    && Array.isArray((value as ContextBundle).operationalContext)
    && Array.isArray((value as ContextBundle).relevantDocumentation)
    && Array.isArray((value as ContextBundle).knownConstraints)
    && Array.isArray((value as ContextBundle).limitations);
}

function boundedFacts(
  facts: ContextFact[],
  maxFacts: number,
  maxValueLength: number,
): ContextFact[] {
  const seen = new Set<string>();
  const bounded: ContextFact[] = [];
  for (const fact of facts) {
    const key = fact.key.trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    bounded.push({
      key,
      value: truncate(fact.value.trim(), maxValueLength),
      source: fact.source.trim() || 'unknown',
    });
    if (bounded.length >= maxFacts) break;
  }
  return bounded;
}

function boundedReferences(
  references: ContextReference[],
  maxReferences: number,
): ContextReference[] {
  const seen = new Set<string>();
  const bounded: ContextReference[] = [];
  for (const reference of references) {
    const path = reference.path.trim();
    if (!path || seen.has(path)) continue;
    seen.add(path);
    bounded.push({
      title: reference.title.trim(),
      path,
      relevance: reference.relevance.trim(),
    });
    if (bounded.length >= maxReferences) break;
  }
  return bounded;
}

function boundedStrings(values: string[], maxValues: number, maxLength: number): string[] {
  const seen = new Set<string>();
  const bounded: string[] = [];
  for (const value of values) {
    const normalized = truncate(value.trim(), maxLength);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    bounded.push(normalized);
    if (bounded.length >= maxValues) break;
  }
  return bounded;
}

function addMissingContextLimitations(
  limitations: ContextLimitation[],
  section: string,
  count: number,
): void {
  if (count === 0) {
    limitations.push({
      category: 'MISSING_CONTEXT',
      message: `No ${section} was returned by the context source`,
      source: section,
    });
  }
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 1))}…`;
}

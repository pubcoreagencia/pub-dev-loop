import type { ContextBundle } from './context-discovery.js';
import type { TaskIntake } from './intake.js';

export const PREFLIGHT_VERSION = '1.0.0' as const;

export type PreflightCategory =
  | 'REPOSITORY_INSPECTION'
  | 'DOCUMENTATION_LOOKUP'
  | 'SKILL_DISCOVERY'
  | 'EXTERNAL_RESEARCH';

export type PreflightConfidence = 'HIGH' | 'MEDIUM' | 'LOW';

export interface PreflightFinding {
  category: PreflightCategory;
  key: string;
  value: string;
  source: string;
  confidence: PreflightConfidence;
}

export interface ResearchResult {
  findings: PreflightFinding[];
  conflicts?: string[];
}

export interface PreflightFailure {
  category: PreflightFailureCategory;
  message: string;
  source?: string;
}

export type PreflightFailureCategory =
  | 'RESEARCH_UNAVAILABLE'
  | 'RESEARCH_TIMEOUT'
  | 'EMPTY_RESULT'
  | 'CONFLICTING_INFORMATION'
  | 'CAPABILITY_UNAVAILABLE'
  | 'CAPABILITY_TIMEOUT';

export type PreflightStatus = 'COMPLETED' | 'PARTIAL' | 'FAILED';

export interface PreflightCategoryResult {
  category: PreflightCategory;
  status: 'COMPLETED' | 'EMPTY' | 'FAILED';
  findings: PreflightFinding[];
  failure?: PreflightFailure;
}

export interface PreflightResult {
  version: typeof PREFLIGHT_VERSION;
  status: PreflightStatus;
  findings: PreflightFinding[];
  failures: PreflightFailure[];
  warnings: string[];
  categoryResults: PreflightCategoryResult[];
}

export interface RepositoryInspector {
  inspect(intake: TaskIntake, context: ContextBundle): Promise<PreflightFinding[]>;
}

export interface DocumentationLookup {
  lookup(intake: TaskIntake, context: ContextBundle): Promise<PreflightFinding[]>;
}

export interface SkillDiscovery {
  discover(intake: TaskIntake, context: ContextBundle): Promise<PreflightFinding[]>;
}

export interface ExternalResearcher {
  research(
    query: string,
    context: ContextBundle,
    options?: { signal?: AbortSignal },
  ): Promise<ResearchResult>;
}

export interface PreflightDependencies {
  repositoryInspector?: RepositoryInspector;
  documentationLookup?: DocumentationLookup;
  skillDiscovery?: SkillDiscovery;
  externalResearcher?: ExternalResearcher;
}

export interface PreflightOptions {
  categories?: readonly PreflightCategory[];
  externalResearchQueries?: readonly string[];
  timeoutMs?: number;
}

export interface StructuredPreflightOptions {
  timeoutMs?: number;
  maxFindingsPerCategory?: number;
}

export interface Preflight {
  run(
    intake: TaskIntake,
    context: ContextBundle,
    options?: PreflightOptions,
  ): Promise<PreflightResult>;
}

export class PreflightError extends Error {
  constructor(
    readonly category: 'PREFLIGHT_FAILED',
    message: string,
    readonly failures: PreflightFailure[] = [],
  ) {
    super(message);
    this.name = 'PreflightError';
  }
}

export class StructuredPreflight implements Preflight {
  constructor(
    private readonly dependencies: PreflightDependencies = {},
    private readonly options: StructuredPreflightOptions = {},
  ) {}

  async run(
    intake: TaskIntake,
    context: ContextBundle,
    options: PreflightOptions = {},
  ): Promise<PreflightResult> {
    const categories = options.categories ?? [];
    const queries = options.externalResearchQueries ?? [];
    const categoryResults: PreflightCategoryResult[] = [];
    const failures: PreflightFailure[] = [];
    const warnings: string[] = [];

    for (const category of categories) {
      categoryResults.push(await this.runCategory(category, intake, context, queries, options.timeoutMs));
    }

  for (const result of categoryResults) {
      if (result.failure) failures.push(result.failure);
      if (result.status === 'EMPTY') {
        warnings.push(`Preflight category ${result.category} returned no findings`);
      }
    }

    const hasCapabilityFailure = failures.some(
      (f) => f.category === 'CAPABILITY_UNAVAILABLE' || f.category === 'RESEARCH_UNAVAILABLE' || f.category === 'CAPABILITY_TIMEOUT' || f.category === 'RESEARCH_TIMEOUT' || f.category === 'CONFLICTING_INFORMATION',
    );

    const findings = categoryResults.flatMap((result) => result.findings);
    const status: PreflightStatus = hasCapabilityFailure
      ? 'FAILED'
      : failures.length === 0
        ? 'COMPLETED'
        : 'PARTIAL';

    return {
      version: PREFLIGHT_VERSION,
      status,
      findings,
      failures,
      warnings,
      categoryResults,
    };
  }

  private async runCategory(
    category: PreflightCategory,
    intake: TaskIntake,
    context: ContextBundle,
    queries: readonly string[],
    timeoutMs: number | undefined,
  ): Promise<PreflightCategoryResult> {
    const effectiveTimeout = timeoutMs ?? this.options.timeoutMs;
    try {
      if (category === 'EXTERNAL_RESEARCH') {
        if (!this.dependencies.externalResearcher) {
          return this.failed(category, {
            category: 'RESEARCH_UNAVAILABLE',
            message: 'External researcher is not configured',
            source: category,
          });
        }
        if (queries.length === 0) {
          return this.failed(category, {
            category: 'RESEARCH_UNAVAILABLE',
            message: 'No external research query was provided',
            source: category,
          });
        }

        const allFindings: PreflightFinding[] = [];
        const conflicts: string[] = [];
        for (const query of queries) {
          const ac = new AbortController();
          const result = await withTimeout(
            () => this.dependencies.externalResearcher!.research(
              query,
              context,
              { signal: ac.signal },
            ),
            effectiveTimeout,
            'RESEARCH_TIMEOUT',
            () => ac.abort(),
          );
          allFindings.push(...result.findings);
          if (result.conflicts) conflicts.push(...result.conflicts);
        }

        if (conflicts.length > 0) {
          return this.failed(category, {
            category: 'CONFLICTING_INFORMATION',
            message: conflicts.join('; '),
            source: category,
          });
        }
        if (allFindings.length === 0) {
          return this.failed(category, {
            category: 'EMPTY_RESULT',
            message: 'External research returned no findings',
            source: category,
          });
        }
        return this.completed(category, boundedFindings(allFindings, this.options.maxFindingsPerCategory ?? 20));
      }

      const capability = this.capabilityFor(category);
      if (!capability) {
        return this.failed(category, {
          category: 'CAPABILITY_UNAVAILABLE',
          message: `Preflight capability is not configured: ${category}`,
          source: category,
        });
      }

      const findings = await withTimeout(
        () => capability(intake, context),
        effectiveTimeout,
        'CAPABILITY_TIMEOUT',
      );
      if (findings.length === 0) {
        return this.failed(category, {
          category: 'EMPTY_RESULT',
          message: `Preflight category returned no findings: ${category}`,
          source: category,
        });
      }
      return this.completed(category, boundedFindings(findings, this.options.maxFindingsPerCategory ?? 20));
    } catch (error) {
      if (error instanceof CapabilityTimeoutError) {
        return this.failed(category, {
          category: error.category,
          message: error.message,
          source: category,
        });
      }
      return this.failed(category, {
        category: category === 'EXTERNAL_RESEARCH' ? 'RESEARCH_UNAVAILABLE' : 'CAPABILITY_UNAVAILABLE',
        message: error instanceof Error ? error.message : String(error),
        source: category,
      });
    }
  }

  private capabilityFor(
    category: PreflightCategory,
  ): ((intake: TaskIntake, context: ContextBundle) => Promise<PreflightFinding[]>) | null {
    switch (category) {
      case 'REPOSITORY_INSPECTION':
        return this.dependencies.repositoryInspector
          ? (intake, context) => this.dependencies.repositoryInspector!.inspect(intake, context)
          : null;
      case 'DOCUMENTATION_LOOKUP':
        return this.dependencies.documentationLookup
          ? (intake, context) => this.dependencies.documentationLookup!.lookup(intake, context)
          : null;
      case 'SKILL_DISCOVERY':
        return this.dependencies.skillDiscovery
          ? (intake, context) => this.dependencies.skillDiscovery!.discover(intake, context)
          : null;
      case 'EXTERNAL_RESEARCH':
        return null;
    }
  }

  private completed(
    category: PreflightCategory,
    findings: PreflightFinding[],
  ): PreflightCategoryResult {
    return { category, status: 'COMPLETED', findings };
  }

  private failed(
    category: PreflightCategory,
    failure: PreflightFailure,
  ): PreflightCategoryResult {
    return { category, status: failure.category === 'EMPTY_RESULT' ? 'EMPTY' : 'FAILED', findings: [], failure };
  }
}

function boundedFindings(findings: PreflightFinding[], maxFindings: number): PreflightFinding[] {
  const seen = new Set<string>();
  const bounded: PreflightFinding[] = [];
  for (const finding of findings) {
    const key = `${finding.category}:${finding.key}`;
    if (seen.has(key)) continue;
    seen.add(key);
    bounded.push({
      category: finding.category,
      key: finding.key.trim(),
      value: finding.value.trim(),
      source: finding.source.trim() || 'unknown',
      confidence: finding.confidence,
    });
    if (bounded.length >= maxFindings) break;
  }
  return bounded;
}

class CapabilityTimeoutError extends Error {
  constructor(readonly category: PreflightFailureCategory) {
    super(`Preflight capability timed out: ${category}`);
    this.name = 'CapabilityTimeoutError';
  }
}

async function withTimeout<T>(
  operation: () => Promise<T>,
  timeoutMs: number | undefined,
  timeoutCategory: PreflightFailureCategory,
  onTimeout?: () => void,
): Promise<T> {
  if (!timeoutMs || timeoutMs <= 0) return operation();
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      if (onTimeout) onTimeout();
      reject(new CapabilityTimeoutError(timeoutCategory));
    }, timeoutMs);
    operation()
      .then((value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error: unknown) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(error);
      });
  });
}

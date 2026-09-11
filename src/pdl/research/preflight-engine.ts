import type { TaskIntake } from '../../task/intake.js';
import {
  BoundedContextDiscovery,
  type ContextBundle,
} from '../../task/context-discovery.js';
import {
  StructuredPreflight,
  type PreflightResult,
  type PreflightCategory,
} from '../../task/preflight.js';
import { PdlContextSource, type PdlContextSourceOptions } from './context-source.js';
import { PdlRepositoryInspector } from './repository-inspector.js';
import { PdlDocumentationLookup } from './documentation-lookup.js';
import { PdlSkillDiscovery } from './skill-discovery.js';

export interface PreflightEngineResult {
  context: ContextBundle;
  preflight: PreflightResult;
}

export interface PdlPreflightEngineOptions extends PdlContextSourceOptions {
  timeoutMs?: number;
  categories?: readonly PreflightCategory[];
}

/**
 * PdlPreflightEngine — Coordinates BoundedContextDiscovery and StructuredPreflight
 * for the canonical PDL intake pipeline.
 */
export class PdlPreflightEngine {
  private readonly options: PdlPreflightEngineOptions;

  constructor(options: PdlPreflightEngineOptions = {}) {
    this.options = options;
  }

  async run(intake: TaskIntake): Promise<PreflightEngineResult> {
    const source = new PdlContextSource(this.options);
    const discovery = new BoundedContextDiscovery(source, {
      maxFactsPerSection: 20,
      maxDocumentationReferences: 15,
      maxConstraintLength: 500,
    });

    // 1. Discover bounded context bundle
    const context = await discovery.discover(intake);

    // 2. Instantiate preflight inspectors
    const repoInspector = new PdlRepositoryInspector({ workspaceRoot: this.options.workspaceRoot });
    const docLookup = new PdlDocumentationLookup({ workspaceRoot: this.options.workspaceRoot });
    const skillDiscovery = new PdlSkillDiscovery({
      skillEngine: this.options.skillEngine,
      agentRole: this.options.agentRole,
      projectId: this.options.project,
      tenantId: this.options.tenantId,
    });

    const preflightRunner = new StructuredPreflight(
      {
        repositoryInspector: repoInspector,
        documentationLookup: docLookup,
        skillDiscovery,
      },
      {
        timeoutMs: this.options.timeoutMs ?? 5000,
        maxFindingsPerCategory: 20,
      },
    );

    const categories: readonly PreflightCategory[] = this.options.categories ?? [
      'REPOSITORY_INSPECTION',
      'DOCUMENTATION_LOOKUP',
      'SKILL_DISCOVERY',
    ];

    // 3. Execute structured preflight
    const preflight = await preflightRunner.run(intake, context, {
      categories,
      timeoutMs: this.options.timeoutMs ?? 5000,
    });

    // 4. Enrich context bundle with preflight findings
    for (const finding of preflight.findings) {
      if (finding.category === 'DOCUMENTATION_LOOKUP') {
        const alreadyPresent = context.relevantDocumentation.some(
          (doc) => doc.title === finding.key || doc.path === finding.source,
        );
        if (!alreadyPresent) {
          context.relevantDocumentation.push({
            title: finding.key,
            path: finding.source,
            relevance: finding.value,
          });
        }
      } else {
        const alreadyPresent = context.operationalContext.some(
          (f) => f.key === finding.key,
        );
        if (!alreadyPresent) {
          context.operationalContext.push({
            key: finding.key,
            value: finding.value,
            source: finding.source,
          });
        }
      }
    }

    return {
      context,
      preflight,
    };
  }
}

import type { TaskIntake } from '../../task/intake.js';
import type { ContextSource, ContextFact, ContextReference } from '../../task/context-discovery.js';
import { type Evidence, normalizeEvidence } from '../../task/trust-contracts.js';
import { PdlDocumentationLookup } from './documentation-lookup.js';
import { PdlRepositoryInspector } from './repository-inspector.js';
import { DailySkillEngine, defaultDailySkillEngine } from '../../office/skills.js';
import type { OfficeAgentRole } from '../../office/context-assembly.js';

export interface PdlContextSourceOptions {
  project?: string;
  repository?: string;
  workspaceRoot?: string;
  agentRole?: OfficeAgentRole;
  skillEngine?: DailySkillEngine;
  tenantId?: string;
}

/**
 * PdlContextSource — Concrete implementation of ContextSource for BoundedContextDiscovery.
 * Combines authoritative intake facts, repository structure, documentation references,
 * and operational skills.
 */
export class PdlContextSource implements ContextSource {
  private readonly project: string;
  private readonly repository: string;
  private readonly docLookup: PdlDocumentationLookup;
  private readonly repoInspector: PdlRepositoryInspector;
  private readonly skillEngine: DailySkillEngine;
  private readonly agentRole?: OfficeAgentRole;
  private readonly tenantId: string;

  constructor(options: PdlContextSourceOptions = {}) {
    this.project = options.project?.trim() || 'pub-dev-loop';
    this.repository = options.repository?.trim() || 'https://github.com/pubcoreagencia/pub-dev-loop.git';
    this.docLookup = new PdlDocumentationLookup({ workspaceRoot: options.workspaceRoot });
    this.repoInspector = new PdlRepositoryInspector({ workspaceRoot: options.workspaceRoot });
    this.skillEngine = options.skillEngine ?? defaultDailySkillEngine;
    this.agentRole = options.agentRole;
    this.tenantId = options.tenantId ?? 'pub-dev-loop';
  }

  async getAuthoritativeContext(intake: TaskIntake): Promise<ContextFact[]> {
    return [
      { key: 'source', value: intake.source, source: 'intake' },
      { key: 'project', value: this.project, source: 'intake' },
      { key: 'rawRequest', value: intake.rawRequest.slice(0, 500), source: 'intake' },
      { key: 'intakeVersion', value: intake.intakeVersion, source: 'intake' },
      { key: 'intakeHash', value: intake.lineage.intakeHash, source: 'intake' },
    ];
  }

  async getRepositoryContext(intake: TaskIntake): Promise<ContextFact[]> {
    const facts: ContextFact[] = [
      { key: 'repository', value: this.repository, source: 'intake' },
    ];

    try {
      const dummyBundle: any = { version: '1.0.0' };
      const findings = await this.repoInspector.inspect(intake, dummyBundle);
      for (const f of findings) {
        facts.push({
          key: f.key,
          value: f.value,
          source: f.source,
        });
      }
    } catch {
      // Best-effort repository context extraction
    }

    return facts;
  }

  async getOperationalContext(intake: TaskIntake): Promise<ContextFact[]> {
    const facts: ContextFact[] = [];

    const skills = this.agentRole
      ? this.skillEngine.retrieveSkillsForContext(this.agentRole, {
          tenantId: this.tenantId,
          projectId: this.project,
          limit: 5,
        })
      : this.skillEngine.listSkills({
          tenantId: this.tenantId,
          projectId: this.project,
          status: 'ACTIVE',
          limit: 5,
        });

    for (const s of skills) {
      facts.push({
        key: `skill:${s.capability}`,
        value: `${s.name}: ${s.executableGuideline}`,
        source: s.id,
      });
    }

    if (facts.length === 0) {
      facts.push({
        key: 'operational:mode',
        value: 'canonical autonomous execution',
        source: 'runtime',
      });
    }

    return facts;
  }

  async getRelevantDocumentation(_intake: TaskIntake): Promise<ContextReference[]> {
    return this.docLookup.discoverReferences();
  }

  async getKnownConstraints(intake: TaskIntake): Promise<string[]> {
    return intake.constraints.length > 0
      ? [...intake.constraints]
      : ['Follow standard repository conventions and safety invariants'];
  }

  async collectEvidence(intake: TaskIntake): Promise<Evidence[]> {
    return [
      normalizeEvidence({
        source: intake.source,
        sourceType: 'USER_INPUT',
        provenance: intake.lineage.source,
        content: intake.rawRequest,
        collectedAt: intake.lineage.createdAt,
        confidence: 'HIGH',
        trustLevel: 'TRUSTED',
        validationStatus: 'VALIDATED',
        canInfluenceExecution: true,
      }),
    ];
  }
}

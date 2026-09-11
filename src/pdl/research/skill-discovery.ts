import type { TaskIntake } from '../../task/intake.js';
import type { ContextBundle } from '../../task/context-discovery.js';
import type { SkillDiscovery, PreflightFinding } from '../../task/preflight.js';
import { DailySkillEngine, defaultDailySkillEngine, type SkillRecord } from '../../office/skills.js';
import type { OfficeAgentRole } from '../../office/context-assembly.js';

export interface SkillDiscoveryOptions {
  skillEngine?: DailySkillEngine;
  agentRole?: OfficeAgentRole;
  projectId?: string;
  tenantId?: string;
}

/**
 * PdlSkillDiscovery — Discovers active organizational daily skills compiled from institutional lessons
 * and exposes them as preflight findings.
 */
export class PdlSkillDiscovery implements SkillDiscovery {
  private readonly skillEngine: DailySkillEngine;
  private readonly agentRole?: OfficeAgentRole;
  private readonly projectId?: string;
  private readonly tenantId: string;

  constructor(options: SkillDiscoveryOptions = {}) {
    this.skillEngine = options.skillEngine ?? defaultDailySkillEngine;
    this.agentRole = options.agentRole;
    this.projectId = options.projectId;
    this.tenantId = options.tenantId ?? 'pub-dev-loop';
  }

  async discover(intake: TaskIntake, _context: ContextBundle): Promise<PreflightFinding[]> {
    const findings: PreflightFinding[] = [];

    // Query active skills for role and project
    const skills = this.agentRole
      ? this.skillEngine.retrieveSkillsForContext(this.agentRole, {
          tenantId: this.tenantId,
          projectId: this.projectId,
          limit: 10,
        })
      : this.skillEngine.listSkills({
          tenantId: this.tenantId,
          projectId: this.projectId,
          status: 'ACTIVE',
          limit: 10,
        });

    for (const skill of skills) {
      findings.push({
        category: 'SKILL_DISCOVERY',
        key: `skill:${skill.capability}`,
        value: `${skill.name}: ${skill.executableGuideline}`,
        source: skill.id,
        confidence: skill.confidence,
      });
    }

    if (findings.length === 0) {
      findings.push({
        category: 'SKILL_DISCOVERY',
        key: 'skill:baseline',
        value: 'Standard autonomous execution capabilities enabled',
        source: 'daily_skills',
        confidence: 'HIGH',
      });
    }

    return findings;
  }
}

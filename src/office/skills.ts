import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import type { OfficeAgentRole } from './context-assembly.js';
import type { InstitutionalLesson } from './lesson-validation.js';
import type { CandidateScope } from './lesson-candidate.js';

export type SkillStatus = 'DRAFT' | 'ACTIVE' | 'DEPRECATED' | 'BLOCKED';

export interface SkillProvenance {
  tenantId: string;
  projectId?: string;
  createdAt: string;
  updatedAt: string;
  compiledFromLessonId?: string;
  validatedBy?: string;
}

export interface SkillRecord {
  id: string;
  tenantId: string;
  projectId?: string;
  name: string;
  description: string;
  capability: string;
  sourceLessonId?: string;
  sourceExperiences: string[];
  confidence: 'LOW' | 'MEDIUM' | 'HIGH';
  version: number;
  applicableRoles: OfficeAgentRole[];
  applicableContexts: string[];
  limitations: string[];
  executableGuideline: string;
  status: SkillStatus;
  provenance: SkillProvenance;
}

export interface SkillFilter {
  tenantId?: string;
  projectId?: string;
  role?: OfficeAgentRole;
  status?: SkillStatus;
  limit?: number;
}

export class DailySkillEngine {
  private skills: Map<string, SkillRecord> = new Map();
  private pool?: Pool;

  constructor(pool?: Pool) {
    this.pool = pool;
  }

  public setPool(pool: Pool): void {
    this.pool = pool;
  }

  public compileSkillFromLesson(
    lesson: InstitutionalLesson,
    overrides?: Partial<SkillRecord>
  ): SkillRecord {
    if (lesson.status !== 'ACTIVE') {
      throw new Error(`Cannot compile skill from inactive lesson '${lesson.id}' (status: ${lesson.status})`);
    }

    const applicableRoles: OfficeAgentRole[] = this.mapScopeToRoles(lesson.scope);
    const id = `skill-${Date.now()}-${randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();

    const skill: SkillRecord = {
      id,
      tenantId: lesson.tenantId || 'pub-dev-loop',
      projectId: lesson.projectId,
      name: overrides?.name || `Skill: ${lesson.title}`,
      description: overrides?.description || lesson.statement,
      capability: overrides?.capability || this.inferCapability(lesson.scope, lesson.lessonType),
      sourceLessonId: lesson.id,
      sourceExperiences: lesson.supportingMemoryIds || [],
      confidence: overrides?.confidence || 'HIGH',
      version: 1,
      applicableRoles,
      applicableContexts: overrides?.applicableContexts || [lesson.scope],
      limitations: overrides?.limitations || ['Requer validação em tempo de execução', 'Subordinado ao prompt da tarefa atual'],
      executableGuideline: overrides?.executableGuideline || lesson.statement,
      status: 'ACTIVE',
      provenance: {
        tenantId: lesson.tenantId || 'pub-dev-loop',
        projectId: lesson.projectId,
        createdAt: now,
        updatedAt: now,
        compiledFromLessonId: lesson.id,
        validatedBy: (lesson.validation as any)?.validatedBy || (lesson.governance as any)?.validatedBy || 'CEO',
      },
    };

    this.skills.set(skill.id, skill);
    return skill;
  }

  public registerSkill(skill: SkillRecord): SkillRecord {
    if (!skill.id || !skill.tenantId || !skill.name) {
      throw new Error('Invalid skill record: id, tenantId, and name are required');
    }
    this.skills.set(skill.id, skill);
    return skill;
  }

  public getSkill(id: string, tenantId?: string): SkillRecord | undefined {
    const skill = this.skills.get(id);
    if (!skill) return undefined;
    if (tenantId && skill.tenantId !== tenantId) return undefined;
    return skill;
  }

  public listSkills(filter: SkillFilter = {}): SkillRecord[] {
    const { tenantId, projectId, role, status, limit = 50 } = filter;
    const result: SkillRecord[] = [];

    for (const skill of this.skills.values()) {
      if (tenantId && skill.tenantId !== tenantId) continue;
      if (projectId && skill.projectId && skill.projectId !== projectId) continue;
      if (role && !skill.applicableRoles.includes(role)) continue;
      if (status && skill.status !== status) continue;

      result.push(skill);
      if (result.length >= limit) break;
    }

    return result;
  }

  public deprecateSkill(id: string, reason: string, tenantId?: string): SkillRecord {
    const skill = this.getSkill(id, tenantId);
    if (!skill) {
      throw new Error(`Skill '${id}' not found`);
    }

    const updated: SkillRecord = {
      ...skill,
      status: 'DEPRECATED',
      limitations: [...skill.limitations, `Deprecada: ${reason}`],
      provenance: {
        ...skill.provenance,
        updatedAt: new Date().toISOString(),
      },
    };

    this.skills.set(id, updated);
    return updated;
  }

  public retrieveSkillsForContext(
    role: OfficeAgentRole,
    input: { tenantId?: string; projectId?: string; limit?: number } = {}
  ): SkillRecord[] {
    return this.listSkills({
      tenantId: input.tenantId,
      projectId: input.projectId,
      role,
      status: 'ACTIVE',
      limit: input.limit || 5,
    });
  }

  public clear(): void {
    this.skills.clear();
  }

  private mapScopeToRoles(scope: CandidateScope | 'GLOBAL'): OfficeAgentRole[] {
    switch (scope) {
      case 'GLOBAL':
        return ['chief-of-staff', 'architect', 'developer', 'reviewer', 'qa-engineer'];
      case 'PROJECT':
        return ['architect', 'developer', 'reviewer', 'qa-engineer'];
      case 'AGENT':
        return ['developer', 'reviewer', 'qa-engineer'];
      case 'TASK':
      default:
        return ['developer', 'qa-engineer'];
    }
  }

  private inferCapability(scope: CandidateScope | 'GLOBAL', lessonType?: string): string {
    if (lessonType === 'SECURITY_GUIDANCE') return 'SECURITY_ENFORCEMENT';
    if (lessonType === 'ARCHITECTURE_GUIDANCE') return 'ARCHITECTURE_DESIGN';
    if (lessonType === 'TESTING_GUIDANCE') return 'QUALITY_VERIFICATION';
    if (lessonType === 'STRATEGIC_GUIDANCE') return 'STRATEGIC_ORCHESTRATION';

    switch (scope) {
      case 'GLOBAL':
        return 'ORGANIZATIONAL_ORCHESTRATION';
      case 'PROJECT':
        return 'PROJECT_ARCHITECTURE';
      case 'AGENT':
        return 'ROLE_SPECIALIZATION';
      case 'TASK':
      default:
        return 'CODE_IMPLEMENTATION';
    }
  }
}

export const defaultDailySkillEngine = new DailySkillEngine();
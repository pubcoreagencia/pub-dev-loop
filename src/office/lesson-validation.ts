import type { Pool } from 'pg';
import type { OfficePrincipal } from './auth.js';
import type { LessonCandidate, CandidateScope } from './lesson-candidate.js';
import { OfficeEventBus, defaultOfficeEventBus } from './events.js';

export type InstitutionalLessonStatus = 'ACTIVE' | 'SUPERSEDED' | 'BLOCKED' | 'REVOKED';

export type InstitutionalLessonType =
  | 'OPERATIONAL_GUIDANCE'
  | 'TESTING_GUIDANCE'
  | 'ARCHITECTURE_GUIDANCE'
  | 'SECURITY_GUIDANCE'
  | 'STRATEGIC_GUIDANCE';

export type LessonTemporalValidity =
  | 'CURRENT'
  | 'HISTORICAL'
  | 'SUPERSEDED'
  | 'OBSOLETE'
  | 'BLOCKED'
  | 'CONTEXT_DEPENDENT';

export interface InstitutionalLesson {
  id: string;
  tenantId: string;
  projectId: string;
  candidateId: string;
  status: InstitutionalLessonStatus;
  title: string;
  statement: string;
  scope: CandidateScope | 'GLOBAL';
  lessonType: InstitutionalLessonType;
  sourceCandidateIds: string[];
  supportingPatternIds: string[];
  supportingMemoryIds: string[];
  supportingEventIds: string[];
  supportingTaskIds: string[];
  provenance: Record<string, any>;
  governance: Record<string, any>;
  validation: Record<string, any>;
  temporalValidity: LessonTemporalValidity;
  supersededBy?: string;
  createdAt: string;
  validatedAt: string;
  updatedAt: string;
}

export interface GovernanceRequirement {
  requiresCEOApproval: boolean;
  targetLessonType: InstitutionalLessonType;
  targetScope: CandidateScope | 'GLOBAL';
  rationale: string;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
  requirement: GovernanceRequirement;
}

/**
 * Deterministic Lesson Validation Engine.
 * Enforces governance boundaries between candidate hypotheses and authorized institutional lessons.
 */
export class LessonValidationEngine {
  private lessons = new Map<string, InstitutionalLesson>();
  private pool?: Pool;

  constructor(
    private readonly eventBus: OfficeEventBus = defaultOfficeEventBus,
    pool?: Pool
  ) {
    this.pool = pool;
  }

  setPool(pool: Pool): void {
    this.pool = pool;
  }

  determineGovernanceRequirement(candidate: LessonCandidate): GovernanceRequirement {
    if (candidate.candidateType === 'SECURITY_GUIDANCE') {
      return {
        requiresCEOApproval: true,
        targetLessonType: 'SECURITY_GUIDANCE',
        targetScope: candidate.scope,
        rationale: 'Diretrizes de segurança exigem aprovação explícita e autoritativa do CEO.',
      };
    }

    if (candidate.candidateType === 'ARCHITECTURE_GUIDANCE') {
      return {
        requiresCEOApproval: true,
        targetLessonType: 'ARCHITECTURE_GUIDANCE',
        targetScope: candidate.scope,
        rationale: 'Diretrizes arquiteturais exigem aprovação explícita do CEO.',
      };
    }

    if ((candidate.scope as string) === 'GLOBAL') {
      return {
        requiresCEOApproval: true,
        targetLessonType: 'STRATEGIC_GUIDANCE',
        targetScope: 'GLOBAL',
        rationale: 'Escopo global corporativo exige aprovação direta do CEO.',
      };
    }

    if (candidate.candidateType === 'TESTING_PRACTICE') {
      return {
        requiresCEOApproval: false,
        targetLessonType: 'TESTING_GUIDANCE',
        targetScope: candidate.scope,
        rationale: 'Práticas de teste podem ser validadas operacionalmente no escopo do projeto.',
      };
    }

    return {
      requiresCEOApproval: false,
      targetLessonType: 'OPERATIONAL_GUIDANCE',
      targetScope: candidate.scope,
      rationale: 'Heurísticas operacionais com remediação comprovada são validadas deterministamente.',
    };
  }

  validateCandidate(candidate: LessonCandidate): ValidationResult {
    const requirement = this.determineGovernanceRequirement(candidate);

    if (candidate.status === 'BLOCKED') {
      return {
        valid: false,
        error: 'BLOCKED_CANDIDATE: Candidato está sob bloqueio/quarentena e não pode ser validado.',
        requirement,
      };
    }

    if (candidate.status === 'REJECTED') {
      return {
        valid: false,
        error: 'REJECTED_CANDIDATE: Candidato foi rejeitado previamente.',
        requirement,
      };
    }

    if (candidate.status !== 'ELIGIBLE') {
      return {
        valid: false,
        error: `INELIGIBLE_CANDIDATE: Candidato não atende aos critérios de elegibilidade (status atual: ${candidate.status}).`,
        requirement,
      };
    }

    if (candidate.contradictionStatus === 'CONTRADICTORY_UNRESOLVED') {
      return {
        valid: false,
        error: 'ACTIVE_CONTRADICTION: Candidato possui contradição ativa não resolvida.',
        requirement,
      };
    }

    if (!candidate.provenance || !candidate.provenance.patternId) {
      return {
        valid: false,
        error: 'MISSING_PROVENANCE: Grafo de proveniência incompleto.',
        requirement,
      };
    }

    return { valid: true, requirement };
  }

  /**
   * Validates and institutionalizes an operational/testing candidate deterministically.
   */
  async validateAndInstitutionalizeOperational(
    candidate: LessonCandidate,
    actor: OfficePrincipal
  ): Promise<InstitutionalLesson> {
    const check = this.validateCandidate(candidate);
    if (!check.valid) {
      throw new Error(check.error || 'INVALID_CANDIDATE: Validação falhou.');
    }

    if (check.requirement.requiresCEOApproval) {
      throw new Error('GOVERNANCE_RESTRICTION: Candidato requer aprovação executiva do CEO.');
    }

    const lesson = await this.createLessonRecord(candidate, check.requirement, {
      validatedBy: actor.userId,
      validatedRole: actor.role,
      approvalType: 'DETERMINISTIC_GOVERNANCE',
    });

    return lesson;
  }

  /**
   * Approves and institutionalizes a candidate requiring CEO Governance.
   */
  async approveAndInstitutionalizeByCEO(
    candidate: LessonCandidate,
    ceoPrincipal: OfficePrincipal,
    options?: { customStatement?: string; targetScope?: CandidateScope | 'GLOBAL' }
  ): Promise<InstitutionalLesson> {
    if (ceoPrincipal.role !== 'CEO') {
      throw new Error('FORBIDDEN: Somente o CEO autenticado pode aprovar candidatos governados.');
    }

    if (candidate.tenantId !== (ceoPrincipal.tenantId || 'pub-dev-loop')) {
      throw new Error('TENANT_MISMATCH: Tentativa de aprovação cross-tenant rejeitada.');
    }

    const check = this.validateCandidate(candidate);
    if (!check.valid) {
      throw new Error(check.error || 'INVALID_CANDIDATE: Candidato não elegível.');
    }

    const now = new Date().toISOString();
    const req = check.requirement;
    if (options?.targetScope) {
      req.targetScope = options.targetScope;
    }

    const lesson = await this.createLessonRecord(candidate, req, {
      approvedBy: ceoPrincipal.userId,
      approvedRole: 'CEO',
      approvedAt: now,
      approvalType: 'EXECUTIVE_CEO_APPROVAL',
      customStatement: options?.customStatement,
    });

    this.eventBus.publish({
      type: 'APPROVAL_GRANTED',
      actorId: ceoPrincipal.userId,
      project: candidate.projectId,
      summary: `CEO aprovou lição institucional: ${lesson.title}`,
      payload: { lessonId: lesson.id, candidateId: candidate.id },
    });

    return lesson;
  }

  /**
   * Rejects a candidate explicitly.
   */
  async rejectCandidate(
    candidate: LessonCandidate,
    actor: OfficePrincipal,
    reason: string
  ): Promise<boolean> {
    candidate.status = 'REJECTED';
    candidate.rejectionReason = reason;
    candidate.updatedAt = new Date().toISOString();

    this.eventBus.publish({
      type: 'APPROVAL_REJECTED',
      actorId: actor.userId,
      project: candidate.projectId,
      summary: `Candidato rejeitado: ${candidate.title}`,
      payload: { candidateId: candidate.id, reason },
    });

    return true;
  }

  /**
   * Supersedes an existing lesson with a newer institutional lesson.
   */
  async supersedeLesson(
    oldLessonId: string,
    newLessonId: string,
    actor: OfficePrincipal,
    reason: string
  ): Promise<boolean> {
    const oldLesson = this.lessons.get(oldLessonId);
    const newLesson = this.lessons.get(newLessonId);

    if (!oldLesson || !newLesson) return false;
    if (oldLesson.tenantId !== newLesson.tenantId) return false;
    if (oldLesson.id === newLesson.id) return false;

    // Strategic, Security and Architecture supersession requires CEO
    if (
      (oldLesson.lessonType === 'STRATEGIC_GUIDANCE' ||
        oldLesson.lessonType === 'SECURITY_GUIDANCE' ||
        oldLesson.lessonType === 'ARCHITECTURE_GUIDANCE') &&
      actor.role !== 'CEO'
    ) {
      throw new Error('FORBIDDEN: Supersessão de lição estratégica/arquitetural/segurança exige CEO.');
    }

    oldLesson.status = 'SUPERSEDED';
    oldLesson.temporalValidity = 'SUPERSEDED';
    oldLesson.supersededBy = newLessonId;
    oldLesson.updatedAt = new Date().toISOString();

    if (this.pool) {
      try {
        await this.pool.query(
          `UPDATE institutional_lessons SET
            status = 'SUPERSEDED',
            temporal_validity = 'SUPERSEDED',
            superseded_by = $1,
            updated_at = now()
          WHERE id = $2 AND tenant_id = $3`,
          [newLessonId, oldLessonId, oldLesson.tenantId]
        );
      } catch (err: any) {
        console.error('[LessonValidationEngine] Notice: Failed to supersede lesson in DB:', err.message);
      }
    }

    return true;
  }

  /**
   * Revokes an existing lesson.
   */
  async revokeLesson(lessonId: string, actor: OfficePrincipal, reason: string): Promise<boolean> {
    if (actor.role !== 'CEO') {
      throw new Error('FORBIDDEN: Revogação de lição institucional exige CEO.');
    }

    const lesson = this.lessons.get(lessonId);
    if (!lesson) return false;

    lesson.status = 'REVOKED';
    lesson.temporalValidity = 'OBSOLETE';
    lesson.updatedAt = new Date().toISOString();

    if (this.pool) {
      try {
        await this.pool.query(
          `UPDATE institutional_lessons SET status = 'REVOKED', temporal_validity = 'OBSOLETE', updated_at = now() WHERE id = $1`,
          [lessonId]
        );
      } catch (err: any) {
        console.error('[LessonValidationEngine] Notice: Failed to revoke lesson in DB:', err.message);
      }
    }

    return true;
  }

  async getLessonById(id: string, projectId: string, tenantId = 'pub-dev-loop'): Promise<InstitutionalLesson | null> {
    const lesson = this.lessons.get(id);
    if (!lesson) return null;
    if (lesson.tenantId !== tenantId || lesson.projectId !== projectId) return null;
    return lesson;
  }

  async listLessons(
    projectId: string,
    tenantId = 'pub-dev-loop',
    status: InstitutionalLessonStatus = 'ACTIVE'
  ): Promise<InstitutionalLesson[]> {
    return Array.from(this.lessons.values()).filter(
      (l) => l.tenantId === tenantId && l.projectId === projectId && l.status === status
    );
  }

  private async createLessonRecord(
    candidate: LessonCandidate,
    req: GovernanceRequirement,
    govInfo: Record<string, any>
  ): Promise<InstitutionalLesson> {
    const id = `inst-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const now = new Date().toISOString();

    const lesson: InstitutionalLesson = {
      id,
      tenantId: candidate.tenantId,
      projectId: candidate.projectId,
      candidateId: candidate.id,
      status: 'ACTIVE',
      title: candidate.title,
      statement: govInfo.customStatement || candidate.statement,
      scope: req.targetScope,
      lessonType: req.targetLessonType,
      sourceCandidateIds: [candidate.id],
      supportingPatternIds: candidate.supportingPatternIds,
      supportingMemoryIds: candidate.supportingMemoryIds,
      supportingEventIds: candidate.supportingEventIds,
      supportingTaskIds: candidate.supportingTaskIds,
      provenance: {
        candidateId: candidate.id,
        patternId: candidate.patternId,
        projectId: candidate.projectId,
        verifiedAt: now,
        epistemicStatus: 'DECIDED',
      },
      governance: govInfo,
      validation: {
        requirement: req,
        validatedAt: now,
      },
      temporalValidity: 'CURRENT',
      createdAt: now,
      validatedAt: now,
      updatedAt: now,
    };

    this.lessons.set(id, lesson);

    if (this.pool) {
      try {
        await this.pool.query(
          `INSERT INTO institutional_lessons (
            id, tenant_id, project_id, candidate_id, status, title, statement, scope,
            lesson_type, source_candidate_ids, supporting_pattern_ids, supporting_memory_ids,
            supporting_event_ids, supporting_task_ids, provenance, governance, validation,
            temporal_validity, created_at, validated_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
          ON CONFLICT (tenant_id, project_id, candidate_id)
          DO UPDATE SET
            statement = EXCLUDED.statement,
            governance = EXCLUDED.governance,
            updated_at = now()`,
          [
            lesson.id,
            lesson.tenantId,
            lesson.projectId,
            lesson.candidateId,
            lesson.status,
            lesson.title,
            lesson.statement,
            lesson.scope,
            lesson.lessonType,
            JSON.stringify(lesson.sourceCandidateIds),
            JSON.stringify(lesson.supportingPatternIds),
            JSON.stringify(lesson.supportingMemoryIds),
            JSON.stringify(lesson.supportingEventIds),
            JSON.stringify(lesson.supportingTaskIds),
            JSON.stringify(lesson.provenance),
            JSON.stringify(lesson.governance),
            JSON.stringify(lesson.validation),
            lesson.temporalValidity,
            lesson.createdAt,
            lesson.validatedAt,
            lesson.updatedAt,
          ]
        );
      } catch (err: any) {
        console.error('[LessonValidationEngine] Notice: Failed to insert institutional lesson in DB:', err.message);
      }
    }

    return lesson;
  }
}

export const defaultLessonValidationEngine = new LessonValidationEngine();

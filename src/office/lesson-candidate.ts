import type { Pool } from 'pg';
import type { OrganizationalPattern } from './pattern-detection.js';

export type CandidateStatus = 'PROPOSED' | 'ELIGIBLE' | 'BLOCKED' | 'REJECTED' | 'SUPERSEDED';

export type CandidateType =
  | 'OPERATIONAL_PRACTICE'
  | 'FAILURE_PATTERN'
  | 'REMEDIATION_PATTERN'
  | 'TESTING_PRACTICE'
  | 'ARCHITECTURE_GUIDANCE'
  | 'SECURITY_GUIDANCE';

export type CandidateScope = 'PROJECT' | 'AGENT' | 'TASK';

export type CandidateContradictionStatus = 'CLEAN' | 'CONTEXT_DEPENDENT' | 'CONTRADICTORY_UNRESOLVED';

export interface EligibilityEvaluation {
  isEligible: boolean;
  reasons: string[];
  independentTaskCount: number;
  hasRemediation: boolean;
  hasReviewerConfirmation: boolean;
  hasQaConfirmation: boolean;
  isContradictionFree: boolean;
  requiresCEOApproval: boolean;
}

export interface LessonCandidate {
  id: string;
  tenantId: string;
  projectId: string;
  patternId: string;
  candidateKey: string;
  status: CandidateStatus;
  title: string;
  statement: string;
  scope: CandidateScope;
  candidateType: CandidateType;
  supportingPatternIds: string[];
  supportingMemoryIds: string[];
  supportingEventIds: string[];
  supportingTaskIds: string[];
  supportingAgentIds: string[];
  evidence: Record<string, any>;
  corroboration: Record<string, any>;
  remediation: Record<string, any>;
  contradictionStatus: CandidateContradictionStatus;
  provenance: Record<string, any>;
  eligibility: EligibilityEvaluation;
  requiresCEOApproval: boolean;
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Generates an objective, non-overclaiming evidence statement for candidates.
 */
export function generateSafeCandidateStatement(input: {
  component: string;
  ruleId?: string;
  finding?: string;
  remediation?: string;
  taskCount: number;
}): string {
  const comp = input.component || 'general';
  const rule = input.ruleId ? ` (Regra: ${input.ruleId})` : '';
  const rem = input.remediation ? ` Remediação comprovada: ${input.remediation}.` : '';
  return `Observação verificada em ${comp}${rule}: identificada em ${input.taskCount} tarefas independentes com remediação.${rem}`;
}

/**
 * Evaluates candidate eligibility deterministically.
 */
export function evaluateCandidateEligibility(
  pattern: OrganizationalPattern,
  candidateType: CandidateType,
  contradictionStatus: CandidateContradictionStatus = 'CLEAN'
): EligibilityEvaluation {
  const reasons: string[] = [];
  const c = pattern.corroboration;
  const independentTaskCount = c.independentTaskCount || 0;
  const hasRemediation = (c.remediationVerifiedCount || 0) >= 1;
  const hasReviewerConfirmation = (c.reviewerConfirmedCount || 0) >= 1;
  const hasQaConfirmation = (c.qaConfirmedCount || 0) >= 1;
  const isContradictionFree = contradictionStatus !== 'CONTRADICTORY_UNRESOLVED';
  const requiresCEOApproval =
    candidateType === 'ARCHITECTURE_GUIDANCE' || candidateType === 'SECURITY_GUIDANCE';

  if (independentTaskCount < 3) {
    reasons.push(`INSUFFICIENT_TASKS: Requer no mínimo 3 tarefas independentes (atual: ${independentTaskCount}).`);
  }

  if (!hasRemediation) {
    reasons.push('MISSING_REMEDIATION: Requer ciclo comprovado de remediação bem-sucedida.');
  }

  if (!hasReviewerConfirmation && !hasQaConfirmation) {
    reasons.push('MISSING_CONFIRMATION: Requer confirmação por Reviewer ou QA.');
  }

  if (!isContradictionFree) {
    reasons.push('ACTIVE_CONTRADICTION: Presença de contradição não resolvida.');
  }

  if (pattern.status === 'BLOCKED') {
    reasons.push('BLOCKED_EVIDENCE: O padrão de origem está sob quarentena/bloqueio.');
  }

  const isEligible = reasons.length === 0;

  return {
    isEligible,
    reasons,
    independentTaskCount,
    hasRemediation,
    hasReviewerConfirmation,
    hasQaConfirmation,
    isContradictionFree,
    requiresCEOApproval,
  };
}

/**
 * Deterministic Lesson Candidate Engine.
 * Derives auditable LESSON_CANDIDATE hypotheses from corroborated patterns.
 * STRICT NON-GOAL: Does NOT institutionalize knowledge or modify agent prompt contexts.
 */
export class LessonCandidateEngine {
  private candidates = new Map<string, LessonCandidate>();
  private pool?: Pool;

  constructor(pool?: Pool) {
    this.pool = pool;
  }

  setPool(pool: Pool): void {
    this.pool = pool;
  }

  async evaluateAndUpsertCandidate(
    pattern: OrganizationalPattern,
    contradictionStatus: CandidateContradictionStatus = 'CLEAN'
  ): Promise<LessonCandidate | null> {
    const tenantId = pattern.tenantId || 'pub-dev-loop';
    const projectId = pattern.projectId;
    if (!projectId) return null;

    const candidateKey = `${tenantId}:${projectId}:${pattern.signature}`;
    const existing = this.candidates.get(candidateKey);

    // Determine candidate type based on rule and component
    let candidateType: CandidateType = 'OPERATIONAL_PRACTICE';
    if (pattern.ruleId?.startsWith('RULE_SEC_') || pattern.ruleId?.includes('AUTH')) {
      candidateType = 'SECURITY_GUIDANCE';
    } else if (
      pattern.component.includes('arch') ||
      pattern.component.includes('schema') ||
      pattern.component.includes('migration')
    ) {
      candidateType = 'ARCHITECTURE_GUIDANCE';
    } else if (pattern.taskType.includes('test') || pattern.taskType.includes('qa')) {
      candidateType = 'TESTING_PRACTICE';
    }

    const eligibility = evaluateCandidateEligibility(pattern, candidateType, contradictionStatus);

    let status: CandidateStatus = 'PROPOSED';
    if (pattern.status === 'BLOCKED') {
      status = 'BLOCKED';
    } else if (existing?.status === 'REJECTED') {
      status = 'REJECTED';
    } else if (existing?.status === 'BLOCKED') {
      status = 'BLOCKED';
    } else if (eligibility.isEligible) {
      status = 'ELIGIBLE';
    } else {
      status = 'PROPOSED';
    }

    const statement = generateSafeCandidateStatement({
      component: pattern.component,
      ruleId: pattern.ruleId,
      remediation: pattern.remediationSignature,
      taskCount: pattern.corroboration.independentTaskCount,
    });

    const now = new Date().toISOString();

    if (existing) {
      existing.status = status;
      existing.statement = statement;
      existing.supportingPatternIds = [pattern.id];
      existing.supportingMemoryIds = pattern.supportingMemoryIds;
      existing.supportingEventIds = pattern.supportingEventIds;
      existing.supportingTaskIds = pattern.supportingTaskIds;
      existing.supportingAgentIds = pattern.supportingAgentIds;
      existing.corroboration = pattern.corroboration;
      existing.contradictionStatus = contradictionStatus;
      existing.eligibility = eligibility;
      existing.requiresCEOApproval = eligibility.requiresCEOApproval;
      existing.updatedAt = now;

      if (this.pool) {
        try {
          await this.pool.query(
            `UPDATE lesson_candidates SET
              status = $1,
              statement = $2,
              supporting_pattern_ids = $3,
              supporting_memory_ids = $4,
              supporting_event_ids = $5,
              supporting_task_ids = $6,
              supporting_agent_ids = $7,
              corroboration = $8,
              contradiction_status = $9,
              eligibility = $10,
              requires_ceo_approval = $11,
              updated_at = now()
            WHERE tenant_id = $12 AND project_id = $13 AND candidate_key = $14`,
            [
              existing.status,
              existing.statement,
              JSON.stringify(existing.supportingPatternIds),
              JSON.stringify(existing.supportingMemoryIds),
              JSON.stringify(existing.supportingEventIds),
              JSON.stringify(existing.supportingTaskIds),
              JSON.stringify(existing.supportingAgentIds),
              JSON.stringify(existing.corroboration),
              existing.contradictionStatus,
              JSON.stringify(existing.eligibility),
              existing.requiresCEOApproval,
              tenantId,
              projectId,
              candidateKey,
            ]
          );
        } catch (err: any) {
          console.error('[LessonCandidateEngine] Notice: Failed to update candidate in DB:', err.message);
        }
      }

      return existing;
    }

    const id = `cand-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    const candidate: LessonCandidate = {
      id,
      tenantId,
      projectId,
      patternId: pattern.id,
      candidateKey,
      status,
      title: `Candidato a Lição: ${pattern.ruleId || pattern.component}`,
      statement,
      scope: 'PROJECT',
      candidateType,
      supportingPatternIds: [pattern.id],
      supportingMemoryIds: pattern.supportingMemoryIds,
      supportingEventIds: pattern.supportingEventIds,
      supportingTaskIds: pattern.supportingTaskIds,
      supportingAgentIds: pattern.supportingAgentIds,
      evidence: {
        patternSignature: pattern.signature,
        component: pattern.component,
        ruleId: pattern.ruleId,
      },
      corroboration: pattern.corroboration,
      remediation: {
        remediationSignature: pattern.remediationSignature,
      },
      contradictionStatus,
      provenance: {
        patternId: pattern.id,
        projectId,
        verifiedAt: now,
        epistemicStatus: 'DERIVED',
      },
      eligibility,
      requiresCEOApproval: eligibility.requiresCEOApproval,
      createdAt: now,
      updatedAt: now,
    };

    this.candidates.set(candidateKey, candidate);

    if (this.pool) {
      try {
        await this.pool.query(
          `INSERT INTO lesson_candidates (
            id, tenant_id, project_id, pattern_id, candidate_key, status, title,
            statement, scope, candidate_type, supporting_pattern_ids, supporting_memory_ids,
            supporting_event_ids, supporting_task_ids, supporting_agent_ids, evidence,
            corroboration, remediation, contradiction_status, provenance, eligibility,
            requires_ceo_approval, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)
          ON CONFLICT (tenant_id, project_id, candidate_key)
          DO UPDATE SET
            status = EXCLUDED.status,
            statement = EXCLUDED.statement,
            corroboration = EXCLUDED.corroboration,
            eligibility = EXCLUDED.eligibility,
            updated_at = now()`,
          [
            candidate.id,
            candidate.tenantId,
            candidate.projectId,
            candidate.patternId,
            candidate.candidateKey,
            candidate.status,
            candidate.title,
            candidate.statement,
            candidate.scope,
            candidate.candidateType,
            JSON.stringify(candidate.supportingPatternIds),
            JSON.stringify(candidate.supportingMemoryIds),
            JSON.stringify(candidate.supportingEventIds),
            JSON.stringify(candidate.supportingTaskIds),
            JSON.stringify(candidate.supportingAgentIds),
            JSON.stringify(candidate.evidence),
            JSON.stringify(candidate.corroboration),
            JSON.stringify(candidate.remediation),
            candidate.contradictionStatus,
            JSON.stringify(candidate.provenance),
            JSON.stringify(candidate.eligibility),
            candidate.requiresCEOApproval,
            candidate.createdAt,
            candidate.updatedAt,
          ]
        );
      } catch (err: any) {
        console.error('[LessonCandidateEngine] Notice: Failed to insert candidate in DB:', err.message);
      }
    }

    return candidate;
  }

  async getById(id: string, projectId: string, tenantId = 'pub-dev-loop'): Promise<LessonCandidate | null> {
    return (
      Array.from(this.candidates.values()).find(
        (c) => c.id === id && c.projectId === projectId && c.tenantId === tenantId
      ) || null
    );
  }

  async getByCandidateKey(candidateKey: string): Promise<LessonCandidate | null> {
    return this.candidates.get(candidateKey) || null;
  }

  async listByProject(projectId: string, tenantId = 'pub-dev-loop', limit = 20): Promise<LessonCandidate[]> {
    return Array.from(this.candidates.values())
      .filter((c) => c.tenantId === tenantId && c.projectId === projectId)
      .slice(0, limit);
  }

  async updateStatus(
    candidateKey: string,
    targetStatus: CandidateStatus,
    reason?: string
  ): Promise<boolean> {
    const candidate = this.candidates.get(candidateKey);
    if (!candidate) return false;

    candidate.status = targetStatus;
    if (reason) {
      candidate.rejectionReason = reason;
    }
    candidate.updatedAt = new Date().toISOString();

    if (this.pool) {
      try {
        await this.pool.query(
          `UPDATE lesson_candidates SET status = $1, rejection_reason = $2, updated_at = now() WHERE candidate_key = $3`,
          [targetStatus, reason || null, candidateKey]
        );
      } catch (err: any) {
        console.error('[LessonCandidateEngine] Notice: Failed to update candidate status in DB:', err.message);
      }
    }
    return true;
  }
}

export const defaultLessonCandidateEngine = new LessonCandidateEngine();

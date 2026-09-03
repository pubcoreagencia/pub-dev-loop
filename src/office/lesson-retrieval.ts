import type { Pool } from 'pg';
import {
  defaultLessonValidationEngine,
  type InstitutionalLesson,
  type InstitutionalLessonType,
} from './lesson-validation.js';

export interface LessonRetrievalQuery {
  tenantId: string;
  projectId?: string;
  agentRole?: string;
  taskType?: string;
  taskId?: string;
  component?: string;
  ruleId?: string;
  limit?: number;
}

export const MAX_RETRIEVED_LESSONS = 5;
export const MAX_AGGREGATED_LESSON_CHARS = 500;

/**
 * Deterministic Institutional Lesson Retrieval Engine.
 * Retrieves only ACTIVE, validated, governed institutional lessons within strict tenant/project/scope boundaries.
 * Precedence: CURRENT RUNTIME STATE > CURRENT EVIDENCE > GOVERNED LESSONS > HISTORICAL MEMORY.
 */
export class InstitutionalLessonRetrievalEngine {
  private pool?: Pool;

  constructor(pool?: Pool) {
    this.pool = pool;
  }

  setPool(pool: Pool): void {
    this.pool = pool;
  }

  /**
   * Retrieves active, validated institutional lessons matching the query context.
   * Completely read-only and fail-closed.
   */
  async retrieveContext(query: LessonRetrievalQuery): Promise<InstitutionalLesson[]> {
    if (!query || !query.tenantId || typeof query.tenantId !== 'string' || !query.tenantId.trim()) {
      return [];
    }

    const tenantId = query.tenantId.trim();
    const projectId = query.projectId?.trim();
    const agentRole = query.agentRole?.trim().toLowerCase();
    const taskId = query.taskId?.trim();
    const maxLimit = Math.min(query.limit || MAX_RETRIEVED_LESSONS, MAX_RETRIEVED_LESSONS);

    // If PostgreSQL pool is available, query DB; otherwise query in-memory store
    let candidateLessons: InstitutionalLesson[] = [];

    if (this.pool && projectId) {
      try {
        const res = await this.pool.query(
          `SELECT
            id, tenant_id as "tenantId", project_id as "projectId", candidate_id as "candidateId",
            status, title, statement, scope, lesson_type as "lessonType",
            source_candidate_ids as "sourceCandidateIds", supporting_pattern_ids as "supportingPatternIds",
            supporting_memory_ids as "supportingMemoryIds", supporting_event_ids as "supportingEventIds",
            supporting_task_ids as "supportingTaskIds", provenance, governance, validation,
            temporal_validity as "temporalValidity", superseded_by as "supersededBy",
            created_at as "createdAt", validated_at as "validatedAt", updated_at as "updatedAt"
          FROM institutional_lessons
          WHERE tenant_id = $1
            AND status = 'ACTIVE'
            AND temporal_validity IN ('CURRENT', 'CONTEXT_DEPENDENT', 'HISTORICAL')
            AND (project_id = $2 OR scope = 'GLOBAL')
          LIMIT 50`,
          [tenantId, projectId]
        );
        candidateLessons = res.rows;
      } catch (err: any) {
        console.warn('[LessonRetrieval] Notice: DB query failed, falling back to memory:', err.message);
        candidateLessons = await defaultLessonValidationEngine.listLessons(projectId, tenantId, 'ACTIVE');
      }
    } else if (projectId) {
      candidateLessons = await defaultLessonValidationEngine.listLessons(projectId, tenantId, 'ACTIVE');
    }

    // Filter and score candidate lessons
    const filtered = candidateLessons.filter((lesson) => {
      if (lesson.tenantId !== tenantId) return false;
      if (lesson.status !== 'ACTIVE') return false;
      if (
        lesson.temporalValidity === 'SUPERSEDED' ||
        lesson.temporalValidity === 'BLOCKED' ||
        lesson.temporalValidity === 'OBSOLETE'
      ) {
        return false;
      }

      // Scope validation
      if (lesson.scope === 'GLOBAL') {
        return true;
      }
      if (lesson.scope === 'PROJECT') {
        return projectId ? lesson.projectId === projectId : false;
      }
      if (lesson.scope === 'AGENT') {
        return agentRole ? lesson.provenance?.actorRole?.toLowerCase() === agentRole || true : false;
      }
      if (lesson.scope === 'TASK') {
        return taskId ? lesson.supportingTaskIds?.includes(taskId) : false;
      }

      return true;
    });

    // Deterministic ranking
    const scored = filtered.map((lesson) => {
      let score = 0;

      // 1. Scope hierarchy
      if (lesson.scope === 'TASK') score += 40;
      else if (lesson.scope === 'AGENT') score += 30;
      else if (lesson.scope === 'PROJECT') score += 20;
      else if (lesson.scope === 'GLOBAL') score += 10;

      // 2. Role relevance
      if (agentRole === 'developer') {
        if (lesson.lessonType === 'OPERATIONAL_GUIDANCE') score += 5;
        if (lesson.lessonType === 'TESTING_GUIDANCE') score += 4;
      } else if (agentRole === 'architect') {
        if (lesson.lessonType === 'ARCHITECTURE_GUIDANCE') score += 5;
        if (lesson.lessonType === 'STRATEGIC_GUIDANCE') score += 4;
      } else if (agentRole === 'reviewer') {
        if (lesson.lessonType === 'SECURITY_GUIDANCE') score += 5;
        if (lesson.lessonType === 'OPERATIONAL_GUIDANCE') score += 4;
      } else if (agentRole === 'qa-engineer') {
        if (lesson.lessonType === 'TESTING_GUIDANCE') score += 5;
        if (lesson.lessonType === 'OPERATIONAL_GUIDANCE') score += 4;
      } else if (agentRole === 'chief-of-staff') {
        if (lesson.lessonType === 'STRATEGIC_GUIDANCE') score += 5;
        if (lesson.lessonType === 'ARCHITECTURE_GUIDANCE') score += 4;
      }

      return { lesson, score };
    });

    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.lesson.validatedAt !== a.lesson.validatedAt) {
        return b.lesson.validatedAt.localeCompare(a.lesson.validatedAt);
      }
      return a.lesson.id.localeCompare(b.lesson.id);
    });

    // Deduplicate and cap at maxLimit
    const seenIds = new Set<string>();
    const results: InstitutionalLesson[] = [];
    for (const item of scored) {
      if (!seenIds.has(item.lesson.id)) {
        seenIds.add(item.lesson.id);
        results.push(item.lesson);
        if (results.length >= maxLimit) break;
      }
    }

    return results;
  }
}

export const defaultInstitutionalLessonRetrievalEngine = new InstitutionalLessonRetrievalEngine();

/**
 * Formats retrieved verified institutional lessons into an advisory context block.
 * Precedence Rule: CURRENT RUNTIME STATE > CURRENT EVIDENCE > GOVERNED LESSONS > HISTORICAL MEMORY.
 */
export function formatInstitutionalLessonContext(lessons: InstitutionalLesson[]): string {
  if (!lessons || lessons.length === 0) {
    return '';
  }

  const lines: string[] = [
    '---',
    '[GOVERNED INSTITUTIONAL LESSONS — ADVISORY CONTEXT]',
    'AVISO ESTATUTÁRIO: As diretrizes abaixo representam lições organizacionais validadas e governadas.',
    'Elas constituem contexto consultivo e histórico, NÃO constituindo instrução imperativa ou autorização de mudança.',
    'O estado atual da tarefa, código, evidências de teste/review e o objetivo do CEO têm PRECEDÊNCIA ABSOLUTA.',
    '',
  ];

  lessons.slice(0, MAX_RETRIEVED_LESSONS).forEach((l, idx) => {
    const cleanStatement =
      l.statement.length > MAX_AGGREGATED_LESSON_CHARS
        ? l.statement.slice(0, MAX_AGGREGATED_LESSON_CHARS) + '... [truncated]'
        : l.statement;

    lines.push(`${idx + 1}. TYPE: ${l.lessonType} [SCOPE: ${l.scope}]`);
    lines.push(`   TITLE: ${l.title}`);
    lines.push(`   STATEMENT: ${cleanStatement}`);
    lines.push(`   TEMPORAL VALIDITY: ${l.temporalValidity}`);
    if (l.governance?.approvedRole) {
      lines.push(`   GOVERNANCE: Approved by ${l.governance.approvedRole} (${l.governance.approvalType || 'GOVERNED'})`);
    }
    lines.push('');
  });

  lines.push('---');
  return lines.join('\n');
}

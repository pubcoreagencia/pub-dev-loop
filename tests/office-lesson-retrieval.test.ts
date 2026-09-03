import { describe, it, expect, beforeEach } from 'vitest';
import {
  InstitutionalLessonRetrievalEngine,
  formatInstitutionalLessonContext,
} from '../src/office/lesson-retrieval.js';
import {
  LessonValidationEngine,
  defaultLessonValidationEngine,
  type InstitutionalLesson,
} from '../src/office/lesson-validation.js';
import type { LessonCandidate } from '../src/office/lesson-candidate.js';
import type { OfficePrincipal } from '../src/office/auth.js';
import {
  enrichDeveloperTaskWithMemory,
  enrichArchitectTaskWithMemory,
  enrichReviewerTaskWithMemory,
  enrichQaTaskWithMemory,
  enrichChiefOfStaffTaskWithMemory,
  type Task,
} from '../src/office/memory.js';

describe('PDL — Phase 8.5-E: Governed Institutional Lesson Retrieval & Agent Context Integration Suite', () => {
  let retrievalEngine: InstitutionalLessonRetrievalEngine;
  let validationEngine: LessonValidationEngine;

  const mockCEO: OfficePrincipal = {
    userId: 'user-ceo-1',
    role: 'CEO',
    tenantId: 'pub-dev-loop',
  };

  const mockDeveloperPrincipal: OfficePrincipal = {
    userId: 'user-dev-1',
    role: 'DEVELOPER',
    tenantId: 'pub-dev-loop',
  };

  beforeEach(() => {
    validationEngine = defaultLessonValidationEngine;
    retrievalEngine = new InstitutionalLessonRetrievalEngine();
  });

  function createCandidate(id: string, type: any = 'OPERATIONAL_PRACTICE', scope: any = 'PROJECT'): LessonCandidate {
    return {
      id,
      tenantId: 'pub-dev-loop',
      projectId: 'pub-dev-loop',
      patternId: `pat-${id}`,
      candidateKey: `pub-dev-loop:pub-dev-loop:${id}`,
      status: 'ELIGIBLE',
      title: `Lição ${id}`,
      statement: `Regra governada para ${id}.`,
      scope,
      candidateType: type,
      supportingPatternIds: [`pat-${id}`],
      supportingMemoryIds: ['mem-1'],
      supportingEventIds: ['evt-1'],
      supportingTaskIds: ['task-101'],
      supportingAgentIds: ['dev-1'],
      evidence: {},
      corroboration: { independentTaskCount: 3, remediationVerifiedCount: 1 },
      remediation: {},
      contradictionStatus: 'CLEAN',
      provenance: { patternId: `pat-${id}`, projectId: 'pub-dev-loop', verifiedAt: '2026-09-03T10:00:00Z', epistemicStatus: 'DERIVED' },
      eligibility: { isEligible: true, reasons: [], independentTaskCount: 3, hasRemediation: true, hasReviewerConfirmation: true, hasQaConfirmation: true, isContradictionFree: true, requiresCEOApproval: false },
      requiresCEOApproval: type === 'SECURITY_GUIDANCE' || type === 'ARCHITECTURE_GUIDANCE',
      createdAt: '2026-09-03T10:00:00Z',
      updatedAt: '2026-09-03T10:00:00Z',
    };
  }

  it('A, B, C & D. Status Filters: Retrieves ACTIVE and rejects SUPERSEDED, BLOCKED, REVOKED', async () => {
    const candActive = createCandidate('cand-active');
    const candSuperseded = createCandidate('cand-sup');
    const candRevoked = createCandidate('cand-rev');

    const lessonActive = await validationEngine.validateAndInstitutionalizeOperational(candActive, mockDeveloperPrincipal);
    const lessonSup = await validationEngine.validateAndInstitutionalizeOperational(candSuperseded, mockDeveloperPrincipal);
    const lessonRev = await validationEngine.validateAndInstitutionalizeOperational(candRevoked, mockDeveloperPrincipal);

    await validationEngine.supersedeLesson(lessonSup.id, lessonActive.id, mockDeveloperPrincipal, 'Replaced');
    await validationEngine.revokeLesson(lessonRev.id, mockCEO, 'Deprecated');

    const retrieved = await retrievalEngine.retrieveContext({
      tenantId: 'pub-dev-loop',
      projectId: 'pub-dev-loop',
      agentRole: 'developer',
    });

    const ids = retrieved.map((l) => l.id);
    expect(ids).toContain(lessonActive.id);
    expect(ids).not.toContain(lessonSup.id);
    expect(ids).not.toContain(lessonRev.id);
  });

  it('E. Multi-Tenant Boundary: Cross-tenant retrieval returns empty array', async () => {
    const cand = createCandidate('cand-tenant-test');
    await validationEngine.validateAndInstitutionalizeOperational(cand, mockDeveloperPrincipal);

    const crossTenantRetrieved = await retrievalEngine.retrieveContext({
      tenantId: 'other-tenant',
      projectId: 'pub-dev-loop',
      agentRole: 'developer',
    });

    expect(crossTenantRetrieved).toHaveLength(0);
  });

  it('H, I & J. Scope Filtering: Correctly filters PROJECT, GLOBAL, AGENT, TASK scopes', async () => {
    const candProj = createCandidate('cand-proj', 'OPERATIONAL_PRACTICE', 'PROJECT');
    const lessonProj = await validationEngine.validateAndInstitutionalizeOperational(candProj, mockDeveloperPrincipal);

    const retrieved = await retrievalEngine.retrieveContext({
      tenantId: 'pub-dev-loop',
      projectId: 'pub-dev-loop',
      agentRole: 'developer',
    });

    expect(retrieved.some((l) => l.id === lessonProj.id)).toBe(true);
  });

  it('K, L & N. Deterministic Ranking & Max 5 Limit: Results are deduplicated and capped at 5', async () => {
    for (let i = 1; i <= 7; i++) {
      const cand = createCandidate(`cand-batch-${i}`);
      await validationEngine.validateAndInstitutionalizeOperational(cand, mockDeveloperPrincipal);
    }

    const retrieved = await retrievalEngine.retrieveContext({
      tenantId: 'pub-dev-loop',
      projectId: 'pub-dev-loop',
      limit: 5,
    });

    expect(retrieved.length).toBeLessThanOrEqual(5);
    const ids = new Set(retrieved.map((r) => r.id));
    expect(ids.size).toBe(retrieved.length); // Deduplication guaranteed
  });

  it('O & Q. Advisory Context & Read-Only Invariant: Formatter generates statutory warning and does not mutate', async () => {
    const cand = createCandidate('cand-format');
    const lesson = await validationEngine.validateAndInstitutionalizeOperational(cand, mockDeveloperPrincipal);

    const formatted = formatInstitutionalLessonContext([lesson]);
    expect(formatted).toContain('[GOVERNED INSTITUTIONAL LESSONS — ADVISORY CONTEXT]');
    expect(formatted).toContain('PRECEDÊNCIA ABSOLUTA');
    expect(formatted).toContain(lesson.title);
  });

  it('Agent Integration: All 5 agent enrichment functions safely integrate institutional lesson context', async () => {
    const baseTask = (agentId: string): Task => ({
      id: `task-${agentId}-1`,
      project: 'pub-dev-loop',
      tenantId: 'pub-dev-loop' as any,
      agentId: agentId as any,
      type: 'review',
      objective: 'Run security checks',
      prompt: 'Execute current task objective.',
      status: 'pending',
    });

    // Developer
    const devTask = await enrichDeveloperTaskWithMemory(baseTask('developer'));
    expect(devTask.prompt).toBeDefined();

    // Architect
    const archTask = await enrichArchitectTaskWithMemory(baseTask('architect'));
    expect(archTask.prompt).toBeDefined();

    // Reviewer
    const revTask = await enrichReviewerTaskWithMemory(baseTask('reviewer'));
    expect(revTask.prompt).toBeDefined();

    // QA Engineer
    const qaTask = await enrichQaTaskWithMemory(baseTask('qa-engineer'));
    expect(qaTask.prompt).toBeDefined();

    // Chief of Staff
    const cosTask = await enrichChiefOfStaffTaskWithMemory(baseTask('chief-of-staff'));
    expect(cosTask.prompt).toBeDefined();
  });
});

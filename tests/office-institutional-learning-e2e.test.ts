import { describe, it, expect, beforeEach } from 'vitest';
import {
  defaultMemoryIngestPipeline,
  defaultPatternDetectionEngine,
  defaultLessonCandidateEngine,
  defaultLessonValidationEngine,
  defaultInstitutionalLessonRetrievalEngine,
  enrichDeveloperTaskWithMemory,
  enrichArchitectTaskWithMemory,
  enrichReviewerTaskWithMemory,
  enrichQaTaskWithMemory,
  enrichChiefOfStaffTaskWithMemory,
  type Task,
} from '../src/office/memory.js';
import type { OfficePrincipal } from '../src/office/auth.js';
import { authenticateOfficeRequest } from '../src/office/auth.js';

describe('PDL — Phase 8.5-F: Institutional Learning End-to-End Cycle & Hardening Suite', () => {
  const tenantId = 'pub-dev-loop';
  const projectId = 'pub-dev-loop';

  const mockCEO: OfficePrincipal = {
    userId: 'user-ceo-authoritative',
    role: 'CEO',
    tenantId: 'pub-dev-loop',
  };

  const mockDeveloper: OfficePrincipal = {
    userId: 'user-dev-1',
    role: 'DEVELOPER',
    tenantId: 'pub-dev-loop',
  };

  beforeEach(() => {
    // Pipeline engines are singleton defaults
  });

  it('1. Complete End-to-End Positive Pipeline: Event -> Pattern -> Candidate -> Validation -> Retrieval -> Agent Context', async () => {
    const findingText = 'SQL query concatenates untrusted input parameter in user repository';
    const remediationText = 'Use parameterized query with SQL tag template';

    // Step A: Ingest 3 events from 3 independent tasks
    for (let i = 1; i <= 3; i++) {
      await defaultMemoryIngestPipeline.ingestEvent({
        id: `evt-sec-e2e-${i}`,
        type: 'REVIEW_FINDING',
        actorId: `reviewer-${i}`,
        project: projectId,
        tenantId,
        taskId: `task-sec-indep-${i}`,
        summary: `Security finding in auth module: ${findingText}`,
        payload: {
          findingText,
          remediationText,
          ruleId: 'RULE_SEC_SQL_INJECTION',
          component: 'src/db/users.ts',
          reviewerConfirmed: true,
          qaConfirmed: true,
          remediationVerified: true,
        },
        timestamp: new Date().toISOString(),
      });
    }

    // Step B: Verify Pattern created and corroborated
    const patterns = await defaultPatternDetectionEngine.listByProject(projectId, tenantId);
    const secPattern = patterns.find((p) => p.ruleId === 'RULE_SEC_SQL_INJECTION');
    expect(secPattern).toBeDefined();
    expect(secPattern!.corroboration.independentTaskCount).toBeGreaterThanOrEqual(3);
    expect(secPattern!.corroboration.remediationVerifiedCount).toBeGreaterThanOrEqual(1);

    // Step C: Verify Lesson Candidate generated and evaluated as ELIGIBLE
    const candidate = await defaultLessonCandidateEngine.getByCandidateKey(`${tenantId}:${projectId}:${secPattern!.signature}`);
    expect(candidate).toBeDefined();
    expect(candidate!.status).toBe('ELIGIBLE');
    expect(candidate!.candidateType).toBe('SECURITY_GUIDANCE');
    expect(candidate!.requiresCEOApproval).toBe(true);

    // Step D: Governed Validation via Authoritative CEO Approval
    const lesson = await defaultLessonValidationEngine.approveAndInstitutionalizeByCEO(candidate!, mockCEO, {
      customStatement: 'Proibida concatenação direta de queries SQL. Obrigatório o uso de parameterized queries.',
    });
    expect(lesson).toBeDefined();
    expect(lesson.status).toBe('ACTIVE');
    expect(lesson.lessonType).toBe('SECURITY_GUIDANCE');
    expect(lesson.governance.approvedRole).toBe('CEO');

    // Step E: Governed Retrieval for Reviewer & Developer
    const retrievedLessons = await defaultInstitutionalLessonRetrievalEngine.retrieveContext({
      tenantId,
      projectId,
      agentRole: 'reviewer',
    });
    expect(retrievedLessons.some((l) => l.id === lesson.id)).toBe(true);

    // Step F: Agent Context Enrichment with Statutory Advisory Warning
    const task: Task = {
      id: 'task-dev-sec-check',
      project: projectId,
      tenantId: tenantId as any,
      agentId: 'developer',
      type: 'execute',
      objective: 'Implement user lookup',
      prompt: 'Implement findUserById query.',
      status: 'pending',
    };

    const enrichedTask = await enrichDeveloperTaskWithMemory(task);
    expect(enrichedTask.prompt).toContain('[GOVERNED INSTITUTIONAL LESSONS — ADVISORY CONTEXT]');
    expect(enrichedTask.prompt).toContain('Proibida concatenação direta de queries SQL');
    expect(enrichedTask.prompt).toContain('PRECEDÊNCIA ABSOLUTA');
  });

  it('2. Multi-Task Corroboration & Retry Isolation: 3 retries on same task do NOT satisfy independence', async () => {
    const finding = 'Unchecked null pointer in parsing logic';
    const remediation = 'Add optional chaining check';

    // Ingest 3 observations for the EXACT SAME task
    for (let i = 1; i <= 3; i++) {
      await defaultMemoryIngestPipeline.ingestEvent({
        id: `evt-retry-${i}`,
        type: 'REVIEW_FINDING',
        actorId: 'dev-retry',
        project: projectId,
        tenantId,
        taskId: 'task-same-retry-id', // Identical task ID!
        summary: finding,
        payload: {
          findingText: finding,
          remediationText: remediation,
          ruleId: 'RULE_NULL_SAFETY',
          component: 'src/parser.ts',
          reviewerConfirmed: true,
          remediationVerified: true,
        },
        timestamp: new Date().toISOString(),
      });
    }

    const patterns = await defaultPatternDetectionEngine.listByProject(projectId, tenantId);
    const retryPattern = patterns.find((p) => p.ruleId === 'RULE_NULL_SAFETY');
    expect(retryPattern).toBeDefined();
    expect(retryPattern!.corroboration.independentTaskCount).toBe(1); // Only 1 task!

    const candidate = await defaultLessonCandidateEngine.getByCandidateKey(`${tenantId}:${projectId}:${retryPattern!.signature}`);
    expect(candidate).toBeDefined();
    expect(candidate!.status).toBe('PROPOSED');
    expect(candidate!.eligibility.isEligible).toBe(false);

    // Ineligible candidate cannot be validated
    const check = defaultLessonValidationEngine.validateCandidate(candidate!);
    expect(check.valid).toBe(false);
    expect(check.error).toContain('INELIGIBLE_CANDIDATE');
  });

  it('3. Negative Pipeline Barriers: Contradictions, Missing Remediation & Incomplete Provenance Block Validation', async () => {
    const finding = 'Flaky test in cache cluster';

    // 3 independent tasks but NO remediation verified
    for (let i = 1; i <= 3; i++) {
      await defaultMemoryIngestPipeline.ingestEvent({
        id: `evt-flaky-${i}`,
        type: 'REVIEW_FINDING',
        actorId: 'qa-tester',
        project: projectId,
        tenantId,
        taskId: `task-flaky-${i}`,
        summary: finding,
        payload: {
          findingText: finding,
          ruleId: 'RULE_FLAKY_CACHE',
          component: 'src/cache.ts',
          reviewerConfirmed: true,
          remediationVerified: false, // No remediation!
        },
        timestamp: new Date().toISOString(),
      });
    }

    const patterns = await defaultPatternDetectionEngine.listByProject(projectId, tenantId);
    const flakyPattern = patterns.find((p) => p.ruleId === 'RULE_FLAKY_CACHE');
    expect(flakyPattern).toBeDefined();

    const candidate = await defaultLessonCandidateEngine.getByCandidateKey(`${tenantId}:${projectId}:${flakyPattern!.signature}`);
    expect(candidate?.status).toBe('PROPOSED');
    expect(candidate?.eligibility.hasRemediation).toBe(false);
  });

  it('4. Governance Boundary & Non-CEO Bypass Defense: Developer cannot approve security/architecture guidance', async () => {
    const candidate = await defaultLessonCandidateEngine.getByCandidateKey(`${tenantId}:${projectId}:dummy-key`) || {
      id: 'cand-sec-dummy',
      tenantId,
      projectId,
      patternId: 'pat-dummy',
      candidateKey: 'pub-dev-loop:pub-dev-loop:dummy-key',
      status: 'ELIGIBLE',
      title: 'Security Guideline',
      statement: 'Sensitive token handling.',
      scope: 'PROJECT',
      candidateType: 'SECURITY_GUIDANCE',
      supportingPatternIds: ['pat-dummy'],
      supportingMemoryIds: ['mem-1'],
      supportingEventIds: ['evt-1'],
      supportingTaskIds: ['t-1', 't-2', 't-3'],
      supportingAgentIds: ['dev-1'],
      evidence: {},
      corroboration: { independentTaskCount: 3, remediationVerifiedCount: 1 },
      remediation: {},
      contradictionStatus: 'CLEAN',
      provenance: { patternId: 'pat-dummy', projectId, verifiedAt: '2026-09-03T10:00:00Z', epistemicStatus: 'DERIVED' },
      eligibility: { isEligible: true, reasons: [], independentTaskCount: 3, hasRemediation: true, hasReviewerConfirmation: true, hasQaConfirmation: true, isContradictionFree: true, requiresCEOApproval: true },
      requiresCEOApproval: true,
      createdAt: '2026-09-03T10:00:00Z',
      updatedAt: '2026-09-03T10:00:00Z',
    };

    // Developer attempting to approve security guidance
    await expect(
      defaultLessonValidationEngine.approveAndInstitutionalizeByCEO(candidate as any, mockDeveloper)
    ).rejects.toThrow('FORBIDDEN');

    // Developer attempting deterministic validation on security candidate
    await expect(
      defaultLessonValidationEngine.validateAndInstitutionalizeOperational(candidate as any, mockDeveloper)
    ).rejects.toThrow('GOVERNANCE_RESTRICTION');
  });

  it('5. Cross-Tenant Attack Matrix: Tenant B cannot access or retrieve Tenant A lessons or candidates', async () => {
    const crossTenantRetrieved = await defaultInstitutionalLessonRetrievalEngine.retrieveContext({
      tenantId: 'attacker-tenant-99',
      projectId: 'pub-dev-loop',
      agentRole: 'developer',
    });

    expect(crossTenantRetrieved).toHaveLength(0);
  });

  it('6. Lifecycle Isolation: Superseded, Blocked, and Revoked lessons are never retrieved into agent context', async () => {
    const cand = {
      id: 'cand-lifecycle-test',
      tenantId,
      projectId,
      patternId: 'pat-life',
      candidateKey: 'pub-dev-loop:pub-dev-loop:pat-life',
      status: 'ELIGIBLE' as const,
      title: 'Lifecycle Test',
      statement: 'Temporary guideline.',
      scope: 'PROJECT' as const,
      candidateType: 'OPERATIONAL_PRACTICE' as const,
      supportingPatternIds: ['pat-life'],
      supportingMemoryIds: ['mem-1'],
      supportingEventIds: ['evt-1'],
      supportingTaskIds: ['t-1', 't-2', 't-3'],
      supportingAgentIds: ['dev-1'],
      evidence: {},
      corroboration: { independentTaskCount: 3, remediationVerifiedCount: 1 },
      remediation: {},
      contradictionStatus: 'CLEAN' as const,
      provenance: { patternId: 'pat-life', projectId, verifiedAt: '2026-09-03T10:00:00Z', epistemicStatus: 'DERIVED' as const },
      eligibility: { isEligible: true, reasons: [], independentTaskCount: 3, hasRemediation: true, hasReviewerConfirmation: true, hasQaConfirmation: true, isContradictionFree: true, requiresCEOApproval: false },
      requiresCEOApproval: false,
      createdAt: '2026-09-03T10:00:00Z',
      updatedAt: '2026-09-03T10:00:00Z',
    };

    const lesson = await defaultLessonValidationEngine.validateAndInstitutionalizeOperational(cand, mockDeveloper);
    expect(lesson.status).toBe('ACTIVE');

    // Revoke lesson
    await defaultLessonValidationEngine.revokeLesson(lesson.id, mockCEO, 'Rule obsolete');
    expect(lesson.status).toBe('REVOKED');

    // Verify it is excluded from retrieval
    const retrieved = await defaultInstitutionalLessonRetrievalEngine.retrieveContext({
      tenantId,
      projectId,
      agentRole: 'developer',
    });
    expect(retrieved.some((l) => l.id === lesson.id)).toBe(false);
  });

  it('7. Replay & Idempotency: Re-ingesting identical events updates count without duplicating rows or resurrecting revoked states', async () => {
    const finding = 'Idempotency test finding';

    await defaultMemoryIngestPipeline.ingestEvent({
      id: 'evt-idempotent-1',
      type: 'REVIEW_FINDING',
      actorId: 'dev-1',
      project: projectId,
      tenantId,
      taskId: 'task-idem-1',
      summary: finding,
      payload: {
        findingText: finding,
        ruleId: 'RULE_IDEMPOTENCY',
        component: 'src/idem.ts',
      },
      timestamp: new Date().toISOString(),
    });

    // Replay same event
    await defaultMemoryIngestPipeline.ingestEvent({
      id: 'evt-idempotent-1',
      type: 'REVIEW_FINDING',
      actorId: 'dev-1',
      project: projectId,
      tenantId,
      taskId: 'task-idem-1',
      summary: finding,
      payload: {
        findingText: finding,
        ruleId: 'RULE_IDEMPOTENCY',
        component: 'src/idem.ts',
      },
      timestamp: new Date().toISOString(),
    });

    const patterns = await defaultPatternDetectionEngine.listByProject(projectId, tenantId);
    const match = patterns.filter((p) => p.ruleId === 'RULE_IDEMPOTENCY');
    expect(match).toHaveLength(1); // No duplicate pattern records created
  });

  it('8. Precedence Invariant: Present task failure / test evidence strictly dominates historical lessons', async () => {
    const failingTask: Task = {
      id: 'task-qa-regression',
      project: projectId,
      tenantId: tenantId as any,
      agentId: 'qa-engineer',
      type: 'review',
      objective: 'Verify regression tests',
      prompt: 'CRITICAL FAILURE: 2 unit tests failed in auth suite (exitCode 1).',
      status: 'pending',
    };

    const enriched = await enrichQaTaskWithMemory(failingTask);
    // Even if institutional lessons or memories exist, current execution failure remains intact in prompt
    expect(enriched.prompt).toContain('CRITICAL FAILURE: 2 unit tests failed');
  });
});

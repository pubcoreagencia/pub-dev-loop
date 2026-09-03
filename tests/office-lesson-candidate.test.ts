import { describe, it, expect, beforeEach } from 'vitest';
import {
  LessonCandidateEngine,
  generateSafeCandidateStatement,
  evaluateCandidateEligibility,
} from '../src/office/lesson-candidate.js';
import { PatternDetectionEngine, type OrganizationalPattern } from '../src/office/pattern-detection.js';

describe('PDL — Phase 8.5-C: Lesson Candidate Engine & Corroboration Pipeline Test Suite', () => {
  let candidateEngine: LessonCandidateEngine;
  let patternEngine: PatternDetectionEngine;

  beforeEach(() => {
    candidateEngine = new LessonCandidateEngine();
    patternEngine = new PatternDetectionEngine();
  });

  function createMockPattern(overrides?: Partial<OrganizationalPattern>): OrganizationalPattern {
    return {
      id: 'pat-test-1',
      tenantId: 'pub-dev-loop',
      projectId: 'pub-dev-loop',
      signature: 'sig-canonical-12345',
      status: 'ACTIVE',
      component: 'src/auth/jwt.ts',
      taskType: 'review',
      ruleId: 'RULE_SEC_JWT_EXPIRE',
      remediationSignature: 'add exp claim check',
      recurrenceCount: 3,
      supportingMemoryIds: ['mem-1', 'mem-2', 'mem-3'],
      supportingEventIds: ['evt-1', 'evt-2', 'evt-3'],
      supportingTaskIds: ['task-101', 'task-102', 'task-103'],
      supportingAgentIds: ['dev-1', 'dev-2', 'dev-3'],
      corroboration: {
        observationCount: 3,
        independentTaskCount: 3,
        independentAgentCount: 3,
        independentProjectCount: 1,
        reviewerConfirmedCount: 2,
        qaConfirmedCount: 1,
        remediationVerifiedCount: 1,
      },
      firstObservedAt: '2026-09-01T10:00:00Z',
      lastObservedAt: '2026-09-03T10:00:00Z',
      metadata: {},
      provenance: {
        projectId: 'pub-dev-loop',
        actorId: 'reviewer',
        source: 'REVIEW_INSPECTION',
        verifiedAt: '2026-09-03T10:00:00Z',
        epistemicStatus: 'DERIVED',
      },
      createdAt: '2026-09-01T10:00:00Z',
      updatedAt: '2026-09-03T10:00:00Z',
      ...overrides,
    };
  }

  it('A & B. Eligibility Threshold: <3 tasks is PROPOSED; >=3 independent tasks becomes ELIGIBLE', async () => {
    const patternBelow = createMockPattern({
      corroboration: {
        observationCount: 2,
        independentTaskCount: 2, // Less than 3!
        independentAgentCount: 2,
        independentProjectCount: 1,
        reviewerConfirmedCount: 1,
        qaConfirmedCount: 1,
        remediationVerifiedCount: 1,
      },
    });

    const candBelow = await candidateEngine.evaluateAndUpsertCandidate(patternBelow);
    expect(candBelow?.status).toBe('PROPOSED');
    expect(candBelow?.eligibility.isEligible).toBe(false);
    expect(candBelow?.eligibility.reasons.some((r) => r.includes('INSUFFICIENT_TASKS'))).toBe(true);

    const patternEligible = createMockPattern();
    const candEligible = await candidateEngine.evaluateAndUpsertCandidate(patternEligible);
    expect(candEligible?.status).toBe('ELIGIBLE');
    expect(candEligible?.eligibility.isEligible).toBe(true);
  });

  it('C. Retry Isolation: 3 retries on 1 single task keep independentTaskCount=1 and remain non-eligible', async () => {
    const patternRetries = createMockPattern({
      recurrenceCount: 3,
      supportingTaskIds: ['task-same-1'], // Same task!
      corroboration: {
        observationCount: 3,
        independentTaskCount: 1, // Only 1 independent task!
        independentAgentCount: 1,
        independentProjectCount: 1,
        reviewerConfirmedCount: 1,
        qaConfirmedCount: 1,
        remediationVerifiedCount: 1,
      },
    });

    const cand = await candidateEngine.evaluateAndUpsertCandidate(patternRetries);
    expect(cand?.status).toBe('PROPOSED');
    expect(cand?.eligibility.isEligible).toBe(false);
  });

  it('D, E & F. Verification Requirements: Missing remediation or missing review/QA confirmation blocks eligibility', () => {
    const noRemediation = createMockPattern({
      corroboration: {
        observationCount: 3,
        independentTaskCount: 3,
        independentAgentCount: 3,
        independentProjectCount: 1,
        reviewerConfirmedCount: 2,
        qaConfirmedCount: 1,
        remediationVerifiedCount: 0, // Missing remediation!
      },
    });

    const evalNoRem = evaluateCandidateEligibility(noRemediation, 'OPERATIONAL_PRACTICE', 'CLEAN');
    expect(evalNoRem.isEligible).toBe(false);
    expect(evalNoRem.reasons.some((r) => r.includes('MISSING_REMEDIATION'))).toBe(true);

    const noConfirmation = createMockPattern({
      corroboration: {
        observationCount: 3,
        independentTaskCount: 3,
        independentAgentCount: 3,
        independentProjectCount: 1,
        reviewerConfirmedCount: 0, // No reviewer!
        qaConfirmedCount: 0, // No QA!
        remediationVerifiedCount: 1,
      },
    });

    const evalNoConf = evaluateCandidateEligibility(noConfirmation, 'OPERATIONAL_PRACTICE', 'CLEAN');
    expect(evalNoConf.isEligible).toBe(false);
    expect(evalNoConf.reasons.some((r) => r.includes('MISSING_CONFIRMATION'))).toBe(true);
  });

  it('O. Contradiction Blocking: CONTRADICTORY_UNRESOLVED blocks candidate promotion to ELIGIBLE', async () => {
    const pattern = createMockPattern();
    const cand = await candidateEngine.evaluateAndUpsertCandidate(pattern, 'CONTRADICTORY_UNRESOLVED');
    expect(cand?.status).toBe('PROPOSED');
    expect(cand?.eligibility.isEligible).toBe(false);
    expect(cand?.eligibility.reasons.some((r) => r.includes('ACTIVE_CONTRADICTION'))).toBe(true);
  });

  it('Q & R. Statement & Epistemic Safety: Safe statement generation and DERIVED epistemic status', async () => {
    const pattern = createMockPattern();
    const cand = await candidateEngine.evaluateAndUpsertCandidate(pattern);
    expect(cand?.statement).toContain('Observação verificada em src/auth/jwt.ts');
    expect(cand?.statement).toContain('3 tarefas independentes');
    expect(cand?.statement).not.toContain('CEO approved');
    expect(cand?.statement).not.toContain('Always do');
    expect(cand?.provenance.epistemicStatus).toBe('DERIVED');
  });

  it('S, T & U. Deterministic Idempotency & Replay: Re-evaluating identical pattern preserves candidate ID', async () => {
    const pattern = createMockPattern();
    const first = await candidateEngine.evaluateAndUpsertCandidate(pattern);
    const second = await candidateEngine.evaluateAndUpsertCandidate(pattern);

    expect(second?.id).toBe(first?.id);
    expect(second?.candidateKey).toBe(first?.candidateKey);
  });

  it('V & W. Lifecycle State Guards: REJECTED or BLOCKED candidates do not silently reactivate', async () => {
    const pattern = createMockPattern();
    const cand = await candidateEngine.evaluateAndUpsertCandidate(pattern);
    expect(cand?.status).toBe('ELIGIBLE');

    // Admin rejects candidate
    await candidateEngine.updateStatus(cand!.candidateKey, 'REJECTED', 'Superseded by new design standard');
    const rejected = await candidateEngine.getByCandidateKey(cand!.candidateKey);
    expect(rejected?.status).toBe('REJECTED');

    // Re-evaluation must NOT reactivate to ELIGIBLE
    const reevaluated = await candidateEngine.evaluateAndUpsertCandidate(pattern);
    expect(reevaluated?.status).toBe('REJECTED');
  });

  it('X, Y, Z, AA & AB. Absolute Isolation & Invariants: Candidates do not alter review limits, approvals, or runtime', async () => {
    const pattern = createMockPattern();
    const cand = await candidateEngine.evaluateAndUpsertCandidate(pattern);
    expect(cand).toBeDefined();

    // Check that security / approval flags are flagged for governance without auto-invoking endpoints
    expect(cand?.requiresCEOApproval).toBe(true); // SECURITY_GUIDANCE requires CEO approval
    // No institutional lessons created
    expect((cand as any).institutionalLessonId).toBeUndefined();
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import {
  LessonValidationEngine,
  type InstitutionalLesson,
} from '../src/office/lesson-validation.js';
import type { LessonCandidate } from '../src/office/lesson-candidate.js';
import type { OfficePrincipal } from '../src/office/auth.js';
import { authenticateOfficeRequest } from '../src/office/auth.js';

describe('PDL — Phase 8.5-D: Governed Lesson Validation & CEO Governance Test Suite', () => {
  let validationEngine: LessonValidationEngine;

  const mockCEO: OfficePrincipal = {
    userId: 'user-ceo-1',
    role: 'CEO',
    tenantId: 'pub-dev-loop',
  };

  const mockDeveloper: OfficePrincipal = {
    userId: 'user-dev-1',
    role: 'DEVELOPER',
    tenantId: 'pub-dev-loop',
  };

  beforeEach(() => {
    validationEngine = new LessonValidationEngine();
  });

  function createMockCandidate(overrides?: Partial<LessonCandidate>): LessonCandidate {
    return {
      id: 'cand-val-1',
      tenantId: 'pub-dev-loop',
      projectId: 'pub-dev-loop',
      patternId: 'pat-1',
      candidateKey: 'pub-dev-loop:pub-dev-loop:sig-1',
      status: 'ELIGIBLE',
      title: 'Candidato a Lição: Vitest Timers',
      statement: 'Observação verificada em tests/auth.ts: 3 tarefas independentes.',
      scope: 'PROJECT',
      candidateType: 'OPERATIONAL_PRACTICE',
      supportingPatternIds: ['pat-1'],
      supportingMemoryIds: ['mem-1', 'mem-2'],
      supportingEventIds: ['evt-1', 'evt-2'],
      supportingTaskIds: ['task-1', 'task-2', 'task-3'],
      supportingAgentIds: ['dev-1', 'dev-2'],
      evidence: { patternSignature: 'sig-1' },
      corroboration: { independentTaskCount: 3, remediationVerifiedCount: 1 },
      remediation: { remediationSignature: 'useFakeTimers' },
      contradictionStatus: 'CLEAN',
      provenance: {
        patternId: 'pat-1',
        projectId: 'pub-dev-loop',
        verifiedAt: '2026-09-03T10:00:00Z',
        epistemicStatus: 'DERIVED',
      },
      eligibility: {
        isEligible: true,
        reasons: [],
        independentTaskCount: 3,
        hasRemediation: true,
        hasReviewerConfirmation: true,
        hasQaConfirmation: true,
        isContradictionFree: true,
        requiresCEOApproval: false,
      },
      requiresCEOApproval: false,
      createdAt: '2026-09-03T10:00:00Z',
      updatedAt: '2026-09-03T10:00:00Z',
      ...overrides,
    };
  }

  it('A & B. Validation Eligibility Gate: Ineligible candidate is rejected; eligible can proceed', () => {
    const ineligible = createMockCandidate({ status: 'PROPOSED' });
    const check1 = validationEngine.validateCandidate(ineligible);
    expect(check1.valid).toBe(false);
    expect(check1.error).toContain('INELIGIBLE_CANDIDATE');

    const eligible = createMockCandidate({ status: 'ELIGIBLE' });
    const check2 = validationEngine.validateCandidate(eligible);
    expect(check2.valid).toBe(true);
  });

  it('C, D & E. Provenance & Contradiction Barriers: Missing provenance or contradiction blocks validation', () => {
    const missingProv = createMockCandidate({ provenance: {} as any });
    const checkProv = validationEngine.validateCandidate(missingProv);
    expect(checkProv.valid).toBe(false);
    expect(checkProv.error).toContain('MISSING_PROVENANCE');

    const contradicted = createMockCandidate({ contradictionStatus: 'CONTRADICTORY_UNRESOLVED' });
    const checkContr = validationEngine.validateCandidate(contradicted);
    expect(checkContr.valid).toBe(false);
    expect(checkContr.error).toContain('ACTIVE_CONTRADICTION');
  });

  it('G, H, I & J. Authoritative CEO Authentication: Forged role headers fail; only verified CEO can approve', async () => {
    // 1. Forged header verification via auth module
    const principal = authenticateOfficeRequest({
      'x-user-role': 'CEO', // Untrusted forged role header
      authorization: 'Bearer member-secret-key', // Non-CEO token
    } as any);
    expect(principal.role).not.toBe('CEO');

    // 2. Developer attempting to invoke CEO approval
    const candidate = createMockCandidate({
      candidateType: 'SECURITY_GUIDANCE',
      requiresCEOApproval: true,
    });

    await expect(
      validationEngine.approveAndInstitutionalizeByCEO(candidate, mockDeveloper)
    ).rejects.toThrow('FORBIDDEN');

    // 3. Genuine authenticated CEO approves
    const lesson = await validationEngine.approveAndInstitutionalizeByCEO(candidate, mockCEO);
    expect(lesson).toBeDefined();
    expect(lesson.status).toBe('ACTIVE');
    expect(lesson.lessonType).toBe('SECURITY_GUIDANCE');
    expect(lesson.governance.approvedRole).toBe('CEO');
  });

  it('K & L. Multi-Tenant Boundaries: Cross-tenant approval attempt is strictly rejected', async () => {
    const candTenantA = createMockCandidate({ tenantId: 'tenant-ALPHA' });
    const ceoTenantB: OfficePrincipal = { userId: 'ceo-b', role: 'CEO', tenantId: 'tenant-BETA' };

    await expect(
      validationEngine.approveAndInstitutionalizeByCEO(candTenantA, ceoTenantB)
    ).rejects.toThrow('TENANT_MISMATCH');
  });

  it('M, N, O & P. Governance Matrix: Architecture, Security, and Global scope strictly require CEO approval', async () => {
    const secCandidate = createMockCandidate({ candidateType: 'SECURITY_GUIDANCE' });
    const archCandidate = createMockCandidate({ candidateType: 'ARCHITECTURE_GUIDANCE' });
    const globalCandidate = createMockCandidate({ scope: 'GLOBAL' as any });
    const opCandidate = createMockCandidate({ candidateType: 'OPERATIONAL_PRACTICE' });

    expect(validationEngine.determineGovernanceRequirement(secCandidate).requiresCEOApproval).toBe(true);
    expect(validationEngine.determineGovernanceRequirement(archCandidate).requiresCEOApproval).toBe(true);
    expect(validationEngine.determineGovernanceRequirement(globalCandidate).requiresCEOApproval).toBe(true);
    expect(validationEngine.determineGovernanceRequirement(opCandidate).requiresCEOApproval).toBe(false);

    // Operational candidate can be validated deterministically
    const opLesson = await validationEngine.validateAndInstitutionalizeOperational(opCandidate, mockDeveloper);
    expect(opLesson.status).toBe('ACTIVE');
    expect(opLesson.lessonType).toBe('OPERATIONAL_GUIDANCE');
  });

  it('V, W & AP. Lifecycle Management: Superseded and revoked lessons remain auditable in store', async () => {
    const cand = createMockCandidate();
    const lessonA = await validationEngine.validateAndInstitutionalizeOperational(cand, mockDeveloper);
    expect(lessonA.status).toBe('ACTIVE');

    const candB = createMockCandidate({ id: 'cand-val-2' });
    const lessonB = await validationEngine.validateAndInstitutionalizeOperational(candB, mockDeveloper);

    // Supersede Lesson A with Lesson B
    await validationEngine.supersedeLesson(lessonA.id, lessonB.id, mockDeveloper, 'New operational standard');
    expect(lessonA.status).toBe('SUPERSEDED');
    expect(lessonA.temporalValidity).toBe('SUPERSEDED');
    expect(lessonA.supersededBy).toBe(lessonB.id);

    // Revoke Lesson B
    await validationEngine.revokeLesson(lessonB.id, mockCEO, 'Deprecated');
    expect(lessonB.status).toBe('REVOKED');
    expect(lessonB.temporalValidity).toBe('OBSOLETE');
  });

  it('AM, AN & AO. Executive Supersession: Strategic and Security supersession strictly requires CEO', async () => {
    const candSec1 = createMockCandidate({ candidateType: 'SECURITY_GUIDANCE' });
    const secLesson1 = await validationEngine.approveAndInstitutionalizeByCEO(candSec1, mockCEO);

    const candSec2 = createMockCandidate({ id: 'cand-sec-2', candidateType: 'SECURITY_GUIDANCE' });
    const secLesson2 = await validationEngine.approveAndInstitutionalizeByCEO(candSec2, mockCEO);

    // Developer attempting to supersede security lesson
    await expect(
      validationEngine.supersedeLesson(secLesson1.id, secLesson2.id, mockDeveloper, 'Change policy')
    ).rejects.toThrow('FORBIDDEN');

    // CEO supersedes security lesson
    const success = await validationEngine.supersedeLesson(secLesson1.id, secLesson2.id, mockCEO, 'Upgraded security standard');
    expect(success).toBe(true);
    expect(secLesson1.status).toBe('SUPERSEDED');
  });
});

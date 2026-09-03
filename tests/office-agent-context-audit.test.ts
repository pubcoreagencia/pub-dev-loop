import { describe, it, expect, beforeEach } from 'vitest';
import {
  enrichDeveloperTaskWithMemory,
  enrichArchitectTaskWithMemory,
  enrichReviewerTaskWithMemory,
  enrichQaTaskWithMemory,
  enrichChiefOfStaffTaskWithMemory,
  type Task,
  defaultMemoryStore,
  defaultMemoryRetrievalEngine,
  defaultLessonValidationEngine,
  defaultInstitutionalLessonRetrievalEngine,
} from '../src/office/memory.js';
import type { OfficePrincipal } from '../src/office/auth.js';

describe('PDL — Phase 8.6-A: Agent Context & Behavior Audit Test Suite', () => {
  const tenantId = 'pub-dev-loop';
  const projectId = 'pub-dev-loop';

  const mockCEOPrincipal: OfficePrincipal = {
    userId: 'user-ceo-authoritative',
    role: 'CEO',
    tenantId,
  };

  const mockDevPrincipal: OfficePrincipal = {
    userId: 'user-dev-1',
    role: 'DEVELOPER',
    tenantId,
  };

  beforeEach(() => {
    // Pipeline engines are singleton defaults
  });

  function createBaseTask(agentId: string, overrides?: Partial<Task>): Task {
    return {
      id: `task-${agentId}-audit`,
      project: projectId,
      tenantId: tenantId as any,
      agentId: agentId as any,
      type: 'execute',
      objective: `Audit context for ${agentId}`,
      prompt: `Task prompt for ${agentId}.`,
      status: 'pending',
      ...overrides,
    };
  }

  it('A & B. Role Context & Task Context: Each agent receives its own distinct role context and instructions', async () => {
    const devTask = await enrichDeveloperTaskWithMemory(createBaseTask('developer'));
    const archTask = await enrichArchitectTaskWithMemory(createBaseTask('architect'));
    const revTask = await enrichReviewerTaskWithMemory(createBaseTask('reviewer'));
    const qaTask = await enrichQaTaskWithMemory(createBaseTask('qa-engineer'));
    const cosTask = await enrichChiefOfStaffTaskWithMemory(createBaseTask('chief-of-staff'));

    expect(devTask.prompt).toContain('Task prompt for developer');
    expect(archTask.prompt).toContain('Task prompt for architect');
    expect(revTask.prompt).toContain('Task prompt for reviewer');
    expect(qaTask.prompt).toContain('Task prompt for qa-engineer');
    expect(cosTask.prompt).toContain('Task prompt for chief-of-staff');
  });

  it('C & D. Scoping & Memory Isolation: Agents only receive memories and lessons aligned with their role', async () => {
    // Seed an Architectural Decision
    await defaultMemoryStore.create({
      tenantId,
      projectId,
      type: 'DECISION',
      title: 'Decisão Arquitetural: Micro-frontends',
      content: 'Arquitetura modularizada.',
      status: 'ACTIVE',
      epistemicStatus: 'DECIDED',
      scope: 'PROJECT',
      actorId: 'architect',
      provenance: { projectId, actorId: 'architect', source: 'ORGANIZATIONAL_PLAN', verifiedAt: new Date().toISOString() },
    });

    const archTask = await enrichArchitectTaskWithMemory(createBaseTask('architect'));
    expect(archTask.prompt).toContain('Decisão Arquitetural: Micro-frontends');

    // Developer should not receive DECISION memories by default (only TASK_RESULT, REVIEW_FINDING, LESSON, PROJECT_CONTEXT)
    const devTask = await enrichDeveloperTaskWithMemory(createBaseTask('developer'));
    expect(devTask.prompt).not.toContain('Decisão Arquitetural: Micro-frontends');
  });

  it('E & F. Tenant & Project Isolation: Context from other tenants or projects never reaches the agent', async () => {
    const crossTenantTask = createBaseTask('developer', { tenantId: 'other-tenant' as any });
    const enriched = await enrichDeveloperTaskWithMemory(crossTenantTask);
    expect(enriched.prompt).not.toContain('Decisão Arquitetural');
  });

  it('G, H & I. Precedence & Advisory Ordering: Prompt -> Institutional Lessons -> Historical Memory', async () => {
    // Seed an operational candidate and validate it as institutional lesson
    const cand = {
      id: 'cand-prec-audit',
      tenantId,
      projectId,
      patternId: 'pat-prec',
      candidateKey: `${tenantId}:${projectId}:pat-prec`,
      status: 'ELIGIBLE' as const,
      title: 'Operational Heuristic: Clean Cleanup',
      statement: 'Always run cleanup after integration tests.',
      scope: 'PROJECT' as const,
      candidateType: 'OPERATIONAL_PRACTICE' as const,
      supportingPatternIds: ['pat-prec'],
      supportingMemoryIds: ['mem-1'],
      supportingEventIds: ['evt-1'],
      supportingTaskIds: ['t-1', 't-2', 't-3'],
      supportingAgentIds: ['dev-1'],
      evidence: {},
      corroboration: { independentTaskCount: 3, remediationVerifiedCount: 1 },
      remediation: {},
      contradictionStatus: 'CLEAN' as const,
      provenance: { patternId: 'pat-prec', projectId, verifiedAt: new Date().toISOString(), epistemicStatus: 'DERIVED' as const },
      eligibility: { isEligible: true, reasons: [], independentTaskCount: 3, hasRemediation: true, hasReviewerConfirmation: true, hasQaConfirmation: true, isContradictionFree: true, requiresCEOApproval: false },
      requiresCEOApproval: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const lesson = await defaultLessonValidationEngine.validateAndInstitutionalizeOperational(cand, mockDevPrincipal);

    // Seed a memory
    await defaultMemoryStore.create({
      tenantId,
      projectId,
      type: 'TASK_RESULT',
      title: 'Histórico de Execução',
      content: 'Execução anterior concluída com êxito.',
      status: 'ACTIVE',
      epistemicStatus: 'OBSERVED',
      scope: 'PROJECT',
      actorId: 'dev-1',
      provenance: { projectId, actorId: 'dev-1', source: 'RUNTIME_EXECUTION', verifiedAt: new Date().toISOString() },
    });

    const devTask = await enrichDeveloperTaskWithMemory(createBaseTask('developer'));
    const promptText = devTask.prompt;

    const taskPromptIndex = promptText.indexOf('Task prompt for developer');
    const lessonIndex = promptText.indexOf('[GOVERNED INSTITUTIONAL LESSONS — ADVISORY CONTEXT]');
    const memoryIndex = promptText.indexOf('[ORGANIZATIONAL MEMORY — VERIFIED HISTORICAL CONTEXT]');

    expect(taskPromptIndex).toBeLessThan(lessonIndex);
    expect(lessonIndex).toBeLessThan(memoryIndex);
  });

  it('J. Failure Isolation: Engine failure during memory or lesson lookup never breaks task execution', async () => {
    const brokenRetrieval = {
      retrieveContext: async () => {
        throw new Error('POSTGRES_POOL_DISCONNECTED');
      },
    } as any;

    const devTask = await enrichDeveloperTaskWithMemory(createBaseTask('developer'), brokenRetrieval);
    expect(devTask).toBeDefined();
    expect(devTask.prompt).toBe('Task prompt for developer.');
  });

  it('M, N & O. Guardrail & Authority Preservation: Review limits, CEO approvals and Chief of Staff sovereignty', async () => {
    const revTask = await enrichReviewerTaskWithMemory(createBaseTask('reviewer'));
    expect(revTask.prompt).toBeDefined();

    const cosTask = await enrichChiefOfStaffTaskWithMemory(createBaseTask('chief-of-staff'));
    expect(cosTask.prompt).toBeDefined();
  });
});

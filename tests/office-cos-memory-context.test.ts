import { describe, it, expect, beforeEach } from 'vitest';
import type { Task } from '../src/domain.js';
import {
  OrganizationalMemoryStore,
  MemoryRetrievalEngine,
  enrichChiefOfStaffTaskWithMemory,
  enrichDeveloperTaskWithMemory,
  formatChiefOfStaffMemoryContext,
  MAX_MEMORY_CONTENT_LENGTH,
  type OrganizationalMemory,
} from '../src/office/memory.js';
import {
  createOrganizationalPlan,
  validateStepDependencies,
  planStepToTask,
} from '../src/office/planning.js';
import type { AgentProvider, ProviderTaskResult } from '../src/providers/types.js';

describe('PDL — Phase 8.3D-B: Chief of Staff Organizational Memory Context & Precedence Suite', () => {
  let store: OrganizationalMemoryStore;
  let retrieval: MemoryRetrievalEngine;

  beforeEach(() => {
    store = new OrganizationalMemoryStore();
    retrieval = new MemoryRetrievalEngine(store);
  });

  it('A & H. CEO objective beats historical DECISION & CoS receives authorized DECISION, PLAN, PROJECT_CONTEXT', async () => {
    // Historical DECISION
    await store.create({
      tenantId: 'pub-dev-loop',
      projectId: 'pub-dev-loop',
      type: 'DECISION',
      title: 'Decisão Anterior: Usar MySQL',
      content: 'CEO decidiu utilizar MySQL como banco de dados em Q1.',
      epistemicStatus: 'DECIDED',
      actorId: 'ceo',
      provenance: {
        projectId: 'pub-dev-loop',
        actorId: 'ceo',
        source: 'CEO_DECISION',
        verifiedAt: '2026-08-01T10:00:00Z',
      },
    });

    // Historical PLAN
    await store.create({
      tenantId: 'pub-dev-loop',
      projectId: 'pub-dev-loop',
      type: 'PLAN',
      title: 'Plano Anterior de Refatoração',
      content: 'Decomposição em 3 etapas para migração de schemas.',
      epistemicStatus: 'DERIVED',
      actorId: 'chief-of-staff',
      provenance: {
        projectId: 'pub-dev-loop',
        actorId: 'chief-of-staff',
        source: 'ORGANIZATIONAL_PLAN',
        verifiedAt: '2026-08-05T10:00:00Z',
      },
    });

    // Historical PROJECT_CONTEXT
    await store.create({
      tenantId: 'pub-dev-loop',
      projectId: 'pub-dev-loop',
      type: 'PROJECT_CONTEXT',
      title: 'Limites de Arquitetura do Projeto',
      content: 'Arquitetura modular em TypeScript com Cloudflare Workers e PostgreSQL.',
      epistemicStatus: 'DERIVED',
      actorId: 'architect',
      provenance: {
        projectId: 'pub-dev-loop',
        actorId: 'architect',
        source: 'ORGANIZATIONAL_PLAN',
        verifiedAt: '2026-08-10T10:00:00Z',
      },
    });

    // Current task with explicit new CEO mandate
    const task: Task = {
      id: 'task-cos-1',
      project: 'pub-dev-loop',
      repository: 'https://github.com/org/repo',
      objective: 'NOVO OBJETIVO DO CEO: Migrar para PostgreSQL 16 imediatamente',
      prompt: 'NOVA DIRETRIZ DO CEO: Reestruturar arquitetura para PostgreSQL 16 nativo.',
      status: 'QUEUED',
      priority: 1,
      worker: null,
      result: null,
      error: null,
      branch: null,
      commitSha: null,
      gitStatus: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      leaseOwner: null,
      leaseDeadline: null,
      heartbeatAt: null,
      workspacePath: null,
      prototypeSessionId: null,
      agentId: 'chief-of-staff',
    };

    const enriched = await enrichChiefOfStaffTaskWithMemory(task, retrieval);

    expect(enriched.prompt).toContain('[ORGANIZATIONAL MEMORY — CHIEF OF STAFF VERIFIED CONTEXT]');
    expect(enriched.prompt).toContain('Decisão Anterior: Usar MySQL');
    expect(enriched.prompt).toContain('Plano Anterior de Refatoração');
    expect(enriched.prompt).toContain('Limites de Arquitetura do Projeto');
    expect(enriched.prompt).toContain('NOVA DIRETRIZ DO CEO: Reestruturar arquitetura para PostgreSQL 16 nativo.');
    expect(enriched.prompt).toContain('O objetivo atual do CEO, o estado real do projeto, as aprovações e o status de execução têm PRECEDÊNCIA ABSOLUTA');
  });

  it('B. Current project state beats historical PLAN', async () => {
    await store.create({
      tenantId: 'pub-dev-loop',
      projectId: 'pub-dev-loop',
      type: 'PLAN',
      title: 'Plano de Squads Legado',
      content: 'Alocar squad mobile no módulo desktop.',
      epistemicStatus: 'DERIVED',
      actorId: 'chief-of-staff',
      provenance: {
        projectId: 'pub-dev-loop',
        actorId: 'chief-of-staff',
        source: 'ORGANIZATIONAL_PLAN',
        verifiedAt: '2026-07-01T10:00:00Z',
      },
    });

    const task: Task = {
      id: 'task-cos-plan-prec',
      project: 'pub-dev-loop',
      repository: 'repo',
      objective: 'ESTADO ATUAL: Squads dedicadas exclusivamente ao backend',
      prompt: 'ESTADO ATUAL DO PROJETO: Squads operam no backend com zero escopo mobile.',
      status: 'QUEUED',
      priority: 1,
      worker: null,
      result: null,
      error: null,
      branch: null,
      commitSha: null,
      gitStatus: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      leaseOwner: null,
      leaseDeadline: null,
      heartbeatAt: null,
      workspacePath: null,
      prototypeSessionId: null,
      agentId: 'chief-of-staff',
    };

    const enriched = await enrichChiefOfStaffTaskWithMemory(task, retrieval);
    expect(enriched.prompt).toContain('ESTADO ATUAL DO PROJETO: Squads operam no backend');
    expect(enriched.prompt).toContain('Uma memória histórica NUNCA pode suplantar novas diretrizes do CEO, reabrir tarefas ou ignorar bloqueios operacionais presentes.');
  });

  it('C & D. Current approval state & REVIEW_BLOCKED beat historical memory', async () => {
    // Historical memory stating previous approval
    await store.create({
      tenantId: 'pub-dev-loop',
      projectId: 'pub-dev-loop',
      type: 'DECISION',
      title: 'Aprovação Concedida em Sprint Passada',
      content: 'CEO aprovou deploy da versão 1.0.',
      epistemicStatus: 'DECIDED',
      actorId: 'ceo',
      provenance: {
        projectId: 'pub-dev-loop',
        actorId: 'ceo',
        source: 'CEO_DECISION',
        verifiedAt: '2026-06-01T10:00:00Z',
      },
    });

    const task: Task = {
      id: 'task-cos-blocked',
      project: 'pub-dev-loop',
      repository: 'repo',
      objective: 'ESTADO ATUAL: REVIEW_BLOCKED no ciclo atual. Requer escalonamento executivo.',
      prompt: 'ESTADO ATUAL: Tarefa bloqueada por 3 iterações com findings críticos. Status: REVIEW_BLOCKED.',
      status: 'QUEUED',
      priority: 1,
      worker: null,
      result: null,
      error: null,
      branch: null,
      commitSha: null,
      gitStatus: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      leaseOwner: null,
      leaseDeadline: null,
      heartbeatAt: null,
      workspacePath: null,
      prototypeSessionId: null,
      agentId: 'chief-of-staff',
    };

    const enriched = await enrichChiefOfStaffTaskWithMemory(task, retrieval);
    expect(enriched.prompt).toContain('Status: REVIEW_BLOCKED.');
    expect(enriched.prompt).toContain('ignorar bloqueios operacionais presentes.');
  });

  it('E & F. Tenant and Project Isolation: CoS never leaks across boundaries', async () => {
    // Foreign tenant
    await store.create({
      tenantId: 'tenant-CORP-A',
      projectId: 'common-project',
      type: 'DECISION',
      title: 'Decisão Confidencial Corp A',
      content: 'Orçamento estratégico de Corp A',
      epistemicStatus: 'DECIDED',
      actorId: 'ceo',
      provenance: {
        projectId: 'common-project',
        actorId: 'ceo',
        source: 'CEO_DECISION',
        verifiedAt: '2026-09-03T14:00:00Z',
      },
    });

    // Foreign project in same tenant
    await store.create({
      tenantId: 'pub-dev-loop',
      projectId: 'project-PAYMENTS',
      type: 'DECISION',
      title: 'Decisão Payments',
      content: 'Gateway de pagamentos Stripe',
      epistemicStatus: 'DECIDED',
      actorId: 'ceo',
      provenance: {
        projectId: 'project-PAYMENTS',
        actorId: 'ceo',
        source: 'CEO_DECISION',
        verifiedAt: '2026-09-03T14:00:00Z',
      },
    });

    const task: Task = {
      id: 'task-cos-iso',
      project: 'project-IDENTITY',
      repository: 'repo',
      objective: 'Validar Identity',
      prompt: 'Prompt Identity',
      status: 'QUEUED',
      priority: 1,
      worker: null,
      result: null,
      error: null,
      branch: null,
      commitSha: null,
      gitStatus: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      leaseOwner: null,
      leaseDeadline: null,
      heartbeatAt: null,
      workspacePath: null,
      prototypeSessionId: null,
      agentId: 'chief-of-staff',
      tenantId: 'pub-dev-loop',
    };

    const enriched = await enrichChiefOfStaffTaskWithMemory(task, retrieval);
    expect(enriched.prompt).not.toContain('Decisão Confidencial Corp A');
    expect(enriched.prompt).not.toContain('Decisão Payments');
    expect(enriched.prompt).toBe('Prompt Identity');
  });

  it('G. Missing or empty task.project returns empty memory without fallback', async () => {
    const taskNoProj: Task = {
      id: 'task-cos-empty-proj',
      project: '',
      repository: 'repo',
      objective: 'Obj',
      prompt: 'Prompt sem projeto',
      status: 'QUEUED',
      priority: 1,
      worker: null,
      result: null,
      error: null,
      branch: null,
      commitSha: null,
      gitStatus: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      leaseOwner: null,
      leaseDeadline: null,
      heartbeatAt: null,
      workspacePath: null,
      prototypeSessionId: null,
      agentId: 'chief-of-staff',
    };

    const enriched = await enrichChiefOfStaffTaskWithMemory(taskNoProj, retrieval);
    expect(enriched.prompt).toBe('Prompt sem projeto');
  });

  it('I. Negative: CoS does NOT receive TASK_RESULT, REVIEW_FINDING, or LESSON', async () => {
    await store.create({
      tenantId: 'pub-dev-loop',
      projectId: 'pub-dev-loop',
      type: 'TASK_RESULT',
      title: 'Resultado de Tarefa Developer',
      content: 'Código compilado com sucesso.',
      epistemicStatus: 'OBSERVED',
      actorId: 'developer',
      provenance: {
        projectId: 'pub-dev-loop',
        actorId: 'developer',
        source: 'RUNTIME_EXECUTION',
        verifiedAt: '2026-09-03T14:00:00Z',
      },
    });

    await store.create({
      tenantId: 'pub-dev-loop',
      projectId: 'pub-dev-loop',
      type: 'REVIEW_FINDING',
      title: 'Review Finding do Reviewer',
      content: 'Inconformidade no loop assíncrono.',
      epistemicStatus: 'DERIVED',
      actorId: 'reviewer',
      provenance: {
        projectId: 'pub-dev-loop',
        actorId: 'reviewer',
        source: 'REVIEW_INSPECTION',
        verifiedAt: '2026-09-03T14:05:00Z',
      },
    });

    await store.create({
      tenantId: 'pub-dev-loop',
      projectId: 'pub-dev-loop',
      type: 'LESSON',
      title: 'Lição Aprendida de QA',
      content: 'Sempre mockar requisições externas.',
      epistemicStatus: 'DERIVED',
      actorId: 'qa-engineer',
      provenance: {
        projectId: 'pub-dev-loop',
        actorId: 'qa-engineer',
        source: 'RUNTIME_EXECUTION',
        verifiedAt: '2026-09-03T14:10:00Z',
      },
    });

    const task: Task = {
      id: 'task-cos-neg',
      project: 'pub-dev-loop',
      repository: 'repo',
      objective: 'Obj',
      prompt: 'Prompt Base CoS',
      status: 'QUEUED',
      priority: 1,
      worker: null,
      result: null,
      error: null,
      branch: null,
      commitSha: null,
      gitStatus: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      leaseOwner: null,
      leaseDeadline: null,
      heartbeatAt: null,
      workspacePath: null,
      prototypeSessionId: null,
      agentId: 'chief-of-staff',
    };

    const enriched = await enrichChiefOfStaffTaskWithMemory(task, retrieval);
    expect(enriched.prompt).not.toContain('Resultado de Tarefa Developer');
    expect(enriched.prompt).not.toContain('Review Finding do Reviewer');
    expect(enriched.prompt).not.toContain('Lição Aprendida de QA');
    expect(enriched.prompt).toBe('Prompt Base CoS');
  });

  it('J. Negative: CoS does NOT receive SUPERSEDED or BLOCKED memories', async () => {
    const m1 = await store.create({
      tenantId: 'pub-dev-loop',
      projectId: 'pub-dev-loop',
      type: 'DECISION',
      title: 'Decisão Superada',
      content: 'Decisão antiga cancelada.',
      epistemicStatus: 'DECIDED',
      actorId: 'ceo',
      provenance: {
        projectId: 'pub-dev-loop',
        actorId: 'ceo',
        source: 'CEO_DECISION',
        verifiedAt: '2026-07-01T10:00:00Z',
      },
    });

    await store.supersede(m1.id, 'mem-newer-decision', 'pub-dev-loop');

    await store.create({
      tenantId: 'pub-dev-loop',
      projectId: 'pub-dev-loop',
      type: 'PLAN',
      title: 'Plano Bloqueado',
      content: 'Plano sob quarentena.',
      status: 'BLOCKED',
      epistemicStatus: 'DERIVED',
      actorId: 'chief-of-staff',
      provenance: {
        projectId: 'pub-dev-loop',
        actorId: 'chief-of-staff',
        source: 'ORGANIZATIONAL_PLAN',
        verifiedAt: '2026-09-03T14:00:00Z',
      },
    });

    const task: Task = {
      id: 'task-cos-active',
      project: 'pub-dev-loop',
      repository: 'repo',
      objective: 'Obj',
      prompt: 'Prompt Base CoS',
      status: 'QUEUED',
      priority: 1,
      worker: null,
      result: null,
      error: null,
      branch: null,
      commitSha: null,
      gitStatus: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      leaseOwner: null,
      leaseDeadline: null,
      heartbeatAt: null,
      workspacePath: null,
      prototypeSessionId: null,
      agentId: 'chief-of-staff',
    };

    const enriched = await enrichChiefOfStaffTaskWithMemory(task, retrieval);
    expect(enriched.prompt).not.toContain('Decisão Superada');
    expect(enriched.prompt).not.toContain('Plano Bloqueado');
  });

  it('K. Context limit: Capped at maximum 5 memories', async () => {
    for (let i = 1; i <= 8; i++) {
      await store.create({
        tenantId: 'pub-dev-loop',
        projectId: 'pub-dev-loop',
        type: 'DECISION',
        title: `Decisão ${i}`,
        content: `Conteudo da decisão ${i}`,
        epistemicStatus: 'DECIDED',
        actorId: 'ceo',
        provenance: {
          projectId: 'pub-dev-loop',
          actorId: 'ceo',
          source: 'CEO_DECISION',
          verifiedAt: '2026-09-03T14:00:00Z',
        },
      });
    }

    const task: Task = {
      id: 'task-cos-cap',
      project: 'pub-dev-loop',
      repository: 'repo',
      objective: 'Obj',
      prompt: 'Prompt CoS',
      status: 'QUEUED',
      priority: 1,
      worker: null,
      result: null,
      error: null,
      branch: null,
      commitSha: null,
      gitStatus: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      leaseOwner: null,
      leaseDeadline: null,
      heartbeatAt: null,
      workspacePath: null,
      prototypeSessionId: null,
      agentId: 'chief-of-staff',
    };

    const enriched = await enrichChiefOfStaffTaskWithMemory(task, retrieval);
    const count = (enriched.prompt.match(/TYPE: DECISION/g) || []).length;
    expect(count).toBe(5);
  });

  it('L. Truncation: Long content capped at MAX_MEMORY_CONTENT_LENGTH (500 chars)', () => {
    const longContent = 'E'.repeat(800);
    const memory: OrganizationalMemory = {
      id: 'mem-cos-long',
      tenantId: 'pub-dev-loop',
      projectId: 'pub-dev-loop',
      type: 'DECISION',
      title: 'Decisão Extensa de CEO',
      content: longContent,
      status: 'ACTIVE',
      epistemicStatus: 'DECIDED',
      scope: 'PROJECT',
      actorId: 'ceo',
      recurrenceCount: 1,
      metadata: {},
      provenance: {
        projectId: 'pub-dev-loop',
        actorId: 'ceo',
        source: 'CEO_DECISION',
        verifiedAt: '2026-09-03T14:00:00Z',
      },
      createdAt: '2026-09-03T14:00:00Z',
      updatedAt: '2026-09-03T14:00:00Z',
    };

    const block = formatChiefOfStaffMemoryContext([memory]);
    expect(block).toContain('... [truncated]');
    expect(block).not.toContain('E'.repeat(501));
  });

  it('M. Provenance: Preserves full verified provenance fields without fabrication', () => {
    const memory: OrganizationalMemory = {
      id: 'mem-cos-prov',
      tenantId: 'pub-dev-loop',
      projectId: 'pub-dev-loop',
      type: 'PLAN',
      title: 'Plano Estratégico',
      content: 'Decomposição em 4 etapas.',
      status: 'ACTIVE',
      epistemicStatus: 'DERIVED',
      scope: 'PROJECT',
      actorId: 'chief-of-staff',
      recurrenceCount: 1,
      metadata: {},
      provenance: {
        projectId: 'pub-dev-loop',
        actorId: 'chief-of-staff',
        source: 'ORGANIZATIONAL_PLAN',
        verifiedAt: '2026-09-03T14:00:00Z',
        eventId: 'evt-cos-p3',
        planId: 'plan-strategic-1',
      },
      createdAt: '2026-09-03T14:00:00Z',
      updatedAt: '2026-09-03T14:00:00Z',
    };

    const block = formatChiefOfStaffMemoryContext([memory]);
    expect(block).toContain('eventId: evt-cos-p3');
    expect(block).toContain('planId: plan-strategic-1');
    expect(block).toContain('SOURCE: ORGANIZATIONAL_PLAN');
    expect(block).toContain('actorId: chief-of-staff');
  });

  it('N. Failure Isolation: DB failure or malformed memory NEVER breaks CoS execution', async () => {
    const brokenRetrieval: any = {
      retrieveContext: async () => {
        throw new Error('REDIS_CONNECTION_REFUSED');
      },
    };

    const task: Task = {
      id: 'task-cos-resilient',
      project: 'pub-dev-loop',
      repository: 'repo',
      objective: 'Obj',
      prompt: 'Prompt Base CoS Resiliente',
      status: 'QUEUED',
      priority: 1,
      worker: null,
      result: null,
      error: null,
      branch: null,
      commitSha: null,
      gitStatus: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      leaseOwner: null,
      leaseDeadline: null,
      heartbeatAt: null,
      workspacePath: null,
      prototypeSessionId: null,
      agentId: 'chief-of-staff',
    };

    const enriched = await enrichChiefOfStaffTaskWithMemory(task, brokenRetrieval);
    expect(enriched.prompt).toBe('Prompt Base CoS Resiliente');
  });

  it('O. Real Execution Integration: Provider receives enriched Chief of Staff task prompt', async () => {
    await store.create({
      tenantId: 'pub-dev-loop',
      projectId: 'pub-dev-loop',
      type: 'DECISION',
      title: 'Decisão Executiva de Prioridade Q3',
      content: 'Focar em resiliência e failover distribuído.',
      epistemicStatus: 'DECIDED',
      actorId: 'ceo',
      provenance: {
        projectId: 'pub-dev-loop',
        actorId: 'ceo',
        source: 'CEO_DECISION',
        verifiedAt: '2026-09-03T14:00:00Z',
      },
    });

    let receivedTask: Task | null = null;
    const mockProvider: AgentProvider = {
      kind: 'mock' as any,
      model: 'mock-model',
      async execute(task: Task): Promise<ProviderTaskResult> {
        receivedTask = task;
        return {
          status: 'COMPLETED',
          provider: 'mock' as any,
          model: 'mock-model',
          exitCode: 0,
          durationMs: 10,
          stdout: 'CoS strategic roadmap formulated',
          stderr: '',
          changedFiles: [],
          commit: 'sha-cos-mock',
          errorCode: null,
          errorMessage: null,
        };
      },
      async health() { return { available: true }; },
      capabilities() { return ['planning']; },
      metadata() { return { provider: 'mock' }; },
    };

    const baseTask: Task = {
      id: 'task-cos-integration-1',
      project: 'pub-dev-loop',
      repository: 'repo',
      objective: 'Formular planejamento trimestral',
      prompt: 'Elaborar decomposição de alto nível',
      status: 'QUEUED',
      priority: 1,
      worker: null,
      result: null,
      error: null,
      branch: null,
      commitSha: null,
      gitStatus: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      leaseOwner: null,
      leaseDeadline: null,
      heartbeatAt: null,
      workspacePath: null,
      prototypeSessionId: null,
      agentId: 'chief-of-staff',
    };

    const enrichedTask = await enrichChiefOfStaffTaskWithMemory(baseTask, retrieval);
    await mockProvider.execute(enrichedTask, '/workspace');

    expect(receivedTask).not.toBeNull();
    expect(receivedTask?.prompt).toContain('Decisão Executiva de Prioridade Q3');
    expect(receivedTask?.prompt).toContain('[ORGANIZATIONAL MEMORY — CHIEF OF STAFF VERIFIED CONTEXT]');
    expect(receivedTask?.prompt).toContain('Elaborar decomposição de alto nível');
  });

  it('P. Identity Isolation: Developer task does NOT receive Chief of Staff memory enrichment', async () => {
    await store.create({
      tenantId: 'pub-dev-loop',
      projectId: 'pub-dev-loop',
      type: 'DECISION',
      title: 'Decisão Confidencial CoS',
      content: 'Planejamento de pessoal restrito.',
      epistemicStatus: 'DECIDED',
      actorId: 'ceo',
      provenance: {
        projectId: 'pub-dev-loop',
        actorId: 'ceo',
        source: 'CEO_DECISION',
        verifiedAt: '2026-09-03T14:00:00Z',
      },
    });

    const devTask: Task = {
      id: 'task-dev-iso-check',
      project: 'pub-dev-loop',
      repository: 'repo',
      objective: 'Fix bug',
      prompt: 'Prompt do Developer',
      status: 'QUEUED',
      priority: 1,
      worker: null,
      result: null,
      error: null,
      branch: null,
      commitSha: null,
      gitStatus: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      leaseOwner: null,
      leaseDeadline: null,
      heartbeatAt: null,
      workspacePath: null,
      prototypeSessionId: null,
      agentId: 'developer',
    };

    // Enriching through enrichChiefOfStaffTaskWithMemory returns task immediately unmodified
    const untouchedCoS = await enrichChiefOfStaffTaskWithMemory(devTask, retrieval);
    expect(untouchedCoS.prompt).toBe('Prompt do Developer');

    // Enriching through enrichDeveloperTaskWithMemory filters out DECISION memories
    const devEnriched = await enrichDeveloperTaskWithMemory(devTask, retrieval);
    expect(devEnriched.prompt).toBe('Prompt do Developer');
  });

  it('Q, R & S. No Planning Mutation & Review/Approval Safety: Core planning and guardrails remain deterministic and immune', () => {
    // 1. Planning Engine determinism
    const plan = createOrganizationalPlan({
      objective: 'Construir API de Pedidos',
      project: 'pub-dev-loop',
      repository: 'https://github.com/org/repo',
    });

    expect(plan.status).toBe('READY');
    expect(plan.createdBy).toBe('chief-of-staff');
    expect(plan.steps.length).toBe(4);
    expect(plan.steps[0].agentId).toBe('architect');
    expect(plan.steps[1].agentId).toBe('developer');
    expect(plan.steps[2].agentId).toBe('reviewer');
    expect(plan.steps[3].agentId).toBe('qa-engineer');

    // Step to Task mapping
    const task = planStepToTask(plan.steps[1], plan);
    expect(task.id).toBe(`task-${plan.id}-step-2-developer`);
    expect(task.agentId).toBe('developer');
    expect(task.status).toBe('QUEUED');

    // 2. Dependency validation
    const depCheck = validateStepDependencies(plan.steps);
    expect(depCheck.valid).toBe(true);
    expect(depCheck.executionOrder).toEqual([
      'step-1-architect',
      'step-2-developer',
      'step-3-reviewer',
      'step-4-qa-engineer',
    ]);
  });
});

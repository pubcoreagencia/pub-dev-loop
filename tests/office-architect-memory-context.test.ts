import { describe, it, expect, beforeEach } from 'vitest';
import type { Task } from '../src/domain.js';
import {
  OrganizationalMemoryStore,
  MemoryRetrievalEngine,
  enrichArchitectTaskWithMemory,
  formatArchitectMemoryContext,
  MAX_MEMORY_CONTENT_LENGTH,
  type OrganizationalMemory,
} from '../src/office/memory.js';
import type { AgentProvider, ProviderTaskResult } from '../src/providers/types.js';

describe('PDL — Phase 8.3A: Architect Organizational Memory Context & Hardening Suite', () => {
  let store: OrganizationalMemoryStore;
  let retrieval: MemoryRetrievalEngine;

  beforeEach(() => {
    store = new OrganizationalMemoryStore();
    retrieval = new MemoryRetrievalEngine(store);
  });

  it('1. Architect receives relevant architectural memories (DECISION, PLAN, REVIEW_FINDING, PROJECT_CONTEXT)', async () => {
    await store.create({
      tenantId: 'pub-dev-loop',
      projectId: 'pub-dev-loop',
      type: 'DECISION',
      title: 'Decisao de Arquitetura Microservices vs Monolith',
      content: 'Manter modular monolith com camadas estritas de servico.',
      epistemicStatus: 'DECIDED',
      actorId: 'ceo',
      provenance: {
        projectId: 'pub-dev-loop',
        actorId: 'ceo',
        source: 'CEO_DECISION',
        verifiedAt: '2026-09-03T14:00:00Z',
        eventId: 'evt-arch-1',
      },
    });

    await store.create({
      tenantId: 'pub-dev-loop',
      projectId: 'pub-dev-loop',
      type: 'PLAN',
      title: 'Plano de Decomposicao de Banco',
      content: 'Separar schemas de tenants e schemas core.',
      epistemicStatus: 'DERIVED',
      actorId: 'chief-of-staff',
      provenance: {
        projectId: 'pub-dev-loop',
        actorId: 'chief-of-staff',
        source: 'ORGANIZATIONAL_PLAN',
        verifiedAt: '2026-09-03T14:05:00Z',
        planId: 'plan-arch-100',
      },
    });

    const task: Task = {
      id: 'task-arch-1',
      project: 'pub-dev-loop',
      repository: 'https://github.com/org/repo',
      objective: 'Projetar contrato de integracao de novos modulos',
      prompt: 'Definir interfaces TypeScript para a camada de persistencia.',
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
      agentId: 'architect',
    };

    const enriched = await enrichArchitectTaskWithMemory(task, retrieval);

    expect(enriched.prompt).toContain('[ORGANIZATIONAL MEMORY — ARCHITECTURAL VERIFIED CONTEXT]');
    expect(enriched.prompt).toContain('Decisao de Arquitetura Microservices vs Monolith');
    expect(enriched.prompt).toContain('Plano de Decomposicao de Banco');
    expect(enriched.objective).toBe(task.objective); // Objective unmodified
  });

  it('2. Negative: Architect does NOT receive TASK_RESULT', async () => {
    await store.create({
      tenantId: 'pub-dev-loop',
      projectId: 'pub-dev-loop',
      type: 'TASK_RESULT',
      title: 'Commit de Implementacao Developer',
      content: 'Funcao addOrder() implementada.',
      epistemicStatus: 'OBSERVED',
      actorId: 'developer',
      provenance: {
        projectId: 'pub-dev-loop',
        actorId: 'developer',
        source: 'RUNTIME_EXECUTION',
        verifiedAt: '2026-09-03T14:00:00Z',
      },
    });

    const task: Task = {
      id: 'task-arch-taskres',
      project: 'pub-dev-loop',
      repository: 'repo',
      objective: 'Obj',
      prompt: 'Original prompt',
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
      agentId: 'architect',
    };

    const enriched = await enrichArchitectTaskWithMemory(task, retrieval);
    expect(enriched.prompt).not.toContain('Commit de Implementacao Developer');
    expect(enriched.prompt).toBe('Original prompt');
  });

  it('3. Negative: Architect does NOT receive LESSON', async () => {
    await store.create({
      tenantId: 'pub-dev-loop',
      projectId: 'pub-dev-loop',
      type: 'LESSON',
      title: 'Dica de Sintaxe TS',
      content: 'Usar unknown ao inves de any',
      epistemicStatus: 'DERIVED',
      actorId: 'developer',
      provenance: {
        projectId: 'pub-dev-loop',
        actorId: 'developer',
        source: 'RUNTIME_EXECUTION',
        verifiedAt: '2026-09-03T14:00:00Z',
      },
    });

    const task: Task = {
      id: 'task-arch-lesson',
      project: 'pub-dev-loop',
      repository: 'repo',
      objective: 'Obj',
      prompt: 'Original prompt',
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
      agentId: 'architect',
    };

    const enriched = await enrichArchitectTaskWithMemory(task, retrieval);
    expect(enriched.prompt).not.toContain('Dica de Sintaxe TS');
    expect(enriched.prompt).toBe('Original prompt');
  });

  it('4. Negative: Architect does NOT receive memory of another tenant', async () => {
    await store.create({
      tenantId: 'tenant-CORP-A',
      projectId: 'shared-project',
      type: 'DECISION',
      title: 'Decisao Corp A',
      content: 'Chave secreta A',
      epistemicStatus: 'DECIDED',
      actorId: 'ceo',
      provenance: {
        projectId: 'shared-project',
        actorId: 'ceo',
        source: 'CEO_DECISION',
        verifiedAt: '2026-09-03T14:00:00Z',
      },
    });

    const task: Task = {
      id: 'task-arch-tenant',
      project: 'shared-project',
      repository: 'repo',
      objective: 'Obj',
      prompt: 'Prompt',
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
      agentId: 'architect',
      tenantId: 'tenant-CORP-B',
    };

    const enriched = await enrichArchitectTaskWithMemory(task, retrieval);
    expect(enriched.prompt).not.toContain('Decisao Corp A');
    expect(enriched.prompt).toBe('Prompt');
  });

  it('5. Negative: Architect does NOT receive memory of another project', async () => {
    await store.create({
      tenantId: 'pub-dev-loop',
      projectId: 'project-FINANCE',
      type: 'DECISION',
      title: 'Decisao Financeira',
      content: 'Regras de faturamento',
      epistemicStatus: 'DECIDED',
      actorId: 'ceo',
      provenance: {
        projectId: 'project-FINANCE',
        actorId: 'ceo',
        source: 'CEO_DECISION',
        verifiedAt: '2026-09-03T14:00:00Z',
      },
    });

    const task: Task = {
      id: 'task-arch-proj',
      project: 'project-LOGISTICS',
      repository: 'repo',
      objective: 'Obj',
      prompt: 'Prompt Logistics',
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
      agentId: 'architect',
    };

    const enriched = await enrichArchitectTaskWithMemory(task, retrieval);
    expect(enriched.prompt).not.toContain('Decisao Financeira');
    expect(enriched.prompt).toBe('Prompt Logistics');
  });

  it('6 & 7. Negative: Architect does NOT receive BLOCKED or SUPERSEDED memories', async () => {
    const m1 = await store.create({
      tenantId: 'pub-dev-loop',
      projectId: 'pub-dev-loop',
      type: 'DECISION',
      title: 'Decisao Obsoleta de Schema',
      content: 'Schema legado v1',
      epistemicStatus: 'DECIDED',
      actorId: 'ceo',
      provenance: {
        projectId: 'pub-dev-loop',
        actorId: 'ceo',
        source: 'CEO_DECISION',
        verifiedAt: '2026-08-01T10:00:00Z',
      },
    });

    await store.supersede(m1.id, 'mem-schema-v2', 'pub-dev-loop');

    await store.create({
      tenantId: 'pub-dev-loop',
      projectId: 'pub-dev-loop',
      type: 'REVIEW_FINDING',
      title: 'Revisao Bloqueada',
      content: 'Bloqueio de revisao',
      status: 'BLOCKED',
      epistemicStatus: 'DERIVED',
      actorId: 'reviewer',
      provenance: {
        projectId: 'pub-dev-loop',
        actorId: 'reviewer',
        source: 'REVIEW_INSPECTION',
        verifiedAt: '2026-09-03T14:00:00Z',
      },
    });

    const task: Task = {
      id: 'task-arch-active',
      project: 'pub-dev-loop',
      repository: 'repo',
      objective: 'Obj',
      prompt: 'Prompt Base',
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
      agentId: 'architect',
    };

    const enriched = await enrichArchitectTaskWithMemory(task, retrieval);
    expect(enriched.prompt).not.toContain('Decisao Obsoleta de Schema');
    expect(enriched.prompt).not.toContain('Revisao Bloqueada');
  });

  it('8. Negative: Architect does NOT receive memory when project is empty/missing', async () => {
    const taskNoProj: Task = {
      id: 'task-arch-empty-proj',
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
      agentId: 'architect',
    };

    const enriched = await enrichArchitectTaskWithMemory(taskNoProj, retrieval);
    expect(enriched.prompt).toBe('Prompt sem projeto');
  });

  it('9. Precedence: Contradictory historical memory does not override explicit task instruction', async () => {
    await store.create({
      tenantId: 'pub-dev-loop',
      projectId: 'pub-dev-loop',
      type: 'DECISION',
      title: 'Decisao Historica: Usar GraphQL',
      content: 'Toda API externa deve adotar GraphQL.',
      epistemicStatus: 'DECIDED',
      actorId: 'ceo',
      provenance: {
        projectId: 'pub-dev-loop',
        actorId: 'ceo',
        source: 'CEO_DECISION',
        verifiedAt: '2026-08-01T10:00:00Z',
      },
    });

    const task: Task = {
      id: 'task-arch-rest',
      project: 'pub-dev-loop',
      repository: 'repo',
      objective: 'Arquitetar API RESTful para gateways',
      prompt: 'Definir endpoints seguindo estritamente padrao REST OpenAPI 3.0.',
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
      agentId: 'architect',
    };

    const enriched = await enrichArchitectTaskWithMemory(task, retrieval);
    expect(enriched.objective).toBe('Arquitetar API RESTful para gateways');
    expect(enriched.prompt).toContain('Definir endpoints seguindo estritamente padrao REST OpenAPI 3.0.');
    expect(enriched.prompt).toContain('A instrução da tarefa atual, contratos técnicos explícitos e políticas do runtime têm PRECEDÊNCIA ABSOLUTA');
  });

  it('10. Failure Isolation: DB failure does not break Architect execution', async () => {
    const brokenRetrieval: any = {
      retrieveContext: async () => {
        throw new Error('POSTGRES_POOL_TIMEOUT');
      },
    };

    const task: Task = {
      id: 'task-arch-resilient',
      project: 'pub-dev-loop',
      repository: 'repo',
      objective: 'Obj',
      prompt: 'Prompt Original Architect',
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
      agentId: 'architect',
    };

    const enriched = await enrichArchitectTaskWithMemory(task, brokenRetrieval);
    expect(enriched.prompt).toBe('Prompt Original Architect');
  });

  it('11. Context limit: Capped at maximum 5 memories', async () => {
    for (let i = 1; i <= 8; i++) {
      await store.create({
        tenantId: 'pub-dev-loop',
        projectId: 'pub-dev-loop',
        type: 'PLAN',
        title: `Plano de Arquitetura ${i}`,
        content: `Conteudo estrutural ${i}`,
        epistemicStatus: 'DERIVED',
        actorId: 'chief-of-staff',
        provenance: {
          projectId: 'pub-dev-loop',
          actorId: 'chief-of-staff',
          source: 'ORGANIZATIONAL_PLAN',
          verifiedAt: '2026-09-03T14:00:00Z',
        },
      });
    }

    const task: Task = {
      id: 'task-arch-cap',
      project: 'pub-dev-loop',
      repository: 'repo',
      objective: 'Obj',
      prompt: 'Prompt',
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
      agentId: 'architect',
    };

    const enriched = await enrichArchitectTaskWithMemory(task, retrieval);
    const count = (enriched.prompt.match(/TYPE: PLAN/g) || []).length;
    expect(count).toBe(5);
  });

  it('12. Truncation: Long content capped at MAX_MEMORY_CONTENT_LENGTH (500 chars)', () => {
    const longContent = 'B'.repeat(650);
    const memory: OrganizationalMemory = {
      id: 'mem-arch-long',
      tenantId: 'pub-dev-loop',
      projectId: 'pub-dev-loop',
      type: 'DECISION',
      title: 'Decisao Longa',
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

    const block = formatArchitectMemoryContext([memory]);
    expect(block).toContain('... [truncated]');
    expect(block).not.toContain('B'.repeat(501));
  });

  it('13. Provenance: Preserves full verified provenance fields', () => {
    const memory: OrganizationalMemory = {
      id: 'mem-arch-prov',
      tenantId: 'pub-dev-loop',
      projectId: 'pub-dev-loop',
      type: 'PLAN',
      title: 'Plano Estrutural',
      content: 'Contrato de servico',
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
        eventId: 'evt-arch-p1',
        planId: 'plan-101',
      },
      createdAt: '2026-09-03T14:00:00Z',
      updatedAt: '2026-09-03T14:00:00Z',
    };

    const block = formatArchitectMemoryContext([memory]);
    expect(block).toContain('eventId: evt-arch-p1');
    expect(block).toContain('planId: plan-101');
    expect(block).toContain('actorId: chief-of-staff');
    expect(block).toContain('SOURCE: ORGANIZATIONAL_PLAN');
  });

  it('14. Real Execution Integration: Provider receives enriched task prompt with architectural memory context', async () => {
    await store.create({
      tenantId: 'pub-dev-loop',
      projectId: 'pub-dev-loop',
      type: 'DECISION',
      title: 'Decisao de Modular Monolith',
      content: 'Isolamento de modulos via boundaries de dominio.',
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
          stdout: 'Execution passed',
          stderr: '',
          changedFiles: [],
          commit: 'sha-arch-mock',
          errorCode: null,
          errorMessage: null,
        };
      },
      async health() { return { available: true }; },
      capabilities() { return ['planning']; },
      metadata() { return { provider: 'mock' }; },
    };

    const baseTask: Task = {
      id: 'task-arch-integration-1',
      project: 'pub-dev-loop',
      repository: 'repo',
      objective: 'Projetar novo subsistema de notificacoes',
      prompt: 'Definir interfaces de pub/sub assincronas',
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
      agentId: 'architect',
    };

    const enrichedTask = await enrichArchitectTaskWithMemory(baseTask, retrieval);
    await mockProvider.execute(enrichedTask, '/workspace');

    expect(receivedTask).not.toBeNull();
    expect(receivedTask?.prompt).toContain('Decisao de Modular Monolith');
    expect(receivedTask?.prompt).toContain('[ORGANIZATIONAL MEMORY — ARCHITECTURAL VERIFIED CONTEXT]');
    expect(receivedTask?.prompt).toContain('Definir interfaces de pub/sub assincronas');
  });
});

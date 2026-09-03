import { describe, it, expect, beforeEach } from 'vitest';
import type { Task } from '../src/domain.js';
import {
  OrganizationalMemoryStore,
  MemoryRetrievalEngine,
  enrichReviewerTaskWithMemory,
  formatReviewerMemoryContext,
  MAX_MEMORY_CONTENT_LENGTH,
  type OrganizationalMemory,
} from '../src/office/memory.js';
import type { AgentProvider, ProviderTaskResult } from '../src/providers/types.js';

describe('PDL — Phase 8.3B: Reviewer Organizational Memory Context & Guardrails Suite', () => {
  let store: OrganizationalMemoryStore;
  let retrieval: MemoryRetrievalEngine;

  beforeEach(() => {
    store = new OrganizationalMemoryStore();
    retrieval = new MemoryRetrievalEngine(store);
  });

  it('1, 2 & 3. Reviewer receives authorized memory types: REVIEW_FINDING, TASK_RESULT, PROJECT_CONTEXT', async () => {
    await store.create({
      tenantId: 'pub-dev-loop',
      projectId: 'pub-dev-loop',
      type: 'REVIEW_FINDING',
      title: 'Padrão de Validação de Input',
      content: 'Revisões anteriores apontaram falhas em rotas sem schema Zod.',
      epistemicStatus: 'DERIVED',
      actorId: 'reviewer',
      provenance: {
        projectId: 'pub-dev-loop',
        actorId: 'reviewer',
        source: 'REVIEW_INSPECTION',
        verifiedAt: '2026-09-03T14:00:00Z',
        ruleId: 'SEC_INPUT_VALIDATION',
      },
    });

    await store.create({
      tenantId: 'pub-dev-loop',
      projectId: 'pub-dev-loop',
      type: 'TASK_RESULT',
      title: 'Execução Anterior de Pedidos',
      content: 'Resultado da tarefa anterior de migração de pedidos.',
      epistemicStatus: 'OBSERVED',
      actorId: 'developer',
      provenance: {
        projectId: 'pub-dev-loop',
        actorId: 'developer',
        source: 'RUNTIME_EXECUTION',
        verifiedAt: '2026-09-03T14:05:00Z',
      },
    });

    await store.create({
      tenantId: 'pub-dev-loop',
      projectId: 'pub-dev-loop',
      type: 'PROJECT_CONTEXT',
      title: 'Limites do Domínio do Projeto',
      content: 'Módulos de pagamento e checkout são isolados.',
      epistemicStatus: 'DERIVED',
      actorId: 'architect',
      provenance: {
        projectId: 'pub-dev-loop',
        actorId: 'architect',
        source: 'ORGANIZATIONAL_PLAN',
        verifiedAt: '2026-09-03T14:10:00Z',
      },
    });

    const task: Task = {
      id: 'task-rev-1',
      project: 'pub-dev-loop',
      repository: 'https://github.com/org/repo',
      objective: 'Revisar pull request de endpoints de checkout',
      prompt: 'Realizar code review detalhado no diff dos arquivos de checkout.',
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
      agentId: 'reviewer',
    };

    const enriched = await enrichReviewerTaskWithMemory(task, retrieval);

    expect(enriched.prompt).toContain('[ORGANIZATIONAL MEMORY — REVIEW HISTORICAL CONTEXT]');
    expect(enriched.prompt).toContain('Padrão de Validação de Input');
    expect(enriched.prompt).toContain('Execução Anterior de Pedidos');
    expect(enriched.prompt).toContain('Limites do Domínio do Projeto');
    expect(enriched.objective).toBe(task.objective); // Objective unmodified
  });

  it('4. Negative: Reviewer does NOT receive DECISION (CEO strategic decision)', async () => {
    await store.create({
      tenantId: 'pub-dev-loop',
      projectId: 'pub-dev-loop',
      type: 'DECISION',
      title: 'Decisão de Preços da Empresa',
      content: 'Novos tiers de preços para clientes enterprise.',
      epistemicStatus: 'DECIDED',
      actorId: 'ceo',
      provenance: {
        projectId: 'pub-dev-loop',
        actorId: 'ceo',
        source: 'CEO_DECISION',
        verifiedAt: '2026-09-03T14:00:00Z',
      },
    });

    const task: Task = {
      id: 'task-rev-dec',
      project: 'pub-dev-loop',
      repository: 'repo',
      objective: 'Obj',
      prompt: 'Prompt Original Reviewer',
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
      agentId: 'reviewer',
    };

    const enriched = await enrichReviewerTaskWithMemory(task, retrieval);
    expect(enriched.prompt).not.toContain('Decisão de Preços da Empresa');
    expect(enriched.prompt).toBe('Prompt Original Reviewer');
  });

  it('5 & 6. Negative: Reviewer does NOT receive BLOCKED or SUPERSEDED memories', async () => {
    const m1 = await store.create({
      tenantId: 'pub-dev-loop',
      projectId: 'pub-dev-loop',
      type: 'REVIEW_FINDING',
      title: 'Finding Obsoleto',
      content: 'Regra antiga revogada',
      epistemicStatus: 'DERIVED',
      actorId: 'reviewer',
      provenance: {
        projectId: 'pub-dev-loop',
        actorId: 'reviewer',
        source: 'REVIEW_INSPECTION',
        verifiedAt: '2026-08-01T10:00:00Z',
      },
    });

    await store.supersede(m1.id, 'mem-newer-finding', 'pub-dev-loop');

    await store.create({
      tenantId: 'pub-dev-loop',
      projectId: 'pub-dev-loop',
      type: 'REVIEW_FINDING',
      title: 'Finding Bloqueado',
      content: 'Bloqueado por compliance',
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
      id: 'task-rev-active',
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
      agentId: 'reviewer',
    };

    const enriched = await enrichReviewerTaskWithMemory(task, retrieval);
    expect(enriched.prompt).not.toContain('Finding Obsoleto');
    expect(enriched.prompt).not.toContain('Finding Bloqueado');
  });

  it('7 & 8. Tenant and Project Isolation: Reviewer never leaks across boundaries', async () => {
    // Foreign tenant
    await store.create({
      tenantId: 'tenant-CORP-A',
      projectId: 'common-project',
      type: 'REVIEW_FINDING',
      title: 'Finding Corp A',
      content: 'Informação confidencial A',
      epistemicStatus: 'DERIVED',
      actorId: 'reviewer',
      provenance: {
        projectId: 'common-project',
        actorId: 'reviewer',
        source: 'REVIEW_INSPECTION',
        verifiedAt: '2026-09-03T14:00:00Z',
      },
    });

    // Foreign project in same tenant
    await store.create({
      tenantId: 'pub-dev-loop',
      projectId: 'project-FINANCE',
      type: 'REVIEW_FINDING',
      title: 'Finding Finance',
      content: 'Regra interna Finance',
      epistemicStatus: 'DERIVED',
      actorId: 'reviewer',
      provenance: {
        projectId: 'project-FINANCE',
        actorId: 'reviewer',
        source: 'REVIEW_INSPECTION',
        verifiedAt: '2026-09-03T14:00:00Z',
      },
    });

    const task: Task = {
      id: 'task-rev-iso',
      project: 'project-LOGISTICS',
      repository: 'repo',
      objective: 'Revisar Logistics',
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
      agentId: 'reviewer',
      tenantId: 'pub-dev-loop',
    };

    const enriched = await enrichReviewerTaskWithMemory(task, retrieval);
    expect(enriched.prompt).not.toContain('Finding Corp A');
    expect(enriched.prompt).not.toContain('Finding Finance');
    expect(enriched.prompt).toBe('Prompt Logistics');
  });

  it('9. Missing or empty task.project returns empty memory without fallback', async () => {
    const taskNoProj: Task = {
      id: 'task-rev-empty-proj',
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
      agentId: 'reviewer',
    };

    const enriched = await enrichReviewerTaskWithMemory(taskNoProj, retrieval);
    expect(enriched.prompt).toBe('Prompt sem projeto');
  });

  it('10. Context limit: Capped at maximum 5 memories', async () => {
    for (let i = 1; i <= 8; i++) {
      await store.create({
        tenantId: 'pub-dev-loop',
        projectId: 'pub-dev-loop',
        type: 'REVIEW_FINDING',
        title: `Finding ${i}`,
        content: `Conteudo de finding ${i}`,
        epistemicStatus: 'DERIVED',
        actorId: 'reviewer',
        provenance: {
          projectId: 'pub-dev-loop',
          actorId: 'reviewer',
          source: 'REVIEW_INSPECTION',
          verifiedAt: '2026-09-03T14:00:00Z',
        },
      });
    }

    const task: Task = {
      id: 'task-rev-cap',
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
      agentId: 'reviewer',
    };

    const enriched = await enrichReviewerTaskWithMemory(task, retrieval);
    const count = (enriched.prompt.match(/TYPE: REVIEW_FINDING/g) || []).length;
    expect(count).toBe(5);
  });

  it('11. Truncation: Long content capped at MAX_MEMORY_CONTENT_LENGTH (500 chars)', () => {
    const longContent = 'C'.repeat(750);
    const memory: OrganizationalMemory = {
      id: 'mem-rev-long',
      tenantId: 'pub-dev-loop',
      projectId: 'pub-dev-loop',
      type: 'REVIEW_FINDING',
      title: 'Finding Extenso',
      content: longContent,
      status: 'ACTIVE',
      epistemicStatus: 'DERIVED',
      scope: 'PROJECT',
      actorId: 'reviewer',
      recurrenceCount: 1,
      metadata: {},
      provenance: {
        projectId: 'pub-dev-loop',
        actorId: 'reviewer',
        source: 'REVIEW_INSPECTION',
        verifiedAt: '2026-09-03T14:00:00Z',
      },
      createdAt: '2026-09-03T14:00:00Z',
      updatedAt: '2026-09-03T14:00:00Z',
    };

    const block = formatReviewerMemoryContext([memory]);
    expect(block).toContain('... [truncated]');
    expect(block).not.toContain('C'.repeat(501));
  });

  it('12. Review Evidence Precedence: Current execution evidence ALWAYS wins over contradictory historical memory', async () => {
    // Historical memory stating previous test pass
    await store.create({
      tenantId: 'pub-dev-loop',
      projectId: 'pub-dev-loop',
      type: 'TASK_RESULT',
      title: 'Execução Anterior com Sucesso',
      content: 'Todos os testes passaram no commit anterior.',
      epistemicStatus: 'OBSERVED',
      actorId: 'developer',
      provenance: {
        projectId: 'pub-dev-loop',
        actorId: 'developer',
        source: 'RUNTIME_EXECUTION',
        verifiedAt: '2026-08-01T10:00:00Z',
      },
    });

    // Current task with active failing test evidence
    const task: Task = {
      id: 'task-rev-failing-evidence',
      project: 'pub-dev-loop',
      repository: 'repo',
      objective: 'Revisar PR com falha em testes unitarios',
      prompt: 'DIFF OBSERVADO: Erro no teste de soma (exitCode 1). Identificar falha e solicitar correcao.',
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
      agentId: 'reviewer',
    };

    const enriched = await enrichReviewerTaskWithMemory(task, retrieval);
    expect(enriched.prompt).toContain('DIFF OBSERVADO: Erro no teste de soma (exitCode 1).');
    expect(enriched.prompt).toContain('O estado atual do código, diff, testes, typecheck, build e execution result têm PRECEDÊNCIA ABSOLUTA');
    expect(enriched.prompt).toContain('Uma memória histórica NUNCA pode suplantar ou invalidar falhas ou findings observados na execução presente.');
  });

  it('13 & 14. Failure Isolation: DB failure or malformed memory NEVER breaks Reviewer execution', async () => {
    const brokenRetrieval: any = {
      retrieveContext: async () => {
        throw new Error('REDIS_CONNECTION_REFUSED');
      },
    };

    const task: Task = {
      id: 'task-rev-resilient',
      project: 'pub-dev-loop',
      repository: 'repo',
      objective: 'Obj',
      prompt: 'Prompt Original Reviewer Resiliente',
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
      agentId: 'reviewer',
    };

    const enriched = await enrichReviewerTaskWithMemory(task, brokenRetrieval);
    expect(enriched.prompt).toBe('Prompt Original Reviewer Resiliente');
  });

  it('15. Provenance: Preserves full verified provenance fields without fabrication', () => {
    const memory: OrganizationalMemory = {
      id: 'mem-rev-prov',
      tenantId: 'pub-dev-loop',
      projectId: 'pub-dev-loop',
      type: 'REVIEW_FINDING',
      title: 'Falta de Sanitização de Headers',
      content: 'Headers de autenticação não foram validados.',
      status: 'ACTIVE',
      epistemicStatus: 'DERIVED',
      scope: 'PROJECT',
      actorId: 'reviewer',
      recurrenceCount: 2,
      metadata: {},
      provenance: {
        projectId: 'pub-dev-loop',
        actorId: 'reviewer',
        source: 'REVIEW_INSPECTION',
        verifiedAt: '2026-09-03T14:00:00Z',
        eventId: 'evt-rev-p2',
        taskId: 'task-old-rev',
        ruleId: 'SEC_AUTH_HEADERS',
        commitSha: 'sha-rev-verified',
      },
      createdAt: '2026-09-03T14:00:00Z',
      updatedAt: '2026-09-03T14:00:00Z',
    };

    const block = formatReviewerMemoryContext([memory]);
    expect(block).toContain('eventId: evt-rev-p2');
    expect(block).toContain('taskId: task-old-rev');
    expect(block).toContain('ruleId: SEC_AUTH_HEADERS');
    expect(block).toContain('commitSha: sha-rev-verified');
    expect(block).toContain('SOURCE: REVIEW_INSPECTION');
    expect(block).toContain('recurrenceCount: 2');
  });

  it('16. Real Execution Integration: Provider receives enriched Reviewer task prompt', async () => {
    await store.create({
      tenantId: 'pub-dev-loop',
      projectId: 'pub-dev-loop',
      type: 'REVIEW_FINDING',
      title: 'Checagem Obrigatória de Nullability',
      content: 'Campos opcionais devem ser validados com optional chaining.',
      epistemicStatus: 'DERIVED',
      actorId: 'reviewer',
      provenance: {
        projectId: 'pub-dev-loop',
        actorId: 'reviewer',
        source: 'REVIEW_INSPECTION',
        verifiedAt: '2026-09-03T14:00:00Z',
        ruleId: 'TS_OPTIONAL_CHAINING',
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
          stdout: 'Review inspection completed',
          stderr: '',
          changedFiles: [],
          commit: 'sha-rev-mock',
          errorCode: null,
          errorMessage: null,
        };
      },
      async health() { return { available: true }; },
      capabilities() { return ['planning']; },
      metadata() { return { provider: 'mock' }; },
    };

    const baseTask: Task = {
      id: 'task-rev-integration-1',
      project: 'pub-dev-loop',
      repository: 'repo',
      objective: 'Revisar PR de autenticacao',
      prompt: 'Analisar diff de auth.ts contra regras de seguranca',
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
      agentId: 'reviewer',
    };

    const enrichedTask = await enrichReviewerTaskWithMemory(baseTask, retrieval);
    await mockProvider.execute(enrichedTask, '/workspace');

    expect(receivedTask).not.toBeNull();
    expect(receivedTask?.prompt).toContain('Checagem Obrigatória de Nullability');
    expect(receivedTask?.prompt).toContain('[ORGANIZATIONAL MEMORY — REVIEW HISTORICAL CONTEXT]');
    expect(receivedTask?.prompt).toContain('Analisar diff de auth.ts contra regras de seguranca');
  });
});

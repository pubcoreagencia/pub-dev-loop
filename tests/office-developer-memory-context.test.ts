import { describe, it, expect, beforeEach } from 'vitest';
import type { Task } from '../src/domain.js';
import {
  OrganizationalMemoryStore,
  MemoryRetrievalEngine,
  enrichDeveloperTaskWithMemory,
  formatDeveloperMemoryContext,
  type OrganizationalMemory,
} from '../src/office/memory.js';
import type { AgentProvider, ProviderTaskResult } from '../src/providers/types.js';

describe('PDL — Phase 8.2A: Developer Organizational Memory Context Suite', () => {
  let store: OrganizationalMemoryStore;
  let retrieval: MemoryRetrievalEngine;

  beforeEach(() => {
    store = new OrganizationalMemoryStore();
    retrieval = new MemoryRetrievalEngine(store);
  });

  it('1. Developer receives relevant memory in prompt context', async () => {
    await store.create({
      tenantId: 'pub-dev-loop',
      projectId: 'pub-dev-loop',
      type: 'REVIEW_FINDING',
      title: 'Validacao de Entrada Obrigatoria',
      content: 'Parametros de query devem ser sanitizados com Zod antes de consultar o banco.',
      epistemicStatus: 'DERIVED',
      actorId: 'reviewer',
      provenance: {
        projectId: 'pub-dev-loop',
        actorId: 'reviewer',
        source: 'REVIEW_INSPECTION',
        verifiedAt: '2026-09-03T14:00:00Z',
        taskId: 'task-prev-1',
        ruleId: 'SEC_INPUT_VALIDATION',
      },
    });

    const task: Task = {
      id: 'task-dev-1',
      project: 'pub-dev-loop',
      repository: 'https://github.com/org/repo',
      objective: 'Implementar endpoint de busca de usuarios',
      prompt: 'Criar rota GET /users com suporte a query params.',
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

    const enriched = await enrichDeveloperTaskWithMemory(task, retrieval);

    expect(enriched.prompt).toContain('[ORGANIZATIONAL MEMORY — VERIFIED HISTORICAL CONTEXT]');
    expect(enriched.prompt).toContain('Validacao de Entrada Obrigatoria');
    expect(enriched.prompt).toContain('ruleId: SEC_INPUT_VALIDATION');
    expect(enriched.objective).toBe(task.objective); // Objective unmodified
  });

  it('2. Developer receives at most 5 memories even if more exist', async () => {
    for (let i = 1; i <= 8; i++) {
      await store.create({
        tenantId: 'pub-dev-loop',
        projectId: 'pub-dev-loop',
        type: 'TASK_RESULT',
        title: `Resultado de Tarefa ${i}`,
        content: `Conteudo verificado da tarefa ${i}`,
        epistemicStatus: 'OBSERVED',
        actorId: 'developer',
        provenance: {
          projectId: 'pub-dev-loop',
          actorId: 'developer',
          source: 'RUNTIME_EXECUTION',
          taskId: `task-old-${i}`,
          verifiedAt: '2026-09-03T14:00:00Z',
        },
      });
    }

    const task: Task = {
      id: 'task-dev-cap',
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
      agentId: 'developer',
    };

    const enriched = await enrichDeveloperTaskWithMemory(task, retrieval);
    const count = (enriched.prompt.match(/TYPE: TASK_RESULT/g) || []).length;
    expect(count).toBe(5);
  });

  it('3 & 4. Retrieval strictly respects projectId and tenantId', async () => {
    // Foreign project
    await store.create({
      tenantId: 'pub-dev-loop',
      projectId: 'other-project',
      type: 'TASK_RESULT',
      title: 'Memoria de Outro Projeto',
      content: 'Chave secreta do outro projeto',
      epistemicStatus: 'OBSERVED',
      actorId: 'developer',
      provenance: {
        projectId: 'other-project',
        actorId: 'developer',
        source: 'RUNTIME_EXECUTION',
        verifiedAt: '2026-09-03T14:00:00Z',
      },
    });

    const task: Task = {
      id: 'task-dev-iso',
      project: 'my-isolated-project',
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
      agentId: 'developer',
    };

    const enriched = await enrichDeveloperTaskWithMemory(task, retrieval);
    expect(enriched.prompt).not.toContain('Memoria de Outro Projeto');
    expect(enriched.prompt).toBe('Prompt');
  });

  it('5 & 6. Developer receives only permitted types and no foreign agent scope leakage', async () => {
    // DECISION is for Chief of Staff / Architect, not Developer
    await store.create({
      tenantId: 'pub-dev-loop',
      projectId: 'pub-dev-loop',
      type: 'DECISION',
      title: 'Decisao Estrategica de Negocios',
      content: 'Orcamento alocado para 2027',
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
      id: 'task-dev-types',
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
      agentId: 'developer',
    };

    const enriched = await enrichDeveloperTaskWithMemory(task, retrieval);
    expect(enriched.prompt).not.toContain('Decisao Estrategica de Negocios');
  });

  it('7. Task without memory or assigned to other agents is untouched', async () => {
    const taskNonDev: Task = {
      id: 'task-qa-1',
      project: 'pub-dev-loop',
      repository: 'repo',
      objective: 'Obj QA',
      prompt: 'Prompt QA',
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
      agentId: 'qa-engineer', // QA is not integrated in Phase 8.2A
    };

    const result = await enrichDeveloperTaskWithMemory(taskNonDev, retrieval);
    expect(result.prompt).toBe('Prompt QA');
  });

  it('8. Failure Isolation: retrieval error NEVER breaks task execution', async () => {
    const brokenRetrieval: any = {
      retrieveContext: async () => {
        throw new Error('REDIS_CONNECTION_REFUSED');
      },
    };

    const task: Task = {
      id: 'task-dev-resilient',
      project: 'pub-dev-loop',
      repository: 'repo',
      objective: 'Obj',
      prompt: 'Original base prompt',
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

    const result = await enrichDeveloperTaskWithMemory(task, brokenRetrieval);
    expect(result.prompt).toBe('Original base prompt'); // Gracefully falls back
  });

  it('9 & 10. Memory does NOT alter task objective or permissions', async () => {
    const task: Task = {
      id: 'task-dev-perm',
      project: 'pub-dev-loop',
      repository: 'repo',
      objective: 'Corrigir bug critico de seguranca',
      prompt: 'Fix vulnerability',
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

    const enriched = await enrichDeveloperTaskWithMemory(task, retrieval);
    expect(enriched.objective).toBe('Corrigir bug critico de seguranca');
    expect(enriched.agentId).toBe('developer');
    expect(enriched.priority).toBe(1);
  });

  it('11. Memory maintains full provenance in formatted context', () => {
    const memory: OrganizationalMemory = {
      id: 'mem-101',
      tenantId: 'pub-dev-loop',
      projectId: 'pub-dev-loop',
      type: 'REVIEW_FINDING',
      title: 'SQL Injection Warning',
      content: 'Use parameterized queries',
      status: 'ACTIVE',
      epistemicStatus: 'DERIVED',
      scope: 'PROJECT',
      actorId: 'reviewer',
      recurrenceCount: 3,
      metadata: {},
      provenance: {
        projectId: 'pub-dev-loop',
        actorId: 'reviewer',
        source: 'REVIEW_INSPECTION',
        verifiedAt: '2026-09-03T14:00:00Z',
        eventId: 'evt-rev-9',
        taskId: 'task-old-9',
        planId: 'plan-old-9',
        ruleId: 'SEC_SQL_INJ',
      },
      createdAt: '2026-09-03T14:00:00Z',
      updatedAt: '2026-09-03T14:00:00Z',
    };

    const block = formatDeveloperMemoryContext([memory]);
    expect(block).toContain('eventId: evt-rev-9');
    expect(block).toContain('taskId: task-old-9');
    expect(block).toContain('planId: plan-old-9');
    expect(block).toContain('ruleId: SEC_SQL_INJ');
    expect(block).toContain('recurrenceCount: 3');
  });

  it('12. Stale/superseded memory does not appear as ACTIVE', async () => {
    const m1 = await store.create({
      tenantId: 'pub-dev-loop',
      projectId: 'pub-dev-loop',
      type: 'TASK_RESULT',
      title: 'Antigo Metodo de Autenticacao',
      content: 'Tokens em cookie',
      epistemicStatus: 'OBSERVED',
      actorId: 'developer',
      provenance: {
        projectId: 'pub-dev-loop',
        actorId: 'developer',
        source: 'RUNTIME_EXECUTION',
        verifiedAt: '2026-09-01T10:00:00Z',
      },
    });

    await store.supersede(m1.id, 'mem-newer', 'pub-dev-loop');

    const task: Task = {
      id: 'task-dev-stale',
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
      agentId: 'developer',
    };

    const enriched = await enrichDeveloperTaskWithMemory(task, retrieval);
    expect(enriched.prompt).not.toContain('Antigo Metodo de Autenticacao');
  });

  it('13. Precedence rule notice is explicitly included in memory block', () => {
    const memory: OrganizationalMemory = {
      id: 'mem-102',
      tenantId: 'pub-dev-loop',
      projectId: 'pub-dev-loop',
      type: 'LESSON',
      title: 'Licao Aprendida',
      content: 'Sempre rodar tsc antes de git push',
      status: 'ACTIVE',
      epistemicStatus: 'DERIVED',
      scope: 'PROJECT',
      actorId: 'developer',
      recurrenceCount: 1,
      metadata: {},
      provenance: {
        projectId: 'pub-dev-loop',
        actorId: 'developer',
        source: 'RUNTIME_EXECUTION',
        verifiedAt: '2026-09-03T14:00:00Z',
      },
      createdAt: '2026-09-03T14:00:00Z',
      updatedAt: '2026-09-03T14:00:00Z',
    };

    const block = formatDeveloperMemoryContext([memory]);
    expect(block).toContain('A instrução da tarefa atual, requisitos explícitos e políticas do runtime têm PRECEDÊNCIA ABSOLUTA');
  });

  it('14. No memory is fabricated when store is empty', async () => {
    const task: Task = {
      id: 'task-dev-empty',
      project: 'pub-dev-loop',
      repository: 'repo',
      objective: 'Nova funcionalidade',
      prompt: 'Implementar modulo X',
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

    const enriched = await enrichDeveloperTaskWithMemory(task, retrieval);
    expect(enriched.prompt).toBe('Implementar modulo X');
  });

  it('15 & 16. Integration: Provider receives enriched task prompt with memory context', async () => {
    await store.create({
      tenantId: 'pub-dev-loop',
      projectId: 'pub-dev-loop',
      type: 'REVIEW_FINDING',
      title: 'Evitar Any em Tipagem',
      content: 'Declarar explicitamente interfaces para responses da API.',
      epistemicStatus: 'DERIVED',
      actorId: 'reviewer',
      provenance: {
        projectId: 'pub-dev-loop',
        actorId: 'reviewer',
        source: 'REVIEW_INSPECTION',
        verifiedAt: '2026-09-03T14:00:00Z',
        ruleId: 'NO_IMPLICIT_ANY',
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
          commit: 'sha-mock',
          errorCode: null,
          errorMessage: null,
        };
      },
      async health() { return { available: true }; },
      capabilities() { return ['code']; },
      metadata() { return { provider: 'mock' }; },
    };

    const baseTask: Task = {
      id: 'task-integration-1',
      project: 'pub-dev-loop',
      repository: 'repo',
      objective: 'Adicionar endpoint de pedidos',
      prompt: 'Implementar POST /orders',
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

    const enrichedTask = await enrichDeveloperTaskWithMemory(baseTask, retrieval);
    await mockProvider.execute(enrichedTask, '/workspace');

    expect(receivedTask).not.toBeNull();
    expect(receivedTask?.prompt).toContain('Evitar Any em Tipagem');
    expect(receivedTask?.prompt).toContain('NO_IMPLICIT_ANY');
    expect(receivedTask?.prompt).toContain('Implementar POST /orders');
  });
});

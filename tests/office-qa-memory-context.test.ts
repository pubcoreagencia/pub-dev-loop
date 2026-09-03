import { describe, it, expect, beforeEach } from 'vitest';
import type { Task } from '../src/domain.js';
import {
  OrganizationalMemoryStore,
  MemoryRetrievalEngine,
  enrichQaTaskWithMemory,
  formatQaMemoryContext,
  MAX_MEMORY_CONTENT_LENGTH,
  type OrganizationalMemory,
} from '../src/office/memory.js';
import type { AgentProvider, ProviderTaskResult } from '../src/providers/types.js';

describe('PDL — Phase 8.3C: QA Engineer Organizational Memory Context & Precedence Suite', () => {
  let store: OrganizationalMemoryStore;
  let retrieval: MemoryRetrievalEngine;

  beforeEach(() => {
    store = new OrganizationalMemoryStore();
    retrieval = new MemoryRetrievalEngine(store);
  });

  it('1, 2, 3 & 4. QA receives authorized memory types: TASK_RESULT, REVIEW_FINDING, LESSON, PROJECT_CONTEXT', async () => {
    await store.create({
      tenantId: 'pub-dev-loop',
      projectId: 'pub-dev-loop',
      type: 'TASK_RESULT',
      title: 'Resultado de Testes Anteriores',
      content: 'Execução anterior dos testes de integração de autenticação.',
      epistemicStatus: 'OBSERVED',
      actorId: 'developer',
      provenance: {
        projectId: 'pub-dev-loop',
        actorId: 'developer',
        source: 'RUNTIME_EXECUTION',
        verifiedAt: '2026-09-03T14:00:00Z',
        taskId: 'task-auth-prev',
      },
    });

    await store.create({
      tenantId: 'pub-dev-loop',
      projectId: 'pub-dev-loop',
      type: 'REVIEW_FINDING',
      title: 'Apontamento de Testabilidade',
      content: 'Módulos assíncronos precisam de testes com waitFor/fake timers.',
      epistemicStatus: 'DERIVED',
      actorId: 'reviewer',
      provenance: {
        projectId: 'pub-dev-loop',
        actorId: 'reviewer',
        source: 'REVIEW_INSPECTION',
        verifiedAt: '2026-09-03T14:05:00Z',
        ruleId: 'QA_ASYNC_TIMERS',
      },
    });

    await store.create({
      tenantId: 'pub-dev-loop',
      projectId: 'pub-dev-loop',
      type: 'LESSON',
      title: 'Lição sobre Isolamento de Testes',
      content: 'Limpar estado de banco entre suítes para evitar flaky tests.',
      epistemicStatus: 'DERIVED',
      actorId: 'developer',
      provenance: {
        projectId: 'pub-dev-loop',
        actorId: 'developer',
        source: 'RUNTIME_EXECUTION',
        verifiedAt: '2026-09-03T14:10:00Z',
      },
    });

    await store.create({
      tenantId: 'pub-dev-loop',
      projectId: 'pub-dev-loop',
      type: 'PROJECT_CONTEXT',
      title: 'Configuração do Ambiente de Testes',
      content: 'Ambiente usa vitest com setupFiles para inicialização do DOM.',
      epistemicStatus: 'DERIVED',
      actorId: 'architect',
      provenance: {
        projectId: 'pub-dev-loop',
        actorId: 'architect',
        source: 'ORGANIZATIONAL_PLAN',
        verifiedAt: '2026-09-03T14:15:00Z',
      },
    });

    const task: Task = {
      id: 'task-qa-1',
      project: 'pub-dev-loop',
      repository: 'https://github.com/org/repo',
      objective: 'Executar testes e2e na suíte de checkout',
      prompt: 'Rodar suíte vitest e validar cobertura de regressão no checkout.',
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
      agentId: 'qa-engineer',
    };

    const enriched = await enrichQaTaskWithMemory(task, retrieval);

    expect(enriched.prompt).toContain('[ORGANIZATIONAL MEMORY — QA HISTORICAL CONTEXT]');
    expect(enriched.prompt).toContain('Resultado de Testes Anteriores');
    expect(enriched.prompt).toContain('Apontamento de Testabilidade');
    expect(enriched.prompt).toContain('Lição sobre Isolamento de Testes');
    expect(enriched.prompt).toContain('Configuração do Ambiente de Testes');
    expect(enriched.objective).toBe(task.objective); // Objective unmodified
  });

  it('5 & 6. Negative: QA does NOT receive DECISION or PLAN', async () => {
    await store.create({
      tenantId: 'pub-dev-loop',
      projectId: 'pub-dev-loop',
      type: 'DECISION',
      title: 'Decisão Executiva de Negócio',
      content: 'Mudança na precificação e roadmap anual.',
      epistemicStatus: 'DECIDED',
      actorId: 'ceo',
      provenance: {
        projectId: 'pub-dev-loop',
        actorId: 'ceo',
        source: 'CEO_DECISION',
        verifiedAt: '2026-09-03T14:00:00Z',
      },
    });

    await store.create({
      tenantId: 'pub-dev-loop',
      projectId: 'pub-dev-loop',
      type: 'PLAN',
      title: 'Plano Organizacional CoS',
      content: 'Alocação de squads e orçamento de Q3.',
      epistemicStatus: 'DERIVED',
      actorId: 'chief-of-staff',
      provenance: {
        projectId: 'pub-dev-loop',
        actorId: 'chief-of-staff',
        source: 'ORGANIZATIONAL_PLAN',
        verifiedAt: '2026-09-03T14:05:00Z',
      },
    });

    const task: Task = {
      id: 'task-qa-neg',
      project: 'pub-dev-loop',
      repository: 'repo',
      objective: 'Obj',
      prompt: 'Prompt Base QA',
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
      agentId: 'qa-engineer',
    };

    const enriched = await enrichQaTaskWithMemory(task, retrieval);
    expect(enriched.prompt).not.toContain('Decisão Executiva de Negócio');
    expect(enriched.prompt).not.toContain('Plano Organizacional CoS');
    expect(enriched.prompt).toBe('Prompt Base QA');
  });

  it('7 & 8. Negative: QA does NOT receive BLOCKED or SUPERSEDED memories', async () => {
    const m1 = await store.create({
      tenantId: 'pub-dev-loop',
      projectId: 'pub-dev-loop',
      type: 'TASK_RESULT',
      title: 'Resultado Obsoleto',
      content: 'Resultado de build revogado',
      epistemicStatus: 'OBSERVED',
      actorId: 'developer',
      provenance: {
        projectId: 'pub-dev-loop',
        actorId: 'developer',
        source: 'RUNTIME_EXECUTION',
        verifiedAt: '2026-08-01T10:00:00Z',
      },
    });

    await store.supersede(m1.id, 'mem-newer-task-res', 'pub-dev-loop');

    await store.create({
      tenantId: 'pub-dev-loop',
      projectId: 'pub-dev-loop',
      type: 'REVIEW_FINDING',
      title: 'Finding Bloqueado de Testes',
      content: 'Finding sob quarentena',
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
      id: 'task-qa-active',
      project: 'pub-dev-loop',
      repository: 'repo',
      objective: 'Obj',
      prompt: 'Prompt Base QA',
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
      agentId: 'qa-engineer',
    };

    const enriched = await enrichQaTaskWithMemory(task, retrieval);
    expect(enriched.prompt).not.toContain('Resultado Obsoleto');
    expect(enriched.prompt).not.toContain('Finding Bloqueado de Testes');
  });

  it('9 & 10. Tenant and Project Isolation: QA never leaks across boundaries', async () => {
    // Foreign tenant
    await store.create({
      tenantId: 'tenant-CORP-A',
      projectId: 'common-project',
      type: 'TASK_RESULT',
      title: 'Test Run Corp A',
      content: 'Logs de teste confidenciais Corp A',
      epistemicStatus: 'OBSERVED',
      actorId: 'qa-engineer',
      provenance: {
        projectId: 'common-project',
        actorId: 'qa-engineer',
        source: 'RUNTIME_EXECUTION',
        verifiedAt: '2026-09-03T14:00:00Z',
      },
    });

    // Foreign project in same tenant
    await store.create({
      tenantId: 'pub-dev-loop',
      projectId: 'project-PAYMENTS',
      type: 'TASK_RESULT',
      title: 'Test Run Payments',
      content: 'Logs de pagamento',
      epistemicStatus: 'OBSERVED',
      actorId: 'qa-engineer',
      provenance: {
        projectId: 'project-PAYMENTS',
        actorId: 'qa-engineer',
        source: 'RUNTIME_EXECUTION',
        verifiedAt: '2026-09-03T14:00:00Z',
      },
    });

    const task: Task = {
      id: 'task-qa-iso',
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
      agentId: 'qa-engineer',
      tenantId: 'pub-dev-loop',
    };

    const enriched = await enrichQaTaskWithMemory(task, retrieval);
    expect(enriched.prompt).not.toContain('Test Run Corp A');
    expect(enriched.prompt).not.toContain('Test Run Payments');
    expect(enriched.prompt).toBe('Prompt Identity');
  });

  it('11. Missing or empty task.project returns empty memory without fallback', async () => {
    const taskNoProj: Task = {
      id: 'task-qa-empty-proj',
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
      agentId: 'qa-engineer',
    };

    const enriched = await enrichQaTaskWithMemory(taskNoProj, retrieval);
    expect(enriched.prompt).toBe('Prompt sem projeto');
  });

  it('12. Context limit: Capped at maximum 5 memories', async () => {
    for (let i = 1; i <= 8; i++) {
      await store.create({
        tenantId: 'pub-dev-loop',
        projectId: 'pub-dev-loop',
        type: 'TASK_RESULT',
        title: `Resultado ${i}`,
        content: `Conteudo de teste ${i}`,
        epistemicStatus: 'OBSERVED',
        actorId: 'developer',
        provenance: {
          projectId: 'pub-dev-loop',
          actorId: 'developer',
          source: 'RUNTIME_EXECUTION',
          verifiedAt: '2026-09-03T14:00:00Z',
        },
      });
    }

    const task: Task = {
      id: 'task-qa-cap',
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
      agentId: 'qa-engineer',
    };

    const enriched = await enrichQaTaskWithMemory(task, retrieval);
    const count = (enriched.prompt.match(/TYPE: TASK_RESULT/g) || []).length;
    expect(count).toBe(5);
  });

  it('13. Truncation: Long content capped at MAX_MEMORY_CONTENT_LENGTH (500 chars)', () => {
    const longContent = 'D'.repeat(800);
    const memory: OrganizationalMemory = {
      id: 'mem-qa-long',
      tenantId: 'pub-dev-loop',
      projectId: 'pub-dev-loop',
      type: 'TASK_RESULT',
      title: 'Resultado Extenso de QA',
      content: longContent,
      status: 'ACTIVE',
      epistemicStatus: 'OBSERVED',
      scope: 'PROJECT',
      actorId: 'qa-engineer',
      recurrenceCount: 1,
      metadata: {},
      provenance: {
        projectId: 'pub-dev-loop',
        actorId: 'qa-engineer',
        source: 'RUNTIME_EXECUTION',
        verifiedAt: '2026-09-03T14:00:00Z',
      },
      createdAt: '2026-09-03T14:00:00Z',
      updatedAt: '2026-09-03T14:00:00Z',
    };

    const block = formatQaMemoryContext([memory]);
    expect(block).toContain('... [truncated]');
    expect(block).not.toContain('D'.repeat(501));
  });

  it('14. QA Test Evidence Precedence: Current test failure / regression ALWAYS wins over contradictory historical memory', async () => {
    // Historical memory stating previous pass
    await store.create({
      tenantId: 'pub-dev-loop',
      projectId: 'pub-dev-loop',
      type: 'TASK_RESULT',
      title: 'Sucesso Anterior nos Testes de Checkout',
      content: 'Todos os testes de checkout passaram no release anterior.',
      epistemicStatus: 'OBSERVED',
      actorId: 'qa-engineer',
      provenance: {
        projectId: 'pub-dev-loop',
        actorId: 'qa-engineer',
        source: 'RUNTIME_EXECUTION',
        verifiedAt: '2026-08-01T10:00:00Z',
      },
    });

    // Current task with active failing test evidence
    const task: Task = {
      id: 'task-qa-failing-test',
      project: 'pub-dev-loop',
      repository: 'repo',
      objective: 'Verificar regressao em checkout',
      prompt: 'EVIDÊNCIA ATUAL DE TESTE: Teste checkout_flow falhou com status 500 (exitCode 1). Registrar falha.',
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
      agentId: 'qa-engineer',
    };

    const enriched = await enrichQaTaskWithMemory(task, retrieval);
    expect(enriched.prompt).toContain('EVIDÊNCIA ATUAL DE TESTE: Teste checkout_flow falhou com status 500 (exitCode 1).');
    expect(enriched.prompt).toContain('O estado atual do código, testes, exitCode, stdout/stderr, typecheck e build têm PRECEDÊNCIA ABSOLUTA');
    expect(enriched.prompt).toContain('Uma memória histórica NUNCA pode suplantar falhas, regressões ou anomalias observadas na execução de testes presente.');
  });

  it('15 & 16. Failure Isolation: DB failure or malformed memory NEVER breaks QA execution', async () => {
    const brokenRetrieval: any = {
      retrieveContext: async () => {
        throw new Error('POSTGRES_SOCKET_CLOSED');
      },
    };

    const task: Task = {
      id: 'task-qa-resilient',
      project: 'pub-dev-loop',
      repository: 'repo',
      objective: 'Obj',
      prompt: 'Prompt Base QA Resiliente',
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
      agentId: 'qa-engineer',
    };

    const enriched = await enrichQaTaskWithMemory(task, brokenRetrieval);
    expect(enriched.prompt).toBe('Prompt Base QA Resiliente');
  });

  it('17. Provenance: Preserves full verified provenance fields without fabrication', () => {
    const memory: OrganizationalMemory = {
      id: 'mem-qa-prov',
      tenantId: 'pub-dev-loop',
      projectId: 'pub-dev-loop',
      type: 'TASK_RESULT',
      title: 'Execução de Teste E2E',
      content: 'Suíte E2E executada com 42 testes.',
      status: 'ACTIVE',
      epistemicStatus: 'OBSERVED',
      scope: 'PROJECT',
      actorId: 'qa-engineer',
      recurrenceCount: 1,
      metadata: {},
      provenance: {
        projectId: 'pub-dev-loop',
        actorId: 'qa-engineer',
        source: 'RUNTIME_EXECUTION',
        verifiedAt: '2026-09-03T14:00:00Z',
        eventId: 'evt-qa-p3',
        taskId: 'task-e2e-prev',
        commitSha: 'sha-qa-verified',
      },
      createdAt: '2026-09-03T14:00:00Z',
      updatedAt: '2026-09-03T14:00:00Z',
    };

    const block = formatQaMemoryContext([memory]);
    expect(block).toContain('eventId: evt-qa-p3');
    expect(block).toContain('taskId: task-e2e-prev');
    expect(block).toContain('commitSha: sha-qa-verified');
    expect(block).toContain('SOURCE: RUNTIME_EXECUTION');
    expect(block).toContain('actorId: qa-engineer');
  });

  it('18. Real Execution Integration: Provider receives enriched QA Engineer task prompt', async () => {
    await store.create({
      tenantId: 'pub-dev-loop',
      projectId: 'pub-dev-loop',
      type: 'REVIEW_FINDING',
      title: 'Padrão de Mocks em Testes de Integração',
      content: 'Evitar mockar a camada de transporte HTTP em testes de integração de gateway.',
      epistemicStatus: 'DERIVED',
      actorId: 'reviewer',
      provenance: {
        projectId: 'pub-dev-loop',
        actorId: 'reviewer',
        source: 'REVIEW_INSPECTION',
        verifiedAt: '2026-09-03T14:00:00Z',
        ruleId: 'QA_NO_TRANSPORT_MOCK',
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
          stdout: 'QA test suite completed with 0 errors',
          stderr: '',
          changedFiles: [],
          commit: 'sha-qa-mock',
          errorCode: null,
          errorMessage: null,
        };
      },
      async health() { return { available: true }; },
      capabilities() { return ['planning']; },
      metadata() { return { provider: 'mock' }; },
    };

    const baseTask: Task = {
      id: 'task-qa-integration-1',
      project: 'pub-dev-loop',
      repository: 'repo',
      objective: 'Executar testes de integracao de pagamentos',
      prompt: 'Validar fluxo de ponta a ponta com sandbox real',
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
      agentId: 'qa-engineer',
    };

    const enrichedTask = await enrichQaTaskWithMemory(baseTask, retrieval);
    await mockProvider.execute(enrichedTask, '/workspace');

    expect(receivedTask).not.toBeNull();
    expect(receivedTask?.prompt).toContain('Padrão de Mocks em Testes de Integração');
    expect(receivedTask?.prompt).toContain('[ORGANIZATIONAL MEMORY — QA HISTORICAL CONTEXT]');
    expect(receivedTask?.prompt).toContain('Validar fluxo de ponta a ponta com sandbox real');
  });
});

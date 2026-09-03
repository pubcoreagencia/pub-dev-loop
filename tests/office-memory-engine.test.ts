import { describe, it, expect, beforeEach } from 'vitest';
import {
  OrganizationalMemoryStore,
  MemoryIngestPipeline,
  MemoryRetrievalEngine,
  replayHistoricalEvents,
  type MemoryProvenance,
} from '../src/office/memory.js';
import type { OfficeEvent } from '../src/office/events.js';

describe('PDL — Phase 8.1: Organizational Memory Engine Test Suite', () => {
  let store: OrganizationalMemoryStore;
  let pipeline: MemoryIngestPipeline;
  let retrieval: MemoryRetrievalEngine;

  beforeEach(() => {
    store = new OrganizationalMemoryStore();
    pipeline = new MemoryIngestPipeline(store);
    retrieval = new MemoryRetrievalEngine(store);
  });

  it('1. APPROVAL_GRANTED -> DECISION with DECIDED epistemic status', async () => {
    const event: OfficeEvent = {
      id: 'evt-appr-1',
      sequence: 101,
      type: 'APPROVAL_GRANTED',
      timestamp: '2026-09-03T14:00:00Z',
      actorId: 'ceo',
      project: 'pub-dev-loop',
      summary: 'Aprovado deploy em staging',
      payload: { approvalId: 'appr-1', decision: 'GRANT', notes: 'Deploy autorizado com monitoramento' },
    };

    const memory = await pipeline.ingestEvent(event);
    expect(memory).not.toBeNull();
    expect(memory?.type).toBe('DECISION');
    expect(memory?.epistemicStatus).toBe('DECIDED');
    expect(memory?.provenance.source).toBe('CEO_DECISION');
    expect(memory?.provenance.eventId).toBe('evt-appr-1');
  });

  it('2. APPROVAL_REJECTED -> DECISION with DECIDED epistemic status', async () => {
    const event: OfficeEvent = {
      id: 'evt-appr-2',
      sequence: 102,
      type: 'APPROVAL_REJECTED',
      timestamp: '2026-09-03T14:05:00Z',
      actorId: 'ceo',
      project: 'pub-dev-loop',
      summary: 'Rejeitada migracao de banco sem backup',
      payload: { approvalId: 'appr-2', decision: 'REJECT', notes: 'Necessario snapshot previo' },
    };

    const memory = await pipeline.ingestEvent(event);
    expect(memory).not.toBeNull();
    expect(memory?.type).toBe('DECISION');
    expect(memory?.epistemicStatus).toBe('DECIDED');
    expect(memory?.content).toContain('Rejeitado');
  });

  it('3. REVIEW_FINDING -> REVIEW_FINDING memory with DERIVED epistemic status', async () => {
    const event: OfficeEvent = {
      id: 'evt-rev-1',
      sequence: 103,
      type: 'REVIEW_FINDING',
      timestamp: '2026-09-03T14:10:00Z',
      actorId: 'reviewer',
      targetId: 'developer',
      project: 'pub-dev-loop',
      taskId: 'task-dev-99',
      summary: 'Revisao detectou erro de tipagem',
      payload: {
        findings: [
          { ruleId: 'TYPECHECK_ERROR', message: 'Assinatura incompativel', suggestion: 'Usar string' },
        ],
      },
    };

    const memory = await pipeline.ingestEvent(event);
    expect(memory).not.toBeNull();
    expect(memory?.type).toBe('REVIEW_FINDING');
    expect(memory?.epistemicStatus).toBe('DERIVED');
    expect(memory?.provenance.source).toBe('REVIEW_INSPECTION');
    expect(memory?.provenance.ruleId).toBe('TYPECHECK_ERROR');
    expect(memory?.provenance.taskId).toBe('task-dev-99');
  });

  it('4. REVIEW_BLOCKED -> memory with BLOCKED status', async () => {
    const event: OfficeEvent = {
      id: 'evt-block-1',
      sequence: 104,
      type: 'REVIEW_BLOCKED',
      timestamp: '2026-09-03T14:15:00Z',
      actorId: 'reviewer',
      targetId: 'developer',
      project: 'pub-dev-loop',
      taskId: 'task-dev-99',
      summary: 'Revisao bloqueada apos 3 ciclos',
      payload: { maxIterations: 3 },
    };

    const memory = await pipeline.ingestEvent(event);
    expect(memory).not.toBeNull();
    expect(memory?.status).toBe('BLOCKED');
    expect(memory?.epistemicStatus).toBe('DERIVED');
  });

  it('5. AGENT_FINISHED_WORK -> TASK_RESULT with OBSERVED epistemic status', async () => {
    const event: OfficeEvent = {
      id: 'evt-done-1',
      sequence: 105,
      type: 'AGENT_FINISHED_WORK',
      timestamp: '2026-09-03T14:20:00Z',
      actorId: 'developer',
      project: 'pub-dev-loop',
      taskId: 'task-100',
      summary: 'Implementado componente de presenca espacial',
    };

    const memory = await pipeline.ingestEvent(event);
    expect(memory).not.toBeNull();
    expect(memory?.type).toBe('TASK_RESULT');
    expect(memory?.epistemicStatus).toBe('OBSERVED');
    expect(memory?.provenance.source).toBe('RUNTIME_EXECUTION');
  });

  it('6. AGENT_FAILED_WORK -> TASK_RESULT with OBSERVED epistemic status', async () => {
    const event: OfficeEvent = {
      id: 'evt-fail-1',
      sequence: 106,
      type: 'AGENT_FAILED_WORK',
      timestamp: '2026-09-03T14:25:00Z',
      actorId: 'developer',
      project: 'pub-dev-loop',
      taskId: 'task-101',
      summary: 'Timeout no provider OpenRouter',
    };

    const memory = await pipeline.ingestEvent(event);
    expect(memory).not.toBeNull();
    expect(memory?.type).toBe('TASK_RESULT');
    expect(memory?.epistemicStatus).toBe('OBSERVED');
    expect(memory?.metadata.failed).toBe(true);
  });

  it('7. PLAN_FORMULATED -> PLAN memory with DERIVED epistemic status', async () => {
    const event: OfficeEvent = {
      id: 'evt-plan-1',
      sequence: 107,
      type: 'PLAN_FORMULATED',
      timestamp: '2026-09-03T14:30:00Z',
      actorId: 'chief-of-staff',
      project: 'pub-dev-loop',
      planId: 'plan-300',
      summary: 'Plano de evolucao espacial',
      payload: { stepCount: 4 },
    };

    const memory = await pipeline.ingestEvent(event);
    expect(memory).not.toBeNull();
    expect(memory?.type).toBe('PLAN');
    expect(memory?.provenance.source).toBe('ORGANIZATIONAL_PLAN');
    expect(memory?.provenance.planId).toBe('plan-300');
  });

  it('8. ephemeral events (AGENT_STARTED_WORK, MEETING_STARTED) produce NO memory', async () => {
    const e1: OfficeEvent = {
      id: 'evt-start-1',
      sequence: 108,
      type: 'AGENT_STARTED_WORK',
      timestamp: '2026-09-03T14:35:00Z',
      actorId: 'developer',
      project: 'pub-dev-loop',
      summary: 'Iniciando desenvolvimento',
    };
    const e2: OfficeEvent = {
      id: 'evt-meet-1',
      sequence: 109,
      type: 'MEETING_STARTED',
      timestamp: '2026-09-03T14:36:00Z',
      actorId: 'ceo',
      project: 'pub-dev-loop',
      summary: 'Reuniao de alinhamento iniciada',
    };

    const m1 = await pipeline.ingestEvent(e1);
    const m2 = await pipeline.ingestEvent(e2);

    expect(m1).toBeNull();
    expect(m2).toBeNull();
  });

  it('9. mandatory provenance validation rejects incomplete provenance', async () => {
    await expect(
      store.create({
        tenantId: 'tenant-1',
        projectId: 'pub-dev-loop',
        type: 'DECISION',
        title: 'Decisao sem autor',
        content: 'Conteudo',
        epistemicStatus: 'DECIDED',
        actorId: 'ceo',
        provenance: {} as any, // Missing fields
      })
    ).rejects.toThrow(/INVALID_PROVENANCE/);
  });

  it('10. memory creation rejects missing tenantId', async () => {
    await expect(
      store.create({
        tenantId: '',
        projectId: 'pub-dev-loop',
        type: 'DECISION',
        title: 'Decisao',
        content: 'Conteudo',
        epistemicStatus: 'DECIDED',
        actorId: 'ceo',
        provenance: {
          projectId: 'pub-dev-loop',
          actorId: 'ceo',
          source: 'CEO_DECISION',
          verifiedAt: '2026-09-03T14:00:00Z',
        },
      })
    ).rejects.toThrow();
  });

  it('11. memory creation rejects missing projectId', async () => {
    await expect(
      store.create({
        tenantId: 'tenant-1',
        projectId: '',
        type: 'DECISION',
        title: 'Decisao',
        content: 'Conteudo',
        epistemicStatus: 'DECIDED',
        actorId: 'ceo',
        provenance: {
          projectId: '',
          actorId: 'ceo',
          source: 'CEO_DECISION',
          verifiedAt: '2026-09-03T14:00:00Z',
        },
      })
    ).rejects.toThrow(/INVALID_PROJECT/);
  });

  it('12. tenant isolation prevents cross-tenant memory leakage', async () => {
    await store.create({
      tenantId: 'tenant-A',
      projectId: 'project-shared-name',
      type: 'DECISION',
      title: 'Decisao Secreta Tenant A',
      content: 'Chave API A',
      epistemicStatus: 'DECIDED',
      actorId: 'ceo',
      provenance: {
        projectId: 'project-shared-name',
        actorId: 'ceo',
        source: 'CEO_DECISION',
        verifiedAt: '2026-09-03T14:00:00Z',
      },
    });

    const results = await retrieval.retrieveContext({
      tenantId: 'tenant-B',
      projectId: 'project-shared-name',
    });

    expect(results).toHaveLength(0);
  });

  it('13. project isolation prevents cross-project memory leakage', async () => {
    await store.create({
      tenantId: 'tenant-1',
      projectId: 'project-ALPHA',
      type: 'TASK_RESULT',
      title: 'Resultado Alpha',
      content: 'Codigo Alpha',
      epistemicStatus: 'OBSERVED',
      actorId: 'developer',
      provenance: {
        projectId: 'project-ALPHA',
        actorId: 'developer',
        source: 'RUNTIME_EXECUTION',
        verifiedAt: '2026-09-03T14:00:00Z',
      },
    });

    const results = await retrieval.retrieveContext({
      tenantId: 'tenant-1',
      projectId: 'project-BETA',
    });

    expect(results).toHaveLength(0);
  });

  it('14. agent retrieval scoping filters memories by role specialty', async () => {
    const prov: MemoryProvenance = {
      projectId: 'pub-dev-loop',
      actorId: 'system',
      source: 'CEO_DECISION',
      verifiedAt: '2026-09-03T14:00:00Z',
    };

    await store.create({
      tenantId: 'tenant-1',
      projectId: 'pub-dev-loop',
      type: 'DECISION',
      title: 'Decisao Estrategica',
      content: 'Stack Postgres',
      epistemicStatus: 'DECIDED',
      actorId: 'ceo',
      provenance: prov,
    });

    await store.create({
      tenantId: 'tenant-1',
      projectId: 'pub-dev-loop',
      type: 'TASK_RESULT',
      title: 'Commit de Teste',
      content: 'Unit tests passed',
      epistemicStatus: 'OBSERVED',
      actorId: 'developer',
      provenance: { ...prov, source: 'RUNTIME_EXECUTION' },
    });

    // Chief of Staff should see DECISION, but NOT TASK_RESULT
    const cosMemories = await retrieval.retrieveContext({
      tenantId: 'tenant-1',
      projectId: 'pub-dev-loop',
      agentRole: 'chief-of-staff',
    });
    expect(cosMemories.some((m) => m.type === 'DECISION')).toBe(true);
    expect(cosMemories.some((m) => m.type === 'TASK_RESULT')).toBe(false);

    // Developer should see TASK_RESULT
    const devMemories = await retrieval.retrieveContext({
      tenantId: 'tenant-1',
      projectId: 'pub-dev-loop',
      agentRole: 'developer',
    });
    expect(devMemories.some((m) => m.type === 'TASK_RESULT')).toBe(true);
  });

  it('15. duplicate event ingestion is idempotent', async () => {
    const event: OfficeEvent = {
      id: 'evt-idempotent-1',
      sequence: 200,
      type: 'APPROVAL_GRANTED',
      timestamp: '2026-09-03T14:40:00Z',
      actorId: 'ceo',
      project: 'pub-dev-loop',
      summary: 'Idempotent Approval',
    };

    const m1 = await pipeline.ingestEvent(event);
    const m2 = await pipeline.ingestEvent(event);

    expect(m1?.id).toBe(m2?.id);
    const list = await store.listByProject('pub-dev-loop');
    expect(list.filter((m) => m.provenance.eventId === 'evt-idempotent-1')).toHaveLength(1);
  });

  it('16. recurrence handling increments recurrenceCount on repeated findings', async () => {
    const event: OfficeEvent = {
      id: 'evt-repeat-find',
      sequence: 201,
      type: 'REVIEW_FINDING',
      timestamp: '2026-09-03T14:45:00Z',
      actorId: 'reviewer',
      project: 'pub-dev-loop',
      taskId: 'task-recurrence',
      summary: 'Recurrent Finding',
      payload: {
        findings: [{ ruleId: 'SQL_INJECTION', message: 'SQL injection risco' }],
      },
    };

    const m1 = await pipeline.ingestEvent(event);
    expect(m1?.recurrenceCount).toBe(1);

    const m2 = await pipeline.ingestEvent(event);
    expect(m2?.recurrenceCount).toBe(2);
  });

  it('17. superseded memory updates status and preserves audit trail', async () => {
    const m1 = await store.create({
      tenantId: 'tenant-1',
      projectId: 'pub-dev-loop',
      type: 'DECISION',
      title: 'Decisao Antiga: Usar Redis',
      content: 'Redis para fila',
      epistemicStatus: 'DECIDED',
      actorId: 'ceo',
      provenance: {
        projectId: 'pub-dev-loop',
        actorId: 'ceo',
        source: 'CEO_DECISION',
        verifiedAt: '2026-09-03T14:00:00Z',
      },
    });

    const m2 = await store.create({
      tenantId: 'tenant-1',
      projectId: 'pub-dev-loop',
      type: 'DECISION',
      title: 'Decisao Nova: Usar Postgres Queue',
      content: 'Postgres transactional queue',
      epistemicStatus: 'DECIDED',
      actorId: 'ceo',
      provenance: {
        projectId: 'pub-dev-loop',
        actorId: 'ceo',
        source: 'CEO_DECISION',
        verifiedAt: '2026-09-03T14:50:00Z',
      },
    });

    await store.supersede(m1.id, m2.id, 'tenant-1');

    const updatedM1 = await store.getById(m1.id, 'tenant-1');
    expect(updatedM1?.status).toBe('SUPERSEDED');
    expect(updatedM1?.metadata.supersededBy).toBe(m2.id);

    // Active retrieval does not return superseded memory
    const active = await retrieval.retrieveContext({
      tenantId: 'tenant-1',
      projectId: 'pub-dev-loop',
    });
    expect(active.some((m) => m.id === m1.id)).toBe(false);
    expect(active.some((m) => m.id === m2.id)).toBe(true);
  });

  it('18. retrieval limit is capped at 5 records maximum', async () => {
    for (let i = 1; i <= 10; i++) {
      await store.create({
        tenantId: 'tenant-1',
        projectId: 'pub-dev-loop',
        type: 'TASK_RESULT',
        title: `Task ${i}`,
        content: `Conteudo ${i}`,
        epistemicStatus: 'OBSERVED',
        actorId: 'developer',
        provenance: {
          projectId: 'pub-dev-loop',
          actorId: 'developer',
          source: 'RUNTIME_EXECUTION',
          taskId: `task-${i}`,
          verifiedAt: '2026-09-03T14:00:00Z',
        },
      });
    }

    const results = await retrieval.retrieveContext({
      tenantId: 'tenant-1',
      projectId: 'pub-dev-loop',
      limit: 10, // Requesting 10
    });

    expect(results.length).toBeLessThanOrEqual(5);
  });

  it('19. BLOCKED memory does not appear in ACTIVE retrieval', async () => {
    const event: OfficeEvent = {
      id: 'evt-blocked-test',
      sequence: 300,
      type: 'REVIEW_BLOCKED',
      timestamp: '2026-09-03T14:55:00Z',
      actorId: 'reviewer',
      project: 'pub-dev-loop',
      summary: 'Bloqueio de revisao',
    };

    const mem = await pipeline.ingestEvent(event);
    expect(mem?.status).toBe('BLOCKED');

    const activeList = await retrieval.retrieveContext({
      tenantId: 'pub-dev-loop',
      projectId: 'pub-dev-loop',
    });

    expect(activeList.some((m) => m.id === mem?.id)).toBe(false);
  });

  it('20. replayHistoricalEvents is idempotent over past events', async () => {
    // Mocking pool with rows
    const mockPool: any = {
      query: async () => ({
        rows: [
          {
            id: 'evt-hist-1',
            sequence: '1',
            type: 'APPROVAL_GRANTED',
            project: 'pub-dev-loop',
            actor_id: 'ceo',
            summary: 'Aprovacao historica',
            payload: {},
            created_at: new Date('2026-09-01T10:00:00Z'),
          },
        ],
      }),
    };

    const r1 = await replayHistoricalEvents(mockPool, store, { project: 'pub-dev-loop' });
    expect(r1.processed).toBe(1);
    expect(r1.ingested).toBe(1);

    // Second run
    const r2 = await replayHistoricalEvents(mockPool, store, { project: 'pub-dev-loop' });
    expect(r2.processed).toBe(1);
    expect(r2.ingested).toBe(1); // idempotent update

    const list = await store.listByProject('pub-dev-loop');
    expect(list.filter((m) => m.provenance.eventId === 'evt-hist-1')).toHaveLength(1);
  });

  it('21. memory storage failure does not break principal flow', async () => {
    const brokenStore: any = {
      create: async () => {
        throw new Error('DATABASE_CONNECTION_REFUSED');
      },
    };
    const safePipeline = new MemoryIngestPipeline(brokenStore);

    const event: OfficeEvent = {
      id: 'evt-safe-1',
      sequence: 301,
      type: 'AGENT_FINISHED_WORK',
      timestamp: '2026-09-03T15:00:00Z',
      actorId: 'developer',
      project: 'pub-dev-loop',
      summary: 'Safe execution',
    };

    // Does not throw
    const res = await safePipeline.ingestEvent(event);
    expect(res).toBeNull();
  });

  it('22. no provenance field is fabricated or guessed', async () => {
    const event: OfficeEvent = {
      id: 'evt-clean-1',
      sequence: 302,
      type: 'AGENT_FINISHED_WORK',
      timestamp: '2026-09-03T15:05:00Z',
      actorId: 'developer',
      project: 'pub-dev-loop',
      summary: 'Clean Task',
      // No taskId, planId, commitSha provided
    };

    const memory = await pipeline.ingestEvent(event);
    expect(memory?.provenance.taskId).toBeUndefined();
    expect(memory?.provenance.planId).toBeUndefined();
    expect(memory?.provenance.commitSha).toBeUndefined();
    expect(memory?.provenance.actorId).toBe('developer');
    expect(memory?.provenance.source).toBe('RUNTIME_EXECUTION');
  });
});

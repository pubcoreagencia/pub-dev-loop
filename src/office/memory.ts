import type { Pool } from 'pg';
import type { OfficeEvent } from './events.js';
import type { Task } from '../domain.js';

export type MemoryType =
  | 'DECISION'
  | 'REVIEW_FINDING'
  | 'TASK_RESULT'
  | 'LESSON'
  | 'PROJECT_CONTEXT'
  | 'AGENT_CONTEXT'
  | 'PLAN';

export type MemoryStatus = 'ACTIVE' | 'SUPERSEDED' | 'BLOCKED';

export type MemoryEpistemicStatus = 'OBSERVED' | 'DECIDED' | 'DERIVED' | 'INFERRED';

export type MemoryScope = 'GLOBAL' | 'PROJECT' | 'AGENT' | 'TASK';

export type MemorySource =
  | 'RUNTIME_EXECUTION'
  | 'REVIEW_INSPECTION'
  | 'CEO_DECISION'
  | 'ORGANIZATIONAL_PLAN';

export interface MemoryProvenance {
  projectId: string;
  actorId: string;
  source: MemorySource;
  verifiedAt: string;
  eventId?: string;
  eventSequence?: number;
  taskId?: string;
  planId?: string;
  stepId?: string;
  commitSha?: string;
  ruleId?: string;
}

export interface OrganizationalMemory {
  id: string;
  tenantId: string;
  projectId: string;
  type: MemoryType;
  title: string;
  content: string;
  status: MemoryStatus;
  epistemicStatus: MemoryEpistemicStatus;
  scope: MemoryScope;
  actorId: string;
  recurrenceCount: number;
  metadata: Record<string, any>;
  provenance: MemoryProvenance;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMemoryInput {
  tenantId?: string;
  projectId: string;
  type: MemoryType;
  title: string;
  content: string;
  status?: MemoryStatus;
  epistemicStatus: MemoryEpistemicStatus;
  scope?: MemoryScope;
  actorId: string;
  metadata?: Record<string, any>;
  provenance: MemoryProvenance;
}

export interface MemorySearchFilter {
  tenantId?: string;
  projectId: string;
  types?: MemoryType[];
  status?: MemoryStatus;
  actorId?: string;
  agentRole?: 'chief-of-staff' | 'architect' | 'developer' | 'reviewer' | 'qa-engineer';
  taskId?: string;
  planId?: string;
  query?: string;
  limit?: number; // default <= 5
}

export const AGENT_ROLE_MEMORY_SCOPES: Record<string, MemoryType[]> = {
  'chief-of-staff': ['DECISION', 'PLAN', 'PROJECT_CONTEXT'],
  'architect': ['DECISION', 'PLAN', 'REVIEW_FINDING', 'PROJECT_CONTEXT'],
  'developer': ['TASK_RESULT', 'REVIEW_FINDING', 'LESSON', 'PROJECT_CONTEXT'],
  'reviewer': ['REVIEW_FINDING', 'TASK_RESULT', 'PROJECT_CONTEXT'],
  'qa-engineer': ['TASK_RESULT', 'REVIEW_FINDING', 'LESSON', 'PROJECT_CONTEXT'],
};

export class OrganizationalMemoryStore {
  private memories = new Map<string, OrganizationalMemory>();
  private pool?: Pool;

  constructor(pool?: Pool) {
    this.pool = pool;
  }

  setPool(pool: Pool): void {
    this.pool = pool;
  }

  async create(input: CreateMemoryInput): Promise<OrganizationalMemory> {
    const tenantId = input.tenantId !== undefined ? input.tenantId.trim() : 'pub-dev-loop';
    const projectId = input.projectId !== undefined ? input.projectId.trim() : '';

    if (!tenantId) {
      throw new Error('INVALID_TENANT: tenantId é obrigatório para persistência de memória.');
    }

    if (!projectId) {
      throw new Error('INVALID_PROJECT: projectId é obrigatório para persistência de memória.');
    }

    // Validação estrita de Provenance obrigatório
    const prov = input.provenance;
    if (!prov || !prov.projectId || !prov.actorId || !prov.source || !prov.verifiedAt) {
      throw new Error('INVALID_PROVENANCE: Memória operacional exige provenance completo (projectId, actorId, source, verifiedAt).');
    }

    // Deduplicação determinística em memória / PostgreSQL
    const dedupeIdentity = prov.eventId || prov.taskId || prov.ruleId || input.title;
    const dedupeKey = `${tenantId}:${projectId}:${input.type}:${dedupeIdentity}`;
    const existing = Array.from(this.memories.values()).find((m) => {
      const p = m.provenance;
      const id = p.eventId || p.taskId || p.ruleId || m.title;
      const key = `${m.tenantId}:${m.projectId}:${m.type}:${id}`;
      return key === dedupeKey;
    });

    if (existing) {
      existing.recurrenceCount += 1;
      existing.updatedAt = new Date().toISOString();
      return existing;
    }

    const id = `mem-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const now = new Date().toISOString();

    const memory: OrganizationalMemory = {
      id,
      tenantId,
      projectId,
      type: input.type,
      title: input.title,
      content: input.content,
      status: input.status || 'ACTIVE',
      epistemicStatus: input.epistemicStatus,
      scope: input.scope || 'PROJECT',
      actorId: input.actorId,
      recurrenceCount: 1,
      metadata: input.metadata || {},
      provenance: prov,
      createdAt: now,
      updatedAt: now,
    };

    this.memories.set(id, memory);

    if (this.pool) {
      try {
        await this.pool.query(
          `INSERT INTO organizational_memories (
            id, tenant_id, project_id, type, title, content, status,
            epistemic_status, scope, actor_id, recurrence_count, metadata, provenance,
            created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
          ON CONFLICT (tenant_id, project_id, type, COALESCE(provenance->>'eventId', ''), COALESCE(provenance->>'taskId', ''), COALESCE(provenance->>'ruleId', ''))
          DO UPDATE SET recurrence_count = organizational_memories.recurrence_count + 1, updated_at = now()`,
          [
            memory.id,
            memory.tenantId,
            memory.projectId,
            memory.type,
            memory.title,
            memory.content,
            memory.status,
            memory.epistemicStatus,
            memory.scope,
            memory.actorId,
            memory.recurrenceCount,
            JSON.stringify(memory.metadata),
            JSON.stringify(memory.provenance),
            memory.createdAt,
            memory.updatedAt,
          ]
        );
      } catch (err: any) {
        console.error('[MemoryStore] Failed to insert DB record:', err.message);
      }
    }

    return memory;
  }

  async getById(id: string, tenantId = 'pub-dev-loop'): Promise<OrganizationalMemory | null> {
    const memory = this.memories.get(id);
    if (!memory) return null;
    if (memory.tenantId !== tenantId) return null;
    return memory;
  }

  async listByProject(projectId: string, tenantId = 'pub-dev-loop', limit = 5): Promise<OrganizationalMemory[]> {
    const cappedLimit = Math.min(limit, 5);
    return Array.from(this.memories.values())
      .filter((m) => m.tenantId === tenantId && m.projectId === projectId && m.status === 'ACTIVE')
      .slice(0, cappedLimit);
  }

  async listByTask(taskId: string, projectId: string, tenantId = 'pub-dev-loop'): Promise<OrganizationalMemory[]> {
    return Array.from(this.memories.values())
      .filter((m) => m.tenantId === tenantId && m.projectId === projectId && m.provenance.taskId === taskId)
      .slice(0, 5);
  }

  async listByAgent(actorId: string, projectId: string, tenantId = 'pub-dev-loop'): Promise<OrganizationalMemory[]> {
    return Array.from(this.memories.values())
      .filter((m) => m.tenantId === tenantId && m.projectId === projectId && m.actorId === actorId && m.status === 'ACTIVE')
      .slice(0, 5);
  }

  async supersede(oldId: string, newId: string, tenantId = 'pub-dev-loop'): Promise<boolean> {
    const oldMemory = this.memories.get(oldId);
    if (!oldMemory || oldMemory.tenantId !== tenantId) return false;

    oldMemory.status = 'SUPERSEDED';
    oldMemory.metadata = { ...oldMemory.metadata, supersededBy: newId };
    oldMemory.updatedAt = new Date().toISOString();

    if (this.pool) {
      try {
        await this.pool.query(
          `UPDATE organizational_memories SET status = 'SUPERSEDED', metadata = $1, updated_at = now() WHERE id = $2 AND tenant_id = $3`,
          [JSON.stringify(oldMemory.metadata), oldId, tenantId]
        );
      } catch (err: any) {
        console.error('[MemoryStore] Failed to supersede in DB:', err.message);
      }
    }
    return true;
  }

  async search(filter: MemorySearchFilter): Promise<OrganizationalMemory[]> {
    const tenantId = filter.tenantId || 'pub-dev-loop';
    const projectId = filter.projectId;
    const targetStatus = filter.status || 'ACTIVE';
    const cappedLimit = Math.min(filter.limit || 5, 5);

    let allowedTypes = filter.types;
    if (filter.agentRole && AGENT_ROLE_MEMORY_SCOPES[filter.agentRole]) {
      allowedTypes = AGENT_ROLE_MEMORY_SCOPES[filter.agentRole];
    }

    const list = Array.from(this.memories.values()).filter((m) => {
      // 1. Tenant Isolation
      if (m.tenantId !== tenantId) return false;

      // 2. Project Isolation
      if (m.projectId !== projectId) return false;

      // 3. Status Filtering
      if (m.status !== targetStatus) return false;

      // 4. Type Filtering
      if (allowedTypes && allowedTypes.length > 0 && !allowedTypes.includes(m.type)) {
        return false;
      }

      // 5. Task / Plan / Actor Filtering
      if (filter.taskId && m.provenance.taskId !== filter.taskId) return false;
      if (filter.planId && m.provenance.planId !== filter.planId) return false;
      if (filter.actorId && m.actorId !== filter.actorId) return false;

      // 6. Keyword search (Deterministic)
      if (filter.query && filter.query.trim()) {
        const tokens = filter.query
          .toLowerCase()
          .split(/[^a-z0-9_-]+/i)
          .filter((t) => t.length >= 3);
        if (tokens.length > 0) {
          const text = (m.title + ' ' + m.content).toLowerCase();
          const matches = tokens.some((t) => text.includes(t));
          if (!matches && !filter.agentRole) return false;
        }
      }

      return true;
    });

    return list.slice(0, cappedLimit);
  }

  clear(): void {
    this.memories.clear();
  }
}

export class MemoryIngestPipeline {
  constructor(private readonly store: OrganizationalMemoryStore) {}

  async ingestEvent(event: OfficeEvent, tenantId = 'pub-dev-loop'): Promise<OrganizationalMemory | null> {
    try {
      const projectId = event.project || 'pub-dev-loop';

      switch (event.type) {
        case 'APPROVAL_GRANTED':
        case 'APPROVAL_REJECTED': {
          const isGranted = event.type === 'APPROVAL_GRANTED';
          return await this.store.create({
            tenantId,
            projectId,
            type: 'DECISION',
            title: event.summary,
            content: `Decisão executiva do CEO: ${isGranted ? 'Aprovado' : 'Rejeitado'}. Notas: ${event.payload?.notes || 'Sem observações adicionais.'}`,
            status: 'ACTIVE',
            epistemicStatus: 'DECIDED',
            scope: 'PROJECT',
            actorId: event.actorId || 'ceo',
            metadata: {
              approvalId: event.payload?.approvalId,
              decision: event.payload?.decision || (isGranted ? 'GRANT' : 'REJECT'),
            },
            provenance: {
              projectId,
              actorId: event.actorId || 'ceo',
              source: 'CEO_DECISION',
              verifiedAt: event.timestamp || new Date().toISOString(),
              eventId: event.id,
              eventSequence: event.sequence,
              taskId: event.taskId,
              planId: event.planId,
            },
          });
        }

        case 'REVIEW_FINDING': {
          const findings = event.payload?.findings || [];
          const topFinding = findings[0] || {};
          return await this.store.create({
            tenantId,
            projectId,
            type: 'REVIEW_FINDING',
            title: event.summary,
            content: `Inconformidade detectada pelo Reviewer: ${topFinding.message || event.summary}. Sugestão: ${topFinding.suggestion || 'Corrigir código'}`,
            status: 'ACTIVE',
            epistemicStatus: 'DERIVED',
            scope: 'PROJECT',
            actorId: event.actorId || 'reviewer',
            metadata: {
              iteration: event.payload?.iteration || 1,
              findings,
            },
            provenance: {
              projectId,
              actorId: event.actorId || 'reviewer',
              source: 'REVIEW_INSPECTION',
              verifiedAt: event.timestamp || new Date().toISOString(),
              eventId: event.id,
              eventSequence: event.sequence,
              taskId: event.taskId,
              planId: event.planId,
              ruleId: topFinding.ruleId,
            },
          });
        }

        case 'REVIEW_BLOCKED': {
          return await this.store.create({
            tenantId,
            projectId,
            type: 'REVIEW_FINDING',
            title: event.summary,
            content: `Revisão Bloqueada: Limite de iterações atingido com inconformidades pendentes. Requer escalonamento executivo.`,
            status: 'BLOCKED',
            epistemicStatus: 'DERIVED',
            scope: 'PROJECT',
            actorId: event.actorId || 'reviewer',
            metadata: {
              blocked: true,
              maxIterations: event.payload?.maxIterations || 3,
            },
            provenance: {
              projectId,
              actorId: event.actorId || 'reviewer',
              source: 'REVIEW_INSPECTION',
              verifiedAt: event.timestamp || new Date().toISOString(),
              eventId: event.id,
              eventSequence: event.sequence,
              taskId: event.taskId,
              planId: event.planId,
            },
          });
        }

        case 'AGENT_FINISHED_WORK': {
          return await this.store.create({
            tenantId,
            projectId,
            type: 'TASK_RESULT',
            title: `Tarefa Concluída: ${event.summary}`,
            content: `Resultado de execução verificado com sucesso pelo runtime.`,
            status: 'ACTIVE',
            epistemicStatus: 'OBSERVED',
            scope: 'TASK',
            actorId: event.actorId,
            metadata: {
              taskId: event.taskId,
            },
            provenance: {
              projectId,
              actorId: event.actorId,
              source: 'RUNTIME_EXECUTION',
              verifiedAt: event.timestamp || new Date().toISOString(),
              eventId: event.id,
              eventSequence: event.sequence,
              taskId: event.taskId,
              planId: event.planId,
            },
          });
        }

        case 'AGENT_FAILED_WORK': {
          return await this.store.create({
            tenantId,
            projectId,
            type: 'TASK_RESULT',
            title: `Falha na Tarefa: ${event.summary}`,
            content: `Execução física falhou no runtime.`,
            status: 'ACTIVE',
            epistemicStatus: 'OBSERVED',
            scope: 'TASK',
            actorId: event.actorId,
            metadata: {
              taskId: event.taskId,
              failed: true,
            },
            provenance: {
              projectId,
              actorId: event.actorId,
              source: 'RUNTIME_EXECUTION',
              verifiedAt: event.timestamp || new Date().toISOString(),
              eventId: event.id,
              eventSequence: event.sequence,
              taskId: event.taskId,
              planId: event.planId,
            },
          });
        }

        case 'PLAN_FORMULATED': {
          return await this.store.create({
            tenantId,
            projectId,
            type: 'PLAN',
            title: event.summary,
            content: `Plano de decomposição organizacional estruturado pelo Chief of Staff com ${event.payload?.stepCount || 0} etapas.`,
            status: 'ACTIVE',
            epistemicStatus: 'DERIVED',
            scope: 'PROJECT',
            actorId: event.actorId || 'chief-of-staff',
            metadata: {
              planId: event.planId,
              stepCount: event.payload?.stepCount,
            },
            provenance: {
              projectId,
              actorId: event.actorId || 'chief-of-staff',
              source: 'ORGANIZATIONAL_PLAN',
              verifiedAt: event.timestamp || new Date().toISOString(),
              eventId: event.id,
              eventSequence: event.sequence,
              planId: event.planId,
            },
          });
        }

        default:
          // Eventos efêmeros ou puramente visuais são descartados
          return null;
      }
    } catch (err: any) {
      // Falha de ingest de memória NUNCA deve quebrar a execução principal
      console.error('[MemoryIngestPipeline] Ingest notice:', err.message);
      return null;
    }
  }
}

export class MemoryRetrievalEngine {
  constructor(private readonly store: OrganizationalMemoryStore) {}

  async retrieveContext(filter: MemorySearchFilter): Promise<OrganizationalMemory[]> {
    return await this.store.search(filter);
  }
}

export async function replayHistoricalEvents(
  pool: Pool,
  store: OrganizationalMemoryStore,
  options?: { project?: string; fromSequence?: number; toSequence?: number; tenantId?: string }
): Promise<{ processed: number; ingested: number; errors: string[] }> {
  const pipeline = new MemoryIngestPipeline(store);
  const tenantId = options?.tenantId || 'pub-dev-loop';
  const project = options?.project || 'pub-dev-loop';
  const fromSeq = options?.fromSequence || 0;
  const toSeq = options?.toSequence || 999999999;

  let processed = 0;
  let ingested = 0;
  const errors: string[] = [];

  try {
    const res = await pool.query(
      `SELECT * FROM office_events
       WHERE project = $1 AND sequence >= $2 AND sequence <= $3
       ORDER BY sequence ASC`,
      [project, fromSeq, toSeq]
    );

    for (const row of res.rows) {
      processed++;
      const evt: OfficeEvent = {
        id: row.id,
        sequence: parseInt(row.sequence, 10),
        type: row.type,
        timestamp: row.created_at.toISOString(),
        actorId: row.actor_id,
        targetId: row.target_id || undefined,
        project: row.project,
        taskId: row.task_id || undefined,
        planId: row.plan_id || undefined,
        stepId: row.step_id || undefined,
        summary: row.summary,
        payload: row.payload || {},
      };

      const mem = await pipeline.ingestEvent(evt, tenantId);
      if (mem) {
        ingested++;
      }
    }
  } catch (err: any) {
    errors.push(err.message);
  }

  return { processed, ingested, errors };
}

export const defaultMemoryStore = new OrganizationalMemoryStore();
export const defaultMemoryIngestPipeline = new MemoryIngestPipeline(defaultMemoryStore);
export const defaultMemoryRetrievalEngine = new MemoryRetrievalEngine(defaultMemoryStore);

/**
 * Formats retrieved verified organizational memories into a structured historical context block.
 * Precedence Rule: CURRENT TASK > RUNTIME POLICIES > ORGANIZATIONAL MEMORY
 */
export function formatDeveloperMemoryContext(memories: OrganizationalMemory[]): string {
  if (!memories || memories.length === 0) {
    return '';
  }

  const lines: string[] = [
    '---',
    '[ORGANIZATIONAL MEMORY — VERIFIED HISTORICAL CONTEXT]',
    'AVISO ESTATUTÁRIO: As informações abaixo representam contexto histórico de tarefas, decisões e revisões passadas.',
    'A instrução da tarefa atual, requisitos explícitos e políticas do runtime têm PRECEDÊNCIA ABSOLUTA sobre qualquer memória.',
    'Verifique sempre contra o estado real do repositório antes de aplicar qualquer padrão histórico.',
    '',
  ];

  memories.slice(0, 5).forEach((m, idx) => {
    lines.push(`${idx + 1}. TYPE: ${m.type} [${m.epistemicStatus}]`);
    lines.push(`   TITLE: ${m.title}`);
    lines.push(`   CONTENT: ${m.content}`);
    lines.push(`   SOURCE: ${m.provenance.source}`);
    lines.push('   PROVENANCE:');
    if (m.provenance.eventId) lines.push(`     eventId: ${m.provenance.eventId}`);
    if (m.provenance.taskId) lines.push(`     taskId: ${m.provenance.taskId}`);
    if (m.provenance.planId) lines.push(`     planId: ${m.provenance.planId}`);
    lines.push(`     projectId: ${m.provenance.projectId}`);
    lines.push(`     actorId: ${m.provenance.actorId}`);
    lines.push(`     verifiedAt: ${m.provenance.verifiedAt}`);
    if (m.provenance.ruleId) lines.push(`     ruleId: ${m.provenance.ruleId}`);
    if (m.recurrenceCount > 1) lines.push(`     recurrenceCount: ${m.recurrenceCount}`);
    lines.push('');
  });

  lines.push('---');
  return lines.join('\n');
}

/**
 * Enriches a Task for Developer execution by querying verified organizational memories.
 * Applies strict failure isolation (memory retrieval failure NEVER fails task execution).
 */
export async function enrichDeveloperTaskWithMemory(
  task: Task,
  retrievalEngine: MemoryRetrievalEngine = defaultMemoryRetrievalEngine
): Promise<Task> {
  // Somente o Developer é enriquecido nesta fase
  if (task.agentId !== 'developer') {
    return task;
  }

  const start = Date.now();
  try {
    const memories = await retrievalEngine.retrieveContext({
      tenantId: 'pub-dev-loop',
      projectId: task.project || 'pub-dev-loop',
      agentRole: 'developer',
      query: task.objective || undefined,
      limit: 5,
    });

    const durationMs = Date.now() - start;

    if (memories.length === 0) {
      return task;
    }

    const memoryBlock = formatDeveloperMemoryContext(memories);
    const enrichedPrompt = `${task.prompt}\n\n${memoryBlock}`;

    return {
      ...task,
      prompt: enrichedPrompt,
    };
  } catch (err: any) {
    // Failure Isolation: Falha no retrieval NUNCA quebra a execução principal
    console.warn(`[MemoryRetrieval] Notice: failed to retrieve memories for task ${task.id} (${Date.now() - start}ms): ${err.message}`);
    return task;
  }
}

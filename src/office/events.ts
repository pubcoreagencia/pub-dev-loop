import type { Pool } from 'pg';

export type OfficeEventType =
  | 'MESSAGE_SENT'
  | 'MESSAGE_RECEIVED'
  | 'AGENT_RESPONDED'
  | 'OBJECTIVE_SUBMITTED'
  | 'PLAN_FORMULATED'
  | 'STEP_DELEGATED'
  | 'AGENT_STARTED_WORK'
  | 'AGENT_FINISHED_WORK'
  | 'AGENT_FAILED_WORK'
  | 'AGENT_COLLABORATING'
  | 'AGENT_HANDOFF'
  | 'AGENT_COMMUNICATION'
  | 'MEETING_STARTED'
  | 'MEETING_ENDED'
  | 'REVIEW_REQUESTED'
  | 'REVIEW_STARTED'
  | 'REVIEW_FINDING'
  | 'REVIEW_CHANGES_REQUESTED'
  | 'REVIEW_APPROVED'
  | 'APPROVAL_REQUESTED'
  | 'APPROVAL_GRANTED'
  | 'APPROVAL_REJECTED';

export interface OfficeEvent {
  id: string;
  sequence: number;
  type: OfficeEventType;
  timestamp: string;
  actorId: string;
  targetId?: string;
  project?: string;
  taskId?: string;
  planId?: string;
  stepId?: string;
  summary: string;
  payload?: Record<string, any>;
}

export interface OfficeEventFilter {
  project?: string;
  type?: OfficeEventType;
  actorId?: string;
}

export type OfficeEventListener = (event: OfficeEvent) => void;

/**
 * Organizational Event Bus with Ring Buffer and optional PostgreSQL persistence.
 */
export class OfficeEventBus {
  private listeners = new Set<{ filter?: OfficeEventFilter; listener: OfficeEventListener }>();
  private history: OfficeEvent[] = [];
  private readonly maxHistorySize: number;
  private currentSequence = 0;
  private pool?: Pool;

  constructor(maxHistorySize = 250, pool?: Pool) {
    this.maxHistorySize = maxHistorySize;
    this.pool = pool;
  }

  setPool(pool: Pool): void {
    this.pool = pool;
  }

  publish(eventData: Omit<OfficeEvent, 'id' | 'sequence' | 'timestamp'>): OfficeEvent {
    this.currentSequence += 1;
    const event: OfficeEvent = {
      ...eventData,
      id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      sequence: this.currentSequence,
      timestamp: new Date().toISOString(),
    };

    // Buffer circular in-memory
    this.history.push(event);
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
    }

    // Disparo assíncrono para persistência em banco se pool estiver configurado
    if (this.pool) {
      this.persistEvent(event).catch(() => {
        // Log ou fallback silencioso
      });
    }

    // Notifica listeners registrados
    for (const sub of this.listeners) {
      if (this.matchesFilter(event, sub.filter)) {
        try {
          sub.listener(event);
        } catch {
          // Proteção contra erro em listener
        }
      }
    }

    return event;
  }

  private async persistEvent(event: OfficeEvent): Promise<void> {
    if (!this.pool) return;
    await this.pool.query(
      `INSERT INTO office_events (id, sequence, project, type, actor_id, target_id, task_id, plan_id, step_id, summary, payload, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12)
       ON CONFLICT (id) DO NOTHING`,
      [
        event.id,
        event.sequence,
        event.project || 'pub-dev-loop',
        event.type,
        event.actorId,
        event.targetId || null,
        event.taskId || null,
        event.planId || null,
        event.stepId || null,
        event.summary,
        JSON.stringify(event.payload || {}),
        event.timestamp,
      ]
    );
  }

  subscribe(filter: OfficeEventFilter | undefined, listener: OfficeEventListener): () => void {
    const sub = { filter, listener };
    this.listeners.add(sub);

    return () => {
      this.listeners.delete(sub);
    };
  }

  getEventsSince(lastSequence: number, filter?: OfficeEventFilter): OfficeEvent[] {
    return this.history
      .filter((e) => e.sequence > lastSequence)
      .filter((e) => this.matchesFilter(e, filter));
  }

  async getEventsSinceDb(lastSequence: number, project = 'pub-dev-loop'): Promise<OfficeEvent[]> {
    if (!this.pool) {
      return this.getEventsSince(lastSequence, { project });
    }
    const res = await this.pool.query(
      `SELECT * FROM office_events WHERE project = $1 AND sequence > $2 ORDER BY sequence ASC LIMIT 100`,
      [project, lastSequence]
    );
    return res.rows.map((r: any) => ({
      id: r.id,
      sequence: Number(r.sequence),
      type: r.type,
      timestamp: r.created_at,
      actorId: r.actor_id,
      targetId: r.target_id || undefined,
      project: r.project,
      taskId: r.task_id || undefined,
      planId: r.plan_id || undefined,
      stepId: r.step_id || undefined,
      summary: r.summary,
      payload: typeof r.payload === 'string' ? JSON.parse(r.payload) : r.payload,
    }));
  }

  getRecentEvents(limit = 50, filter?: OfficeEventFilter): OfficeEvent[] {
    const matched = this.history.filter((e) => this.matchesFilter(e, filter));
    return matched.slice(-limit);
  }

  getSubscriberCount(): number {
    return this.listeners.size;
  }

  clear(): void {
    this.history = [];
    this.currentSequence = 0;
  }

  private matchesFilter(event: OfficeEvent, filter?: OfficeEventFilter): boolean {
    if (!filter) return true;
    if (filter.project && event.project && filter.project !== event.project) {
      return false;
    }
    if (filter.type && event.type !== filter.type) {
      return false;
    }
    if (filter.actorId && event.actorId !== filter.actorId) {
      return false;
    }
    return true;
  }
}

export const defaultOfficeEventBus = new OfficeEventBus();

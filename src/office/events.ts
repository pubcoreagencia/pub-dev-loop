export type OfficeEventType =
  | 'MESSAGE_SENT'
  | 'MESSAGE_RECEIVED'
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
 * In-memory decoupled Organizational Event Bus with Ring Buffer for SSE replay & Last-Event-ID support.
 */
export class OfficeEventBus {
  private listeners = new Set<{ filter?: OfficeEventFilter; listener: OfficeEventListener }>();
  private history: OfficeEvent[] = [];
  private readonly maxHistorySize: number;
  private currentSequence = 0;

  constructor(maxHistorySize = 250) {
    this.maxHistorySize = maxHistorySize;
  }

  publish(eventData: Omit<OfficeEvent, 'id' | 'sequence' | 'timestamp'>): OfficeEvent {
    this.currentSequence += 1;
    const event: OfficeEvent = {
      ...eventData,
      id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      sequence: this.currentSequence,
      timestamp: new Date().toISOString(),
    };

    // Adiciona ao buffer circular de histórico
    this.history.push(event);
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
    }

    // Notifica listeners registrados
    for (const sub of this.listeners) {
      if (this.matchesFilter(event, sub.filter)) {
        try {
          sub.listener(event);
        } catch {
          // Protege contra falhas em listeners individuais
        }
      }
    }

    return event;
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

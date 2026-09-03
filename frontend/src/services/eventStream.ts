import type { OfficeEvent } from '../types/office';

export type EventStreamStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export interface EventStreamListener {
  onEvent: (event: OfficeEvent) => void;
  onStatusChange?: (status: EventStreamStatus) => void;
}

export class OfficeEventStreamClient {
  private eventSource: EventSource | null = null;
  private status: EventStreamStatus = 'disconnected';
  private reconnectTimer: any = null;
  private reconnectAttempts = 0;
  private readonly baseUrl: string;
  private readonly project: string;
  private readonly listener: EventStreamListener;
  private lastEventSequence = 0;
  private isExplicitlyClosed = false;

  constructor(project = 'pub-dev-loop', listener: EventStreamListener, baseUrl = '') {
    this.project = project;
    this.listener = listener;
    this.baseUrl = baseUrl;
  }

  public connect(): void {
    if (this.eventSource || this.isExplicitlyClosed) return;

    this.setStatus('connecting');
    const url = `${this.baseUrl}/office/stream?project=${encodeURIComponent(this.project)}${
      this.lastEventSequence > 0 ? `&lastEventId=${this.lastEventSequence}` : ''
    }`;

    try {
      this.eventSource = new EventSource(url);

      this.eventSource.onopen = () => {
        this.reconnectAttempts = 0;
        this.setStatus('connected');
      };

      this.eventSource.addEventListener('office', (e: MessageEvent) => {
        try {
          const parsed = JSON.parse(e.data) as OfficeEvent;
          if (parsed && parsed.id) {
            if (parsed.sequence) {
              this.lastEventSequence = Math.max(this.lastEventSequence, parsed.sequence);
            }
            this.listener.onEvent(parsed);
          }
        } catch {
          // Ignorar mensagens mal formatadas
        }
      });

      this.eventSource.onerror = () => {
        if (this.eventSource) {
          this.eventSource.close();
          this.eventSource = null;
        }
        this.setStatus('error');
        this.scheduleReconnect();
      };
    } catch {
      this.setStatus('error');
      this.scheduleReconnect();
    }
  }

  public close(): void {
    this.isExplicitlyClosed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    this.setStatus('disconnected');
  }

  public getStatus(): EventStreamStatus {
    return this.status;
  }

  private setStatus(newStatus: EventStreamStatus): void {
    if (this.status !== newStatus) {
      this.status = newStatus;
      this.listener.onStatusChange?.(newStatus);
    }
  }

  private scheduleReconnect(): void {
    if (this.isExplicitlyClosed || this.reconnectTimer) return;
    this.reconnectAttempts += 1;
    const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), 15000);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }
}

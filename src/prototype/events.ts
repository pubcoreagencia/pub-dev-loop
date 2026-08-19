import type { PrototypeEvent, PrototypeEventType } from './domain.js';

export interface PrototypeEventInput<TPayload extends Record<string, unknown> = Record<string, unknown>> {
  sessionId: string;
  type: PrototypeEventType;
  payload?: TPayload;
}

/**
 * In-memory event stream for the first Prototype Mode slice.
 * The persistence layer can subscribe to the same contract later without
 * changing the browser-facing event shape.
 */
export class PrototypeEventStream {
  private sequence = 0;
  private readonly listeners = new Set<(event: PrototypeEvent) => void>();

  emit<TPayload extends Record<string, unknown>>(
    input: PrototypeEventInput<TPayload>,
  ): PrototypeEvent<TPayload> {
    const event: PrototypeEvent<TPayload> = {
      id: `pe_${Date.now()}_${this.sequence + 1}`,
      sessionId: input.sessionId,
      type: input.type,
      sequence: ++this.sequence,
      timestamp: new Date(),
      payload: input.payload ?? ({} as TPayload),
    };

    for (const listener of this.listeners) {
      listener(event);
    }

    return event;
  }

  subscribe(listener: (event: PrototypeEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

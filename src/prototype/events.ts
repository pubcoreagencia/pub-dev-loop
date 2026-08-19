import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import type { PrototypeEvent, PrototypeEventType } from './domain.js';

export interface PrototypeEventInput<TPayload extends Record<string, unknown> = Record<string, unknown>> {
  sessionId: string;
  type: PrototypeEventType;
  payload?: TPayload;
}

export interface PrototypeEventPublisher {
  emit<TPayload extends Record<string, unknown>>(
    input: PrototypeEventInput<TPayload>,
  ): PrototypeEvent<TPayload>;
  subscribe(listener: (event: PrototypeEvent) => void): () => void;
}

/** Local fan-out used by the API and worker for in-process listeners. */
export class PrototypeEventStream implements PrototypeEventPublisher {
  private sequence = 0;
  private readonly listeners = new Set<(event: PrototypeEvent) => void>();

  emit<TPayload extends Record<string, unknown>>(
    input: PrototypeEventInput<TPayload>,
  ): PrototypeEvent<TPayload> {
    const event: PrototypeEvent<TPayload> = {
      id: `pe_${randomUUID()}`,
      sessionId: input.sessionId,
      type: input.type,
      sequence: ++this.sequence,
      timestamp: new Date(),
      payload: input.payload ?? ({} as TPayload),
    };

    for (const listener of this.listeners) listener(event);
    return event;
  }

  subscribe(listener: (event: PrototypeEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

/**
 * Cross-process publisher/bridge.
 * Events are persisted and broadcast through PostgreSQL NOTIFY so API and
 * worker processes do not need to share memory.
 */
export class PostgresPrototypeEventPublisher implements PrototypeEventPublisher {
  private sequence = 0;
  private readonly listeners = new Set<(event: PrototypeEvent) => void>();
  private readonly channel = 'prototype_events';

  constructor(private readonly pool: Pool) {}

  emit<TPayload extends Record<string, unknown>>(
    input: PrototypeEventInput<TPayload>,
  ): PrototypeEvent<TPayload> {
    const event: PrototypeEvent<TPayload> = {
      id: `pe_${randomUUID()}`,
      sessionId: input.sessionId,
      type: input.type,
      sequence: ++this.sequence,
      timestamp: new Date(),
      payload: input.payload ?? ({} as TPayload),
    };

    for (const listener of this.listeners) listener(event);

    // Persistence/broadcast is intentionally fire-and-forget so the worker's
    // task execution path does not block on the event transport.
    void this.pool.query(
      `INSERT INTO prototype_events (id, session_id, type, sequence, payload, created_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6)`,
      [event.id, event.sessionId, event.type, event.sequence, JSON.stringify(event.payload), event.timestamp],
    ).then(() => this.pool.query(`SELECT pg_notify($1, $2)`, [this.channel, JSON.stringify(event)]))
      .catch(() => undefined);

    return event;
  }

  subscribe(listener: (event: PrototypeEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

/**
 * API-side listener for worker events. Uses a dedicated client because a
 * PostgreSQL connection subscribed to LISTEN should not be used for queries.
 */
export class PostgresPrototypeEventBridge {
  private client: import('pg').PoolClient | null = null;

  constructor(private readonly pool: Pool, private readonly target: PrototypeEventStream) {}

  async start(): Promise<void> {
    if (this.client) return;
    const client = await this.pool.connect();
    this.client = client;
    client.on('notification', msg => {
      if (!msg.payload) return;
      try {
        this.target.receive(JSON.parse(msg.payload) as PrototypeEvent);
      } catch {
        // Ignore malformed external events; the request path remains healthy.
      }
    });
    client.on('error', () => {
      this.client = null;
    });
    await client.query('LISTEN prototype_events');
  }

  async stop(): Promise<void> {
    const client = this.client;
    this.client = null;
    if (!client) return;
    await client.query('UNLISTEN prototype_events').catch(() => undefined);
    client.release();
  }
}

// Allow the bridge to inject events into a local stream without exposing that
// method as part of the normal emitter API.
(PrototypeEventStream.prototype as PrototypeEventStream & {
  receive?: (event: PrototypeEvent) => void;
}).receive = function receive(event: PrototypeEvent): void {
  for (const listener of (this as PrototypeEventStream).listeners ?? []) listener(event);
};

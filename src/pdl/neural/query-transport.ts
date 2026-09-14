/**
 * Transport Boundary for PUB Neural Query.
 * Decouples the PDL Query Adapter from actual network protocols (HTTP, IPC, in-process stubs).
 */

import type {
  NeuralQueryRequestPayload,
  NeuralQueryResponsePayload,
} from './query-types.js';

export interface NeuralQueryTransport {
  sendQuery(payload: NeuralQueryRequestPayload): Promise<NeuralQueryResponsePayload>;
}

export class StubNeuralQueryTransport implements NeuralQueryTransport {
  private responseProvider: (
    payload: NeuralQueryRequestPayload
  ) => Promise<NeuralQueryResponsePayload> | NeuralQueryResponsePayload;

  constructor(
    responseProvider?: (
      payload: NeuralQueryRequestPayload
    ) => Promise<NeuralQueryResponsePayload> | NeuralQueryResponsePayload
  ) {
    this.responseProvider =
      responseProvider ||
      ((payload) => ({
        request_id: payload.request_id,
        status: 'NO_MATCH',
        results: [],
        reason: 'Stub transport default NO_MATCH response',
      }));
  }

  setResponseProvider(
    provider: (
      payload: NeuralQueryRequestPayload
    ) => Promise<NeuralQueryResponsePayload> | NeuralQueryResponsePayload
  ): void {
    this.responseProvider = provider;
  }

  async sendQuery(payload: NeuralQueryRequestPayload): Promise<NeuralQueryResponsePayload> {
    return Promise.resolve(this.responseProvider(payload));
  }
}

/**
 * Preparatory HTTP transport boundary scaffold for PUB Neural Query.
 *
 * PHASE C CONFORMANCE STATUS: PREPARATORY ONLY (NON-OPERATIONAL).
 * - PUB Neural has NO active HTTP server, REST API, or MCP endpoint in Phase C.
 * - This class provides an offline-safe transport client scaffold that fails closed
 *   with { status: 'UNAVAILABLE' } when unconfigured or unreachable.
 * - It does NOT provide or claim active end-to-end network integration.
 */
export class HttpNeuralQueryTransport implements NeuralQueryTransport {
  readonly endpoint?: string;
  private readonly token?: string;
  private readonly timeoutMs: number;

  constructor(options?: { endpoint?: string; token?: string; timeoutMs?: number }) {
    this.endpoint = options?.endpoint || process.env.PUB_NEURAL_ENDPOINT;
    this.token = options?.token || process.env.PUB_NEURAL_TOKEN;
    this.timeoutMs = options?.timeoutMs || 5000;
  }

  async sendQuery(payload: NeuralQueryRequestPayload): Promise<NeuralQueryResponsePayload> {
    if (!this.endpoint) {
      return {
        request_id: payload.request_id,
        status: 'UNAVAILABLE',
        results: [],
        reason: 'PUB Neural endpoint not configured (PUB_NEURAL_ENDPOINT missing)',
      };
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

      const url = this.endpoint.endsWith('/')
        ? `${this.endpoint}v1/query`
        : `${this.endpoint}/v1/query`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        return {
          request_id: payload.request_id,
          status: response.status >= 500 ? 'INTERNAL_ERROR' : 'UNAVAILABLE',
          results: [],
          reason: `PUB Neural HTTP ${response.status} ${response.statusText}: ${errorBody}`,
        };
      }

      const resData = (await response.json()) as NeuralQueryResponsePayload;
      return resData;
    } catch (err: any) {
      return {
        request_id: payload.request_id,
        status: 'UNAVAILABLE',
        results: [],
        reason: `PUB Neural connection failure: ${err.message}`,
      };
    }
  }
}

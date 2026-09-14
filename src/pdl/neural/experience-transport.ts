/**
 * Transport Boundary for PUB Neural Experience Writeback (Phase D).
 * Decouples the PDL Experience Adapter from actual network protocols (HTTP, IPC, in-process stubs).
 */

import type {
  ExperienceWritebackResponsePayload,
  NeuralExperienceRecordPayload,
} from './experience-types.js';

export interface NeuralExperienceTransport {
  sendExperience(
    record: NeuralExperienceRecordPayload
  ): Promise<ExperienceWritebackResponsePayload>;
}

export class StubNeuralExperienceTransport implements NeuralExperienceTransport {
  private responseProvider: (
    record: NeuralExperienceRecordPayload
  ) => Promise<ExperienceWritebackResponsePayload> | ExperienceWritebackResponsePayload;

  constructor(
    responseProvider?: (
      record: NeuralExperienceRecordPayload
    ) => Promise<ExperienceWritebackResponsePayload> | ExperienceWritebackResponsePayload
  ) {
    this.responseProvider =
      responseProvider ||
      ((record) => ({
        status: 'ACCEPTED',
        taskId: record.taskId,
        eventId: `stub-ev-${record.taskId}`,
        idempotencyKey: `stub-idempotency-${record.taskId}`,
        isDuplicate: false,
        candidateFindingsCount: record.candidateFindings?.length ?? 0,
        recordedAt: new Date().toISOString(),
      }));
  }

  setResponseProvider(
    provider: (
      record: NeuralExperienceRecordPayload
    ) => Promise<ExperienceWritebackResponsePayload> | ExperienceWritebackResponsePayload
  ): void {
    this.responseProvider = provider;
  }

  async sendExperience(
    record: NeuralExperienceRecordPayload
  ): Promise<ExperienceWritebackResponsePayload> {
    return Promise.resolve(this.responseProvider(record));
  }
}

/**
 * Preparatory HTTP transport boundary scaffold for PUB Neural Experience Writeback.
 *
 * PHASE D CONFORMANCE STATUS: PREPARATORY ONLY (NON-OPERATIONAL).
 * - PUB Neural has NO active HTTP server, REST API, or MCP endpoint in Phase D.
 * - This class provides an offline-safe transport client scaffold that fails closed
 *   with { status: 'UNAVAILABLE' } when unconfigured or unreachable.
 * - It does NOT provide or claim active end-to-end network integration.
 */
export class HttpNeuralExperienceTransport implements NeuralExperienceTransport {
  readonly endpoint?: string;
  private readonly token?: string;
  private readonly timeoutMs: number;

  constructor(options?: { endpoint?: string; token?: string; timeoutMs?: number }) {
    this.endpoint = options?.endpoint || process.env.PUB_NEURAL_ENDPOINT;
    this.token = options?.token || process.env.PUB_NEURAL_TOKEN;
    this.timeoutMs = options?.timeoutMs || 5000;
  }

  async sendExperience(
    record: NeuralExperienceRecordPayload
  ): Promise<ExperienceWritebackResponsePayload> {
    if (!this.endpoint) {
      return {
        taskId: record.taskId,
        status: 'UNAVAILABLE',
        reason: 'PUB Neural endpoint not configured (PUB_NEURAL_ENDPOINT missing)',
      };
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

      const url = this.endpoint.endsWith('/')
        ? `${this.endpoint}v1/experience`
        : `${this.endpoint}/v1/experience`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
        },
        body: JSON.stringify(record),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        return {
          taskId: record.taskId,
          status: response.status >= 500 ? 'INTERNAL_ERROR' : 'UNAVAILABLE',
          reason: `PUB Neural HTTP ${response.status} ${response.statusText}: ${errorBody}`,
        };
      }

      const resData = (await response.json()) as ExperienceWritebackResponsePayload;
      return resData;
    } catch (err: any) {
      return {
        taskId: record.taskId,
        status: 'UNAVAILABLE',
        reason: `PUB Neural writeback connection failure: ${err.message}`,
      };
    }
  }
}

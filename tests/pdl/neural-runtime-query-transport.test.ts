import { describe, it, expect } from 'vitest';
import { HttpNeuralQueryTransport } from '../../src/pdl/neural/query-transport.js';
import type { NeuralQueryRequestPayload } from '../../src/pdl/neural/query-types.js';

const payload: NeuralQueryRequestPayload = {
  request_id: 'runtime-transport-test',
  task_id: 'task-1',
  project_id: 'pub-dev-loop',
  repository: 'pubcoreagencia/pub-dev-loop',
  objective: 'verify runtime query transport',
  requested_knowledge_classes: ['LESSON'],
  caller: { actor_id: 'pdl:test', agent_role: null, trust_zone: 'tz_internal_holding' },
  timestamp: '2026-09-18T00:00:00.000Z',
  branch: null,
  commit_sha: null,
  limit: 5,
};

describe('PUB Neural Runtime query transport', () => {
  it('uses POST /api/v1/runtime/query with Bearer authentication', async () => {
    const originalFetch = globalThis.fetch;
    let url = '';
    let init: RequestInit | undefined;
    globalThis.fetch = (async (input: RequestInfo | URL, requestInit?: RequestInit) => {
      url = String(input);
      init = requestInit;
      return new Response(JSON.stringify({ request_id: payload.request_id, status: 'NO_MATCH', results: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as typeof fetch;

    try {
      const result = await new HttpNeuralQueryTransport({
        endpoint: 'https://neural.example',
        token: 'runtime-secret',
      }).sendQuery(payload);

      expect(result.status).toBe('NO_MATCH');
      expect(url).toBe('https://neural.example/api/v1/runtime/query');
      expect(init?.method).toBe('POST');
      expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer runtime-secret');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('accepts an endpoint already rooted at /api/v1/runtime', async () => {
    const originalFetch = globalThis.fetch;
    let url = '';
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      url = String(input);
      return new Response(JSON.stringify({ request_id: payload.request_id, status: 'NO_MATCH', results: [] }), { status: 200 });
    }) as typeof fetch;

    try {
      await new HttpNeuralQueryTransport({
        endpoint: 'https://neural.example/api/v1/runtime',
        token: 'runtime-secret',
      }).sendQuery(payload);
      expect(url).toBe('https://neural.example/api/v1/runtime/query');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('refuses dispatch when PUB_NEURAL_TOKEN is absent', async () => {
    const originalFetch = globalThis.fetch;
    let called = false;
    globalThis.fetch = (async () => {
      called = true;
      return new Response('{}', { status: 200 });
    }) as typeof fetch;

    try {
      const result = await new HttpNeuralQueryTransport({ endpoint: 'https://neural.example' }).sendQuery(payload);
      expect(result.status).toBe('UNAVAILABLE');
      expect(result.reason).toContain('PUB_NEURAL_TOKEN missing');
      expect(called).toBe(false);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider } from '../src/providers/router.js';
import { normalizeBaseUrl } from '../src/providers/shared.js';
import { createProvider } from '../src/agent.js';

describe('router provider configuration', () => {
  it('uses the documented default base URL', () => {
    expect(normalizeBaseUrl(undefined, 'http://localhost:20128/v1')).toBe('http://localhost:20128/v1');
  });

  it('accepts a custom base URL', () => {
    expect(normalizeBaseUrl('https://router.example.com/v1/', 'http://localhost:20128/v1')).toBe('https://router.example.com/v1');
  });

  it('selects the 9router provider from AGENT_PROVIDER', () => {
    const previous = process.env.AGENT_PROVIDER;
    process.env.AGENT_PROVIDER = '9router';
    try {
      expect(createProvider('9router')?.kind).toBe('9router');
    } finally {
      process.env.AGENT_PROVIDER = previous;
    }
  });
});

describe('RouterProvider', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('reports connectivity and model metadata without a secret', async () => {
    const fetchMock = vi.fn(async () => new Response('{"data":[]}', { status: 200, headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);

    const provider = new RouterProvider('http://localhost:20128/v1', undefined, 1000);
    const health = await provider.health();
    expect(health).toMatchObject({ available: true });
    expect(provider.metadata()).toMatchObject({ baseUrl: 'http://localhost:20128/v1' });
  });

  it('maps HTTP errors into provider failures', async () => {
    const fetchMock = vi.fn(async () => new Response('{"error":{"message":"nope"}}', { status: 500, headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);

    const provider = new RouterProvider('http://localhost:20128/v1', undefined, 1000);
    const result = await provider.execute(
      { id: 'TASK-1', project: 'p', repository: 'r', objective: 'o', prompt: 'hi', status: 'RUNNING', priority: 0, worker: null, result: null, error: null, branch: null, commitSha: null, gitStatus: null, createdAt: new Date(), updatedAt: new Date() },
      'C:/tmp/workspace',
    );

    expect(result.status).toBe('ROUTER_HTTP_ERROR');
    expect(result.exitCode).toBe(500);
    expect(result.errorCode).toBe('ROUTER_HTTP_ERROR');
  });
});

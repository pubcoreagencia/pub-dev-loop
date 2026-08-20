import { describe, it, expect, beforeEach } from 'vitest';
import apiWorkerDefault, { PubDevLoopWorkerContainer, resetRateLimitMap } from '../src/api-worker.js';

describe('Cloudflare Worker API Adapter (src/api-worker.ts)', () => {
  beforeEach(() => {
    resetRateLimitMap();
  });

  it('GET /health returns 200 OK with runtime cloudflare-worker', async () => {
    const req = new Request('https://pub-dev-loop.internal/health', { method: 'GET' });
    const res = await apiWorkerDefault.fetch(req, {}, {});
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.status).toBe('ok');
    expect(body.runtime).toBe('cloudflare-worker');
  });

  it('POST /tasks without API key returns 401 Unauthorized when PUB_DEV_LOOP_API_KEY is set', async () => {
    const req = new Request('https://pub-dev-loop.internal/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project: 'test', repository: 'repo', objective: 'obj', prompt: 'prompt' }),
    });
    const res = await apiWorkerDefault.fetch(req, { PUB_DEV_LOOP_API_KEY: 'secret-key-123' }, {});
    expect(res.status).toBe(401);
    const body = (await res.json()) as any;
    expect(body.error).toContain('Unauthorized');
  });

  it('POST /tasks with invalid API key returns 401 Unauthorized', async () => {
    const req = new Request('https://pub-dev-loop.internal/tasks', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer wrong-key',
      },
      body: JSON.stringify({ project: 'test', repository: 'repo', objective: 'obj', prompt: 'prompt' }),
    });
    const res = await apiWorkerDefault.fetch(req, { PUB_DEV_LOOP_API_KEY: 'secret-key-123' }, {});
    expect(res.status).toBe(401);
  });

  it('POST /tasks with valid X-API-Key or Bearer header passes auth check', async () => {
    const req = new Request('https://pub-dev-loop.internal/tasks', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': 'secret-key-123',
      },
      body: JSON.stringify({ project: 'test', repository: 'repo', objective: 'obj', prompt: 'prompt' }),
    });
    // Will fail at getRepository (no db binding) but MUST pass 401 check (res.status is 500 DB missing, not 401)
    const res = await apiWorkerDefault.fetch(req, { PUB_DEV_LOOP_API_KEY: 'secret-key-123' }, {});
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(429);
  });

  it('POST /tasks exceeds rate limit returns 429 Too Many Requests', async () => {
    const env = { PUB_DEV_LOOP_API_KEY: 'secret-key-123' };

    for (let i = 0; i < 10; i++) {
      const req = new Request('https://pub-dev-loop.internal/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'cf-connecting-ip': '203.0.113.195',
          'X-API-Key': 'secret-key-123',
        },
        body: JSON.stringify({ project: 'test', repository: 'repo', objective: 'obj', prompt: 'prompt' }),
      });
      await apiWorkerDefault.fetch(req, env, {});
    }

    // 11th request from same IP
    const spamReq = new Request('https://pub-dev-loop.internal/tasks', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'cf-connecting-ip': '203.0.113.195',
        'X-API-Key': 'secret-key-123',
      },
      body: JSON.stringify({ project: 'test', repository: 'repo', objective: 'obj', prompt: 'prompt' }),
    });
    const res = await apiWorkerDefault.fetch(spamReq, env, {});
    expect(res.status).toBe(429);
    const body = (await res.json()) as any;
    expect(body.error).toBe('Too Many Requests');
  });

  it('PubDevLoopWorkerContainer instantiates natively from official Container base class as a background daemon', async () => {
    const mockCtx = {
      container: {
        start: async () => {},
      },
      storage: {
        kv: {
          get: async () => null,
          put: async () => {},
        },
        sql: {
          exec: () => [],
        },
        sync: async () => {},
        setAlarm: async () => {},
        getAlarm: async () => null,
      },
      blockConcurrencyWhile: async (fn: any) => fn(),
    };
    const container = new PubDevLoopWorkerContainer(mockCtx as any, {});
    expect(container.defaultPort).toBe(3000);
    expect(typeof container.start).toBe('function');
    expect(typeof container.renewActivityTimeout).toBe('function');
    expect(typeof container.onStart).toBe('function');
  });

  it('GET /prototype returns 200 HTML with PUB Prototype UI and history script', async () => {
    const req = new Request('https://pub-dev-loop.internal/prototype', { method: 'GET' });
    const res = await apiWorkerDefault.fetch(req, {}, {});
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('text/html');
    const html = await res.text();
    expect(html).toContain('PUB Prototype');
    expect(html).toContain('Version History');
  });

  it('POST /prototype/sessions without project returns 400 Bad Request', async () => {
    const req = new Request('https://pub-dev-loop.internal/prototype/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const res = await apiWorkerDefault.fetch(req, {}, {});
    expect(res.status).toBe(400);
    const body = (await res.json()) as any;
    expect(body.error).toContain('project is required');
  });

  it('POST /prototype/sessions/:id/prompts without prompt returns 400 Bad Request', async () => {
    const req = new Request('https://pub-dev-loop.internal/prototype/sessions/session-123/prompts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const res = await apiWorkerDefault.fetch(req, {}, {});
    expect(res.status).toBe(400);
    const body = (await res.json()) as any;
    expect(body.error).toContain('prompt is required');
  });

  it('POST /prototype/sessions/:id/checkpoints with invalid promptIndex returns 400', async () => {
    const req = new Request('https://pub-dev-loop.internal/prototype/sessions/session-123/checkpoints', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ promptIndex: -1, prompt: 'test' }),
    });
    const res = await apiWorkerDefault.fetch(req, {}, {});
    expect(res.status).toBe(400);
    const body = (await res.json()) as any;
    expect(body.error).toContain('promptIndex and prompt are required');
  });
});


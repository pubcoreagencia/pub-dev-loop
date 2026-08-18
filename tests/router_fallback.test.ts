// tests/router_fallback.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RouterProvider } from '../src/providers/router.js';
import { loadRouterConfig } from '../src/providers/routerConfig.js';

function createFetchMock(responses) {
  const queue = responses.slice();
  return vi.fn(async () => {
    const resp = queue.shift();
    if (!resp) throw new Error('No mock response left');
    const { status, body, headers = {} } = resp;
    const init = {
      status,
      headers: {
        'content-type': 'application/json',
        ...headers,
      },
    };
    return new Response(JSON.stringify(body), init);
  });
}

function baseTask() {
  return {
    id: 'TASK-1',
    project: 'p',
    repository: 'r',
    objective: 'o',
    prompt: 'hi',
    status: 'RUNNING',
    priority: 0,
    worker: null,
    result: null,
    error: null,
    branch: null,
    commitSha: null,
    gitStatus: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as any;
}

describe('Router fallback and retry behavior', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.ROUTER_MODEL = 'gemini/gemini-3.7-flash';
    process.env.ROUTER_FALLBACK_MODELS = 'gemini/gemini-3.6-flash';
    process.env.ROUTER_MAX_RETRIES = '2';
    process.env.ROUTER_RETRY_BASE_DELAY_MS = '0';
  });

  it('Test 1 – primary success (200)', async () => {
    const fetchMock = createFetchMock([
      { status: 200, body: { model: 'gemini/gemini-3.7-flash', choices: [{ message: { content: 'ok' }, finish_reason: 'stop' }] } },
    ]);
    vi.stubGlobal('fetch', fetchMock);
    const provider = new RouterProvider('http://localhost:20128/v1', undefined, 1000);
    const result = await provider.execute(baseTask(), 'C:/tmp/ws');
    expect(result.status).toBe('COMPLETED');
    expect(result.model).toBe('gemini/gemini-3.7-flash');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('Test 2 – primary 429 then fallback success', async () => {
    const fetchMock = createFetchMock([
      { status: 429, body: { error: { message: 'quota' } } },
      { status: 200, body: { model: 'gemini/gemini-3.6-flash', choices: [{ message: { content: 'ok' }, finish_reason: 'stop' }] } },
    ]);
    vi.stubGlobal('fetch', fetchMock);
    const provider = new RouterProvider('http://localhost:20128/v1', undefined, 1000);
    const result = await provider.execute(baseTask(), 'C:/tmp/ws');
    expect(result.status).toBe('COMPLETED');
    expect(result.model).toBe('gemini/gemini-3.6-flash');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('Test 3 – primary 429 retry twice then fallback success', async () => {
    const fetchMock = createFetchMock([
      { status: 429, body: { error: { message: 'quota' } } },
      { status: 429, body: { error: { message: 'quota' } } },
      { status: 200, body: { model: 'gemini/gemini-3.6-flash', choices: [{ message: { content: 'ok' }, finish_reason: 'stop' }] } },
    ]);
    vi.stubGlobal('fetch', fetchMock);
    const provider = new RouterProvider('http://localhost:20128/v1', undefined, 1000);
    const result = await provider.execute(baseTask(), 'C:/tmp/ws');
    expect(result.status).toBe('COMPLETED');
    expect(result.model).toBe('gemini/gemini-3.6-flash');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('Test 4 – all models fail (ALL_PROVIDERS_FAILED)', async () => {
    const fetchMock = createFetchMock([
      { status: 429, body: { error: { message: 'quota' } } },
      { status: 429, body: { error: { message: 'quota' } } },
      { status: 429, body: { error: { message: 'quota' } } },
      { status: 429, body: { error: { message: 'quota' } } },
    ]);
    vi.stubGlobal('fetch', fetchMock);
    const provider = new RouterProvider('http://localhost:20128/v1', undefined, 1000);
    const result = await provider.execute(baseTask(), 'C:/tmp/ws');
    expect(result.status).toBe('FAILED');
    expect(result.errorCode).toBe('ALL_PROVIDERS_FAILED');
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('Test 5 – 5xx retry then success', async () => {
    const fetchMock = createFetchMock([
      { status: 500, body: { error: { message: 'server' } } },
      { status: 200, body: { model: 'gemini/gemini-3.7-flash', choices: [{ message: { content: 'ok' }, finish_reason: 'stop' }] } },
    ]);
    vi.stubGlobal('fetch', fetchMock);
    const provider = new RouterProvider('http://localhost:20128/v1', undefined, 1000);
    const result = await provider.execute(baseTask(), 'C:/tmp/ws');
    expect(result.status).toBe('COMPLETED');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

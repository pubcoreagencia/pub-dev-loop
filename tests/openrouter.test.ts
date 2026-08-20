import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OpenRouterProvider } from '../src/providers/openrouter.js';
import { loadOpenRouterConfig } from '../src/providers/openrouterConfig.js';
import { normalizeBaseUrl } from '../src/providers/shared.js';
import { createProvider, createSingleProvider } from '../src/agent.js';

function baseTask() {
  return {
    id: 'TASK-OR-1',
    project: 'test-project',
    repository: 'https://github.com/test/repo.git',
    objective: 'Test openrouter provider',
    prompt: 'Implement feature',
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

describe('OpenRouter Provider Configuration & Setup', () => {
  it('uses documented default base URL and normalization', () => {
    expect(normalizeBaseUrl(undefined, 'https://openrouter.ai/api/v1')).toBe('https://openrouter.ai/api/v1');
    expect(normalizeBaseUrl('https://custom.openrouter.ai/api/v1/', 'https://openrouter.ai/api/v1')).toBe('https://custom.openrouter.ai/api/v1');
  });

  it('loads configuration defaults and overrides correctly', () => {
    const prevModel = process.env.OPENROUTER_MODEL;
    const prevFallbacks = process.env.OPENROUTER_FALLBACK_MODELS;
    try {
      process.env.OPENROUTER_MODEL = 'anthropic/claude-3.5-sonnet';
      process.env.OPENROUTER_FALLBACK_MODELS = 'google/gemini-2.5-flash,meta-llama/llama-3.3-70b-instruct';
      const cfg = loadOpenRouterConfig();
      expect(cfg.primaryModel).toBe('anthropic/claude-3.5-sonnet');
      expect(cfg.fallbackModels).toEqual(['google/gemini-2.5-flash', 'meta-llama/llama-3.3-70b-instruct']);
      expect(cfg.maxRetries).toBeGreaterThanOrEqual(1);
    } finally {
      process.env.OPENROUTER_MODEL = prevModel;
      process.env.OPENROUTER_FALLBACK_MODELS = prevFallbacks;
    }
  });

  it('selects openrouter provider via createProvider and createSingleProvider', () => {
    const provider = createSingleProvider('openrouter');
    expect(provider.kind).toBe('openrouter');
    expect(provider.capabilities()).toContain('openrouter');
  });
});

describe('OpenRouterProvider Execution & Error Handling', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.OPENROUTER_MODEL = 'openrouter/free';
    process.env.OPENROUTER_API_KEY = 'sk-or-test-secret-key-12345';
    process.env.OPENROUTER_MAX_RETRIES = '2';
    process.env.OPENROUTER_RETRY_BASE_DELAY_MS = '0';
  });

  it('executes successfully with mock HTTP 200 response and produces COMPLETED status', async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          model: 'openrouter/free',
          choices: [
            {
              message: { role: 'assistant', content: 'Code generation complete.' },
              finish_reason: 'stop',
            },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    const provider = new OpenRouterProvider('https://openrouter.ai/api/v1', 'sk-or-test-secret-key-12345', 2000);
    const result = await provider.execute(baseTask(), 'C:/tmp/workspace');

    expect(result.status).toBe('COMPLETED');
    expect(result.provider).toBe('openrouter');
    expect(result.model).toBe('openrouter/free');
    expect(result.stdout).toBe('Code generation complete.');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Verify Authorization header was passed
    const requestHeaders = fetchMock.mock.calls[0][1]?.headers as Record<string, string>;
    expect(requestHeaders?.authorization).toBe('Bearer sk-or-test-secret-key-12345');
  });

  it('never exposes OPENROUTER_API_KEY in metadata or result', async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          model: 'openrouter/free',
          choices: [{ message: { content: 'ok' }, finish_reason: 'stop' }],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    const secret = 'sk-or-super-confidential-token-xyz';
    const provider = new OpenRouterProvider('https://openrouter.ai/api/v1', secret, 2000);
    const meta = provider.metadata();
    expect(JSON.stringify(meta)).not.toContain(secret);

    const result = await provider.execute(baseTask(), 'C:/tmp/workspace');
    expect(JSON.stringify(result)).not.toContain(secret);
  });

  it('maps HTTP 429 rate limit error to ROUTER_HTTP_ERROR', async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({ error: { message: 'Rate limit exceeded on OpenRouter', code: 429 } }),
        { status: 429, headers: { 'content-type': 'application/json' } },
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    const provider = new OpenRouterProvider('https://openrouter.ai/api/v1', 'sk-or-test', 2000);
    const result = await provider.execute(baseTask(), 'C:/tmp/workspace');

    expect(result.status).toBe('ROUTER_HTTP_ERROR');
    expect(result.httpStatus).toBe(429);
    expect(result.exitCode).toBe(429);
    expect(result.stderr).toContain('Rate limit exceeded');
  });

  it('maps HTTP 402 payment required error to ROUTER_HTTP_ERROR', async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({ error: { message: 'Insufficient credits', code: 402 } }),
        { status: 402, headers: { 'content-type': 'application/json' } },
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    const provider = new OpenRouterProvider('https://openrouter.ai/api/v1', 'sk-or-test', 2000);
    const result = await provider.execute(baseTask(), 'C:/tmp/workspace');

    expect(result.status).toBe('ROUTER_HTTP_ERROR');
    expect(result.httpStatus).toBe(402);
  });

  it('maps HTTP 500 server error to ROUTER_HTTP_ERROR', async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({ error: { message: 'Internal OpenRouter error', code: 500 } }),
        { status: 500, headers: { 'content-type': 'application/json' } },
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    const provider = new OpenRouterProvider('https://openrouter.ai/api/v1', 'sk-or-test', 2000);
    const result = await provider.execute(baseTask(), 'C:/tmp/workspace');

    expect(result.status).toBe('ROUTER_HTTP_ERROR');
    expect(result.httpStatus).toBe(500);
  });

  it('handles empty response body gracefully', async () => {
    const fetchMock = vi.fn(async () => {
      return new Response('', { status: 200, headers: { 'content-type': 'application/json' } });
    });
    vi.stubGlobal('fetch', fetchMock);

    const provider = new OpenRouterProvider('https://openrouter.ai/api/v1', 'sk-or-test', 2000);
    const result = await provider.execute(baseTask(), 'C:/tmp/workspace');

    expect(result.status).toBe('FAILED');
    expect(result.errorCode).toBe('EMPTY_RESPONSE');
  });

  it('handles network / timeout abort gracefully', async () => {
    const fetchMock = vi.fn(async () => {
      const err = new Error('The operation was aborted');
      err.name = 'AbortError';
      throw err;
    });
    vi.stubGlobal('fetch', fetchMock);

    const provider = new OpenRouterProvider('https://openrouter.ai/api/v1', 'sk-or-test', 2000);
    const result = await provider.execute(baseTask(), 'C:/tmp/workspace');

    expect(result.status).toBe('ROUTER_TIMEOUT');
    expect(result.errorCode).toBe('ROUTER_TIMEOUT');
  });

  it('reports health connectivity correctly', async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(JSON.stringify({ data: [{ id: 'openrouter/free' }] }), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const provider = new OpenRouterProvider('https://openrouter.ai/api/v1', 'sk-or-test', 2000);
    const health = await provider.health();
    expect(health.available).toBe(true);
    expect(health.details).toContain('200');
  });
});

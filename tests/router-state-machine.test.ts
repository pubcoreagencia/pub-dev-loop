import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { RouterProvider } from '../src/providers/router.js';

function createFetchMock(responses: Array<{ status: number; body: any; headers?: Record<string, string> }>) {
  const queue = responses.slice();
  return vi.fn(async () => {
    const resp = queue.shift();
    if (!resp) throw new Error('No mock response left in queue');
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
    id: 'TASK-STATE-MACHINE-1',
    project: 'test-project',
    repository: 'test-repo',
    objective: 'Demonstrate state machine correctness',
    prompt: 'Execute step',
    status: 'RUNNING' as const,
    priority: 0,
    worker: null,
    result: null,
    error: null,
    branch: null,
    commitSha: null,
    gitStatus: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe('RouterProvider State Machine Flow Control', () => {
  let tempWs: string;

  beforeEach(async () => {
    vi.restoreAllMocks();
    tempWs = await mkdtemp(join(tmpdir(), 'router-sm-test-'));
    process.env.ROUTER_MODEL = 'openrouter/cohere/north-mini-code:free';
    delete process.env.ROUTER_FALLBACK_MODELS;
    process.env.ROUTER_MAX_RETRIES = '2';
    process.env.ROUTER_RETRY_BASE_DELAY_MS = '0';
    delete process.env.ROUTER_MAX_TOOL_ROUNDS;
    delete process.env.ROUTER_MAX_TOOL_CALLS;
  });

  afterEach(async () => {
    await rm(tempWs, { recursive: true, force: true }).catch(() => {});
  });

  it('Case 1: Single model textual completion (no tool calls)', async () => {
    const fetchMock = createFetchMock([
      {
        status: 200,
        body: {
          model: 'openrouter/cohere/north-mini-code:free',
          choices: [{ message: { role: 'assistant', content: 'Task completed successfully.' }, finish_reason: 'stop' }],
        },
      },
    ]);
    vi.stubGlobal('fetch', fetchMock);

    const provider = new RouterProvider('http://localhost:20128/v1', undefined, 5000);
    const result = await provider.execute(baseTask(), tempWs);

    expect(result.status).toBe('COMPLETED');
    expect(result.exitCode).toBe(0);
    expect(result.errorCode).toBeNull();
    expect(result.toolCalls).toBe(0);
    expect(result.toolRounds).toBe(0);
    expect(result.stdout).toBe('Task completed successfully.');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('Case 2: Single model tool call followed by textual completion (Phase 5.4 Task 1 exact fix)', async () => {
    // Round 0: model returns a write_file tool call
    // Round 1: model returns final completion text
    const fetchMock = createFetchMock([
      {
        status: 200,
        body: {
          model: 'openrouter/cohere/north-mini-code:free',
          choices: [
            {
              message: {
                role: 'assistant',
                content: 'Creating file...',
                tool_calls: [
                  {
                    id: 'call-1',
                    type: 'function',
                    function: {
                      name: 'write_file',
                      arguments: JSON.stringify({ path: 'output.txt', content: 'test content' }),
                    },
                  },
                ],
              },
              finish_reason: 'tool_calls',
            },
          ],
        },
      },
      {
        status: 200,
        body: {
          model: 'openrouter/cohere/north-mini-code:free',
          choices: [
            {
              message: {
                role: 'assistant',
                content: 'File output.txt created successfully.',
              },
              finish_reason: 'stop',
            },
          ],
        },
      },
    ]);
    vi.stubGlobal('fetch', fetchMock);

    const provider = new RouterProvider('http://localhost:20128/v1', undefined, 5000);
    const result = await provider.execute(baseTask(), tempWs);

    // CRITICAL: Must be COMPLETED, NOT ALL_PROVIDERS_FAILED
    expect(result.status).toBe('COMPLETED');
    expect(result.exitCode).toBe(0);
    expect(result.errorCode).toBeNull();
    expect(result.errorMessage).toBeNull();
    expect(result.toolCalls).toBe(1);
    expect(result.toolRounds).toBe(1);
    expect(result.changedFiles).toContain('output.txt');

    // Verify file actually created on disk
    const content = await readFile(join(tempWs, 'output.txt'), 'utf8');
    expect(content).toBe('test content');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('Case 3: Multiple tool rounds (multi-turn execution)', async () => {
    const fetchMock = createFetchMock([
      {
        status: 200,
        body: {
          model: 'openrouter/cohere/north-mini-code:free',
          choices: [
            {
              message: {
                role: 'assistant',
                content: 'Step 1: writing file1.txt',
                tool_calls: [
                  {
                    id: 'call-1',
                    type: 'function',
                    function: {
                      name: 'write_file',
                      arguments: JSON.stringify({ path: 'file1.txt', content: 'content 1' }),
                    },
                  },
                ],
              },
              finish_reason: 'tool_calls',
            },
          ],
        },
      },
      {
        status: 200,
        body: {
          model: 'openrouter/cohere/north-mini-code:free',
          choices: [
            {
              message: {
                role: 'assistant',
                content: 'Step 2: writing file2.txt',
                tool_calls: [
                  {
                    id: 'call-2',
                    type: 'function',
                    function: {
                      name: 'write_file',
                      arguments: JSON.stringify({ path: 'file2.txt', content: 'content 2' }),
                    },
                  },
                ],
              },
              finish_reason: 'tool_calls',
            },
          ],
        },
      },
      {
        status: 200,
        body: {
          model: 'openrouter/cohere/north-mini-code:free',
          choices: [
            {
              message: {
                role: 'assistant',
                content: 'All files written.',
              },
              finish_reason: 'stop',
            },
          ],
        },
      },
    ]);
    vi.stubGlobal('fetch', fetchMock);

    const provider = new RouterProvider('http://localhost:20128/v1', undefined, 5000);
    const result = await provider.execute(baseTask(), tempWs);

    expect(result.status).toBe('COMPLETED');
    expect(result.toolCalls).toBe(2);
    expect(result.toolRounds).toBe(2);
    expect(result.changedFiles).toContain('file1.txt');
    expect(result.changedFiles).toContain('file2.txt');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('Case 4: Tool loop limit - maxToolCalls reached', async () => {
    process.env.ROUTER_MAX_TOOL_CALLS = '1';
    const fetchMock = createFetchMock([
      {
        status: 200,
        body: {
          model: 'openrouter/cohere/north-mini-code:free',
          choices: [
            {
              message: {
                role: 'assistant',
                content: 'Attempting 2 tool calls at once',
                tool_calls: [
                  {
                    id: 'call-1',
                    type: 'function',
                    function: { name: 'write_file', arguments: JSON.stringify({ path: 'a.txt', content: 'a' }) },
                  },
                  {
                    id: 'call-2',
                    type: 'function',
                    function: { name: 'write_file', arguments: JSON.stringify({ path: 'b.txt', content: 'b' }) },
                  },
                ],
              },
              finish_reason: 'tool_calls',
            },
          ],
        },
      },
    ]);
    vi.stubGlobal('fetch', fetchMock);

    const provider = new RouterProvider('http://localhost:20128/v1', undefined, 5000);
    const result = await provider.execute(baseTask(), tempWs);

    expect(result.status).toBe('TOOL_LOOP_LIMIT');
    expect(result.errorCode).toBe('TOOL_LOOP_LIMIT');
  });

  it('Case 5: Tool loop limit - maxToolRounds reached', async () => {
    process.env.ROUTER_MAX_TOOL_ROUNDS = '1';
    const fetchMock = createFetchMock([
      {
        status: 200,
        body: {
          model: 'openrouter/cohere/north-mini-code:free',
          choices: [
            {
              message: {
                role: 'assistant',
                content: 'Round 1 tool call',
                tool_calls: [
                  {
                    id: 'call-1',
                    type: 'function',
                    function: { name: 'write_file', arguments: JSON.stringify({ path: 'a.txt', content: 'a' }) },
                  },
                ],
              },
              finish_reason: 'tool_calls',
            },
          ],
        },
      },
    ]);
    vi.stubGlobal('fetch', fetchMock);

    const provider = new RouterProvider('http://localhost:20128/v1', undefined, 5000);
    const result = await provider.execute(baseTask(), tempWs);

    expect(result.status).toBe('TOOL_LOOP_LIMIT');
    expect(result.errorCode).toBe('TOOL_LOOP_LIMIT');
    expect(result.toolRounds).toBe(1);
  });

  it('Case 6: Model failure / HTTP 500 without fallbacks (CASE 1)', async () => {
    const fetchMock = createFetchMock([
      { status: 500, body: { error: { message: 'Internal LLM Error' } } },
      { status: 500, body: { error: { message: 'Internal LLM Error' } } },
    ]);
    vi.stubGlobal('fetch', fetchMock);

    const provider = new RouterProvider('http://localhost:20128/v1', undefined, 5000);
    const result = await provider.execute(baseTask(), tempWs);

    expect(result.status).toBe('ROUTER_HTTP_ERROR');
    expect(result.exitCode).toBe(500);
    expect(result.errorCode).toBe('ROUTER_HTTP_ERROR');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('Case 7: Authentication failure (401)', async () => {
    const fetchMock = createFetchMock([
      { status: 401, body: { error: { message: 'Unauthorized API key' } } },
    ]);
    vi.stubGlobal('fetch', fetchMock);

    const provider = new RouterProvider('http://localhost:20128/v1', undefined, 5000);
    const result = await provider.execute(baseTask(), tempWs);

    expect(result.status).toBe('FAILED');
    expect(result.exitCode).toBe(401);
    expect(result.errorCode).toBe('AUTHENTICATION_FAILURE');
  });

  it('Case 8: Fallback on primary failure with tool call and text completion (CASE 5)', async () => {
    process.env.ROUTER_FALLBACK_MODELS = 'kc/cohere/north-mini-code:free';
    const fetchMock = createFetchMock([
      // Primary model: 2 failed attempts (429)
      { status: 429, body: { error: { message: 'Quota exceeded' } } },
      { status: 429, body: { error: { message: 'Quota exceeded' } } },
      // Fallback model: Round 0 tool call
      {
        status: 200,
        body: {
          model: 'kc/cohere/north-mini-code:free',
          choices: [
            {
              message: {
                role: 'assistant',
                content: 'Fallback writing file...',
                tool_calls: [
                  {
                    id: 'fallback-call-1',
                    type: 'function',
                    function: {
                      name: 'write_file',
                      arguments: JSON.stringify({ path: 'fallback.txt', content: 'from fallback' }),
                    },
                  },
                ],
              },
              finish_reason: 'tool_calls',
            },
          ],
        },
      },
      // Fallback model: Round 1 text completion
      {
        status: 200,
        body: {
          model: 'kc/cohere/north-mini-code:free',
          choices: [
            {
              message: {
                role: 'assistant',
                content: 'Fallback completed successfully.',
              },
              finish_reason: 'stop',
            },
          ],
        },
      },
    ]);
    vi.stubGlobal('fetch', fetchMock);

    const provider = new RouterProvider('http://localhost:20128/v1', undefined, 5000);
    const result = await provider.execute(baseTask(), tempWs);

    expect(result.status).toBe('COMPLETED');
    expect(result.model).toBe('kc/cohere/north-mini-code:free');
    expect(result.toolCalls).toBe(1);
    expect(result.toolRounds).toBe(1);
    expect(result.changedFiles).toContain('fallback.txt');
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('Case 9: All models fail in fallback chain (CASE 6)', async () => {
    process.env.ROUTER_FALLBACK_MODELS = 'kc/cohere/north-mini-code:free';
    const fetchMock = createFetchMock([
      // Primary: 2 attempts
      { status: 429, body: { error: { message: 'quota' } } },
      { status: 429, body: { error: { message: 'quota' } } },
      // Fallback: 2 attempts
      { status: 429, body: { error: { message: 'quota' } } },
      { status: 429, body: { error: { message: 'quota' } } },
    ]);
    vi.stubGlobal('fetch', fetchMock);

    const provider = new RouterProvider('http://localhost:20128/v1', undefined, 5000);
    const result = await provider.execute(baseTask(), tempWs);

    expect(result.status).toBe('FAILED');
    expect(result.errorCode).toBe('ALL_PROVIDERS_FAILED');
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('Case 10: Signal abort returns ROUTER_TIMEOUT', async () => {
    const controller = new AbortController();
    controller.abort();

    const provider = new RouterProvider('http://localhost:20128/v1', undefined, 5000);
    const result = await provider.execute(baseTask(), tempWs, { signal: controller.signal });

    expect(result.status).toBe('ROUTER_TIMEOUT');
    expect(result.errorCode).toBe('ROUTER_TIMEOUT');
  });
});

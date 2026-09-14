import { describe, it, expect, vi } from 'vitest';
import {
  GitHubClient,
  GitHubAuthError,
  GitHubNotFoundError,
  GitHubConflictError,
  GitHubRateLimitError,
  GitHubTransientError,
  GitHubTimeoutError,
  GitHubNetworkError,
  GitHubApiError,
} from '../../../src/pdl/delivery/github-client.js';

describe('Phase 5.6: GitHubClient Implementation & Error Classification', () => {
  const createMockResponse = (status: number, body: unknown, headers: Record<string, string> = {}) => {
    return new Response(typeof body === 'string' ? body : JSON.stringify(body), {
      status,
      statusText: status === 200 ? 'OK' : 'Error',
      headers: {
        'content-type': 'application/json',
        ...headers,
      },
    });
  };

  it('1. correctly parses successful JSON responses and sets default headers', async () => {
    let capturedUrl = '';
    let capturedHeaders: Record<string, string> = {};

    const mockFetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      capturedUrl = url;
      capturedHeaders = (init?.headers as Record<string, string>) || {};
      return createMockResponse(200, [{ number: 1, title: 'Test PR' }]);
    });

    const client = new GitHubClient({
      token: 'test-token-123',
      baseUrl: 'https://api.github.test',
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    const prs = await client.getPullRequests('pubcoreagencia', 'pub-rate-calculator', { state: 'open' });

    expect(prs).toEqual([{ number: 1, title: 'Test PR' }]);
    expect(capturedUrl).toBe('https://api.github.test/repos/pubcoreagencia/pub-rate-calculator/pulls?state=open');
    expect(capturedHeaders['Authorization']).toBe('Bearer test-token-123');
    expect(capturedHeaders['Accept']).toBe('application/vnd.github.v3+json');
    expect(capturedHeaders['User-Agent']).toBe('pub-dev-loop-delivery-gate');
  });

  it('2. classifies 401/403 as GitHubAuthError', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      createMockResponse(403, { message: 'Resource not accessible by integration' })
    );

    const client = new GitHubClient({
      token: 'expired-token',
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    await expect(client.getPullRequest('pubcoreagencia', 'pub-rate-calculator', 1)).rejects.toThrow(
      GitHubAuthError
    );
  });

  it('3. classifies 404 as GitHubNotFoundError', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      createMockResponse(404, { message: 'Not Found' })
    );

    const client = new GitHubClient({
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    await expect(client.getPullRequest('pubcoreagencia', 'pub-rate-calculator', 999)).rejects.toThrow(
      GitHubNotFoundError
    );
  });

  it('4. classifies 409 as GitHubConflictError', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      createMockResponse(409, { message: 'Head branch was modified' })
    );

    const client = new GitHubClient({
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    await expect(
      client.createPullRequest('pubcoreagencia', 'pub-rate-calculator', {
        title: 'PR',
        body: 'Body',
        head: 'feat/test',
        base: 'main',
      })
    ).rejects.toThrow(GitHubConflictError);
  });

  it('5. classifies 429 as GitHubRateLimitError and parses reset timestamp', async () => {
    const resetTimeSec = Math.floor((Date.now() + 60000) / 1000);
    const mockFetch = vi.fn().mockResolvedValue(
      createMockResponse(429, { message: 'API rate limit exceeded' }, {
        'x-ratelimit-reset': String(resetTimeSec),
      })
    );

    const client = new GitHubClient({
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    try {
      await client.getCheckRuns('pubcoreagencia', 'pub-rate-calculator', 'sha123');
      expect.unreachable('Should have thrown');
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(GitHubRateLimitError);
      const rlErr = err as GitHubRateLimitError;
      expect(rlErr.resetAt).toBe(resetTimeSec * 1000);
      expect(rlErr.status).toBe(429);
    }
  });

  it('6. classifies 5xx as GitHubTransientError', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      createMockResponse(502, 'Bad Gateway')
    );

    const client = new GitHubClient({
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    await expect(client.getCheckRuns('pubcoreagencia', 'pub-rate-calculator', 'sha123')).rejects.toThrow(
      GitHubTransientError
    );
  });

  it('7. converts AbortError into GitHubTimeoutError', async () => {
    const abortErr = new Error('The operation was aborted');
    abortErr.name = 'AbortError';

    const mockFetch = vi.fn().mockRejectedValue(abortErr);

    const client = new GitHubClient({
      timeoutMs: 50,
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    await expect(client.getCheckRuns('pubcoreagencia', 'pub-rate-calculator', 'sha123')).rejects.toThrow(
      GitHubTimeoutError
    );
  });

  it('8. wraps generic network failure into GitHubNetworkError', async () => {
    const netErr = new Error('ECONNREFUSED 127.0.0.1');

    const mockFetch = vi.fn().mockRejectedValue(netErr);

    const client = new GitHubClient({
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    await expect(client.getCheckRuns('pubcoreagencia', 'pub-rate-calculator', 'sha123')).rejects.toThrow(
      GitHubNetworkError
    );
  });

  it('9. verifies createPullRequest sends correct JSON body and POST method', async () => {
    let capturedMethod = '';
    let capturedBody = '';

    const mockFetch = vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
      capturedMethod = init?.method || '';
      capturedBody = String(init?.body || '');
      return createMockResponse(201, { number: 42, html_url: 'https://github.com/pr/42' });
    });

    const client = new GitHubClient({
      token: 'tok-xyz',
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    const res = await client.createPullRequest('pubcore', 'repo', {
      title: 'feat: new engine',
      body: 'Description',
      head: 'feat/test',
      base: 'main',
      draft: false,
    });

    expect(capturedMethod).toBe('POST');
    expect(JSON.parse(capturedBody)).toEqual({
      title: 'feat: new engine',
      body: 'Description',
      head: 'feat/test',
      base: 'main',
      draft: false,
    });
    expect(res.number).toBe(42);
  });

  it('10. verifies getBranchRules makes GET request to rules/branches endpoint', async () => {
    let capturedUrl = '';
    let capturedMethod = '';

    const mockFetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      capturedUrl = url;
      capturedMethod = init?.method || '';
      return createMockResponse(200, [{ type: 'pull_request', parameters: { required_approving_review_count: 1 } }]);
    });

    const client = new GitHubClient({
      baseUrl: 'https://api.github.test',
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    const rules = await client.getBranchRules('pubcoreagencia', 'pub-rate-calculator', 'main');
    expect(capturedUrl).toBe('https://api.github.test/repos/pubcoreagencia/pub-rate-calculator/rules/branches/main');
    expect(capturedMethod).toBe('GET');
    expect(rules).toHaveLength(1);
    expect(rules[0].type).toBe('pull_request');
  });

  it('11. verifies getBranchProtection makes GET request to branches/{branch}/protection endpoint', async () => {
    let capturedUrl = '';
    let capturedMethod = '';

    const mockFetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      capturedUrl = url;
      capturedMethod = init?.method || '';
      return createMockResponse(200, {
        required_pull_request_reviews: { required_approving_review_count: 1 },
      });
    });

    const client = new GitHubClient({
      baseUrl: 'https://api.github.test',
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    const protection = await client.getBranchProtection('pubcoreagencia', 'pub-rate-calculator', 'main');
    expect(capturedUrl).toBe('https://api.github.test/repos/pubcoreagencia/pub-rate-calculator/branches/main/protection');
    expect(capturedMethod).toBe('GET');
    expect(protection.required_pull_request_reviews?.required_approving_review_count).toBe(1);
  });

  it('12. verifies mergePullRequest makes PUT request to /pulls/{number}/merge with required SHA in body', async () => {
    let capturedUrl = '';
    let capturedMethod = '';
    let capturedBody = '';

    const mockFetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      capturedUrl = url;
      capturedMethod = init?.method || '';
      capturedBody = String(init?.body || '');
      return createMockResponse(200, { sha: 'merge_sha_123', merged: true, message: 'Merged' });
    });

    const client = new GitHubClient({
      baseUrl: 'https://api.github.test',
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    const mergeRes = await client.mergePullRequest('pubcoreagencia', 'pub-rate-calculator', 17, {
      sha: 'commit_sha_aaa',
      merge_method: 'merge',
      commit_title: 'Merge PR #17',
    });

    expect(capturedUrl).toBe('https://api.github.test/repos/pubcoreagencia/pub-rate-calculator/pulls/17/merge');
    expect(capturedMethod).toBe('PUT');
    expect(JSON.parse(capturedBody)).toEqual({
      sha: 'commit_sha_aaa',
      merge_method: 'merge',
      commit_title: 'Merge PR #17',
    });
    expect(mergeRes.merged).toBe(true);
    expect(mergeRes.sha).toBe('merge_sha_123');
  });

  it('13. verifies getBranch makes GET request to /branches/{branch}', async () => {
    let capturedUrl = '';
    let capturedMethod = '';

    const mockFetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      capturedUrl = url;
      capturedMethod = init?.method || '';
      return createMockResponse(200, {
        name: 'main',
        commit: { sha: 'latest_main_sha' },
      });
    });

    const client = new GitHubClient({
      baseUrl: 'https://api.github.test',
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    const branch = await client.getBranch('pubcoreagencia', 'pub-rate-calculator', 'main');
    expect(capturedUrl).toBe('https://api.github.test/repos/pubcoreagencia/pub-rate-calculator/branches/main');
    expect(capturedMethod).toBe('GET');
    expect(branch.name).toBe('main');
    expect(branch.commit.sha).toBe('latest_main_sha');
  });
});



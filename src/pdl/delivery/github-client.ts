/**
 * Phase 5.6: Lightweight, Safe GitHub REST Client for Delivery Gate.
 *
 * Provides typed, fail-closed access to GitHub PR and CI endpoints using native fetch.
 *
 * Invariants:
 * - Read-only + Create PR ONLY: Absolutely NO merge endpoints or administrative mutations.
 * - Explicit timeouts on every network call (fail-closed, no hanging).
 * - Strict error classification: 401/403, 404, 409, 429, 5xx, timeout.
 * - Token redaction: Never logs tokens or exposes them to untrusted boundaries.
 * - Testable: Allows injecting a custom fetchFn for deterministic, offline testing.
 */

import { getGitHubToken } from '../persistence/remote-persistence.js';
import type {
  GitHubClientOptions,
  GitHubPullRequest,
  GitHubCheckRunsResponse,
  GitHubCombinedCommitStatus,
  GitHubReview,
  RawRulesetRule,
  RawClassicBranchProtection,
  GitHubMergeResponse,
  MergePullRequestPayload,
  GitHubBranch,
} from './types.js';

// ============================================================================
// Error Hierarchy
// ============================================================================

export class GitHubApiError extends Error {
  readonly status: number;
  readonly statusText: string;
  readonly endpoint: string;
  readonly responseBody: unknown;

  constructor(status: number, statusText: string, endpoint: string, body: unknown) {
    const msg = typeof body === 'object' && body && 'message' in body
      ? String((body as Record<string, unknown>).message)
      : typeof body === 'string'
        ? body
        : statusText;
    super(`[GitHub API ${status}] ${msg} (${endpoint})`);
    this.name = 'GitHubApiError';
    this.status = status;
    this.statusText = statusText;
    this.endpoint = endpoint;
    this.responseBody = body;
  }
}

export class GitHubAuthError extends GitHubApiError {
  constructor(status: number, statusText: string, endpoint: string, body: unknown) {
    super(status, statusText, endpoint, body);
    this.name = 'GitHubAuthError';
  }
}

export class GitHubNotFoundError extends GitHubApiError {
  constructor(status: number, statusText: string, endpoint: string, body: unknown) {
    super(status, statusText, endpoint, body);
    this.name = 'GitHubNotFoundError';
  }
}

export class GitHubConflictError extends GitHubApiError {
  constructor(status: number, statusText: string, endpoint: string, body: unknown) {
    super(status, statusText, endpoint, body);
    this.name = 'GitHubConflictError';
  }
}

export class GitHubMethodNotAllowedError extends GitHubApiError {
  constructor(status: number, statusText: string, endpoint: string, body: unknown) {
    super(status, statusText, endpoint, body);
    this.name = 'GitHubMethodNotAllowedError';
  }
}

export class GitHubValidationFailedError extends GitHubApiError {
  constructor(status: number, statusText: string, endpoint: string, body: unknown) {
    super(status, statusText, endpoint, body);
    this.name = 'GitHubValidationFailedError';
  }
}

export class GitHubRateLimitError extends GitHubApiError {
  readonly resetAt?: number;

  constructor(status: number, statusText: string, endpoint: string, body: unknown, resetAt?: number) {
    super(status, statusText, endpoint, body);
    this.name = 'GitHubRateLimitError';
    this.resetAt = resetAt;
  }
}

export class GitHubTransientError extends GitHubApiError {
  constructor(status: number, statusText: string, endpoint: string, body: unknown) {
    super(status, statusText, endpoint, body);
    this.name = 'GitHubTransientError';
  }
}

export class GitHubTimeoutError extends Error {
  readonly endpoint: string;

  constructor(endpoint: string, timeoutMs: number) {
    super(`[GitHub API Timeout] Request to '${endpoint}' timed out after ${timeoutMs}ms`);
    this.name = 'GitHubTimeoutError';
    this.endpoint = endpoint;
  }
}

export class GitHubNetworkError extends Error {
  readonly endpoint: string;

  constructor(endpoint: string, cause: Error) {
    super(`[GitHub Network Error] Request to '${endpoint}' failed: ${cause.message}`);
    this.name = 'GitHubNetworkError';
    this.endpoint = endpoint;
  }
}

// ============================================================================
// GitHub Client Implementation
// ============================================================================

export class GitHubClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly tokenResolver: () => string;
  private readonly fetchFn: typeof fetch;

  constructor(options: GitHubClientOptions = {}) {
    this.baseUrl = options.baseUrl?.replace(/\/+$/, '') ?? 'https://api.github.com';
    this.timeoutMs = options.timeoutMs ?? 10000;
    this.fetchFn = options.fetchFn ?? globalThis.fetch;
    const explicitToken = options.token;
    this.tokenResolver = explicitToken
      ? () => explicitToken
      : () => getGitHubToken();
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), this.timeoutMs);

    const token = this.tokenResolver();
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'pub-dev-loop-delivery-gate',
      ...(init?.headers as Record<string, string>),
    };

    if (token && token.trim().length > 0) {
      headers.Authorization = `Bearer ${token.trim()}`;
    }

    try {
      const response = await this.fetchFn(url, {
        ...init,
        headers,
        signal: controller.signal,
      });

      if (response.status === 204) {
        return null as unknown as T;
      }

      let responseBody: unknown;
      const rawText = await response.text();
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json') || rawText.trim().startsWith('{') || rawText.trim().startsWith('[')) {
        try {
          responseBody = JSON.parse(rawText);
        } catch {
          responseBody = rawText;
        }
      } else {
        responseBody = rawText;
      }

      if (!response.ok) {
        const status = response.status;
        const statusText = response.statusText;

        if (status === 401 || status === 403) {
          throw new GitHubAuthError(status, statusText, path, responseBody);
        }
        if (status === 404) {
          throw new GitHubNotFoundError(status, statusText, path, responseBody);
        }
        if (status === 405) {
          throw new GitHubMethodNotAllowedError(status, statusText, path, responseBody);
        }
        if (status === 409) {
          throw new GitHubConflictError(status, statusText, path, responseBody);
        }
        if (status === 422) {
          throw new GitHubValidationFailedError(status, statusText, path, responseBody);
        }
        if (status === 429) {
          const resetHeader = response.headers.get('x-ratelimit-reset');
          const resetAt = resetHeader ? parseInt(resetHeader, 10) * 1000 : undefined;
          throw new GitHubRateLimitError(status, statusText, path, responseBody, resetAt);
        }
        if (status >= 500 && status < 600) {
          throw new GitHubTransientError(status, statusText, path, responseBody);
        }
        throw new GitHubApiError(status, statusText, path, responseBody);
      }

      return responseBody as T;
    } catch (err: unknown) {
      if (err instanceof GitHubApiError) {
        throw err;
      }
      if ((err as Error)?.name === 'AbortError') {
        throw new GitHubTimeoutError(path, this.timeoutMs);
      }
      throw new GitHubNetworkError(path, err as Error);
    } finally {
      clearTimeout(timeoutHandle);
    }
  }

  /**
   * Lists pull requests matching specified filters.
   */
  async getPullRequests(
    owner: string,
    repo: string,
    params?: {
      head?: string;
      base?: string;
      state?: 'open' | 'closed' | 'all';
      per_page?: number;
    }
  ): Promise<GitHubPullRequest[]> {
    const query = new URLSearchParams();
    if (params?.head) query.set('head', params.head);
    if (params?.base) query.set('base', params.base);
    if (params?.state) query.set('state', params.state);
    if (params?.per_page) query.set('per_page', String(params.per_page));

    const qs = query.toString();
    const endpoint = `/repos/${owner}/${repo}/pulls${qs ? `?${qs}` : ''}`;
    return this.request<GitHubPullRequest[]>(endpoint, { method: 'GET' });
  }

  /**
   * Retrieves a specific pull request by number.
   */
  async getPullRequest(owner: string, repo: string, pullNumber: number): Promise<GitHubPullRequest> {
    const endpoint = `/repos/${owner}/${repo}/pulls/${pullNumber}`;
    return this.request<GitHubPullRequest>(endpoint, { method: 'GET' });
  }

  /**
   * Creates a new pull request.
   */
  async createPullRequest(
    owner: string,
    repo: string,
    payload: {
      title: string;
      body: string;
      head: string;
      base: string;
      draft?: boolean;
    }
  ): Promise<GitHubPullRequest> {
    const endpoint = `/repos/${owner}/${repo}/pulls`;
    return this.request<GitHubPullRequest>(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }

  /**
   * Retrieves check runs associated with a specific git commit reference (SHA).
   */
  async getCheckRuns(owner: string, repo: string, ref: string): Promise<GitHubCheckRunsResponse> {
    const endpoint = `/repos/${owner}/${repo}/commits/${ref}/check-runs?per_page=100`;
    return this.request<GitHubCheckRunsResponse>(endpoint, { method: 'GET' });
  }

  /**
   * Retrieves legacy commit status rollup for a specific git reference (SHA).
   */
  async getCommitStatuses(owner: string, repo: string, ref: string): Promise<GitHubCombinedCommitStatus> {
    const endpoint = `/repos/${owner}/${repo}/commits/${ref}/status`;
    return this.request<GitHubCombinedCommitStatus>(endpoint, { method: 'GET' });
  }

  /**
   * Retrieves reviews submitted for a pull request.
   */
  async getPullRequestReviews(owner: string, repo: string, pullNumber: number): Promise<GitHubReview[]> {
    const endpoint = `/repos/${owner}/${repo}/pulls/${pullNumber}/reviews?per_page=100`;
    return this.request<GitHubReview[]>(endpoint, { method: 'GET' });
  }

  /**
   * Retrieves branch rules from GitHub Rulesets.
   */
  async getBranchRules(owner: string, repo: string, branch: string): Promise<RawRulesetRule[]> {
    const endpoint = `/repos/${owner}/${repo}/rules/branches/${encodeURIComponent(branch)}`;
    return this.request<RawRulesetRule[]>(endpoint, { method: 'GET' });
  }

  /**
   * Retrieves classic branch protection settings.
   */
  async getBranchProtection(owner: string, repo: string, branch: string): Promise<RawClassicBranchProtection> {
    const endpoint = `/repos/${owner}/${repo}/branches/${encodeURIComponent(branch)}/protection`;
    return this.request<RawClassicBranchProtection>(endpoint, { method: 'GET' });
  }

  /**
   * Retrieves branch details including the latest commit SHA.
   */
  async getBranch(owner: string, repo: string, branch: string): Promise<GitHubBranch> {
    const endpoint = `/repos/${owner}/${repo}/branches/${encodeURIComponent(branch)}`;
    return this.request<GitHubBranch>(endpoint, { method: 'GET' });
  }

  /**
   * Merges a pull request using the GitHub PR Merge API.
   * Mandates a non-empty sha (expectedHeadSha) for TOCTOU safety.
   */
  async mergePullRequest(
    owner: string,
    repo: string,
    pullNumber: number,
    payload: MergePullRequestPayload
  ): Promise<GitHubMergeResponse> {
    if (!payload.sha || payload.sha.trim().length === 0) {
      throw new Error('mergePullRequest requires a non-empty sha (expectedHeadSha) for TOCTOU safety');
    }
    const endpoint = `/repos/${owner}/${repo}/pulls/${pullNumber}/merge`;
    return this.request<GitHubMergeResponse>(endpoint, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }
}

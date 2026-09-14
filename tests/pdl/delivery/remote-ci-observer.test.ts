import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RemoteCiObserver } from '../../../src/pdl/delivery/remote-ci-observer.js';
import {
  GitHubClient,
  GitHubRateLimitError,
  GitHubTransientError,
} from '../../../src/pdl/delivery/github-client.js';
import type { GitHubCheckRun, GitHubCheckRunsResponse, GitHubCombinedCommitStatus } from '../../../src/pdl/delivery/types.js';

describe('Phase 5.6: RemoteCiObserver Implementation & Polling Machine', () => {
  let simulatedTime = 1000000;
  const nowFn = () => simulatedTime;
  const sleepFn = vi.fn(async (ms: number) => {
    simulatedTime += ms;
  });

  const createMockCheckRun = (name: string, status: 'queued' | 'in_progress' | 'completed', conclusion: any = null): GitHubCheckRun => ({
    id: Math.floor(Math.random() * 10000),
    name,
    head_sha: 'sha123',
    status,
    conclusion,
  });

  beforeEach(() => {
    simulatedTime = 1000000;
    sleepFn.mockClear();
  });

  // 1. All required checks success
  it('1. returns SUCCESS immediately when all required checks completed successfully', async () => {
    const mockClient = {
      getCheckRuns: vi.fn().mockResolvedValue({
        total_count: 1,
        check_runs: [createMockCheckRun('verify', 'completed', 'success')],
      }),
      getCommitStatuses: vi.fn().mockResolvedValue({ total_count: 0, statuses: [] }),
    } as unknown as GitHubClient;

    const observer = new RemoteCiObserver({ client: mockClient, nowFn, sleepFn });
    const res = await observer.observe({
      owner: 'pubcoreagencia',
      repo: 'pub-rate-calculator',
      headSha: 'sha123',
      requiredChecks: ['verify'],
    });

    expect(res.status).toBe('SUCCESS');
    expect(res.blocked).toBe(false);
    expect(res.observation.completedSuccessfulChecks).toEqual(['verify']);
    expect(sleepFn).not.toHaveBeenCalled();
  });

  // 2. Required check failure
  it('2. returns FAILURE immediately when a required check fails', async () => {
    const mockClient = {
      getCheckRuns: vi.fn().mockResolvedValue({
        total_count: 1,
        check_runs: [createMockCheckRun('verify', 'completed', 'failure')],
      }),
      getCommitStatuses: vi.fn().mockResolvedValue({ total_count: 0, statuses: [] }),
    } as unknown as GitHubClient;

    const observer = new RemoteCiObserver({ client: mockClient, nowFn, sleepFn });
    const res = await observer.observe({
      owner: 'pubcoreagencia',
      repo: 'pub-rate-calculator',
      headSha: 'sha123',
      requiredChecks: ['verify'],
    });

    expect(res.status).toBe('FAILURE');
    expect(res.blocked).toBe(true);
    expect(res.observation.failedChecks).toEqual(['verify']);
    expect(res.reasons[0]).toContain('Required CI checks failed: verify');
  });

  // 3. Required check pending -> polls until success
  it('3. polls until a pending required check completes with success', async () => {
    let callCount = 0;
    const mockClient = {
      getCheckRuns: vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          return { total_count: 1, check_runs: [createMockCheckRun('verify', 'in_progress')] };
        }
        return { total_count: 1, check_runs: [createMockCheckRun('verify', 'completed', 'success')] };
      }),
      getCommitStatuses: vi.fn().mockResolvedValue({ total_count: 0, statuses: [] }),
    } as unknown as GitHubClient;

    const observer = new RemoteCiObserver({
      client: mockClient,
      pollIntervalMs: 5000,
      nowFn,
      sleepFn,
    });

    const res = await observer.observe({
      owner: 'pubcoreagencia',
      repo: 'pub-rate-calculator',
      headSha: 'sha123',
      requiredChecks: ['verify'],
    });

    expect(res.status).toBe('SUCCESS');
    expect(res.blocked).toBe(false);
    expect(callCount).toBe(2);
    expect(sleepFn).toHaveBeenCalledTimes(1);
    expect(sleepFn).toHaveBeenCalledWith(5000);
  });

  // 4. Required check missing after grace period -> UNKNOWN
  it('4. returns UNKNOWN when required check remains missing after grace period expires', async () => {
    const mockClient = {
      getCheckRuns: vi.fn().mockResolvedValue({ total_count: 0, check_runs: [] }),
      getCommitStatuses: vi.fn().mockResolvedValue({ total_count: 0, statuses: [] }),
    } as unknown as GitHubClient;

    const observer = new RemoteCiObserver({
      client: mockClient,
      pollIntervalMs: 5000,
      gracePeriodMs: 10000, // 10s grace period
      nowFn,
      sleepFn,
    });

    const res = await observer.observe({
      owner: 'pubcoreagencia',
      repo: 'pub-rate-calculator',
      headSha: 'sha123',
      requiredChecks: ['verify'],
    });

    expect(res.status).toBe('UNKNOWN');
    expect(res.blocked).toBe(true);
    expect(res.reasons[0]).toContain('missing after grace period: verify');
  });

  // 5. Required check cancelled -> FAILURE
  it('5. returns FAILURE when required check has conclusion cancelled', async () => {
    const mockClient = {
      getCheckRuns: vi.fn().mockResolvedValue({
        total_count: 1,
        check_runs: [createMockCheckRun('verify', 'completed', 'cancelled')],
      }),
      getCommitStatuses: vi.fn().mockResolvedValue({ total_count: 0, statuses: [] }),
    } as unknown as GitHubClient;

    const observer = new RemoteCiObserver({ client: mockClient, nowFn, sleepFn });
    const res = await observer.observe({
      owner: 'pubcoreagencia',
      repo: 'pub-rate-calculator',
      headSha: 'sha123',
      requiredChecks: ['verify'],
    });

    expect(res.status).toBe('FAILURE');
    expect(res.blocked).toBe(true);
    expect(res.observation.failedChecks).toEqual(['verify']);
  });

  // 6. Required check timed_out -> FAILURE
  it('6. returns FAILURE when required check has conclusion timed_out', async () => {
    const mockClient = {
      getCheckRuns: vi.fn().mockResolvedValue({
        total_count: 1,
        check_runs: [createMockCheckRun('verify', 'completed', 'timed_out')],
      }),
      getCommitStatuses: vi.fn().mockResolvedValue({ total_count: 0, statuses: [] }),
    } as unknown as GitHubClient;

    const observer = new RemoteCiObserver({ client: mockClient, nowFn, sleepFn });
    const res = await observer.observe({
      owner: 'pubcoreagencia',
      repo: 'pub-rate-calculator',
      headSha: 'sha123',
      requiredChecks: ['verify'],
    });

    expect(res.status).toBe('FAILURE');
    expect(res.blocked).toBe(true);
  });

  // 7. Unknown conclusion -> UNKNOWN
  it('7. returns UNKNOWN when required check has unexpected/unknown conclusion', async () => {
    const mockClient = {
      getCheckRuns: vi.fn().mockResolvedValue({
        total_count: 1,
        check_runs: [createMockCheckRun('verify', 'completed', 'weird_status' as any)],
      }),
      getCommitStatuses: vi.fn().mockResolvedValue({ total_count: 0, statuses: [] }),
    } as unknown as GitHubClient;

    const observer = new RemoteCiObserver({ client: mockClient, nowFn, sleepFn });
    const res = await observer.observe({
      owner: 'pubcoreagencia',
      repo: 'pub-rate-calculator',
      headSha: 'sha123',
      requiredChecks: ['verify'],
    });

    expect(res.status).toBe('UNKNOWN');
    expect(res.blocked).toBe(true);
    expect(res.reasons[0]).toContain('unknown conclusion');
  });

  // 8. Transient 5xx error retries and succeeds
  it('8. retries on transient 5xx API error and succeeds once API recovers', async () => {
    let callCount = 0;
    const mockClient = {
      getCheckRuns: vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          throw new GitHubTransientError(503, 'Service Unavailable', '/check-runs', 'Down');
        }
        return { total_count: 1, check_runs: [createMockCheckRun('verify', 'completed', 'success')] };
      }),
      getCommitStatuses: vi.fn().mockResolvedValue({ total_count: 0, statuses: [] }),
    } as unknown as GitHubClient;

    const observer = new RemoteCiObserver({ client: mockClient, nowFn, sleepFn });
    const res = await observer.observe({
      owner: 'pubcoreagencia',
      repo: 'pub-rate-calculator',
      headSha: 'sha123',
      requiredChecks: ['verify'],
    });

    expect(res.status).toBe('SUCCESS');
    expect(res.blocked).toBe(false);
    expect(callCount).toBe(2);
  });

  // 9. Rate limit (429) retries using reset time
  it('9. sleeps and retries when rate limit (429) is encountered', async () => {
    let callCount = 0;
    const mockClient = {
      getCheckRuns: vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          throw new GitHubRateLimitError(429, 'Rate Limit', '/check-runs', 'Limit', simulatedTime + 5000);
        }
        return { total_count: 1, check_runs: [createMockCheckRun('verify', 'completed', 'success')] };
      }),
      getCommitStatuses: vi.fn().mockResolvedValue({ total_count: 0, statuses: [] }),
    } as unknown as GitHubClient;

    const observer = new RemoteCiObserver({ client: mockClient, nowFn, sleepFn });
    const res = await observer.observe({
      owner: 'pubcoreagencia',
      repo: 'pub-rate-calculator',
      headSha: 'sha123',
      requiredChecks: ['verify'],
    });

    expect(res.status).toBe('SUCCESS');
    expect(callCount).toBe(2);
    expect(sleepFn).toHaveBeenCalledWith(5000);
  });

  // 10. Overall timeout reached -> TIMED_OUT
  it('10. returns TIMED_OUT when polling exceeds maxWaitMs without completion', async () => {
    const mockClient = {
      getCheckRuns: vi.fn().mockResolvedValue({
        total_count: 1,
        check_runs: [createMockCheckRun('verify', 'in_progress')],
      }),
      getCommitStatuses: vi.fn().mockResolvedValue({ total_count: 0, statuses: [] }),
    } as unknown as GitHubClient;

    const observer = new RemoteCiObserver({
      client: mockClient,
      pollIntervalMs: 5000,
      maxWaitMs: 12000, // 12s timeout
      nowFn,
      sleepFn,
    });

    const res = await observer.observe({
      owner: 'pubcoreagencia',
      repo: 'pub-rate-calculator',
      headSha: 'sha123',
      requiredChecks: ['verify'],
    });

    expect(res.status).toBe('TIMED_OUT');
    expect(res.blocked).toBe(true);
    expect(res.reasons[0]).toContain('timed out after 12000ms');
  });

  // 11. Non-required check failing does NOT block if all required checks pass
  it('11. does NOT block when a non-required check fails if all required checks pass', async () => {
    const mockClient = {
      getCheckRuns: vi.fn().mockResolvedValue({
        total_count: 2,
        check_runs: [
          createMockCheckRun('verify', 'completed', 'success'), // REQUIRED -> SUCCESS
          createMockCheckRun('optional-linter', 'completed', 'failure'), // NON-REQUIRED -> FAILURE
        ],
      }),
      getCommitStatuses: vi.fn().mockResolvedValue({ total_count: 0, statuses: [] }),
    } as unknown as GitHubClient;

    const observer = new RemoteCiObserver({ client: mockClient, nowFn, sleepFn });
    const res = await observer.observe({
      owner: 'pubcoreagencia',
      repo: 'pub-rate-calculator',
      headSha: 'sha123',
      requiredChecks: ['verify'], // Only 'verify' is required!
    });

    expect(res.status).toBe('SUCCESS');
    expect(res.blocked).toBe(false);
    expect(res.observation.completedSuccessfulChecks).toEqual(['verify']);
    expect(res.observation.failedChecks).toEqual([]);
  });

  // 12. Zero required checks with all checks passing -> SUCCESS
  it('12. returns SUCCESS when 0 checks are required and all existing checks pass', async () => {
    const mockClient = {
      getCheckRuns: vi.fn().mockResolvedValue({
        total_count: 1,
        check_runs: [createMockCheckRun('any-job', 'completed', 'success')],
      }),
      getCommitStatuses: vi.fn().mockResolvedValue({ total_count: 0, statuses: [] }),
    } as unknown as GitHubClient;

    const observer = new RemoteCiObserver({ client: mockClient, nowFn, sleepFn });
    const res = await observer.observe({
      owner: 'pubcoreagencia',
      repo: 'pub-rate-calculator',
      headSha: 'sha123',
      requiredChecks: [], // No explicit required checks
    });

    expect(res.status).toBe('SUCCESS');
    expect(res.blocked).toBe(false);
  });

  // 13. Fallback to commit statuses when check runs do not contain the check
  it('13. falls back to commit statuses if required check is not present in check runs', async () => {
    const mockClient = {
      getCheckRuns: vi.fn().mockResolvedValue({ total_count: 0, check_runs: [] }),
      getCommitStatuses: vi.fn().mockResolvedValue({
        total_count: 1,
        statuses: [{ context: 'legacy-ci', state: 'success' }],
      }),
    } as unknown as GitHubClient;

    const observer = new RemoteCiObserver({ client: mockClient, nowFn, sleepFn });
    const res = await observer.observe({
      owner: 'pubcoreagencia',
      repo: 'pub-rate-calculator',
      headSha: 'sha123',
      requiredChecks: ['legacy-ci'],
    });

    expect(res.status).toBe('SUCCESS');
    expect(res.blocked).toBe(false);
    expect(res.observation.completedSuccessfulChecks).toEqual(['legacy-ci']);
  });

  // 14. Progress callback is invoked on pending iteration
  it('14. invokes onProgress callback on each iteration', async () => {
    let callCount = 0;
    const progressList: string[] = [];

    const mockClient = {
      getCheckRuns: vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          return { total_count: 1, check_runs: [createMockCheckRun('verify', 'in_progress')] };
        }
        return { total_count: 1, check_runs: [createMockCheckRun('verify', 'completed', 'success')] };
      }),
      getCommitStatuses: vi.fn().mockResolvedValue({ total_count: 0, statuses: [] }),
    } as unknown as GitHubClient;

    const observer = new RemoteCiObserver({
      client: mockClient,
      pollIntervalMs: 5000,
      nowFn,
      sleepFn,
    });

    await observer.observe({
      owner: 'pubcoreagencia',
      repo: 'pub-rate-calculator',
      headSha: 'sha123',
      requiredChecks: ['verify'],
      onProgress: (obs) => progressList.push(obs.status),
    });

    expect(progressList).toEqual(['PENDING', 'SUCCESS']);
  });
});

import { describe, it, expect, vi } from 'vitest';
import { PrLifecycleManager } from '../../../src/pdl/delivery/pr-lifecycle-manager.js';
import {
  GitHubClient,
  GitHubAuthError,
  GitHubNotFoundError,
  GitHubConflictError,
  GitHubTimeoutError,
  GitHubNetworkError,
} from '../../../src/pdl/delivery/github-client.js';
import type { GitHubPullRequest, PrLifecycleInput } from '../../../src/pdl/delivery/types.js';

describe('Phase 5.6: PrLifecycleManager (Idempotency & TOCTOU Protection)', () => {
  const defaultInput: PrLifecycleInput = {
    owner: 'pubcoreagencia',
    repo: 'pub-rate-calculator',
    base: 'main',
    head: 'feat/rate-calculator-calc-engine',
    expectedHeadSha: '45290d3746bece264e8dcb8e120288da7703282c',
    title: 'feat: add calc engine [Task-001]',
    body: 'Automated PR evidence body',
    draft: false,
  };

  const createMockPr = (overrides?: Partial<GitHubPullRequest>): GitHubPullRequest => ({
    number: 42,
    html_url: 'https://github.com/pubcoreagencia/pub-rate-calculator/pull/42',
    state: 'open',
    draft: false,
    mergeable: true,
    mergeable_state: 'clean',
    head: {
      ref: 'feat/rate-calculator-calc-engine',
      sha: '45290d3746bece264e8dcb8e120288da7703282c',
    },
    base: {
      ref: 'main',
      sha: 'e9cde396013a9c8ac1ff1d6568ae9bdf8ffdf63d',
    },
    ...overrides,
  });

  // 1. Creates PR when none exists (Case A)
  it('1. creates a new PR when no PRs exist for the head branch (Case A)', async () => {
    const mockClient = {
      getPullRequests: vi.fn().mockResolvedValue([]),
      createPullRequest: vi.fn().mockResolvedValue(createMockPr()),
      getPullRequest: vi.fn(),
      getPullRequestReviews: vi.fn(),
    } as unknown as GitHubClient;

    const manager = new PrLifecycleManager(mockClient);
    const result = await manager.ensurePullRequest(defaultInput);

    expect(result.decision).toBe('PR_CREATED');
    expect(result.blocked).toBe(false);
    expect(result.pr?.number).toBe(42);
    expect(mockClient.createPullRequest).toHaveBeenCalledTimes(1);
  });

  // 2. Reuses existing PR with same head SHA (Case B)
  it('2. reuses existing open PR when head SHA matches expectedHeadSha (Case B)', async () => {
    const existingPr = createMockPr();
    const mockClient = {
      getPullRequests: vi.fn().mockResolvedValue([existingPr]),
      getPullRequest: vi.fn().mockResolvedValue(existingPr),
      getPullRequestReviews: vi.fn().mockResolvedValue([{ state: 'APPROVED', user: { login: 'reviewer' } }]),
      createPullRequest: vi.fn(),
    } as unknown as GitHubClient;

    const manager = new PrLifecycleManager(mockClient);
    const result = await manager.ensurePullRequest(defaultInput);

    expect(result.decision).toBe('PR_REUSED');
    expect(result.blocked).toBe(false);
    expect(result.pr?.number).toBe(42);
    expect(result.pr?.approvalsCount).toBe(1);
    expect(result.pr?.reviewDecision).toBe('APPROVED');
    expect(mockClient.createPullRequest).not.toHaveBeenCalled();
  });

  // 3. Blocks on divergent SHA (Case C)
  it('3. blocks with PR_HEAD_SHA_DIVERGENCE if open PR has different SHA (Case C)', async () => {
    const divergentPr = createMockPr({
      head: {
        ref: 'feat/rate-calculator-calc-engine',
        sha: '9999999999999999999999999999999999999999', // Different from expectedHeadSha
      },
    });

    const mockClient = {
      getPullRequests: vi.fn().mockResolvedValue([divergentPr]),
      getPullRequest: vi.fn().mockResolvedValue(divergentPr),
      getPullRequestReviews: vi.fn().mockResolvedValue([]),
      createPullRequest: vi.fn(),
    } as unknown as GitHubClient;

    const manager = new PrLifecycleManager(mockClient);
    const result = await manager.ensurePullRequest(defaultInput);

    expect(result.decision).toBe('BLOCKED_SHA_DIVERGENCE');
    expect(result.blocked).toBe(true);
    expect(result.reasons[0]).toContain('PR_HEAD_SHA_DIVERGENCE');
    expect(result.reasons[0]).toContain('expected \'45290d3746bece264e8dcb8e120288da7703282c\'');
    expect(result.reasons[0]).toContain('found \'9999999999999999999999999999999999999999\'');
    expect(mockClient.createPullRequest).not.toHaveBeenCalled();
  });

  // 4. Blocks if previous PR was rejected/closed unmerged (Case D)
  it('4. blocks with PR_PREVIOUSLY_REJECTED if branch was previously closed without merge (Case D)', async () => {
    const closedUnmergedPr = createMockPr({
      number: 40,
      state: 'closed',
      merged: false,
    });

    const mockClient = {
      getPullRequests: vi.fn().mockResolvedValue([closedUnmergedPr]),
      createPullRequest: vi.fn(),
    } as unknown as GitHubClient;

    const manager = new PrLifecycleManager(mockClient);
    const result = await manager.ensurePullRequest(defaultInput);

    expect(result.decision).toBe('BLOCKED_PREVIOUSLY_REJECTED');
    expect(result.blocked).toBe(true);
    expect(result.reasons[0]).toContain('PR_PREVIOUSLY_REJECTED');
    expect(result.reasons[0]).toContain('closed without merging');
    expect(mockClient.createPullRequest).not.toHaveBeenCalled();
  });

  // 5. Recognizes already merged PR (Case E)
  it('5. returns PR_ALREADY_MERGED if branch commit was already merged previously (Case E)', async () => {
    const mergedPr = createMockPr({
      number: 39,
      state: 'closed',
      merged: true,
      head: {
        ref: 'feat/rate-calculator-calc-engine',
        sha: '45290d3746bece264e8dcb8e120288da7703282c',
      },
    });

    const mockClient = {
      getPullRequests: vi.fn().mockResolvedValue([mergedPr]),
      createPullRequest: vi.fn(),
    } as unknown as GitHubClient;

    const manager = new PrLifecycleManager(mockClient);
    const result = await manager.ensurePullRequest(defaultInput);

    expect(result.decision).toBe('PR_ALREADY_MERGED');
    expect(result.blocked).toBe(false);
    expect(result.alreadyDelivered).toBe(true);
    expect(result.pr?.state).toBe('MERGED');
    expect(mockClient.createPullRequest).not.toHaveBeenCalled();
  });

  // 6. Blocks if multiple candidate open PRs exist (Case F)
  it('6. blocks with AMBIGUOUS_MULTIPLE_PRS_DETECTED and never automatically closes PRs (Case F)', async () => {
    const pr1 = createMockPr({ number: 42 });
    const pr2 = createMockPr({ number: 43 });

    const mockClient = {
      getPullRequests: vi.fn().mockResolvedValue([pr1, pr2]),
      createPullRequest: vi.fn(),
    } as unknown as GitHubClient;

    const manager = new PrLifecycleManager(mockClient);
    const result = await manager.ensurePullRequest(defaultInput);

    expect(result.decision).toBe('BLOCKED_AMBIGUOUS_MULTIPLE_PRS');
    expect(result.blocked).toBe(true);
    expect(result.reasons[0]).toContain('AMBIGUOUS_MULTIPLE_PRS_DETECTED');
    expect(result.reasons[0]).toContain('#42, #43');
    expect(mockClient.createPullRequest).not.toHaveBeenCalled();
  });

  // 7. Error handling: 403 Forbidden
  it('7. blocks with BLOCKED_API_ERROR when GitHub returns 403 Forbidden', async () => {
    const mockClient = {
      getPullRequests: vi.fn().mockRejectedValue(
        new GitHubAuthError(403, 'Forbidden', '/pulls', 'Insufficient permissions')
      ),
    } as unknown as GitHubClient;

    const manager = new PrLifecycleManager(mockClient);
    const result = await manager.ensurePullRequest(defaultInput);

    expect(result.decision).toBe('BLOCKED_API_ERROR');
    expect(result.blocked).toBe(true);
    expect(result.reasons[0]).toContain('403');
  });

  // 8. Error handling: 404 Not Found
  it('8. blocks with BLOCKED_API_ERROR when GitHub returns 404 Not Found', async () => {
    const mockClient = {
      getPullRequests: vi.fn().mockRejectedValue(
        new GitHubNotFoundError(404, 'Not Found', '/pulls', 'Repo not found')
      ),
    } as unknown as GitHubClient;

    const manager = new PrLifecycleManager(mockClient);
    const result = await manager.ensurePullRequest(defaultInput);

    expect(result.decision).toBe('BLOCKED_API_ERROR');
    expect(result.blocked).toBe(true);
    expect(result.reasons[0]).toContain('404');
  });

  // 9. Error handling: 409 Conflict during PR creation
  it('9. blocks with BLOCKED_API_ERROR when GitHub returns 409 Conflict', async () => {
    const mockClient = {
      getPullRequests: vi.fn().mockResolvedValue([]),
      createPullRequest: vi.fn().mockRejectedValue(
        new GitHubConflictError(409, 'Conflict', '/pulls', 'Head branch was modified')
      ),
    } as unknown as GitHubClient;

    const manager = new PrLifecycleManager(mockClient);
    const result = await manager.ensurePullRequest(defaultInput);

    expect(result.decision).toBe('BLOCKED_API_ERROR');
    expect(result.blocked).toBe(true);
    expect(result.reasons[0]).toContain('409');
  });

  // 10. Error handling: Network Timeout
  it('10. blocks with BLOCKED_API_ERROR when network times out', async () => {
    const mockClient = {
      getPullRequests: vi.fn().mockRejectedValue(
        new GitHubTimeoutError('/pulls', 10000)
      ),
    } as unknown as GitHubClient;

    const manager = new PrLifecycleManager(mockClient);
    const result = await manager.ensurePullRequest(defaultInput);

    expect(result.decision).toBe('BLOCKED_API_ERROR');
    expect(result.blocked).toBe(true);
    expect(result.reasons[0]).toContain('Timeout');
  });

  // 11. Error handling: Network failure
  it('11. blocks with BLOCKED_API_ERROR when network connection fails', async () => {
    const mockClient = {
      getPullRequests: vi.fn().mockRejectedValue(
        new GitHubNetworkError('/pulls', new Error('ECONNRESET'))
      ),
    } as unknown as GitHubClient;

    const manager = new PrLifecycleManager(mockClient);
    const result = await manager.ensurePullRequest(defaultInput);

    expect(result.decision).toBe('BLOCKED_API_ERROR');
    expect(result.blocked).toBe(true);
    expect(result.reasons[0]).toContain('Network Error');
  });

  // 12. MANDATORY ADVERSARIAL TEST (Item 10 of prompt):
  // Expected HEAD: AAA
  // API returns PR: AAA
  // Second reading returns: BBB
  // Result: BLOCK!
  describe('Adversarial TOCTOU Race Condition Test', () => {
    it('blocks immediately if head SHA mutates between list and full read (AAA -> BBB race)', async () => {
      const initialPr = createMockPr({
        number: 42,
        head: {
          ref: 'feat/rate-calculator-calc-engine',
          sha: defaultInput.expectedHeadSha, // Initially 'AAA'
        },
      });

      const mutatedPr = createMockPr({
        number: 42,
        head: {
          ref: 'feat/rate-calculator-calc-engine',
          sha: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', // Mutated to 'BBB' on second read!
        },
      });

      const mockClient = {
        getPullRequests: vi.fn().mockResolvedValue([initialPr]), // First read: AAA
        getPullRequest: vi.fn().mockResolvedValue(mutatedPr),    // Second read: BBB (adversarial push occurred!)
        getPullRequestReviews: vi.fn().mockResolvedValue([]),
        createPullRequest: vi.fn(),
      } as unknown as GitHubClient;

      const manager = new PrLifecycleManager(mockClient);
      const result = await manager.ensurePullRequest(defaultInput);

      // Must detect divergence and BLOCK!
      expect(result.decision).toBe('BLOCKED_SHA_DIVERGENCE');
      expect(result.blocked).toBe(true);
      expect(result.reasons[0]).toContain('PR_HEAD_SHA_DIVERGENCE');
      expect(result.reasons[0]).toContain('expected \'45290d3746bece264e8dcb8e120288da7703282c\'');
      expect(result.reasons[0]).toContain('found \'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb\'');
    });
  });

  // 13. Real GitHub API list format where merged is null and merged_at is string (Check 1)
  it('13. correctly identifies merged PR when GitHub list API returns merged=null and merged_at timestamp', async () => {
    // Real GitHub API response from GET /repos/{owner}/{repo}/pulls has merged: null in list view!
    const realGitHubListItem: GitHubPullRequest = {
      number: 17,
      html_url: 'https://github.com/pubcoreagencia/pub-rate-calculator/pull/17',
      state: 'closed',
      draft: false,
      merged: null as any, // GitHub list API returns null!
      merged_at: '2026-09-14T02:50:16Z',
      mergeable: null,
      mergeable_state: null,
      head: {
        ref: 'feat/rate-calculator-calc-engine',
        sha: defaultInput.expectedHeadSha,
      },
      base: {
        ref: 'main',
        sha: 'e9cde396013a9c8ac1ff1d6568ae9bdf8ffdf63d',
      },
    };

    const detailedPrResponse: GitHubPullRequest = {
      ...realGitHubListItem,
      merged: true, // Detailed endpoint sets merged: true
      mergeable: true,
      mergeable_state: 'clean',
    };

    const mockClient = {
      getPullRequests: vi.fn().mockResolvedValue([realGitHubListItem]),
      getPullRequest: vi.fn().mockResolvedValue(detailedPrResponse),
      createPullRequest: vi.fn(),
    } as unknown as GitHubClient;

    const manager = new PrLifecycleManager(mockClient);
    const result = await manager.ensurePullRequest(defaultInput);

    expect(result.decision).toBe('PR_ALREADY_MERGED');
    expect(result.blocked).toBe(false);
    expect(result.alreadyDelivered).toBe(true);
    expect(result.pr?.number).toBe(17);
    expect(result.pr?.state).toBe('MERGED');
    expect(mockClient.getPullRequest).toHaveBeenCalledWith(
      'pubcoreagencia',
      'pub-rate-calculator',
      17
    );
    expect(mockClient.createPullRequest).not.toHaveBeenCalled();
  });
});

import { describe, it, expect, vi } from 'vitest';
import { MergeReconciler } from '../../../src/pdl/delivery/merge-reconciler.js';
import { GitHubClient } from '../../../src/pdl/delivery/github-client.js';
import type { GitHubPullRequest } from '../../../src/pdl/delivery/types.js';

describe('Phase 5.6: MergeReconciler Post-Ambiguity State Resolution', () => {
  const defaultInput = {
    owner: 'pubcoreagencia',
    repo: 'pub-rate-calculator',
    pullNumber: 17,
    expectedHeadSha: 'head_sha_expected_123',
  };

  const createMockPr = (overrides: Partial<GitHubPullRequest> = {}): GitHubPullRequest => ({
    number: 17,
    html_url: 'https://github.com/pr/17',
    state: 'open',
    draft: false,
    merged: false,
    merged_at: null,
    merge_commit_sha: null,
    mergeable: true,
    mergeable_state: 'clean',
    head: { ref: 'feat/test', sha: 'head_sha_expected_123' },
    base: { ref: 'main', sha: 'base_sha_abc' },
    ...overrides,
  });

  // 21. timeout + PR já merged -> MERGED_CONFIRMED
  it('21. confirms merge when PR has merged=true matching expectedHeadSha', async () => {
    const mockPr = createMockPr({
      state: 'closed',
      merged: true,
      merged_at: '2026-09-14T03:00:00Z',
      merge_commit_sha: 'merge_commit_sha_999',
    });

    const mockClient = {
      getPullRequest: vi.fn().mockResolvedValue(mockPr),
    } as unknown as GitHubClient;

    const reconciler = new MergeReconciler({ client: mockClient });
    const result = await reconciler.reconcile(defaultInput);

    expect(result.decision).toBe('MERGED_CONFIRMED');
    expect(result.isMerged).toBe(true);
    expect(result.mergeCommitSha).toBe('merge_commit_sha_999');
    expect(result.prState).toBe('MERGED');
    expect(mockClient.getPullRequest).toHaveBeenCalledWith('pubcoreagencia', 'pub-rate-calculator', 17);
  });

  // 22. timeout + PR open -> MERGE_UNCONFIRMED
  it('22. returns MERGE_UNCONFIRMED when PR remains open with same SHA after timeout', async () => {
    const mockPr = createMockPr({
      state: 'open',
      merged: false,
      merged_at: null,
    });

    const mockClient = {
      getPullRequest: vi.fn().mockResolvedValue(mockPr),
    } as unknown as GitHubClient;

    const reconciler = new MergeReconciler({ client: mockClient });
    const result = await reconciler.reconcile(defaultInput);

    expect(result.decision).toBe('MERGE_UNCONFIRMED');
    expect(result.isMerged).toBe(false);
    expect(result.prState).toBe('OPEN');
    expect(result.reasons[0]).toContain('PR #17 is still OPEN');
  });

  // 23. timeout + PR closed merged -> MERGED_CONFIRMED via merged_at timestamp
  it('23. confirms merge when PR has state=closed and merged_at timestamp matching expectedHeadSha', async () => {
    const mockPr = createMockPr({
      state: 'closed',
      merged: undefined, // List endpoint format without boolean
      merged_at: '2026-09-14T03:01:00Z',
      merge_commit_sha: 'merge_sha_via_timestamp',
    });

    const mockClient = {
      getPullRequest: vi.fn().mockResolvedValue(mockPr),
    } as unknown as GitHubClient;

    const reconciler = new MergeReconciler({ client: mockClient });
    const result = await reconciler.reconcile(defaultInput);

    expect(result.decision).toBe('MERGED_CONFIRMED');
    expect(result.isMerged).toBe(true);
    expect(result.mergeCommitSha).toBe('merge_sha_via_timestamp');
  });

  // 24. timeout + PR closed without merge -> CLOSED_UNMERGED
  it('24. returns CLOSED_UNMERGED when PR was closed without merging', async () => {
    const mockPr = createMockPr({
      state: 'closed',
      merged: false,
      merged_at: null,
    });

    const mockClient = {
      getPullRequest: vi.fn().mockResolvedValue(mockPr),
    } as unknown as GitHubClient;

    const reconciler = new MergeReconciler({ client: mockClient });
    const result = await reconciler.reconcile(defaultInput);

    expect(result.decision).toBe('CLOSED_UNMERGED');
    expect(result.isMerged).toBe(false);
    expect(result.prState).toBe('CLOSED');
  });

  // 25. timeout + query failure -> UNKNOWN (fail-closed, never assumes merged)
  it('25. returns UNKNOWN when reconciliation query encounters an error and never blindly assumes merged', async () => {
    const mockClient = {
      getPullRequest: vi.fn().mockRejectedValue(new Error('Network timeout fetching PR')),
    } as unknown as GitHubClient;

    const reconciler = new MergeReconciler({ client: mockClient });
    const result = await reconciler.reconcile(defaultInput);

    expect(result.decision).toBe('UNKNOWN');
    expect(result.isMerged).toBe(false);
    expect(result.prState).toBe('UNKNOWN');
    expect(result.reasons[0]).toContain('Reconciliation query failed: Network timeout fetching PR');
  });
});

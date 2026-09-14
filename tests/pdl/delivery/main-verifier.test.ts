import { describe, it, expect, vi } from 'vitest';
import { MainVerifier } from '../../../src/pdl/delivery/main-verifier.js';
import { GitHubClient } from '../../../src/pdl/delivery/github-client.js';

describe('Phase 5.6: MainVerifier Post-Merge Verification', () => {
  const defaultInput = {
    owner: 'pubcoreagencia',
    repo: 'pub-rate-calculator',
    branch: 'main',
    previousMainSha: 'prev_main_sha_111',
    mergeCommitSha: 'merge_commit_sha_222',
  };

  // 26. main avançou corretamente
  it('26. returns MAIN_VERIFIED when currentMainSha !== previousMainSha', async () => {
    const mockClient = {
      getBranch: vi.fn().mockResolvedValue({
        name: 'main',
        commit: { sha: 'new_main_sha_333' },
      }),
    } as unknown as GitHubClient;

    const verifier = new MainVerifier({ client: mockClient });
    const result = await verifier.verifyMain(defaultInput);

    expect(result.status).toBe('MAIN_VERIFIED');
    expect(result.mainAdvanced).toBe(true);
    expect(result.previousMainSha).toBe('prev_main_sha_111');
    expect(result.currentMainSha).toBe('new_main_sha_333');
    expect(result.mergeCommitSha).toBe('merge_commit_sha_222');
    expect(result.reasons).toEqual([]);
  });

  // 27. main não avançou
  it('27. returns NOT_VERIFIED when currentMainSha === previousMainSha', async () => {
    const mockClient = {
      getBranch: vi.fn().mockResolvedValue({
        name: 'main',
        commit: { sha: 'prev_main_sha_111' }, // Unchanged!
      }),
    } as unknown as GitHubClient;

    const verifier = new MainVerifier({ client: mockClient });
    const result = await verifier.verifyMain(defaultInput);

    expect(result.status).toBe('NOT_VERIFIED');
    expect(result.mainAdvanced).toBe(false);
    expect(result.previousMainSha).toBe('prev_main_sha_111');
    expect(result.currentMainSha).toBe('prev_main_sha_111');
    expect(result.reasons[0]).toContain('Target branch \'main\' did not advance');
  });

  // 28. main aponta para resposta sem commit SHA
  it('28. returns BLOCKED when branch metadata is missing commit SHA', async () => {
    const mockClient = {
      getBranch: vi.fn().mockResolvedValue({
        name: 'main',
        commit: { sha: '' },
      }),
    } as unknown as GitHubClient;

    const verifier = new MainVerifier({ client: mockClient });
    const result = await verifier.verifyMain(defaultInput);

    expect(result.status).toBe('BLOCKED');
    expect(result.mainAdvanced).toBe(false);
    expect(result.reasons[0]).toContain('did not contain a commit SHA');
  });

  // 29. GET main falha
  it('29. returns BLOCKED when getBranch API call rejects', async () => {
    const mockClient = {
      getBranch: vi.fn().mockRejectedValue(new Error('GitHub API 500 Internal Server Error')),
    } as unknown as GitHubClient;

    const verifier = new MainVerifier({ client: mockClient });
    const result = await verifier.verifyMain(defaultInput);

    expect(result.status).toBe('BLOCKED');
    expect(result.mainAdvanced).toBe(false);
    expect(result.reasons[0]).toContain('Failed to query branch \'main\'');
  });

  // 30. estado inconclusivo / null commit object
  it('30. returns BLOCKED when commit object is null or undefined', async () => {
    const mockClient = {
      getBranch: vi.fn().mockResolvedValue({
        name: 'main',
        commit: null as any,
      }),
    } as unknown as GitHubClient;

    const verifier = new MainVerifier({ client: mockClient });
    const result = await verifier.verifyMain(defaultInput);

    expect(result.status).toBe('BLOCKED');
    expect(result.mainAdvanced).toBe(false);
  });
});

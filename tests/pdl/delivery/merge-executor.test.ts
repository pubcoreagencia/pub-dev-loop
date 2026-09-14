import { describe, it, expect, vi } from 'vitest';
import { MergeExecutor, type ExecuteMergeInput } from '../../../src/pdl/delivery/merge-executor.js';
import { MergeReconciler } from '../../../src/pdl/delivery/merge-reconciler.js';
import { PreMergeRevalidator } from '../../../src/pdl/delivery/pre-merge-revalidation.js';
import {
  GitHubClient,
  GitHubAuthError,
  GitHubNotFoundError,
  GitHubConflictError,
  GitHubMethodNotAllowedError,
  GitHubValidationFailedError,
  GitHubTransientError,
  GitHubTimeoutError,
  GitHubNetworkError,
} from '../../../src/pdl/delivery/github-client.js';
import type { ProductManifest } from '../../../src/pdl/products/catalog.js';
import type {
  MergeAuthorization,
  GitHubMergeResponse,
  PreMergeRevalidationResult,
} from '../../../src/pdl/delivery/types.js';

describe('Phase 5.6: MergeExecutor Governed Execution, Error Classification & TOCTOU', () => {
  const sampleProduct: ProductManifest = {
    productId: 'pub-rate-calculator',
    repository: 'https://github.com/pubcoreagencia/pub-rate-calculator.git',
    organization: 'pubcoreagencia',
    defaultBranch: 'main',
    developmentBranchPolicy: ['feat/*'],
    testCommand: 'npm test',
    allowedPaths: ['src/**'],
    protectedPaths: ['.github/**'],
    maxAutonomyLevel: 5,
    remotePersistenceEligible: true,
  };

  const allowedAuth: MergeAuthorization = {
    decision: 'ALLOW',
    authorized: true,
    reasons: [],
    evaluatedAt: '2026-09-14T03:00:00Z',
  };

  const deniedAuth: MergeAuthorization = {
    decision: 'DENY',
    authorized: false,
    reasons: ['Required status checks failed'],
    evaluatedAt: '2026-09-14T03:00:00Z',
  };

  const defaultInput: ExecuteMergeInput = {
    owner: 'pubcoreagencia',
    repo: 'pub-rate-calculator',
    pullRequestNumber: 17,
    expectedHeadSha: 'head_sha_expected_aaa',
    expectedBaseBranch: 'main',
    requestedMergeMethod: 'merge',
    authorization: allowedAuth,
    product: sampleProduct,
    commitTitle: 'Merge PR #17',
    commitMessage: 'Autonomous delivery',
    skipImmediateRevalidation: true, // isolated executor tests
  };

  // 1. ALLOW -> merge chamado
  it('1. calls client.mergePullRequest when authorization is ALLOW', async () => {
    const mockMergeResponse: GitHubMergeResponse = {
      sha: 'merge_commit_sha_123',
      merged: true,
      message: 'Pull Request successfully merged',
    };

    const mockClient = {
      mergePullRequest: vi.fn().mockResolvedValue(mockMergeResponse),
    } as unknown as GitHubClient;

    const executor = new MergeExecutor({ client: mockClient });
    const result = await executor.executeMerge(defaultInput);

    expect(result.status).toBe('MERGED');
    expect(result.returnedMergeSha).toBe('merge_commit_sha_123');
    expect(result.httpStatus).toBe(200);
    expect(mockClient.mergePullRequest).toHaveBeenCalledTimes(1);
  });

  // 2. DENY -> merge não chamado
  it('2. does NOT call client.mergePullRequest when authorization is DENY', async () => {
    const mockClient = {
      mergePullRequest: vi.fn(),
    } as unknown as GitHubClient;

    const executor = new MergeExecutor({ client: mockClient });
    const result = await executor.executeMerge({
      ...defaultInput,
      authorization: deniedAuth,
    });

    expect(result.status).toBe('BLOCKED');
    expect(result.reasons[0]).toContain('Required status checks failed');
    expect(mockClient.mergePullRequest).not.toHaveBeenCalled();
  });

  // 3. SHA enviado corretamente
  it('3. passes expectedHeadSha explicitly in payload for TOCTOU safety', async () => {
    const mockClient = {
      mergePullRequest: vi.fn().mockResolvedValue({ sha: 'sha1', merged: true, message: 'OK' }),
    } as unknown as GitHubClient;

    const executor = new MergeExecutor({ client: mockClient });
    await executor.executeMerge(defaultInput);

    expect(mockClient.mergePullRequest).toHaveBeenCalledWith(
      'pubcoreagencia',
      'pub-rate-calculator',
      17,
      expect.objectContaining({
        sha: 'head_sha_expected_aaa',
        merge_method: 'merge',
      })
    );
  });

  // 4. merge success
  it('4. returns MERGED status on HTTP 200 with merged=true', async () => {
    const mockClient = {
      mergePullRequest: vi.fn().mockResolvedValue({ sha: 'sha_merged', merged: true, message: 'Merged' }),
    } as unknown as GitHubClient;

    const executor = new MergeExecutor({ client: mockClient });
    const res = await executor.executeMerge(defaultInput);

    expect(res.status).toBe('MERGED');
    expect(res.returnedMergeSha).toBe('sha_merged');
  });

  // 5. merged=false
  it('5. returns UNKNOWN status on HTTP 200 when response.merged is false', async () => {
    const mockClient = {
      mergePullRequest: vi.fn().mockResolvedValue({ sha: undefined, merged: false, message: 'Could not merge' }),
    } as unknown as GitHubClient;

    const executor = new MergeExecutor({ client: mockClient });
    const res = await executor.executeMerge(defaultInput);

    expect(res.status).toBe('UNKNOWN');
    expect(res.message).toContain('response.merged is false');
    expect(res.reasons[0]).toContain('merged=false');
  });

  // 6. 403
  it('6. classifies GitHubAuthError (403) as FORBIDDEN', async () => {
    const mockClient = {
      mergePullRequest: vi.fn().mockRejectedValue(new GitHubAuthError(403, 'Forbidden', '/pulls/17/merge', {})),
    } as unknown as GitHubClient;

    const executor = new MergeExecutor({ client: mockClient });
    const res = await executor.executeMerge(defaultInput);

    expect(res.status).toBe('FORBIDDEN');
    expect(res.httpStatus).toBe(403);
  });

  // 7. 404
  it('7. classifies GitHubNotFoundError (404) as BLOCKED', async () => {
    const mockClient = {
      mergePullRequest: vi.fn().mockRejectedValue(new GitHubNotFoundError(404, 'Not Found', '/pulls/17/merge', {})),
    } as unknown as GitHubClient;

    const executor = new MergeExecutor({ client: mockClient });
    const res = await executor.executeMerge(defaultInput);

    expect(res.status).toBe('BLOCKED');
    expect(res.httpStatus).toBe(404);
  });

  // 8. 405
  it('8. classifies GitHubMethodNotAllowedError (405) as METHOD_NOT_ALLOWED', async () => {
    const mockClient = {
      mergePullRequest: vi.fn().mockRejectedValue(new GitHubMethodNotAllowedError(405, 'Method Not Allowed', '/pulls/17/merge', {})),
    } as unknown as GitHubClient;

    const executor = new MergeExecutor({ client: mockClient });
    const res = await executor.executeMerge(defaultInput);

    expect(res.status).toBe('METHOD_NOT_ALLOWED');
    expect(res.httpStatus).toBe(405);
  });

  // 9. 409
  it('9. classifies GitHubConflictError (409) as CONFLICT (SHA divergence or git conflict)', async () => {
    const mockClient = {
      mergePullRequest: vi.fn().mockRejectedValue(new GitHubConflictError(409, 'Head branch was modified', '/pulls/17/merge', {})),
    } as unknown as GitHubClient;

    const executor = new MergeExecutor({ client: mockClient });
    const res = await executor.executeMerge(defaultInput);

    expect(res.status).toBe('CONFLICT');
    expect(res.httpStatus).toBe(409);
    expect(res.reasons[0]).toContain('Merge conflict or head SHA divergence (HTTP 409)');
  });

  // 10. 422
  it('10. classifies GitHubValidationFailedError (422) as VALIDATION_FAILED', async () => {
    const mockClient = {
      mergePullRequest: vi.fn().mockRejectedValue(new GitHubValidationFailedError(422, 'Unprocessable Entity', '/pulls/17/merge', {})),
    } as unknown as GitHubClient;

    const executor = new MergeExecutor({ client: mockClient });
    const res = await executor.executeMerge(defaultInput);

    expect(res.status).toBe('VALIDATION_FAILED');
    expect(res.httpStatus).toBe(422);
  });

  // 11. 5xx
  it('11. delegates 5xx transient error to reconciler and reports reconciled state without blind retry', async () => {
    const mockClient = {
      mergePullRequest: vi.fn().mockRejectedValue(new GitHubTransientError(500, 'Internal Server Error', '/pulls/17/merge', {})),
    } as unknown as GitHubClient;

    const mockReconciler = {
      reconcile: vi.fn().mockResolvedValue({
        decision: 'MERGED_CONFIRMED',
        isMerged: true,
        mergeCommitSha: 'sha_from_reconciler_500',
        prState: 'MERGED',
        reasons: ['Reconciled after 500'],
        observedAt: '2026-09-14T03:05:00Z',
      }),
    } as unknown as MergeReconciler;

    const executor = new MergeExecutor({ client: mockClient, reconciler: mockReconciler });
    const res = await executor.executeMerge(defaultInput);

    expect(res.status).toBe('ALREADY_MERGED');
    expect(res.returnedMergeSha).toBe('sha_from_reconciler_500');
    expect(mockClient.mergePullRequest).toHaveBeenCalledTimes(1); // Never retried PUT!
    expect(mockReconciler.reconcile).toHaveBeenCalledTimes(1);
  });

  // 12. network error
  it('12. delegates network error to reconciler without blind retry', async () => {
    const mockClient = {
      mergePullRequest: vi.fn().mockRejectedValue(new GitHubNetworkError('/pulls/17/merge', new Error('ECONNRESET'))),
    } as unknown as GitHubClient;

    const mockReconciler = {
      reconcile: vi.fn().mockResolvedValue({
        decision: 'MERGE_UNCONFIRMED',
        isMerged: false,
        mergeCommitSha: null,
        prState: 'OPEN',
        reasons: ['PR remains OPEN'],
        observedAt: '2026-09-14T03:05:00Z',
      }),
    } as unknown as MergeReconciler;

    const executor = new MergeExecutor({ client: mockClient, reconciler: mockReconciler });
    const res = await executor.executeMerge(defaultInput);

    expect(res.status).toBe('UNKNOWN');
    expect(res.message).toContain('PR remains open');
    expect(mockClient.mergePullRequest).toHaveBeenCalledTimes(1);
  });

  // 13. timeout
  it('13. delegates timeout to reconciler without blind retry', async () => {
    const mockClient = {
      mergePullRequest: vi.fn().mockRejectedValue(new GitHubTimeoutError('/pulls/17/merge', 10000)),
    } as unknown as GitHubClient;

    const mockReconciler = {
      reconcile: vi.fn().mockResolvedValue({
        decision: 'MERGED_CONFIRMED',
        isMerged: true,
        mergeCommitSha: 'sha_reconciled_after_timeout',
        prState: 'MERGED',
        reasons: ['Merged confirmed on GitHub after timeout'],
        observedAt: '2026-09-14T03:05:00Z',
      }),
    } as unknown as MergeReconciler;

    const executor = new MergeExecutor({ client: mockClient, reconciler: mockReconciler });
    const res = await executor.executeMerge(defaultInput);

    expect(res.status).toBe('ALREADY_MERGED');
    expect(res.returnedMergeSha).toBe('sha_reconciled_after_timeout');
    expect(mockClient.mergePullRequest).toHaveBeenCalledTimes(1);
  });

  // 14. unauthorized state (target branch divergence)
  it('14. blocks merge when target branch does not match product default branch', async () => {
    const mockClient = {
      mergePullRequest: vi.fn(),
    } as unknown as GitHubClient;

    const executor = new MergeExecutor({ client: mockClient });
    const res = await executor.executeMerge({
      ...defaultInput,
      expectedBaseBranch: 'develop', // product.defaultBranch is 'main'
    });

    expect(res.status).toBe('BLOCKED');
    expect(res.reasons[0]).toContain('is forbidden by product catalog');
    expect(mockClient.mergePullRequest).not.toHaveBeenCalled();
  });

  // 15. forbidden merge method
  it('15. rejects execution with METHOD_NOT_ALLOWED when GitHub rejects method', async () => {
    const mockClient = {
      mergePullRequest: vi.fn().mockRejectedValue(
        new GitHubMethodNotAllowedError(405, 'Rebase not allowed', '/pulls/17/merge', {})
      ),
    } as unknown as GitHubClient;

    const executor = new MergeExecutor({ client: mockClient });
    const res = await executor.executeMerge({
      ...defaultInput,
      requestedMergeMethod: 'rebase',
    });

    expect(res.status).toBe('METHOD_NOT_ALLOWED');
  });

  // --------------------------------------------------------------------------
  // Pre-Merge Immediate Revalidation Tests (16 to 20)
  // --------------------------------------------------------------------------

  // 16. SHA mudou na revalidação fresca -> DENY
  it('16. blocks merge when immediate pre-merge revalidation detects head SHA changed', async () => {
    const mockRevalidator = {
      revalidate: vi.fn().mockResolvedValue({
        decision: 'DENY',
        authorized: false,
        reasons: ['TOCTOU drift in head SHA: prior was AAA, fresh is BBB'],
        revalidatedAt: '2026-09-14T03:00:00Z',
        toctouViolations: ['TOCTOU drift in head SHA'],
      } as PreMergeRevalidationResult),
    } as unknown as PreMergeRevalidator;

    const mockClient = {
      mergePullRequest: vi.fn(),
    } as unknown as GitHubClient;

    const executor = new MergeExecutor({
      client: mockClient,
      preMergeRevalidator: mockRevalidator,
    });

    const res = await executor.executeMerge({
      ...defaultInput,
      skipImmediateRevalidation: false, // enforce revalidation
    });

    expect(res.status).toBe('BLOCKED');
    expect(res.reasons[0]).toContain('TOCTOU drift in head SHA');
    expect(mockClient.mergePullRequest).not.toHaveBeenCalled();
  });

  // 17. approvals mudaram na revalidação fresca -> DENY
  it('17. blocks merge when immediate revalidation detects approvals dropped', async () => {
    const mockRevalidator = {
      revalidate: vi.fn().mockResolvedValue({
        decision: 'DENY',
        authorized: false,
        reasons: ['Insufficient approving reviews: required 1, got 0'],
        revalidatedAt: '2026-09-14T03:00:00Z',
        toctouViolations: ['TOCTOU drift in approvals'],
      } as PreMergeRevalidationResult),
    } as unknown as PreMergeRevalidator;

    const mockClient = { mergePullRequest: vi.fn() } as unknown as GitHubClient;
    const executor = new MergeExecutor({ client: mockClient, preMergeRevalidator: mockRevalidator });

    const res = await executor.executeMerge({ ...defaultInput, skipImmediateRevalidation: false });

    expect(res.status).toBe('BLOCKED');
    expect(res.reasons[0]).toContain('Insufficient approving reviews');
    expect(mockClient.mergePullRequest).not.toHaveBeenCalled();
  });

  // 18. CI mudou na revalidação fresca -> DENY
  it('18. blocks merge when immediate revalidation detects CI failure', async () => {
    const mockRevalidator = {
      revalidate: vi.fn().mockResolvedValue({
        decision: 'DENY',
        authorized: false,
        reasons: ['CI status is not SUCCESS (current fresh status: FAILURE)'],
        revalidatedAt: '2026-09-14T03:00:00Z',
        toctouViolations: ['TOCTOU drift in CI status'],
      } as PreMergeRevalidationResult),
    } as unknown as PreMergeRevalidator;

    const mockClient = { mergePullRequest: vi.fn() } as unknown as GitHubClient;
    const executor = new MergeExecutor({ client: mockClient, preMergeRevalidator: mockRevalidator });

    const res = await executor.executeMerge({ ...defaultInput, skipImmediateRevalidation: false });

    expect(res.status).toBe('BLOCKED');
    expect(res.reasons[0]).toContain('CI status is not SUCCESS');
    expect(mockClient.mergePullRequest).not.toHaveBeenCalled();
  });

  // 19. PR closed na revalidação fresca -> DENY
  it('19. blocks merge when immediate revalidation detects PR was closed', async () => {
    const mockRevalidator = {
      revalidate: vi.fn().mockResolvedValue({
        decision: 'DENY',
        authorized: false,
        reasons: ['PR is not OPEN (current fresh state: CLOSED)'],
        revalidatedAt: '2026-09-14T03:00:00Z',
        toctouViolations: ['TOCTOU drift in PR state'],
      } as PreMergeRevalidationResult),
    } as unknown as PreMergeRevalidator;

    const mockClient = { mergePullRequest: vi.fn() } as unknown as GitHubClient;
    const executor = new MergeExecutor({ client: mockClient, preMergeRevalidator: mockRevalidator });

    const res = await executor.executeMerge({ ...defaultInput, skipImmediateRevalidation: false });

    expect(res.status).toBe('BLOCKED');
    expect(res.reasons[0]).toContain('PR is not OPEN');
    expect(mockClient.mergePullRequest).not.toHaveBeenCalled();
  });

  // 20. governance mudou na revalidação fresca -> DENY
  it('20. blocks merge when immediate revalidation detects governance is unknown or changed', async () => {
    const mockRevalidator = {
      revalidate: vi.fn().mockResolvedValue({
        decision: 'DENY',
        authorized: false,
        reasons: ['Governance state is UNKNOWN: GitHub Ruleset API timeout'],
        revalidatedAt: '2026-09-14T03:00:00Z',
        toctouViolations: [],
      } as PreMergeRevalidationResult),
    } as unknown as PreMergeRevalidator;

    const mockClient = { mergePullRequest: vi.fn() } as unknown as GitHubClient;
    const executor = new MergeExecutor({ client: mockClient, preMergeRevalidator: mockRevalidator });

    const res = await executor.executeMerge({ ...defaultInput, skipImmediateRevalidation: false });

    expect(res.status).toBe('BLOCKED');
    expect(res.reasons[0]).toContain('Governance state is UNKNOWN');
    expect(mockClient.mergePullRequest).not.toHaveBeenCalled();
  });

  // --------------------------------------------------------------------------
  // Security & Adversarial Tests (Section 17 & 18)
  // --------------------------------------------------------------------------

  // Section 17: Teste de segurança mais importante
  it('17. ADVERSARIAL: When head SHA diverges between authorization and PUT, sends expectedHeadSha and catches 409 CONFLICT (NEVER MERGED)', async () => {
    // Scenario: authorization was ALLOW for 'commit_sha_AAA'.
    // Even if remote branch concurrently advanced to 'commit_sha_BBB',
    // the executor strictly sends sha='commit_sha_AAA'.
    // GitHub API rejects with HTTP 409 Conflict.
    const mockClient = {
      mergePullRequest: vi.fn().mockImplementation((_owner, _repo, _number, payload) => {
        if (payload.sha !== 'remote_head_now_BBB') {
          throw new GitHubConflictError(409, 'Head branch was modified (expected BBB, received AAA)', '/pulls/17/merge', {});
        }
        return Promise.resolve({ sha: 'never_reached', merged: true, message: 'Bad' });
      }),
    } as unknown as GitHubClient;

    const executor = new MergeExecutor({ client: mockClient });
    const res = await executor.executeMerge({
      ...defaultInput,
      expectedHeadSha: 'commit_sha_AAA',
    });

    expect(res.status).toBe('CONFLICT');
    expect(res.httpStatus).toBe(409);
    expect(res.reasons[0]).toContain('Merge conflict or head SHA divergence (HTTP 409)');
    expect(res.returnedMergeSha).toBeNull();
    // Confirmed: never returned MERGED!
    expect(res.status).not.toBe('MERGED');
  });

  // Section 18: Teste de replay
  it('18. REPLAY: Timeout on first merge mutation calls reconciler, resulting in exactly 1 PUT and >=1 GET (ZERO BLIND RETRY)', async () => {
    let putCallsCount = 0;
    let getCallsCount = 0;

    const mockClient = {
      mergePullRequest: vi.fn().mockImplementation(async () => {
        putCallsCount++;
        throw new GitHubTimeoutError('/pulls/17/merge', 5000);
      }),
      getPullRequest: vi.fn().mockImplementation(async () => {
        getCallsCount++;
        return {
          number: 17,
          state: 'closed',
          merged: true,
          merged_at: '2026-09-14T03:10:00Z',
          merge_commit_sha: 'reconciled_merge_sha_xyz',
          head: { sha: defaultInput.expectedHeadSha },
        };
      }),
    } as unknown as GitHubClient;

    const reconciler = new MergeReconciler({ client: mockClient });
    const executor = new MergeExecutor({ client: mockClient, reconciler });

    const res = await executor.executeMerge(defaultInput);

    expect(res.status).toBe('ALREADY_MERGED');
    expect(res.returnedMergeSha).toBe('reconciled_merge_sha_xyz');
    expect(putCallsCount).toBe(1); // EXACTLY 1 PUT
    expect(getCallsCount).toBeGreaterThanOrEqual(1); // >= 1 GET
  });
});

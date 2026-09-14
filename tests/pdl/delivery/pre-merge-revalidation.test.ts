import { describe, it, expect, vi } from 'vitest';
import {
  revalidatePreMergeState,
  PreMergeRevalidator,
} from '../../../src/pdl/delivery/pre-merge-revalidation.js';
import type {
  PullRequestSnapshot,
  CiObservation,
  GovernanceSnapshot,
  PreMergeFreshState,
  PreMergeRevalidationExpected,
} from '../../../src/pdl/delivery/types.js';
import type { ProductManifest } from '../../../src/pdl/products/catalog.js';

describe('Phase 5.6: PreMergeRevalidation Policy Engine & TOCTOU Protection', () => {
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

  const validSnapshotPr: PullRequestSnapshot = {
    number: 17,
    url: 'https://github.com/pubcoreagencia/pub-rate-calculator/pull/17',
    state: 'OPEN',
    draft: false,
    mergeable: true,
    mergeStateStatus: 'CLEAN',
    headSha: 'commit_sha_valid_123',
    baseSha: 'main_base_sha_abc',
    headRef: 'feat/rate-calc',
    baseRef: 'main',
    approvalsCount: 1,
    allThreadsResolved: true,
    hasUnattributedCommits: false,
    reviewDecision: 'APPROVED',
  };

  const validCiObservation: CiObservation = {
    status: 'SUCCESS',
    completedSuccessfulChecks: ['verify'],
    failedChecks: [],
    pendingChecks: [],
    totalChecksCount: 1,
    observedAt: '2026-09-14T03:00:00Z',
  };

  const validGovernanceSnapshot: GovernanceSnapshot = {
    repository: 'pubcoreagencia/pub-rate-calculator',
    targetBranch: 'main',
    source: {
      rulesets: 'ACTIVE',
      classicProtection: 'NONE',
    },
    effectiveGovernance: {
      requiredApprovals: 1,
      requireCodeOwners: false,
      requireLastPushApproval: false,
      requireThreadResolution: true,
      requireExtraApprovalForUnattributed: false,
      requiredStatusChecks: ['verify'],
      strictStatusChecks: true,
      blockForcePushes: true,
      blockDeletions: true,
      requireLinearHistory: false,
      allowedMergeMethods: ['merge', 'squash'],
      bypassPolicy: 'NEVER',
      isUnknown: false,
      unknownReasons: [],
    },
    observedAt: '2026-09-14T03:00:00Z',
  };

  const defaultExpected: PreMergeRevalidationExpected = {
    expectedHeadSha: 'commit_sha_valid_123',
    expectedBaseBranch: 'main',
    product: sampleProduct,
    requestedMergeMethod: 'merge',
  };

  const defaultFreshState: PreMergeFreshState = {
    pr: validSnapshotPr,
    ci: validCiObservation,
    governance: validGovernanceSnapshot,
  };

  // 1. tudo válido
  it('1. tudo válido -> ALLOW with 0 reasons and authorized=true', () => {
    const res = revalidatePreMergeState(defaultExpected, defaultFreshState);

    expect(res.decision).toBe('ALLOW');
    expect(res.authorized).toBe(true);
    expect(res.reasons).toEqual([]);
    expect(res.toctouViolations).toEqual([]);
  });

  // 2. SHA divergente
  it('2. SHA divergente -> DENY when fresh PR headSha does not match expectedHeadSha', () => {
    const freshState: PreMergeFreshState = {
      ...defaultFreshState,
      pr: {
        ...validSnapshotPr,
        headSha: 'divergent_head_sha_999',
      },
    };

    const res = revalidatePreMergeState(defaultExpected, freshState);

    expect(res.decision).toBe('DENY');
    expect(res.authorized).toBe(false);
    expect(res.reasons.some((r) => r.includes('PR head SHA mismatch'))).toBe(true);
  });

  // 3. PR fechado
  it('3. PR fechado -> DENY when fresh PR state is CLOSED', () => {
    const freshState: PreMergeFreshState = {
      ...defaultFreshState,
      pr: {
        ...validSnapshotPr,
        state: 'CLOSED',
      },
    };

    const res = revalidatePreMergeState(defaultExpected, freshState);

    expect(res.decision).toBe('DENY');
    expect(res.authorized).toBe(false);
    expect(res.reasons.some((r) => r.includes('PR is not OPEN'))).toBe(true);
  });

  // 4. PR draft
  it('4. PR draft -> DENY when fresh PR is in draft mode', () => {
    const freshState: PreMergeFreshState = {
      ...defaultFreshState,
      pr: {
        ...validSnapshotPr,
        draft: true,
      },
    };

    const res = revalidatePreMergeState(defaultExpected, freshState);

    expect(res.decision).toBe('DENY');
    expect(res.authorized).toBe(false);
    expect(res.reasons.some((r) => r.includes('PR is in DRAFT state'))).toBe(true);
  });

  // 5. base divergente
  it('5. base divergente -> DENY when PR baseRef differs from expectedBaseBranch', () => {
    const freshState: PreMergeFreshState = {
      ...defaultFreshState,
      pr: {
        ...validSnapshotPr,
        baseRef: 'release-2.0',
      },
    };

    const res = revalidatePreMergeState(defaultExpected, freshState);

    expect(res.decision).toBe('DENY');
    expect(res.authorized).toBe(false);
    expect(res.reasons.some((r) => r.includes('PR base branch mismatch'))).toBe(true);
  });

  // 6. mergeability blocked
  it('6. mergeability blocked -> DENY when mergeable is false or mergeStateStatus is BLOCKED', () => {
    const freshState: PreMergeFreshState = {
      ...defaultFreshState,
      pr: {
        ...validSnapshotPr,
        mergeable: false,
        mergeStateStatus: 'BLOCKED',
      },
    };

    const res = revalidatePreMergeState(defaultExpected, freshState);

    expect(res.decision).toBe('DENY');
    expect(res.authorized).toBe(false);
    expect(res.reasons.some((r) => r.includes('merge conflicts') || r.includes('BLOCKED'))).toBe(true);
  });

  // 7. CI failure
  it('7. CI failure -> DENY when fresh CI status is FAILURE or missing required checks', () => {
    const freshState: PreMergeFreshState = {
      ...defaultFreshState,
      ci: {
        ...validCiObservation,
        status: 'FAILURE',
        failedChecks: ['verify'],
        completedSuccessfulChecks: [],
      },
    };

    const res = revalidatePreMergeState(defaultExpected, freshState);

    expect(res.decision).toBe('DENY');
    expect(res.authorized).toBe(false);
    expect(res.reasons.some((r) => r.includes('CI status is not SUCCESS') || r.includes('Required CI status checks failed'))).toBe(true);
  });

  // 8. governance unknown
  it('8. governance unknown -> DENY when effectiveGovernance.isUnknown is true', () => {
    const freshState: PreMergeFreshState = {
      ...defaultFreshState,
      governance: {
        ...validGovernanceSnapshot,
        effectiveGovernance: {
          ...validGovernanceSnapshot.effectiveGovernance,
          isUnknown: true,
          unknownReasons: ['GitHub Ruleset API timeout after retries'],
        },
      },
    };

    const res = revalidatePreMergeState(defaultExpected, freshState);

    expect(res.decision).toBe('DENY');
    expect(res.authorized).toBe(false);
    expect(res.reasons.some((r) => r.includes('Governance state is UNKNOWN'))).toBe(true);
  });

  // 9. approvals insuficientes
  it('9. approvals insuficientes -> DENY when approvalsCount is below governance threshold', () => {
    const freshState: PreMergeFreshState = {
      ...defaultFreshState,
      pr: {
        ...validSnapshotPr,
        approvalsCount: 0,
        reviewDecision: null,
      },
    };

    const res = revalidatePreMergeState(defaultExpected, freshState);

    expect(res.decision).toBe('DENY');
    expect(res.authorized).toBe(false);
    expect(res.reasons.some((r) => r.includes('Insufficient approving reviews'))).toBe(true);
  });

  // 10. thread unresolved
  it('10. thread unresolved -> DENY when governance requires thread resolution and threads remain unresolved', () => {
    const freshState: PreMergeFreshState = {
      ...defaultFreshState,
      pr: {
        ...validSnapshotPr,
        allThreadsResolved: false,
      },
    };

    const res = revalidatePreMergeState(defaultExpected, freshState);

    expect(res.decision).toBe('DENY');
    expect(res.authorized).toBe(false);
    expect(res.reasons.some((r) => r.includes('Unresolved review conversation threads exist'))).toBe(true);
  });

  // 11. merge method inválido
  it('11. merge method inválido -> DENY when requested merge method is not permitted by governance', () => {
    const expected: PreMergeRevalidationExpected = {
      ...defaultExpected,
      requestedMergeMethod: 'rebase', // Only 'merge' and 'squash' allowed in validGovernanceSnapshot
    };

    const res = revalidatePreMergeState(expected, defaultFreshState);

    expect(res.decision).toBe('DENY');
    expect(res.authorized).toBe(false);
    expect(res.reasons.some((r) => r.includes('Requested merge method \'rebase\' is not permitted'))).toBe(true);
  });

  // 12. TOCTOU em SHA
  it('12. TOCTOU em SHA -> DENY with TOCTOU drift violation when head SHA changes between prior snapshot and fresh reading', () => {
    const expected: PreMergeRevalidationExpected = {
      ...defaultExpected,
      priorSnapshot: {
        pr: {
          ...validSnapshotPr,
          headSha: 'AAA',
        },
      },
    };

    const freshState: PreMergeFreshState = {
      ...defaultFreshState,
      pr: {
        ...validSnapshotPr,
        headSha: 'BBB', // Changed from AAA to BBB!
      },
    };

    const res = revalidatePreMergeState(expected, freshState);

    expect(res.decision).toBe('DENY');
    expect(res.authorized).toBe(false);
    expect(res.toctouViolations.some((v) => v.includes("TOCTOU drift in head SHA: prior was 'AAA', fresh is 'BBB'"))).toBe(true);
  });

  // 13. TOCTOU em approvals
  it('13. TOCTOU em approvals -> DENY with TOCTOU drift violation when approvals drop between observations', () => {
    const expected: PreMergeRevalidationExpected = {
      ...defaultExpected,
      priorSnapshot: {
        pr: {
          ...validSnapshotPr,
          approvalsCount: 1,
        },
      },
    };

    const freshState: PreMergeFreshState = {
      ...defaultFreshState,
      pr: {
        ...validSnapshotPr,
        approvalsCount: 0, // Dropped to 0!
        reviewDecision: null,
      },
    };

    const res = revalidatePreMergeState(expected, freshState);

    expect(res.decision).toBe('DENY');
    expect(res.authorized).toBe(false);
    expect(res.toctouViolations.some((v) => v.includes('TOCTOU drift in approvals: prior approvals was 1, fresh is 0'))).toBe(true);
  });

  // 14. TOCTOU em CI
  it('14. TOCTOU em CI -> DENY with TOCTOU drift violation when CI status was SUCCESS previously but degraded', () => {
    const expected: PreMergeRevalidationExpected = {
      ...defaultExpected,
      priorSnapshot: {
        ci: {
          ...validCiObservation,
          status: 'SUCCESS',
        },
      },
    };

    const freshState: PreMergeFreshState = {
      ...defaultFreshState,
      ci: {
        ...validCiObservation,
        status: 'FAILURE', // Degraded to FAILURE!
      },
    };

    const res = revalidatePreMergeState(expected, freshState);

    expect(res.decision).toBe('DENY');
    expect(res.authorized).toBe(false);
    expect(res.toctouViolations.some((v) => v.includes("TOCTOU drift in CI status: prior was 'SUCCESS', fresh is 'FAILURE'"))).toBe(true);
  });

  // 15. TOCTOU em branch/base
  it('15. TOCTOU em branch/base -> DENY with TOCTOU drift violation when base branch changes from main to release', () => {
    const expected: PreMergeRevalidationExpected = {
      ...defaultExpected,
      priorSnapshot: {
        pr: {
          ...validSnapshotPr,
          baseRef: 'main',
        },
      },
    };

    const freshState: PreMergeFreshState = {
      ...defaultFreshState,
      pr: {
        ...validSnapshotPr,
        baseRef: 'release', // Changed to release!
      },
    };

    const res = revalidatePreMergeState(expected, freshState);

    expect(res.decision).toBe('DENY');
    expect(res.authorized).toBe(false);
    expect(res.toctouViolations.some((v) => v.includes("TOCTOU drift in base branch: prior was 'main', fresh is 'release'"))).toBe(true);
  });

  // Integration: PreMergeRevalidator collector
  it('16. PreMergeRevalidator collector coordinates GitHub queries and produces revalidation result', async () => {
    const mockClient = {
      getPullRequest: vi.fn().mockResolvedValue({
        number: 17,
        html_url: 'https://github.com/pr/17',
        state: 'open',
        draft: false,
        mergeable: true,
        mergeable_state: 'clean',
        head: { sha: 'commit_sha_valid_123', ref: 'feat/rate-calc' },
        base: { sha: 'main_sha', ref: 'main' },
      }),
      getPullRequestReviews: vi.fn().mockResolvedValue([
        { id: 1, user: { login: 'matheus' }, state: 'APPROVED', commit_id: 'commit_sha_valid_123' },
      ]),
    } as any;

    const mockGovernanceReader = {
      readGovernance: vi.fn().mockResolvedValue(validGovernanceSnapshot),
    } as any;

    const mockCiObserver = {
      observe: vi.fn().mockResolvedValue({
        status: 'SUCCESS',
        observation: validCiObservation,
        blocked: false,
        reasons: [],
      }),
    } as any;

    const revalidator = new PreMergeRevalidator({
      client: mockClient,
      governanceReader: mockGovernanceReader,
      ciObserver: mockCiObserver,
    });

    const result = await revalidator.revalidate({
      owner: 'pubcoreagencia',
      repo: 'pub-rate-calculator',
      pullNumber: 17,
      expectedHeadSha: 'commit_sha_valid_123',
      expectedBaseBranch: 'main',
      product: sampleProduct,
      requestedMergeMethod: 'merge',
    });

    expect(result.decision).toBe('ALLOW');
    expect(result.authorized).toBe(true);
    expect(result.reasons).toEqual([]);
    expect(mockClient.getPullRequest).toHaveBeenCalledWith('pubcoreagencia', 'pub-rate-calculator', 17);
    expect(mockGovernanceReader.readGovernance).toHaveBeenCalled();
    expect(mockCiObserver.observe).toHaveBeenCalled();
  });
});

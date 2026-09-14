import { describe, it, expect } from 'vitest';
import { authorizeMerge, type MergeAuthorizationContext } from '../../../src/pdl/delivery/merge-authorizer.js';
import type {
  PullRequestSnapshot,
  CiObservation,
  NormalizedGovernance,
} from '../../../src/pdl/delivery/types.js';
import type { ProductManifest } from '../../../src/pdl/products/catalog.js';

describe('Phase 5.6: Pure Merge Authorization Engine', () => {
  const baseProduct: ProductManifest = {
    productId: 'pub-rate-calculator',
    repository: 'https://github.com/pubcoreagencia/pub-rate-calculator.git',
    organization: 'pubcoreagencia',
    defaultBranch: 'main',
    developmentBranchPolicy: ['feat/*', 'fix/*'],
    testCommand: 'node test/validate.mjs',
    allowedPaths: ['src/**', 'test/**'],
    protectedPaths: ['.github/**', 'package.json'],
    maxAutonomyLevel: 5,
    remotePersistenceEligible: true,
  };

  const baseGovernance: NormalizedGovernance = {
    requiredApprovals: 0,
    requireCodeOwners: false,
    requireLastPushApproval: false,
    requireThreadResolution: true,
    requireExtraApprovalForUnattributed: false,
    requiredStatusChecks: ['verify'],
    strictStatusChecks: true,
    blockForcePushes: true,
    blockDeletions: true,
    requireLinearHistory: false,
    allowedMergeMethods: ['merge', 'squash', 'rebase'],
    bypassPolicy: 'NEVER',
    isUnknown: false,
    unknownReasons: [],
  };

  const basePR: PullRequestSnapshot = {
    number: 42,
    url: 'https://github.com/pubcoreagencia/pub-rate-calculator/pull/42',
    state: 'OPEN',
    draft: false,
    mergeable: true,
    mergeStateStatus: 'CLEAN',
    headSha: '45290d3746bece264e8dcb8e120288da7703282c',
    baseSha: 'e9cde396013a9c8ac1ff1d6568ae9bdf8ffdf63d',
    headRef: 'feat/rate-calculator-pilot',
    baseRef: 'main',
    approvalsCount: 0,
    allThreadsResolved: true,
    hasUnattributedCommits: false,
    reviewDecision: null,
  };

  const baseCI: CiObservation = {
    status: 'SUCCESS',
    completedSuccessfulChecks: ['verify'],
    failedChecks: [],
    pendingChecks: [],
    totalChecksCount: 1,
    observedAt: '2026-09-14T03:00:00Z',
  };

  const createValidContext = (overrides?: Partial<MergeAuthorizationContext>): MergeAuthorizationContext => ({
    pr: { ...basePR, ...(overrides?.pr || {}) },
    ci: { ...baseCI, ...(overrides?.ci || {}) },
    governance: { ...baseGovernance, ...(overrides?.governance || {}) },
    product: { ...baseProduct, ...(overrides?.product || {}) },
    requestedMergeMethod: overrides?.requestedMergeMethod ?? 'merge',
  });

  // 1. Fully satisfied delivery -> ALLOW
  it('1. returns ALLOW when all security, governance, and CI conditions are completely satisfied', () => {
    const ctx = createValidContext();
    const result = authorizeMerge(ctx);

    expect(result.decision).toBe('ALLOW');
    expect(result.authorized).toBe(true);
    expect(result.reasons).toEqual([]);
    expect(result.evaluatedAt).toBeDefined();
  });

  // 2. PR closed -> DENY
  it('2. returns DENY if PR is not OPEN', () => {
    const ctx = createValidContext({ pr: { ...basePR, state: 'CLOSED' } });
    const result = authorizeMerge(ctx);

    expect(result.decision).toBe('DENY');
    expect(result.authorized).toBe(false);
    expect(result.reasons.some((r) => r.includes('PR is not OPEN'))).toBe(true);
  });

  // 3. PR draft -> DENY
  it('3. returns DENY if PR is in DRAFT state', () => {
    const ctx = createValidContext({ pr: { ...basePR, draft: true } });
    const result = authorizeMerge(ctx);

    expect(result.decision).toBe('DENY');
    expect(result.authorized).toBe(false);
    expect(result.reasons.some((r) => r.includes('PR is in DRAFT'))).toBe(true);
  });

  // 4. Merge conflict -> DENY
  it('4. returns DENY if PR has merge conflicts (mergeable === false)', () => {
    const ctx = createValidContext({ pr: { ...basePR, mergeable: false } });
    const result = authorizeMerge(ctx);

    expect(result.decision).toBe('DENY');
    expect(result.authorized).toBe(false);
    expect(result.reasons.some((r) => r.includes('merge conflicts'))).toBe(true);
  });

  // 5. Mergeability unknown / pending -> DENY
  it('5. returns DENY if PR mergeable is null (pending calculation)', () => {
    const ctx = createValidContext({ pr: { ...basePR, mergeable: null } });
    const result = authorizeMerge(ctx);

    expect(result.decision).toBe('DENY');
    expect(result.authorized).toBe(false);
    expect(result.reasons.some((r) => r.includes('mergeability is pending'))).toBe(true);
  });

  // 6. Merge state BLOCKED -> DENY
  it('6. returns DENY if PR mergeStateStatus is BLOCKED', () => {
    const ctx = createValidContext({ pr: { ...basePR, mergeStateStatus: 'BLOCKED' } });
    const result = authorizeMerge(ctx);

    expect(result.decision).toBe('DENY');
    expect(result.authorized).toBe(false);
    expect(result.reasons.some((r) => r.includes('mergeStateStatus is BLOCKED'))).toBe(true);
  });

  // 7. Merge state DIRTY -> DENY
  it('7. returns DENY if PR mergeStateStatus is DIRTY', () => {
    const ctx = createValidContext({ pr: { ...basePR, mergeStateStatus: 'DIRTY' } });
    const result = authorizeMerge(ctx);

    expect(result.decision).toBe('DENY');
    expect(result.authorized).toBe(false);
    expect(result.reasons.some((r) => r.includes('mergeStateStatus is DIRTY'))).toBe(true);
  });

  // 8. Merge state BEHIND with strict status checks -> DENY
  it('8. returns DENY if PR is BEHIND and strict checks are enforced', () => {
    const ctx = createValidContext({
      pr: { ...basePR, mergeStateStatus: 'BEHIND' },
      governance: { ...baseGovernance, strictStatusChecks: true },
    });
    const result = authorizeMerge(ctx);

    expect(result.decision).toBe('DENY');
    expect(result.authorized).toBe(false);
    expect(result.reasons.some((r) => r.includes('BEHIND base branch'))).toBe(true);
  });

  // 9. CI failure -> DENY
  it('9. returns DENY if CI status is FAILURE', () => {
    const ctx = createValidContext({
      ci: { ...baseCI, status: 'FAILURE', failedChecks: ['verify'] },
    });
    const result = authorizeMerge(ctx);

    expect(result.decision).toBe('DENY');
    expect(result.authorized).toBe(false);
    expect(result.reasons.some((r) => r.includes('CI status checks failed'))).toBe(true);
  });

  // 10. CI pending -> DENY
  it('10. returns DENY if CI status is PENDING', () => {
    const ctx = createValidContext({
      ci: { ...baseCI, status: 'PENDING', pendingChecks: ['verify'] },
    });
    const result = authorizeMerge(ctx);

    expect(result.decision).toBe('DENY');
    expect(result.authorized).toBe(false);
    expect(result.reasons.some((r) => r.includes('still pending'))).toBe(true);
  });

  // 11. CI timed out -> DENY
  it('11. returns DENY if CI timed out', () => {
    const ctx = createValidContext({
      ci: { ...baseCI, status: 'TIMED_OUT' },
    });
    const result = authorizeMerge(ctx);

    expect(result.decision).toBe('DENY');
    expect(result.authorized).toBe(false);
    expect(result.reasons.some((r) => r.includes('timed out'))).toBe(true);
  });

  // 12. CI unknown -> DENY
  it('12. returns DENY if CI status is UNKNOWN (fail-closed)', () => {
    const ctx = createValidContext({
      ci: { ...baseCI, status: 'UNKNOWN' },
    });
    const result = authorizeMerge(ctx);

    expect(result.decision).toBe('DENY');
    expect(result.authorized).toBe(false);
    expect(result.reasons.some((r) => r.includes('CI observation status is UNKNOWN'))).toBe(true);
  });

  // 13. Missing specific required status check -> DENY
  it('13. returns DENY if a required status check has not completed successfully', () => {
    const ctx = createValidContext({
      governance: { ...baseGovernance, requiredStatusChecks: ['verify', 'integration-tests'] },
      ci: { ...baseCI, completedSuccessfulChecks: ['verify'] }, // integration-tests missing!
    });
    const result = authorizeMerge(ctx);

    expect(result.decision).toBe('DENY');
    expect(result.authorized).toBe(false);
    expect(result.reasons.some((r) => r.includes("Required status check 'integration-tests'"))).toBe(true);
  });

  // 14. Insufficient approval count -> DENY
  it('14. returns DENY if approving reviews are less than required', () => {
    const ctx = createValidContext({
      governance: { ...baseGovernance, requiredApprovals: 1 },
      pr: { ...basePR, approvalsCount: 0, reviewDecision: 'REVIEW_REQUIRED' },
    });
    const result = authorizeMerge(ctx);

    expect(result.decision).toBe('DENY');
    expect(result.authorized).toBe(false);
    expect(result.reasons.some((r) => r.includes('Insufficient approving reviews'))).toBe(true);
  });

  // 15. Approvals present and review decision APPROVED -> ALLOW
  it('15. returns ALLOW when required approvals are satisfied with APPROVED decision', () => {
    const ctx = createValidContext({
      governance: { ...baseGovernance, requiredApprovals: 1 },
      pr: { ...basePR, approvalsCount: 1, reviewDecision: 'APPROVED' },
    });
    const result = authorizeMerge(ctx);

    expect(result.decision).toBe('ALLOW');
    expect(result.authorized).toBe(true);
  });

  // 16. Unresolved review threads -> DENY
  it('16. returns DENY if unresolved review conversation threads exist and thread resolution is required', () => {
    const ctx = createValidContext({
      governance: { ...baseGovernance, requireThreadResolution: true },
      pr: { ...basePR, allThreadsResolved: false },
    });
    const result = authorizeMerge(ctx);

    expect(result.decision).toBe('DENY');
    expect(result.authorized).toBe(false);
    expect(result.reasons.some((r) => r.includes('Unresolved review conversation threads'))).toBe(true);
  });

  // 17. Unauthorized product remote persistence -> DENY
  it('17. returns DENY if product is not eligible for remote persistence', () => {
    const ctx = createValidContext({
      product: { ...baseProduct, remotePersistenceEligible: false },
    });
    const result = authorizeMerge(ctx);

    expect(result.decision).toBe('DENY');
    expect(result.authorized).toBe(false);
    expect(result.reasons.some((r) => r.includes('not eligible for autonomous remote persistence'))).toBe(true);
  });

  // 18. Unauthorized target branch -> DENY
  it('18. returns DENY if PR baseRef does not match product defaultBranch', () => {
    const ctx = createValidContext({
      pr: { ...basePR, baseRef: 'staging' }, // product defaultBranch is 'main'
    });
    const result = authorizeMerge(ctx);

    expect(result.decision).toBe('DENY');
    expect(result.authorized).toBe(false);
    expect(result.reasons.some((r) => r.includes("PR target branch 'staging' does not match"))).toBe(true);
  });

  // 19. Unauthorized merge method -> DENY
  it('19. returns DENY if requested merge method is not in allowedMergeMethods', () => {
    const ctx = createValidContext({
      governance: { ...baseGovernance, allowedMergeMethods: ['squash'] },
      requestedMergeMethod: 'merge', // only squash is allowed!
    });
    const result = authorizeMerge(ctx);

    expect(result.decision).toBe('DENY');
    expect(result.authorized).toBe(false);
    expect(result.reasons.some((r) => r.includes("Requested merge method 'merge' is not permitted"))).toBe(true);
  });

  // 20. Unknown governance -> DENY (Fail-closed)
  it('20. returns DENY if governance is UNKNOWN', () => {
    const ctx = createValidContext({
      governance: {
        ...baseGovernance,
        isUnknown: true,
        unknownReasons: ['Ruleset API failed with HTTP 500'],
      },
    });
    const result = authorizeMerge(ctx);

    expect(result.decision).toBe('DENY');
    expect(result.authorized).toBe(false);
    expect(result.reasons.some((r) => r.includes('Governance state is UNKNOWN'))).toBe(true);
  });
});

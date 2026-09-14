/**
 * Phase 5.6: Pre-Merge Revalidation & TOCTOU Protection.
 *
 * Responsibilities:
 * - Pure validation policy (revalidatePreMergeState): Evaluates remote fresh state immediately
 *   prior to merge authorization to prevent Time-of-Check to Time-of-Use (TOCTOU) races.
 * - Enforces 14 mandatory invariants:
 *   1. PR exists
 *   2. PR is OPEN
 *   3. PR is not draft
 *   4. PR head SHA == expectedHeadSha
 *   5. PR base branch == expectedBaseBranch
 *   6. PR is mergeable (true)
 *   7. PR mergeStateStatus does not block
 *   8. Required CI status checks remain valid for expectedHeadSha (SUCCESS)
 *   9. Current branch governance is verified and valid (!isUnknown)
 *   10. Approving reviews continue to meet or exceed required thresholds
 *   11. Required conversation threads continue to be resolved
 *   12. Requested merge method continues to be permitted
 *   13. Bypass policy remains strictly NEVER
 *   14. Target branch matches product default branch
 * - Reuses authorizeMerge(): Does NOT duplicate authorization logic; constructs the fresh context
 *   and delegates final policy decision to the pure authorization engine.
 * - PreMergeRevalidator: External collector class that coordinates fresh queries to GitHub
 *   without introducing any merge execution capability (Zero Merge Capability).
 */

import { GitHubClient } from './github-client.js';
import { GovernanceReader } from './governance-reader.js';
import { RemoteCiObserver } from './remote-ci-observer.js';
import { authorizeMerge, type MergeAuthorizationContext } from './merge-authorizer.js';
import { toPullRequestSnapshot } from './pr-lifecycle-manager.js';
import type { ProductManifest } from '../products/catalog.js';
import type {
  PullRequestSnapshot,
  CiObservation,
  GovernanceSnapshot,
  MergeMethod,
  MergeAuthorization,
  PreMergeRevalidationExpected,
  PreMergeFreshState,
  PreMergeRevalidationResult,
} from './types.js';

/**
 * Pure function: Revalidates the remote state against expected parameters and prior snapshot.
 * Zero I/O, deterministic, and fail-closed.
 */
export function revalidatePreMergeState(
  expected: PreMergeRevalidationExpected,
  freshState: PreMergeFreshState
): PreMergeRevalidationResult {
  const revalidatedAt = new Date().toISOString();
  const toctouViolations: string[] = [];
  const invariantReasons: string[] = [];

  const { pr, governance, ci } = freshState;
  const { expectedHeadSha, expectedBaseBranch, product, requestedMergeMethod, priorSnapshot } = expected;

  // --------------------------------------------------------------------------
  // Invariant 1: PR Exists
  // --------------------------------------------------------------------------
  if (!pr) {
    const reason = 'PR does not exist (null snapshot in fresh remote state)';
    invariantReasons.push(reason);
    if (priorSnapshot?.pr) {
      toctouViolations.push(`TOCTOU drift: PR was present in prior snapshot, but missing in fresh state`);
    }

    const failedAuth: MergeAuthorization = {
      decision: 'DENY',
      authorized: false,
      reasons: [...invariantReasons, ...toctouViolations],
      evaluatedAt: revalidatedAt,
    };

    return {
      decision: 'DENY',
      authorized: false,
      reasons: failedAuth.reasons,
      revalidatedAt,
      toctouViolations,
      authorization: failedAuth,
      freshSnapshot: freshState,
    };
  }

  // --------------------------------------------------------------------------
  // TOCTOU Drift Detection (Comparison against prior observation if available)
  // --------------------------------------------------------------------------
  if (priorSnapshot) {
    // Caso A: Drift in head SHA
    if (priorSnapshot.pr && priorSnapshot.pr.headSha !== pr.headSha) {
      toctouViolations.push(
        `TOCTOU drift in head SHA: prior was '${priorSnapshot.pr.headSha}', fresh is '${pr.headSha}'`
      );
    }

    // Caso B: Drift in approvals
    if (
      priorSnapshot.pr &&
      priorSnapshot.pr.approvalsCount > pr.approvalsCount
    ) {
      toctouViolations.push(
        `TOCTOU drift in approvals: prior approvals was ${priorSnapshot.pr.approvalsCount}, fresh is ${pr.approvalsCount}`
      );
    }

    // Caso C: Drift in CI status
    if (
      priorSnapshot.ci &&
      priorSnapshot.ci.status === 'SUCCESS' &&
      ci.status !== 'SUCCESS'
    ) {
      toctouViolations.push(
        `TOCTOU drift in CI status: prior was 'SUCCESS', fresh is '${ci.status}'`
      );
    }

    // Caso D: Drift in PR state (e.g. was OPEN, now CLOSED)
    if (
      priorSnapshot.pr &&
      priorSnapshot.pr.state === 'OPEN' &&
      pr.state !== 'OPEN'
    ) {
      toctouViolations.push(
        `TOCTOU drift in PR state: prior was 'OPEN', fresh is '${pr.state}'`
      );
    }

    // Caso E: Drift in base branch (e.g. was main, now release)
    if (
      priorSnapshot.pr &&
      priorSnapshot.pr.baseRef !== pr.baseRef
    ) {
      toctouViolations.push(
        `TOCTOU drift in base branch: prior was '${priorSnapshot.pr.baseRef}', fresh is '${pr.baseRef}'`
      );
    }
  }

  // --------------------------------------------------------------------------
  // Invariant 2: PR is OPEN
  // --------------------------------------------------------------------------
  if (pr.state !== 'OPEN') {
    invariantReasons.push(`PR is not OPEN (current fresh state: ${pr.state})`);
  }

  // --------------------------------------------------------------------------
  // Invariant 3: PR is not draft
  // --------------------------------------------------------------------------
  if (pr.draft) {
    invariantReasons.push('PR is in DRAFT state');
  }

  // --------------------------------------------------------------------------
  // Invariant 4: PR head SHA == expectedHeadSha
  // --------------------------------------------------------------------------
  if (pr.headSha !== expectedHeadSha) {
    invariantReasons.push(
      `PR head SHA mismatch: expected '${expectedHeadSha}', fresh is '${pr.headSha}'`
    );
  }

  // --------------------------------------------------------------------------
  // Invariant 5: PR base branch == expectedBaseBranch
  // --------------------------------------------------------------------------
  if (pr.baseRef !== expectedBaseBranch) {
    invariantReasons.push(
      `PR base branch mismatch: expected '${expectedBaseBranch}', fresh is '${pr.baseRef}'`
    );
  }

  // --------------------------------------------------------------------------
  // Invariant 6: PR is mergeable
  // --------------------------------------------------------------------------
  if (pr.mergeable === false) {
    invariantReasons.push('PR has merge conflicts (mergeable is false)');
  } else if (pr.mergeable === null) {
    invariantReasons.push('PR mergeability is pending or unknown (mergeable is null)');
  }

  // --------------------------------------------------------------------------
  // Invariant 7: mergeStateStatus does not block
  // --------------------------------------------------------------------------
  if (pr.mergeStateStatus === 'BLOCKED') {
    invariantReasons.push('PR mergeStateStatus is BLOCKED by GitHub governance or branch policy');
  } else if (pr.mergeStateStatus === 'DIRTY') {
    invariantReasons.push('PR mergeStateStatus is DIRTY (merge conflicts detected by GitHub)');
  } else if (pr.mergeStateStatus === 'BEHIND' && governance.effectiveGovernance.strictStatusChecks) {
    invariantReasons.push('PR is BEHIND base branch and strict status checks policy is enforced');
  } else if (pr.mergeStateStatus === 'UNKNOWN') {
    invariantReasons.push('PR mergeStateStatus is UNKNOWN');
  }

  // --------------------------------------------------------------------------
  // Invariant 8: CI remains valid for expectedHeadSha
  // --------------------------------------------------------------------------
  if (ci.status === 'UNKNOWN') {
    invariantReasons.push('CI observation status is UNKNOWN');
  } else if (ci.status !== 'SUCCESS') {
    invariantReasons.push(`CI status is not SUCCESS (current fresh status: ${ci.status})`);
  }

  // --------------------------------------------------------------------------
  // Invariant 9: Governance is verified and valid
  // --------------------------------------------------------------------------
  if (governance.effectiveGovernance.isUnknown) {
    const reasons = governance.effectiveGovernance.unknownReasons.join('; ') || 'unspecified';
    invariantReasons.push(`Governance state is UNKNOWN: ${reasons}`);
  }

  // --------------------------------------------------------------------------
  // Invariant 10: Approvals continue sufficient
  // --------------------------------------------------------------------------
  if (pr.approvalsCount < governance.effectiveGovernance.requiredApprovals) {
    invariantReasons.push(
      `Insufficient approving reviews: required ${governance.effectiveGovernance.requiredApprovals}, got ${pr.approvalsCount}`
    );
  }

  if (governance.effectiveGovernance.requiredApprovals > 0 && pr.reviewDecision !== 'APPROVED') {
    invariantReasons.push(`Review decision is '${pr.reviewDecision ?? 'NONE'}', requires 'APPROVED'`);
  }

  // --------------------------------------------------------------------------
  // Invariant 11: Required threads resolved
  // --------------------------------------------------------------------------
  if (governance.effectiveGovernance.requireThreadResolution && !pr.allThreadsResolved) {
    invariantReasons.push('Unresolved review conversation threads exist on the PR');
  }

  // --------------------------------------------------------------------------
  // Invariant 12: Merge method permitted
  // --------------------------------------------------------------------------
  if (!governance.effectiveGovernance.allowedMergeMethods.includes(requestedMergeMethod)) {
    const allowed = governance.effectiveGovernance.allowedMergeMethods.join(', ') || 'none';
    invariantReasons.push(
      `Requested merge method '${requestedMergeMethod}' is not permitted by effective governance (allowed: ${allowed})`
    );
  }

  // --------------------------------------------------------------------------
  // Invariant 13: Bypass policy is NEVER
  // --------------------------------------------------------------------------
  if (governance.effectiveGovernance.bypassPolicy !== 'NEVER') {
    invariantReasons.push(
      `Governance bypass policy is not NEVER (found: ${governance.effectiveGovernance.bypassPolicy})`
    );
  }

  // --------------------------------------------------------------------------
  // Invariant 14: Target branch matches product default branch
  // --------------------------------------------------------------------------
  if (pr.baseRef !== product.defaultBranch) {
    invariantReasons.push(
      `PR target branch '${pr.baseRef}' does not match product default branch '${product.defaultBranch}'`
    );
  }

  // --------------------------------------------------------------------------
  // Authorize Merge Engine Delegation (Reuses pure authorizeMerge)
  // --------------------------------------------------------------------------
  const authContext: MergeAuthorizationContext = {
    pr,
    ci,
    governance: governance.effectiveGovernance,
    product,
    requestedMergeMethod,
  };

  const authorization = authorizeMerge(authContext);

  // Combine reasons avoiding duplicates
  const allReasons = Array.from(
    new Set([...toctouViolations, ...invariantReasons, ...authorization.reasons])
  );

  const isAllowed =
    authorization.decision === 'ALLOW' &&
    toctouViolations.length === 0 &&
    invariantReasons.length === 0;

  return {
    decision: isAllowed ? 'ALLOW' : 'DENY',
    authorized: isAllowed,
    reasons: allReasons,
    revalidatedAt,
    toctouViolations,
    authorization,
    freshSnapshot: freshState,
  };
}

// ============================================================================
// PreMergeRevalidator: External Fresh State Collector
// ============================================================================

export interface PreMergeRevalidatorOptions {
  client: GitHubClient;
  governanceReader: GovernanceReader;
  ciObserver: RemoteCiObserver;
}

export interface CollectFreshStateInput {
  owner: string;
  repo: string;
  pullNumber: number;
  headSha: string;
  targetBranch: string;
  productPolicy?: ProductManifest | null;
  hasUnattributedCommits?: boolean;
  requiredChecks?: string[];
}

export interface PreMergeRevalidateInput extends PreMergeRevalidationExpected {
  owner: string;
  repo: string;
  pullNumber: number;
}

export class PreMergeRevalidator {
  constructor(private readonly options: PreMergeRevalidatorOptions) {}

  /**
   * Collects fresh remote state from GitHub across PR, Governance, and CI.
   * Zero mutation, fail-closed.
   */
  async collectFreshState(input: CollectFreshStateInput): Promise<PreMergeFreshState> {
    const { client, governanceReader, ciObserver } = this.options;

    // 1. Fresh PR and reviews
    const fullPr = await client.getPullRequest(input.owner, input.repo, input.pullNumber);
    const reviews = await client.getPullRequestReviews(input.owner, input.repo, input.pullNumber);
    const freshPr = toPullRequestSnapshot(fullPr, reviews);

    // 2. Fresh Governance
    const freshGovernance = await governanceReader.readGovernance({
      owner: input.owner,
      repo: input.repo,
      branch: input.targetBranch,
      productPolicy: input.productPolicy,
      hasUnattributedCommits: input.hasUnattributedCommits,
    });

    // 3. Fresh CI for the target commit
    const checksToObserve =
      input.requiredChecks ?? freshGovernance.effectiveGovernance.requiredStatusChecks;

    const ciResult = await ciObserver.observe({
      owner: input.owner,
      repo: input.repo,
      headSha: input.headSha,
      requiredChecks: checksToObserve,
      maxWaitMs: 0, // Fresh check: evaluate immediate current state without polling delay
    });

    return {
      pr: freshPr,
      governance: freshGovernance,
      ci: ciResult.observation,
    };
  }

  /**
   * Revalidates the remote state by querying fresh GitHub data and running pure validation.
   */
  async revalidate(input: PreMergeRevalidateInput): Promise<PreMergeRevalidationResult> {
    const freshState = await this.collectFreshState({
      owner: input.owner,
      repo: input.repo,
      pullNumber: input.pullNumber,
      headSha: input.expectedHeadSha,
      targetBranch: input.expectedBaseBranch,
      productPolicy: input.product,
      hasUnattributedCommits: input.priorSnapshot?.pr?.hasUnattributedCommits,
    });

    return revalidatePreMergeState(input, freshState);
  }
}

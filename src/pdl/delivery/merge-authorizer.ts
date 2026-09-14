/**
 * Phase 5.6: Pure Merge Authorization Engine.
 *
 * Evaluates whether a Pull Request is authoritatively permitted to merge into the
 * product's canonical default branch under effective governance and CI evidence.
 *
 * Invariants:
 * - 100% Pure Function: Zero I/O, zero network calls, zero file access, zero state mutation.
 * - Fail-Closed: Any missing evidence, conflicting state, or UNKNOWN governance results in DENY.
 * - Deterministic: Same inputs always yield the exact same decision and reasons.
 * - Defense in Depth: Validates PR state, CI completeness, review requirements,
 *   thread resolution, branch targeting, and merge method compliance.
 */

import type { ProductManifest } from '../products/catalog.js';
import type {
  PullRequestSnapshot,
  CiObservation,
  NormalizedGovernance,
  MergeMethod,
  MergeAuthorization,
} from './types.js';

export interface MergeAuthorizationContext {
  pr: PullRequestSnapshot;
  ci: CiObservation;
  governance: NormalizedGovernance;
  product: ProductManifest;
  requestedMergeMethod: MergeMethod;
}

/**
 * Authoritatively evaluates if a PR is permitted to merge.
 * Returns ALLOW only if all security, governance, and CI conditions are completely satisfied.
 */
export function authorizeMerge(context: MergeAuthorizationContext): MergeAuthorization {
  const evaluatedAt = new Date().toISOString();
  const reasons: string[] = [];

  const { pr, ci, governance, product, requestedMergeMethod } = context;

  // 1. Governance certainty check (UNKNOWN fails closed)
  if (governance.isUnknown) {
    reasons.push(
      `Governance state is UNKNOWN: ${governance.unknownReasons.join('; ') || 'unspecified'}`
    );
  }

  // 2. Product Catalog eligibility check
  if (!product.remotePersistenceEligible) {
    reasons.push(
      `Product '${product.productId}' is not eligible for autonomous remote persistence (remotePersistenceEligible=false)`
    );
  }

  // 3. Target branch validation against Product Catalog
  if (pr.baseRef !== product.defaultBranch) {
    reasons.push(
      `PR target branch '${pr.baseRef}' does not match product default branch '${product.defaultBranch}'`
    );
  }

  // 4. PR structural state checks
  if (pr.state !== 'OPEN') {
    reasons.push(`PR is not OPEN (current state: ${pr.state})`);
  }

  if (pr.draft) {
    reasons.push('PR is in DRAFT state');
  }

  if (pr.mergeable === false) {
    reasons.push('PR has merge conflicts (mergeable is false)');
  } else if (pr.mergeable === null) {
    reasons.push('PR mergeability is pending or unknown (mergeable is null)');
  }

  if (pr.mergeStateStatus === 'BLOCKED') {
    reasons.push('PR mergeStateStatus is BLOCKED by GitHub governance or branch policy');
  } else if (pr.mergeStateStatus === 'DIRTY') {
    reasons.push('PR mergeStateStatus is DIRTY (merge conflicts detected by GitHub)');
  } else if (pr.mergeStateStatus === 'BEHIND' && governance.strictStatusChecks) {
    reasons.push('PR is BEHIND base branch and strict status checks policy is enforced');
  } else if (pr.mergeStateStatus === 'UNKNOWN') {
    reasons.push('PR mergeStateStatus is UNKNOWN');
  }

  // 5. CI Status verification
  if (ci.status === 'FAILURE') {
    const failedList = ci.failedChecks.length > 0 ? ci.failedChecks.join(', ') : 'unspecified';
    reasons.push(`Required CI status checks failed: ${failedList}`);
  } else if (ci.status === 'PENDING') {
    const pendingList = ci.pendingChecks.length > 0 ? ci.pendingChecks.join(', ') : 'unspecified';
    reasons.push(`Required CI status checks are still pending: ${pendingList}`);
  } else if (ci.status === 'TIMED_OUT') {
    reasons.push('CI observation timed out before all required checks finished');
  } else if (ci.status === 'UNKNOWN') {
    reasons.push('CI observation status is UNKNOWN');
  } else if (ci.status !== 'SUCCESS') {
    reasons.push(`CI status is not SUCCESS (current: ${ci.status})`);
  }

  // 6. Specific required checks verification
  for (const check of governance.requiredStatusChecks) {
    if (!ci.completedSuccessfulChecks.includes(check)) {
      reasons.push(`Required status check '${check}' has not completed successfully`);
    }
  }

  // 7. Approving reviews verification
  if (pr.approvalsCount < governance.requiredApprovals) {
    reasons.push(
      `Insufficient approving reviews: required ${governance.requiredApprovals}, got ${pr.approvalsCount}`
    );
  }

  if (governance.requiredApprovals > 0 && pr.reviewDecision !== 'APPROVED') {
    reasons.push(
      `Review decision is '${pr.reviewDecision ?? 'NONE'}', requires 'APPROVED'`
    );
  }

  // 8. Review conversation thread resolution
  if (governance.requireThreadResolution && !pr.allThreadsResolved) {
    reasons.push('Unresolved review conversation threads exist on the PR');
  }

  // 9. Merge method compliance
  if (!governance.allowedMergeMethods.includes(requestedMergeMethod)) {
    const allowed = governance.allowedMergeMethods.join(', ') || 'none';
    reasons.push(
      `Requested merge method '${requestedMergeMethod}' is not permitted by effective governance (allowed: ${allowed})`
    );
  }

  if (reasons.length > 0) {
    return {
      decision: 'DENY',
      authorized: false,
      reasons,
      evaluatedAt,
    };
  }

  return {
    decision: 'ALLOW',
    authorized: true,
    reasons: [],
    evaluatedAt,
  };
}

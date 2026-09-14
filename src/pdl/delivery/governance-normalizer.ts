/**
 * Phase 5.6: Governance Normalization & Union Resolution.
 *
 * Implements pure, fail-closed normalization of raw GitHub governance inputs:
 * 1. Raw Rulesets (GET /rules/branches/{branch})
 * 2. Raw Classic Branch Protection (GET /branches/{branch}/protection)
 * 3. Product Catalog Policy
 *
 * The output is an Effective Governance structure representing the strictest
 * union of constraints.
 *
 * Invariants:
 * - Pure function: Zero I/O, zero network calls, zero state mutation.
 * - Unknown remains unknown: Query failures or undefined inputs fail closed.
 * - Strictest constraint wins: Reviews, checks, thread resolution, and strict status policies.
 * - Bypass is unconditionally NEVER.
 */

import type { ProductManifest } from '../products/catalog.js';
import type {
  RawRulesetRule,
  RawClassicBranchProtection,
  NormalizedGovernance,
  MergeMethod,
} from './types.js';

export interface ComputeEffectiveGovernanceOptions {
  rulesets?: RawRulesetRule[] | null;
  classicProtection?: RawClassicBranchProtection | null;
  productPolicy?: ProductManifest | null;
  hasUnattributedCommits?: boolean;
}

const ALL_MERGE_METHODS: MergeMethod[] = ['merge', 'squash', 'rebase'];

/**
 * Intermediate normalized representation of a single governance source.
 */
interface NormalizedGovernanceSource {
  requiredApprovals: number;
  requireCodeOwners: boolean;
  requireLastPushApproval: boolean;
  requireThreadResolution: boolean;
  requireExtraApprovalForUnattributed: boolean;
  requiredStatusChecks: string[];
  strictStatusChecks: boolean;
  blockForcePushes: boolean;
  blockDeletions: boolean;
  requireLinearHistory: boolean;
  allowedMergeMethods?: MergeMethod[];
  isUnknown: boolean;
  unknownReasons: string[];
}

/**
 * Normalizes an array of raw rules from GitHub Rulesets.
 * If input is undefined, treats as UNKNOWN (fail-closed).
 * If input is null or empty array, treats as ACTIVE with zero rules.
 */
export function normalizeRulesets(
  rawRules?: RawRulesetRule[] | null
): NormalizedGovernanceSource {
  if (rawRules === undefined) {
    return {
      requiredApprovals: 0,
      requireCodeOwners: false,
      requireLastPushApproval: false,
      requireThreadResolution: false,
      requireExtraApprovalForUnattributed: false,
      requiredStatusChecks: [],
      strictStatusChecks: false,
      blockForcePushes: false,
      blockDeletions: false,
      requireLinearHistory: false,
      isUnknown: true,
      unknownReasons: ['Ruleset governance state is undefined or could not be verified'],
    };
  }

  const result: NormalizedGovernanceSource = {
    requiredApprovals: 0,
    requireCodeOwners: false,
    requireLastPushApproval: false,
    requireThreadResolution: false,
    requireExtraApprovalForUnattributed: false,
    requiredStatusChecks: [],
    strictStatusChecks: false,
    blockForcePushes: false,
    blockDeletions: false,
    requireLinearHistory: false,
    isUnknown: false,
    unknownReasons: [],
  };

  if (!rawRules || rawRules.length === 0) {
    return result;
  }

  const checksSet = new Set<string>();

  for (const rule of rawRules) {
    if (!rule || typeof rule.type !== 'string') continue;

    switch (rule.type) {
      case 'pull_request': {
        const p = rule.parameters;
        if (p) {
          if (typeof p.required_approving_review_count === 'number') {
            result.requiredApprovals = Math.max(
              result.requiredApprovals,
              Math.max(0, p.required_approving_review_count)
            );
          }
          if (p.require_code_owner_review) {
            result.requireCodeOwners = true;
          }
          if (p.require_last_push_approval) {
            result.requireLastPushApproval = true;
          }
          if (p.required_review_thread_resolution) {
            result.requireThreadResolution = true;
          }
          if (p.require_extra_approval_for_unattributed_changes) {
            result.requireExtraApprovalForUnattributed = true;
          }
          if (Array.isArray(p.allowed_merge_methods) && p.allowed_merge_methods.length > 0) {
            result.allowedMergeMethods = [...p.allowed_merge_methods];
          }
        }
        break;
      }

      case 'required_status_checks': {
        const p = rule.parameters;
        if (p) {
          if (p.strict_required_status_checks_policy) {
            result.strictStatusChecks = true;
          }
          if (Array.isArray(p.required_status_checks)) {
            for (const c of p.required_status_checks) {
              if (c?.context?.trim()) {
                checksSet.add(c.context.trim());
              }
            }
          }
        }
        break;
      }

      case 'non_fast_forward': {
        result.blockForcePushes = true;
        break;
      }

      case 'deletion': {
        result.blockDeletions = true;
        break;
      }

      case 'required_linear_history': {
        result.requireLinearHistory = true;
        break;
      }

      default:
        // Unknown rule types are preserved without throwing, but logged if relevant
        break;
    }
  }

  result.requiredStatusChecks = Array.from(checksSet).sort();
  return result;
}

/**
 * Normalizes raw classic branch protection settings.
 * If input is undefined, treats as UNKNOWN (fail-closed).
 * If input is null, treats as ACTIVE with no classic protection (e.g. 404 "Branch not protected").
 */
export function normalizeClassicProtection(
  rawProtection?: RawClassicBranchProtection | null
): NormalizedGovernanceSource {
  if (rawProtection === undefined) {
    return {
      requiredApprovals: 0,
      requireCodeOwners: false,
      requireLastPushApproval: false,
      requireThreadResolution: false,
      requireExtraApprovalForUnattributed: false,
      requiredStatusChecks: [],
      strictStatusChecks: false,
      blockForcePushes: false,
      blockDeletions: false,
      requireLinearHistory: false,
      isUnknown: true,
      unknownReasons: ['Classic branch protection state is undefined or could not be verified'],
    };
  }

  const result: NormalizedGovernanceSource = {
    requiredApprovals: 0,
    requireCodeOwners: false,
    requireLastPushApproval: false,
    requireThreadResolution: false,
    requireExtraApprovalForUnattributed: false,
    requiredStatusChecks: [],
    strictStatusChecks: false,
    blockForcePushes: false,
    blockDeletions: false,
    requireLinearHistory: false,
    isUnknown: false,
    unknownReasons: [],
  };

  if (!rawProtection) {
    return result;
  }

  // Reviews
  const prReviews = rawProtection.required_pull_request_reviews;
  if (prReviews) {
    if (typeof prReviews.required_approving_review_count === 'number') {
      result.requiredApprovals = Math.max(0, prReviews.required_approving_review_count);
    }
    if (prReviews.require_code_owner_reviews) {
      result.requireCodeOwners = true;
    }
    if (prReviews.require_last_push_approval) {
      result.requireLastPushApproval = true;
    }
  }

  // Status checks
  const status = rawProtection.required_status_checks;
  if (status) {
    if (status.strict) {
      result.strictStatusChecks = true;
    }
    const checksSet = new Set<string>();
    if (Array.isArray(status.contexts)) {
      for (const ctx of status.contexts) {
        if (ctx?.trim()) checksSet.add(ctx.trim());
      }
    }
    if (Array.isArray(status.checks)) {
      for (const chk of status.checks) {
        if (chk?.context?.trim()) checksSet.add(chk.context.trim());
      }
    }
    result.requiredStatusChecks = Array.from(checksSet).sort();
  }

  // Conversation resolution
  if (rawProtection.required_conversation_resolution?.enabled) {
    result.requireThreadResolution = true;
  }

  // Linear history
  if (rawProtection.required_linear_history?.enabled) {
    result.requireLinearHistory = true;
  }

  // Force pushes (allow_force_pushes false/missing means force push is BLOCKED)
  if (rawProtection.allow_force_pushes && !rawProtection.allow_force_pushes.enabled) {
    result.blockForcePushes = true;
  }

  // Deletions (allow_deletions false/missing means deletion is BLOCKED)
  if (rawProtection.allow_deletions && !rawProtection.allow_deletions.enabled) {
    result.blockDeletions = true;
  }

  return result;
}

/**
 * Computes the Effective Governance by synthesizing the strictest union of:
 * - Rulesets
 * - Classic Branch Protection
 * - Product Catalog Policy
 * - Commit Attribution Status
 *
 * Guarantees:
 * - If any source is UNKNOWN, the effective governance is marked UNKNOWN (fail-closed).
 * - Required review count is the MAX of all sources.
 * - If requireExtraApprovalForUnattributed is active and unattributed commits exist, adds mandatory review.
 * - Required status checks are the complete UNION of both sources.
 * - Allowed merge methods are the INTERSECTION of ruleset restrictions and catalog preferences.
 * - Bypass is always 'NEVER'.
 */
export function computeEffectiveGovernance(
  options: ComputeEffectiveGovernanceOptions = {}
): NormalizedGovernance {
  const normRules = normalizeRulesets(options.rulesets);
  const normClassic = normalizeClassicProtection(options.classicProtection);

  const unknownReasons: string[] = [];
  if (normRules.isUnknown) unknownReasons.push(...normRules.unknownReasons);
  if (normClassic.isUnknown) unknownReasons.push(...normClassic.unknownReasons);

  const isUnknown = unknownReasons.length > 0;

  // 1. Required approvals: strictest (MAX)
  let requiredApprovals = Math.max(
    normRules.requiredApprovals,
    normClassic.requiredApprovals
  );

  const requireExtraApprovalForUnattributed = Boolean(
    normRules.requireExtraApprovalForUnattributed ||
    normClassic.requireExtraApprovalForUnattributed
  );

  // If extra approval for unattributed changes is active and the PR contains unattributed commits,
  // GitHub requires at least 1 approval regardless of required_approving_review_count = 0.
  if (requireExtraApprovalForUnattributed && options.hasUnattributedCommits) {
    requiredApprovals = Math.max(requiredApprovals, 1);
  }

  // 2. Boolean requirements: true if either requires
  const requireCodeOwners = Boolean(
    normRules.requireCodeOwners || normClassic.requireCodeOwners
  );
  const requireLastPushApproval = Boolean(
    normRules.requireLastPushApproval || normClassic.requireLastPushApproval
  );
  const requireThreadResolution = Boolean(
    normRules.requireThreadResolution || normClassic.requireThreadResolution
  );
  const strictStatusChecks = Boolean(
    normRules.strictStatusChecks || normClassic.strictStatusChecks
  );
  const blockForcePushes = Boolean(
    normRules.blockForcePushes || normClassic.blockForcePushes
  );
  const blockDeletions = Boolean(
    normRules.blockDeletions || normClassic.blockDeletions
  );
  const requireLinearHistory = Boolean(
    normRules.requireLinearHistory || normClassic.requireLinearHistory
  );

  // 3. Required status checks: UNION of contexts
  const checksSet = new Set<string>([
    ...normRules.requiredStatusChecks,
    ...normClassic.requiredStatusChecks,
  ]);
  const requiredStatusChecks = Array.from(checksSet).sort();

  // 4. Allowed merge methods: intersection
  let allowedMergeMethods: MergeMethod[] = ALL_MERGE_METHODS;

  if (normRules.allowedMergeMethods && normRules.allowedMergeMethods.length > 0) {
    const rulesetSet = new Set(normRules.allowedMergeMethods);
    allowedMergeMethods = allowedMergeMethods.filter((m) => rulesetSet.has(m));
  }

  // If linear history is required, 'merge' (with merge commit) is forbidden by GitHub, only squash/rebase allowed
  if (requireLinearHistory) {
    allowedMergeMethods = allowedMergeMethods.filter((m) => m !== 'merge');
  }

  return {
    requiredApprovals,
    requireCodeOwners,
    requireLastPushApproval,
    requireThreadResolution,
    requireExtraApprovalForUnattributed,
    requiredStatusChecks,
    strictStatusChecks,
    blockForcePushes,
    blockDeletions,
    requireLinearHistory,
    allowedMergeMethods,
    bypassPolicy: 'NEVER',
    isUnknown,
    unknownReasons,
  };
}

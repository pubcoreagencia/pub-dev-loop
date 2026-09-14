import { describe, it, expect } from 'vitest';
import {
  computeEffectiveGovernance,
  normalizeRulesets,
  normalizeClassicProtection,
} from '../../../src/pdl/delivery/governance-normalizer.js';
import type {
  RawRulesetRule,
  RawClassicBranchProtection,
} from '../../../src/pdl/delivery/types.js';

describe('Phase 5.6: Governance Normalization & Union Resolution', () => {
  // 1. Neither ruleset nor classic protection
  it('1. handles null rulesets and null classic protection (empty governance)', () => {
    const effective = computeEffectiveGovernance({
      rulesets: null,
      classicProtection: null,
    });

    expect(effective.isUnknown).toBe(false);
    expect(effective.requiredApprovals).toBe(0);
    expect(effective.requireCodeOwners).toBe(false);
    expect(effective.requireLastPushApproval).toBe(false);
    expect(effective.requireThreadResolution).toBe(false);
    expect(effective.requiredStatusChecks).toEqual([]);
    expect(effective.strictStatusChecks).toBe(false);
    expect(effective.blockForcePushes).toBe(false);
    expect(effective.blockDeletions).toBe(false);
    expect(effective.allowedMergeMethods).toEqual(['merge', 'squash', 'rebase']);
    expect(effective.bypassPolicy).toBe('NEVER');
  });

  // 2. Ruleset only
  it('2. normalizes ruleset-only governance accurately', () => {
    const rules: RawRulesetRule[] = [
      {
        type: 'pull_request',
        parameters: {
          required_approving_review_count: 2,
          require_code_owner_review: true,
          require_last_push_approval: true,
          required_review_thread_resolution: true,
          allowed_merge_methods: ['squash'],
        },
      },
      {
        type: 'required_status_checks',
        parameters: {
          strict_required_status_checks_policy: true,
          required_status_checks: [{ context: 'verify' }, { context: 'lint' }],
        },
      },
      { type: 'non_fast_forward' },
      { type: 'deletion' },
    ];

    const effective = computeEffectiveGovernance({
      rulesets: rules,
      classicProtection: null,
    });

    expect(effective.isUnknown).toBe(false);
    expect(effective.requiredApprovals).toBe(2);
    expect(effective.requireCodeOwners).toBe(true);
    expect(effective.requireLastPushApproval).toBe(true);
    expect(effective.requireThreadResolution).toBe(true);
    expect(effective.strictStatusChecks).toBe(true);
    expect(effective.requiredStatusChecks).toEqual(['lint', 'verify']);
    expect(effective.blockForcePushes).toBe(true);
    expect(effective.blockDeletions).toBe(true);
    expect(effective.allowedMergeMethods).toEqual(['squash']);
    expect(effective.bypassPolicy).toBe('NEVER');
  });

  // 3. Classic only
  it('3. normalizes classic-only branch protection accurately', () => {
    const classic: RawClassicBranchProtection = {
      required_pull_request_reviews: {
        required_approving_review_count: 1,
        require_code_owner_reviews: true,
        require_last_push_approval: false,
      },
      required_status_checks: {
        strict: true,
        contexts: ['test-e2e'],
      },
      required_conversation_resolution: { enabled: true },
      allow_force_pushes: { enabled: false },
      allow_deletions: { enabled: false },
    };

    const effective = computeEffectiveGovernance({
      rulesets: null,
      classicProtection: classic,
    });

    expect(effective.isUnknown).toBe(false);
    expect(effective.requiredApprovals).toBe(1);
    expect(effective.requireCodeOwners).toBe(true);
    expect(effective.requireLastPushApproval).toBe(false);
    expect(effective.requireThreadResolution).toBe(true);
    expect(effective.strictStatusChecks).toBe(true);
    expect(effective.requiredStatusChecks).toEqual(['test-e2e']);
    expect(effective.blockForcePushes).toBe(true);
    expect(effective.blockDeletions).toBe(true);
    expect(effective.bypassPolicy).toBe('NEVER');
  });

  // 4. Both matching without conflict
  it('4. unifies both layers when matching cleanly', () => {
    const rules: RawRulesetRule[] = [
      {
        type: 'pull_request',
        parameters: {
          required_approving_review_count: 1,
          required_review_thread_resolution: true,
        },
      },
      {
        type: 'required_status_checks',
        parameters: {
          strict_required_status_checks_policy: true,
          required_status_checks: [{ context: 'verify' }],
        },
      },
    ];

    const classic: RawClassicBranchProtection = {
      required_pull_request_reviews: {
        required_approving_review_count: 1,
      },
      required_status_checks: {
        strict: true,
        contexts: ['verify'],
      },
      required_conversation_resolution: { enabled: true },
    };

    const effective = computeEffectiveGovernance({
      rulesets: rules,
      classicProtection: classic,
    });

    expect(effective.requiredApprovals).toBe(1);
    expect(effective.requireThreadResolution).toBe(true);
    expect(effective.strictStatusChecks).toBe(true);
    expect(effective.requiredStatusChecks).toEqual(['verify']);
  });

  // 5 & 6. Approvals diverging (strictest MAX wins)
  it('6. chooses the strictest (MAX) approval count when diverging', () => {
    const rules: RawRulesetRule[] = [
      {
        type: 'pull_request',
        parameters: { required_approving_review_count: 2 },
      },
    ];

    const classic: RawClassicBranchProtection = {
      required_pull_request_reviews: { required_approving_review_count: 1 },
    };

    const effective = computeEffectiveGovernance({
      rulesets: rules,
      classicProtection: classic,
    });

    expect(effective.requiredApprovals).toBe(2);
  });

  // 7. Status checks diverging (UNION wins)
  it('7. produces the complete UNION of required status check contexts', () => {
    const rules: RawRulesetRule[] = [
      {
        type: 'required_status_checks',
        parameters: {
          required_status_checks: [{ context: 'verify' }, { context: 'security-audit' }],
        },
      },
    ];

    const classic: RawClassicBranchProtection = {
      required_status_checks: {
        contexts: ['verify', 'typecheck'],
      },
    };

    const effective = computeEffectiveGovernance({
      rulesets: rules,
      classicProtection: classic,
    });

    expect(effective.requiredStatusChecks).toEqual(['security-audit', 'typecheck', 'verify']);
  });

  // 8. Strict status checks diverging (if either requires, required)
  it('8. enforces strict status checks if either layer specifies strict', () => {
    const rules: RawRulesetRule[] = [
      {
        type: 'required_status_checks',
        parameters: { strict_required_status_checks_policy: false },
      },
    ];

    const classic: RawClassicBranchProtection = {
      required_status_checks: { strict: true },
    };

    const effective = computeEffectiveGovernance({
      rulesets: rules,
      classicProtection: classic,
    });

    expect(effective.strictStatusChecks).toBe(true);
  });

  // 9. Code owner review diverging (if either requires, required)
  it('9. enforces code owner review if either layer requires it', () => {
    const rules: RawRulesetRule[] = [
      {
        type: 'pull_request',
        parameters: { require_code_owner_review: false },
      },
    ];

    const classic: RawClassicBranchProtection = {
      required_pull_request_reviews: { require_code_owner_reviews: true },
    };

    const effective = computeEffectiveGovernance({
      rulesets: rules,
      classicProtection: classic,
    });

    expect(effective.requireCodeOwners).toBe(true);
  });

  // 10. Last push approval diverging (if either requires, required)
  it('10. enforces last push approval if either layer requires it', () => {
    const rules: RawRulesetRule[] = [
      {
        type: 'pull_request',
        parameters: { require_last_push_approval: true },
      },
    ];

    const classic: RawClassicBranchProtection = {
      required_pull_request_reviews: { require_last_push_approval: false },
    };

    const effective = computeEffectiveGovernance({
      rulesets: rules,
      classicProtection: classic,
    });

    expect(effective.requireLastPushApproval).toBe(true);
  });

  // 11. Thread resolution diverging (if either requires, required)
  it('11. enforces thread resolution if either layer requires it', () => {
    const rules: RawRulesetRule[] = [
      {
        type: 'pull_request',
        parameters: { required_review_thread_resolution: true },
      },
    ];

    const classic: RawClassicBranchProtection = {
      required_conversation_resolution: { enabled: false },
    };

    const effective = computeEffectiveGovernance({
      rulesets: rules,
      classicProtection: classic,
    });

    expect(effective.requireThreadResolution).toBe(true);
  });

  // 12. Merge methods diverging (intersection wins)
  it('12. intersects allowed merge methods when rulesets restrict them', () => {
    const rules: RawRulesetRule[] = [
      {
        type: 'pull_request',
        parameters: { allowed_merge_methods: ['squash', 'rebase'] },
      },
    ];

    const effective = computeEffectiveGovernance({
      rulesets: rules,
      classicProtection: null,
    });

    expect(effective.allowedMergeMethods).toEqual(['squash', 'rebase']);
  });

  // 13. Bypass present in raw data -> PDL policy remains NEVER
  it('13. guarantees bypassPolicy is always NEVER regardless of raw bypass actors', () => {
    const classic: RawClassicBranchProtection = {
      required_pull_request_reviews: {
        bypass_pull_request_allowances: {
          users: ['admin-user'],
          apps: ['admin-bot'],
        },
      },
    };

    const effective = computeEffectiveGovernance({
      rulesets: null,
      classicProtection: classic,
    });

    expect(effective.bypassPolicy).toBe('NEVER');
  });

  // 14. Unknown governance -> fail closed
  it('14. marks governance as isUnknown=true if rulesets or protection is undefined', () => {
    const effectiveWithRulesUnknown = computeEffectiveGovernance({
      rulesets: undefined,
      classicProtection: null,
    });

    expect(effectiveWithRulesUnknown.isUnknown).toBe(true);
    expect(effectiveWithRulesUnknown.unknownReasons.length).toBeGreaterThan(0);

    const effectiveWithClassicUnknown = computeEffectiveGovernance({
      rulesets: null,
      classicProtection: undefined,
    });

    expect(effectiveWithClassicUnknown.isUnknown).toBe(true);
    expect(effectiveWithClassicUnknown.unknownReasons.length).toBeGreaterThan(0);
  });

  // 15. SPECIAL INCIDENT TEST: PR #17 EXACT REPRODUCTION
  describe('Special Test: PR #17 Historical Blocker Reproduction', () => {
    it('accurately reproduces PR #17 blocker when Ruleset=0 and Classic=1', () => {
      // EXACT STATE THAT BLOCKED PR #17:
      // Ruleset was updated to 0 approvals, but Classic Branch Protection was still at 1 approval
      const rulesetPR17: RawRulesetRule[] = [
        {
          type: 'pull_request',
          parameters: {
            required_approving_review_count: 0,
            required_review_thread_resolution: true,
            require_extra_approval_for_unattributed_changes: false,
            allowed_merge_methods: ['merge', 'squash', 'rebase'],
          },
        },
        {
          type: 'required_status_checks',
          parameters: {
            strict_required_status_checks_policy: true,
            required_status_checks: [{ context: 'verify' }],
          },
        },
        { type: 'deletion' },
        { type: 'non_fast_forward' },
      ];

      const classicPR17: RawClassicBranchProtection = {
        required_pull_request_reviews: {
          required_approving_review_count: 1, // THE ROOT CAUSE OF PR #17 BLOCK
          dismiss_stale_reviews: true,
        },
        required_status_checks: {
          strict: true,
          contexts: ['verify'],
        },
        required_conversation_resolution: { enabled: true },
        enforce_admins: { enabled: true },
        allow_force_pushes: { enabled: false },
        allow_deletions: { enabled: false },
      };

      const effective = computeEffectiveGovernance({
        rulesets: rulesetPR17,
        classicProtection: classicPR17,
      });

      // Strictest wins: even though ruleset says 0, classic says 1 -> effective MUST be 1
      expect(effective.requiredApprovals).toBe(1);
      expect(effective.strictStatusChecks).toBe(true);
      expect(effective.requiredStatusChecks).toEqual(['verify']);
      expect(effective.requireThreadResolution).toBe(true);
      expect(effective.blockForcePushes).toBe(true);
      expect(effective.blockDeletions).toBe(true);
    });

    it('resolves to requiredApprovals=0 after Classic is updated to 0 (PR #17 resolution state)', () => {
      // AFTER OUR FIX IN THE SESSION:
      // Both Ruleset and Classic were aligned to 0 approvals
      const rulesetResolved: RawRulesetRule[] = [
        {
          type: 'pull_request',
          parameters: {
            required_approving_review_count: 0,
            required_review_thread_resolution: true,
            require_extra_approval_for_unattributed_changes: false,
          },
        },
        {
          type: 'required_status_checks',
          parameters: {
            strict_required_status_checks_policy: true,
            required_status_checks: [{ context: 'verify' }],
          },
        },
      ];

      const classicResolved: RawClassicBranchProtection = {
        required_pull_request_reviews: {
          required_approving_review_count: 0, // FIXED TO 0
        },
        required_status_checks: {
          strict: true,
          contexts: ['verify'],
        },
        required_conversation_resolution: { enabled: true },
      };

      const effective = computeEffectiveGovernance({
        rulesets: rulesetResolved,
        classicProtection: classicResolved,
      });

      expect(effective.requiredApprovals).toBe(0);
      expect(effective.strictStatusChecks).toBe(true);
      expect(effective.requiredStatusChecks).toEqual(['verify']);
    });

    it('bumps requiredApprovals to 1 if unattributed changes rule is active and unattributed commits exist', () => {
      // Even with 0 approvals configured, if unattributed extra approval rule is on
      // and the commits are from CI <ci@example.com>, GitHub requires 1 human approval
      const rulesetWithUnattributed: RawRulesetRule[] = [
        {
          type: 'pull_request',
          parameters: {
            required_approving_review_count: 0,
            require_extra_approval_for_unattributed_changes: true,
          },
        },
      ];

      const classicZero: RawClassicBranchProtection = {
        required_pull_request_reviews: { required_approving_review_count: 0 },
      };

      const effectiveWithUnattributed = computeEffectiveGovernance({
        rulesets: rulesetWithUnattributed,
        classicProtection: classicZero,
        hasUnattributedCommits: true, // e.g. ci@example.com
      });

      expect(effectiveWithUnattributed.requiredApprovals).toBe(1);

      const effectiveWithoutUnattributed = computeEffectiveGovernance({
        rulesets: rulesetWithUnattributed,
        classicProtection: classicZero,
        hasUnattributedCommits: false, // all commits properly attributed
      });

      expect(effectiveWithoutUnattributed.requiredApprovals).toBe(0);
    });
  });
});

import { describe, it, expect, vi } from 'vitest';
import { GovernanceReader } from '../../../src/pdl/delivery/governance-reader.js';
import {
  GitHubClient,
  GitHubNotFoundError,
  GitHubAuthError,
  GitHubRateLimitError,
  GitHubTransientError,
  GitHubTimeoutError,
} from '../../../src/pdl/delivery/github-client.js';
import type { RawRulesetRule, RawClassicBranchProtection } from '../../../src/pdl/delivery/types.js';

describe('Phase 5.6: GovernanceReader Implementation & Policy Union', () => {
  const defaultInput = {
    owner: 'pubcoreagencia',
    repo: 'pub-rate-calculator',
    branch: 'main',
  };

  const sampleRules: RawRulesetRule[] = [
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

  const sampleClassic: RawClassicBranchProtection = {
    required_pull_request_reviews: {
      required_approving_review_count: 2,
    },
    required_status_checks: {
      strict: false,
      contexts: ['lint', 'security-scan'],
    },
    required_conversation_resolution: {
      enabled: true,
    },
  };

  // 1. ruleset + classic presentes
  it('1. ruleset + classic presentes -> merges both sources into strictest effective governance', async () => {
    const mockClient = {
      getBranchRules: vi.fn().mockResolvedValue(sampleRules),
      getBranchProtection: vi.fn().mockResolvedValue(sampleClassic),
    } as unknown as GitHubClient;

    const reader = new GovernanceReader({ client: mockClient });
    const snapshot = await reader.readGovernance(defaultInput);

    expect(snapshot.source.rulesets).toBe('ACTIVE');
    expect(snapshot.source.classicProtection).toBe('ACTIVE');
    expect(snapshot.effectiveGovernance.isUnknown).toBe(false);
    expect(snapshot.effectiveGovernance.requiredApprovals).toBe(2); // max(1, 2)
    expect(snapshot.effectiveGovernance.strictStatusChecks).toBe(true); // true || false
    expect(snapshot.effectiveGovernance.requiredStatusChecks).toEqual(['lint', 'security-scan', 'verify']);
    expect(snapshot.effectiveGovernance.requireThreadResolution).toBe(true);
    expect(snapshot.rawRulesets).toHaveLength(2);
    expect(snapshot.rawClassicProtection).toBeDefined();
  });

  // 2. somente ruleset
  it('2. somente ruleset -> active ruleset with classicProtection = NONE', async () => {
    const mockClient = {
      getBranchRules: vi.fn().mockResolvedValue(sampleRules),
      getBranchProtection: vi.fn().mockRejectedValue(new GitHubNotFoundError(404, 'Not Found', '/branches/main/protection', {})),
    } as unknown as GitHubClient;

    const reader = new GovernanceReader({ client: mockClient });
    const snapshot = await reader.readGovernance(defaultInput);

    expect(snapshot.source.rulesets).toBe('ACTIVE');
    expect(snapshot.source.classicProtection).toBe('NONE');
    expect(snapshot.effectiveGovernance.isUnknown).toBe(false);
    expect(snapshot.effectiveGovernance.requiredApprovals).toBe(1);
    expect(snapshot.effectiveGovernance.requiredStatusChecks).toEqual(['verify']);
  });

  // 3. somente classic
  it('3. somente classic -> active classic with rulesets = NONE', async () => {
    const mockClient = {
      getBranchRules: vi.fn().mockResolvedValue([]),
      getBranchProtection: vi.fn().mockResolvedValue(sampleClassic),
    } as unknown as GitHubClient;

    const reader = new GovernanceReader({ client: mockClient });
    const snapshot = await reader.readGovernance(defaultInput);

    expect(snapshot.source.rulesets).toBe('NONE');
    expect(snapshot.source.classicProtection).toBe('ACTIVE');
    expect(snapshot.effectiveGovernance.isUnknown).toBe(false);
    expect(snapshot.effectiveGovernance.requiredApprovals).toBe(2);
    expect(snapshot.effectiveGovernance.requiredStatusChecks).toEqual(['lint', 'security-scan']);
  });

  // 4. classic 404
  it('4. classic 404 -> handled as clean absence (NONE) without throwing', async () => {
    const mockClient = {
      getBranchRules: vi.fn().mockResolvedValue([]),
      getBranchProtection: vi.fn().mockRejectedValue(new GitHubNotFoundError(404, 'Branch not protected', '/branches/main/protection', {})),
    } as unknown as GitHubClient;

    const reader = new GovernanceReader({ client: mockClient });
    const snapshot = await reader.readGovernance(defaultInput);

    expect(snapshot.source.classicProtection).toBe('NONE');
    expect(snapshot.rawClassicProtection).toBeNull();
    expect(snapshot.effectiveGovernance.isUnknown).toBe(false);
  });

  // 5. ruleset 404
  it('5. ruleset 404 -> handled as clean absence (NONE) without throwing', async () => {
    const mockClient = {
      getBranchRules: vi.fn().mockRejectedValue(new GitHubNotFoundError(404, 'Not Found', '/rules/branches/main', {})),
      getBranchProtection: vi.fn().mockResolvedValue(sampleClassic),
    } as unknown as GitHubClient;

    const reader = new GovernanceReader({ client: mockClient });
    const snapshot = await reader.readGovernance(defaultInput);

    expect(snapshot.source.rulesets).toBe('NONE');
    expect(snapshot.rawRulesets).toEqual([]);
    expect(snapshot.effectiveGovernance.isUnknown).toBe(false);
  });

  // 6. ruleset 403
  it('6. ruleset 403 -> fail-closed: rulesetSource = UNKNOWN and isUnknown = true', async () => {
    const mockClient = {
      getBranchRules: vi.fn().mockRejectedValue(new GitHubAuthError(403, 'Forbidden', '/rules/branches/main', {})),
      getBranchProtection: vi.fn().mockResolvedValue(sampleClassic),
    } as unknown as GitHubClient;

    const reader = new GovernanceReader({ client: mockClient });
    const snapshot = await reader.readGovernance(defaultInput);

    expect(snapshot.source.rulesets).toBe('UNKNOWN');
    expect(snapshot.effectiveGovernance.isUnknown).toBe(true);
    expect(snapshot.effectiveGovernance.unknownReasons[0]).toContain('Ruleset API error: [GitHub API 403]');
  });

  // 7. classic 403
  it('7. classic 403 -> fail-closed: classicProtectionSource = UNKNOWN and isUnknown = true', async () => {
    const mockClient = {
      getBranchRules: vi.fn().mockResolvedValue(sampleRules),
      getBranchProtection: vi.fn().mockRejectedValue(new GitHubAuthError(403, 'Forbidden', '/branches/main/protection', {})),
    } as unknown as GitHubClient;

    const reader = new GovernanceReader({ client: mockClient });
    const snapshot = await reader.readGovernance(defaultInput);

    expect(snapshot.source.classicProtection).toBe('UNKNOWN');
    expect(snapshot.effectiveGovernance.isUnknown).toBe(true);
    expect(snapshot.effectiveGovernance.unknownReasons[0]).toContain('Classic branch protection API error');
  });

  // 8. 429 retry
  it('8. 429 retry -> retries on rate limit and succeeds when next attempt returns data', async () => {
    const rateLimitError = new GitHubRateLimitError(429, 'Too Many Requests', '/rules/branches/main', {}, Date.now() + 1000);
    const mockGetBranchRules = vi
      .fn()
      .mockRejectedValueOnce(rateLimitError)
      .mockResolvedValueOnce(sampleRules);

    const mockClient = {
      getBranchRules: mockGetBranchRules,
      getBranchProtection: vi.fn().mockResolvedValue(sampleClassic),
    } as unknown as GitHubClient;

    const sleepMock = vi.fn().mockResolvedValue(undefined);

    const reader = new GovernanceReader({
      client: mockClient,
      sleepFn: sleepMock,
    });

    const snapshot = await reader.readGovernance(defaultInput);

    expect(mockGetBranchRules).toHaveBeenCalledTimes(2);
    expect(sleepMock).toHaveBeenCalled();
    expect(snapshot.source.rulesets).toBe('ACTIVE');
    expect(snapshot.effectiveGovernance.isUnknown).toBe(false);
  });

  // 9. 5xx retry
  it('9. 5xx retry -> retries on transient error and succeeds', async () => {
    const transientError = new GitHubTransientError(502, 'Bad Gateway', '/branches/main/protection', {});
    const mockGetProtection = vi
      .fn()
      .mockRejectedValueOnce(transientError)
      .mockResolvedValueOnce(sampleClassic);

    const mockClient = {
      getBranchRules: vi.fn().mockResolvedValue([]),
      getBranchProtection: mockGetProtection,
    } as unknown as GitHubClient;

    const sleepMock = vi.fn().mockResolvedValue(undefined);

    const reader = new GovernanceReader({
      client: mockClient,
      sleepFn: sleepMock,
    });

    const snapshot = await reader.readGovernance(defaultInput);

    expect(mockGetProtection).toHaveBeenCalledTimes(2);
    expect(sleepMock).toHaveBeenCalled();
    expect(snapshot.source.classicProtection).toBe('ACTIVE');
    expect(snapshot.effectiveGovernance.isUnknown).toBe(false);
  });

  // 10. timeout
  it('10. timeout -> fail-closed with isUnknown = true and timeout reason', async () => {
    const mockClient = {
      getBranchRules: vi.fn().mockRejectedValue(new GitHubTimeoutError('/rules/branches/main', 5000)),
      getBranchProtection: vi.fn().mockResolvedValue(sampleClassic),
    } as unknown as GitHubClient;

    const reader = new GovernanceReader({ client: mockClient });
    const snapshot = await reader.readGovernance(defaultInput);

    expect(snapshot.source.rulesets).toBe('UNKNOWN');
    expect(snapshot.effectiveGovernance.isUnknown).toBe(true);
    expect(snapshot.effectiveGovernance.unknownReasons[0]).toContain('Timeout');
  });

  // 11. governance unknown
  it('11. governance unknown -> when both sources fail or are partially illegible, isUnknown is true', async () => {
    const mockClient = {
      getBranchRules: vi.fn().mockResolvedValue('invalid string not array' as any),
      getBranchProtection: vi.fn().mockResolvedValue(['invalid array not object'] as any),
    } as unknown as GitHubClient;

    const reader = new GovernanceReader({ client: mockClient });
    const snapshot = await reader.readGovernance(defaultInput);

    expect(snapshot.source.rulesets).toBe('UNKNOWN');
    expect(snapshot.source.classicProtection).toBe('UNKNOWN');
    expect(snapshot.effectiveGovernance.isUnknown).toBe(true);
    expect(snapshot.effectiveGovernance.unknownReasons.length).toBeGreaterThanOrEqual(2);
  });

  // 12. required checks extraídos corretamente
  it('12. required checks extraídos corretamente -> deduplicated and sorted union', async () => {
    const rules: RawRulesetRule[] = [
      {
        type: 'required_status_checks',
        parameters: {
          required_status_checks: [{ context: 'test:e2e' }, { context: 'verify' }],
        },
      },
    ];
    const classic: RawClassicBranchProtection = {
      required_status_checks: {
        contexts: ['verify', 'build'],
      },
    };

    const mockClient = {
      getBranchRules: vi.fn().mockResolvedValue(rules),
      getBranchProtection: vi.fn().mockResolvedValue(classic),
    } as unknown as GitHubClient;

    const reader = new GovernanceReader({ client: mockClient });
    const snapshot = await reader.readGovernance(defaultInput);

    expect(snapshot.effectiveGovernance.requiredStatusChecks).toEqual(['build', 'test:e2e', 'verify']);
  });

  // 13. strict corretamente extraído
  it('13. strict status checks extraído -> true if either source enforces strict', async () => {
    const rules: RawRulesetRule[] = [
      {
        type: 'required_status_checks',
        parameters: {
          strict_required_status_checks_policy: true,
        },
      },
    ];
    const classic: RawClassicBranchProtection = {
      required_status_checks: {
        strict: false,
      },
    };

    const mockClient = {
      getBranchRules: vi.fn().mockResolvedValue(rules),
      getBranchProtection: vi.fn().mockResolvedValue(classic),
    } as unknown as GitHubClient;

    const reader = new GovernanceReader({ client: mockClient });
    const snapshot = await reader.readGovernance(defaultInput);

    expect(snapshot.effectiveGovernance.strictStatusChecks).toBe(true);
  });

  // 14. approvals corretamente extraídos
  it('14. approvals extraídos -> selects strictest requirement across ruleset and classic', async () => {
    const rules: RawRulesetRule[] = [
      {
        type: 'pull_request',
        parameters: {
          required_approving_review_count: 3,
        },
      },
    ];
    const classic: RawClassicBranchProtection = {
      required_pull_request_reviews: {
        required_approving_review_count: 1,
      },
    };

    const mockClient = {
      getBranchRules: vi.fn().mockResolvedValue(rules),
      getBranchProtection: vi.fn().mockResolvedValue(classic),
    } as unknown as GitHubClient;

    const reader = new GovernanceReader({ client: mockClient });
    const snapshot = await reader.readGovernance(defaultInput);

    expect(snapshot.effectiveGovernance.requiredApprovals).toBe(3);
  });
});

/**
 * Phase 5.6: Governance Reader.
 *
 * Responsibilities:
 * - Fetches effective branch governance directly from GitHub:
 *   1. GitHub Rulesets: GET /repos/{owner}/{repo}/rules/branches/{branch}
 *   2. Classic Branch Protection: GET /repos/{owner}/{repo}/branches/{branch}/protection
 * - Handles 404 cleanly:
 *   - Classic 404 -> Not protected (classicProtection = null, source = 'NONE')
 *   - Ruleset 404 -> No ruleset applied (rawRulesets = [], source = 'NONE')
 * - Resilient error handling:
 *   - 429 (Rate Limit) -> Controlled backoff & retry
 *   - 5xx / Network Errors -> Controlled backoff & retry
 *   - 401 / 403 (Auth/Forbidden) -> Fail closed immediately (source = 'UNKNOWN')
 *   - Timeout -> Fail closed (source = 'UNKNOWN')
 *   - Malformed / Partially illegible payloads -> Fail closed (source = 'UNKNOWN')
 * - Pure governance normalization:
 *   - Feeds raw structures directly into computeEffectiveGovernance()
 *   - Never transforms an error or unknown state into permissive governance
 *   - Produces a comprehensive GovernanceSnapshot for evidence and pre-merge auditing
 * - Deterministic: Injects sleepFn and nowFn for fast, deterministic unit testing
 */

import {
  GitHubClient,
  GitHubNotFoundError,
  GitHubAuthError,
  GitHubRateLimitError,
  GitHubTransientError,
  GitHubTimeoutError,
  GitHubNetworkError,
} from './github-client.js';
import { computeEffectiveGovernance } from './governance-normalizer.js';
import type { ProductManifest } from '../products/catalog.js';
import type {
  RawRulesetRule,
  RawClassicBranchProtection,
  GovernanceSnapshot,
  GovernanceSnapshotSource,
} from './types.js';

export interface GovernanceReaderOptions {
  client: GitHubClient;
  maxRetries?: number;
  retryDelayMs?: number;
  sleepFn?: (ms: number) => Promise<void>;
  nowFn?: () => number;
}

export interface ReadGovernanceInput {
  owner: string;
  repo: string;
  branch: string;
  productPolicy?: ProductManifest | null;
  hasUnattributedCommits?: boolean;
}

export class GovernanceReader {
  private readonly client: GitHubClient;
  private readonly maxRetries: number;
  private readonly retryDelayMs: number;
  private readonly sleepFn: (ms: number) => Promise<void>;
  private readonly nowFn: () => number;

  constructor(options: GovernanceReaderOptions) {
    this.client = options.client;
    this.maxRetries = options.maxRetries ?? 3;
    this.retryDelayMs = options.retryDelayMs ?? 1000;
    this.sleepFn = options.sleepFn ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.nowFn = options.nowFn ?? (() => Date.now());
  }

  private async executeWithRetry<T>(
    operationName: string,
    fn: () => Promise<T>
  ): Promise<{ data?: T; notFound?: boolean; error?: Error }> {
    let attempt = 0;
    while (attempt <= this.maxRetries) {
      try {
        const data = await fn();
        return { data };
      } catch (err: unknown) {
        if (err instanceof GitHubNotFoundError) {
          return { notFound: true, error: err };
        }

        if (err instanceof GitHubAuthError) {
          // Authentication/authorization errors fail closed immediately without retry
          return { error: err };
        }

        if (
          err instanceof GitHubRateLimitError ||
          err instanceof GitHubTransientError ||
          err instanceof GitHubNetworkError
        ) {
          attempt++;
          if (attempt <= this.maxRetries) {
            const delay =
              err instanceof GitHubRateLimitError && err.resetAt
                ? Math.min(Math.max(err.resetAt - this.nowFn(), 1000), 60000)
                : this.retryDelayMs * attempt;
            await this.sleepFn(delay);
            continue;
          }
          return { error: err };
        }

        if (err instanceof GitHubTimeoutError) {
          return { error: err };
        }

        return { error: err as Error };
      }
    }

    return { error: new Error(`${operationName} exceeded maximum retries (${this.maxRetries})`) };
  }

  /**
   * Fetches, normalizes, and snapshots the effective branch governance.
   */
  async readGovernance(input: ReadGovernanceInput): Promise<GovernanceSnapshot> {
    const { owner, repo, branch, productPolicy, hasUnattributedCommits } = input;

    // 1. Fetch Rulesets
    let rawRulesets: RawRulesetRule[] | undefined = undefined;
    let rulesetSource: 'ACTIVE' | 'NONE' | 'UNKNOWN' = 'UNKNOWN';
    const rulesetErrors: string[] = [];

    const rulesResult = await this.executeWithRetry('getBranchRules', () =>
      this.client.getBranchRules(owner, repo, branch)
    );

    if (rulesResult.notFound) {
      // 404: No ruleset applied to this branch
      rawRulesets = [];
      rulesetSource = 'NONE';
    } else if (rulesResult.error) {
      rulesetSource = 'UNKNOWN';
      rawRulesets = undefined;
      rulesetErrors.push(`Ruleset API error: ${rulesResult.error.message}`);
    } else if (Array.isArray(rulesResult.data)) {
      // Validate that each item in the array is a well-formed object with a type string
      const isValid = rulesResult.data.every(
        (r) => r && typeof r === 'object' && typeof (r as RawRulesetRule).type === 'string'
      );
      if (isValid) {
        rawRulesets = rulesResult.data;
        rulesetSource = rawRulesets.length > 0 ? 'ACTIVE' : 'NONE';
      } else {
        rulesetSource = 'UNKNOWN';
        rawRulesets = undefined;
        rulesetErrors.push('Ruleset API returned malformed or partially illegible rules payload');
      }
    } else {
      rulesetSource = 'UNKNOWN';
      rawRulesets = undefined;
      rulesetErrors.push('Ruleset API response was not an array');
    }

    // 2. Fetch Classic Branch Protection
    let rawClassicProtection: RawClassicBranchProtection | null | undefined = undefined;
    let classicProtectionSource: 'ACTIVE' | 'NONE' | 'UNKNOWN' = 'UNKNOWN';
    const classicErrors: string[] = [];

    const classicResult = await this.executeWithRetry('getBranchProtection', () =>
      this.client.getBranchProtection(owner, repo, branch)
    );

    if (classicResult.notFound) {
      // 404: Branch is not protected under classic protection
      rawClassicProtection = null;
      classicProtectionSource = 'NONE';
    } else if (classicResult.error) {
      classicProtectionSource = 'UNKNOWN';
      rawClassicProtection = undefined;
      classicErrors.push(`Classic branch protection API error: ${classicResult.error.message}`);
    } else if (classicResult.data && typeof classicResult.data === 'object' && !Array.isArray(classicResult.data)) {
      rawClassicProtection = classicResult.data;
      classicProtectionSource = 'ACTIVE';
    } else {
      classicProtectionSource = 'UNKNOWN';
      rawClassicProtection = undefined;
      classicErrors.push('Classic branch protection API returned malformed or partially illegible payload');
    }

    // 3. Compute Effective Governance via Pure Normalization Engine
    const effectiveGovernance = computeEffectiveGovernance({
      rulesets: rawRulesets,
      classicProtection: rawClassicProtection,
      productPolicy,
      hasUnattributedCommits,
    });

    // If there were explicit API or parsing errors, guarantee fail-closed UNKNOWN
    const specificErrors = [...rulesetErrors, ...classicErrors];
    if (specificErrors.length > 0) {
      effectiveGovernance.isUnknown = true;
      // Filter out generic undefined messages if we have specific API errors
      const filteredExisting = effectiveGovernance.unknownReasons.filter(
        (r) => !r.includes('is undefined or could not be verified')
      );
      effectiveGovernance.unknownReasons = [...specificErrors, ...filteredExisting];
    }

    const observedAt = new Date(this.nowFn()).toISOString();
    const source: GovernanceSnapshotSource = {
      rulesets: rulesetSource,
      classicProtection: classicProtectionSource,
    };

    return {
      repository: `${owner}/${repo}`,
      targetBranch: branch,
      source,
      effectiveGovernance,
      observedAt,
      rawRulesets: rawRulesets ?? null,
      rawClassicProtection: rawClassicProtection ?? null,
      // Backwards compatibility aliases
      normalized: effectiveGovernance,
      rulesetSource,
      classicProtectionSource,
      evaluatedAt: observedAt,
    };
  }
}

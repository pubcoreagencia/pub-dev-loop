/**
 * Phase 5.6: Merge Mutation Reconciler.
 *
 * Responsibilities:
 * - Deterministically discovers the true remote state after an ambiguous merge response
 *   (timeout, network error, 5xx).
 * - NEVER performs a blind retry (never sends a second PUT merge request).
 * - Queries GET /repos/{owner}/{repo}/pulls/{number} to inspect canonical PR state.
 * - Categorizes the actual remote outcome:
 *   - MERGED_CONFIRMED: PR is confirmed merged with expectedHeadSha.
 *   - MERGE_UNCONFIRMED: PR remains OPEN with same headSha (mutation did not land).
 *   - CLOSED_UNMERGED: PR was closed without being merged.
 *   - UNKNOWN: PR state is divergent, ambiguous, or query failed fail-closed.
 */

import { GitHubClient } from './github-client.js';
import type { MergeReconciliationResult } from './types.js';

export interface MergeReconcilerOptions {
  client: GitHubClient;
  nowFn?: () => number;
}

export interface ReconcileMergeInput {
  owner: string;
  repo: string;
  pullNumber: number;
  expectedHeadSha: string;
}

export class MergeReconciler {
  private readonly client: GitHubClient;
  private readonly nowFn: () => number;

  constructor(options: MergeReconcilerOptions) {
    this.client = options.client;
    this.nowFn = options.nowFn ?? (() => Date.now());
  }

  /**
   * Reconciles the true state of a pull request after an ambiguous merge mutation.
   * Zero mutations, fail-closed.
   */
  async reconcile(input: ReconcileMergeInput): Promise<MergeReconciliationResult> {
    const { owner, repo, pullNumber, expectedHeadSha } = input;
    const observedAt = new Date(this.nowFn()).toISOString();

    try {
      const pr = await this.client.getPullRequest(owner, repo, pullNumber);

      const isMerged = Boolean(pr.merged === true || pr.merged_at);

      // Case 1: PR is merged
      if (isMerged) {
        if (pr.head.sha === expectedHeadSha) {
          return {
            decision: 'MERGED_CONFIRMED',
            isMerged: true,
            mergeCommitSha: pr.merge_commit_sha || null,
            prState: 'MERGED',
            reasons: [
              `Reconciliation confirmed: PR #${pullNumber} was successfully merged with head SHA '${expectedHeadSha}'`,
            ],
            observedAt,
          };
        }

        // Merged with divergent SHA
        return {
          decision: 'UNKNOWN',
          isMerged: true,
          mergeCommitSha: pr.merge_commit_sha || null,
          prState: 'MERGED',
          reasons: [
            `PR #${pullNumber} is merged but with divergent head SHA (expected '${expectedHeadSha}', found '${pr.head.sha}')`,
          ],
          observedAt,
        };
      }

      // Case 2: PR remains OPEN
      if (pr.state === 'open') {
        return {
          decision: 'MERGE_UNCONFIRMED',
          isMerged: false,
          mergeCommitSha: null,
          prState: 'OPEN',
          reasons: [
            `Reconciliation observed PR #${pullNumber} is still OPEN with head SHA '${pr.head.sha}'. Merge did not land.`,
          ],
          observedAt,
        };
      }

      // Case 3: PR is CLOSED without merge
      if (pr.state === 'closed') {
        return {
          decision: 'CLOSED_UNMERGED',
          isMerged: false,
          mergeCommitSha: null,
          prState: 'CLOSED',
          reasons: [
            `Reconciliation observed PR #${pullNumber} is CLOSED without being merged.`,
          ],
          observedAt,
        };
      }

      // Fallback
      return {
        decision: 'UNKNOWN',
        isMerged: false,
        mergeCommitSha: null,
        prState: 'UNKNOWN',
        reasons: [`Reconciliation found indeterminate PR state '${pr.state}'`],
        observedAt,
      };
    } catch (err: unknown) {
      return {
        decision: 'UNKNOWN',
        isMerged: false,
        mergeCommitSha: null,
        prState: 'UNKNOWN',
        reasons: [`Reconciliation query failed: ${(err as Error).message}`],
        observedAt,
      };
    }
  }
}

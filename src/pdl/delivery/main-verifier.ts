/**
 * Phase 5.6: Post-Merge Main Branch Verifier.
 *
 * Responsibilities:
 * - After a confirmed PR merge, verifies that the canonical default branch (e.g. main)
 *   has authoritatively advanced on GitHub.
 * - Compares previousMainSha with currentMainSha directly from GitHub branch metadata.
 * - Invariant: currentMainSha MUST be different from previousMainSha.
 * - Does not presume currentMainSha === mergeCommitSha (rebase and squash semantics may differ).
 * - Produces audit-ready MainVerificationResult.
 */

import { GitHubClient } from './github-client.js';
import type { MainVerificationResult } from './types.js';

export interface MainVerifierOptions {
  client: GitHubClient;
  nowFn?: () => number;
}

export interface VerifyMainInput {
  owner: string;
  repo: string;
  branch: string;
  previousMainSha: string;
  mergeCommitSha?: string | null;
}

export class MainVerifier {
  private readonly client: GitHubClient;
  private readonly nowFn: () => number;

  constructor(options: MainVerifierOptions) {
    this.client = options.client;
    this.nowFn = options.nowFn ?? (() => Date.now());
  }

  /**
   * Verifies that the target branch has advanced following a merge.
   */
  async verifyMain(input: VerifyMainInput): Promise<MainVerificationResult> {
    const { owner, repo, branch, previousMainSha, mergeCommitSha } = input;
    const verifiedAt = new Date(this.nowFn()).toISOString();

    try {
      const branchInfo = await this.client.getBranch(owner, repo, branch);
      const currentMainSha = branchInfo?.commit?.sha;

      if (!currentMainSha) {
        return {
          status: 'BLOCKED',
          mainAdvanced: false,
          previousMainSha,
          currentMainSha: null,
          mergeCommitSha,
          verifiedAt,
          reasons: [`Target branch '${branch}' response did not contain a commit SHA`],
        };
      }

      // Check if branch advanced
      if (currentMainSha === previousMainSha) {
        return {
          status: 'NOT_VERIFIED',
          mainAdvanced: false,
          previousMainSha,
          currentMainSha,
          mergeCommitSha,
          verifiedAt,
          reasons: [
            `Target branch '${branch}' did not advance (SHA remains unchanged at '${previousMainSha}')`,
          ],
        };
      }

      // Main successfully advanced
      return {
        status: 'MAIN_VERIFIED',
        mainAdvanced: true,
        previousMainSha,
        currentMainSha,
        mergeCommitSha,
        verifiedAt,
        reasons: [],
      };
    } catch (err: unknown) {
      return {
        status: 'BLOCKED',
        mainAdvanced: false,
        previousMainSha,
        currentMainSha: null,
        mergeCommitSha,
        verifiedAt,
        reasons: [`Failed to query branch '${branch}': ${(err as Error).message}`],
      };
    }
  }
}

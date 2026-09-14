/**
 * Phase 5.6: Idempotent Pull Request Lifecycle Manager.
 *
 * Responsibilities:
 * - Manages the lifecycle of a Pull Request for an autonomous delivery task.
 * - Guarantees strict idempotency: Reuses existing PRs when head SHA matches.
 * - Protects against SHA divergence: Blocks immediately if open PR points to a different commit.
 * - Protects against rejected PR loops: Blocks if a previous PR for the branch was closed unmerged.
 * - Protects against ambiguity: Blocks if multiple open PRs exist (never closes PRs automatically).
 * - TOCTOU protection: Carries and validates expectedHeadSha across all operations.
 */

import { GitHubClient, GitHubApiError } from './github-client.js';
import type {
  GitHubPullRequest,
  GitHubReview,
  PullRequestSnapshot,
  PrLifecycleInput,
  PrLifecycleResult,
} from './types.js';

export function toPullRequestSnapshot(
  pr: GitHubPullRequest,
  reviews: GitHubReview[] = []
): PullRequestSnapshot {
  const approvals = reviews.filter((r) => r.state === 'APPROVED');
  const changesRequested = reviews.filter((r) => r.state === 'CHANGES_REQUESTED');

  let reviewDecision: 'APPROVED' | 'CHANGES_REQUESTED' | 'REVIEW_REQUIRED' | null = null;
  if (changesRequested.length > 0) {
    reviewDecision = 'CHANGES_REQUESTED';
  } else if (approvals.length > 0) {
    reviewDecision = 'APPROVED';
  }

  return {
    number: pr.number,
    url: pr.html_url,
    state: pr.state === 'open' ? 'OPEN' : (pr.merged ? 'MERGED' : 'CLOSED'),
    draft: Boolean(pr.draft),
    mergeable: pr.mergeable,
    mergeStateStatus: pr.mergeable_state ? pr.mergeable_state.toUpperCase() : null,
    headSha: pr.head.sha,
    baseSha: pr.base.sha,
    headRef: pr.head.ref,
    baseRef: pr.base.ref,
    approvalsCount: approvals.length,
    allThreadsResolved: true,
    hasUnattributedCommits: false,
    reviewDecision,
  };
}

export class PrLifecycleManager {
  constructor(private readonly client: GitHubClient) {}

  /**
   * Evaluates or creates the Pull Request for the specified delivery input with full idempotency.
   */
  async ensurePullRequest(input: PrLifecycleInput): Promise<PrLifecycleResult> {
    const { owner, repo, base, head, expectedHeadSha, title, body, draft } = input;

    let prs: GitHubPullRequest[];
    try {
      // GitHub API accepts head filter as "owner:branch" or "branch"
      prs = await this.client.getPullRequests(owner, repo, {
        head: `${owner}:${head}`,
        base,
        state: 'all',
      });
      // Fallback: if search by "owner:branch" returns empty, query by branch directly
      if (prs.length === 0) {
        prs = await this.client.getPullRequests(owner, repo, {
          head,
          base,
          state: 'all',
        });
      }
    } catch (err: unknown) {
      return {
        decision: 'BLOCKED_API_ERROR',
        blocked: true,
        pr: null,
        reasons: [`GitHub API error while querying pull requests: ${(err as Error).message}`],
      };
    }

    const openPrs = prs.filter((p) => p.state === 'open');
    const closedPrs = prs.filter((p) => p.state === 'closed');

    // Case F: More than 1 candidate open PR found -> BLOCK (fail-closed, never close automatically)
    if (openPrs.length > 1) {
      const prList = openPrs.map((p) => `#${p.number}`).join(', ');
      return {
        decision: 'BLOCKED_AMBIGUOUS_MULTIPLE_PRS',
        blocked: true,
        pr: null,
        reasons: [
          `Multiple candidate open pull requests found for head branch '${head}' (${openPrs.length} PRs: ${prList}). Fail-closed: AMBIGUOUS_MULTIPLE_PRS_DETECTED. Never automatically close PRs.`,
        ],
      };
    }

    // Case B or C: Exactly 1 open candidate PR
    if (openPrs.length === 1) {
      const openPrCandidate = openPrs[0];

      // Fetch fresh full PR details and reviews
      let fullPr: GitHubPullRequest;
      let reviews: GitHubReview[] = [];
      try {
        fullPr = await this.client.getPullRequest(owner, repo, openPrCandidate.number);
        reviews = await this.client.getPullRequestReviews(owner, repo, openPrCandidate.number);
      } catch (err: unknown) {
        return {
          decision: 'BLOCKED_API_ERROR',
          blocked: true,
          pr: null,
          reasons: [`GitHub API error fetching open PR #${openPrCandidate.number}: ${(err as Error).message}`],
        };
      }

      // Case B: Same head branch AND same head SHA -> Reusable!
      if (fullPr.head.sha === expectedHeadSha) {
        return {
          decision: 'PR_REUSED',
          blocked: false,
          pr: toPullRequestSnapshot(fullPr, reviews),
          reasons: [],
        };
      }

      // Case C: Same head branch but DIFFERENT SHA -> BLOCK (PR_HEAD_SHA_DIVERGENCE)
      return {
        decision: 'BLOCKED_SHA_DIVERGENCE',
        blocked: true,
        pr: toPullRequestSnapshot(fullPr, reviews),
        reasons: [
          `Pull Request #${fullPr.number} on branch '${head}' has divergent head SHA (expected '${expectedHeadSha}', found '${fullPr.head.sha}'). Fail-closed: PR_HEAD_SHA_DIVERGENCE. Do not update, push, or close.`,
        ],
      };
    }

    // When 0 open PRs exist, inspect historical closed PRs for this branch
    if (closedPrs.length > 0) {
      // Case E: Was any closed PR already merged containing the expected commit?
      const alreadyMergedPr = closedPrs.find(
        (p) => p.merged === true && p.head.sha === expectedHeadSha
      );
      if (alreadyMergedPr) {
        return {
          decision: 'PR_ALREADY_MERGED',
          blocked: false,
          alreadyDelivered: true,
          pr: toPullRequestSnapshot(alreadyMergedPr),
          reasons: [
            `Pull Request #${alreadyMergedPr.number} was already merged containing expected commit '${expectedHeadSha}'`,
          ],
        };
      }

      // Case D: A previous PR was closed without merging -> BLOCK (PR_PREVIOUSLY_REJECTED)
      const rejectedPr = closedPrs.find((p) => p.merged !== true);
      if (rejectedPr) {
        return {
          decision: 'BLOCKED_PREVIOUSLY_REJECTED',
          blocked: true,
          pr: toPullRequestSnapshot(rejectedPr),
          reasons: [
            `Previous Pull Request #${rejectedPr.number} on branch '${head}' was closed without merging. Fail-closed: PR_PREVIOUSLY_REJECTED. Manual review required.`,
          ],
        };
      }
    }

    // Case A: 0 open PRs and no conflicting/blocking closed PR -> Create clean PR
    try {
      const createdPr = await this.client.createPullRequest(owner, repo, {
        title,
        body,
        head,
        base,
        draft: Boolean(draft),
      });

      // Verify created PR head SHA matches expectedHeadSha
      if (createdPr.head.sha !== expectedHeadSha) {
        return {
          decision: 'BLOCKED_SHA_DIVERGENCE',
          blocked: true,
          pr: toPullRequestSnapshot(createdPr),
          reasons: [
            `Newly created Pull Request #${createdPr.number} has unexpected head SHA (expected '${expectedHeadSha}', found '${createdPr.head.sha}')`,
          ],
        };
      }

      return {
        decision: 'PR_CREATED',
        blocked: false,
        pr: toPullRequestSnapshot(createdPr),
        reasons: [],
      };
    } catch (err: unknown) {
      return {
        decision: 'BLOCKED_API_ERROR',
        blocked: true,
        pr: null,
        reasons: [`Failed to create Pull Request: ${(err as Error).message}`],
      };
    }
  }
}

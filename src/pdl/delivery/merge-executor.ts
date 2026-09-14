/**
 * Phase 5.6: Governed Pull Request Merge Executor.
 *
 * Responsibilities:
 * - Executes the final delivery mutation (PUT /repos/{owner}/{repo}/pulls/{number}/merge)
 *   ONLY when strict authorization and fresh revalidation invariants are satisfied.
 * - Zero Policy Invention: Does not evaluate governance or CI independently; requires an
 *   authoritative MergeAuthorization (decision === 'ALLOW').
 * - Pre-Merge Revalidation: Runs an immediate fresh revalidation check immediately prior to PUT.
 *   If remote state drifted (TOCTOU), aborts immediately without sending the merge mutation.
 * - Strict SHA Binding: Mandatory inclusion of expectedHeadSha in the PUT payload.
 *   GitHub will reject the merge with 409 Conflict if head SHA has diverged.
 * - Fail-Closed HTTP Classification:
 *   - 200 (merged=true): MERGED
 *   - 200 (merged=false): UNKNOWN
 *   - 403: FORBIDDEN
 *   - 404: BLOCKED
 *   - 405: METHOD_NOT_ALLOWED
 *   - 409: CONFLICT
 *   - 422: VALIDATION_FAILED
 *   - 5xx, Network Error, Timeout: Delegated to MergeReconciler (NO BLIND RETRY).
 * - Bypass Policy: Strictly NEVER. No force, admin, or bypass flags exist.
 */

import {
  GitHubClient,
  GitHubAuthError,
  GitHubNotFoundError,
  GitHubConflictError,
  GitHubMethodNotAllowedError,
  GitHubValidationFailedError,
  GitHubTransientError,
  GitHubTimeoutError,
  GitHubNetworkError,
  GitHubApiError,
} from './github-client.js';
import { MergeReconciler } from './merge-reconciler.js';
import { PreMergeRevalidator } from './pre-merge-revalidation.js';
import type { ProductManifest } from '../products/catalog.js';
import type {
  MergeMethod,
  MergeAuthorization,
  MergeExecutionResult,
  MergePullRequestPayload,
} from './types.js';

export interface MergeExecutorOptions {
  client: GitHubClient;
  reconciler?: MergeReconciler;
  preMergeRevalidator?: PreMergeRevalidator;
  nowFn?: () => number;
}

export interface ExecuteMergeInput {
  owner: string;
  repo: string;
  pullRequestNumber: number;
  expectedHeadSha: string;
  expectedBaseBranch: string;
  requestedMergeMethod: MergeMethod;
  authorization: MergeAuthorization;
  product: ProductManifest;
  commitTitle?: string;
  commitMessage?: string;
  skipImmediateRevalidation?: boolean;
}

export class MergeExecutor {
  private readonly client: GitHubClient;
  private readonly reconciler: MergeReconciler;
  private readonly preMergeRevalidator?: PreMergeRevalidator;
  private readonly nowFn: () => number;

  constructor(options: MergeExecutorOptions) {
    this.client = options.client;
    this.reconciler = options.reconciler ?? new MergeReconciler({ client: options.client, nowFn: options.nowFn });
    this.preMergeRevalidator = options.preMergeRevalidator;
    this.nowFn = options.nowFn ?? (() => Date.now());
  }

  /**
   * Executes pull request merge following authorization and fresh revalidation.
   */
  async executeMerge(input: ExecuteMergeInput): Promise<MergeExecutionResult> {
    const {
      owner,
      repo,
      pullRequestNumber,
      expectedHeadSha,
      expectedBaseBranch,
      requestedMergeMethod,
      authorization,
      product,
      commitTitle,
      commitMessage,
      skipImmediateRevalidation,
    } = input;

    const observedAt = new Date(this.nowFn()).toISOString();

    // ------------------------------------------------------------------------
    // Step 1: Mandatory Precondition Check — Authorization Decision
    // ------------------------------------------------------------------------
    if (authorization.decision !== 'ALLOW' || authorization.authorized !== true) {
      return {
        status: 'BLOCKED',
        pullRequestNumber,
        expectedHeadSha,
        returnedMergeSha: null,
        message: 'Merge rejected: authorization decision is not ALLOW',
        httpStatus: undefined,
        observedAt,
        reasons: authorization.reasons.length > 0
          ? authorization.reasons
          : ['Authorization decision is not ALLOW'],
      };
    }

    // ------------------------------------------------------------------------
    // Step 2: Target Branch & Merge Method Compliance Check
    // ------------------------------------------------------------------------
    if (expectedBaseBranch !== product.defaultBranch) {
      return {
        status: 'BLOCKED',
        pullRequestNumber,
        expectedHeadSha,
        returnedMergeSha: null,
        message: `Target branch '${expectedBaseBranch}' does not match product default branch '${product.defaultBranch}'`,
        observedAt,
        reasons: [`Target branch '${expectedBaseBranch}' is forbidden by product catalog`],
      };
    }

    // ------------------------------------------------------------------------
    // Step 3: Immediate Fresh Pre-Merge Revalidation
    // ------------------------------------------------------------------------
    if (this.preMergeRevalidator && !skipImmediateRevalidation) {
      const revalResult = await this.preMergeRevalidator.revalidate({
        owner,
        repo,
        pullNumber: pullRequestNumber,
        expectedHeadSha,
        expectedBaseBranch,
        product,
        requestedMergeMethod,
      });

      if (revalResult.decision !== 'ALLOW' || !revalResult.authorized) {
        return {
          status: 'BLOCKED',
          pullRequestNumber,
          expectedHeadSha,
          returnedMergeSha: null,
          message: 'Merge blocked by immediate pre-merge revalidation',
          observedAt,
          reasons: revalResult.reasons,
        };
      }
    }

    // ------------------------------------------------------------------------
    // Step 4: Execute Merge Mutation (PUT /repos/{owner}/{repo}/pulls/{n}/merge)
    // ------------------------------------------------------------------------
    const payload: MergePullRequestPayload = {
      sha: expectedHeadSha, // Strict SHA binding (TOCTOU protection)
      merge_method: requestedMergeMethod,
      commit_title: commitTitle,
      commit_message: commitMessage,
    };

    try {
      const response = await this.client.mergePullRequest(
        owner,
        repo,
        pullRequestNumber,
        payload
      );

      if (response && response.merged === true) {
        return {
          status: 'MERGED',
          pullRequestNumber,
          expectedHeadSha,
          returnedMergeSha: response.sha ?? null,
          message: response.message || 'Pull Request successfully merged',
          httpStatus: 200,
          observedAt,
          reasons: [],
        };
      }

      // GitHub returned 200 OK but merged is not true
      return {
        status: 'UNKNOWN',
        pullRequestNumber,
        expectedHeadSha,
        returnedMergeSha: null,
        message: 'GitHub returned 200 OK but response.merged is false',
        httpStatus: 200,
        observedAt,
        reasons: ['GitHub PR merge API response indicated merged=false'],
      };
    } catch (err: unknown) {
      // ----------------------------------------------------------------------
      // Step 5: Fail-Closed HTTP Error Classification
      // ----------------------------------------------------------------------
      if (err instanceof GitHubAuthError) {
        return {
          status: 'FORBIDDEN',
          pullRequestNumber,
          expectedHeadSha,
          returnedMergeSha: null,
          message: `Merge forbidden: ${(err as Error).message}`,
          httpStatus: err.status,
          observedAt,
          reasons: [(err as Error).message],
        };
      }

      if (err instanceof GitHubNotFoundError) {
        return {
          status: 'BLOCKED',
          pullRequestNumber,
          expectedHeadSha,
          returnedMergeSha: null,
          message: `Pull Request #${pullRequestNumber} not found: ${(err as Error).message}`,
          httpStatus: 404,
          observedAt,
          reasons: [(err as Error).message],
        };
      }

      if (err instanceof GitHubMethodNotAllowedError) {
        return {
          status: 'METHOD_NOT_ALLOWED',
          pullRequestNumber,
          expectedHeadSha,
          returnedMergeSha: null,
          message: `Merge method '${requestedMergeMethod}' not allowed: ${(err as Error).message}`,
          httpStatus: 405,
          observedAt,
          reasons: [(err as Error).message],
        };
      }

      if (err instanceof GitHubConflictError) {
        return {
          status: 'CONFLICT',
          pullRequestNumber,
          expectedHeadSha,
          returnedMergeSha: null,
          message: `Conflict on merge: ${(err as Error).message}`,
          httpStatus: 409,
          observedAt,
          reasons: [
            `Merge conflict or head SHA divergence (HTTP 409): ${(err as Error).message}`,
          ],
        };
      }

      if (err instanceof GitHubValidationFailedError) {
        return {
          status: 'VALIDATION_FAILED',
          pullRequestNumber,
          expectedHeadSha,
          returnedMergeSha: null,
          message: `Validation failed on merge: ${(err as Error).message}`,
          httpStatus: 422,
          observedAt,
          reasons: [(err as Error).message],
        };
      }

      // ----------------------------------------------------------------------
      // Step 6: Ambiguous Failures (Timeout, Network, 5xx) -> Reconciliation
      // Never perform blind retry!
      // ----------------------------------------------------------------------
      if (
        err instanceof GitHubTimeoutError ||
        err instanceof GitHubNetworkError ||
        err instanceof GitHubTransientError
      ) {
        const reconcileRes = await this.reconciler.reconcile({
          owner,
          repo,
          pullNumber: pullRequestNumber,
          expectedHeadSha,
        });

        if (reconcileRes.decision === 'MERGED_CONFIRMED' && reconcileRes.isMerged) {
          return {
            status: 'ALREADY_MERGED',
            pullRequestNumber,
            expectedHeadSha,
            returnedMergeSha: reconcileRes.mergeCommitSha,
            message: 'Merge mutation timed out or encountered network error, but reconciliation confirmed PR was merged',
            httpStatus: (err as GitHubApiError).status || undefined,
            observedAt,
            reasons: reconcileRes.reasons,
          };
        }

        if (reconcileRes.decision === 'MERGE_UNCONFIRMED') {
          return {
            status: 'UNKNOWN',
            pullRequestNumber,
            expectedHeadSha,
            returnedMergeSha: null,
            message: 'Merge mutation failed and PR remains open. Merge did not land.',
            httpStatus: (err as GitHubApiError).status || undefined,
            observedAt,
            reasons: [
              `Merge mutation failure (${(err as Error).message}). Reconciliation confirmed PR is still OPEN.`,
            ],
          };
        }

        if (reconcileRes.decision === 'CLOSED_UNMERGED') {
          return {
            status: 'BLOCKED',
            pullRequestNumber,
            expectedHeadSha,
            returnedMergeSha: null,
            message: 'PR was closed without being merged',
            httpStatus: (err as GitHubApiError).status || undefined,
            observedAt,
            reasons: reconcileRes.reasons,
          };
        }

        return {
          status: 'UNKNOWN',
          pullRequestNumber,
          expectedHeadSha,
          returnedMergeSha: null,
          message: `Ambiguous merge outcome: ${(err as Error).message}`,
          httpStatus: (err as GitHubApiError).status || undefined,
          observedAt,
          reasons: [
            `Ambiguous mutation error: ${(err as Error).message}`,
            ...reconcileRes.reasons,
          ],
        };
      }

      // Any unexpected error fails closed as UNKNOWN
      return {
        status: 'UNKNOWN',
        pullRequestNumber,
        expectedHeadSha,
        returnedMergeSha: null,
        message: `Unexpected merge execution error: ${(err as Error).message}`,
        observedAt,
        reasons: [(err as Error).message],
      };
    }
  }
}

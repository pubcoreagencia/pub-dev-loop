/**
 * Phase 5.6: Remote CI Observer.
 *
 * Responsibilities:
 * - Deterministically monitors and polls the remote CI status for a specific commit SHA.
 * - Enforces governance checks: Evaluates ONLY the status checks explicitly required
 *   by effective governance. Non-required failing checks do not block if all required checks pass.
 * - Primary source of truth: GitHub Check Runs API (Actions). Fallback: Legacy Commit Statuses API.
 * - Handles rate limits (429) and transient errors (5xx/network) with bounded backoff.
 * - Strict fail-closed: Missing checks, contradictory statuses, unknown conclusions, or timeouts
 *   are NEVER converted into success.
 * - 100% Deterministic: Supports injected sleepFn and nowFn for fast, offline unit testing.
 */

import {
  GitHubClient,
  GitHubRateLimitError,
  GitHubTransientError,
  GitHubNetworkError,
  GitHubTimeoutError,
} from './github-client.js';
import type {
  CiObservation,
  CiObservationInput,
  CiObservationResult,
  CiStatus,
  GitHubCheckRun,
  GitHubCommitStatusItem,
} from './types.js';

export interface RemoteCiObserverOptions {
  client: GitHubClient;
  pollIntervalMs?: number;
  maxWaitMs?: number;
  gracePeriodMs?: number;
  maxConsecutiveErrors?: number;
  sleepFn?: (ms: number) => Promise<void>;
  nowFn?: () => number;
}

export class RemoteCiObserver {
  private readonly client: GitHubClient;
  private readonly pollIntervalMs: number;
  private readonly maxWaitMs: number;
  private readonly gracePeriodMs: number;
  private readonly maxConsecutiveErrors: number;
  private readonly sleepFn: (ms: number) => Promise<void>;
  private readonly nowFn: () => number;

  constructor(options: RemoteCiObserverOptions) {
    this.client = options.client;
    this.pollIntervalMs = options.pollIntervalMs ?? 15000;
    this.maxWaitMs = options.maxWaitMs ?? 900000; // 15 minutes default
    this.gracePeriodMs = options.gracePeriodMs ?? 60000; // 60s for GitHub Actions to register
    this.maxConsecutiveErrors = options.maxConsecutiveErrors ?? 3;
    this.sleepFn = options.sleepFn ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.nowFn = options.nowFn ?? (() => Date.now());
  }

  /**
   * Observes the remote CI status for a specific commit SHA until completion, failure, or timeout.
   */
  async observe(input: CiObservationInput): Promise<CiObservationResult> {
    const { owner, repo, headSha, requiredChecks, onProgress } = input;
    const pollInterval = input.pollIntervalMs ?? this.pollIntervalMs;
    const maxWait = input.maxWaitMs ?? this.maxWaitMs;
    const gracePeriod = input.gracePeriodMs ?? this.gracePeriodMs;

    const startTime = this.nowFn();
    let consecutiveErrors = 0;

    let latestObservation: CiObservation = {
      status: 'PENDING',
      completedSuccessfulChecks: [],
      failedChecks: [],
      pendingChecks: [],
      totalChecksCount: 0,
      observedAt: new Date(startTime).toISOString(),
    };

    while (this.nowFn() - startTime <= maxWait) {
      const iterationNow = this.nowFn();
      const elapsed = iterationNow - startTime;

      let checkRuns: GitHubCheckRun[] = [];
      let commitStatuses: GitHubCommitStatusItem[] = [];

      try {
        const checkRunsResponse = await this.client.getCheckRuns(owner, repo, headSha);
        checkRuns = checkRunsResponse.check_runs || [];
        consecutiveErrors = 0;
      } catch (err: unknown) {
        if (err instanceof GitHubRateLimitError) {
          const waitTime = err.resetAt ? Math.max(1000, err.resetAt - this.nowFn()) : pollInterval * 2;
          await this.sleepFn(Math.min(waitTime, 60000));
          continue;
        }

        if (
          err instanceof GitHubTransientError ||
          err instanceof GitHubNetworkError ||
          err instanceof GitHubTimeoutError
        ) {
          consecutiveErrors++;
          if (consecutiveErrors > this.maxConsecutiveErrors) {
            return {
              status: 'UNKNOWN',
              observation: {
                ...latestObservation,
                status: 'UNKNOWN',
                observedAt: new Date(iterationNow).toISOString(),
              },
              blocked: true,
              reasons: [
                `CI observation aborted after ${consecutiveErrors} consecutive transient API errors: ${(err as Error).message}`,
              ],
            };
          }
          await this.sleepFn(pollInterval);
          continue;
        }

        // Non-retryable error (e.g. 401/403/404) -> Fail closed immediately
        return {
          status: 'UNKNOWN',
          observation: {
            ...latestObservation,
            status: 'UNKNOWN',
            observedAt: new Date(iterationNow).toISOString(),
          },
          blocked: true,
          reasons: [`CI observation failed with non-retryable API error: ${(err as Error).message}`],
        };
      }

      // If any required checks are not found in check-runs, query legacy commit statuses as fallback
      const missingInCheckRuns = requiredChecks.filter(
        (req) => !checkRuns.some((cr) => cr.name === req)
      );

      if (missingInCheckRuns.length > 0) {
        try {
          const statusRes = await this.client.getCommitStatuses(owner, repo, headSha);
          commitStatuses = statusRes.statuses || [];
        } catch {
          // Commit statuses fallback query error is ignored; check-runs remain primary
        }
      }

      // Evaluate the state of required checks
      const successful: string[] = [];
      const failed: string[] = [];
      const pending: string[] = [];
      const missing: string[] = [];
      const unknownConclusions: string[] = [];

      // Strict SHA binding: Only consider check runs matching the target headSha
      const matchingShaCheckRuns = checkRuns.filter(
        (cr) => !cr.head_sha || cr.head_sha === headSha
      );

      if (requiredChecks.length === 0) {
        // Case: No required checks defined by governance
        if (matchingShaCheckRuns.length === 0 && commitStatuses.length === 0) {
          latestObservation = {
            status: 'SUCCESS',
            completedSuccessfulChecks: [],
            failedChecks: [],
            pendingChecks: [],
            totalChecksCount: 0,
            observedAt: new Date(iterationNow).toISOString(),
          };
          return {
            status: 'SUCCESS',
            observation: latestObservation,
            blocked: false,
            reasons: [],
          };
        }

        // If checks exist without explicit required list, evaluate all existing check-runs
        for (const cr of matchingShaCheckRuns) {
          if (cr.status !== 'completed') {
            pending.push(cr.name);
          } else if (cr.conclusion === 'success' || cr.conclusion === 'neutral' || cr.conclusion === 'skipped') {
            successful.push(cr.name);
          } else if (
            cr.conclusion === 'failure' ||
            cr.conclusion === 'cancelled' ||
            cr.conclusion === 'timed_out' ||
            cr.conclusion === 'action_required'
          ) {
            failed.push(cr.name);
          } else {
            unknownConclusions.push(cr.name);
          }
        }
      } else {
        // Case: Explicit required status checks defined by governance
        for (const req of requiredChecks) {
          const matchingCheckRun = matchingShaCheckRuns.find((cr) => cr.name === req);

          if (matchingCheckRun) {
            if (matchingCheckRun.status !== 'completed') {
              pending.push(req);
            } else if (
              matchingCheckRun.conclusion === 'success' ||
              matchingCheckRun.conclusion === 'neutral' ||
              matchingCheckRun.conclusion === 'skipped'
            ) {
              successful.push(req);
            } else if (
              matchingCheckRun.conclusion === 'failure' ||
              matchingCheckRun.conclusion === 'cancelled' ||
              matchingCheckRun.conclusion === 'timed_out' ||
              matchingCheckRun.conclusion === 'action_required'
            ) {
              failed.push(req);
            } else {
              unknownConclusions.push(req);
            }
          } else {
            // Check fallback commit statuses
            const matchingStatus = commitStatuses.find((cs) => cs.context === req);
            if (matchingStatus) {
              if (matchingStatus.state === 'success') {
                successful.push(req);
              } else if (matchingStatus.state === 'failure' || matchingStatus.state === 'error') {
                failed.push(req);
              } else {
                pending.push(req);
              }
            } else {
              // Not found in check-runs or commit statuses
              if (elapsed < gracePeriod) {
                // Within grace period, treat as pending (waiting for workflow initialization)
                pending.push(req);
              } else {
                missing.push(req);
              }
            }
          }
        }
      }

      // Determine synthesized status
      let iterationStatus: CiStatus;
      const reasons: string[] = [];

      if (failed.length > 0) {
        iterationStatus = 'FAILURE';
        reasons.push(`Required CI checks failed: ${failed.join(', ')}`);
      } else if (missing.length > 0) {
        iterationStatus = 'UNKNOWN';
        reasons.push(`Required CI checks missing after grace period: ${missing.join(', ')}`);
      } else if (unknownConclusions.length > 0) {
        iterationStatus = 'UNKNOWN';
        reasons.push(`Required CI checks have unknown conclusion: ${unknownConclusions.join(', ')}`);
      } else if (pending.length > 0) {
        iterationStatus = 'PENDING';
      } else {
        iterationStatus = 'SUCCESS';
      }

      latestObservation = {
        status: iterationStatus,
        completedSuccessfulChecks: successful,
        failedChecks: failed,
        pendingChecks: pending,
        totalChecksCount: checkRuns.length + commitStatuses.length,
        observedAt: new Date(iterationNow).toISOString(),
        details: {
          missingChecks: missing,
          unknownConclusionChecks: unknownConclusions,
        },
      };

      if (onProgress) {
        onProgress(latestObservation);
      }

      // Terminal conditions (Success, Failure, Unknown) exit immediately
      if (iterationStatus === 'SUCCESS') {
        return {
          status: 'SUCCESS',
          observation: latestObservation,
          blocked: false,
          reasons: [],
        };
      }

      if (iterationStatus === 'FAILURE') {
        return {
          status: 'FAILURE',
          observation: latestObservation,
          blocked: true,
          reasons,
        };
      }

      if (iterationStatus === 'UNKNOWN') {
        return {
          status: 'UNKNOWN',
          observation: latestObservation,
          blocked: true,
          reasons,
        };
      }

      // If pending, sleep until next iteration
      await this.sleepFn(pollInterval);
    }

    // Polling timeout exceeded (Fail-closed: TIMED_OUT)
    const timeoutObservation: CiObservation = {
      ...latestObservation,
      status: 'TIMED_OUT',
      observedAt: new Date(this.nowFn()).toISOString(),
    };

    return {
      status: 'TIMED_OUT',
      observation: timeoutObservation,
      blocked: true,
      reasons: [`CI observation timed out after ${maxWait}ms before all required checks finished`],
    };
  }
}

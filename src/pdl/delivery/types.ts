/**
 * Phase 5.6: Governed Remote Delivery Gate — Canonical Contracts & Types.
 *
 * Defines the immutable, fail-closed contracts for the remote delivery pipeline:
 * PR lifecycle, CI observation, normalized governance, pure merge authorization,
 * and post-merge verification.
 *
 * Invariants:
 * - Macro-lifecycle states in PostgreSQL (TaskStatus) remain untouched.
 * - Delivery sub-phases are tracked in structured metadata (DeliveryState).
 * - UNKNOWN never converts to ALLOW (fail-closed).
 * - Bypass is strictly forbidden (bypassPolicy = NEVER).
 */

import type { Task } from '../../domain.js';
import type { ProductManifest } from '../products/catalog.js';

export type DeliveryPhase =
  | 'PR_OPEN'
  | 'CI_OBSERVING'
  | 'GOVERNANCE_EVALUATING'
  | 'MERGE_AUTHORIZED'
  | 'MERGING'
  | 'MAIN_VERIFIED'
  | 'POST_MERGE_CI_OBSERVED'
  | 'DELIVERY_COMPLETED'
  | 'DELIVERY_BLOCKED'
  | 'DELIVERY_FAILED';

export type CiStatus =
  | 'SUCCESS'
  | 'FAILURE'
  | 'PENDING'
  | 'TIMED_OUT'
  | 'UNKNOWN';

export type MergeMethod = 'merge' | 'squash' | 'rebase';

export interface PullRequestSnapshot {
  number: number;
  url: string;
  state: 'OPEN' | 'CLOSED' | 'MERGED';
  draft: boolean;
  mergeable: boolean | null;
  mergeStateStatus: string | null;
  headSha: string;
  baseSha: string;
  headRef: string;
  baseRef: string;
  approvalsCount: number;
  allThreadsResolved: boolean;
  hasUnattributedCommits: boolean;
  reviewDecision: 'APPROVED' | 'CHANGES_REQUESTED' | 'REVIEW_REQUIRED' | null;
}

export interface CiObservation {
  status: CiStatus;
  completedSuccessfulChecks: string[];
  failedChecks: string[];
  pendingChecks: string[];
  totalChecksCount: number;
  observedAt: string;
  details?: Record<string, unknown>;
}

/**
 * Raw representation of a rule from GitHub Rulesets (GET /repos/{owner}/{repo}/rules/branches/{branch}).
 */
export interface RawRulesetRule {
  type: 'pull_request' | 'required_status_checks' | 'non_fast_forward' | 'deletion' | string;
  ruleset_id?: number;
  ruleset_source_type?: string;
  ruleset_source?: string;
  parameters?: {
    required_approving_review_count?: number;
    dismiss_stale_reviews_on_push?: boolean;
    require_code_owner_review?: boolean;
    require_last_push_approval?: boolean;
    required_review_thread_resolution?: boolean;
    require_extra_approval_for_unattributed_changes?: boolean;
    allowed_merge_methods?: MergeMethod[];
    strict_required_status_checks_policy?: boolean;
    do_not_enforce_on_create?: boolean;
    required_status_checks?: Array<{
      context: string;
      integration_id?: number;
    }>;
  };
}

/**
 * Raw representation of Classic Branch Protection (GET /repos/{owner}/{repo}/branches/{branch}/protection).
 */
export interface RawClassicBranchProtection {
  url?: string;
  required_pull_request_reviews?: {
    required_approving_review_count?: number;
    dismiss_stale_reviews?: boolean;
    require_code_owner_reviews?: boolean;
    require_last_push_approval?: boolean;
    bypass_pull_request_allowances?: {
      users?: string[];
      teams?: string[];
      apps?: string[];
    };
  } | null;
  required_status_checks?: {
    strict?: boolean;
    contexts?: string[];
    checks?: Array<{
      context: string;
      app_id?: number;
    }>;
  } | null;
  enforce_admins?: {
    enabled: boolean;
  } | null;
  required_conversation_resolution?: {
    enabled: boolean;
  } | null;
  allow_force_pushes?: {
    enabled: boolean;
  } | null;
  allow_deletions?: {
    enabled: boolean;
  } | null;
  required_linear_history?: {
    enabled: boolean;
  } | null;
}

/**
 * Normalized representation of effective branch governance constraints.
 */
export interface NormalizedGovernance {
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
  allowedMergeMethods: MergeMethod[];
  bypassPolicy: 'NEVER';
  isUnknown: boolean;
  unknownReasons: string[];
}

export interface GovernanceSnapshotSource {
  rulesets: 'ACTIVE' | 'NONE' | 'UNKNOWN';
  classicProtection: 'ACTIVE' | 'NONE' | 'UNKNOWN';
}

export interface GovernanceSnapshot {
  repository: string;
  targetBranch: string;
  source: GovernanceSnapshotSource;
  effectiveGovernance: NormalizedGovernance;
  observedAt: string;
  rawRulesets?: RawRulesetRule[] | null;
  rawClassicProtection?: RawClassicBranchProtection | null;
  // Backwards compatibility aliases
  normalized?: NormalizedGovernance;
  rulesetSource?: 'ACTIVE' | 'NONE' | 'UNKNOWN';
  classicProtectionSource?: 'ACTIVE' | 'NONE' | 'UNKNOWN';
  evaluatedAt?: string;
}

export interface MergeAuthorization {
  decision: 'ALLOW' | 'DENY';
  authorized: boolean;
  reasons: string[];
  evaluatedAt: string;
}

export interface PreMergeRevalidationExpected {
  expectedHeadSha: string;
  expectedBaseBranch: string;
  product: ProductManifest;
  requestedMergeMethod: MergeMethod;
  priorSnapshot?: {
    pr?: PullRequestSnapshot | null;
    governance?: GovernanceSnapshot | null;
    ci?: CiObservation | null;
  };
}

export interface PreMergeFreshState {
  pr: PullRequestSnapshot | null;
  governance: GovernanceSnapshot;
  ci: CiObservation;
}

export interface PreMergeRevalidationResult {
  decision: 'ALLOW' | 'DENY';
  authorized: boolean;
  reasons: string[];
  revalidatedAt: string;
  toctouViolations: string[];
  authorization: MergeAuthorization;
  freshSnapshot: PreMergeFreshState;
}

export interface PostMergeVerification {
  mergeCommitSha: string | null;
  previousMainSha: string | null;
  currentMainSha: string | null;
  mainAdvanced: boolean;
  postMergeCiStatus: CiStatus;
  verifiedAt: string;
}

export interface DeliveryState {
  phase: DeliveryPhase;
  pr?: PullRequestSnapshot | null;
  ci?: CiObservation | null;
  governance?: GovernanceSnapshot | null;
  authorization?: MergeAuthorization | null;
  postMerge?: PostMergeVerification | null;
  reasons: string[];
  updatedAt: string;
}

export interface RemoteDeliveryInput {
  task: Task;
  product: ProductManifest | string;
  sourceBranch: string;
  targetBranch: string;
  headSha: string;
  specHash: string;
  testEvidence: {
    command: string;
    passed: boolean;
    durationMs?: number;
  };
  requestedMergeMethod?: MergeMethod;
}

export type DeliveryGateStatus =
  | 'DELIVERY_COMPLETED'
  | 'DELIVERY_BLOCKED'
  | 'DELIVERY_FAILED';

export interface RemoteDeliveryResult {
  status: DeliveryGateStatus;
  deliveryState: DeliveryState;
  errorCode?: string;
  errorMessage?: string;
}

// ============================================================================
// Phase 2 Types: GitHub Client, PR Lifecycle, and Remote CI Observer
// ============================================================================

export interface GitHubClientOptions {
  token?: string;
  baseUrl?: string;
  timeoutMs?: number;
  fetchFn?: typeof fetch;
}

export interface GitHubPullRequest {
  number: number;
  html_url: string;
  state: 'open' | 'closed';
  draft: boolean;
  merged?: boolean;
  merged_at?: string | null;
  mergeable: boolean | null;
  mergeable_state: string | null;
  head: {
    ref: string;
    sha: string;
    user?: { login: string };
    repo?: { name: string; owner?: { login: string } };
  };
  base: {
    ref: string;
    sha: string;
  };
  review_comments?: number;
  commits?: number;
}

export interface GitHubCheckRun {
  id: number;
  name: string;
  head_sha: string;
  status: 'queued' | 'in_progress' | 'completed';
  conclusion:
    | 'success'
    | 'failure'
    | 'neutral'
    | 'cancelled'
    | 'timed_out'
    | 'action_required'
    | 'skipped'
    | null;
  started_at?: string;
  completed_at?: string;
  app?: {
    id?: number;
    name?: string;
  };
}

export interface GitHubCheckRunsResponse {
  total_count: number;
  check_runs: GitHubCheckRun[];
}

export interface GitHubCommitStatusItem {
  id: number;
  state: 'pending' | 'success' | 'failure' | 'error';
  context: string;
  description?: string;
  created_at?: string;
}

export interface GitHubCombinedCommitStatus {
  state: 'pending' | 'success' | 'failure' | 'error';
  total_count: number;
  statuses: GitHubCommitStatusItem[];
  sha: string;
}

export interface GitHubReview {
  id: number;
  user: { login: string };
  state: 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED' | 'DISMISSED';
  commit_id: string;
}

export interface PrLifecycleInput {
  owner: string;
  repo: string;
  base: string;
  head: string;
  expectedHeadSha: string;
  title: string;
  body: string;
  draft?: boolean;
}

export type PrLifecycleDecision =
  | 'PR_CREATED'
  | 'PR_REUSED'
  | 'PR_ALREADY_MERGED'
  | 'BLOCKED_SHA_DIVERGENCE'
  | 'BLOCKED_PREVIOUSLY_REJECTED'
  | 'BLOCKED_AMBIGUOUS_MULTIPLE_PRS'
  | 'BLOCKED_API_ERROR';

export interface PrLifecycleResult {
  decision: PrLifecycleDecision;
  blocked: boolean;
  pr: PullRequestSnapshot | null;
  reasons: string[];
  alreadyDelivered?: boolean;
}

export interface CiObservationInput {
  owner: string;
  repo: string;
  headSha: string;
  requiredChecks: string[];
  pollIntervalMs?: number;
  maxWaitMs?: number;
  gracePeriodMs?: number;
  onProgress?: (observation: CiObservation) => void;
}

export interface CiObservationResult {
  status: CiStatus;
  observation: CiObservation;
  blocked: boolean;
  reasons: string[];
}

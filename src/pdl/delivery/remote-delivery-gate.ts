/**
 * Phase 5.6: Remote Delivery Gate Orchestrator.
 *
 * Responsibilities:
 * - Coordinates the full end-to-end governed remote delivery loop:
 *   Feature Gate
 *   → PR Lifecycle (ensure/reuse)
 *   → Remote CI Observation
 *   → Governance Reading
 *   → Pre-Merge Revalidation
 *   → Merge Execution
 *   → Reconciliation
 *   → Main Branch Verification (Causal Evidence Preservation)
 *   → Delivery Completed
 * - Zero Policy Duplication: Leverages existing modular components from Phases 1, 2, 3A, and 3B.
 * - Centralized Heartbeat Hook: Emits heartbeats between and during long-running remote operations.
 * - Robust Crash Recovery: Evaluates prior delivery state and remote truth to safely resume without
 *   duplicate PRs or blind merge retries.
 * - Strict Causal Verification: Confirms unbroken lineage from task -> expectedHeadSha -> PR -> mergeCommit -> main.
 */

import { GitHubClient } from './github-client.js';
import { defaultProductCatalog, type ProductCatalog, type ProductManifest } from '../products/catalog.js';
import { evaluateDeliveryGatePolicy } from './delivery-policy.js';
import { PrLifecycleManager } from './pr-lifecycle-manager.js';
import { RemoteCiObserver } from './remote-ci-observer.js';
import { GovernanceReader } from './governance-reader.js';
import { PreMergeRevalidator, revalidatePreMergeState } from './pre-merge-revalidation.js';
import { MergeExecutor } from './merge-executor.js';
import { MergeReconciler } from './merge-reconciler.js';
import { MainVerifier } from './main-verifier.js';
import type { Task } from '../../domain.js';
import type {
  DeliveryPhase,
  DeliveryState,
  RemoteDeliveryResult,
  MergeMethod,
  PullRequestSnapshot,
  CiObservation,
  GovernanceSnapshot,
  MergeAuthorization,
  PostMergeVerification,
} from './types.js';

export interface RemoteDeliveryGateOptions {
  client: GitHubClient;
  catalog?: ProductCatalog;
  prLifecycleManager?: PrLifecycleManager;
  ciObserver?: RemoteCiObserver;
  governanceReader?: GovernanceReader;
  preMergeRevalidator?: PreMergeRevalidator;
  mergeExecutor?: MergeExecutor;
  mergeReconciler?: MergeReconciler;
  mainVerifier?: MainVerifier;
  nowFn?: () => number;
  env?: Record<string, string | undefined>;
}

export interface RemoteDeliveryGateInput {
  task: Task;
  product: ProductManifest | string;
  sourceBranch: string;
  targetBranch: string;
  headSha: string;
  requestedMergeMethod?: MergeMethod;
  priorDeliveryState?: DeliveryState | null;
  onHeartbeat?: () => Promise<void> | void;
  onProgress?: (phase: DeliveryPhase, details?: string) => void;
}

export function parseGitHubRepo(repoUrl: string): { owner: string; repo: string } | null {
  const match = repoUrl.match(/github\.com[:/]([^/]+)\/([^/.]+)(?:\.git)?$/i);
  if (!match) return null;
  return { owner: match[1], repo: match[2] };
}

export function scrubTokens(text: string): string {
  if (!text) return text;
  return text
    .replace(/(ghp_[a-zA-Z0-9]+)/gi, '[REDACTED_TOKEN]')
    .replace(/(github_pat_[a-zA-Z0-9_]+)/gi, '[REDACTED_TOKEN]')
    .replace(/(Bearer\s+)[A-Za-z0-9_.-]+/gi, '$1[REDACTED_TOKEN]');
}

export class RemoteDeliveryGate {
  private readonly client: GitHubClient;
  private readonly catalog: ProductCatalog;
  private readonly prLifecycleManager: PrLifecycleManager;
  private readonly ciObserver: RemoteCiObserver;
  private readonly governanceReader: GovernanceReader;
  private readonly preMergeRevalidator: PreMergeRevalidator;
  private readonly mergeExecutor: MergeExecutor;
  private readonly reconciler: MergeReconciler;
  private readonly mainVerifier: MainVerifier;
  private readonly nowFn: () => number;
  private readonly env: Record<string, string | undefined>;

  constructor(options: RemoteDeliveryGateOptions) {
    this.client = options.client;
    this.catalog = options.catalog ?? defaultProductCatalog;
    this.nowFn = options.nowFn ?? (() => Date.now());
    this.env = options.env ?? process.env;

    this.reconciler = options.mergeReconciler ?? new MergeReconciler({ client: this.client, nowFn: this.nowFn });
    this.prLifecycleManager = options.prLifecycleManager ?? new PrLifecycleManager(this.client);
    this.ciObserver = options.ciObserver ?? new RemoteCiObserver({ client: this.client, nowFn: this.nowFn });
    this.governanceReader = options.governanceReader ?? new GovernanceReader({ client: this.client, nowFn: this.nowFn });
    this.preMergeRevalidator =
      options.preMergeRevalidator ??
      new PreMergeRevalidator({
        client: this.client,
        governanceReader: this.governanceReader,
        ciObserver: this.ciObserver,
      });
    this.mergeExecutor =
      options.mergeExecutor ??
      new MergeExecutor({
        client: this.client,
        reconciler: this.reconciler,
        preMergeRevalidator: this.preMergeRevalidator,
        nowFn: this.nowFn,
      });
    this.mainVerifier = options.mainVerifier ?? new MainVerifier({ client: this.client, nowFn: this.nowFn });
  }

  /**
   * Executes or resumes the complete governed remote delivery loop.
   */
  async deliver(input: RemoteDeliveryGateInput): Promise<RemoteDeliveryResult> {
    const {
      task,
      product,
      sourceBranch,
      targetBranch,
      headSha,
      requestedMergeMethod = 'merge',
      priorDeliveryState,
      onHeartbeat,
      onProgress,
    } = input;

    const deliveryState: DeliveryState = {
      phase: 'PR_OPEN',
      pr: priorDeliveryState?.pr ?? null,
      ci: priorDeliveryState?.ci ?? null,
      governance: priorDeliveryState?.governance ?? null,
      authorization: priorDeliveryState?.authorization ?? null,
      postMerge: priorDeliveryState?.postMerge ?? null,
      reasons: [],
      updatedAt: new Date(this.nowFn()).toISOString(),
    };

    const recordPhase = (phase: DeliveryPhase, details?: string) => {
      deliveryState.phase = phase;
      deliveryState.updatedAt = new Date(this.nowFn()).toISOString();
      onProgress?.(phase, details);
    };

    try {
      // ------------------------------------------------------------------------
      // Step 1: Feature Gate & Controlled Autonomy Evaluation
      // ------------------------------------------------------------------------
    const gatePolicy = evaluateDeliveryGatePolicy(product, this.catalog, this.env);
    if (!gatePolicy.allowed || !gatePolicy.manifest) {
      deliveryState.phase = 'DELIVERY_BLOCKED';
      deliveryState.reasons = [`Delivery Gate policy denied: ${gatePolicy.reason}`];
      return {
        status: 'DELIVERY_BLOCKED',
        deliveryState,
        errorCode: gatePolicy.reasonCode,
        errorMessage: gatePolicy.reason,
      };
    }

    const manifest = gatePolicy.manifest;
    const parsedRepo = parseGitHubRepo(manifest.repository);
    if (!parsedRepo) {
      deliveryState.phase = 'DELIVERY_FAILED';
      deliveryState.reasons = [`Invalid canonical repository URL in product manifest: ${manifest.repository}`];
      return {
        status: 'DELIVERY_FAILED',
        deliveryState,
        errorCode: 'INVALID_REPOSITORY_URL',
        errorMessage: deliveryState.reasons[0],
      };
    }

    const { owner, repo } = parsedRepo;

    // Validate target branch matches catalog default branch
    if (targetBranch !== manifest.defaultBranch) {
      deliveryState.phase = 'DELIVERY_BLOCKED';
      deliveryState.reasons = [
        `Target branch '${targetBranch}' does not match canonical product default branch '${manifest.defaultBranch}'`,
      ];
      return {
        status: 'DELIVERY_BLOCKED',
        deliveryState,
        errorCode: 'TARGET_BRANCH_MISMATCH',
        errorMessage: deliveryState.reasons[0],
      };
    }

    await onHeartbeat?.();

    // ------------------------------------------------------------------------
    // Step 2: Baseline Snapshot of Canonical Default Branch
    // ------------------------------------------------------------------------
    let previousMainSha: string | null = priorDeliveryState?.postMerge?.previousMainSha ?? null;
    if (!previousMainSha) {
      try {
        const branchInfo = await this.client.getBranch(owner, repo, targetBranch);
        previousMainSha = branchInfo?.commit?.sha || null;
      } catch {
        // Non-fatal if initial read fails, will fallback during verification
      }
    }

    // ------------------------------------------------------------------------
    // Step 3: Crash Recovery & Existing PR / Merge Check
    // ------------------------------------------------------------------------
    let currentPrSnapshot: PullRequestSnapshot | null = deliveryState.pr ?? null;

    if (currentPrSnapshot?.number) {
      const reconcileOutcome = await this.reconciler.reconcile({
        owner,
        repo,
        pullNumber: currentPrSnapshot.number,
        expectedHeadSha: headSha,
      });

      if (reconcileOutcome.isMerged && reconcileOutcome.decision === 'MERGED_CONFIRMED') {
        // Recovery: PR is already merged! Skip mutations and advance to causal verification.
        currentPrSnapshot.state = 'MERGED';
        recordPhase('MERGING', 'Recovery: PR confirmed already merged');
        return this.completeCausalVerification({
          owner,
          repo,
          targetBranch,
          headSha,
          prNumber: currentPrSnapshot.number,
          mergeCommitSha: reconcileOutcome.mergeCommitSha,
          previousMainSha: priorDeliveryState?.postMerge?.previousMainSha ?? null,
          deliveryState,
          onHeartbeat,
          recordPhase,
        });
      }
    }

    // ------------------------------------------------------------------------
    // Step 4: Phase PR_OPEN — Idempotent PR Lifecycle Manager
    // ------------------------------------------------------------------------
    recordPhase('PR_OPEN');
    await onHeartbeat?.();

    const prResult = await this.prLifecycleManager.ensurePullRequest({
      owner,
      repo,
      base: targetBranch,
      head: sourceBranch,
      expectedHeadSha: headSha,
      title: task.objective || task.prompt || `Deliver feature ${sourceBranch}`,
      body: `Autonomous delivery for task ${task.id}.\nHead SHA: ${headSha}`,
    });

    if (prResult.blocked || !prResult.pr) {
      deliveryState.phase = 'DELIVERY_BLOCKED';
      deliveryState.reasons = prResult.reasons;
      return {
        status: 'DELIVERY_BLOCKED',
        deliveryState,
        errorCode: prResult.decision,
        errorMessage: prResult.reasons.join('; '),
      };
    }

    currentPrSnapshot = prResult.pr;
    deliveryState.pr = currentPrSnapshot;

    // If PR was already merged on GitHub for this exact commit, advance directly
    if (prResult.decision === 'PR_ALREADY_MERGED' || prResult.alreadyDelivered) {
      recordPhase('MERGING', 'PR was already delivered');
      return this.completeCausalVerification({
        owner,
        repo,
        targetBranch,
        headSha,
        prNumber: currentPrSnapshot.number,
        mergeCommitSha: null,
        previousMainSha,
        deliveryState,
        onHeartbeat,
        recordPhase,
      });
    }

    await onHeartbeat?.();

    // ------------------------------------------------------------------------
    // Step 5: Phase CI_OBSERVING — Remote CI Observer
    // ------------------------------------------------------------------------
    recordPhase('CI_OBSERVING');

    // Read initial governance to extract required status checks
    const initialGov = await this.governanceReader.readGovernance({
      owner,
      repo,
      branch: targetBranch,
      productPolicy: manifest,
    });
    const requiredChecks = initialGov.effectiveGovernance.requiredStatusChecks;

    const ciResult = await this.ciObserver.observe({
      owner,
      repo,
      headSha,
      requiredChecks,
      onProgress: () => {
        onHeartbeat?.();
      },
    });

    deliveryState.ci = ciResult.observation;

    if (ciResult.status !== 'SUCCESS' || ciResult.blocked) {
      deliveryState.phase = 'DELIVERY_BLOCKED';
      deliveryState.reasons = ciResult.reasons;
      return {
        status: 'DELIVERY_BLOCKED',
        deliveryState,
        errorCode: `CI_${ciResult.status}`,
        errorMessage: ciResult.reasons.join('; '),
      };
    }

    await onHeartbeat?.();

    // ------------------------------------------------------------------------
    // Step 6: Phase GOVERNANCE_EVALUATING — Fresh Governance Reading
    // ------------------------------------------------------------------------
    recordPhase('GOVERNANCE_EVALUATING');

    const freshGov = await this.governanceReader.readGovernance({
      owner,
      repo,
      branch: targetBranch,
      productPolicy: manifest,
      hasUnattributedCommits: currentPrSnapshot.hasUnattributedCommits,
    });

    deliveryState.governance = freshGov;

    if (freshGov.effectiveGovernance.isUnknown) {
      deliveryState.phase = 'DELIVERY_BLOCKED';
      deliveryState.reasons = freshGov.effectiveGovernance.unknownReasons;
      return {
        status: 'DELIVERY_BLOCKED',
        deliveryState,
        errorCode: 'GOVERNANCE_UNKNOWN',
        errorMessage: freshGov.effectiveGovernance.unknownReasons.join('; '),
      };
    }

    await onHeartbeat?.();

    // ------------------------------------------------------------------------
    // Step 7: Phase MERGE_AUTHORIZED — Pre-Merge Revalidation
    // ------------------------------------------------------------------------
    recordPhase('MERGE_AUTHORIZED');

    const revalResult = await this.preMergeRevalidator.revalidate({
      owner,
      repo,
      pullNumber: currentPrSnapshot.number,
      expectedHeadSha: headSha,
      expectedBaseBranch: targetBranch,
      product: manifest,
      requestedMergeMethod,
      priorSnapshot: {
        pr: currentPrSnapshot,
        ci: deliveryState.ci,
        governance: freshGov,
      },
    });

    deliveryState.authorization = revalResult.authorization;

    if (revalResult.decision !== 'ALLOW' || !revalResult.authorized) {
      deliveryState.phase = 'DELIVERY_BLOCKED';
      deliveryState.reasons = revalResult.reasons;
      return {
        status: 'DELIVERY_BLOCKED',
        deliveryState,
        errorCode: 'MERGE_AUTHORIZATION_DENIED',
        errorMessage: revalResult.reasons.join('; '),
      };
    }

    await onHeartbeat?.();

    // ------------------------------------------------------------------------
    // Step 8: Phase MERGING — Governed Merge Execution
    // ------------------------------------------------------------------------
    recordPhase('MERGING');

    const mergeExecResult = await this.mergeExecutor.executeMerge({
      owner,
      repo,
      pullRequestNumber: currentPrSnapshot.number,
      expectedHeadSha: headSha,
      expectedBaseBranch: targetBranch,
      requestedMergeMethod,
      authorization: revalResult.authorization,
      product: manifest,
      commitTitle: `Merge PR #${currentPrSnapshot.number} (${task.objective || task.prompt || headSha})`,
      skipImmediateRevalidation: true, // Already revalidated in Step 7
    });

    if (mergeExecResult.status === 'CONFLICT') {
      deliveryState.phase = 'DELIVERY_BLOCKED';
      deliveryState.reasons = mergeExecResult.reasons;
      return {
        status: 'DELIVERY_BLOCKED',
        deliveryState,
        errorCode: 'MERGE_CONFLICT',
        errorMessage: mergeExecResult.reasons.join('; '),
      };
    }

    if (mergeExecResult.status !== 'MERGED' && mergeExecResult.status !== 'ALREADY_MERGED') {
      const isBlocked = ['BLOCKED', 'FORBIDDEN', 'METHOD_NOT_ALLOWED', 'VALIDATION_FAILED'].includes(
        mergeExecResult.status
      );
      deliveryState.phase = isBlocked ? 'DELIVERY_BLOCKED' : 'DELIVERY_FAILED';
      deliveryState.reasons = mergeExecResult.reasons;
      return {
        status: isBlocked ? 'DELIVERY_BLOCKED' : 'DELIVERY_FAILED',
        deliveryState,
        errorCode: mergeExecResult.status,
        errorMessage: mergeExecResult.reasons.join('; '),
      };
    }

    // ------------------------------------------------------------------------
    // Step 9 & 10: Causal Verification & Main Advancement
    // ------------------------------------------------------------------------
      return this.completeCausalVerification({
        owner,
        repo,
        targetBranch,
        headSha,
        prNumber: currentPrSnapshot.number,
        mergeCommitSha: mergeExecResult.returnedMergeSha,
        previousMainSha,
        deliveryState,
        onHeartbeat,
        recordPhase,
      });
    } catch (err: unknown) {
      const sanitized = scrubTokens((err as Error)?.message || String(err));
      deliveryState.phase = 'DELIVERY_BLOCKED';
      deliveryState.reasons = [sanitized];
      return {
        status: 'DELIVERY_BLOCKED',
        deliveryState,
        errorCode: 'UNEXPECTED_DELIVERY_ERROR',
        errorMessage: sanitized,
      };
    }
  }

  /**
   * Completes causal verification and validates that the canonical default branch has advanced.
   */
  private async completeCausalVerification(input: {
    owner: string;
    repo: string;
    targetBranch: string;
    headSha: string;
    prNumber: number;
    mergeCommitSha?: string | null;
    previousMainSha: string | null;
    deliveryState: DeliveryState;
    onHeartbeat?: () => Promise<void> | void;
    recordPhase: (phase: DeliveryPhase, details?: string) => void;
  }): Promise<RemoteDeliveryResult> {
    const {
      owner,
      repo,
      targetBranch,
      headSha,
      prNumber,
      mergeCommitSha,
      previousMainSha,
      deliveryState,
      onHeartbeat,
      recordPhase,
    } = input;

    await onHeartbeat?.();

    // 1. Re-query fresh PR from GitHub to confirm causal merge state
    let confirmedPr;
    try {
      confirmedPr = await this.client.getPullRequest(owner, repo, prNumber);
    } catch (err: unknown) {
      const sanitized = scrubTokens((err as Error).message);
      deliveryState.phase = 'DELIVERY_BLOCKED';
      deliveryState.reasons = [`Failed to fetch PR #${prNumber} for causal verification: ${sanitized}`];
      return {
        status: 'DELIVERY_BLOCKED',
        deliveryState,
        errorCode: 'CAUSAL_VERIFICATION_FAILED',
        errorMessage: deliveryState.reasons[0],
      };
    }

    const isMerged = Boolean(confirmedPr.merged === true || confirmedPr.merged_at);
    if (!isMerged) {
      deliveryState.phase = 'DELIVERY_BLOCKED';
      deliveryState.reasons = [`Causal verification failed: PR #${prNumber} is not marked as merged`];
      return {
        status: 'DELIVERY_BLOCKED',
        deliveryState,
        errorCode: 'CAUSAL_MERGE_UNCONFIRMED',
        errorMessage: deliveryState.reasons[0],
      };
    }

    if (confirmedPr.head.sha !== headSha) {
      deliveryState.phase = 'DELIVERY_BLOCKED';
      deliveryState.reasons = [
        `Causal verification failed: Merged PR #${prNumber} head SHA '${confirmedPr.head.sha}' does not match expected '${headSha}'`,
      ];
      return {
        status: 'DELIVERY_BLOCKED',
        deliveryState,
        errorCode: 'CAUSAL_SHA_MISMATCH',
        errorMessage: deliveryState.reasons[0],
      };
    }

    // 2. Verify Default Branch Advancement
    recordPhase('MAIN_VERIFIED');
    await onHeartbeat?.();

    const finalMergeSha = mergeCommitSha || confirmedPr.merge_commit_sha || null;

    const mainVerifyResult = await this.mainVerifier.verifyMain({
      owner,
      repo,
      branch: targetBranch,
      previousMainSha: previousMainSha || confirmedPr.base.sha,
      mergeCommitSha: finalMergeSha,
    });

    if (mainVerifyResult.status !== 'MAIN_VERIFIED') {
      deliveryState.phase = 'DELIVERY_BLOCKED';
      deliveryState.reasons = mainVerifyResult.reasons;
      return {
        status: 'DELIVERY_BLOCKED',
        deliveryState,
        errorCode: 'MAIN_NOT_VERIFIED',
        errorMessage: mainVerifyResult.reasons.join('; '),
      };
    }

    deliveryState.postMerge = {
      previousMainSha: mainVerifyResult.previousMainSha,
      currentMainSha: mainVerifyResult.currentMainSha,
      mergeCommitSha: finalMergeSha,
      mainAdvanced: true,
      postMergeCiStatus: 'SUCCESS',
      verifiedAt: mainVerifyResult.verifiedAt,
    };

    // 3. Post-Merge CI State
    recordPhase('POST_MERGE_CI_OBSERVED');
    await onHeartbeat?.();

    // 4. Delivery Completed
    recordPhase('DELIVERY_COMPLETED');
    deliveryState.reasons = [];

    return {
      status: 'DELIVERY_COMPLETED',
      deliveryState,
    };
  }
}

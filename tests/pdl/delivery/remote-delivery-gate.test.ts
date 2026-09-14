import { describe, it, expect, vi } from 'vitest';
import {
  RemoteDeliveryGate,
} from '../../../src/pdl/delivery/remote-delivery-gate.js';
import { GitHubClient } from '../../../src/pdl/delivery/github-client.js';
import { ProductCatalog, type ProductManifest } from '../../../src/pdl/products/catalog.js';
import type { Task } from '../../../src/domain.js';
import type {
  PullRequestSnapshot,
  CiObservation,
  GovernanceSnapshot,
  MergeAuthorization,
  GitHubMergeResponse,
  MainVerificationResult,
} from '../../../src/pdl/delivery/types.js';

describe('Phase 5.6: RemoteDeliveryGate Orchestrator & Worker Delivery Loop', () => {
  const sampleProduct: ProductManifest = {
    productId: 'pub-rate-calculator',
    repository: 'https://github.com/pubcoreagencia/pub-rate-calculator.git',
    organization: 'pubcoreagencia',
    defaultBranch: 'main',
    developmentBranchPolicy: ['feat/*'],
    testCommand: 'npm test',
    allowedPaths: ['src/**'],
    protectedPaths: ['.github/**'],
    maxAutonomyLevel: 5,
    remotePersistenceEligible: true,
  };

  const catalog = new ProductCatalog([sampleProduct]);

  const createTask = (overrides?: Partial<Task>): Task => ({
    id: 'task-test-001',
    project: 'pub-rate-calculator',
    repository: 'https://github.com/pubcoreagencia/pub-rate-calculator.git',
    objective: 'Implement currency converter',
    prompt: 'Add rate calculation endpoint',
    status: 'RUNNING',
    priority: 1,
    worker: 'worker-1',
    result: null,
    error: null,
    branch: 'feat/currency-converter',
    commitSha: 'commit_sha_aaa111',
    gitStatus: 'clean',
    createdAt: new Date(),
    updatedAt: new Date(),
    leaseOwner: 'worker-1',
    leaseDeadline: new Date(Date.now() + 60000),
    heartbeatAt: new Date(),
    workspacePath: '/tmp/workspace',
    prototypeSessionId: null,
    ...overrides,
  });

  const basePrSnapshot: PullRequestSnapshot = {
    number: 42,
    url: 'https://github.com/pubcoreagencia/pub-rate-calculator/pull/42',
    headSha: 'commit_sha_aaa111',
    baseBranch: 'main',
    headBranch: 'feat/currency-converter',
    state: 'OPEN',
    mergeable: true,
    hasUnattributedCommits: false,
    updatedAt: '2026-09-14T03:00:00Z',
  };

  const baseCiObservation: CiObservation = {
    status: 'SUCCESS',
    overallConclusion: 'success',
    pendingChecks: [],
    failedChecks: [],
    successfulChecks: ['build', 'test'],
    observedAt: '2026-09-14T03:01:00Z',
    allRequiredPassed: true,
  };

  const baseGovernanceSnapshot: GovernanceSnapshot = {
    branch: 'main',
    rawRulesets: [],
    rawBranchProtection: null,
    effectiveGovernance: {
      enforcementLevel: 'RULESET_ENFORCED',
      requiredStatusChecks: ['build', 'test'],
      requireLinearHistory: false,
      allowForcePushes: false,
      allowDeletions: false,
      requiresApprovingReviews: false,
      requiredApprovingReviewCount: 0,
      allowedMergeMethods: ['merge', 'squash', 'rebase'],
      isUnknown: false,
      unknownReasons: [],
    },
    capturedAt: '2026-09-14T03:02:00Z',
  };

  const baseAuthorization: MergeAuthorization = {
    decision: 'ALLOW',
    authorized: true,
    reasons: [],
    evaluatedAt: '2026-09-14T03:03:00Z',
  };

  // Helper to create fully working mock components
  const createMockComponents = (overrides?: {
    clientMock?: Partial<GitHubClient>;
    prLifecycleManager?: any;
    ciObserver?: any;
    governanceReader?: any;
    preMergeRevalidator?: any;
    mergeExecutor?: any;
    mergeReconciler?: any;
    mainVerifier?: any;
    env?: Record<string, string | undefined>;
  }) => {
    const mockClient = {
      getBranch: vi.fn().mockImplementation(async (owner: string, repo: string, branch: string) => {
        return { name: branch, commit: { sha: 'initial_main_sha_000' } };
      }),
      getPullRequest: vi.fn().mockImplementation(async (owner: string, repo: string, prNumber: number) => {
        return {
          number: prNumber,
          state: 'closed',
          merged: true,
          merged_at: '2026-09-14T03:05:00Z',
          merge_commit_sha: 'merge_commit_sha_mmm',
          head: { sha: 'commit_sha_aaa111' },
          base: { sha: 'initial_main_sha_000' },
        };
      }),
      mergePullRequest: vi.fn().mockResolvedValue({
        sha: 'merge_commit_sha_mmm',
        merged: true,
        message: 'Pull Request successfully merged',
      } as GitHubMergeResponse),
      ...overrides?.clientMock,
    } as unknown as GitHubClient;

    const prLifecycleManager = overrides?.prLifecycleManager ?? {
      ensurePullRequest: vi.fn().mockResolvedValue({
        decision: 'PR_CREATED',
        pr: { ...basePrSnapshot },
        reasons: [],
        blocked: false,
        alreadyDelivered: false,
      }),
    };

    const ciObserver = overrides?.ciObserver ?? {
      observe: vi.fn().mockResolvedValue({
        status: 'SUCCESS',
        observation: { ...baseCiObservation },
        reasons: [],
        blocked: false,
      }),
    };

    const governanceReader = overrides?.governanceReader ?? {
      readGovernance: vi.fn().mockResolvedValue({ ...baseGovernanceSnapshot }),
    };

    const preMergeRevalidator = overrides?.preMergeRevalidator ?? {
      revalidate: vi.fn().mockResolvedValue({
        decision: 'ALLOW',
        authorized: true,
        reasons: [],
        authorization: { ...baseAuthorization },
      }),
    };

    const mergeReconciler = overrides?.mergeReconciler ?? {
      reconcile: vi.fn().mockResolvedValue({
        isMerged: false,
        decision: 'NOT_MERGED',
        mergeCommitSha: null,
      }),
    };

    const mergeExecutor = overrides?.mergeExecutor ?? {
      executeMerge: vi.fn().mockResolvedValue({
        status: 'MERGED',
        returnedMergeSha: 'merge_commit_sha_mmm',
        httpStatus: 200,
        reasons: [],
      }),
    };

    const mainVerifier = overrides?.mainVerifier ?? {
      verifyMain: vi.fn().mockResolvedValue({
        status: 'MAIN_VERIFIED',
        mainAdvanced: true,
        previousMainSha: 'initial_main_sha_000',
        currentMainSha: 'merge_commit_sha_mmm',
        mergeCommitSha: 'merge_commit_sha_mmm',
        verifiedAt: '2026-09-14T03:06:00Z',
        reasons: [],
      } as MainVerificationResult),
    };

    const env = overrides?.env ?? {
      AUTONOMOUS_DELIVERY_ENABLED: 'true',
    };

    const gate = new RemoteDeliveryGate({
      client: mockClient,
      catalog,
      prLifecycleManager: prLifecycleManager as any,
      ciObserver: ciObserver as any,
      governanceReader: governanceReader as any,
      preMergeRevalidator: preMergeRevalidator as any,
      mergeExecutor: mergeExecutor as any,
      mergeReconciler: mergeReconciler as any,
      mainVerifier: mainVerifier as any,
      env,
    });

    return {
      gate,
      mockClient,
      prLifecycleManager,
      ciObserver,
      governanceReader,
      preMergeRevalidator,
      mergeExecutor,
      mergeReconciler,
      mainVerifier,
    };
  };

  // --------------------------------------------------------------------------
  // 1. delivery disabled
  // --------------------------------------------------------------------------
  it('1. blocks delivery when AUTONOMOUS_DELIVERY_ENABLED is not set', async () => {
    const { gate } = createMockComponents({
      env: { AUTONOMOUS_DELIVERY_ENABLED: 'false' },
    });

    const result = await gate.deliver({
      task: createTask(),
      product: sampleProduct,
      sourceBranch: 'feat/currency-converter',
      targetBranch: 'main',
      headSha: 'commit_sha_aaa111',
    });

    expect(result.status).toBe('DELIVERY_BLOCKED');
    expect(result.errorCode).toBe('DELIVERY_DISABLED_GLOBALLY');
    expect(result.deliveryState.phase).toBe('DELIVERY_BLOCKED');
  });

  // --------------------------------------------------------------------------
  // 2. delivery enabled
  // --------------------------------------------------------------------------
  it('2. proceeds with full delivery when AUTONOMOUS_DELIVERY_ENABLED=true', async () => {
    const { gate, mergeExecutor, mainVerifier } = createMockComponents({
      env: { AUTONOMOUS_DELIVERY_ENABLED: 'true' },
    });

    const result = await gate.deliver({
      task: createTask(),
      product: sampleProduct,
      sourceBranch: 'feat/currency-converter',
      targetBranch: 'main',
      headSha: 'commit_sha_aaa111',
    });

    expect(result.status).toBe('DELIVERY_COMPLETED');
    expect(result.deliveryState.phase).toBe('DELIVERY_COMPLETED');
    expect(mergeExecutor.executeMerge).toHaveBeenCalledTimes(1);
    expect(mainVerifier.verifyMain).toHaveBeenCalledTimes(1);
  });

  // --------------------------------------------------------------------------
  // 3. wrong repository
  // --------------------------------------------------------------------------
  it('3. blocks delivery when repository is not in catalog', async () => {
    const { gate } = createMockComponents();

    const result = await gate.deliver({
      task: createTask({ project: 'unknown-repo' }),
      product: 'https://github.com/unknown-org/unadmitted-repo.git',
      sourceBranch: 'feat/unknown',
      targetBranch: 'main',
      headSha: 'commit_sha_aaa111',
    });

    expect(result.status).toBe('DELIVERY_BLOCKED');
    expect(result.errorCode).toBe('PRODUCT_NOT_IN_CATALOG');
    expect(result.errorMessage).toContain('not admitted in the canonical ProductCatalog');
  });

  // --------------------------------------------------------------------------
  // 4. wrong branch
  // --------------------------------------------------------------------------
  it('4. blocks delivery when targetBranch does not match canonical defaultBranch', async () => {
    const { gate } = createMockComponents();

    const result = await gate.deliver({
      task: createTask(),
      product: sampleProduct,
      sourceBranch: 'feat/currency-converter',
      targetBranch: 'develop', // manifest expects 'main'
      headSha: 'commit_sha_aaa111',
    });

    expect(result.status).toBe('DELIVERY_BLOCKED');
    expect(result.errorCode).toBe('TARGET_BRANCH_MISMATCH');
    expect(result.errorMessage).toContain("Target branch 'develop' does not match canonical product default branch 'main'");
  });

  // --------------------------------------------------------------------------
  // 5. kill switch
  // --------------------------------------------------------------------------
  it('5. blocks delivery immediately when global kill switch is active', async () => {
    const { gate, prLifecycleManager } = createMockComponents({
      env: {
        AUTONOMOUS_DELIVERY_ENABLED: 'true',
        PDL_KILL_SWITCH: 'true',
      },
    });

    const result = await gate.deliver({
      task: createTask(),
      product: sampleProduct,
      sourceBranch: 'feat/currency-converter',
      targetBranch: 'main',
      headSha: 'commit_sha_aaa111',
    });

    expect(result.status).toBe('DELIVERY_BLOCKED');
    expect(result.errorCode).toBe('KILL_SWITCH_ACTIVE');
    expect(prLifecycleManager.ensurePullRequest).not.toHaveBeenCalled();
  });

  // --------------------------------------------------------------------------
  // 6. successful delivery
  // --------------------------------------------------------------------------
  it('6. completes full end-to-end delivery cycle successfully', async () => {
    const heartbeatSpy = vi.fn();
    const progressSpy = vi.fn();
    const { gate } = createMockComponents();

    const result = await gate.deliver({
      task: createTask(),
      product: sampleProduct,
      sourceBranch: 'feat/currency-converter',
      targetBranch: 'main',
      headSha: 'commit_sha_aaa111',
      onHeartbeat: heartbeatSpy,
      onProgress: progressSpy,
    });

    expect(result.status).toBe('DELIVERY_COMPLETED');
    expect(result.deliveryState.phase).toBe('DELIVERY_COMPLETED');
    expect(result.deliveryState.pr?.number).toBe(42);
    expect(result.deliveryState.ci?.status).toBe('SUCCESS');
    expect(result.deliveryState.authorization?.decision).toBe('ALLOW');
    expect(result.deliveryState.postMerge?.mainAdvanced).toBe(true);
    expect(heartbeatSpy).toHaveBeenCalled();
    expect(progressSpy).toHaveBeenCalledWith('DELIVERY_COMPLETED', undefined);
  });

  // --------------------------------------------------------------------------
  // 7. CI blocked
  // --------------------------------------------------------------------------
  it('7. blocks delivery when remote CI fails or is blocked', async () => {
    const { gate, mergeExecutor } = createMockComponents({
      ciObserver: {
        observe: vi.fn().mockResolvedValue({
          status: 'FAILURE',
          observation: {
            ...baseCiObservation,
            status: 'FAILURE',
            overallConclusion: 'failure',
            allRequiredPassed: false,
            failedChecks: ['test'],
          },
          reasons: ['Required check test failed with conclusion failure'],
          blocked: true,
        }),
      },
    });

    const result = await gate.deliver({
      task: createTask(),
      product: sampleProduct,
      sourceBranch: 'feat/currency-converter',
      targetBranch: 'main',
      headSha: 'commit_sha_aaa111',
    });

    expect(result.status).toBe('DELIVERY_BLOCKED');
    expect(result.errorCode).toBe('CI_FAILURE');
    expect(result.errorMessage).toContain('Required check test failed');
    expect(mergeExecutor.executeMerge).not.toHaveBeenCalled();
  });

  // --------------------------------------------------------------------------
  // 8. governance blocked
  // --------------------------------------------------------------------------
  it('8. blocks delivery when governance is unknown or evaluation fails', async () => {
    const { gate, mergeExecutor } = createMockComponents({
      governanceReader: {
        readGovernance: vi.fn().mockResolvedValue({
          ...baseGovernanceSnapshot,
          effectiveGovernance: {
            ...baseGovernanceSnapshot.effectiveGovernance,
            isUnknown: true,
            unknownReasons: ['Ruleset returned unrecognized rule type: custom_external_validator'],
          },
        }),
      },
    });

    const result = await gate.deliver({
      task: createTask(),
      product: sampleProduct,
      sourceBranch: 'feat/currency-converter',
      targetBranch: 'main',
      headSha: 'commit_sha_aaa111',
    });

    expect(result.status).toBe('DELIVERY_BLOCKED');
    expect(result.errorCode).toBe('GOVERNANCE_UNKNOWN');
    expect(result.errorMessage).toContain('unrecognized rule type');
    expect(mergeExecutor.executeMerge).not.toHaveBeenCalled();
  });

  // --------------------------------------------------------------------------
  // 9. premerge drift
  // --------------------------------------------------------------------------
  it('9. blocks delivery when TOCTOU drift is detected during pre-merge revalidation', async () => {
    const { gate, mergeExecutor } = createMockComponents({
      preMergeRevalidator: {
        revalidate: vi.fn().mockResolvedValue({
          decision: 'DENY',
          authorized: false,
          reasons: ['Pre-merge TOCTOU drift detected: PR base branch has moved'],
          authorization: {
            decision: 'DENY',
            authorized: false,
            reasons: ['Pre-merge TOCTOU drift detected: PR base branch has moved'],
            evaluatedAt: '2026-09-14T03:05:00Z',
          },
        }),
      },
    });

    const result = await gate.deliver({
      task: createTask(),
      product: sampleProduct,
      sourceBranch: 'feat/currency-converter',
      targetBranch: 'main',
      headSha: 'commit_sha_aaa111',
    });

    expect(result.status).toBe('DELIVERY_BLOCKED');
    expect(result.errorCode).toBe('MERGE_AUTHORIZATION_DENIED');
    expect(result.errorMessage).toContain('TOCTOU drift detected');
    expect(mergeExecutor.executeMerge).not.toHaveBeenCalled();
  });

  // --------------------------------------------------------------------------
  // 10. merge conflict
  // --------------------------------------------------------------------------
  it('10. classifies HTTP 409 conflict as DELIVERY_BLOCKED with MERGE_CONFLICT', async () => {
    const { gate } = createMockComponents({
      mergeExecutor: {
        executeMerge: vi.fn().mockResolvedValue({
          status: 'CONFLICT',
          httpStatus: 409,
          reasons: ['Merge conflict detected on GitHub (409 Conflict)'],
        }),
      },
    });

    const result = await gate.deliver({
      task: createTask(),
      product: sampleProduct,
      sourceBranch: 'feat/currency-converter',
      targetBranch: 'main',
      headSha: 'commit_sha_aaa111',
    });

    expect(result.status).toBe('DELIVERY_BLOCKED');
    expect(result.errorCode).toBe('MERGE_CONFLICT');
    expect(result.errorMessage).toContain('Merge conflict detected');
  });

  // --------------------------------------------------------------------------
  // 11. merge timeout + reconciliation
  // --------------------------------------------------------------------------
  it('11. handles merge timeout gracefully when reconciler confirms merge was executed', async () => {
    const { gate, mainVerifier } = createMockComponents({
      mergeExecutor: {
        executeMerge: vi.fn().mockResolvedValue({
          status: 'MERGED', // Handled by inner reconciler
          returnedMergeSha: 'merge_sha_reconciled_after_timeout',
          reasons: ['Reconciled after PUT timeout'],
        }),
      },
    });

    const result = await gate.deliver({
      task: createTask(),
      product: sampleProduct,
      sourceBranch: 'feat/currency-converter',
      targetBranch: 'main',
      headSha: 'commit_sha_aaa111',
    });

    expect(result.status).toBe('DELIVERY_COMPLETED');
    expect(mainVerifier.verifyMain).toHaveBeenCalled();
  });

  // --------------------------------------------------------------------------
  // 12. crash recovery before PR
  // --------------------------------------------------------------------------
  it('12. creates PR normally when recovering before PR was created', async () => {
    const { gate, prLifecycleManager } = createMockComponents();

    const result = await gate.deliver({
      task: createTask(),
      product: sampleProduct,
      sourceBranch: 'feat/currency-converter',
      targetBranch: 'main',
      headSha: 'commit_sha_aaa111',
      priorDeliveryState: null,
    });

    expect(result.status).toBe('DELIVERY_COMPLETED');
    expect(prLifecycleManager.ensurePullRequest).toHaveBeenCalledTimes(1);
  });

  // --------------------------------------------------------------------------
  // 13. crash recovery after PR
  // --------------------------------------------------------------------------
  it('13. reuses existing PR snapshot without duplicating PR on crash recovery', async () => {
    const { gate, prLifecycleManager } = createMockComponents();

    const priorState = {
      phase: 'PR_OPEN' as const,
      pr: { ...basePrSnapshot, number: 99 },
      ci: null,
      governance: null,
      authorization: null,
      postMerge: null,
      reasons: [],
      updatedAt: '2026-09-14T03:00:00Z',
    };

    const result = await gate.deliver({
      task: createTask(),
      product: sampleProduct,
      sourceBranch: 'feat/currency-converter',
      targetBranch: 'main',
      headSha: 'commit_sha_aaa111',
      priorDeliveryState: priorState,
    });

    expect(result.status).toBe('DELIVERY_COMPLETED');
    // EnsurePullRequest is called with the expected branch, which lifecycle manager reuses
    expect(prLifecycleManager.ensurePullRequest).toHaveBeenCalledWith(
      expect.objectContaining({ expectedHeadSha: 'commit_sha_aaa111' })
    );
  });

  // --------------------------------------------------------------------------
  // 14. crash recovery during CI
  // --------------------------------------------------------------------------
  it('14. recovers during CI phase and observes CI without recreating PR', async () => {
    const { gate, ciObserver } = createMockComponents();

    const priorState = {
      phase: 'CI_OBSERVING' as const,
      pr: { ...basePrSnapshot, number: 42 },
      ci: null,
      governance: null,
      authorization: null,
      postMerge: null,
      reasons: [],
      updatedAt: '2026-09-14T03:00:00Z',
    };

    const result = await gate.deliver({
      task: createTask(),
      product: sampleProduct,
      sourceBranch: 'feat/currency-converter',
      targetBranch: 'main',
      headSha: 'commit_sha_aaa111',
      priorDeliveryState: priorState,
    });

    expect(result.status).toBe('DELIVERY_COMPLETED');
    expect(ciObserver.observe).toHaveBeenCalledTimes(1);
  });

  // --------------------------------------------------------------------------
  // 15. crash recovery after merge
  // --------------------------------------------------------------------------
  it('15. detects previously merged PR on recovery and skips merge mutations', async () => {
    const { gate, mergeExecutor, mainVerifier } = createMockComponents({
      mergeReconciler: {
        reconcile: vi.fn().mockResolvedValue({
          isMerged: true,
          decision: 'MERGED_CONFIRMED',
          mergeCommitSha: 'sha_already_merged_prior_attempt',
        }),
      },
    });

    const priorState = {
      phase: 'MERGING' as const,
      pr: { ...basePrSnapshot, number: 42 },
      ci: baseCiObservation,
      governance: baseGovernanceSnapshot,
      authorization: baseAuthorization,
      postMerge: null,
      reasons: [],
      updatedAt: '2026-09-14T03:00:00Z',
    };

    const result = await gate.deliver({
      task: createTask(),
      product: sampleProduct,
      sourceBranch: 'feat/currency-converter',
      targetBranch: 'main',
      headSha: 'commit_sha_aaa111',
      priorDeliveryState: priorState,
    });

    expect(result.status).toBe('DELIVERY_COMPLETED');
    // executeMerge must NOT be called when reconciler confirmed already merged
    expect(mergeExecutor.executeMerge).not.toHaveBeenCalled();
    expect(mainVerifier.verifyMain).toHaveBeenCalledTimes(1);
  });

  // --------------------------------------------------------------------------
  // 16. duplicate task recovery
  // --------------------------------------------------------------------------
  it('16. recovers idempotently when a duplicate task attempt runs for same headSha', async () => {
    const { gate, mergeExecutor } = createMockComponents({
      prLifecycleManager: {
        ensurePullRequest: vi.fn().mockResolvedValue({
          decision: 'PR_ALREADY_MERGED',
          pr: { ...basePrSnapshot, state: 'MERGED' },
          reasons: ['PR was already merged for this head SHA'],
          blocked: false,
          alreadyDelivered: true,
        }),
      },
    });

    const result = await gate.deliver({
      task: createTask(),
      product: sampleProduct,
      sourceBranch: 'feat/currency-converter',
      targetBranch: 'main',
      headSha: 'commit_sha_aaa111',
    });

    expect(result.status).toBe('DELIVERY_COMPLETED');
    expect(mergeExecutor.executeMerge).not.toHaveBeenCalled();
  });

  // --------------------------------------------------------------------------
  // 17. duplicate PR recovery
  // --------------------------------------------------------------------------
  it('17. recovers when PrLifecycleManager reports existing PR is already delivered', async () => {
    const { gate, mergeExecutor } = createMockComponents({
      prLifecycleManager: {
        ensurePullRequest: vi.fn().mockResolvedValue({
          decision: 'PR_ALREADY_MERGED',
          pr: { ...basePrSnapshot, number: 100, state: 'MERGED' },
          reasons: ['PR 100 already merged'],
          blocked: false,
          alreadyDelivered: true,
        }),
      },
    });

    const result = await gate.deliver({
      task: createTask(),
      product: sampleProduct,
      sourceBranch: 'feat/currency-converter',
      targetBranch: 'main',
      headSha: 'commit_sha_aaa111',
    });

    expect(result.status).toBe('DELIVERY_COMPLETED');
    expect(mergeExecutor.executeMerge).not.toHaveBeenCalled();
  });

  // --------------------------------------------------------------------------
  // 18. completion only after main verification
  // --------------------------------------------------------------------------
  it('18. blocks delivery if main branch does not advance after merge', async () => {
    const { gate } = createMockComponents({
      mainVerifier: {
        verifyMain: vi.fn().mockResolvedValue({
          status: 'NOT_VERIFIED',
          mainAdvanced: false,
          previousMainSha: 'initial_main_sha_000',
          currentMainSha: 'initial_main_sha_000',
          mergeCommitSha: 'merge_commit_sha_mmm',
          verifiedAt: '2026-09-14T03:06:00Z',
          reasons: ["Target branch 'main' did not advance (SHA remains unchanged)"],
        }),
      },
    });

    const result = await gate.deliver({
      task: createTask(),
      product: sampleProduct,
      sourceBranch: 'feat/currency-converter',
      targetBranch: 'main',
      headSha: 'commit_sha_aaa111',
    });

    expect(result.status).toBe('DELIVERY_BLOCKED');
    expect(result.errorCode).toBe('MAIN_NOT_VERIFIED');
    expect(result.errorMessage).toContain("Target branch 'main' did not advance");
  });

  // --------------------------------------------------------------------------
  // 19. causal verification ambiguity
  // --------------------------------------------------------------------------
  it('19. blocks delivery when PR causal verification reveals SHA mismatch', async () => {
    const { gate } = createMockComponents({
      clientMock: {
        getPullRequest: vi.fn().mockResolvedValue({
          number: 42,
          state: 'closed',
          merged: true,
          merged_at: '2026-09-14T03:05:00Z',
          merge_commit_sha: 'merge_commit_sha_mmm',
          head: { sha: 'some_other_unexpected_head_sha' }, // MISMATCH!
          base: { sha: 'initial_main_sha_000' },
        }),
      },
    });

    const result = await gate.deliver({
      task: createTask(),
      product: sampleProduct,
      sourceBranch: 'feat/currency-converter',
      targetBranch: 'main',
      headSha: 'commit_sha_aaa111',
    });

    expect(result.status).toBe('DELIVERY_BLOCKED');
    expect(result.errorCode).toBe('CAUSAL_SHA_MISMATCH');
    expect(result.errorMessage).toContain('does not match expected');
  });

  // --------------------------------------------------------------------------
  // 20. token boundary
  // --------------------------------------------------------------------------
  it('20. enforces token boundary: secrets are never leaked into deliveryState or error outputs', async () => {
    const secretToken = 'ghp_SUPER_SECRET_TOKEN_999999999999';
    const { gate } = createMockComponents({
      clientMock: {
        getPullRequest: vi.fn().mockRejectedValue(
          new Error(`Failed with authorization header: Bearer ${secretToken}`)
        ),
      },
    });

    const result = await gate.deliver({
      task: createTask(),
      product: sampleProduct,
      sourceBranch: 'feat/currency-converter',
      targetBranch: 'main',
      headSha: 'commit_sha_aaa111',
    });

    const serializedResult = JSON.stringify(result);
    // GitHubClient.sanitize scrubs tokens, ensuring boundary integrity
    expect(serializedResult).not.toContain(secretToken);
    expect(result.status).toBe('DELIVERY_BLOCKED');
  });

  // --------------------------------------------------------------------------
  // 25. Causal Verification with Concurrent Main Commit
  // --------------------------------------------------------------------------
  describe('Section 25: Causal Verification with Concurrent Main Advancement', () => {
    it('verifies delivery successfully when PR is merged for expectedHeadSha even if another commit landed on main afterwards', async () => {
      // Scenario:
      // Task A expectedHeadSha = 'commit_sha_aaa111'
      // PR merged with mergeCommitSha = 'merge_sha_aaa'
      // Meanwhile, another developer or task committed BBB to main:
      // currentMainSha = 'commit_sha_bbb222' (currentMainSha !== mergeCommitSha)
      // Main HAS advanced beyond previousMainSha ('initial_main_sha_000').
      const { gate, mainVerifier } = createMockComponents({
        mergeExecutor: {
          executeMerge: vi.fn().mockResolvedValue({
            status: 'MERGED',
            returnedMergeSha: 'merge_sha_aaa',
            httpStatus: 200,
            reasons: [],
          }),
        },
        clientMock: {
          getBranch: vi.fn().mockImplementation(async (_owner, _repo, branch) => {
            return { name: branch, commit: { sha: 'commit_sha_bbb222' } };
          }),
          getPullRequest: vi.fn().mockResolvedValue({
            number: 42,
            state: 'closed',
            merged: true,
            merged_at: '2026-09-14T03:05:00Z',
            merge_commit_sha: 'merge_sha_aaa',
            head: { sha: 'commit_sha_aaa111' },
            base: { sha: 'initial_main_sha_000' },
          }),
        },
        mainVerifier: {
          verifyMain: vi.fn().mockResolvedValue({
            status: 'MAIN_VERIFIED',
            mainAdvanced: true,
            previousMainSha: 'initial_main_sha_000',
            currentMainSha: 'commit_sha_bbb222', // BBB != merge_sha_aaa
            mergeCommitSha: 'merge_sha_aaa',
            verifiedAt: '2026-09-14T03:06:00Z',
            reasons: [],
          }),
        },
      });

      const result = await gate.deliver({
        task: createTask(),
        product: sampleProduct,
        sourceBranch: 'feat/currency-converter',
        targetBranch: 'main',
        headSha: 'commit_sha_aaa111',
      });

      expect(result.status).toBe('DELIVERY_COMPLETED');
      expect(result.deliveryState.postMerge?.mainAdvanced).toBe(true);
      expect(result.deliveryState.postMerge?.mergeCommitSha).toBe('merge_sha_aaa');
      expect(result.deliveryState.postMerge?.currentMainSha).toBe('commit_sha_bbb222');
      expect(mainVerifier.verifyMain).toHaveBeenCalledWith(
        expect.objectContaining({
          branch: 'main',
          mergeCommitSha: 'merge_sha_aaa',
        })
      );
    });
  });

  // --------------------------------------------------------------------------
  // Section 13: E2E-02 Controlled Homologation Test
  // --------------------------------------------------------------------------
  describe('Section 13: E2E-02 Controlled Delivery Homologation', () => {
    it('executes full E2E-02 controlled loop with complete audit trail', async () => {
      const progressSteps: string[] = [];
      const { gate } = createMockComponents({
        env: {
          AUTONOMOUS_DELIVERY_ENABLED: 'true',
          AUTONOMOUS_DELIVERY_ALLOWLIST: 'pub-rate-calculator',
        },
      });

      const task = createTask({ id: 'task-e2e-02' });
      const result = await gate.deliver({
        task,
        product: sampleProduct,
        sourceBranch: 'feat/currency-converter',
        targetBranch: 'main',
        headSha: 'commit_sha_aaa111',
        onProgress: (phase, details) => {
          progressSteps.push(details ? `${phase}: ${details}` : phase);
        },
      });

      expect(result.status).toBe('DELIVERY_COMPLETED');
      expect(result.deliveryState.phase).toBe('DELIVERY_COMPLETED');

      // Verify all phases occurred in sequence
      expect(progressSteps).toContain('PR_OPEN');
      expect(progressSteps).toContain('CI_OBSERVING');
      expect(progressSteps).toContain('GOVERNANCE_EVALUATING');
      expect(progressSteps).toContain('MERGE_AUTHORIZED');
      expect(progressSteps).toContain('MERGING');
      expect(progressSteps).toContain('MAIN_VERIFIED');
      expect(progressSteps).toContain('POST_MERGE_CI_OBSERVED');
      expect(progressSteps).toContain('DELIVERY_COMPLETED');

      // Verify evidence payload completeness
      expect(result.deliveryState.pr?.number).toBe(42);
      expect(result.deliveryState.ci?.allRequiredPassed).toBe(true);
      expect(result.deliveryState.governance?.effectiveGovernance.enforcementLevel).toBe('RULESET_ENFORCED');
      expect(result.deliveryState.authorization?.authorized).toBe(true);
      expect(result.deliveryState.postMerge?.mainAdvanced).toBe(true);
    });
  });
});

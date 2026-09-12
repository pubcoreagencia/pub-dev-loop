/**
 * PDL Correction Worker (Gate 3D.4).
 *
 * Extends RouterWorker to incorporate the controlled in-process workspace
 * correction loop for failures classified as CORRECTABLE_IN_WORKSPACE.
 *
 * Architecture:
 * - Inherits all multi-tier routing, fallback chains, streaming events, and cancel handling from RouterWorker.
 * - When validation tests or git hygiene fail during finalization, invokes PdlCorrectionLoop.
 * - Reruns normal validation within the active attempt workspace.
 * - Persists all correction history deterministically in tasks.result JSONB.
 */

import { rm } from 'node:fs/promises';
import { execSync } from 'node:child_process';
import type { Task, TaskRepository } from '../../domain.js';
import type { AgentProvider } from '../../providers/types.js';
import { RouterWorker, type TaskStreamEventCallback } from '../../router-worker.js';
import { type AttemptResult } from '../../worker-service.js';
import { AgentExecutionError } from '../../agent.js';
import {
  type ExecutionSpecDatabase,
  assertSealedExecutable,
  deserializeRecordSpec,
} from '../../execution/execution-spec-persistence.js';
import { prepareExecution, type PreparedExecution } from '../../execution/execution-seam.js';
import {
  DefaultFinalizationBridge,
  type FinalizationContext,
} from '../../execution/finalization-bridge.js';
import type { FinalizeResult } from '../../finalizer.js';
import { PdlCorrectionLoop, type CorrectionLoopResult } from '../correction/index.js';
import { defaultProductCatalog } from '../products/catalog.js';
import { defaultRepositoryAuthorizationPolicy } from '../security/repo-authorization.js';
import { defaultRemotePersistence } from '../persistence/remote-persistence.js';
import { PdlGovernanceEngine, defaultGovernanceEngine } from '../governance/index.js';

const LEASE_TIMEOUT_MS = Number(process.env.WORKER_LEASE_TIMEOUT_MS ?? 30000);
const HEARTBEAT_INTERVAL_MS = Number(process.env.WORKER_HEARTBEAT_MS ?? 10000);

function run(cmd: string, args: string[], cwd?: string): Promise<string> {
  const escaped = args.map(a => '"' + String(a).replace(/"/g, '\\"') + '"').join(' ');
  return new Promise((resolve, reject) => {
    try {
      const output = execSync(cmd + ' ' + escaped, {
        cwd,
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 60000,
      });
      resolve(output.toString());
    } catch (error: any) {
      reject(new Error(`${cmd} failed (${error.status ?? 'err'}): ${error.stderr || error.message}`));
    }
  });
}

export class PdlCorrectionWorker extends RouterWorker {
  constructor(
    tasks?: TaskRepository,
    provider?: AgentProvider,
    name = 'pdl-router',
    onStreamEvent?: TaskStreamEventCallback,
    executionSpecDb?: ExecutionSpecDatabase,
    governance?: PdlGovernanceEngine,
  ) {
    super(tasks, provider, name, onStreamEvent, executionSpecDb, governance);
  }

  /**
   * Overrides executeOnce to integrate PdlCorrectionLoop and PdlGovernanceEngine gates.
   */
  override async executeOnce(): Promise<boolean> {
    // Gate A: Check governance before claiming a task
    if (this.governance) {
      const claimDecision = await this.governance.evaluateClaim();
      if (!claimDecision.allowed) {
        console.log(`[PDL Worker] Task claim blocked by governance (${claimDecision.reasonCode}): ${claimDecision.reason}`);
        return false;
      }
    }

    const task = await this.tasks.claim(this.name);
    if (!task) {
      this.lastExecutedTask = null;
      return false;
    }
    this.lastExecutedTask = task;

    // Gate B: Check governance before running/executing claimed task
    if (this.governance) {
      const execDecision = await this.governance.evaluateExecution(task);
      if (!execDecision.allowed) {
        console.log(`[PDL Worker] Execution start blocked by governance (${execDecision.reasonCode}): ${execDecision.reason}`);
        this.lastExecutedTask = {
          ...task,
          status: 'BLOCKED',
          error: `Execution start blocked by governance: ${execDecision.reason}`,
        };
        await this.tasks.update(task.id, {
          status: 'BLOCKED',
          error: `Execution start blocked by governance: ${execDecision.reason}`,
          leaseOwner: null,
          leaseDeadline: null,
          workspacePath: null,
        });
        return true;
      }
    }

    this.active = true;

    let winningAttempt: AttemptResult | undefined;
    let branch: string | undefined;
    let heartbeat: NodeJS.Timeout | undefined;

    const startHeartbeat = (id: string) => {
      heartbeat = setInterval(async () => {
        await this.tasks.heartbeat(id, new Date(Date.now() + LEASE_TIMEOUT_MS)).catch(() => {});
      }, HEARTBEAT_INTERVAL_MS);
      heartbeat.unref();
    };

    const stopHeartbeat = () => {
      if (heartbeat) {
        clearInterval(heartbeat);
        heartbeat = undefined;
      }
    };

    const leaseDeadline = new Date(Date.now() + LEASE_TIMEOUT_MS);
    await this.tasks.update(task.id, {
      status: 'RUNNING',
      leaseOwner: this.name,
      leaseDeadline,
    });
    startHeartbeat(task.id);

    try {
      // 1. Authoritative read & assertion of SEALED ExecutionSpec
      let prepared: PreparedExecution;
      try {
        if (!this.executionSpecDb) {
          throw new Error('ExecutionSpecDatabase dependency missing on worker; fail closed');
        }
        const sealedRecord = await assertSealedExecutable(this.executionSpecDb, task.id);
        const executionSpec = deserializeRecordSpec(sealedRecord);
        prepared = prepareExecution(task, executionSpec);
      } catch (specError: any) {
        const errorMsg = specError instanceof Error ? specError.message : String(specError);
        await this.tasks.update(task.id, {
          status: 'FAILED',
          gitStatus: 'skipped — ExecutionSpec validation failed',
          error: errorMsg,
          result: {
            stdout: '',
            stderr: errorMsg,
            exitCode: null,
            provider: null,
            model: null,
            toolCalls: 0,
            toolRounds: 0,
            durationMs: 0,
            finalize: null,
          },
          leaseOwner: null,
          leaseDeadline: null,
          workspacePath: null,
        });
        return true;
      }

      // 2. Delegate provider attempts to inherited executeWithRetry
      winningAttempt = await this.executeWithRetry(task, task.repository, prepared);

      if (!this.active) {
        throw new Error('Worker cancelled');
      }

      // 3. Provider FAILED guard
      if (winningAttempt.status === 'FAILED') {
        this.lastFinalizeStatus = 'SKIPPED_AGENT_FAILED';
        await this.tasks.update(task.id, {
          status: 'FAILED',
          branch,
          gitStatus: 'skipped — agent returned FAILED',
          error: winningAttempt.errorCode
            ? `(${winningAttempt.errorCode}) ${winningAttempt.errorMessage || ''}`
            : winningAttempt.errorMessage || 'Agent returned FAILED status. No finalization or commit was performed.',
          result: {
            stdout: winningAttempt.stdout,
            stderr: winningAttempt.stderr,
            exitCode: winningAttempt.exitCode,
            provider: winningAttempt.provider,
            model: winningAttempt.model,
            toolCalls: winningAttempt.toolCalls,
            toolRounds: winningAttempt.toolRounds,
            durationMs: winningAttempt.durationMs,
            finalize: null,
            trace: winningAttempt.trace,
            executionResult: winningAttempt.executionResult,
          },
          leaseOwner: null,
          leaseDeadline: null,
          workspacePath: null,
        });
        return true;
      }

      branch = task.branch ?? `worker/${this.name}/${task.id}`;

      // 4. Transition to TESTING
      await this.tasks.update(task.id, {
        status: 'TESTING',
        leaseOwner: this.name,
        leaseDeadline: new Date(Date.now() + LEASE_TIMEOUT_MS),
        workspacePath: winningAttempt.workspace,
      });

      if (!winningAttempt.executionResult) {
        throw new Error('Winning attempt missing authoritative ExecutionResult');
      }

      // 5. Initial Finalization via DefaultFinalizationBridge
      const catalogProduct = defaultProductCatalog.get(task.project || task.repository || '');
      const effectiveTestCommand = process.env.TASK_TEST_COMMAND || catalogProduct?.testCommand || null;

      const bridge = new DefaultFinalizationBridge();
      const finalizationContext: FinalizationContext = {
        objective: prepared.executionSpec.objective || task.objective,
        prompt: task.prompt,
        testCommand: effectiveTestCommand,
        commitMessage: process.env.TASK_COMMIT_MESSAGE || null,
        baselineSnapshot: winningAttempt.baselineSnapshot,
        allowUnexpectedFiles: false,
        commandTimeoutMs: 60000,
      };

      const bridgeResult = await bridge.finalize(
        winningAttempt.executionResult,
        finalizationContext,
      );

      let finalizeResult: FinalizeResult = bridgeResult.finalization ?? {
        status: 'FAILED',
        commitSha: null,
        commitMessage: null,
        changedFiles: [],
        gitStatus: '',
        testsPassed: null,
        testOutput: '',
        errorCode: 'FINALIZATION_MISSING',
        errorMessage: 'Bridge did not return finalization result',
      };

      // Phase 5.5: Validate modified paths against ProductManifest allowed/protected paths
      if (catalogProduct && finalizeResult.changedFiles.length > 0) {
        const pathCheck = defaultRepositoryAuthorizationPolicy.validateModifiedPaths(
          finalizeResult.changedFiles,
          { allowedPaths: catalogProduct.allowedPaths, protectedPaths: catalogProduct.protectedPaths }
        );
        if (!pathCheck.authorized) {
          finalizeResult.status = 'FAILED';
          finalizeResult.errorCode = 'SECURITY_VIOLATION';
          finalizeResult.errorMessage = pathCheck.reason || 'Protected path violation';
        }
      }

      let correctionResult: CorrectionLoopResult | undefined;

      // 6. In-Process Correction Loop (Gate 3D.4 + Governance Gate C)
      if (finalizeResult.status === 'FAILED' && finalizeResult.errorCode !== 'SECURITY_VIOLATION') {
        const correctionDecision = this.governance
          ? await this.governance.evaluateCorrection(task, { attemptNumber: 1 })
          : { allowed: true };
        if (!correctionDecision.allowed) {
          console.log(`[PDL Worker] Correction loop blocked by governance (${(correctionDecision as any).reasonCode}): ${(correctionDecision as any).reason}`);
          finalizeResult.errorMessage = `Correction blocked by governance: ${(correctionDecision as any).reason}`;
        } else {
          correctionResult = await PdlCorrectionLoop.runCorrectionLoop({
            task,
            executionSpec: prepared.executionSpec,
            workspace: winningAttempt.workspace,
            provider: this.provider,
            baselineSnapshot: winningAttempt.baselineSnapshot,
            initialFinalizeResult: finalizeResult,
            declaredChangedFiles: winningAttempt.declaredChangedFiles,
            commandTimeoutMs: 60000,
            testCommand: effectiveTestCommand,
            commitMessage: process.env.TASK_COMMIT_MESSAGE || null,
          });

          if (correctionResult.recovered && correctionResult.finalization.status === 'COMPLETED') {
            finalizeResult = correctionResult.finalization;
            bridgeResult.finalization = finalizeResult;
          } else {
            finalizeResult = correctionResult.finalization;
            bridgeResult.finalization = finalizeResult;
          }
        }
      }

      this.lastFinalizeStatus = finalizeResult.status;

      // 7. Canonical PDL Remote Persistence if COMPLETED and Autonomy Level >= 5 + Governance Gate D
      const maxAutonomy = catalogProduct?.maxAutonomyLevel ?? 5;
      const autonomyCheck = defaultRepositoryAuthorizationPolicy.authorizeAutonomy(maxAutonomy, 'PUSH');

      if (finalizeResult.status === 'COMPLETED' && finalizeResult.commitSha) {
        const finalizationDecision = this.governance
          ? await this.governance.evaluateFinalization(task)
          : { allowed: true };
        if (!finalizationDecision.allowed) {
          console.log(`[PDL Worker] Remote finalization blocked by governance (${(finalizationDecision as any).reasonCode}): ${(finalizationDecision as any).reason}`);
          finalizeResult.status = 'FAILED';
          finalizeResult.errorCode = (finalizationDecision as any).reasonCode;
          finalizeResult.errorMessage = `Remote finalization blocked by governance: ${(finalizationDecision as any).reason}`;
          this.lastFinalizeStatus = 'FAILED';
        } else if (autonomyCheck.permitted && catalogProduct?.remotePersistenceEligible) {
          console.log(`[PDL Worker] Initiating canonical remote persistence for product '${catalogProduct.productId}'...`);
          const persistenceResult = await defaultRemotePersistence.persist({
            workspace: winningAttempt.workspace,
            product: catalogProduct,
            branch,
            localSha: finalizeResult.commitSha,
            targetRepository: task.repository,
          });
          finalizeResult.remotePersistence = persistenceResult;
          if (persistenceResult.status !== 'VERIFIED') {
            console.error(`[PDL Worker] REMOTE_PERSISTENCE_FAILED (${persistenceResult.errorCode}):`, persistenceResult.errorMessage);
            finalizeResult.status = 'FAILED';
            finalizeResult.errorCode = persistenceResult.errorCode || 'REMOTE_PERSISTENCE_FAILED';
            finalizeResult.errorMessage = persistenceResult.errorMessage || 'Remote persistence verification failed';
            this.lastFinalizeStatus = 'FAILED';
          } else {
            console.log(`[PDL Worker] Canonical remote persistence verified: SHA ${persistenceResult.remoteSha} on ${persistenceResult.repository} (${persistenceResult.branch})`);
          }
        } else {
          finalizeResult.remotePersistence = {
            status: 'NOT_REQUESTED',
            repository: catalogProduct?.repository || task.repository || '',
            branch,
            pushAttempted: false,
            pushSucceeded: false,
            localSha: finalizeResult.commitSha,
            remoteSha: null,
            remoteVerified: false,
          };
          console.log(`[PDL Worker] Remote persistence skipped (autonomy permitted: ${autonomyCheck.permitted}, eligible: ${catalogProduct?.remotePersistenceEligible}).`);
        }
      }

      // Enrich trace
      if (winningAttempt.trace) {
        winningAttempt.trace.finalizeWasCalled = this.finalizeWasCalled;
        winningAttempt.trace.finalizeStatus = this.lastFinalize;
        winningAttempt.trace.commitSha = finalizeResult.commitSha;
        winningAttempt.trace.agentId = task.agentId ?? null;
      }

      // 8. Authoritative Result Persistence (tasks.result JSONB)
      this.lastExecutedTask = {
        ...task,
        status: finalizeResult.status as Task['status'],
        branch,
        commitSha: finalizeResult.commitSha,
        gitStatus: finalizeResult.gitStatus,
        error: finalizeResult.status === 'FAILED' ? finalizeResult.errorMessage : null,
      };
      await this.tasks.update(task.id, {
        status: finalizeResult.status as Task['status'],
        branch,
        commitSha: finalizeResult.commitSha,
        gitStatus: finalizeResult.gitStatus,
        error: finalizeResult.status === 'FAILED' ? finalizeResult.errorMessage : null,
        result: {
          summary: winningAttempt.stdout.slice(-8000),
          execution: winningAttempt.execution,
          finalize: finalizeResult,
          trace: winningAttempt.trace,
          provider: winningAttempt.provider,
          model: winningAttempt.model,
          toolCalls: winningAttempt.toolCalls,
          toolRounds: winningAttempt.toolRounds,
          durationMs: winningAttempt.durationMs,
          executionResult: bridgeResult,
          corrections: correctionResult?.correctionHistory ?? [],
          recoveredViaCorrection: correctionResult?.recovered ?? false,
        },
        leaseOwner: null,
        leaseDeadline: null,
        workspacePath: null,
      });

      return true;
    } catch (error: any) {
      const details = error instanceof AgentExecutionError
        ? { code: error.message, execution: error.execution }
        : undefined;

      this.lastExecutedTask = {
        ...task,
        status: 'FAILED',
        error: error instanceof Error ? error.message.slice(0, 4000) : 'Unknown worker error',
      };
      await this.tasks.update(task.id, {
        status: 'FAILED',
        error: error instanceof Error ? error.message.slice(0, 4000) : 'Unknown worker error',
        result: details,
        leaseOwner: null,
        leaseDeadline: null,
        workspacePath: null,
      });

      return true;
    } finally {
      stopHeartbeat();
      this.active = false;
      this.state = 'IDLE';
      if (winningAttempt?.workspace) {
        await rm(winningAttempt.workspace, { recursive: true, force: true }).catch(() => {});
      }
    }
  }
}

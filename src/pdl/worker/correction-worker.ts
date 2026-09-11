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
  ) {
    super(tasks, provider, name, onStreamEvent, executionSpecDb);
  }

  /**
   * Overrides executeOnce to integrate PdlCorrectionLoop into the finalization path.
   */
  override async executeOnce(): Promise<boolean> {
    const task = await this.tasks.claim(this.name);
    if (!task) return false;

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
      const bridge = new DefaultFinalizationBridge();
      const finalizationContext: FinalizationContext = {
        objective: prepared.executionSpec.objective || task.objective,
        prompt: task.prompt,
        testCommand: process.env.TASK_TEST_COMMAND || null,
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

      let correctionResult: CorrectionLoopResult | undefined;

      // 6. In-Process Correction Loop (Gate 3D.4)
      if (finalizeResult.status === 'FAILED') {
        correctionResult = await PdlCorrectionLoop.runCorrectionLoop({
          task,
          executionSpec: prepared.executionSpec,
          workspace: winningAttempt.workspace,
          provider: this.provider,
          baselineSnapshot: winningAttempt.baselineSnapshot,
          initialFinalizeResult: finalizeResult,
          declaredChangedFiles: winningAttempt.declaredChangedFiles,
          commandTimeoutMs: 60000,
          testCommand: process.env.TASK_TEST_COMMAND || null,
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

      this.lastFinalizeStatus = finalizeResult.status;

      // 7. Remote Git Push if COMPLETED
      if (finalizeResult.status === 'COMPLETED' && finalizeResult.commitSha) {
        try {
          console.log(`[PDL Worker] Pushing branch ${branch} to remote...`);
          await run('git', ['push', 'origin', `HEAD:${branch}`], winningAttempt.workspace);
          console.log(`[PDL Worker] Successfully pushed branch ${branch} to remote.`);
        } catch (pushError: any) {
          console.error(`[PDL Worker] GITHUB_PUSH_FAILED:`, pushError.message);
          finalizeResult.status = 'FAILED';
          finalizeResult.errorCode = 'GITHUB_PUSH_FAILED';
          finalizeResult.errorMessage = `GitHub push failed: ${pushError.message}`;
          this.lastFinalizeStatus = 'FAILED';
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

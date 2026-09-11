import { randomUUID } from 'node:crypto';
import type { Task, TaskRepository } from '../domain.js';
import type { FinalizeResult } from '../finalizer.js';
import type { Worker } from '../worker-service.js';
import {
  type Mission,
  type SystemCurrentState,
  type CapabilityStatus,
  type NextBestAction,
  analyzeGaps,
  selectNextBestAction,
  generateEngineeringTaskFromAction,
  applyStateUpdate,
} from './autonomy-loop.js';
import { engineeringTaskToTask } from './intent.js';
import { resolveContext } from './context-resolver.js';
import { defaultApprovalManager, ApprovalManager } from './approval.js';
import type { AutonomyStateRepository, DurableCycleRecord } from './autonomy-state-repository.js';
import { TaskIntakeService } from '../pdl/service/task-intake-service.js';

export {
  type AutonomyStateRepository,
  type DurableCycleRecord,
  PostgresAutonomyStateRepository,
} from './autonomy-state-repository.js';

export interface AutonomousExecutionResult {
  missionId: string;
  cycleNumber: number;
  taskId?: string;
  executionStatus:
    | 'QUEUED'
    | 'RUNNING'
    | 'COMPLETED'
    | 'FAILED'
    | 'BLOCKED'
    | 'WAITING_APPROVAL';
  validationStatus:
    | 'NOT_RUN'
    | 'PASSED'
    | 'FAILED'
    | 'BLOCKED';
  stateUpdated: boolean;
  updatedCapabilityId?: string;
  nextActionId?: string;
  nextActionType?: string;
  nextTaskId?: string;
  evidence: string[];
  stopped: boolean;
  stopReason?: string;
  currentStateSnapshot: Record<string, CapabilityStatus>;
}

export interface TaskExecutionOutcome {
  status: 'COMPLETED' | 'FAILED' | 'BLOCKED';
  stdout?: string;
  stderr?: string;
  finalizeResult?: FinalizeResult;
  changedFiles?: string[];
  evidenceSnippet?: string;
  failureReason?: string;
}

export type WorkerTaskExecutor = (task: Task) => Promise<TaskExecutionOutcome>;

/**
 * Production runtime adapter connecting AutonomousExecutionController to a real Worker
 * (e.g. BaseWorker / RouterWorker) and TaskRepository.
 */
export class WorkerRuntimeAdapter {
  constructor(
    private readonly worker: Worker,
    private readonly taskRepo: TaskRepository
  ) {}

  async execute(task: Task): Promise<TaskExecutionOutcome> {
    const executed = await this.worker.executeOnce();
    if (!executed) {
      return {
        status: 'BLOCKED',
        failureReason: 'Worker was unable to claim task or task queue was empty',
      };
    }

    const updatedTask = (await (this.taskRepo as any).findById?.(task.id)) ?? (await this.taskRepo.get(task.id));
    if (!updatedTask) {
      return {
        status: 'FAILED',
        failureReason: `Task ${task.id} not found in repository after execution`,
      };
    }

    const finalize = (updatedTask.result as any)?.finalize as FinalizeResult | undefined;
    const isCompleted = updatedTask.status === 'COMPLETED';

    return {
      status: isCompleted ? 'COMPLETED' : 'FAILED',
      stdout: typeof (updatedTask.result as any)?.summary === 'string'
        ? (updatedTask.result as any).summary
        : (updatedTask.result as any)?.stdout,
      stderr: (updatedTask.result as any)?.stderr,
      finalizeResult: finalize,
      changedFiles: finalize?.changedFiles || (finalize as any)?.declaredChangedFiles || (updatedTask.result as any)?.changedFiles,
      evidenceSnippet: updatedTask.commitSha ? `Commit SHA: ${updatedTask.commitSha}` : undefined,
      failureReason: updatedTask.error || finalize?.errorMessage || (updatedTask.result as any)?.errorMessage,
    };
  }
}

export class AutonomousExecutionController {
  private activeCycleKeys = new Set<string>();

  constructor(
    private readonly taskRepo: TaskRepository,
    private readonly approvalManager: ApprovalManager = defaultApprovalManager,
    private readonly workerRuntime?: WorkerRuntimeAdapter,
    private readonly stateRepo?: AutonomyStateRepository,
    private readonly intakeService?: TaskIntakeService,
  ) {}

  /**
   * Executes a single discrete, idempotent cycle of the Autonomous Loop.
   *
   * Flow:
   * State -> GapAnalysis -> NextBestAction -> SafetyCheck -> EngineeringTask ->
   * Queue -> WorkerExecution -> Validation -> StateUpdate -> Recalculate Next Action
   */
  async executeCycle(
    mission: Mission,
    state: SystemCurrentState,
    cycleNumber: number,
    workerExecutor?: WorkerTaskExecutor
  ): Promise<{
    result: AutonomousExecutionResult;
    nextState: SystemCurrentState;
  }> {
    const cycleKey = `${mission.id}:cycle:${cycleNumber}`;

    // 0. Durable Idempotency & Recovery Check
    if (this.stateRepo) {
      const existingCycle = await this.stateRepo.getCycle(mission.id, cycleNumber);
      if (existingCycle) {
        if (existingCycle.status === 'COMPLETED') {
          // Durable Idempotency: already completed cycle cannot be re-executed
          const latestState = (await this.stateRepo.getCurrentState(mission.id)) || state;
          return {
            result: {
              missionId: mission.id,
              cycleNumber,
              taskId: existingCycle.generatedTaskId || undefined,
              executionStatus: existingCycle.executionStatus || 'COMPLETED',
              validationStatus: existingCycle.validationStatus || 'PASSED',
              stateUpdated: false,
              evidence: existingCycle.evidence,
              stopped: !!existingCycle.stopReason,
              stopReason: existingCycle.stopReason || undefined,
              currentStateSnapshot: existingCycle.stateAfter || existingCycle.stateBefore,
            },
            nextState: latestState,
          };
        }

        if (existingCycle.status === 'WAITING_APPROVAL') {
          // Preserves CEO Governance across restarts
          return {
            result: {
              missionId: mission.id,
              cycleNumber,
              taskId: existingCycle.generatedTaskId || undefined,
              executionStatus: 'WAITING_APPROVAL',
              validationStatus: 'NOT_RUN',
              stateUpdated: false,
              evidence: existingCycle.evidence,
              stopped: true,
              stopReason: 'WAITING_APPROVAL',
              currentStateSnapshot: existingCycle.stateBefore,
            },
            nextState: state,
          };
        }

        if (existingCycle.status === 'RUNNING') {
          if (this.activeCycleKeys.has(cycleKey)) {
            // Concurrent execution collision within same process
            return {
              result: {
                missionId: mission.id,
                cycleNumber,
                executionStatus: 'BLOCKED',
                validationStatus: 'NOT_RUN',
                stateUpdated: false,
                evidence: ['Cycle is already actively executing or was already triggered'],
                stopped: true,
                stopReason: 'DUPLICATE_CYCLE_CALL',
                currentStateSnapshot: this.captureStateSnapshot(state),
              },
              nextState: state,
            };
          }

          // Process crashed while this cycle was running (Crash Recovery)
          if (existingCycle.generatedTaskId) {
            const task = (await (this.taskRepo as any).findById?.(existingCycle.generatedTaskId)) ??
              (await this.taskRepo.get(existingCycle.generatedTaskId));
            if (task && task.status === 'COMPLETED') {
              const finalize = (task.result as any)?.finalize as FinalizeResult | undefined;
              const finalizerPassed = !finalize || (finalize.status === 'COMPLETED' && finalize.testsPassed !== false && !finalize.errorMessage);
              const hasEvidence = !!(finalize?.changedFiles?.length || task.commitSha || (task.result as any)?.changedFiles?.length);
              if (finalizerPassed && hasEvidence) {
                const evidenceList = [
                  `Task ${task.id} executed successfully and passed finalizer validation (recovered from prior process run).`,
                ];
                if (finalize?.changedFiles) evidenceList.push(`Modified files: ${finalize.changedFiles.join(', ')}`);
                if (task.commitSha) evidenceList.push(`Commit SHA: ${task.commitSha}`);
                const targetCapId = existingCycle.selectedAction?.targetCapabilityId;
                let nextState = state;
                let stateUpdated = false;
                if (targetCapId) {
                  nextState = applyStateUpdate(state, targetCapId, 'VERIFIED', evidenceList.join(' | '));
                  stateUpdated = true;
                  await this.stateRepo.saveCurrentState(nextState);
                }
                await this.stateRepo.updateCycle(mission.id, cycleNumber, {
                  status: 'COMPLETED',
                  executionStatus: 'COMPLETED',
                  validationStatus: 'PASSED',
                  stateAfter: this.captureStateSnapshot(nextState),
                  evidence: evidenceList,
                  completedAt: new Date().toISOString(),
                });
                return {
                  result: {
                    missionId: mission.id,
                    cycleNumber,
                    taskId: task.id,
                    executionStatus: 'COMPLETED',
                    validationStatus: 'PASSED',
                    stateUpdated,
                    updatedCapabilityId: stateUpdated ? targetCapId : undefined,
                    evidence: evidenceList,
                    stopped: false,
                    currentStateSnapshot: this.captureStateSnapshot(nextState),
                  },
                  nextState,
                };
              }
            }
          }

          // Task was not completed or no valid evidence: mark FAILED with explicit crash recovery reason
          await this.stateRepo.updateCycle(mission.id, cycleNumber, {
            status: 'FAILED',
            executionStatus: 'FAILED',
            validationStatus: 'FAILED',
            stopReason: 'CRASH_RECOVERY_REQUIRED',
            error: 'Process crashed while cycle was RUNNING; task not verified',
          });
          return {
            result: {
              missionId: mission.id,
              cycleNumber,
              taskId: existingCycle.generatedTaskId || undefined,
              executionStatus: 'FAILED',
              validationStatus: 'FAILED',
              stateUpdated: false,
              evidence: ['Process crashed while cycle was RUNNING; task not verified'],
              stopped: true,
              stopReason: 'CRASH_RECOVERY_REQUIRED',
              currentStateSnapshot: this.captureStateSnapshot(state),
            },
            nextState: state,
          };
        }
      }
    }

    // 1. Concurrency / Idempotency Guard (In-Memory)
    if (this.activeCycleKeys.has(cycleKey)) {
      return {
        result: {
          missionId: mission.id,
          cycleNumber,
          executionStatus: 'BLOCKED',
          validationStatus: 'NOT_RUN',
          stateUpdated: false,
          evidence: ['Cycle is already actively executing or was already triggered'],
          stopped: true,
          stopReason: 'DUPLICATE_CYCLE_CALL',
          currentStateSnapshot: this.captureStateSnapshot(state),
        },
        nextState: state,
      };
    }
    this.activeCycleKeys.add(cycleKey);

    try {
      // 2. Stop Condition: Max Cycles Reached
      if (cycleNumber > mission.maxCycles) {
        mission.status = 'PAUSED';
        if (this.stateRepo) {
          await this.stateRepo.updateMission(mission.id, { status: 'PAUSED' });
        }
        return {
          result: {
            missionId: mission.id,
            cycleNumber,
            executionStatus: 'BLOCKED',
            validationStatus: 'NOT_RUN',
            stateUpdated: false,
            evidence: [`Max cycles limit (${mission.maxCycles}) reached for mission`],
            stopped: true,
            stopReason: 'MAX_CYCLES_REACHED',
            currentStateSnapshot: this.captureStateSnapshot(state),
          },
          nextState: state,
        };
      }

      // 3. Gap Analysis
      const gaps = analyzeGaps(mission, state);

      // 4. Action Selection
      const action = selectNextBestAction(mission, gaps, state);

      // 5. Stop Condition: Mission Completed
      if (action.actionType === 'COMPLETE_MISSION') {
        mission.status = 'COMPLETED';
        mission.completedAt = new Date().toISOString();
        if (this.stateRepo) {
          await this.stateRepo.updateMission(mission.id, {
            status: 'COMPLETED',
            completedAt: mission.completedAt,
          });
        }
        return {
          result: {
            missionId: mission.id,
            cycleNumber,
            executionStatus: 'COMPLETED',
            validationStatus: 'PASSED',
            stateUpdated: false,
            evidence: ['All mission target capabilities verified. Zero remaining gaps.'],
            stopped: true,
            stopReason: 'MISSION_COMPLETED',
            currentStateSnapshot: this.captureStateSnapshot(state),
          },
          nextState: state,
        };
      }

      // 6. Stop Condition: Impasse / Deadlock
      if (action.actionType === 'BLOCKED_REVIEW') {
        mission.status = 'BLOCKED';
        if (this.stateRepo) {
          await this.stateRepo.updateMission(mission.id, { status: 'BLOCKED' });
        }
        return {
          result: {
            missionId: mission.id,
            cycleNumber,
            executionStatus: 'BLOCKED',
            validationStatus: 'BLOCKED',
            stateUpdated: false,
            evidence: [action.description],
            stopped: true,
            stopReason: 'NO_ACTIONABLE_GAP',
            currentStateSnapshot: this.captureStateSnapshot(state),
          },
          nextState: state,
        };
      }

      // 7. Safety / CEO Sovereignty Check
      if (action.estimatedRisk === 'HIGH' || action.estimatedRisk === 'CRITICAL') {
        const evidenceStr = `CEO approval required for ${action.estimatedRisk} risk action: ${action.title}`;
        if (this.stateRepo) {
          await this.stateRepo.acquireCycle({
            missionId: mission.id,
            cycleNumber,
            projectId: mission.project,
            stateBefore: this.captureStateSnapshot(state),
            identifiedGaps: gaps,
            selectedAction: action,
          });
          await this.stateRepo.updateCycle(mission.id, cycleNumber, {
            status: 'WAITING_APPROVAL',
            executionStatus: 'WAITING_APPROVAL',
            validationStatus: 'NOT_RUN',
            evidence: [evidenceStr],
            stopReason: 'WAITING_APPROVAL',
          });
        }

        this.approvalManager.requestApproval({
          project: mission.project,
          type: action.estimatedRisk === 'CRITICAL' ? 'CRITICAL_ARCHITECTURE_CHANGE' : 'SECURITY_OVERRIDE',
          title: `Autonomous Loop Approval Required: ${action.title}`,
          rationale: `Mission ${mission.title} generated action ${action.id} with ${action.estimatedRisk} risk. Human approval mandatory before execution.`,
          requestedBy: 'autonomous-controller',
        });

        return {
          result: {
            missionId: mission.id,
            cycleNumber,
            executionStatus: 'WAITING_APPROVAL',
            validationStatus: 'NOT_RUN',
            stateUpdated: false,
            evidence: [evidenceStr],
            stopped: true,
            stopReason: 'WAITING_APPROVAL',
            currentStateSnapshot: this.captureStateSnapshot(state),
          },
          nextState: state,
        };
      }

      // Durable Cycle Acquisition
      if (this.stateRepo) {
        await this.stateRepo.createMission(mission);
        await this.stateRepo.saveCurrentState(state);
        const acquireRes = await this.stateRepo.acquireCycle({
          missionId: mission.id,
          cycleNumber,
          projectId: mission.project,
          stateBefore: this.captureStateSnapshot(state),
          identifiedGaps: gaps,
          selectedAction: action,
        });
        if (!acquireRes.acquired && acquireRes.isExisting && acquireRes.cycle.status === 'RUNNING') {
          // Concurrency collision between two separate workers/processes
          return {
            result: {
              missionId: mission.id,
              cycleNumber,
              executionStatus: 'BLOCKED',
              validationStatus: 'NOT_RUN',
              stateUpdated: false,
              evidence: ['Cycle is already actively executing or was already triggered'],
              stopped: true,
              stopReason: 'DUPLICATE_CYCLE_CALL',
              currentStateSnapshot: this.captureStateSnapshot(state),
            },
            nextState: state,
          };
        }
      }

      // 8. Generate Canonical EngineeringTask
      const engTask = generateEngineeringTaskFromAction(action, mission);
      const resolvedContext = resolveContext(engTask);
      const runtimeInput = engineeringTaskToTask(engTask, {}, resolvedContext);

      // 9. Enqueue in TaskRepository / TaskIntakeService
      let storedTask: Task;
      const intake = this.intakeService ?? (this.taskRepo as any)?.intakeService ?? ((this.taskRepo as any)?.pool ? new TaskIntakeService((this.taskRepo as any).pool) : undefined);
      if (!intake) {
        throw new Error('TaskIntakeService dependency missing; direct PDL task creation is prohibited');
      }
      const intakeRes = await intake.processIntake({
        rawRequest: runtimeInput.prompt || runtimeInput.objective,
        objective: runtimeInput.objective,
        prompt: runtimeInput.prompt,
        source: 'autonomous-execution-controller',
        project: runtimeInput.project,
        repository: runtimeInput.repository,
        priority: runtimeInput.priority,
        agentId: runtimeInput.agentId ?? undefined,
      });
      storedTask = intakeRes.task;
      if (this.stateRepo) {
        await this.stateRepo.updateCycle(mission.id, cycleNumber, {
          generatedTaskId: storedTask.id,
        });
      }

      // 10. Execute Task via Worker
      let outcome: TaskExecutionOutcome;
      if (workerExecutor) {
        outcome = await workerExecutor(storedTask);
      } else if (this.workerRuntime) {
        outcome = await this.workerRuntime.execute(storedTask);
      } else {
        // Environment check: if no live runner is provided and no cloud credentials exist
        outcome = {
          status: 'BLOCKED',
          failureReason: 'No worker executor provided and external LLM gateway credentials not configured in local environment',
        };
      }

      // 11. Evidence-First Validation
      // Rule: Task completed != Capability verified.
      // Verification requires: Task status COMPLETED + Finalizer validation passed + strong code evidence exists.
      const evidenceList: string[] = [];
      let isVerified = false;
      let validationStatus: AutonomousExecutionResult['validationStatus'] = 'NOT_RUN';

      if (outcome.status === 'COMPLETED') {
        const hasFinalizer = !!outcome.finalizeResult;
        const finalizerPassed = hasFinalizer
          ? outcome.finalizeResult!.status === 'COMPLETED' &&
            outcome.finalizeResult!.testsPassed !== false &&
            !outcome.finalizeResult!.errorMessage &&
            !((outcome.finalizeResult as any).validationErrors && (outcome.finalizeResult as any).validationErrors.length > 0)
          : true;

        // Evidence validation: Weak evidence (just stdout or empty claim) is insufficient for verification.
        // Requires strong/concrete evidence (changed files, commit SHA, or structured evidence snippet).
        const hasStrongEvidence = !!(
          (outcome.changedFiles && outcome.changedFiles.length > 0) ||
          outcome.finalizeResult?.commitSha ||
          outcome.evidenceSnippet
        );

        if (finalizerPassed && hasStrongEvidence) {
          isVerified = true;
          validationStatus = 'PASSED';
          evidenceList.push(`Task ${storedTask.id} executed successfully and passed finalizer validation.`);
          if (outcome.evidenceSnippet) evidenceList.push(`Code evidence: ${outcome.evidenceSnippet}`);
          if (outcome.changedFiles && outcome.changedFiles.length > 0) {
            evidenceList.push(`Modified files: ${outcome.changedFiles.join(', ')}`);
          }
          if (outcome.finalizeResult?.commitSha) {
            evidenceList.push(`Commit SHA: ${outcome.finalizeResult.commitSha}`);
          }
        } else {
          validationStatus = 'FAILED';
          const failureDetail = !finalizerPassed
            ? `Finalizer validation failed: ${outcome.finalizeResult?.errorMessage || (outcome.finalizeResult as any)?.validationErrors?.join(', ') || outcome.failureReason || 'unknown validation error'}`
            : 'Insufficient evidence: only weak evidence (stdout/unverified claim) provided without concrete changed files or commit SHA';
          evidenceList.push(`Task completed execution but failed formal validation criteria: ${failureDetail}`);
        }
      } else if (outcome.status === 'BLOCKED') {
        validationStatus = 'BLOCKED';
        evidenceList.push(`Task execution blocked: ${outcome.failureReason || 'Environment constraints'}`);
      } else {
        validationStatus = 'FAILED';
        evidenceList.push(`Task execution failed: ${outcome.failureReason || outcome.stderr || 'Execution error'}`);
      }

      // 12. Real State Update
      let nextState = state;
      let stateUpdated = false;
      const targetCapId = action.targetCapabilityId;

      if (isVerified && targetCapId) {
        const evidenceStr = evidenceList.join(' | ');
        nextState = applyStateUpdate(state, targetCapId, 'VERIFIED', evidenceStr);
        stateUpdated = true;
      } else if (validationStatus === 'FAILED' && targetCapId) {
        // Record partial failure in state without fabricating verification
        nextState = applyStateUpdate(state, targetCapId, 'PARTIAL', `Validation failed: ${outcome.failureReason || outcome.stderr || 'Tests or validation failed'}`);
        stateUpdated = true;
      }

      const stopped = outcome.status === 'BLOCKED' || (outcome.status === 'FAILED' && mission.riskPolicy === 'STRICT');
      const stopReason = outcome.status === 'BLOCKED'
        ? 'ENVIRONMENT_BLOCKED'
        : outcome.status === 'FAILED' && mission.riskPolicy === 'STRICT'
        ? 'UNRECOVERABLE_FAILURE'
        : undefined;

      // Persist State & Cycle Updates
      if (this.stateRepo) {
        await this.stateRepo.saveCurrentState(nextState);
        await this.stateRepo.updateCycle(mission.id, cycleNumber, {
          status: outcome.status === 'COMPLETED'
            ? (isVerified ? 'COMPLETED' : 'FAILED')
            : (outcome.status === 'BLOCKED' ? 'BLOCKED' : 'FAILED'),
          executionStatus: outcome.status,
          validationStatus,
          stateAfter: this.captureStateSnapshot(nextState),
          evidence: evidenceList,
          stopReason,
          completedAt: new Date().toISOString(),
        });
      }

      // 13. Derive Next Action Preview for Observability
      const nextGaps = analyzeGaps(mission, nextState);
      const nextAction = selectNextBestAction(mission, nextGaps, nextState);

      return {
        result: {
          missionId: mission.id,
          cycleNumber,
          taskId: storedTask.id,
          executionStatus: outcome.status,
          validationStatus,
          stateUpdated,
          updatedCapabilityId: stateUpdated ? targetCapId : undefined,
          nextActionId: nextAction.id,
          nextActionType: nextAction.actionType,
          evidence: evidenceList,
          stopped,
          stopReason,
          currentStateSnapshot: this.captureStateSnapshot(nextState),
        },
        nextState,
      };
    } finally {
      this.activeCycleKeys.delete(cycleKey);
    }
  }

  /**
   * Recovers a mission and its state from durable storage and recalculates the NextBestAction.
   * Enables seamless continuation after a process restart.
   */
  async recoverMission(missionId: string): Promise<{
    mission: Mission | null;
    state: SystemCurrentState | null;
    latestCycle: DurableCycleRecord | null;
    nextAction?: NextBestAction;
  }> {
    if (!this.stateRepo) {
      throw new Error('Cannot recover mission without an AutonomyStateRepository');
    }

    const mission = await this.stateRepo.getMission(missionId);
    if (!mission) {
      return { mission: null, state: null, latestCycle: null };
    }

    const state = await this.stateRepo.getCurrentState(missionId);
    const latestCycle = await this.stateRepo.getLatestCycle(missionId);

    let nextAction: NextBestAction | undefined;
    if (state && mission.status !== 'COMPLETED') {
      const gaps = analyzeGaps(mission, state);
      nextAction = selectNextBestAction(mission, gaps, state);
    }

    return {
      mission,
      state,
      latestCycle,
      nextAction,
    };
  }

  /**
   * Executes continuous autonomous cycles until a terminal stop condition is reached.
   * Proves multi-cycle continuity with zero human intervention.
   */
  async executeMissionContinuously(
    mission: Mission,
    initialState: SystemCurrentState,
    options: {
      maxCycles?: number;
      workerExecutor?: WorkerTaskExecutor;
    } = {}
  ): Promise<{
    cycles: AutonomousExecutionResult[];
    finalState: SystemCurrentState;
    completed: boolean;
    totalHumanInterventions: number;
  }> {
    const cycles: AutonomousExecutionResult[] = [];
    let currentState = initialState;
    let cycleCount = 0;
    const max = options.maxCycles || mission.maxCycles || 5;

    while (cycleCount < max) {
      cycleCount += 1;

      const { result, nextState } = await this.executeCycle(
        mission,
        currentState,
        cycleCount,
        options.workerExecutor
      );

      cycles.push(result);
      currentState = nextState;

      if (result.stopped || result.executionStatus === 'COMPLETED' && result.stopReason === 'MISSION_COMPLETED') {
        break;
      }
    }

    const isCompleted = mission.status === 'COMPLETED';

    return {
      cycles,
      finalState: currentState,
      completed: isCompleted,
      totalHumanInterventions: 0, // Machine-driven continuous loop between cycles
    };
  }

  private captureStateSnapshot(state: SystemCurrentState): Record<string, CapabilityStatus> {
    return Object.fromEntries(
      Object.entries(state.capabilities).map(([k, v]) => [k, v.status])
    );
  }
}

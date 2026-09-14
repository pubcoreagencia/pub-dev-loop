/**
 * Post-Task Experience Gate (Phase E2).
 *
 * Establishes the single deterministic post-task cognitive write boundary in PDL:
 *   EXECUTION → POST-TASK EXPERIENCE CAPTURE → PDL EXPERIENCE ADAPTER → NEURAL EXPERIENCE SERVICE
 *
 * CRITICAL INVARIANTS:
 * - Experience writeback is strictly an OBSERVATIONAL / EPISODIC recording boundary.
 * - It possesses NO authority to alter task authorization, reverse governance approvals,
 *   or retroactively fail an execution that already succeeded.
 * - Fail-open by default: Neural unavailable/internal_error/invalid_request does NOT
 *   invalidate or fail a verified completed task.
 * - Preserves all 5 writeback semantic statuses distinctly:
 *   ACCEPTED, DUPLICATE, INVALID_REQUEST, UNAVAILABLE, INTERNAL_ERROR.
 * - Candidate findings are preserved factually without automatic promotion
 *   (CANDIDATE != VALIDATED != ADOPTED). Zero LLM lesson generation.
 * - Zero provenance fabrication: absent fields remain null/undefined.
 * - Idempotency: identical outcome submissions yield DUPLICATE on repeat.
 * - CQRS separation: strictly uses PubNeuralExperienceClient (Query port remains separate).
 */

import type { Task } from '../../domain.js';
import type {
  CandidateFindingPayload,
  ExperienceWritebackStatus,
  NeuralExperienceRecordPayload,
  PdlExperienceWritebackResult,
  TaskEvidencePayload,
} from './experience-types.js';
import {
  DefaultPubNeuralExperienceAdapter,
  createExperienceRecordFromTaskState,
  type PubNeuralExperienceClient,
} from './experience-adapter.js';
import type { NeuralTaskStatePayload } from './types.js';

export interface PostTaskExperienceInput {
  task: Task;
  commitSha?: string | null;
  remoteSha?: string | null;
  branch?: string | null;
  status?: string;
  hasMaterialChanges?: boolean;
  evidence?: {
    validationPassed: boolean;
    worktreeClean: boolean;
    pushSucceeded: boolean;
    remoteVerified: boolean;
    runtimeVerified?: boolean;
    deliveryVerified?: boolean;
    governanceVerified?: boolean;
    testSummary?: Record<string, number>;
  };
  candidateFindings?: CandidateFindingPayload[];
  trace?: Record<string, unknown>;
  completedAt?: string;
  ingestionSource?: string;
  taskStatePayload?: NeuralTaskStatePayload;
}

export interface PostTaskObservability {
  writebackAttempted: boolean;
  taskId: string;
  status: ExperienceWritebackStatus;
  eventId?: string;
  idempotencyKey?: string;
  isDuplicate: boolean;
  isAccepted: boolean;
  isUnavailable: boolean;
  isError: boolean;
  isInvalidRequest: boolean;
  candidateFindingsCount: number;
  recordedAt?: string;
  durationMs: number;
  reason?: string;
  errorCategory?: string;
}

export interface PostTaskExperienceResult {
  taskId: string;
  writebackAttempted: boolean;
  status: ExperienceWritebackStatus;
  isAccepted: boolean;
  isDuplicate: boolean;
  isUnavailable: boolean;
  isError: boolean;
  isInvalidRequest: boolean;
  eventId?: string;
  idempotencyKey?: string;
  candidateFindingsCount: number;
  recordedAt?: string;
  reason?: string;
  observability: PostTaskObservability;
  metadata?: Record<string, unknown>;
  recordPayload?: NeuralExperienceRecordPayload;
}

export interface PostTaskExperienceGateConfig {
  client?: PubNeuralExperienceClient;
  failOpen?: boolean;
}

export class PostTaskExperienceGate {
  private readonly client: PubNeuralExperienceClient;
  private readonly failOpen: boolean;

  constructor(config?: PostTaskExperienceGateConfig) {
    this.client = config?.client ?? new DefaultPubNeuralExperienceAdapter();
    this.failOpen = config?.failOpen ?? true;
  }

  /**
   * Constructs the factual NeuralExperienceRecordPayload from Task and execution evidence.
   * Never fabricates missing fields.
   */
  public buildExperienceRecord(
    input: PostTaskExperienceInput
  ): NeuralExperienceRecordPayload {
    // If an authentic NeuralTaskStatePayload is provided, adapt it cleanly
    if (input.taskStatePayload) {
      return createExperienceRecordFromTaskState(
        input.taskStatePayload,
        input.candidateFindings
      );
    }

    const { task } = input;
    const taskId = task.id.trim();
    const projectId =
      (task.project && task.project.trim()) ||
      ((task as any).projectId && (task as any).projectId.trim()) ||
      'default';
    const repository = task.repository ? task.repository.trim() : '';
    const branch =
      (input.branch && input.branch.trim()) ||
      (task.branch && task.branch.trim()) ||
      'main';
    const commitSha =
      (input.commitSha !== undefined ? input.commitSha : task.commitSha) || null;
    const remoteSha =
      (input.remoteSha !== undefined ? input.remoteSha : commitSha) || null;
    const status = input.status || task.status || 'COMPLETED';
    const objective =
      (task.objective && task.objective.trim()) ||
      (task.prompt && task.prompt.trim()) ||
      '';

    const changedFiles: string[] = Array.isArray(
      (task.result as any)?.finalize?.changedFiles
    )
      ? [...(task.result as any).finalize.changedFiles]
      : Array.isArray((task.result as any)?.changedFiles)
      ? [...(task.result as any).changedFiles]
      : [];

    const evidence: TaskEvidencePayload = {
      validationPassed: Boolean(input.evidence?.validationPassed),
      worktreeClean: Boolean(input.evidence?.worktreeClean),
      pushSucceeded: Boolean(input.evidence?.pushSucceeded),
      remoteVerified: Boolean(input.evidence?.remoteVerified),
      runtimeVerified: input.evidence?.runtimeVerified,
      deliveryVerified: input.evidence?.deliveryVerified,
      governanceVerified: input.evidence?.governanceVerified,
      testSummary: input.evidence?.testSummary,
    };

    // Candidate findings: preserved factually without automatic promotion
    let candidateFindings: CandidateFindingPayload[] = [];
    if (Array.isArray(input.candidateFindings)) {
      candidateFindings = [...input.candidateFindings];
    } else if (Array.isArray((task.result as any)?.candidateFindings)) {
      candidateFindings = [...(task.result as any).candidateFindings];
    }

    const completedAt = input.completedAt || new Date().toISOString();
    const ingestionSource = input.ingestionSource || 'pdl-post-task-gate';
    const trace = input.trace || (task.result as any)?.trace;

    return {
      taskId,
      projectId,
      repository,
      branch,
      commitSha: commitSha ? commitSha.trim() : null,
      remoteSha: remoteSha ? remoteSha.trim() : null,
      status,
      objective,
      agentId: task.agentId ? String(task.agentId).trim() : null,
      changedFiles,
      evidence,
      candidateFindings,
      trace: trace ? { ...trace } : undefined,
      completedAt,
      ingestionSource,
    };
  }

  /**
   * Dispatches the post-task experience writeback to PUB Neural.
   * Evaluates semantic status, enforces fail-open policy, and records observability.
   */
  public async evaluatePostTaskExperience(
    input: PostTaskExperienceInput
  ): Promise<PostTaskExperienceResult> {
    const start = Date.now();
    const recordPayload = this.buildExperienceRecord(input);

    let writebackResult: PdlExperienceWritebackResult;
    try {
      writebackResult = await this.client.recordExperience(recordPayload);
    } catch (err: any) {
      if (!this.failOpen) {
        throw err;
      }
      writebackResult = {
        status: 'UNAVAILABLE',
        taskId: recordPayload.taskId,
        isAccepted: false,
        isDuplicate: false,
        isUnavailable: true,
        isError: false,
        candidateFindingsCount: recordPayload.candidateFindings?.length ?? 0,
        reason: `PostTaskExperienceGate transport failure: ${err?.message || String(err)}`,
      };
    }

    const durationMs = Date.now() - start;
    const status = writebackResult.status;
    const isAccepted = status === 'ACCEPTED';
    const isDuplicate = status === 'DUPLICATE' || writebackResult.isDuplicate;
    const isUnavailable = status === 'UNAVAILABLE';
    const isInvalidRequest = status === 'INVALID_REQUEST';
    const isError = status === 'INTERNAL_ERROR' || isInvalidRequest;

    let errorCategory: string | undefined;
    if (isUnavailable) errorCategory = 'TRANSPORT_UNAVAILABLE';
    else if (isInvalidRequest) errorCategory = 'SCHEMA_VALIDATION_FAILED';
    else if (isError) errorCategory = 'NEURAL_INTERNAL_ERROR';

    const observability: PostTaskObservability = {
      writebackAttempted: true,
      taskId: recordPayload.taskId,
      status,
      eventId: writebackResult.eventId,
      idempotencyKey: writebackResult.idempotencyKey,
      isDuplicate,
      isAccepted,
      isUnavailable,
      isError,
      isInvalidRequest,
      candidateFindingsCount: writebackResult.candidateFindingsCount,
      recordedAt: writebackResult.recordedAt,
      durationMs,
      reason: writebackResult.reason,
      errorCategory,
    };

    return {
      taskId: recordPayload.taskId,
      writebackAttempted: true,
      status,
      isAccepted,
      isDuplicate,
      isUnavailable,
      isError,
      isInvalidRequest,
      eventId: writebackResult.eventId,
      idempotencyKey: writebackResult.idempotencyKey,
      candidateFindingsCount: writebackResult.candidateFindingsCount,
      recordedAt: writebackResult.recordedAt,
      reason: writebackResult.reason,
      observability,
      metadata: writebackResult.metadata,
      recordPayload,
    };
  }
}

export const defaultPostTaskExperienceGate = new PostTaskExperienceGate();

/**
 * PDL Neural Experience Adapter (Phase D).
 * Bridges PDL task completion and execution evidence with the canonical PUB Neural Experience Writeback port.
 * Enforces:
 *   - Clean transport separation (Transport vs Domain)
 *   - Strict preservation of all 5 writeback semantic statuses (ACCEPTED, DUPLICATE, INVALID_REQUEST, UNAVAILABLE, INTERNAL_ERROR)
 *   - Candidate Findings retention (Candidate != Validated; never auto-promoted)
 *   - Zero provenance fabrication: absent fields remain null/undefined
 *   - Clean reuse of existing NeuralTaskStatePayload without mutation
 */

import { CANONICAL_KNOWLEDGE_CLASSES } from './query-types.js';
import type {
  CandidateFindingPayload,
  ExperienceWritebackResponsePayload,
  ExperienceWritebackStatus,
  NeuralExperienceRecordPayload,
  PdlExperienceWritebackResult,
  TaskEvidencePayload,
} from './experience-types.js';
import {
  HttpNeuralExperienceTransport,
  type NeuralExperienceTransport,
} from './experience-transport.js';
import type { NeuralTaskStatePayload } from './types.js';

export interface PubNeuralExperienceClient {
  recordExperience(
    record: NeuralExperienceRecordPayload
  ): Promise<PdlExperienceWritebackResult>;
}

export class DefaultPubNeuralExperienceAdapter implements PubNeuralExperienceClient {
  private readonly transport: NeuralExperienceTransport;

  /**
   * Initializes the PDL Neural Experience Adapter.
   * @param transport Pluggable transport boundary. Defaults to HttpNeuralExperienceTransport,
   * which in Phase D operates strictly offline (returning UNAVAILABLE) pending network transport activation.
   */
  constructor(transport?: NeuralExperienceTransport) {
    this.transport = transport ?? new HttpNeuralExperienceTransport();
  }

  async recordExperience(
    record: NeuralExperienceRecordPayload
  ): Promise<PdlExperienceWritebackResult> {
    // 1. Structural Validation of Experience Record
    const validationError = this.validateRecord(record);
    if (validationError) {
      return {
        status: 'INVALID_REQUEST',
        taskId: record?.taskId || 'unknown',
        isAccepted: false,
        isDuplicate: false,
        isUnavailable: false,
        isError: true,
        candidateFindingsCount: record?.candidateFindings?.length ?? 0,
        reason: validationError,
      };
    }

    // 2. Dispatch through transport boundary
    let responsePayload: ExperienceWritebackResponsePayload;
    try {
      responsePayload = await this.transport.sendExperience(record);
    } catch (err: any) {
      return {
        status: 'UNAVAILABLE',
        taskId: record.taskId,
        isAccepted: false,
        isDuplicate: false,
        isUnavailable: true,
        isError: false,
        candidateFindingsCount: record.candidateFindings?.length ?? 0,
        reason: `Transport layer execution failure: ${err?.message || String(err)}`,
      };
    }

    // 3. Map Canonical Response to PDL Domain Result
    return this.adaptResponse(record.taskId, responsePayload);
  }

  private validateRecord(record: NeuralExperienceRecordPayload): string | null {
    if (!record) return 'Experience record is mandatory';
    if (!record.taskId || typeof record.taskId !== 'string' || !record.taskId.trim()) {
      return "Field 'taskId' must be a non-empty string";
    }
    if (!record.projectId || typeof record.projectId !== 'string' || !record.projectId.trim()) {
      return "Field 'projectId' must be a non-empty string";
    }
    if (!record.repository || typeof record.repository !== 'string' || !record.repository.trim()) {
      return "Field 'repository' must be a non-empty string";
    }
    if (!record.branch || typeof record.branch !== 'string' || !record.branch.trim()) {
      return "Field 'branch' must be a non-empty string";
    }
    if (!record.objective || typeof record.objective !== 'string' || !record.objective.trim()) {
      return "Field 'objective' must be a non-empty string";
    }
    if (!record.completedAt || typeof record.completedAt !== 'string' || !record.completedAt.trim()) {
      return "Field 'completedAt' must be a non-empty string";
    }
    if (isNaN(Date.parse(record.completedAt))) {
      return `Field 'completedAt' must be a valid ISO timestamp, got '${record.completedAt}'`;
    }
    if (!record.evidence || typeof record.evidence !== 'object') {
      return "Field 'evidence' must be a valid TaskEvidence object";
    }

    // Validate Candidate Findings
    if (record.candidateFindings) {
      if (!Array.isArray(record.candidateFindings)) {
        return "Field 'candidateFindings' must be an array";
      }
      for (const finding of record.candidateFindings) {
        if (!finding.title || typeof finding.title !== 'string' || !finding.title.trim()) {
          return "Candidate finding must have a non-empty 'title'";
        }
        if (!finding.statement || typeof finding.statement !== 'string' || !finding.statement.trim()) {
          return "Candidate finding must have a non-empty 'statement'";
        }
        if (!CANONICAL_KNOWLEDGE_CLASSES.includes(finding.findingType)) {
          return `Invalid knowledge class '${finding.findingType}' in candidate finding. Allowed: ${CANONICAL_KNOWLEDGE_CLASSES.join(', ')}`;
        }
      }
    }

    return null;
  }

  private adaptResponse(
    fallbackTaskId: string,
    res: ExperienceWritebackResponsePayload
  ): PdlExperienceWritebackResult {
    const status = (res.status as ExperienceWritebackStatus) || 'INTERNAL_ERROR';
    const taskId = res.taskId || res.task_id || fallbackTaskId;
    const isAccepted = status === 'ACCEPTED';
    const isDuplicate = status === 'DUPLICATE' || Boolean(res.isDuplicate || res.is_duplicate);
    const isUnavailable = status === 'UNAVAILABLE';
    const isError = status === 'INTERNAL_ERROR' || status === 'INVALID_REQUEST';

    return {
      status,
      taskId,
      isAccepted,
      isDuplicate,
      isUnavailable,
      isError,
      eventId: res.eventId || res.event_id || undefined,
      idempotencyKey: res.idempotencyKey || res.idempotency_key || undefined,
      candidateFindingsCount:
        res.candidateFindingsCount ?? res.candidate_findings_count ?? 0,
      recordedAt: res.recordedAt || res.recorded_at || undefined,
      reason: res.reason ?? undefined,
      metadata: res.metadata,
    };
  }
}

/**
 * Adapter utility that converts an existing PDL NeuralTaskStatePayload
 * into a canonical NeuralExperienceRecordPayload without mutating the original payload.
 */
export function createExperienceRecordFromTaskState(
  payload: NeuralTaskStatePayload,
  candidateFindings?: CandidateFindingPayload[]
): NeuralExperienceRecordPayload {
  const evidence: TaskEvidencePayload = {
    validationPassed: Boolean(payload.evidence.validationPassed),
    worktreeClean: Boolean(payload.evidence.worktreeClean),
    pushSucceeded: Boolean(payload.evidence.pushSucceeded),
    remoteVerified: Boolean(payload.evidence.remoteVerified),
    runtimeVerified: payload.evidence.runtimeVerified,
  };

  return {
    taskId: payload.taskId,
    projectId: payload.projectId,
    repository: payload.repository,
    branch: payload.branch,
    commitSha: payload.commitSha,
    remoteSha: payload.remoteSha,
    status: payload.status,
    objective: payload.objective,
    agentId: payload.agentId ?? null,
    changedFiles: [...payload.changedFiles],
    evidence,
    candidateFindings: candidateFindings ? [...candidateFindings] : [],
    trace: payload.trace ? { ...payload.trace } : undefined,
    completedAt: payload.completedAt,
    ingestionSource: payload.ingestionSource,
  };
}

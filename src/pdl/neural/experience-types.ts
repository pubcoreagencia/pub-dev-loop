/**
 * Canonical Experience Writeback Contracts and Enums for PDL <-> PUB Neural integration (Phase D).
 * Mirrors the canonical schemas established in PUB Neural Phase A and Phase D.
 */

import type { KnowledgeClass } from './query-types.js';

export type ExperienceWritebackStatus =
  | 'ACCEPTED'
  | 'DUPLICATE'
  | 'INVALID_REQUEST'
  | 'UNAVAILABLE'
  | 'INTERNAL_ERROR';

export interface TaskEvidencePayload {
  validationPassed: boolean;
  worktreeClean: boolean;
  pushSucceeded: boolean;
  remoteVerified: boolean;
  runtimeVerified?: boolean;
  testSummary?: Record<string, number>;
  deliveryVerified?: boolean;
  governanceVerified?: boolean;
}

export interface CandidateFindingPayload {
  findingType: KnowledgeClass;
  title: string;
  statement: string;
  scope?: 'PROJECT' | 'GLOBAL';
  confidence?: number;
}

export interface NeuralExperienceRecordPayload {
  taskId: string;
  projectId: string;
  repository: string;
  branch: string;
  status: 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'TIMED_OUT' | string;
  objective: string;
  evidence: TaskEvidencePayload;
  completedAt: string;
  commitSha?: string | null;
  remoteSha?: string | null;
  agentId?: string | null;
  changedFiles?: string[];
  candidateFindings?: CandidateFindingPayload[];
  trace?: Record<string, unknown>;
  ingestionSource?: string;
}

export interface ExperienceWritebackResponsePayload {
  status: ExperienceWritebackStatus;
  taskId?: string;
  task_id?: string;
  eventId?: string | null;
  event_id?: string | null;
  idempotencyKey?: string | null;
  idempotency_key?: string | null;
  isDuplicate?: boolean;
  is_duplicate?: boolean;
  candidateFindingsCount?: number;
  candidate_findings_count?: number;
  recordedAt?: string | null;
  recorded_at?: string | null;
  reason?: string | null;
  metadata?: Record<string, unknown>;
}

export interface PdlExperienceWritebackResult {
  status: ExperienceWritebackStatus;
  taskId: string;
  isAccepted: boolean;
  isDuplicate: boolean;
  isUnavailable: boolean;
  isError: boolean;
  eventId?: string;
  idempotencyKey?: string;
  candidateFindingsCount: number;
  recordedAt?: string;
  reason?: string;
  metadata?: Record<string, unknown>;
}

/**
 * PDL Persistence Gate, Invariant 6.
 *
 * A task that produced a material workspace change is not CONCLUDED merely
 * because a local commit exists. Completion requires validated work,
 * a commit, a clean tree, and a verified remote SHA. Production-affecting
 * work may additionally require runtime verification at the caller boundary.
 *
 * This module is deliberately pure: it evaluates evidence already produced
 * by the finalization/persistence layers and fails closed when evidence is
 * missing or contradictory.
 */

import type { RemotePersistenceResult } from './types.js';
import type { Task } from '../../domain.js';

export type PersistenceGateCode =
  | 'PERSISTENCE_GATE_PASSED'
  | 'VALIDATION_REQUIRED'
  | 'COMMIT_REQUIRED'
  | 'WORKTREE_MUST_BE_CLEAN'
  | 'REMOTE_PERSISTENCE_REQUIRED'
  | 'REMOTE_PERSISTENCE_MUST_BE_VERIFIED'
  | 'REMOTE_SHA_MISMATCH'
  | 'RUNTIME_VERIFICATION_REQUIRED';

export type PersistenceGateStatus = 'COMPLETED' | 'BLOCKED' | 'FAILED';

export interface PersistenceGateInput {
  validationPassed: boolean;
  commitSha: string | null;
  gitStatus?: string;
  remotePersistence?: RemotePersistenceResult | null;
  /** True when this completion is expected to contain a material change. */
  materialChange?: boolean;
  /** True for changes whose correctness depends on deployed runtime state. */
  runtimeVerificationRequired?: boolean;
  /** Caller-provided runtime verification evidence. */
  runtimeVerified?: boolean;
  /** Optional task reference for PP isolation (prototypeSessionId) */
  task?: Task;
  /** Legacy/caller alias for materialChange */
  hasMaterialChanges?: boolean;
  /** Legacy/caller alias for gitStatus === 'clean' */
  worktreeClean?: boolean;
}

export interface PersistenceGateResult {
  allowed: boolean;
  passed: boolean;
  status: PersistenceGateStatus;
  code: PersistenceGateCode;
  reasonCode: string;
  reason: string;
  evaluatedAt: string;
  details?: Record<string, unknown>;
}

export type PersistenceGateDecision = PersistenceGateResult;

const SHA_RE = /^[0-9a-f]{40}$/i;

/**
 * Evaluate the minimum evidence required to mark a material task complete.
 * Never infers success from a local commit alone.
 */
export function evaluatePersistenceGate(input: PersistenceGateInput): PersistenceGateResult {
  const evaluatedAt = new Date().toISOString();
  const isClean = input.worktreeClean !== undefined
    ? input.worktreeClean
    : (input.gitStatus !== undefined ? input.gitStatus.trim() === 'clean' : false);

  const isMaterial = input.task?.prototypeSessionId
    ? false
    : (input.materialChange !== undefined ? input.materialChange : Boolean(input.hasMaterialChanges));

  const details = {
    validationPassed: input.validationPassed,
    commitSha: input.commitSha,
    worktreeClean: isClean,
    materialChange: isMaterial,
    remoteStatus: input.remotePersistence?.status,
    pushSucceeded: input.remotePersistence?.pushSucceeded,
    remoteVerified: input.remotePersistence?.remoteVerified,
    remoteSha: input.remotePersistence?.remoteSha ?? null,
    runtimeVerificationRequired: input.runtimeVerificationRequired,
    runtimeVerified: input.runtimeVerified,
  };

  if (!input.validationPassed) {
    return blocked('VALIDATION_REQUIRED', 'Validation evidence is required before completion.', evaluatedAt, details, 'FAILED');
  }

  if (isMaterial && !input.commitSha) {
    return blocked('COMMIT_REQUIRED', 'A material change cannot be complete without a commit SHA.', evaluatedAt, details, 'BLOCKED');
  }

  if (!isClean) {
    return blocked('WORKTREE_MUST_BE_CLEAN', 'Completion requires a clean working tree.', evaluatedAt, details, 'BLOCKED');
  }

  if (isMaterial) {
    if (!input.remotePersistence) {
      return blocked('REMOTE_PERSISTENCE_REQUIRED', 'Material work must be pushed and remotely verified before completion.', evaluatedAt, details, 'BLOCKED');
    }

    if (input.remotePersistence.status !== 'VERIFIED' || !input.remotePersistence.pushSucceeded || !input.remotePersistence.remoteVerified) {
      return blocked('REMOTE_PERSISTENCE_MUST_BE_VERIFIED', 'Remote persistence evidence is missing or not verified.', evaluatedAt, details, 'BLOCKED');
    }

    if (!input.commitSha || input.remotePersistence.remoteSha !== input.commitSha || !SHA_RE.test(input.commitSha)) {
      return blocked('REMOTE_SHA_MISMATCH', 'The verified remote SHA must exactly match the local commit SHA.', evaluatedAt, details, 'BLOCKED');
    }
  }

  if (input.runtimeVerificationRequired && input.runtimeVerified !== true) {
    return blocked('RUNTIME_VERIFICATION_REQUIRED', 'Production-affecting work requires explicit runtime verification before completion.', evaluatedAt, details, 'BLOCKED');
  }

  return {
    allowed: true,
    passed: true,
    status: 'COMPLETED',
    code: 'PERSISTENCE_GATE_PASSED',
    reasonCode: 'PERSISTENCE_GATE_PASSED',
    reason: 'Persistence evidence satisfies Invariant 6.',
    evaluatedAt,
    details,
  };
}

function blocked(
  code: PersistenceGateCode,
  reason: string,
  evaluatedAt: string,
  details: Record<string, unknown>,
  status: PersistenceGateStatus = 'BLOCKED',
): PersistenceGateResult {
  return {
    allowed: false,
    passed: false,
    status,
    code,
    reasonCode: code,
    reason,
    evaluatedAt,
    details,
  };
}

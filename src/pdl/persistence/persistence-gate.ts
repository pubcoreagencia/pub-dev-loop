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

export type PersistenceGateCode =
  | 'PERSISTENCE_GATE_PASSED'
  | 'VALIDATION_REQUIRED'
  | 'COMMIT_REQUIRED'
  | 'WORKTREE_MUST_BE_CLEAN'
  | 'REMOTE_PERSISTENCE_REQUIRED'
  | 'REMOTE_PERSISTENCE_MUST_BE_VERIFIED'
  | 'REMOTE_SHA_MISMATCH'
  | 'RUNTIME_VERIFICATION_REQUIRED';

export interface PersistenceGateInput {
  validationPassed: boolean;
  commitSha: string | null;
  gitStatus: string;
  remotePersistence?: RemotePersistenceResult;
  /** True when this completion is expected to contain a material change. */
  materialChange: boolean;
  /** True for changes whose correctness depends on deployed runtime state. */
  runtimeVerificationRequired?: boolean;
  /** Caller-provided runtime verification evidence. */
  runtimeVerified?: boolean;
}

export interface PersistenceGateResult {
  allowed: boolean;
  code: PersistenceGateCode;
  reason: string;
}

const SHA_RE = /^[0-9a-f]{40}$/i;

/**
 * Evaluate the minimum evidence required to mark a material task complete.
 * Never infers success from a local commit alone.
 */
export function evaluatePersistenceGate(input: PersistenceGateInput): PersistenceGateResult {
  if (!input.validationPassed) {
    return blocked('VALIDATION_REQUIRED', 'Validation evidence is required before completion.');
  }

  if (input.materialChange && !input.commitSha) {
    return blocked('COMMIT_REQUIRED', 'A material change cannot be complete without a commit SHA.');
  }

  if (input.gitStatus.trim() !== 'clean') {
    return blocked('WORKTREE_MUST_BE_CLEAN', 'Completion requires a clean working tree.');
  }

  if (input.materialChange) {
    if (!input.remotePersistence) {
      return blocked('REMOTE_PERSISTENCE_REQUIRED', 'Material work must be pushed and remotely verified before completion.');
    }

    if (input.remotePersistence.status !== 'VERIFIED' || !input.remotePersistence.pushSucceeded || !input.remotePersistence.remoteVerified) {
      return blocked('REMOTE_PERSISTENCE_MUST_BE_VERIFIED', 'Remote persistence evidence is missing or not verified.');
    }

    if (!input.commitSha || input.remotePersistence.remoteSha !== input.commitSha || !SHA_RE.test(input.commitSha)) {
      return blocked('REMOTE_SHA_MISMATCH', 'The verified remote SHA must exactly match the local commit SHA.');
    }
  }

  if (input.runtimeVerificationRequired && input.runtimeVerified !== true) {
    return blocked('RUNTIME_VERIFICATION_REQUIRED', 'Production-affecting work requires explicit runtime verification before completion.');
  }

  return {
    allowed: true,
    code: 'PERSISTENCE_GATE_PASSED',
    reason: 'Persistence evidence satisfies Invariant 6.',
  };
}

function blocked(code: PersistenceGateCode, reason: string): PersistenceGateResult {
  return { allowed: false, code, reason };
}

import { describe, expect, it } from 'vitest';
import { evaluatePersistenceGate } from '../../src/pdl/persistence/persistence-gate.js';

const SHA = 'a'.repeat(40);

function verifiedRemote() {
  return {
    status: 'VERIFIED' as const,
    repository: 'pubcoreagencia/pub-dev-loop',
    branch: 'feat/persistence-gate',
    pushAttempted: true,
    pushSucceeded: true,
    localSha: SHA,
    remoteSha: SHA,
    remoteVerified: true,
  };
}

describe('PDL Persistence Gate, Invariant 6', () => {
  it('passes when validation, commit, clean tree and remote verification all exist', () => {
    const result = evaluatePersistenceGate({
      validationPassed: true,
      commitSha: SHA,
      gitStatus: 'clean',
      remotePersistence: verifiedRemote(),
      materialChange: true,
    });

    expect(result.allowed).toBe(true);
    expect(result.code).toBe('PERSISTENCE_GATE_PASSED');
  });

  it('blocks material completion when commit is missing', () => {
    const result = evaluatePersistenceGate({
      validationPassed: true,
      commitSha: null,
      gitStatus: 'clean',
      materialChange: true,
    });

    expect(result.allowed).toBe(false);
    expect(result.code).toBe('COMMIT_REQUIRED');
  });

  it('blocks material completion when remote evidence is absent', () => {
    const result = evaluatePersistenceGate({
      validationPassed: true,
      commitSha: SHA,
      gitStatus: 'clean',
      materialChange: true,
    });

    expect(result.allowed).toBe(false);
    expect(result.code).toBe('REMOTE_PERSISTENCE_REQUIRED');
  });

  it('blocks a remote SHA that differs from the local commit', () => {
    const remote = verifiedRemote();
    remote.remoteSha = 'b'.repeat(40);

    const result = evaluatePersistenceGate({
      validationPassed: true,
      commitSha: SHA,
      gitStatus: 'clean',
      remotePersistence: remote,
      materialChange: true,
    });

    expect(result.allowed).toBe(false);
    expect(result.code).toBe('REMOTE_SHA_MISMATCH');
  });

  it('blocks a dirty worktree', () => {
    const result = evaluatePersistenceGate({
      validationPassed: true,
      commitSha: SHA,
      gitStatus: ' M src/file.ts',
      remotePersistence: verifiedRemote(),
      materialChange: true,
    });

    expect(result.allowed).toBe(false);
    expect(result.code).toBe('WORKTREE_MUST_BE_CLEAN');
  });

  it('blocks missing validation before considering persistence', () => {
    const result = evaluatePersistenceGate({
      validationPassed: false,
      commitSha: SHA,
      gitStatus: 'clean',
      remotePersistence: verifiedRemote(),
      materialChange: true,
    });

    expect(result.allowed).toBe(false);
    expect(result.code).toBe('VALIDATION_REQUIRED');
  });

  it('requires runtime verification for production-affecting work', () => {
    const result = evaluatePersistenceGate({
      validationPassed: true,
      commitSha: SHA,
      gitStatus: 'clean',
      remotePersistence: verifiedRemote(),
      materialChange: true,
      runtimeVerificationRequired: true,
      runtimeVerified: false,
    });

    expect(result.allowed).toBe(false);
    expect(result.code).toBe('RUNTIME_VERIFICATION_REQUIRED');
  });

  it('allows a validated no-change task without remote persistence', () => {
    const result = evaluatePersistenceGate({
      validationPassed: true,
      commitSha: null,
      gitStatus: 'clean',
      materialChange: false,
    });

    expect(result.allowed).toBe(true);
  });
});

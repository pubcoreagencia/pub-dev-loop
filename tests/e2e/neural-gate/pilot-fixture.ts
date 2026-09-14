/**
 * Pilot Repository Fixture for Phase F — Controlled End-to-End Gate Integration.
 *
 * Repository: pubcoreagencia/pub-ecom
 * Project ID: pub-ecom
 * Domain: E-commerce checkout, transactional billing, and idempotency guarantees.
 * Classification: E2E TEST FIXTURE (Controlled validation only).
 */

import type { Task } from '../../../src/domain.js';
import type { CandidateFindingPayload, TaskEvidencePayload } from '../../../src/pdl/neural/experience-types.js';
import type { PersistenceGateDecision } from '../../../src/pdl/persistence/persistence-gate.js';
import type { RemotePersistenceResult } from '../../../src/pdl/persistence/types.js';

export const PILOT_REPOSITORY = 'pubcoreagencia/pub-ecom';
export const PILOT_PROJECT_ID = 'pub-ecom';
export const PILOT_TASK_ID = 'TASK-ECOM-401';
export const PILOT_BRANCH = 'feat/checkout-idempotency';
export const PILOT_INITIAL_COMMIT = 'ecom-c0ffee-20260914-fixture';
export const PILOT_FINAL_COMMIT = 'ecom-final-9081726354';
export const PILOT_AGENT_ID = 'developer';

export function createPilotTask(overrides?: Partial<Task>): Task {
  return {
    id: PILOT_TASK_ID,
    project: PILOT_PROJECT_ID,
    repository: PILOT_REPOSITORY,
    objective: 'Verify checkout idempotency and transaction integrity for pub-ecom',
    prompt: 'Implement transactional idempotency key handling in checkout pipeline. Respect existing architectural rules.',
    status: 'ASSIGNED',
    priority: 1,
    worker: 'pdl-router',
    result: null,
    error: null,
    branch: PILOT_BRANCH,
    commitSha: PILOT_INITIAL_COMMIT,
    gitStatus: 'clean',
    createdAt: new Date('2026-09-14T05:00:00.000Z'),
    updatedAt: new Date('2026-09-14T05:00:00.000Z'),
    leaseOwner: 'pdl-router',
    leaseDeadline: new Date('2026-09-14T05:30:00.000Z'),
    heartbeatAt: new Date('2026-09-14T05:00:00.000Z'),
    workspacePath: `/tmp/workspaces/${PILOT_PROJECT_ID}/${PILOT_TASK_ID}`,
    prototypeSessionId: null,
    agentId: PILOT_AGENT_ID,
    tenantId: 'pub-holding',
    ...overrides,
  };
}

export function createPilotCandidateFindings(): CandidateFindingPayload[] {
  return [
    {
      findingType: 'LESSON',
      title: 'Checkout Idempotency Storage Contention',
      statement: 'High concurrency checkout workflows require dedicated Redis or DB row locks to prevent duplicate charge attempts.',
      scope: 'PROJECT',
      confidence: 0.94,
    },
    {
      findingType: 'PATTERN',
      title: 'Checkout Header Key Extraction',
      statement: 'Extract idempotency keys from X-Idempotency-Key header with UUIDv4 validation before beginning transaction.',
      scope: 'PROJECT',
      confidence: 0.91,
    },
  ];
}

export function createPilotEvidence(overrides?: Partial<TaskEvidencePayload>): TaskEvidencePayload {
  return {
    validationPassed: true,
    worktreeClean: true,
    pushSucceeded: true,
    remoteVerified: true,
    runtimeVerified: true,
    deliveryVerified: true,
    governanceVerified: true,
    testSummary: { total: 12, passed: 12, failed: 0 },
    ...overrides,
  };
}

export function createPilotGateDecision(overrides?: Partial<PersistenceGateDecision>): PersistenceGateDecision {
  return {
    passed: true,
    status: 'COMPLETED',
    evaluatedAt: '2026-09-14T05:10:00.000Z',
    details: {
      hasMaterialChanges: true,
      validationPassed: true,
      commitSha: PILOT_FINAL_COMMIT,
      worktreeClean: true,
      remoteStatus: 'VERIFIED',
      pushSucceeded: true,
      remoteVerified: true,
      remoteSha: PILOT_FINAL_COMMIT,
      runtimeVerificationRequired: true,
      runtimeVerified: true,
      deliveryVerified: true,
      governanceVerified: true,
    },
    ...overrides,
  };
}

export function createPilotRemotePersistence(overrides?: Partial<RemotePersistenceResult>): RemotePersistenceResult {
  return {
    status: 'VERIFIED',
    repository: PILOT_REPOSITORY,
    branch: PILOT_BRANCH,
    pushAttempted: true,
    pushSucceeded: true,
    localSha: PILOT_FINAL_COMMIT,
    remoteSha: PILOT_FINAL_COMMIT,
    remoteVerified: true,
    ...overrides,
  };
}

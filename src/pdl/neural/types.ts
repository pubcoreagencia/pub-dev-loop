import type { Task, TaskStatus } from '../../domain.js';
import type { PersistenceGateDecision } from '../persistence/persistence-gate.js';
import type { RemotePersistenceResult } from '../persistence/types.js';

/**
 * PubNeuralIngestionContract
 *
 * Canonical boundary contract between PUB DEV LOOP (Engine & Persistence)
 * and PUB NEURAL (Cognitive Memory, Episodic Vectors & Institutional Learning).
 */

export interface NeuralTaskEvidence {
  validationPassed: boolean;
  worktreeClean: boolean;
  pushSucceeded: boolean;
  remoteVerified: boolean;
  runtimeVerified?: boolean;
}

export interface NeuralTaskStatePayload {
  taskId: string;
  projectId: string;
  repository: string;
  branch: string;
  commitSha: string | null;
  remoteSha: string | null;
  status: TaskStatus;
  objective: string;
  agentId?: string | null;
  changedFiles: string[];
  evidence: NeuralTaskEvidence;
  trace?: Record<string, unknown>;
  completedAt: string;
  ingestionSource: 'pdl-persistence-gate';
}

export type NeuralIngestionStatus =
  | 'PREPARED'
  | 'SUBMITTED'
  | 'ACKNOWLEDGED'
  | 'PERSISTED'
  | 'FAILED'
  | 'UNAVAILABLE';

export interface PubNeuralAck {
  acknowledged: boolean;
  persisted: boolean;
  status: NeuralIngestionStatus;
  eventId?: string;
  memoryId?: string;
  remoteTimestamp?: string;
  targetSystem: string;
  error?: string;
  details?: Record<string, unknown>;
}

export interface PubNeuralClient {
  readonly endpoint?: string;
  submit(payload: NeuralTaskStatePayload): Promise<PubNeuralAck>;
  isAvailable(): Promise<boolean>;
}

export interface NeuralIngestionResult {
  ingested: boolean;
  status: NeuralIngestionStatus;
  eventId?: string;
  memoryId?: string;
  contractVersion: '1.0.0';
  targetSystem: 'pubcoreagencia/pub-neural';
  timestamp: string;
  error?: string;
  details?: Record<string, unknown>;
}

export interface PubNeuralBridge {
  ingestTaskCompleted(input: {
    task: Task;
    commitSha: string | null;
    remoteSha: string | null;
    branch: string;
    hasMaterialChanges: boolean;
    remotePersistence?: RemotePersistenceResult | null;
    gateDecision: PersistenceGateDecision;
  }): Promise<NeuralIngestionResult>;
  getClient?(): PubNeuralClient;
}

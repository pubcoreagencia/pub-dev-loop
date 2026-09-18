/**
 * PDL Agent Runtime Contract — P1.1
 *
 * Architectural contract only. This layer does not replace the existing
 * scheduler, worker, execution engine, provider, finalizer, or Neural bridge.
 */

export const PDL_AGENT_RUNTIME_CONTRACT_VERSION = 'pdl-agent-runtime-v1';

export type RuntimePhase =
  | 'RECEIVED' | 'AUTHORIZED' | 'EXECUTING' | 'VALIDATING'
  | 'CORRECTING' | 'REVIEWING' | 'FINALIZING' | 'PERSISTING'
  | 'COMPLETED' | 'FAILED' | 'BLOCKED' | 'CANCELLED';

export type RuntimeTerminalStatus =
  | 'COMPLETED' | 'FAILED' | 'BLOCKED' | 'CANCELLED';

export interface RuntimeContext {
  contractVersion: string;
  runId: string;
  taskId: string;
  attemptId?: string;
  projectId?: string | null;
  repository: string;
  branch?: string | null;
  workspace?: string | null;
  provider?: string | null;
  model?: string | null;
}

export interface RuntimeEvidence {
  phase: RuntimePhase;
  timestamp: string;
  event: string;
  summary?: string;
  data?: Record<string, unknown>;
}

export interface RuntimeResult {
  status: RuntimeTerminalStatus;
  context: RuntimeContext;
  evidence: RuntimeEvidence[];
  errorCode?: string | null;
  errorMessage?: string | null;
}

export interface AgentRuntime {
  execute(context: RuntimeContext): Promise<RuntimeResult>;
}

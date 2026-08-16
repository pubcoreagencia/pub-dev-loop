import type { Task } from '../domain.js';
import type { ExecutionResult } from '../executor.js';

export type ProviderKind = 'mock' | 'codex-api' | '9router';

export interface ProviderTaskResult {
  status: 'COMPLETED' | 'FAILED' | 'TIMED_OUT' | 'START_ERROR';
  provider: ProviderKind;
  model: string | null;
  exitCode: number | null;
  durationMs: number;
  stdout: string;
  stderr: string;
  changedFiles: string[];
  commit: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  execution?: ExecutionResult;
  toolCalls?: number;
  toolRounds?: number;
  commitMessage?: string | null;
  testsPassed?: boolean | null;
}

export interface AgentProvider {
  readonly kind: ProviderKind;
  readonly model: string | null;
  execute(task: Task, workspace: string): Promise<ProviderTaskResult>;
  health(): Promise<{ available: boolean; details: string }>;
  capabilities(): string[];
  metadata(): Record<string, string | null>;
}

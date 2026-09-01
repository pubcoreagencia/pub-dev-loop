export type TaskState =
  | "QUEUED"
  | "ASSIGNED"
  | "RUNNING"
  | "TESTING"
  | "COMPLETED"
  | "FAILED"
  | "BLOCKED"
  | "CANCELLED"
  | "NEEDS_REVIEW";

export interface Task {
  id: string;
  project: string;
  repository: string;
  objective: string;
  prompt: string;
  status: TaskState;
  priority: number;
  worker?: string | null;
  result?: Record<string, unknown> | null;
  error?: string | null;
  branch?: string | null;
  commitSha?: string | null;
  gitStatus?: string | null;
  createdAt: string;
  updatedAt: string;
  leaseOwner?: string | null;
  leaseDeadline?: string | null;
  heartbeatAt?: string | null;
  workspacePath?: string | null;
  prototypeSessionId?: string | null;
}

export interface CreateTaskInput {
  project: string;
  repository: string;
  objective: string;
  prompt: string;
  priority?: number;
}

export interface PrototypeSession {
  id: string;
  project: string;
  status: string;
  createdAt?: string;
  updatedAt: string;
  repository?: string;
  previewUrl?: string | null;
  previewRuntime?: string | null;
  workspacePath?: string | null;
  branch?: string;
  lastCheckpointSha?: string | null;
  promptCount?: number;
  mode?: string;
}

export interface LogicalProject {
  project: string;
  normalizedProject: string;
  latestSession: PrototypeSession;
  sessionCount: number;
  sessions: PrototypeSession[];
}

// Backward compatibility alias
export type Project = PrototypeSession;



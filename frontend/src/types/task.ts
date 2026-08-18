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
}

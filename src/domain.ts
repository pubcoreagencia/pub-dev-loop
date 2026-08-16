export const TASK_STATUSES = ['QUEUED','ASSIGNED','RUNNING','TESTING','COMPLETED','FAILED','BLOCKED','CANCELLED','NEEDS_REVIEW'] as const;
export type TaskStatus = typeof TASK_STATUSES[number];
export interface Task {
  id: string;
  project: string;
  repository: string;
  objective: string;
  prompt: string;
  status: TaskStatus;
  priority: number;
  worker: string | null;
  result: Record<string, unknown> | null;
  error: string | null;
  branch: string | null;
  commitSha: string | null;
  gitStatus: string | null;
  createdAt: Date;
  updatedAt: Date;
  /** Lease fields for crash recovery (TASK-000032) */
  leaseOwner: string | null;
  leaseDeadline: Date | null;
  heartbeatAt: Date | null;
  workspacePath: string | null;
}
export type CreateTask = Pick<Task, 'project'|'repository'|'objective'|'prompt'> & Partial<Pick<Task,'priority'>>;
export interface TaskRepository {
  create(input: CreateTask): Promise<Task>;
  list(): Promise<Task[]>;
  get(id: string): Promise<Task | null>;
  claim(worker: string): Promise<Task | null>;
  update(id: string, patch: Partial<Task>): Promise<Task | null>;
  cancel(id: string): Promise<Task | null>;
  retry(id: string): Promise<Task | null>;
  /** Reclaim tasks stuck in transient states (TASK-000032) */
  reclaimStuck(worker: string, leaseWindowMs: number, now: Date): Promise<number>;
  /** Heartbeat: refresh lease deadline for an active task (TASK-000032) */
  heartbeat(id: string, deadline: Date): Promise<boolean>;
}

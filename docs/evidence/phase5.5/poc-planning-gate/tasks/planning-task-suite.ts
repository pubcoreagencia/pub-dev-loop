export type TaskTier = 'SIMPLE' | 'COMPLEX';

export interface TaskFileState {
  path: string;
  initialContent: string;
}

export interface PlanningTaskDef {
  taskId: string;
  tier: TaskTier;
  title: string;
  specification: string;
  files: TaskFileState[];
  expectedTouchedFiles: string[];
  forbiddenRegressions: string[];
  oracle: (modifiedFiles: Record<string, string>) => { pass: boolean; reasons: string[] };
  oracleDescription: string;
}

export const PLANNING_TASK_SUITE: PlanningTaskDef[] = [
  // 5 SIMPLE TASKS
  {
    taskId: 'SIMP-01',
    tier: 'SIMPLE',
    title: 'Docstring and Export Update',
    specification: 'Add typed JSDoc documentation to the calculateBackoff function and export calculateJitteredBackoff alias.',
    files: [
      {
        path: 'src/utils/backoff.ts',
        initialContent: `export function calculateBackoff(attempt: number, baseMs: number): number {\n  return baseMs * Math.pow(2, attempt);\n}\n`
      }
    ],
    expectedTouchedFiles: ['src/utils/backoff.ts'],
    forbiddenRegressions: ['Math.pow', 'attempt: number'],
    oracle: (files) => {
      const code = files['src/utils/backoff.ts'] || '';
      const hasJSDoc = code.includes('/**') && code.includes('@param');
      const hasAlias = code.includes('calculateJitteredBackoff');
      const pass = hasJSDoc && hasAlias;
      const reasons: string[] = [];
      if (!hasJSDoc) reasons.push('Missing typed JSDoc documentation with @param');
      if (!hasAlias) reasons.push('Missing export alias calculateJitteredBackoff');
      return { pass, reasons };
    },
    oracleDescription: 'Ensures JSDoc comments are added and calculateJitteredBackoff is exported.'
  },
  {
    taskId: 'SIMP-02',
    tier: 'SIMPLE',
    title: 'Trivial Constant Config Addition',
    specification: 'Add a new constant DEFAULT_MAX_RETRIES = 5 to the config file and export it.',
    files: [
      {
        path: 'src/config/constants.ts',
        initialContent: `export const DEFAULT_TIMEOUT_MS = 30000;\nexport const DEFAULT_POLL_INTERVAL_MS = 1000;\n`
      }
    ],
    expectedTouchedFiles: ['src/config/constants.ts'],
    forbiddenRegressions: ['DEFAULT_TIMEOUT_MS', 'DEFAULT_POLL_INTERVAL_MS'],
    oracle: (files) => {
      const code = files['src/config/constants.ts'] || '';
      const pass = code.includes('DEFAULT_MAX_RETRIES') && code.includes('5');
      return { pass, reasons: pass ? [] : ['Missing DEFAULT_MAX_RETRIES = 5 constant'] };
    },
    oracleDescription: 'Ensures DEFAULT_MAX_RETRIES = 5 is declared and exported without mutating existing constants.'
  },
  {
    taskId: 'SIMP-03',
    tier: 'SIMPLE',
    title: 'One-File Identifier Rename',
    specification: 'Rename internal variable "legacyWorkerId" to "activeWorkerId" in getWorkerStatus without modifying return schema.',
    files: [
      {
        path: 'src/workers/status.ts',
        initialContent: `export function getWorkerStatus(workerId: string) {\n  const legacyWorkerId = workerId.trim();\n  return { id: legacyWorkerId, status: 'IDLE' };\n}\n`
      }
    ],
    expectedTouchedFiles: ['src/workers/status.ts'],
    forbiddenRegressions: ['legacyWorkerId'],
    oracle: (files) => {
      const code = files['src/workers/status.ts'] || '';
      const pass = !code.includes('legacyWorkerId') && code.includes('activeWorkerId') && code.includes("status: 'IDLE'");
      return { pass, reasons: pass ? [] : ['legacyWorkerId still present or activeWorkerId missing'] };
    },
    oracleDescription: 'Ensures legacyWorkerId is renamed to activeWorkerId cleanly.'
  },
  {
    taskId: 'SIMP-04',
    tier: 'SIMPLE',
    title: 'Trivial Guard Condition Fix',
    specification: 'Fix the null-check in sanitizeLabel: if label is null or undefined or whitespace only, return empty string.',
    files: [
      {
        path: 'src/sanitizer.ts',
        initialContent: `export function sanitizeLabel(label?: string | null): string {\n  if (!label) return '';\n  return label.toLowerCase();\n}\n`
      }
    ],
    expectedTouchedFiles: ['src/sanitizer.ts'],
    forbiddenRegressions: ['toLowerCase'],
    oracle: (files) => {
      const code = files['src/sanitizer.ts'] || '';
      const handlesWhitespace = code.includes('.trim()') || code.includes('label.trim() === \'\'') || code.includes('!label.trim()');
      const pass = handlesWhitespace && code.includes('toLowerCase');
      return { pass, reasons: pass ? [] : ['Does not guard against whitespace-only string via trim()'] };
    },
    oracleDescription: 'Ensures whitespace-only strings return empty string using .trim().'
  },
  {
    taskId: 'SIMP-05',
    tier: 'SIMPLE',
    title: 'Isolated Enum Value Extension',
    specification: 'Add a new enum member "CANCELLED" to TaskStatus enum in types.ts.',
    files: [
      {
        path: 'src/types.ts',
        initialContent: `export enum TaskStatus {\n  PENDING = 'PENDING',\n  RUNNING = 'RUNNING',\n  COMPLETED = 'COMPLETED',\n  FAILED = 'FAILED'\n}\n`
      }
    ],
    expectedTouchedFiles: ['src/types.ts'],
    forbiddenRegressions: ['PENDING', 'RUNNING', 'COMPLETED', 'FAILED'],
    oracle: (files) => {
      const code = files['src/types.ts'] || '';
      const pass = code.includes('CANCELLED') && code.includes("'CANCELLED'");
      return { pass, reasons: pass ? [] : ['CANCELLED member missing from TaskStatus enum'] };
    },
    oracleDescription: 'Ensures CANCELLED is added to TaskStatus enum.'
  },

  // 10 COMPLEX TASKS
  {
    taskId: 'CMPX-01',
    tier: 'COMPLEX',
    title: 'Multi-File Dead-Letter Queue Pipeline',
    specification: 'Implement DLQ routing across queue.ts, dlq-store.ts and types.ts: When a message in TaskQueue fails with attempt >= maxRetries, route it to DLQStore.recordDeadLetter(msg, error) with failureClass "EXHAUSTED", and delete it from queue.',
    files: [
      {
        path: 'src/dlq/types.ts',
        initialContent: `export interface QueueMessage {\n  id: string;\n  payload: string;\n  attempt: number;\n  maxRetries: number;\n}\n\nexport interface DeadLetterEntry {\n  messageId: string;\n  payload: string;\n  failureClass: string;\n  recordedAt: number;\n}\n`
      },
      {
        path: 'src/dlq/dlq-store.ts',
        initialContent: `import { DeadLetterEntry, QueueMessage } from './types';\n\nexport class DLQStore {\n  private store: DeadLetterEntry[] = [];\n  async recordDeadLetter(msg: QueueMessage, error: string): Promise<void> {\n    this.store.push({ messageId: msg.id, payload: msg.payload, failureClass: 'EXHAUSTED', recordedAt: Date.now() });\n  }\n  getEntries(): DeadLetterEntry[] { return this.store; }\n}\n`
      },
      {
        path: 'src/dlq/queue.ts',
        initialContent: `import { QueueMessage } from './types';\nimport { DLQStore } from './dlq-store';\n\nexport class TaskQueue {\n  private queue: QueueMessage[] = [];\n  constructor(private dlqStore: DLQStore) {}\n  async push(msg: QueueMessage) { this.queue.push(msg); }\n  async handleFailure(msgId: string, error: string): Promise<void> {\n    // TODO: if attempt >= maxRetries route to DLQ\n  }\n}\n`
      }
    ],
    expectedTouchedFiles: ['src/dlq/queue.ts'],
    forbiddenRegressions: ['DLQStore', 'QueueMessage', 'recordDeadLetter'],
    oracle: (files) => {
      const qCode = files['src/dlq/queue.ts'] || '';
      const checksRetries = qCode.includes('attempt >=') || qCode.includes('>= msg.maxRetries') || qCode.includes('attempt >= msg.maxRetries');
      const callsDlq = qCode.includes('dlqStore.recordDeadLetter') || qCode.includes('this.dlqStore.recordDeadLetter');
      const removesFromQueue = qCode.includes('splice') || qCode.includes('filter') || qCode.includes('delete') || qCode.includes('indexOf');
      const pass = checksRetries && callsDlq && removesFromQueue;
      const reasons: string[] = [];
      if (!checksRetries) reasons.push('Does not compare attempt against maxRetries');
      if (!callsDlq) reasons.push('Does not invoke dlqStore.recordDeadLetter');
      if (!removesFromQueue) reasons.push('Fails to dequeue/remove the exhausted message from queue');
      return { pass, reasons };
    },
    oracleDescription: 'Ensures queue failure handler checks retries, delegates to DLQStore, and purges from in-memory queue.'
  },
  {
    taskId: 'CMPX-02',
    tier: 'COMPLEX',
    title: 'API Contract Evolution with Backward Compatibility',
    specification: 'Refactor executeTask(request) to accept TaskV2Request (with workspaceId and priority), while preserving full backwards compatibility for TaskV1Request (single string taskId). If V1 is passed, adapt it to V2 with default workspaceId="default" and priority=1.',
    files: [
      {
        path: 'src/api/contracts.ts',
        initialContent: `export interface TaskV1Request {\n  taskId: string;\n}\n\nexport interface TaskV2Request {\n  taskId: string;\n  workspaceId: string;\n  priority: number;\n}\n`
      },
      {
        path: 'src/api/dispatcher.ts',
        initialContent: `import { TaskV1Request, TaskV2Request } from './contracts';\n\nexport function executeTask(req: TaskV1Request): { dispatchedId: string; workspace: string; priority: number } {\n  return {\n    dispatchedId: req.taskId,\n    workspace: 'default',\n    priority: 1\n  };\n}\n`
      }
    ],
    expectedTouchedFiles: ['src/api/dispatcher.ts'],
    forbiddenRegressions: ['TaskV1Request', 'TaskV2Request'],
    oracle: (files) => {
      const code = files['src/api/dispatcher.ts'] || '';
      const acceptsUnion = code.includes('TaskV1Request | TaskV2Request') || code.includes('TaskV2Request | TaskV1Request') || (code.includes('req: any') || code.includes('req: TaskV1Request') && code.includes('workspaceId'));
      const adaptsV1 = (code.includes('workspaceId' in ({} as any)) || code.includes('\'workspaceId\' in req') || code.includes('req.workspaceId || \'default\'') || code.includes('?? \'default\'')) && (code.includes('priority ?? 1') || code.includes('priority || 1') || code.includes('priority: 1'));
      const pass = acceptsUnion && adaptsV1;
      const reasons: string[] = [];
      if (!acceptsUnion) reasons.push('executeTask signature does not accept TaskV2Request union');
      if (!adaptsV1) reasons.push('Does not correctly adapt V1 request to V2 defaults (workspaceId default and priority 1)');
      return { pass, reasons };
    },
    oracleDescription: 'Verifies executeTask accepts union of V1/V2 and correctly adapts V1 payloads to defaults.'
  },
  {
    taskId: 'CMPX-03',
    tier: 'COMPLEX',
    title: 'State Machine Transition Guarding',
    specification: 'Extend SchedulerStateMachine with CANCELLED state. Allowed transitions to CANCELLED: only from IDLE, RUNNING, or BLOCKED. Transition from COMPLETED or FAILED to CANCELLED must throw InvalidTransitionError.',
    files: [
      {
        path: 'src/scheduler/state-machine.ts',
        initialContent: `export type State = 'IDLE' | 'RUNNING' | 'BLOCKED' | 'COMPLETED' | 'FAILED';\n\nexport class InvalidTransitionError extends Error {}\n\nexport class SchedulerStateMachine {\n  private state: State = 'IDLE';\n  getState(): State { return this.state; }\n  transitionTo(next: State): void {\n    if (this.state === 'COMPLETED' || this.state === 'FAILED') {\n      throw new InvalidTransitionError('Terminal state');\n    }\n    this.state = next;\n  }\n}\n`
      }
    ],
    expectedTouchedFiles: ['src/scheduler/state-machine.ts'],
    forbiddenRegressions: ['InvalidTransitionError', 'SchedulerStateMachine'],
    oracle: (files) => {
      const code = files['src/scheduler/state-machine.ts'] || '';
      const hasCancelled = code.includes("'CANCELLED'") && code.includes("State = 'IDLE' | 'RUNNING' | 'BLOCKED' | 'COMPLETED' | 'FAILED' | 'CANCELLED'");
      const guardsTerminal = code.includes("this.state === 'COMPLETED'") && code.includes("this.state === 'FAILED'") && (code.includes("throw new InvalidTransitionError") || code.includes("InvalidTransitionError"));
      const pass = hasCancelled && guardsTerminal;
      const reasons: string[] = [];
      if (!hasCancelled) reasons.push('CANCELLED state not added to State union');
      if (!guardsTerminal) reasons.push('Terminal state transitions not guarded against transition to CANCELLED');
      return { pass, reasons };
    },
    oracleDescription: 'Ensures CANCELLED state is added and terminal transitions are guarded with InvalidTransitionError.'
  },
  {
    taskId: 'CMPX-04',
    tier: 'COMPLEX',
    title: 'Persistence Gate with Transactional Rollback',
    specification: 'Implement atomicSaveTask(db, task, meta): Must wrap save operations in a db.transaction. If saving meta fails, the transaction must rollback and rethrow, ensuring no partial writes occur in task table.',
    files: [
      {
        path: 'src/db/transaction.ts',
        initialContent: `export interface DatabaseClient {\n  query(sql: string, params: any[]): Promise<void>;\n  transaction<T>(fn: (tx: DatabaseClient) => Promise<T>): Promise<T>;\n}\n\nexport async function atomicSaveTask(db: DatabaseClient, task: { id: string; name: string }, meta: { author: string }): Promise<void> {\n  // TODO: implement transactional write with rollback\n}\n`
      }
    ],
    expectedTouchedFiles: ['src/db/transaction.ts'],
    forbiddenRegressions: ['DatabaseClient', 'atomicSaveTask'],
    oracle: (files) => {
      const code = files['src/db/transaction.ts'] || '';
      const usesTx = code.includes('db.transaction') || code.includes('tx.query');
      const writesBoth = (code.includes('task') || code.includes('tasks')) && (code.includes('meta') || code.includes('metadata'));
      const pass = usesTx && writesBoth;
      const reasons: string[] = [];
      if (!usesTx) reasons.push('Does not call db.transaction callback to encapsulate queries');
      if (!writesBoth) reasons.push('Does not perform writes for both task and meta tables');
      return { pass, reasons };
    },
    oracleDescription: 'Verifies atomic transaction encapsulation across task and metadata operations.'
  },
  {
    taskId: 'CMPX-05',
    tier: 'COMPLEX',
    title: 'Cross-Module Circular Dependency Refactor',
    specification: 'Break circular dependency between TaskRunner and TaskMetrics by extracting SharedTaskContext into a new shared types file src/shared/context.ts and updating both modules to import it.',
    files: [
      {
        path: 'src/runner/task-runner.ts',
        initialContent: `import { recordTaskCompletion } from '../metrics/task-metrics';\n\nexport interface SharedTaskContext {\n  taskId: string;\n  startTime: number;\n}\n\nexport function runTask(ctx: SharedTaskContext) {\n  recordTaskCompletion(ctx);\n}\n`
      },
      {
        path: 'src/metrics/task-metrics.ts',
        initialContent: `import { SharedTaskContext } from '../runner/task-runner';\n\nexport function recordTaskCompletion(ctx: SharedTaskContext) {\n  console.log('Finished', ctx.taskId);\n}\n`
      }
    ],
    expectedTouchedFiles: ['src/shared/context.ts', 'src/runner/task-runner.ts', 'src/metrics/task-metrics.ts'],
    forbiddenRegressions: ['recordTaskCompletion', 'runTask'],
    oracle: (files) => {
      const shared = files['src/shared/context.ts'] || '';
      const runner = files['src/runner/task-runner.ts'] || '';
      const metrics = files['src/metrics/task-metrics.ts'] || '';
      const hasShared = shared.includes('export interface SharedTaskContext');
      const runnerImportsShared = runner.includes("from '../shared/context'") || runner.includes('from "../shared/context"');
      const metricsImportsShared = metrics.includes("from '../shared/context'") || metrics.includes('from "../shared/context"');
      const noCircularImport = !metrics.includes("from '../runner/task-runner'");
      const pass = hasShared && runnerImportsShared && metricsImportsShared && noCircularImport;
      const reasons: string[] = [];
      if (!hasShared) reasons.push('src/shared/context.ts not created with SharedTaskContext interface');
      if (!runnerImportsShared) reasons.push('task-runner.ts does not import from src/shared/context');
      if (!metricsImportsShared || !noCircularImport) reasons.push('task-metrics.ts still imports from task-runner instead of shared/context');
      return { pass, reasons };
    },
    oracleDescription: 'Ensures circular dependency is resolved by extracting interface to shared module.'
  },
  {
    taskId: 'CMPX-06',
    tier: 'COMPLEX',
    title: 'Multi-Stage Validation Pipeline with Fail-Closed Halting',
    specification: 'Implement ValidationPipeline.run(task) executing 3 validators in sequence: SchemaValidator, SecurityValidator, GovernanceValidator. If any validator returns { valid: false, reason }, pipeline must halt immediately (fail-closed) and return { success: false, failedAt: stage, reason }, skipping subsequent stages.',
    files: [
      {
        path: 'src/pipeline/validation.ts',
        initialContent: `export interface ValidationResult { valid: boolean; reason?: string; }\nexport interface Validator { name: string; validate(data: any): Promise<ValidationResult>; }\n\nexport class ValidationPipeline {\n  constructor(private validators: Validator[]) {}\n  async run(data: any): Promise<{ success: boolean; failedAt?: string; reason?: string }> {\n    // TODO: execute in sequence, halt immediately on failure\n    return { success: true };\n  }\n}\n`
      }
    ],
    expectedTouchedFiles: ['src/pipeline/validation.ts'],
    forbiddenRegressions: ['ValidationPipeline', 'ValidationResult'],
    oracle: (files) => {
      const code = files['src/pipeline/validation.ts'] || '';
      const iteratesSeq = code.includes('for (') || code.includes('for await') || code.includes('for of') || code.includes('for (const');
      const haltsOnFail = (code.includes('!res.valid') || code.includes('!result.valid') || code.includes('valid === false')) && code.includes('return { success: false');
      const returnsFailedAt = code.includes('failedAt:') && code.includes('reason:');
      const pass = iteratesSeq && haltsOnFail && returnsFailedAt;
      const reasons: string[] = [];
      if (!iteratesSeq) reasons.push('Does not execute validators sequentially');
      if (!haltsOnFail) reasons.push('Does not halt pipeline immediately when validator returns invalid');
      if (!returnsFailedAt) reasons.push('Missing failedAt stage name in return payload');
      return { pass, reasons };
    },
    oracleDescription: 'Ensures sequential execution and immediate fail-closed return on first validator rejection.'
  },
  {
    taskId: 'CMPX-07',
    tier: 'COMPLEX',
    title: 'Exponential Backoff Retry Strategy with Jitter Boundary',
    specification: 'Implement calculateRetryDelay(attempt, config): delay = min(config.maxDelayMs, config.baseDelayMs * Math.pow(config.factor, attempt)). If config.jitterMs > 0, apply uniform additive jitter up to jitterMs. Delay must never exceed maxDelayMs even after jitter is added.',
    files: [
      {
        path: 'src/retry/backoff.ts',
        initialContent: `export interface RetryConfig {\n  baseDelayMs: number;\n  factor: number;\n  maxDelayMs: number;\n  jitterMs: number;\n}\n\nexport function calculateRetryDelay(attempt: number, config: RetryConfig): number {\n  // TODO: implement backoff with capped jitter\n  return 0;\n}\n`
      }
    ],
    expectedTouchedFiles: ['src/retry/backoff.ts'],
    forbiddenRegressions: ['RetryConfig', 'calculateRetryDelay'],
    oracle: (files) => {
      const code = files['src/retry/backoff.ts'] || '';
      const hasBackoff = code.includes('baseDelayMs') && (code.includes('Math.pow') || code.includes('**'));
      const hasJitter = code.includes('jitterMs') && code.includes('Math.random');
      const capsAtMax = (code.includes('Math.min') || code.includes('> config.maxDelayMs')) && code.includes('maxDelayMs');
      const pass = hasBackoff && hasJitter && capsAtMax;
      const reasons: string[] = [];
      if (!hasBackoff) reasons.push('Missing exponential factor backoff formula');
      if (!hasJitter) reasons.push('Missing Math.random() jitter implementation when jitterMs > 0');
      if (!capsAtMax) reasons.push('Does not guarantee total delay is capped at config.maxDelayMs');
      return { pass, reasons };
    },
    oracleDescription: 'Verifies exponential backoff with additive jitter capped strictly at maxDelayMs.'
  },
  {
    taskId: 'CMPX-08',
    tier: 'COMPLEX',
    title: 'Model Registry Failover and Routing Strategy',
    specification: 'Implement ModelRouter.resolveModel(registry, preference): Iterate preference array in order. Find first model in registry that is verified free (promptPrice === 0 && completionPrice === 0) AND healthy (status === "HEALTHY"). If none found, throw ModelRoutingExhaustedError.',
    files: [
      {
        path: 'src/routing/router.ts',
        initialContent: `export interface ModelEntry {\n  id: string;\n  promptPrice: number;\n  completionPrice: number;\n  status: 'HEALTHY' | 'DEGRADED' | 'DOWN';\n}\n\nexport class ModelRoutingExhaustedError extends Error {}\n\nexport class ModelRouter {\n  resolveModel(registry: Map<string, ModelEntry>, preferences: string[]): ModelEntry {\n    // TODO: find first verified free & healthy model or throw ModelRoutingExhaustedError\n    throw new ModelRoutingExhaustedError();\n  }\n}\n`
      }
    ],
    expectedTouchedFiles: ['src/routing/router.ts'],
    forbiddenRegressions: ['ModelRoutingExhaustedError', 'ModelRouter'],
    oracle: (files) => {
      const code = files['src/routing/router.ts'] || '';
      const checksZeroPrice = (code.includes('promptPrice === 0') || code.includes('!entry.promptPrice')) && (code.includes('completionPrice === 0') || code.includes('!entry.completionPrice'));
      const checksHealthy = code.includes("'HEALTHY'") || code.includes('status === "HEALTHY"');
      const iteratesPref = code.includes('for (') || code.includes('for of') || code.includes('find(');
      const throwsExhausted = code.includes('throw new ModelRoutingExhaustedError');
      const pass = checksZeroPrice && checksHealthy && iteratesPref && throwsExhausted;
      const reasons: string[] = [];
      if (!checksZeroPrice) reasons.push('Does not enforce promptPrice === 0 and completionPrice === 0');
      if (!checksHealthy) reasons.push('Does not verify model status is HEALTHY');
      if (!throwsExhausted) reasons.push('Does not throw ModelRoutingExhaustedError when no preferred model satisfies policy');
      return { pass, reasons };
    },
    oracleDescription: 'Ensures failover router selects first free & healthy candidate in preference order or throws.'
  },
  {
    taskId: 'CMPX-09',
    tier: 'COMPLEX',
    title: 'Multi-Tenant Permission Guard with Role Hierarchy',
    specification: 'Implement checkPermission(user, resource, action): Allowed only if user.tenantId === resource.tenantId AND user role permits action. Role hierarchy: ADMIN can read/write/delete; EDITOR can read/write; VIEWER can read only. Deny all cross-tenant access with TenantMismatchError.',
    files: [
      {
        path: 'src/auth/guard.ts',
        initialContent: `export type Role = 'ADMIN' | 'EDITOR' | 'VIEWER';\nexport type Action = 'read' | 'write' | 'delete';\n\nexport interface User { id: string; tenantId: string; role: Role; }\nexport interface Resource { id: string; tenantId: string; }\n\nexport class TenantMismatchError extends Error {}\n\nexport function checkPermission(user: User, resource: Resource, action: Action): boolean {\n  // TODO: verify tenant and role hierarchy\n  return false;\n}\n`
      }
    ],
    expectedTouchedFiles: ['src/auth/guard.ts'],
    forbiddenRegressions: ['TenantMismatchError', 'checkPermission'],
    oracle: (files) => {
      const code = files['src/auth/guard.ts'] || '';
      const checksTenant = code.includes('user.tenantId !== resource.tenantId') && (code.includes('throw new TenantMismatchError') || code.includes('TenantMismatchError'));
      const checksAdmin = code.includes("'ADMIN'") || code.includes('ADMIN');
      const checksEditor = code.includes("'EDITOR'") || code.includes('EDITOR');
      const checksViewer = code.includes("'VIEWER'") || code.includes('VIEWER');
      const pass = checksTenant && checksAdmin && checksEditor && checksViewer;
      const reasons: string[] = [];
      if (!checksTenant) reasons.push('Does not throw TenantMismatchError on tenantId mismatch');
      if (!checksAdmin || !checksEditor || !checksViewer) reasons.push('Role hierarchy for ADMIN, EDITOR, VIEWER not implemented');
      return { pass, reasons };
    },
    oracleDescription: 'Verifies strict tenant isolation and role hierarchy enforcement.'
  },
  {
    taskId: 'CMPX-10',
    tier: 'COMPLEX',
    title: 'Reaper Stale Task Cleanup with Governance Check',
    specification: 'Implement reapStaleTasks(db, reaperConfig, governanceGate): Fetch tasks where status="RUNNING" and updatedAt < Date.now() - staleGraceMs. Before resetting, call governanceGate.canReap(task). If allowed, set status="FAILED", failureClass="STALE_REAPED" and increment retryCount; if denied, skip task.',
    files: [
      {
        path: 'src/reaper/cleanup.ts',
        initialContent: `export interface ReaperTask {\n  id: string;\n  status: string;\n  updatedAt: number;\n  retryCount: number;\n  failureClass?: string;\n}\n\nexport interface GovernanceGate {\n  canReap(task: ReaperTask): Promise<boolean>;\n}\n\nexport async function reapStaleTasks(tasks: ReaperTask[], staleGraceMs: number, gate: GovernanceGate): Promise<ReaperTask[]> {\n  // TODO: filter stale running tasks, consult gate, update status and failureClass\n  return [];\n}\n`
      }
    ],
    expectedTouchedFiles: ['src/reaper/cleanup.ts'],
    forbiddenRegressions: ['ReaperTask', 'GovernanceGate', 'reapStaleTasks'],
    oracle: (files) => {
      const code = files['src/reaper/cleanup.ts'] || '';
      const checksGrace = code.includes('staleGraceMs') || code.includes('Date.now() - task.updatedAt') || code.includes('updatedAt <');
      const consultsGate = code.includes('gate.canReap') || code.includes('await gate.canReap');
      const setsFailedAndClass = (code.includes("'FAILED'") || code.includes('"FAILED"')) && (code.includes("'STALE_REAPED'") || code.includes('"STALE_REAPED"'));
      const incrementsRetry = code.includes('retryCount + 1') || code.includes('task.retryCount++') || code.includes('++task.retryCount');
      const pass = checksGrace && consultsGate && setsFailedAndClass && incrementsRetry;
      const reasons: string[] = [];
      if (!checksGrace) reasons.push('Does not filter tasks by staleGraceMs threshold');
      if (!consultsGate) reasons.push('Does not consult governanceGate.canReap(task)');
      if (!setsFailedAndClass) reasons.push('Does not set status="FAILED" and failureClass="STALE_REAPED"');
      if (!incrementsRetry) reasons.push('Does not increment retryCount on reaped tasks');
      return { pass, reasons };
    },
    oracleDescription: 'Ensures stale running tasks are filtered, governance gate consulted, and state updated to STALE_REAPED.'
  }
];

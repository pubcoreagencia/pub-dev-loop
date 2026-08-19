import { execFileSync } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import type { AgentProvider, ProviderTaskResult } from './providers/types.js';
import type { Task } from './domain.js';
import { PostgresTaskRepository } from './repository.js';
import { TaskFinalizer, captureWorkspaceSnapshot } from './finalizer.js';
import { PrototypeEventStream } from './prototype/events.js';
import { PostgresPrototypeRepository } from './prototype/repository.js';

const LEASE_TIMEOUT_MS = Number(process.env.WORKER_LEASE_TIMEOUT_MS ?? 30000);
const WORKSPACE_ROOT = process.env.PROTOTYPE_WORKSPACES_ROOT ?? '/tmp/pub-prototype';

function git(args: string[], cwd?: string): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
}

function workspaceFor(task: Task): string {
  if (!task.prototypeSessionId) throw new Error('Prototype task missing prototypeSessionId');
  return task.workspacePath ?? path.join(WORKSPACE_ROOT, task.prototypeSessionId);
}

export class PrototypeWorker {
  constructor(
    private readonly tasks: PostgresTaskRepository,
    private readonly prototypes: PostgresPrototypeRepository,
    private readonly provider: AgentProvider,
    private readonly events: PrototypeEventStream,
    private readonly name = 'prototype',
  ) {}

  status(): string { return this.state; }

  private state = 'IDLE';

  async executeOnce(): Promise<boolean> {
    const task = await this.tasks.claimPrototype(this.name);
    if (!task) return false;

    const sessionId = task.prototypeSessionId!;
    const workspace = workspaceFor(task);
    const branch = task.branch ?? `prototype/${task.project}/${sessionId}`;
    this.state = 'RUNNING';

    const heartbeat = setInterval(() => {
      this.tasks.heartbeat(task.id, new Date(Date.now() + LEASE_TIMEOUT_MS)).catch(() => undefined);
    }, Number(process.env.WORKER_HEARTBEAT_MS ?? 10000));
    heartbeat.unref();

    try {
      await this.tasks.update(task.id, { status: 'RUNNING', workspacePath: workspace, branch });
      await this.prototypes.updateSession(sessionId, { status: 'BUILDING' });
      this.events.emit({ sessionId, type: 'AGENT_STARTED', payload: { taskId: task.id, promptIndex: task.prompt } });

      await mkdir(WORKSPACE_ROOT, { recursive: true });
      if (!await this.hasGitRepo(workspace)) {
        await mkdir(workspace, { recursive: true });
        git(['clone', task.repository, workspace]);
      }
      git(['checkout', '-B', branch], workspace);

      const baseline = captureWorkspaceSnapshot(workspace);
      const started = Date.now();
      const result = await this.provider.execute(task, workspace);
      const durationMs = Date.now() - started;

      if (result.status !== 'COMPLETED') {
        const message = result.errorMessage ?? result.stderr ?? 'Prototype agent failed';
        await this.tasks.update(task.id, {
          status: 'FAILED',
          error: message.slice(0, 4000),
          result: { provider: result.provider, model: result.model, stdout: result.stdout, stderr: result.stderr, durationMs },
          leaseOwner: null,
          leaseDeadline: null,
          workspacePath: workspace,
        });
        await this.prototypes.updateSession(sessionId, { status: 'FAILED' });
        this.events.emit({ sessionId, type: 'ERROR', payload: { message, taskId: task.id } });
        return true;
      }

      this.events.emit({
        sessionId,
        type: 'AGENT_OUTPUT',
        payload: { summary: result.stdout.slice(-8000), changedFiles: result.changedFiles ?? [], taskId: task.id },
      });

      const finalizer = new TaskFinalizer(workspace, {
        commandTimeoutMs: Number(process.env.ROUTER_COMMAND_TIMEOUT_MS ?? 60000),
      });
      const finalize = await finalizer.finalize(task.objective, task.prompt, {
        testCommand: process.env.TASK_TEST_COMMAND || null,
        commitMessage: `prototype(${task.project}): prompt ${task.id}`,
        expectChanges: false,
        allowUnexpectedFiles: false,
        baselineSnapshot: baseline,
        declaredChangedFiles: result.changedFiles ?? [],
      });

      if (finalize.status !== 'COMPLETED') {
        await this.tasks.update(task.id, {
          status: 'FAILED',
          branch,
          workspacePath: workspace,
          gitStatus: finalize.gitStatus,
          error: finalize.errorMessage ?? 'Prototype finalization failed',
          result: { finalize, provider: result.provider, model: result.model, durationMs },
          leaseOwner: null,
          leaseDeadline: null,
        });
        await this.prototypes.updateSession(sessionId, { status: 'FAILED' });
        this.events.emit({ sessionId, type: 'BUILD_FAILED', payload: { message: finalize.errorMessage ?? 'Finalization failed' } });
        return true;
      }

      await this.tasks.update(task.id, {
        status: 'COMPLETED',
        branch,
        commitSha: finalize.commitSha,
        gitStatus: finalize.gitStatus,
        workspacePath: workspace,
        leaseOwner: null,
        leaseDeadline: null,
        result: { finalize, provider: result.provider, model: result.model, durationMs },
      });

      await this.prototypes.updateSession(sessionId, {
        status: 'READY',
        lastCheckpointSha: finalize.commitSha,
      });

      const checkpoint = await this.prototypes.createCheckpoint({
        sessionId,
        promptIndex: (await this.prototypes.getSession(sessionId))?.promptCount ?? 1,
        prompt: task.prompt,
        commitSha: finalize.commitSha,
        previewUrl: null,
        buildPassed: true,
      });

      this.events.emit({
        sessionId,
        type: 'CHECKPOINT_CREATED',
        payload: checkpoint as unknown as Record<string, unknown>,
      });
      this.events.emit({
        sessionId,
        type: 'BUILD_PASSED',
        payload: { commitSha: finalize.commitSha, taskId: task.id },
      });
      this.events.emit({
        sessionId,
        type: 'PREVIEW_STARTED',
        payload: { phase: 'runtime_pending', workspace },
      });

      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.tasks.update(task.id, {
        status: 'FAILED',
        error: message.slice(0, 4000),
        workspacePath: workspace,
        leaseOwner: null,
        leaseDeadline: null,
      });
      await this.prototypes.updateSession(sessionId, { status: 'FAILED' });
      this.events.emit({ sessionId, type: 'ERROR', payload: { message, taskId: task.id } });
      return true;
    } finally {
      clearInterval(heartbeat);
      this.state = 'IDLE';
    }
  }

  private async hasGitRepo(workspace: string): Promise<boolean> {
    try {
      git(['rev-parse', '--git-dir'], workspace);
      return true;
    } catch {
      return false;
    }
  }
}

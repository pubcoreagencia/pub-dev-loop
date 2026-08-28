import { execFileSync } from 'node:child_process';
import { access, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Task } from './domain.js';
import { PostgresTaskRepository } from './repository.js';
import { TaskFinalizer, captureWorkspaceSnapshot } from './finalizer.js';
import type { AgentProvider } from './providers/types.js';
import type { PrototypeEventPublisher } from './prototype/events.js';
import { PostgresPrototypeRepository } from './prototype/repository.js';
import { LocalPreviewRuntime } from './prototype/local-preview-runtime.js';
import { PublicPreviewRuntime } from './prototype/public-preview-runtime.js';
import type { PreviewRuntime, PreviewRuntimeInfo } from './prototype/preview-runtime.js';

const LEASE_TIMEOUT_MS = Number(process.env.WORKER_LEASE_TIMEOUT_MS ?? 30000);
const WORKSPACE_ROOT = process.env.PROTOTYPE_WORKSPACES_ROOT ?? '/tmp/pub-prototype';
const PREVIEW_PUBLIC_BASE_URL = process.env.PROTOTYPE_PREVIEW_BASE_URL || undefined;
const PREVIEW_COMMAND = process.env.PROTOTYPE_PREVIEW_COMMAND ?? 'npm';
const PREVIEW_ARGS = (process.env.PROTOTYPE_PREVIEW_ARGS ?? 'run dev -- --host 0.0.0.0 --port {PORT}')
  .split(' ')
  .filter(Boolean);
const PREVIEW_MODE = process.env.PROTOTYPE_PREVIEW_MODE ?? 'public';
const RESTORE_OBJECTIVE = '__PP_RESTORE_CHECKPOINT__';

function git(args: string[], cwd?: string): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
}

function workspaceFor(task: Task): string {
  if (!task.prototypeSessionId) throw new Error('Prototype task missing prototypeSessionId');
  return task.workspacePath ?? path.join(WORKSPACE_ROOT, task.prototypeSessionId);
}

async function directoryExists(dir: string): Promise<boolean> {
  try { await access(dir); return true; } catch { return false; }
}

function parseRestore(prompt: string): { commitSha: string; checkpointId: string } {
  const value = JSON.parse(prompt) as { commitSha?: string; checkpointId?: string };
  if (!value.commitSha || !value.checkpointId) throw new Error('Invalid restore payload');
  return { commitSha: value.commitSha, checkpointId: value.checkpointId };
}

export class PrototypeWorker {
  private state = 'IDLE';
  private readonly preview: PreviewRuntime;

  constructor(
    private readonly tasks: PostgresTaskRepository,
    private readonly prototypes: PostgresPrototypeRepository,
    private readonly provider: AgentProvider,
    private readonly events: PrototypeEventPublisher,
    private readonly name = 'prototype',
    previewRuntime?: PreviewRuntime,
  ) {
    this.preview = previewRuntime ?? (
      (process.env.PROTOTYPE_PREVIEW_MODE ?? 'public') === 'local'
        ? new LocalPreviewRuntime()
        : new PublicPreviewRuntime()
    );
  }

  status(): string { return this.state; }

  async executeOnce(): Promise<boolean> {
    const task = await this.tasks.claimPrototype(this.name);
    if (!task) return false;

    const sessionId = task.prototypeSessionId!;
    const workspace = workspaceFor(task);
    const branch = task.branch ?? `prototype/${task.project}/${sessionId}`;
    this.state = 'RUNNING';

    console.log(JSON.stringify({
      event: 'TASK_LEASED',
      taskId: task.id,
      sessionId,
      worker: this.name,
      timestamp: new Date().toISOString(),
    }));

    const heartbeat = setInterval(() => {
      this.tasks.heartbeat(task.id, new Date(Date.now() + LEASE_TIMEOUT_MS)).catch(() => undefined);
    }, Number(process.env.WORKER_HEARTBEAT_MS ?? 10000));
    heartbeat.unref();

    try {
      console.log(JSON.stringify({
        event: 'TASK_EXECUTION_STARTED',
        taskId: task.id,
        sessionId,
        objective: task.objective,
        timestamp: new Date().toISOString(),
      }));

      await this.tasks.update(task.id, { status: 'RUNNING', workspacePath: workspace, branch });
      await this.prototypes.updateSession(sessionId, { status: 'BUILDING', workspacePath: workspace });
      await this.events.emit({ sessionId, type: 'AGENT_STARTED', payload: { taskId: task.id } });

      await mkdir(WORKSPACE_ROOT, { recursive: true });

      // Determine which repository to use.
      // Architecture:
      //   - session.repository = persistent repo (where commits are pushed)
      //   - template = base for the first clone (has package.json, etc.)
      //   - For 1st task: clone template, push to persistent
      //   - For 2nd+ tasks: clone persistent, fetch existing branch
      const { PROTOTYPE_REPOSITORY, getGitHubToken } = await import('./github-app.js');
      const usePersistentPush =
        process.env.PROTOTYPE_PERSISTENT_PUSH === 'true' &&
        !!getGitHubToken();

      const templateRepo = process.env.PROTOTYPE_TEMPLATE_REPOSITORY
        || 'https://github.com/pubcoreagencia/pub-dev-loop-template.git';

      const persistentUrl = usePersistentPush
        ? `https://x-access-token:${getGitHubToken()}@github.com/${PROTOTYPE_REPOSITORY}.git`
        : null;

      if (!await directoryExists(path.join(workspace, '.git'))) {
        await mkdir(workspace, { recursive: true });
        // For 1st task: clone from TEMPLATE (public, no auth needed).
        // The persistent push will be done by the finalizer using the token.
        // Fallback: if PROTOTYPE_TEMPLATE_REPOSITORY is not set, use task.repository
        // (which may be a local path for tests, or the legacy template URL).
        const templateUrl = process.env.PROTOTYPE_TEMPLATE_REPOSITORY
          || task.repository
          || 'https://github.com/pubcoreagencia/pub-dev-loop-template.git';
        git(['clone', templateUrl, workspace]);
      }

      // If persistent push is enabled, try to fetch the existing branch.
      // If the branch exists remotely, checkout from it (continue from last checkpoint).
      // If not, create a new branch from current HEAD (which is template's main).
      if (usePersistentPush && persistentUrl) {
        // Set up origin to point to the persistent repo
        try {
          execFileSync('git', ['remote', 'remove', 'origin'], {
            cwd: workspace, stdio: 'pipe', timeout: 5000,
          });
        } catch { /* ignore */ }
        execFileSync('git', ['remote', 'add', 'origin', persistentUrl], {
          cwd: workspace, stdio: 'pipe', timeout: 5000,
        });

        try {
          // Try to fetch the specific branch from origin
          git(['fetch', 'origin', branch], workspace);
          try {
            const revParse = execFileSync('git', ['rev-parse', '--verify', `origin/${branch}`], {
              cwd: workspace, encoding: 'utf8', stdio: 'pipe',
            });
            if (revParse.trim()) {
              // Branch exists remotely — continue from there
              git(['checkout', '-B', branch, `origin/${branch}`], workspace);
              console.log(JSON.stringify({
                event: 'PROTOTYPE_BRANCH_RESUMED',
                sessionId,
                branch,
                fromCheckpoint: revParse.trim().slice(0, 8),
                timestamp: new Date().toISOString(),
              }));
            } else {
              git(['checkout', '-B', branch], workspace);
            }
          } catch {
            git(['checkout', '-B', branch], workspace);
          }
        } catch {
          git(['checkout', '-B', branch], workspace);
        }
        // SECURITY: remove the remote (with token) from git config
        try {
          execFileSync('git', ['remote', 'remove', 'origin'], {
            cwd: workspace, stdio: 'pipe', timeout: 5000,
          });
        } catch { /* ignore */ }
      } else {
        git(['checkout', '-B', branch], workspace);
      }

      if (task.objective === RESTORE_OBJECTIVE) {
        return await this.restoreCheckpoint(task, workspace, branch);
      }

      const baseline = captureWorkspaceSnapshot(workspace);
      const started = Date.now();

      console.log(JSON.stringify({
        event: 'PROVIDER_EXECUTION_STARTED',
        taskId: task.id,
        sessionId,
        timestamp: new Date().toISOString(),
      }));

      const result = await this.provider.execute(task, workspace);

      // Check for cancellation during provider execution
      try {
        const currentTask = await (this.tasks as any).get?.(task.id);
        if (currentTask?.status === 'CANCELLED') {
          await this.tasks.update(task.id, { status: 'CANCELLED', workspacePath: workspace, leaseOwner: null, leaseDeadline: null });
          await this.prototypes.updateSession(sessionId, { status: 'READY', workspacePath: workspace });
          await this.events.emit({ sessionId, type: 'ERROR', payload: { message: 'Task cancelled by user', taskId: task.id } });
          console.log(JSON.stringify({ event: 'TASK_CANCELLED', taskId: task.id, sessionId, timestamp: new Date().toISOString() }));
          return true;
        }
      } catch {
        // get() may not be available on mock repos — cancellation check is best-effort
      }
      const durationMs = Date.now() - started;

      console.log(JSON.stringify({
        event: 'TASK_EXECUTION_COMPLETED',
        taskId: task.id,
        sessionId,
        status: result.status,
        provider: result.provider,
        model: result.model,
        changedFilesCount: result.changedFiles?.length ?? 0,
        toolCalls: result.toolCalls ?? 0,
        durationMs,
        timestamp: new Date().toISOString(),
      }));

      if (result.status !== 'COMPLETED') {
        const message = result.errorMessage ?? result.stderr ?? 'Prototype agent failed';
        await this.tasks.update(task.id, { status: 'FAILED', error: message.slice(0, 4000), workspacePath: workspace,
          result: { provider: result.provider, model: result.model, stdout: result.stdout, stderr: result.stderr, durationMs },
          leaseOwner: null, leaseDeadline: null });
        await this.prototypes.updateSession(sessionId, { status: 'FAILED', workspacePath: workspace });
        await this.events.emit({ sessionId, type: 'ERROR', payload: { message, taskId: task.id } });
        return true;
      }

      await this.events.emit({ sessionId, type: 'AGENT_OUTPUT', payload: { summary: result.stdout.slice(-8000), changedFiles: result.changedFiles ?? [], taskId: task.id } });
      const finalizer = new TaskFinalizer(workspace, { commandTimeoutMs: Number(process.env.ROUTER_COMMAND_TIMEOUT_MS ?? 60000) });

      // Check for cancellation before finalizer
      try {
        const currentTask = await (this.tasks as any).get?.(task.id);
        if (currentTask?.status === 'CANCELLED') {
          await this.prototypes.updateSession(sessionId, { status: 'READY', workspacePath: workspace });
          await this.events.emit({ sessionId, type: 'ERROR', payload: { message: 'Task cancelled by user', taskId: task.id } });
          console.log(JSON.stringify({ event: 'TASK_CANCELLED', taskId: task.id, sessionId, timestamp: new Date().toISOString() }));
          return true;
        }
      } catch {
        // get() may not be available on mock repos — cancellation check is best-effort
      }

      await this.events.emit({ sessionId, type: 'BUILD_STARTED', payload: { taskId: task.id, phase: 'finalize' } });
      const finalize = await finalizer.finalize(task.objective, task.prompt, {
        testCommand: process.env.TASK_TEST_COMMAND || null,
        commitMessage: `prototype(${task.project}): prompt ${task.id}`,
        expectChanges: false,
        allowUnexpectedFiles: false,
        baselineSnapshot: baseline,
        declaredChangedFiles: result.changedFiles ?? [],
      });

      if (finalize.status !== 'COMPLETED') {
        await this.tasks.update(task.id, { status: 'FAILED', branch, workspacePath: workspace, gitStatus: finalize.gitStatus,
          error: finalize.errorMessage ?? 'Prototype finalization failed', result: { finalize, provider: result.provider, model: result.model, durationMs },
          leaseOwner: null, leaseDeadline: null });
        await this.prototypes.updateSession(sessionId, { status: 'FAILED', workspacePath: workspace });
        await this.events.emit({ sessionId, type: 'BUILD_FAILED', payload: { message: finalize.errorMessage ?? 'Finalization failed' } });
        return true;
      }

      console.log(JSON.stringify({
        event: 'TASK_FINALIZED',
        taskId: task.id,
        sessionId,
        commitSha: finalize.commitSha,
        status: finalize.status,
        timestamp: new Date().toISOString(),
      }));

      await this.tasks.update(task.id, { status: 'COMPLETED', branch, commitSha: finalize.commitSha, gitStatus: finalize.gitStatus,
        workspacePath: workspace, leaseOwner: null, leaseDeadline: null,
        result: { finalize, provider: result.provider, model: result.model, durationMs } });
      await this.events.emit({ sessionId, type: 'BUILD_PASSED', payload: { commitSha: finalize.commitSha, taskId: task.id } });

      const preview = await this.ensurePreview(sessionId, workspace);
      await this.prototypes.updateSession(sessionId, { status: 'READY', workspacePath: workspace, previewRuntime: preview.id,
        previewUrl: preview.url, lastCheckpointSha: finalize.commitSha });

      // Save assistant message to the chat history linked to the task_id
      try {
        if (typeof this.prototypes.addMessage === 'function') {
          await this.prototypes.addMessage({
            id: randomUUID(),
            sessionId,
            role: 'assistant',
            content: result.stdout || 'Protótipo atualizado com sucesso.',
            taskId: task.id,
            order: 0,
            createdAt: new Date(),
          });
        }
      } catch (msgErr) {
        console.error('[Prototype Worker] Failed to persist assistant message:', (msgErr as Error).message);
      }

      const session = await this.prototypes.getSession(sessionId);
      const checkpoint = await this.prototypes.createCheckpoint({ sessionId, promptIndex: session?.promptCount ?? 1, prompt: task.prompt,
        commitSha: finalize.commitSha, previewUrl: preview.url, buildPassed: true });

      console.log(JSON.stringify({
        event: 'CHECKPOINT_CREATED',
        checkpointId: checkpoint.id,
        sessionId,
        commitSha: checkpoint.commitSha,
        timestamp: new Date().toISOString(),
      }));

      await this.tasks.update(task.id, { status: 'COMPLETED' });
      await this.events.emit({ sessionId, type: 'CHECKPOINT_CREATED', payload: checkpoint as unknown as Record<string, unknown> });
      await this.events.emit({ sessionId, type: 'PREVIEW_READY', payload: { url: preview.url, runtimeId: preview.id, port: preview.port } });
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.tasks.update(task.id, { status: 'FAILED', error: message.slice(0, 4000), workspacePath: workspace, leaseOwner: null, leaseDeadline: null });
      await this.prototypes.updateSession(sessionId, { status: 'FAILED', workspacePath: workspace });
      await this.events.emit({ sessionId, type: 'ERROR', payload: { message, taskId: task.id } });
      return true;
    } finally {
      clearInterval(heartbeat);
      this.state = 'IDLE';
    }
  }

  private async restoreCheckpoint(task: Task, workspace: string, branch: string): Promise<boolean> {
    const sessionId = task.prototypeSessionId!;
    const { commitSha, checkpointId } = parseRestore(task.prompt);
    const currentSha = git(['rev-parse', 'HEAD'], workspace).trim();
    if (currentSha === commitSha) {
      await this.tasks.update(task.id, { status: 'COMPLETED', branch, workspacePath: workspace, commitSha: currentSha, leaseOwner: null, leaseDeadline: null });
      await this.prototypes.updateSession(sessionId, { status: 'READY', workspacePath: workspace, lastCheckpointSha: currentSha });
      await this.events.emit({ sessionId, type: 'PREVIEW_READY', payload: { url: (await this.prototypes.getSession(sessionId))?.previewUrl, restoredFrom: checkpointId, unchanged: true } });
      return true;
    }

    await this.events.emit({ sessionId, type: 'BUILD_STARTED', payload: { phase: 'restore', checkpointId, targetSha: commitSha } });
    git(['read-tree', '-m', '-u', commitSha], workspace);
    git(['add', '-A'], workspace);
    const commitMessage = `prototype(${task.project}): restore checkpoint ${checkpointId}`;
    git(['commit', '--allow-empty', '-m', commitMessage], workspace);
    const restoredSha = git(['rev-parse', 'HEAD'], workspace).trim();

    const preview = await this.ensurePreview(sessionId, workspace);
    await this.prototypes.updateSession(sessionId, {
      status: 'READY', workspacePath: workspace, previewRuntime: preview.id,
      previewUrl: preview.url, lastCheckpointSha: restoredSha,
    });
    await this.tasks.update(task.id, {
      status: 'COMPLETED', branch, workspacePath: workspace, commitSha: restoredSha,
      leaseOwner: null, leaseDeadline: null, result: { restoredFrom: checkpointId, targetSha: commitSha, restoredSha },
    });

    const session = await this.prototypes.getSession(sessionId);
    const checkpoint = await this.prototypes.createCheckpoint({
      sessionId,
      promptIndex: session?.promptCount ?? 1,
      prompt: `Restore checkpoint ${checkpointId}`,
      commitSha: restoredSha,
      previewUrl: preview.url,
      buildPassed: true,
    });
    await this.events.emit({ sessionId, type: 'BUILD_PASSED', payload: { commitSha: restoredSha, restoredFrom: checkpointId, targetSha: commitSha } });
    await this.events.emit({ sessionId, type: 'CHECKPOINT_CREATED', payload: checkpoint as unknown as Record<string, unknown> });
    await this.events.emit({ sessionId, type: 'PREVIEW_READY', payload: { url: preview.url, runtimeId: preview.id, port: preview.port, restoredFrom: checkpointId } });
    return true;
  }

  private async ensurePreview(sessionId: string, workspace: string): Promise<PreviewRuntimeInfo> {
    const session = await this.prototypes.getSession(sessionId);
    if (session?.previewRuntime) {
      const existing = await this.preview.get(session.previewRuntime);
      if (existing?.status === 'READY') return existing;
    }

    const previewCommand = process.env.PROTOTYPE_PREVIEW_COMMAND ?? PREVIEW_COMMAND;
    const previewArgs = process.env.PROTOTYPE_PREVIEW_ARGS
      ? process.env.PROTOTYPE_PREVIEW_ARGS.split(' ').filter(Boolean)
      : PREVIEW_ARGS;
    const previewMode = process.env.PROTOTYPE_PREVIEW_MODE ?? PREVIEW_MODE;
    const publicBaseUrl = process.env.PROTOTYPE_PREVIEW_BASE_URL || PREVIEW_PUBLIC_BASE_URL;

    await this.events.emit({ sessionId, type: 'PREVIEW_STARTED', payload: { phase: 'runtime_starting', mode: previewMode } });
    const runtime = await this.preview.create({
      workspace,
      command: previewCommand,
      args: previewArgs,
      port: 0,
      publicBaseUrl,
      startupTimeoutMs: Number(process.env.PROTOTYPE_PREVIEW_STARTUP_TIMEOUT_MS ?? 60000),
      environment: { NODE_ENV: 'development' },
    });
    const unsubscribe = this.preview.subscribe(runtime.id, async event => {
      if (event.stream === 'stderr') {
        await this.events.emit({ sessionId, type: 'ERROR', payload: { runtimeId: event.runtimeId, line: event.line } });
      }
    });
    try {
      return await this.preview.start(runtime.id);
    } finally {
      unsubscribe();
    }
  }
}

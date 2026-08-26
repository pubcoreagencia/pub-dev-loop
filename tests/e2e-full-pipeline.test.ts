// tests/e2e-full-pipeline.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { writeFile, mkdir, rm } from 'node:fs/promises';
import { execSync } from 'node:child_process';
import { join } from 'node:path';
import { RouterWorker } from '../src/router-worker.js';
import type { AgentProvider, ProviderTaskResult } from '../src/providers/types.js';
import type { Task, TaskRepository } from '../src/domain.js';

/** Helper: create a temporary Git repo */
function initGitRepo(root: string): void {
  execSync('git init', { cwd: root, stdio: 'ignore' });
  execSync('git config user.name "PUB DEV LOOP E2E"', { cwd: root, stdio: 'ignore' });
  execSync('git config user.email "e2e@pub.dev.loop"', { cwd: root, stdio: 'ignore' });
}
function gitCommit(root: string, message: string): void {
  execSync('git add -A', { cwd: root, stdio: 'ignore' });
  execSync(`git commit -m "${message}"`, { cwd: root, stdio: 'ignore' });
}
function gitRevParseHead(root: string): string {
  return execSync('git rev-parse HEAD', { cwd: root, stdio: ['pipe', 'pipe', 'pipe'] })
    .toString()
    .trim();
}
function gitStatusShort(root: string): string {
  try {
    return execSync('git status --short', { cwd: root, stdio: ['pipe', 'pipe', 'pipe'] }).toString();
  } catch {
    return '';
  }
}

/** In‑memory TaskRepository used by the test */
class TestTaskRepository implements TaskRepository {
  private tasks: Map<string, Task> = new Map();
  create(input: { project: string; repository: string; objective: string; prompt: string; priority?: number; }): Task {
    const task: Task = {
      id: 'task-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
      project: input.project,
      repository: input.repository,
      objective: input.objective,
      prompt: input.prompt,
      status: 'QUEUED',
      priority: input.priority ?? 1,
      worker: null,
      result: null,
      error: null,
      branch: (input as any).branch || null,
      commitSha: null,
      gitStatus: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      leaseOwner: null,
      leaseDeadline: null,
      heartbeatAt: null,
      workspacePath: null,
    };
    this.tasks.set(task.id, task);
    return task;
  }
  async get(id: string): Promise<Task | null> { return this.tasks.get(id) || null; }
  async list(): Promise<Task[]> { return Array.from(this.tasks.values()); }
  async claim(worker: string): Promise<Task | null> {
    for (const [id, task] of this.tasks) {
      if (task.status === 'QUEUED') {
        task.status = 'ASSIGNED';
        task.worker = worker;
        task.updatedAt = new Date();
        this.tasks.set(id, task);
        return task;
      }
    }
    return null;
  }
  async update(id: string, patch: Partial<Task>): Promise<Task | null> {
    const task = this.tasks.get(id);
    if (!task) return null;
    Object.assign(task, patch);
    task.updatedAt = new Date();
    this.tasks.set(id, task);
    return task;
  }
  async cancel(id: string): Promise<Task | null> { return this.update(id, { status: 'CANCELLED' }); }
  async retry(id: string): Promise<Task | null> { return this.update(id, { status: 'QUEUED' }); }
  async reclaimStuck(_worker: string, _leaseWindowMs: number, _now: Date): Promise<number> { return 0; }
  async heartbeat(id: string, deadline: Date): Promise<boolean> {
    const task = this.tasks.get(id);
    if (!task || !['ASSIGNED', 'RUNNING', 'TESTING'].includes(task.status)) return false;
    task.leaseDeadline = deadline;
    task.heartbeatAt = new Date();
    task.updatedAt = new Date();
    this.tasks.set(id, task);
    return true;
  }
}

/** Mock provider that creates a deterministic file */
function createMockFileProvider(): AgentProvider {
  return {
    kind: 'mock',
    model: 'mock-model',
    async execute(_task, workspace): Promise<ProviderTaskResult> {
      const filePath = join(workspace, 'hello.txt');
      await writeFile(filePath, 'PUB DEV LOOP E2E PIPELINE TEST\n');
      return {
        status: 'COMPLETED',
        provider: 'mock',
        model: 'mock-model',
        exitCode: 0,
        durationMs: 10,
        stdout: 'file created',
        stderr: '',
        changedFiles: ['hello.txt'],
        commit: null,
        errorCode: null,
        errorMessage: null,
        toolCalls: 0,
        toolRounds: 0,
      } as ProviderTaskResult;
    },
    async health() { return { available: true, details: 'mock' }; },
    capabilities() { return ['coding']; },
    metadata() { return { provider: 'mock' }; },
  };
}

describe('E2E Full Pipeline (API → Worker → Provider → Finalizer → Git Commit)', () => {
  let testRoot: string;
  let taskRepo: TestTaskRepository;
  let repoPath: string;
  let remotePath: string;

  beforeEach(async () => {
    testRoot = join(
      process.env.LOCALAPPDATA || '/tmp',
      'hermes',
      'e2e-full-pipeline-' + process.hrtime.bigint(),
    );
    await mkdir(testRoot, { recursive: true });
    repoPath = join(testRoot, 'repo');
      await mkdir(repoPath, { recursive: true });
      // Instantiate in‑memory task repository
      taskRepo = new TestTaskRepository();
    // Initialize the repository
    execSync('git init -b main', { cwd: repoPath, stdio: 'ignore' });
    execSync('git config user.name "Test"', { cwd: repoPath, stdio: 'ignore' });
    execSync('git config user.email "test@example.com"', { cwd: repoPath, stdio: 'ignore' });
    // Create an initial commit so remote has a main branch
    const readmePath = join(repoPath, 'README.md');
    await writeFile(readmePath, 'Initial');
    execSync('git add .', { cwd: repoPath, stdio: 'ignore' });
    execSync('git commit -m "init"', { cwd: repoPath, stdio: 'ignore' });
    // Initialize a bare remote repository for push testing
    remotePath = join(testRoot, 'remote.git');
    await mkdir(remotePath, { recursive: true });
    execSync('git init --bare', { cwd: remotePath, stdio: 'ignore' });
    execSync('git --git-dir="' + remotePath.replace(/\\/g, '/') + '" symbolic-ref HEAD refs/heads/main', { stdio: 'ignore' });
    // Add remote origin to the working repo
    execSync(`git remote add origin "${remotePath}"`, { cwd: repoPath, stdio: 'ignore' });
    // Push initial commit to remote
    execSync('git push -u origin main', { cwd: repoPath, stdio: 'ignore' });
  });

  afterEach(async () => {
    try { await rm(testRoot, { recursive: true, force: true }); } catch {}
  });

    it('completes a task, creates a commit with hello.txt, pushes to remote, and verifies remote', async () => {
      const task = taskRepo.create({
        project: 'e2e-pipeline',
        repository: repoPath,
        objective: 'Create hello.txt via mock provider',
        prompt: 'Create hello.txt',
      });

      const provider = createMockFileProvider();
      const worker = new RouterWorker(taskRepo, provider);

      // Execute the worker loop (claim → execute → finalize)
      // Since executeOnce executes asynchronously and creates the workspace dynamically,
      // we wrap claim and update methods of the taskRepo to configure the workspace origin remote path
      const originalUpdate = taskRepo.update.bind(taskRepo);
      taskRepo.update = async (id, patch) => {
        if (patch.status === 'TESTING' && patch.workspacePath) {
          execSync(`git remote set-url origin "${remotePath.replace(/\\/g, '/')}"`, { cwd: patch.workspacePath, stdio: 'ignore' });
        }
        return originalUpdate(id, patch);
      };

      await worker.executeOnce();

      const updatedTask = await taskRepo.get(task.id);
      if (!updatedTask) throw new Error('Task not found after execution');

      // Verify task status and commit SHA
      expect(updatedTask.status).toBe('COMPLETED');
      expect(updatedTask.commitSha).toBeTruthy();
      expect(updatedTask.commitSha).toMatch(/^[0-9a-f]{40}$/);
      expect(updatedTask.branch).toBeTruthy();

      // Verify hello.txt existence and contents directly in the bare remote
      const gitDir = remotePath.replace(/\\/g, '/');
      const remoteRef = execSync(
        `git --git-dir="${gitDir}" rev-parse "refs/heads/${updatedTask.branch}"`,
        { encoding: 'utf8' }
      ).trim();
      expect(remoteRef).toBe(updatedTask.commitSha);

      const commitType = execSync(
        `git --git-dir="${gitDir}" cat-file -t ${updatedTask.commitSha}`,
        { encoding: 'utf8' }
      ).trim();
      expect(commitType).toBe('commit');

      const treeSha = execSync(
        `git --git-dir="${gitDir}" rev-parse "${updatedTask.commitSha}^{tree}"`,
        { encoding: 'utf8' }
      ).trim();

      const treeEntry = execSync(
        `git --git-dir="${gitDir}" ls-tree ${treeSha} -- hello.txt`,
        { encoding: 'utf8' }
      ).trim();
      expect(treeEntry).toContain('hello.txt');

      const blobSha = treeEntry.split(/\s+/)[2];
      expect(blobSha).toBeTruthy();

      const helloContent = execSync(
        `git --git-dir="${gitDir}" cat-file -p ${blobSha}`,
        { encoding: 'utf8' }
      ).trim();
      expect(helloContent).toBe('PUB DEV LOOP E2E PIPELINE TEST');
    }, 120_000);
});

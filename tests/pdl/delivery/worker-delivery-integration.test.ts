import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import { RouterWorker } from '../../../src/router-worker.js';
import type { AgentProvider, ProviderTaskResult } from '../../../src/providers/types.js';
import type { Task, TaskRepository } from '../../../src/domain.js';
import { ProductCatalog, type ProductManifest } from '../../../src/pdl/products/catalog.js';
import type { RemoteDeliveryGate } from '../../../src/pdl/delivery/remote-delivery-gate.js';
import type { RemoteDeliveryResult } from '../../../src/pdl/delivery/types.js';

// --- helpers ---

async function initGitRepo(root: string): Promise<void> {
  await mkdir(root, { recursive: true });
  execSync('git init', { cwd: root, stdio: 'ignore' });
  execSync('git config user.name "TEST"', { cwd: root, stdio: 'ignore' });
  execSync('git config user.email "test@test.com"', { cwd: root, stdio: 'ignore' });
  execSync('git commit --allow-empty -m "init"', { cwd: root, stdio: 'ignore' });
}

class TestTaskRepository implements TaskRepository {
  private tasks: Map<string, Task> = new Map();

  create(input: { project: string; repository: string; objective: string; prompt: string; priority?: number }): Task {
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
      branch: null,
      commitSha: null,
      gitStatus: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      leaseOwner: null,
      leaseDeadline: null,
      heartbeatAt: null,
      workspacePath: null,
      prototypeSessionId: null,
    };
    this.tasks.set(task.id, task);
    return task;
  }

  async get(id: string): Promise<Task | null> {
    return this.tasks.get(id) || null;
  }
  async list(): Promise<Task[]> {
    return Array.from(this.tasks.values());
  }
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
  async cancel(id: string): Promise<Task | null> {
    return this.update(id, { status: 'CANCELLED' });
  }
  async retry(id: string): Promise<Task | null> {
    return this.update(id, { status: 'QUEUED' });
  }
  async heartbeat(_id: string, _deadline: Date): Promise<boolean> {
    return true;
  }
  async reclaimStuck(): Promise<number> {
    return 0;
  }
}

describe('Worker Integration: BaseWorker with RemoteDeliveryGate', () => {
  let repoDir: string;
  const originalEnv = { ...process.env };

  const sampleProduct: ProductManifest = {
    productId: 'pub-rate-calculator',
    repository: 'https://github.com/pubcoreagencia/pub-rate-calculator.git',
    organization: 'pubcoreagencia',
    defaultBranch: 'main',
    developmentBranchPolicy: ['feat/*'],
    testCommand: 'echo ok',
    allowedPaths: ['src/**'],
    protectedPaths: ['.github/**'],
    maxAutonomyLevel: 5,
    remotePersistenceEligible: true,
  };

  const catalog = new ProductCatalog([sampleProduct]);

  beforeEach(async () => {
    repoDir = join(tmpdir(), 'pdl-worker-delivery-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6));
    await initGitRepo(repoDir);
  });

  afterEach(async () => {
    process.env = { ...originalEnv };
    try {
      await rm(repoDir, { recursive: true, force: true });
    } catch {}
  });

  it('delivers task autonomously and records delivery evidence in task.result when policy allows', async () => {
    process.env.AUTONOMOUS_DELIVERY_ENABLED = 'true';

    const repo = new TestTaskRepository();
    const task = repo.create({
      project: 'pub-rate-calculator',
      repository: repoDir,
      objective: 'Add delivery feature',
      prompt: 'Implement remote delivery',
    });

    const mockProvider: AgentProvider = {
      kind: '9router',
      model: 'test-model',
      async execute(_t, ws): Promise<ProviderTaskResult> {
        await writeFile(join(ws, 'src', 'index.ts'), 'export const hello = true;');
        return {
          status: 'COMPLETED',
          provider: '9router',
          model: 'test-model',
          exitCode: 0,
          durationMs: 50,
          stdout: 'done',
          stderr: '',
          changedFiles: ['src/index.ts'],
          commit: null,
          errorCode: null,
          errorMessage: null,
          toolCalls: 1,
          toolRounds: 1,
        };
      },
      async health() {
        return { available: true };
      },
      capabilities() {
        return ['coding'];
      },
      metadata() {
        return {};
      },
    };

    const mockDeliveryResult: RemoteDeliveryResult = {
      status: 'DELIVERY_COMPLETED',
      deliveryState: {
        phase: 'DELIVERY_COMPLETED',
        pr: {
          number: 101,
          url: 'https://github.com/pubcoreagencia/pub-rate-calculator/pull/101',
          headSha: 'mock_sha',
          baseBranch: 'main',
          headBranch: 'feat/test',
          state: 'MERGED',
          mergeable: true,
          hasUnattributedCommits: false,
          updatedAt: '2026-09-14T03:00:00Z',
        },
        ci: null,
        governance: null,
        authorization: null,
        postMerge: {
          previousMainSha: 'prev_sha',
          currentMainSha: 'new_main_sha',
          mergeCommitSha: 'merge_sha',
          mainAdvanced: true,
          postMergeCiStatus: 'SUCCESS',
          verifiedAt: '2026-09-14T03:01:00Z',
        },
        reasons: [],
        updatedAt: '2026-09-14T03:01:00Z',
      },
    };

    const mockDeliveryGate = {
      deliver: vi.fn().mockResolvedValue(mockDeliveryResult),
    } as unknown as RemoteDeliveryGate;

    const mockRemotePersistence = {
      persist: vi.fn().mockImplementation(async (opts) => ({
        status: 'VERIFIED',
        repository: opts.targetRepository,
        branch: opts.branch,
        pushAttempted: true,
        pushSucceeded: true,
        localSha: opts.localSha,
        remoteSha: opts.localSha,
        remoteVerified: true,
      })),
    } as any;

    // Create src directory in repo
    await mkdir(join(repoDir, 'src'), { recursive: true });
    await writeFile(join(repoDir, 'src', 'index.ts'), '// initial');
    execSync('git add src/index.ts', { cwd: repoDir, stdio: 'ignore' });
    execSync('git commit -m "init code"', { cwd: repoDir, stdio: 'ignore' });

    const worker = new RouterWorker(
      repo,
      mockProvider,
      'test-worker',
      undefined,
      undefined,
      undefined,
      catalog,
      mockRemotePersistence,
      undefined,
      mockDeliveryGate
    );

    const ran = await worker.executeOnce();
    expect(ran).toBe(true);

    const updatedTask = await repo.get(task.id);
    expect(updatedTask).not.toBeNull();
    expect(updatedTask?.status).toBe('COMPLETED');
    expect(mockDeliveryGate.deliver).toHaveBeenCalledTimes(1);

    const resultPayload = updatedTask?.result as Record<string, any>;
    expect(resultPayload?.delivery).toBeDefined();
    expect(resultPayload?.delivery.phase).toBe('DELIVERY_COMPLETED');
    expect(resultPayload?.delivery.pr.number).toBe(101);
    expect(resultPayload?.delivery.postMerge.mainAdvanced).toBe(true);
  });

  it('sets task status to BLOCKED when autonomous delivery gate is blocked', async () => {
    process.env.AUTONOMOUS_DELIVERY_ENABLED = 'true';

    const repo = new TestTaskRepository();
    const task = repo.create({
      project: 'pub-rate-calculator',
      repository: repoDir,
      objective: 'Add delivery feature',
      prompt: 'Implement remote delivery',
    });

    const mockProvider: AgentProvider = {
      kind: '9router',
      model: 'test-model',
      async execute(_t, ws): Promise<ProviderTaskResult> {
        await writeFile(join(ws, 'src', 'index.ts'), 'export const hello = true;');
        return {
          status: 'COMPLETED',
          provider: '9router',
          model: 'test-model',
          exitCode: 0,
          durationMs: 50,
          stdout: 'done',
          stderr: '',
          changedFiles: ['src/index.ts'],
          commit: null,
          errorCode: null,
          errorMessage: null,
          toolCalls: 1,
          toolRounds: 1,
        };
      },
      async health() {
        return { available: true };
      },
      capabilities() {
        return ['coding'];
      },
      metadata() {
        return {};
      },
    };

    const mockDeliveryResult: RemoteDeliveryResult = {
      status: 'DELIVERY_BLOCKED',
      errorCode: 'CI_FAILURE',
      errorMessage: 'Required CI check failed',
      deliveryState: {
        phase: 'DELIVERY_BLOCKED',
        pr: null,
        ci: null,
        governance: null,
        authorization: null,
        postMerge: null,
        reasons: ['Required CI check failed'],
        updatedAt: '2026-09-14T03:00:00Z',
      },
    };

    const mockDeliveryGate = {
      deliver: vi.fn().mockResolvedValue(mockDeliveryResult),
    } as unknown as RemoteDeliveryGate;

    const mockRemotePersistence = {
      persist: vi.fn().mockImplementation(async (opts) => ({
        status: 'VERIFIED',
        repository: opts.targetRepository,
        branch: opts.branch,
        pushAttempted: true,
        pushSucceeded: true,
        localSha: opts.localSha,
        remoteSha: opts.localSha,
        remoteVerified: true,
      })),
    } as any;

    await mkdir(join(repoDir, 'src'), { recursive: true });
    await writeFile(join(repoDir, 'src', 'index.ts'), '// initial');
    execSync('git add src/index.ts', { cwd: repoDir, stdio: 'ignore' });
    execSync('git commit -m "init code"', { cwd: repoDir, stdio: 'ignore' });

    const worker = new RouterWorker(
      repo,
      mockProvider,
      'test-worker',
      undefined,
      undefined,
      undefined,
      catalog,
      mockRemotePersistence,
      undefined,
      mockDeliveryGate
    );

    const ran = await worker.executeOnce();
    expect(ran).toBe(true);

    const updatedTask = await repo.get(task.id);
    expect(updatedTask).not.toBeNull();
    // Invariant: fail-closed status BLOCKED
    expect(updatedTask?.status).toBe('BLOCKED');
    expect(updatedTask?.error).toContain('Remote delivery blocked: Required CI check failed');

    const resultPayload = updatedTask?.result as Record<string, any>;
    expect(resultPayload?.delivery).toBeDefined();
    expect(resultPayload?.delivery.phase).toBe('DELIVERY_BLOCKED');
  });
});

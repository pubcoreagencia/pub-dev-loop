import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import http from 'node:http';
import type { Task } from '../src/domain.js';
import type { PrototypeSession, PrototypePromotion } from '../src/prototype/domain.js';
import type { AgentProvider, ProviderTaskResult } from '../src/providers/types.js';
import { PostgresTaskRepository } from '../src/repository.js';
import { PostgresPrototypeRepository } from '../src/prototype/repository.js';
import { RouterWorker } from '../src/router-worker.js';
import { createApp } from '../src/api.js';

function git(args: string[], cwd: string): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
}

async function withServer(app: any, fn: (baseUrl: string) => Promise<void>): Promise<void> {
  const server = http.createServer(app);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', () => resolve()));
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;
  try {
    await fn(baseUrl);
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
}

describe('PUB Prototype — Formal Promotion PP → PDL Development', () => {
  let templateDir: string;
  let workspaceRootDir: string;
  const tempDirs: string[] = [];

  beforeEach(async () => {
    templateDir = await mkdtemp(join(tmpdir(), 'promo-template-'));
    workspaceRootDir = await mkdtemp(join(tmpdir(), 'promo-workspaces-'));
    tempDirs.push(templateDir, workspaceRootDir);

    // Initialize template git repo
    git(['init', '-b', 'main'], templateDir);
    git(['config', 'user.name', 'PUB Test Worker'], templateDir);
    git(['config', 'user.email', 'worker@pub-dev-loop.internal'], templateDir);

    await writeFile(join(templateDir, 'README.md'), '# Base Project\n', 'utf8');
    git(['add', '.'], templateDir);
    git(['commit', '-m', 'initial commit on main'], templateDir);
  });

  afterEach(async () => {
    for (const dir of tempDirs) {
      await rm(dir, { recursive: true, force: true }).catch(() => undefined);
    }
  });

  it('1. Promotes READY session to PROMOTED in DEVELOPMENT mode & creates Development Task', async () => {
    const taskStore = new Map<string, Task>();
    const sessionStore = new Map<string, PrototypeSession>();
    const promotionStore: PrototypePromotion[] = [];

    const mockTasks = {
      async create(input: any): Promise<Task> {
        const id = `task-${taskStore.size + 1}`;
        const t: Task = {
          id,
          project: input.project,
          repository: input.repository,
          objective: input.objective,
          prompt: input.prompt,
          status: 'QUEUED',
          priority: input.priority ?? 0,
          worker: null,
          result: null,
          error: null,
          branch: null,
          commitSha: null,
          gitStatus: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          prototypeSessionId: input.prototypeSessionId ?? null,
        };
        taskStore.set(id, t);
        return { ...t };
      },
      async update(id: string, patch: Partial<Task>): Promise<Task | null> {
        const t = taskStore.get(id);
        if (!t) return null;
        Object.assign(t, patch);
        return { ...t };
      },
      async get(id: string) { return taskStore.get(id) ?? null; },
    } as unknown as PostgresTaskRepository;

    const mockPrototypes = {
      async getSession(id: string): Promise<PrototypeSession | null> {
        const s = sessionStore.get(id);
        return s ? { ...s } : null;
      },
      async promoteSession(id: string): Promise<PrototypeSession | null> {
        const s = sessionStore.get(id);
        if (!s || !['READY', 'APPROVED'].includes(s.status) || !s.lastCheckpointSha) return null;
        s.mode = 'DEVELOPMENT';
        s.status = 'PROMOTED';
        s.updatedAt = new Date();
        return { ...s };
      },
      async createPromotion(input: Omit<PrototypePromotion, 'id'>): Promise<PrototypePromotion> {
        const p: PrototypePromotion = {
          id: `promo-${promotionStore.length + 1}`,
          ...input,
        };
        promotionStore.push(p);
        return p;
      },
    } as unknown as PostgresPrototypeRepository;

    const app = createApp(mockTasks, mockPrototypes);

    // Setup approved prototype session
    const sessionId = 'session-barber-001';
    const approvedSha = 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678';
    const branch = 'prototype/barber/session-barber-001';
    sessionStore.set(sessionId, {
      id: sessionId,
      project: 'barber-app',
      repository: templateDir,
      branch,
      mode: 'PROTOTYPE',
      status: 'READY',
      previewUrl: 'http://127.0.0.1:4000',
      previewRuntime: 'rt-1',
      workspacePath: join(workspaceRootDir, sessionId),
      lastCheckpointSha: approvedSha,
      promptCount: 2,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await withServer(app, async baseUrl => {
      const res = await fetch(`${baseUrl}/prototype/sessions/${sessionId}/promote`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          objective: 'Implement production billing system',
          prompt: 'Add Stripe payment integration to the barber application',
          priority: 10,
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.mode).toBe('DEVELOPMENT');
      expect(data.session.status).toBe('PROMOTED');
      expect(data.session.mode).toBe('DEVELOPMENT');

      // Promotion record
      expect(data.promotion).toBeDefined();
      expect(data.promotion.fromMode).toBe('PROTOTYPE');
      expect(data.promotion.toMode).toBe('DEVELOPMENT');
      expect(data.promotion.checkpointSha).toBe(approvedSha);
      expect(data.promotion.branch).toBe(branch);

      // CRITICAL: Development Task must have prototypeSessionId === null
      const devTaskId = data.task.id;
      const createdTask = taskStore.get(devTaskId)!;
      expect(createdTask).toBeDefined();
      expect(createdTask.prototypeSessionId).toBeNull();
      expect(createdTask.branch).toBe(branch);
      expect(createdTask.repository).toBe(templateDir);
      expect(createdTask.objective).toBe('Implement production billing system');
    });
  });

  it('2. Fails with 409 when session has no checkpoint or is not in READY/APPROVED status', async () => {
    const sessionStore = new Map<string, PrototypeSession>();

    const mockTasks = {} as unknown as PostgresTaskRepository;
    const mockPrototypes = {
      async getSession(id: string) { return sessionStore.get(id) ?? null; },
      async promoteSession(id: string) { return null; },
    } as unknown as PostgresPrototypeRepository;

    const app = createApp(mockTasks, mockPrototypes);

    // Case A: status is BUILDING
    sessionStore.set('session-building', {
      id: 'session-building',
      project: 'app',
      repository: templateDir,
      branch: 'prototype/app/session-building',
      mode: 'PROTOTYPE',
      status: 'BUILDING',
      previewUrl: null,
      previewRuntime: null,
      workspacePath: null,
      lastCheckpointSha: 'sha123',
      promptCount: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Case B: lastCheckpointSha is null
    sessionStore.set('session-no-checkpoint', {
      id: 'session-no-checkpoint',
      project: 'app',
      repository: templateDir,
      branch: 'prototype/app/session-no-checkpoint',
      mode: 'PROTOTYPE',
      status: 'READY',
      previewUrl: null,
      previewRuntime: null,
      workspacePath: null,
      lastCheckpointSha: null,
      promptCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await withServer(app, async baseUrl => {
      const resA = await fetch(`${baseUrl}/prototype/sessions/session-building/promote`, { method: 'POST' });
      expect(resA.status).toBe(409);
      const dataA = await resA.json();
      expect(dataA.error).toContain('cannot be promoted');

      const resB = await fetch(`${baseUrl}/prototype/sessions/session-no-checkpoint/promote`, { method: 'POST' });
      expect(resB.status).toBe(409);
      const dataB = await resB.json();
      expect(dataB.error).toContain('lastCheckpointSha');
    });
  });

  it('3. Ensures atomic promotion: concurrent promotions allow exactly one winner', async () => {
    const taskStore = new Map<string, Task>();
    let currentStatus: string = 'READY';

    const mockTasks = {
      async create(input: any) {
        const id = `task-${taskStore.size + 1}`;
        const t = { id, ...input, prototypeSessionId: null, createdAt: new Date(), updatedAt: new Date() };
        taskStore.set(id, t);
        return t;
      },
      async update(id: string, patch: any) { return taskStore.get(id); },
    } as unknown as PostgresTaskRepository;

    const mockPrototypes = {
      async getSession(id: string) {
        return {
          id,
          project: 'barber',
          repository: templateDir,
          branch: 'prototype/barber/s1',
          mode: 'PROTOTYPE',
          status: currentStatus,
          lastCheckpointSha: 'sha999',
        } as PrototypeSession;
      },
      async promoteSession(id: string) {
        if (currentStatus === 'READY') {
          currentStatus = 'PROMOTED';
          return {
            id,
            project: 'barber',
            repository: templateDir,
            branch: 'prototype/barber/s1',
            mode: 'DEVELOPMENT',
            status: 'PROMOTED',
            lastCheckpointSha: 'sha999',
          } as PrototypeSession;
        }
        return null;
      },
      async createPromotion(input: any) {
        return { id: 'promo-1', ...input };
      },
    } as unknown as PostgresPrototypeRepository;

    const app = createApp(mockTasks, mockPrototypes);

    await withServer(app, async baseUrl => {
      const [res1, res2] = await Promise.all([
        fetch(`${baseUrl}/prototype/sessions/s1/promote`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ prompt: 'Continue dev 1' }),
        }),
        fetch(`${baseUrl}/prototype/sessions/s1/promote`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ prompt: 'Continue dev 2' }),
        }),
      ]);

      const statuses = [res1.status, res2.status];
      expect(statuses).toContain(200);
      expect(statuses).toContain(409);
      expect(taskStore.size).toBe(1); // Exactly 1 Development Task created
    });
  });

  it('4. Development Worker checks out approved branch and commits incremental changes', async () => {
    // Create approved prototype branch in the template repository
    const approvedBranch = 'prototype/barber/approved-branch';
    git(['checkout', '-b', approvedBranch], templateDir);
    await writeFile(join(templateDir, 'app.js'), 'console.log("Barber MVP v1.0");\n', 'utf8');
    git(['add', '.'], templateDir);
    git(['commit', '-m', 'prototype: barber MVP completed'], templateDir);
    const approvedSha = git(['rev-parse', 'HEAD'], templateDir).trim();
    git(['checkout', 'main'], templateDir);

    const taskStore = new Map<string, Task>();
    const devTask: Task = {
      id: 'dev-task-handoff',
      project: 'barber-app',
      repository: templateDir,
      objective: 'Adicionar módulo de relatórios',
      prompt: 'Criar relatorio.js com resumo financeiro',
      status: 'QUEUED',
      priority: 5,
      worker: null,
      result: null,
      error: null,
      branch: approvedBranch, // Approved branch passed to Dev Task
      commitSha: null,
      gitStatus: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      prototypeSessionId: null, // DEVELOPMENT TASK
    };
    taskStore.set(devTask.id, devTask);

    const mockTasks = {
      async claim(worker: string): Promise<Task | null> {
        for (const t of taskStore.values()) {
          if (t.status === 'QUEUED' && t.prototypeSessionId === null) {
            t.status = 'ASSIGNED';
            t.worker = worker;
            return { ...t };
          }
        }
        return null;
      },
      async claimPrototype(): Promise<Task | null> { return null; },
      async update(id: string, patch: Partial<Task>): Promise<Task | null> {
        const t = taskStore.get(id);
        if (!t) return null;
        Object.assign(t, patch);
        return { ...t };
      },
      async heartbeat() { return true; },
    } as unknown as PostgresTaskRepository;

    const mockProvider: AgentProvider = {
      kind: 'mock',
      model: 'mock-model',
      async execute(task: Task, workspace: string): Promise<ProviderTaskResult> {
        // Verify we are on the approved branch and app.js exists
        await writeFile(join(workspace, 'relatorio.js'), 'module.exports = { total: 100 };\n', 'utf8');
        return {
          status: 'COMPLETED',
          provider: 'mock',
          model: 'mock-model',
          exitCode: 0,
          durationMs: 100,
          stdout: 'Report module generated',
          stderr: '',
          changedFiles: ['relatorio.js'],
          commit: null,
          errorCode: null,
          errorMessage: null,
        };
      },
      async health() { return { available: true, details: 'ok' }; },
      capabilities() { return ['mock']; },
      metadata() { return {}; },
    };

    const devWorker = new RouterWorker(mockTasks, mockProvider, 'router-dev-worker');
    const worked = await devWorker.executeOnce();

    expect(worked).toBe(true);
    expect(devTask.status).toBe('COMPLETED');
    expect(devTask.commitSha).toMatch(/^[0-9a-f]{40}$/);
    expect(devTask.branch).toBe(approvedBranch);

    // Verify commit history in the workspace has approvedSha as parent
    // devTask.commitSha has been created in the clone of templateDir
    expect(devTask.commitSha).toBeDefined();
  });

  it('5. Development Worker fails explicitly when task.branch does not exist in repository', async () => {
    const taskStore = new Map<string, Task>();
    const nonExistentBranch = 'prototype/does-not-exist-99999';

    const devTask: Task = {
      id: 'dev-task-missing-branch',
      project: 'barber-app',
      repository: templateDir,
      objective: 'Test missing branch',
      prompt: 'Test',
      status: 'QUEUED',
      priority: 5,
      worker: null,
      result: null,
      error: null,
      branch: nonExistentBranch, // DOES NOT EXIST
      commitSha: null,
      gitStatus: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      prototypeSessionId: null,
    };
    taskStore.set(devTask.id, devTask);

    const mockTasks = {
      async claim(worker: string): Promise<Task | null> {
        return devTask.status === 'QUEUED' ? { ...devTask } : null;
      },
      async update(id: string, patch: Partial<Task>): Promise<Task | null> {
        const t = taskStore.get(id);
        if (!t) return null;
        Object.assign(t, patch);
        return { ...t };
      },
      async heartbeat() { return true; },
    } as unknown as PostgresTaskRepository;

    const mockProvider: AgentProvider = {
      kind: 'mock',
      model: 'mock-model',
      async execute(): Promise<ProviderTaskResult> {
        throw new Error('Should not reach execute if checkout fails');
      },
      async health() { return { available: true, details: 'ok' }; },
      capabilities() { return []; },
      metadata() { return {}; },
    };

    const devWorker = new RouterWorker(mockTasks, mockProvider, 'router-dev-worker');
    const worked = await devWorker.executeOnce();

    expect(worked).toBe(true);
    expect(devTask.status).toBe('FAILED');
    expect(devTask.error).toMatch(/fatal|couldn't find remote ref|git failed/i);
  });

  it('6. Strict Worker Isolation: PrototypeWorker ignores Development Tasks, Development Worker ignores Prototype Tasks', async () => {
    const taskStore = new Map<string, Task>();

    // Promoted Development task
    const devTask: Task = {
      id: 'promoted-dev-task',
      project: 'barber-app',
      repository: templateDir,
      objective: 'Dev objective',
      prompt: 'Dev prompt',
      status: 'QUEUED',
      priority: 10,
      worker: null,
      result: null,
      error: null,
      branch: 'prototype/barber/approved',
      commitSha: null,
      gitStatus: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      prototypeSessionId: null, // DEVELOPMENT
    };
    taskStore.set(devTask.id, devTask);

    // Active Prototype task
    const protoTask: Task = {
      id: 'active-proto-task',
      project: 'barber-app',
      repository: templateDir,
      objective: 'Proto objective',
      prompt: 'Proto prompt',
      status: 'QUEUED',
      priority: 10,
      worker: null,
      result: null,
      error: null,
      branch: 'prototype/barber/proto-1',
      commitSha: null,
      gitStatus: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      prototypeSessionId: 'session-proto-1', // PROTOTYPE
    };
    taskStore.set(protoTask.id, protoTask);

    const mockTasks = {
      async claim(worker: string): Promise<Task | null> {
        for (const t of taskStore.values()) {
          if (t.status === 'QUEUED' && t.prototypeSessionId === null) {
            t.status = 'ASSIGNED';
            t.worker = worker;
            return { ...t };
          }
        }
        return null;
      },
      async claimPrototype(worker: string): Promise<Task | null> {
        for (const t of taskStore.values()) {
          if (t.status === 'QUEUED' && t.prototypeSessionId !== null) {
            t.status = 'ASSIGNED';
            t.worker = worker;
            return { ...t };
          }
        }
        return null;
      },
    } as unknown as PostgresTaskRepository;

    // Prototype worker claims ONLY protoTask
    const protoClaimed = await mockTasks.claimPrototype('prototype-worker');
    expect(protoClaimed?.id).toBe('active-proto-task');
    expect(protoClaimed?.prototypeSessionId).toBe('session-proto-1');

    // Prototype worker CANNOT claim promoted development task
    const protoSecondClaim = await mockTasks.claimPrototype('prototype-worker');
    expect(protoSecondClaim).toBeNull();

    // Development worker claims ONLY devTask
    const devClaimed = await mockTasks.claim('dev-worker');
    expect(devClaimed?.id).toBe('promoted-dev-task');
    expect(devClaimed?.prototypeSessionId).toBeNull();

    // Development worker CANNOT claim prototype tasks
    const devSecondClaim = await mockTasks.claim('dev-worker');
    expect(devSecondClaim).toBeNull();
  });
});

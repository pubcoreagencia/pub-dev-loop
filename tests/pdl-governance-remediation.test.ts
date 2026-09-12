import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Server } from 'node:http';
import { writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import type { Task, TaskRepository } from '../src/domain.js';
import {
  PdlGovernanceEngine,
  type GovernanceLimits,
} from '../src/pdl/governance/index.js';
import { createPdlApp } from '../src/pdl/api/entry.js';
import { TaskFinalizer } from '../src/finalizer.js';
import { BaseWorker, type AttemptResult } from '../src/worker-service.js';
import { defaultRemotePersistence } from '../src/pdl/persistence/remote-persistence.js';

// Mock DB pool helper
function createMockPool(rows: any[] = [], shouldFail = false) {
  return {
    query: async (sql: string, params?: any[]) => {
      if (shouldFail) {
        throw new Error('Simulated database connection failure');
      }
      if (sql.includes('SELECT') && sql.includes('pdl_governance_state')) {
        return { rows: [...rows] };
      }
      if (sql.includes('INSERT') || sql.includes('UPDATE')) {
        if (params && params.length >= 2) {
          rows[0] = {
            id: 'canonical',
            active_level: params[1],
            kill_switch_active: params[2],
            max_consecutive_tasks: params[3],
            max_task_duration_ms: params[4],
            max_tool_rounds_per_task: params[5],
            max_correction_attempts: params[6],
            max_consecutive_failures: params[7],
            allowed_products: params[8],
            updated_by: params[9],
            reason: params[10],
          };
        }
        return { rowCount: 1, rows };
      }
      return { rows: [] };
    },
  } as any;
}

function createDummyTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-test-rem-1',
    project: 'pub-rate-calculator',
    repository: 'https://github.com/pubcoreagencia/pub-rate-calculator.git',
    objective: 'Test governance remediation',
    prompt: 'Run remediation verification',
    status: 'QUEUED',
    priority: 1,
    worker: null,
    result: null,
    error: null,
    branch: 'remediation-test',
    commitSha: '3c56912d4d419ef46cebb6530247b0f0db1cee63',
    gitStatus: 'clean',
    createdAt: new Date(),
    updatedAt: new Date(),
    leaseOwner: null,
    leaseDeadline: null,
    heartbeatAt: null,
    workspacePath: null,
    prototypeSessionId: null,
    ...overrides,
  };
}

class MemoryTaskRepo implements TaskRepository {
  tasks = new Map<string, Task>();
  constructor(initial: Task[] = []) {
    for (const t of initial) this.tasks.set(t.id, { ...t });
  }
  async claim(workerName: string): Promise<Task | null> {
    for (const t of this.tasks.values()) {
      if (t.status === 'QUEUED') {
        t.status = 'ASSIGNED';
        t.worker = workerName;
        return { ...t };
      }
    }
    return null;
  }
  async update(id: string, patch: Partial<Task>): Promise<Task | null> {
    const t = this.tasks.get(id);
    if (!t) return null;
    Object.assign(t, patch);
    return { ...t };
  }
  async get(id: string): Promise<Task | null> {
    return this.tasks.get(id) || null;
  }
  async list(): Promise<Task[]> {
    return Array.from(this.tasks.values());
  }
  async create(data: any): Promise<Task> {
    const t = createDummyTask(data);
    this.tasks.set(t.id, t);
    return t;
  }
}

class TestWorker extends BaseWorker {
  executeTaskCallCount = 0;
  protected async executeWithRetry(task: Task): Promise<AttemptResult> {
    this.executeTaskCallCount++;
    return {
      status: 'COMPLETED',
      workspace: '/tmp/test-workspace',
      declaredChangedFiles: ['file.txt'],
      stdout: 'done',
      stderr: '',
      exitCode: 0,
    };
  }
}

const testTmpDir = join(process.cwd(), 'scratch', 'test-remediation-ws');

async function initGitRepo(root: string): Promise<void> {
  await mkdir(root, { recursive: true });
  execSync('git init', { cwd: root, stdio: 'ignore' });
  execSync('git config user.name "Test Remediation"', { cwd: root, stdio: 'ignore' });
  execSync('git config user.email "test@remediation.com"', { cwd: root, stdio: 'ignore' });
}

describe('PDL Phase 5.5 Step 1: Blocker Remediation Suite', () => {
  const adminSecret = 'test-admin-secret-key-12345';
  const readSecret = 'test-read-secret-key-67890';
  let activeServer: Server | null = null;
  let testRepoRoot: string;

  beforeEach(async () => {
    delete process.env.PDL_GOVERNANCE_ADMIN_KEY;
    delete process.env.PDL_GOVERNANCE_READ_KEY;
    delete process.env.PDL_EMERGENCY_STOP;
    delete process.env.PDL_KILL_SWITCH;
    testRepoRoot = join(testTmpDir, 'repo-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7));
    await initGitRepo(testRepoRoot);
    await writeFile(join(testRepoRoot, 'README.md'), '# Baseline\n');
    execSync('git add -A && git commit -m "init"', { cwd: testRepoRoot, stdio: 'ignore' });
  });

  afterEach(async () => {
    delete process.env.PDL_GOVERNANCE_ADMIN_KEY;
    delete process.env.PDL_GOVERNANCE_READ_KEY;
    delete process.env.PDL_EMERGENCY_STOP;
    delete process.env.PDL_KILL_SWITCH;
    if (activeServer) {
      await new Promise((resolve) => activeServer!.close(resolve));
      activeServer = null;
    }
    await rm(testRepoRoot, { recursive: true, force: true }).catch(() => {});
    vi.restoreAllMocks();
  });

  // ==========================================
  // BLOQUEADOR 1: GOVERNANCE API AUTH & AUTHZ
  // ==========================================
  describe('Blocker 1: Governance API Authentication & Authorization', () => {
    const canonicalRow = {
      id: 'canonical',
      active_level: 2,
      kill_switch_active: false,
      max_consecutive_tasks: 2,
      max_task_duration_ms: 180000,
      max_tool_rounds_per_task: 10,
      max_correction_attempts: 2,
      max_consecutive_failures: 1,
      allowed_products: ['pub-rate-calculator'],
    };

    async function startServer(authConfig?: { adminKey?: string; readKey?: string }) {
      const pool = createMockPool([canonicalRow]);
      const governance = new PdlGovernanceEngine({ pool });
      const app = createPdlApp(pool, undefined, undefined, { governance, authConfig });
      const server = app.listen(0);
      activeServer = server;
      await new Promise((resolve) => server.once('listening', resolve));
      const port = (server.address() as any).port;
      const baseUrl = `http://127.0.0.1:${port}`;
      return { baseUrl, governance, pool };
    }

    it('API_AUTH_01: Authenticated read succeeds with valid READ token', async () => {
      const { baseUrl } = await startServer({ adminKey: adminSecret, readKey: readSecret });
      const res = await fetch(`${baseUrl}/governance/status`, {
        headers: { Authorization: `Bearer ${readSecret}` },
      });
      expect(res.status).toBe(200);
      const data: any = await res.json();
      expect(data.governance).toBeDefined();
      expect(data.governance.activeLevel).toBe(2);
    });

    it('API_AUTH_02: Unauthenticated read is rejected (fail-closed)', async () => {
      const { baseUrl } = await startServer({ adminKey: adminSecret, readKey: readSecret });
      const res = await fetch(`${baseUrl}/governance/status`);
      expect(res.status).toBe(401);
      const data: any = await res.json();
      expect(data.code).toBe('AUTHENTICATION_REQUIRED');
    });

    it('API_AUTH_03: Authenticated admin write succeeds with valid ADMIN token', async () => {
      const { baseUrl } = await startServer({ adminKey: adminSecret, readKey: readSecret });
      const res = await fetch(`${baseUrl}/governance/kill-switch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminSecret}`,
        },
        body: JSON.stringify({ active: true, reason: 'Test admin toggle' }),
      });
      expect(res.status).toBe(200);
      const data: any = await res.json();
      expect(data.message).toContain('successfully set to true');
    });

    it('API_AUTH_04: Unauthenticated admin write is rejected', async () => {
      const { baseUrl } = await startServer({ adminKey: adminSecret, readKey: readSecret });
      const res = await fetch(`${baseUrl}/governance/kill-switch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: true }),
      });
      expect(res.status).toBe(401);
      const data: any = await res.json();
      expect(data.code).toBe('AUTHENTICATION_REQUIRED');
    });

    it('API_AUTH_05: Authenticated non-admin write is forbidden (role separation)', async () => {
      const { baseUrl } = await startServer({ adminKey: adminSecret, readKey: readSecret });
      const res = await fetch(`${baseUrl}/governance/limits`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${readSecret}`,
        },
        body: JSON.stringify({ activeLevel: 1 }),
      });
      expect(res.status).toBe(403);
      const data: any = await res.json();
      expect(data.code).toBe('INSUFFICIENT_PERMISSIONS');
    });

    it('API_AUTH_06: Missing auth configuration fails closed (all denied)', async () => {
      // Both adminKey and readKey missing
      const { baseUrl } = await startServer({});
      const readRes = await fetch(`${baseUrl}/governance/status`, {
        headers: { Authorization: 'Bearer any-token' },
      });
      expect(readRes.status).toBe(401);
      const readData: any = await readRes.json();
      expect(readData.code).toBe('AUTH_CONFIG_MISSING');

      const writeRes = await fetch(`${baseUrl}/governance/kill-switch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer any-token',
        },
        body: JSON.stringify({ active: false }),
      });
      expect(writeRes.status).toBe(401);
      const writeData: any = await writeRes.json();
      expect(writeData.code).toBe('AUTH_CONFIG_MISSING');
    });

    it('No secret tokens are leaked in API responses', async () => {
      const { baseUrl } = await startServer({ adminKey: adminSecret, readKey: readSecret });
      const res = await fetch(`${baseUrl}/governance/status`, {
        headers: { Authorization: `Bearer ${readSecret}` },
      });
      const responseText = await res.text();
      expect(responseText).not.toContain(adminSecret);
      expect(responseText).not.toContain(readSecret);
    });
  });

  // ==========================================
  // BLOQUEADOR 2: ELIMINATE FINALIZATION BYPASS
  // ==========================================
  describe('Blocker 2: Finalization Gate Integrity', () => {
    it('FINALIZATION_GATE_01: Governance DENY blocks remote persistence', async () => {
      const pool = createMockPool([{
        id: 'canonical',
        active_level: 2,
        kill_switch_active: false,
        allowed_products: ['pub-rate-calculator'],
      }]);
      const governance = new PdlGovernanceEngine({ pool });
      const finalizer = new TaskFinalizer(testRepoRoot);

      // Create changes in repo
      await writeFile(join(testRepoRoot, 'file.txt'), 'content\n');

      const persistSpy = vi.spyOn(defaultRemotePersistence, 'persist').mockResolvedValue({
        status: 'VERIFIED',
        remoteSha: 'abc',
        verifiedDate: new Date().toISOString(),
      } as any);

      // Task with unauthorized product 'pub-unauthorized'
      const task = createDummyTask({ project: 'pub-unauthorized' });
      const result = await finalizer.finalize('obj', 'prompt', {
        governance,
        task,
        remotePersistence: { enabled: true, product: 'pub-unauthorized' },
      });

      expect(result.status).toBe('FAILED');
      expect(result.errorCode).toBe('UNAUTHORIZED_PRODUCT');
      expect(persistSpy).not.toHaveBeenCalled();
    });

    it('FINALIZATION_GATE_02: Governance ALLOW permits remote persistence', async () => {
      const pool = createMockPool([{
        id: 'canonical',
        active_level: 3,
        kill_switch_active: false,
        allowed_products: ['pub-rate-calculator'],
      }]);
      const governance = new PdlGovernanceEngine({ pool });
      const finalizer = new TaskFinalizer(testRepoRoot);

      await writeFile(join(testRepoRoot, 'file.txt'), 'content\n');

      const persistSpy = vi.spyOn(defaultRemotePersistence, 'persist').mockResolvedValue({
        status: 'VERIFIED',
        remoteSha: 'abc123456789',
        verifiedDate: new Date().toISOString(),
      } as any);

      const task = createDummyTask({ project: 'pub-rate-calculator' });
      const result = await finalizer.finalize('obj', 'prompt', {
        governance,
        task,
        remotePersistence: { enabled: true, product: 'pub-rate-calculator' },
      });

      expect(persistSpy).toHaveBeenCalledTimes(1);
      expect(result.status).toBe('COMPLETED');
    });

    it('FINALIZATION_GATE_03: Kill switch ACTIVE blocks remote persistence', async () => {
      const pool = createMockPool([{
        id: 'canonical',
        active_level: 3,
        kill_switch_active: true, // Kill switch active
        allowed_products: ['pub-rate-calculator'],
      }]);
      const governance = new PdlGovernanceEngine({ pool });
      const finalizer = new TaskFinalizer(testRepoRoot);

      await writeFile(join(testRepoRoot, 'file.txt'), 'content\n');

      const persistSpy = vi.spyOn(defaultRemotePersistence, 'persist');

      const task = createDummyTask({ project: 'pub-rate-calculator' });
      const result = await finalizer.finalize('obj', 'prompt', {
        governance,
        task,
        remotePersistence: { enabled: true, product: 'pub-rate-calculator' },
      });

      expect(result.status).toBe('FAILED');
      expect(result.errorCode).toBe('KILL_SWITCH_ACTIVE');
      expect(persistSpy).not.toHaveBeenCalled();
    });

    it('FINALIZATION_GATE_04: Governance config unavailable fails closed (no push)', async () => {
      const pool = createMockPool([], true); // Database throws connection error
      const governance = new PdlGovernanceEngine({ pool });
      const finalizer = new TaskFinalizer(testRepoRoot);

      await writeFile(join(testRepoRoot, 'file.txt'), 'content\n');

      const persistSpy = vi.spyOn(defaultRemotePersistence, 'persist');

      const task = createDummyTask();
      const result = await finalizer.finalize('obj', 'prompt', {
        governance,
        task,
        remotePersistence: { enabled: true, product: 'pub-rate-calculator' },
      });

      expect(result.status).toBe('FAILED');
      expect(persistSpy).not.toHaveBeenCalled();
    });
  });

  // ==========================================
  // BLOQUEADOR 3: ELIMINATE BASEWORKER BYPASS
  // ==========================================
  describe('Blocker 3: BaseWorker Governance Gate Enforcement', () => {
    it('WORKER_GATE_01: BaseWorker claim blocked when kill switch ACTIVE', async () => {
      const pool = createMockPool([{
        id: 'canonical',
        active_level: 2,
        kill_switch_active: true, // Emergency Stop!
        allowed_products: ['pub-rate-calculator'],
      }]);
      const governance = new PdlGovernanceEngine({ pool });
      const task = createDummyTask();
      const repo = new MemoryTaskRepo([task]);

      const worker = new TestWorker(repo, 'test-worker', undefined, governance);
      const claimed = await worker.executeOnce();

      expect(claimed).toBe(false);
      expect(task.status).toBe('QUEUED');
    });

    it('WORKER_GATE_02: BaseWorker claim blocked when Level 0 (Manual only)', async () => {
      const pool = createMockPool([{
        id: 'canonical',
        active_level: 0, // Level 0: manual only
        kill_switch_active: false,
        allowed_products: ['pub-rate-calculator'],
      }]);
      const governance = new PdlGovernanceEngine({ pool });
      const task = createDummyTask();
      const repo = new MemoryTaskRepo([task]);

      const worker = new TestWorker(repo, 'test-worker', undefined, governance);
      const claimed = await worker.executeOnce();

      expect(claimed).toBe(false);
      expect(task.status).toBe('QUEUED');
    });

    it('WORKER_GATE_03: BaseWorker execution blocked when product unauthorized', async () => {
      const pool = createMockPool([{
        id: 'canonical',
        active_level: 2,
        kill_switch_active: false,
        allowed_products: ['pub-rate-calculator'], // Only rate-calc allowed
      }]);
      const governance = new PdlGovernanceEngine({ pool });
      const unauthorizedTask = createDummyTask({
        id: 'unauth-1',
        project: 'pub-unauthorized-repo',
      });
      const repo = new MemoryTaskRepo([unauthorizedTask]);

      const worker = new TestWorker(repo, 'test-worker', undefined, governance);
      const ran = await worker.executeOnce();

      expect(ran).toBe(true);
      const updated = await repo.get('unauth-1');
      expect(updated?.status).toBe('BLOCKED');
      expect(updated?.error).toContain('Product');
    });

    it('WORKER_GATE_04: BaseWorker permits claim and execution when authorized by governance', async () => {
      const pool = createMockPool([{
        id: 'canonical',
        active_level: 2,
        kill_switch_active: false,
        max_task_duration_ms: 180000,
        allowed_products: ['pub-rate-calculator'],
      }]);
      const governance = new PdlGovernanceEngine({ pool });
      const authorizedTask = createDummyTask({ id: 'auth-1' });
      const repo = new MemoryTaskRepo([authorizedTask]);

      const claimSpy = vi.spyOn(governance, 'evaluateClaim');
      const execSpy = vi.spyOn(governance, 'evaluateExecution');

      const worker = new TestWorker(repo, 'test-worker', undefined, governance);
      await worker.executeOnce();

      expect(claimSpy).toHaveBeenCalledTimes(1);
      const claimDecision = await claimSpy.mock.results[0].value;
      expect(claimDecision.allowed).toBe(true);

      expect(execSpy).toHaveBeenCalledTimes(1);
      const execDecision = await execSpy.mock.results[0].value;
      expect(execDecision.allowed).toBe(true);
    });
  });
});

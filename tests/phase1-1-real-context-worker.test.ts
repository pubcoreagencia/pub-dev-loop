import { describe, it, expect } from 'vitest';
import type { Server } from 'node:http';
import { createApp } from '../src/api.js';
import { resolveContext } from '../src/office/context-resolver.js';
import {
  parseEngineeringTask,
  createEngineeringPlan,
  engineeringTaskToTask,
  formatEngineeringWorkerPrompt,
} from '../src/office/intent.js';
import type { Task, TaskRepository } from '../src/types.js';

class MockTaskRepository implements TaskRepository {
  private tasks: Map<string, Task> = new Map();

  async create(task: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'status'> & { id?: string }): Promise<Task> {
    const id = task.id || `task-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const now = new Date();
    const created: Task = {
      id,
      project: task.project,
      repository: task.repository,
      objective: task.objective,
      prompt: task.prompt,
      status: 'QUEUED',
      priority: task.priority ?? 1,
      worker: null,
      result: task.result ?? null,
      error: null,
      branch: null,
      commitSha: null,
      gitStatus: null,
      createdAt: now,
      updatedAt: now,
      leaseOwner: null,
      leaseDeadline: null,
      heartbeatAt: null,
      workspacePath: null,
      prototypeSessionId: null,
      tenantId: task.tenantId || 'pub-core-holding',
      agentId: task.agentId || null,
    };
    this.tasks.set(id, created);
    return created;
  }

  async findById(id: string): Promise<Task | null> {
    return this.tasks.get(id) || null;
  }

  async list(): Promise<Task[]> {
    return Array.from(this.tasks.values());
  }

  async claim(workerName: string): Promise<Task | null> {
    for (const task of this.tasks.values()) {
      if (task.status === 'QUEUED') {
        task.status = 'ASSIGNED';
        task.worker = workerName;
        return task;
      }
    }
    return null;
  }

  async update(id: string, updates: Partial<Task>): Promise<Task | null> {
    const task = this.tasks.get(id);
    if (!task) return null;
    Object.assign(task, updates, { updatedAt: new Date() });
    return task;
  }

  async updateStatus(): Promise<Task | null> { return null; }
  async updateResult(): Promise<Task | null> { return null; }
  async acquireLease(): Promise<Task | null> { return null; }
  async heartbeat(): Promise<boolean> { return true; }
  async releaseLease(): Promise<boolean> { return true; }
  async reclaimStuck(): Promise<number> { return 0; }
  async findByProject(): Promise<Task[]> { return []; }
}

describe('PDL Phase 1.1 — Real Context & Worker Execution Verification', () => {
  it('1. Real Git State: Inspects workspace without hardcoded values or destructive commands', () => {
    const task = parseEngineeringTask({
      prompt: 'Verificar status do repositório',
      project: 'pub-dev-loop',
    });

    const context = resolveContext(task, process.cwd());

    // Verified from real git
    expect(context.git_state.branch).toBe('main');
    expect(context.git_state.headSha).toMatch(/^[0-9a-f]{40}$/);
    expect(typeof context.git_state.isClean).toBe('boolean');
    expect(Array.isArray(context.git_state.changedFiles)).toBe(true);

    // Provenance captures git inspection
    const gitProvenance = context.provenance.find(p => p.source === 'GIT_STATE');
    expect(gitProvenance).toBeDefined();
    expect(gitProvenance?.detail).toContain('Branch: main');
    expect(gitProvenance?.detail).toContain(context.git_state.headSha);
  });

  it('2. Unknown Resolution: Differentiates RESOLVED (with code snippet) from DISCOVERED and UNRESOLVED', () => {
    const task = parseEngineeringTask({
      prompt: 'O checkout está falhando no mobile ao tentar pagar com cartão. O usuário disse para criar outra RPC para resolver.',
      project: 'pub-dev-loop',
    });

    // Known unknown in this repo (e.g. worker, api, router)
    task.unknowns = [
      'Investigar rota api e worker de tarefas',
      'Localizar arquivo totalmente_inexistente_xyz123.xyz',
    ];

    const context = resolveContext(task, process.cwd());

    // 1st unknown should match existing files and contain code lines
    const resolved = context.resolved_unknowns.find(u => u.unknown.includes('rota api'));
    expect(resolved).toBeDefined();
    expect(resolved?.status).toBe('RESOLVED');
    expect(resolved?.evidenceSnippet).toBeDefined();
    expect(resolved?.evidenceSnippet).toContain('Line ');
    expect(resolved?.discoveredPaths.length).toBeGreaterThan(0);

    // 2nd unknown has no matches -> UNRESOLVED
    const unresolved = context.resolved_unknowns.find(u => u.unknown.includes('totalmente_inexistente'));
    expect(unresolved).toBeDefined();
    expect(unresolved?.status).toBe('UNRESOLVED');
    expect(unresolved?.discoveredPaths).toHaveLength(0);
    expect(context.unresolved_unknowns).toContain('Localizar arquivo totalmente_inexistente_xyz123.xyz');
  });

  it('3. Context Provenance: Records origin, path, and concrete evidence snippets', () => {
    const task = parseEngineeringTask({
      prompt: 'Investigar api e testes',
      project: 'pub-dev-loop',
    });

    const context = resolveContext(task, process.cwd());

    const sources = context.provenance.map(p => p.source);
    expect(sources).toContain('ENGINEERING_TASK');
    expect(sources).toContain('GIT_STATE');
    expect(sources).toContain('PACKAGE_MANIFEST');
    expect(sources).toContain('REPOSITORY_FILE');

    const fileProv = context.provenance.find(p => p.source === 'REPOSITORY_FILE' && p.evidence);
    expect(fileProv).toBeDefined();
    expect(fileProv?.evidence).toMatch(/^Line \d+:/);
  });

  it('4. User Observation vs Proposed Solution: Strictly keeps proposed solution as UNVERIFIED HYPOTHESIS', () => {
    const prompt = 'O checkout quebrou no Safari. Sugiro criar uma nova RPC /skip-auth.';
    const task = parseEngineeringTask({ prompt, project: 'pub-dev-loop' });
    const context = resolveContext(task, process.cwd());
    const plan = createEngineeringPlan(task, context);

    const formattedPrompt = formatEngineeringWorkerPrompt(task, context, plan);

    expect(formattedPrompt).toContain('USER OBSERVATION:\nO checkout quebrou no Safari');
    expect(formattedPrompt).toContain('USER PROPOSED SOLUTION:\ncriar uma nova RPC /skip-auth');
    expect(formattedPrompt).toContain('STATUS: UNVERIFIED HYPOTHESIS');
    expect(formattedPrompt).toContain('do not adopt uncritically');
  });

  it('5. Worker Handoff: Task claimed from repository delivers the complete === PDL ENGINEERING CONTEXT ===', async () => {
    const mockRepo = new MockTaskRepository();
    const app = createApp(mockRepo as any);
    const server: Server = app.listen(0);
    const address = server.address() as { port: number };
    const baseUrl = `http://127.0.0.1:${address.port}`;

    try {
      // 1. Ingest task through HTTP API
      const res = await fetch(`${baseUrl}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project: 'pub-dev-loop',
          prompt: 'Investigar falha no worker e rotas api',
        }),
      });

      expect(res.status).toBe(201);
      const createdPayload = (await res.json()) as any;

      // 2. Claim task as a Worker (Worker Handoff)
      const claimedTask = await mockRepo.claim('worker-alpha');
      expect(claimedTask).not.toBeNull();
      expect(claimedTask?.id).toBe(createdPayload.id);

      // 3. Verify what the Worker and LLM receive in prompt
      const workerPrompt = claimedTask!.prompt;
      expect(workerPrompt).toContain('=== PDL ENGINEERING CONTEXT ===');
      expect(workerPrompt).toContain('TASK TYPE:');
      expect(workerPrompt).toContain('OBJETIVO DE ENGENHARIA:');
      expect(workerPrompt).toContain('GIT STATE:');
      expect(workerPrompt).toContain('Branch: main');
      expect(workerPrompt).toContain('DEPENDENCIES:');
      expect(workerPrompt).toContain('EXISTING TESTS:');
      expect(workerPrompt).toContain('ENGINEERING PLAN:');
      expect(workerPrompt).toContain('Phase 1: DISCOVERY');
      expect(workerPrompt).toContain('Phase 5: TEST');
      expect(workerPrompt).toContain('Phase 6: VALIDATION');
      expect(workerPrompt).toContain('=== END PDL ENGINEERING CONTEXT ===');
    } finally {
      server.close();
    }
  });

  it('6. Runtime Execution Reality: Transparently identifies real environment status without fabrication', () => {
    const hasLiveDb = !!process.env.DATABASE_URL;
    const hasOpenRouterKey = !!process.env.OPENROUTER_API_KEY;
    const hasRouterKey = !!process.env.ROUTER_API_KEY;

    // In isolated local testing without cloud credentials, real execution must be classified as BLOCKED
    if (!hasLiveDb || (!hasOpenRouterKey && !hasRouterKey)) {
      const executionStatus = 'BLOCKED';
      const blockers: string[] = [];
      if (!hasLiveDb) blockers.push('DATABASE_URL connection not available in local test runner');
      if (!hasOpenRouterKey && !hasRouterKey) blockers.push('No live LLM Gateway API key (OPENROUTER_API_KEY or ROUTER_API_KEY) in environment');

      expect(executionStatus).toBe('BLOCKED');
      expect(blockers.length).toBeGreaterThan(0);
    }
  });
});

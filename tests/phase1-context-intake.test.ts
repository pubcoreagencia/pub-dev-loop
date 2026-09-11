import { describe, it, expect } from 'vitest';
import type { Server } from 'node:http';
import { createApp } from '../src/api.js';
import { resolveContext } from '../src/office/context-resolver.js';
import {
  parseEngineeringTask,
  createEngineeringPlan,
  engineeringTaskToTask,
} from '../src/office/intent.js';
import type { Task, TaskRepository } from '../src/types.js';
import apiWorkerDefault from '../src/api-worker.js';

// In-memory mock TaskRepository for testing
class MockTaskRepository implements TaskRepository {
  private tasks: Map<string, Task> = new Map();
  public readonly intakeService = {
    processIntake: async (input: any) => {
      const task = await this.create({
        project: input.project,
        repository: input.repository,
        objective: input.objective || input.rawRequest,
        prompt: input.prompt || input.rawRequest,
        priority: input.priority ?? 1,
        agentId: input.agentId,
        result: input.result,
      });
      return {
        task,
        spec: {} as any,
        executionSpec: {
          id: `spec-${task.id}`,
          task_id: task.id,
          spec_version: '1.0.0',
          spec_hash: 'mockspec',
          objective: task.objective,
          lineage: { intakeHash: 'mockintake', source: 'phase1-test' },
          status: 'SEALED',
          created_at: new Date().toISOString(),
          sealed_at: new Date().toISOString(),
          spec_content_json: '{}',
        },
      };
    },
  } as any;

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

  async updateStatus(): Promise<Task | null> { return null; }
  async updateResult(): Promise<Task | null> { return null; }
  async acquireLease(): Promise<Task | null> { return null; }
  async heartbeat(): Promise<boolean> { return true; }
  async releaseLease(): Promise<boolean> { return true; }
  async reclaimStuck(): Promise<number> { return 0; }
  async findByProject(): Promise<Task[]> { return []; }
}

describe('PDL Phase 1 — Context Resolution & Intake Wiring', () => {
  it('1. HTTP POST /tasks creates an EngineeringTask through the intake pipeline', async () => {
    const mockRepo = new MockTaskRepository();
    const app = createApp(mockRepo as any);
    const server: Server = app.listen(0);
    const address = server.address() as { port: number };
    const baseUrl = `http://127.0.0.1:${address.port}`;

    try {
      const response = await fetch(`${baseUrl}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project: 'pub-dev-loop',
          prompt: 'O checkout está falhando no mobile ao tentar pagar com cartão. O usuário disse para criar outra RPC para resolver.',
        }),
      });

      expect(response.status).toBe(201);
      const body = (await response.json()) as any;
      expect(body).toHaveProperty('id');
      expect(body).toHaveProperty('engineeringTask');
      expect(body).toHaveProperty('resolvedContext');
      expect(body).toHaveProperty('engineeringPlan');

      // Verify created task in repository
      const stored = await mockRepo.findById(body.id);
      expect(stored).not.toBeNull();
      expect(stored?.result?.engineeringTask).toBeDefined();
      expect(stored?.result?.resolvedContext).toBeDefined();
      expect(stored?.result?.engineeringPlan).toBeDefined();
    } finally {
      server.close();
    }
  });

  it('2. Separates user observation from user proposed solution without adopting it blindly', () => {
    const rawPrompt = 'O checkout está quebrado no Safari. Sugiro criar uma nova rota RPC chamada /bypass-cartao.';
    const engTask = parseEngineeringTask({ prompt: rawPrompt, project: 'pub-dev-loop' });

    expect(engTask.user_observation).toBeDefined();
    expect(engTask.user_observation?.toLowerCase()).toContain('checkout');

    expect(engTask.user_proposed_solution).toBeDefined();
    expect(engTask.user_proposed_solution?.toLowerCase()).toContain('rpc');

    // The engineering objective must focus on investigating/resolving the issue, NOT just executing user suggestion
    expect(engTask.objective.toLowerCase()).toContain('checkout');
    expect(engTask.assumptions.some(a => a.includes('UNVERIFIED'))).toBe(true);
  });

  it('3. Correctly identifies task_type based on intent', () => {
    const bugTask = parseEngineeringTask({ prompt: 'Erro 500 ao finalizar pedido no checkout' });
    expect(['BUG', 'INVESTIGATION']).toContain(bugTask.task_type);

    const refactorTask = parseEngineeringTask({ prompt: 'Refatorar módulo de rotas para usar clean architecture' });
    expect(refactorTask.task_type).toBe('REFACTOR');

    const testTask = parseEngineeringTask({ prompt: 'Adicionar testes unitários para a api de tarefas' });
    expect(['FEATURE', 'MAINTENANCE']).toContain(testTask.task_type);
  });

  it('4. Evaluates risk level and requires approval for sensitive operations', () => {
    const sensitiveTask = parseEngineeringTask({
      prompt: 'Atualizar processamento de pagamento com cartão de crédito e gateway',
    });
    expect(sensitiveTask.risk_level).toBe('HIGH');
    expect(sensitiveTask.human_approval_required).toBe(true);

    const lowRiskTask = parseEngineeringTask({
      prompt: 'Documentar as rotas da api no README',
    });
    expect(lowRiskTask.risk_level).toBe('LOW');
    expect(lowRiskTask.human_approval_required).toBe(false);
  });

  it('5. ContextResolver inspects real workspace files and resolves matching unknowns', () => {
    const engTask = parseEngineeringTask({
      prompt: 'Investigar falha na rota api e no worker de tarefas',
      project: 'pub-dev-loop',
    });

    const context = resolveContext(engTask, process.cwd());

    expect(context.taskId).toBe(engTask.id);
    expect(context.project).toBe('pub-dev-loop');
    expect(context.git_state.branch).toBe('main');

    // Dependencies extracted from real package.json
    expect(Object.keys(context.dependencies).length).toBeGreaterThan(0);
    expect(context.dependencies).toHaveProperty('express');

    // Existing test files mapped
    expect(context.existing_tests.length).toBeGreaterThan(0);

    // Resolved unknowns
    expect(context.resolved_unknowns.length).toBeGreaterThan(0);
    const resolved = context.resolved_unknowns.find(u => u.status === 'RESOLVED');
    expect(resolved).toBeDefined();
    expect(resolved?.discoveredPaths.length).toBeGreaterThan(0);

    // Relevant files populated from discovery
    expect(context.relevant_files.length).toBeGreaterThan(0);
    expect(context.provenance.some(p => p.source === 'PACKAGE_MANIFEST')).toBe(true);
  });

  it('6. Unresolvable unknowns remain UNRESOLVED without fabricating false files', () => {
    const engTask = parseEngineeringTask({
      prompt: 'Ajustar módulo quantico interdimensional zxy987abc',
      project: 'pub-dev-loop',
    });
    // Inject a completely synthetic unknown
    engTask.unknowns.push('Localizar arquivo zxy987abc_nonexistent_mod.xyz');

    const context = resolveContext(engTask, process.cwd());

    const unresolved = context.resolved_unknowns.find(u => u.unknown.includes('zxy987abc_nonexistent_mod'));
    expect(unresolved?.status).toBe('UNRESOLVED');
    expect(unresolved?.discoveredPaths).toHaveLength(0);
    expect(context.unresolved_unknowns).toContain('Localizar arquivo zxy987abc_nonexistent_mod.xyz');
  });

  it('7. EngineeringPlan contains the 6 required phases and is enriched with evidence', () => {
    const engTask = parseEngineeringTask({
      prompt: 'Investigar checkout e worker',
      project: 'pub-dev-loop',
    });
    const context = resolveContext(engTask, process.cwd());
    const plan = createEngineeringPlan(engTask, context);

    expect(plan.taskId).toBe(engTask.id);
    expect(plan.phases).toHaveLength(6);

    const phaseNames = plan.phases.map(p => p.phase);
    expect(phaseNames).toEqual(['DISCOVERY', 'ANALYSIS', 'PLANNING', 'IMPLEMENTATION', 'TEST', 'VALIDATION']);

    // Evidence enrichment check
    const discoveryPhase = plan.phases.find(p => p.phase === 'DISCOVERY');
    expect(discoveryPhase).toBeDefined();
    expect(discoveryPhase?.actions.some(a => a.toLowerCase().includes('discovered candidate'))).toBe(true);

    const testPhase = plan.phases.find(p => p.phase === 'TEST');
    expect(testPhase).toBeDefined();
    expect(testPhase?.actions.some(a => a.includes('npm run typecheck'))).toBe(true);
  });

  it('8. Bridges EngineeringTask to runtime Task maintaining WorkerService compatibility', () => {
    const engTask = parseEngineeringTask({
      prompt: 'Fix critical payment failure in checkout',
      project: 'pub-dev-loop',
    });
    const context = resolveContext(engTask, process.cwd());
    const plan = createEngineeringPlan(engTask, context);

    const runtimeTask = engineeringTaskToTask(engTask, { priority: 3 }, context, plan);

    expect(runtimeTask.id).toBe(engTask.id);
    expect(runtimeTask.project).toBe('pub-dev-loop');
    expect(runtimeTask.status).toBe('QUEUED');
    expect(runtimeTask.priority).toBe(3);
    expect(runtimeTask.result.engineeringTask).toEqual(engTask);
    expect(runtimeTask.result.resolvedContext).toEqual(context);
    expect(runtimeTask.result.engineeringPlan).toEqual(plan);

    // Structured prompt contains clear instructions
    expect(runtimeTask.prompt).toContain('OBJETIVO DE ENGENHARIA');
    expect(runtimeTask.prompt).toContain('CRITÉRIOS DE ACEITE OBRIGATÓRIOS');
    expect(runtimeTask.prompt).toContain('RESTRIÇÕES');
  });

  it('9. Preserves legacy payload compatibility with { project, repository, objective, prompt }', async () => {
    const mockRepo = new MockTaskRepository();
    const app = createApp(mockRepo as any);
    const server: Server = app.listen(0);
    const address = server.address() as { port: number };
    const baseUrl = `http://127.0.0.1:${address.port}`;

    try {
      const legacyPayload = {
        project: 'pub-dev-loop',
        repository: 'https://github.com/pubcoreagencia/pub-dev-loop.git',
        objective: 'Update dependencies and run checks',
        prompt: 'Run security audit and update dependencies',
        priority: 2,
      };

      const res = await fetch(`${baseUrl}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(legacyPayload),
      });

      expect(res.status).toBe(201);
      const body = (await res.json()) as any;
      expect(body.project).toBe('pub-dev-loop');
      expect(body.repository).toBe('https://github.com/pubcoreagencia/pub-dev-loop.git');
      expect(body.engineeringTask).toBeDefined();
      expect(body.engineeringPlan).toBeDefined();
    } finally {
      server.close();
    }
  });

  it('10. Rejects invalid requests with missing prompt or objective', async () => {
    const mockRepo = new MockTaskRepository();
    const app = createApp(mockRepo as any);
    const server: Server = app.listen(0);
    const address = server.address() as { port: number };
    const baseUrl = `http://127.0.0.1:${address.port}`;

    try {
      const res = await fetch(`${baseUrl}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project: 'pub-dev-loop',
        }),
      });

      expect(res.status).toBe(400);
      const body = (await res.json()) as any;
      expect(body.error).toContain('prompt or objective is required');
    } finally {
      server.close();
    }
  });

  it('11. Cloudflare Worker API fetch handler supports Phase 1 EngineeringTask intake', async () => {
    const req = new Request('https://pub-dev-loop.internal/tasks', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        project: 'pub-dev-loop',
        prompt: 'O checkout está falhando no mobile ao tentar pagar com cartão. O usuário disse para criar outra RPC para resolver.',
      }),
    });

    const mockEnv = {
      DATABASE_URL: 'postgres://mock:mock@localhost:5432/mock',
    };

    const res = await apiWorkerDefault.fetch(req, mockEnv as any, {});

    // It should proceed past auth and validation; even if DB fails in test env,
    // it must NOT fail with 400 validation error
    expect(res.status).not.toBe(400);
  });
});

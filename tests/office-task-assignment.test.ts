import { describe, it, expect } from 'vitest';
import apiWorker, { type Env } from '../src/api-worker.js';
import { defaultAgentRegistry, isValidAgentId, AgentRegistry } from '../src/office/registry.js';
import type { Task, CreateTask } from '../src/domain.js';

const mockEnv: Env = {
  PRIMARY_GATEWAY: 'openrouter',
  FALLBACK_GATEWAY: '9router',
};

describe('P5.7.4 — The Office: Agent Runtime Identity & Task Assignment', () => {
  describe('Domain & Validator Logic (isValidAgentId)', () => {
    it('1. Task without agentId is valid and agentId is optional/null/undefined', () => {
      const taskInput: CreateTask = {
        project: 'test-project',
        repository: 'https://github.com/example/repo.git',
        objective: 'Test objective',
        prompt: 'Test prompt',
      };
      expect(taskInput.agentId).toBeUndefined();
    });

    it('2. Task with agentId: developer is accepted by validator', () => {
      expect(isValidAgentId('developer')).toBe(true);
    });

    it('3. Task with agentId: architect is accepted by validator', () => {
      expect(isValidAgentId('architect')).toBe(true);
    });

    it('4. Task with agentId: chief-of-staff is accepted by validator', () => {
      expect(isValidAgentId('chief-of-staff')).toBe(true);
      expect(isValidAgentId('reviewer')).toBe(true);
      expect(isValidAgentId('qa-engineer')).toBe(true);
    });

    it('5. agentId: ceo is strictly rejected', () => {
      expect(isValidAgentId('ceo')).toBe(false);
      expect(isValidAgentId('CEO')).toBe(false);
      expect(isValidAgentId(' ceo ')).toBe(false);
    });

    it('6. Non-existent agentId is rejected', () => {
      expect(isValidAgentId('unknown-agent')).toBe(false);
      expect(isValidAgentId('')).toBe(false);
      expect(isValidAgentId(null)).toBe(false);
      expect(isValidAgentId(undefined)).toBe(false);
      expect(isValidAgentId(123 as any)).toBe(false);
    });

    it('7. Validation uses the canonical Agent Registry as single source of truth', () => {
      const registered = defaultAgentRegistry.listAgents().map(a => a.id);
      for (const id of registered) {
        expect(isValidAgentId(id)).toBe(true);
      }
    });

    it('8. Custom registry injection in isValidAgentId works in isolation', () => {
      const customRegistry = new AgentRegistry([
        {
          id: 'custom-dev',
          name: 'Custom Dev',
          title: 'Custom Specialist',
          department: 'ENGINEERING',
          role: 'DEVELOPER',
          specialty: 'Domain logic',
          personalitySummary: 'Focused',
          responsibilities: ['Domain implementation'],
          capabilities: ['domain_code'],
          routingProfile: 'coding',
          status: 'ACTIVE',
        },
      ]);

      expect(isValidAgentId('custom-dev', customRegistry)).toBe(true);
      expect(isValidAgentId('developer', customRegistry)).toBe(false);
    });

    it('9. Task object preserves agentId property independently from other fields', () => {
      const task: Task = {
        id: 'task-101',
        project: 'test-project',
        repository: 'https://github.com/example/repo.git',
        objective: 'Feature development',
        prompt: 'Write new endpoint',
        status: 'QUEUED',
        priority: 1,
        worker: 'router',
        result: null,
        error: null,
        branch: 'feat/new-endpoint',
        commitSha: null,
        gitStatus: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        leaseOwner: null,
        leaseDeadline: null,
        heartbeatAt: null,
        workspacePath: '/tmp/workspace',
        prototypeSessionId: null,
        agentId: 'developer',
      };

      expect(task.agentId).toBe('developer');
      expect(task.worker).toBe('router');
    });

    it('10. Task.worker continues to be semantic runtime worker/daemon, independent of agentId', () => {
      const taskWithAgent: Task = {
        id: 'task-102',
        project: 'test-project',
        repository: 'https://github.com/example/repo.git',
        objective: 'Architectural review',
        prompt: 'Review API boundaries',
        status: 'ASSIGNED',
        priority: 2,
        worker: 'worker-alarm-daemon-01',
        result: null,
        error: null,
        branch: null,
        commitSha: null,
        gitStatus: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        leaseOwner: 'worker-alarm-daemon-01',
        leaseDeadline: new Date(Date.now() + 30000),
        heartbeatAt: new Date(),
        workspacePath: null,
        prototypeSessionId: null,
        agentId: 'architect',
      };

      expect(taskWithAgent.worker).toBe('worker-alarm-daemon-01');
      expect(taskWithAgent.agentId).toBe('architect');
      expect(taskWithAgent.worker).not.toBe(taskWithAgent.agentId);
    });

    it('11. Legacy task without agentId continues to be fully valid and processable', () => {
      const legacyTask: Task = {
        id: 'legacy-task-001',
        project: 'legacy-project',
        repository: 'https://github.com/example/repo.git',
        objective: 'Legacy task execution',
        prompt: 'Do something',
        status: 'QUEUED',
        priority: 0,
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

      expect(legacyTask.agentId).toBeUndefined();
    });
  });

  describe('HTTP API Task Creation Validation (POST /tasks)', () => {
    it('12. POST /tasks rejects invalid agentId with 400 Bad Request', async () => {
      const request = new Request('http://localhost/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project: 'test-proj',
          repository: 'https://github.com/example/repo.git',
          objective: 'Test objective',
          prompt: 'Test prompt',
          agentId: 'invalid-non-existent-agent',
        }),
      });

      const response = await apiWorker.fetch(request, mockEnv, {});
      expect(response.status).toBe(400);

      const body = (await response.json()) as { error: string };
      expect(body.error).toContain('Invalid agentId');
    });

    it('13. POST /tasks rejects agentId: ceo with 400 Bad Request', async () => {
      const request = new Request('http://localhost/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project: 'test-proj',
          repository: 'https://github.com/example/repo.git',
          objective: 'Test objective',
          prompt: 'Test prompt',
          agentId: 'ceo',
        }),
      });

      const response = await apiWorker.fetch(request, mockEnv, {});
      expect(response.status).toBe(400);

      const body = (await response.json()) as { error: string };
      expect(body.error).toContain('Invalid agentId');
    });
  });
});

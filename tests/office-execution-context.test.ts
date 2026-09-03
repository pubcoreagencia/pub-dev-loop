import { describe, it, expect } from 'vitest';
import {
  createAgentExecutionContext,
  type AgentExecutionContext,
} from '../src/office/execution-context.js';
import { defaultAgentRegistry, AgentRegistry } from '../src/office/registry.js';
import type { Task } from '../src/domain.js';

describe('P5.7.6 — The Office: Agent Execution Context', () => {
  it('1. Valid agentId produces an AgentExecutionContext', () => {
    const ctx = createAgentExecutionContext('developer');
    expect(ctx).not.toBeNull();
    expect(ctx?.agentId).toBe('developer');
    expect(ctx?.resolvedAt).toBeInstanceOf(Date);
  });

  it('2. Context contains the correct AgentDefinition object', () => {
    const ctx = createAgentExecutionContext('developer');
    expect(ctx?.agent).toEqual(defaultAgentRegistry.getAgent('developer'));
    expect(ctx?.agent.title).toBe('Senior Full-Stack Developer');
  });

  it('3. Invalid agentId returns null in non-strict mode and throws in strict mode', () => {
    const ctx = createAgentExecutionContext('invalid-non-existent-agent');
    expect(ctx).toBeNull();

    expect(() => {
      createAgentExecutionContext('invalid-non-existent-agent', defaultAgentRegistry, { strict: true });
    }).toThrow(/Unknown agentId/);
  });

  it('4. null returns null', () => {
    const ctx = createAgentExecutionContext(null);
    expect(ctx).toBeNull();
  });

  it('5. undefined returns null', () => {
    const ctx = createAgentExecutionContext(undefined);
    expect(ctx).toBeNull();
  });

  it('6. Empty string or whitespace returns null', () => {
    expect(createAgentExecutionContext('')).toBeNull();
    expect(createAgentExecutionContext('   ')).toBeNull();
  });

  it('7. Developer resolves to correct identity, role, and department', () => {
    const ctx = createAgentExecutionContext('developer');
    expect(ctx).not.toBeNull();
    expect(ctx?.agentId).toBe('developer');
    expect(ctx?.agent.role).toBe('DEVELOPER');
    expect(ctx?.agent.department).toBe('ENGINEERING');
    expect(ctx?.agent.routingProfile).toBe('coding');
  });

  it('8. Architect resolves to correct identity, role, and department', () => {
    const ctx = createAgentExecutionContext('architect');
    expect(ctx).not.toBeNull();
    expect(ctx?.agentId).toBe('architect');
    expect(ctx?.agent.role).toBe('ARCHITECT');
    expect(ctx?.agent.department).toBe('ENGINEERING');
    expect(ctx?.agent.routingProfile).toBe('reasoning');
  });

  it('9. Chief of Staff resolves to correct identity, role, and department', () => {
    const ctx = createAgentExecutionContext('chief-of-staff');
    expect(ctx).not.toBeNull();
    expect(ctx?.agentId).toBe('chief-of-staff');
    expect(ctx?.agent.role).toBe('CHIEF_OF_STAFF');
    expect(ctx?.agent.department).toBe('EXECUTIVE');
    expect(ctx?.agent.isManager).toBe(true);
  });

  it('10. ceo returns null (human operator is not an executable agent) and throws in strict mode', () => {
    const ctx = createAgentExecutionContext('ceo');
    expect(ctx).toBeNull();

    expect(() => {
      createAgentExecutionContext('ceo', defaultAgentRegistry, { strict: true });
    }).toThrow(/human operator/);
  });

  it('11. Context keeps agentId and worker strictly distinct', () => {
    const task: Task = {
      id: 'task-test-ctx',
      project: 'test-project',
      repository: 'https://example.com/repo.git',
      objective: 'Build service',
      prompt: 'Build service prompt',
      status: 'QUEUED',
      priority: 1,
      worker: 'router-worker-daemon-01',
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
      agentId: 'architect',
    };

    const ctx = createAgentExecutionContext(task.agentId);
    expect(ctx?.agentId).toBe('architect');
    expect(task.worker).toBe('router-worker-daemon-01');
    expect(ctx?.agentId).not.toBe(task.worker);
  });

  it('12. AgentRegistry remains single source of truth for AgentDefinition in context', () => {
    const ctx = createAgentExecutionContext('qa-engineer');
    const directFromRegistry = defaultAgentRegistry.getAgent('qa-engineer');
    expect(ctx?.agent).toBe(directFromRegistry);
  });

  it('13. Legacy task with null/undefined agentId does not fail when creating context', () => {
    const legacyTask: Task = {
      id: 'legacy-1',
      project: 'proj',
      repository: 'repo',
      objective: 'obj',
      prompt: 'p',
      status: 'QUEUED',
      priority: 0,
      worker: 'router',
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

    const ctx = createAgentExecutionContext(legacyTask.agentId);
    expect(ctx).toBeNull();
  });

  it('14. Custom registry injection works in isolation', () => {
    const custom = new AgentRegistry([
      {
        id: 'special-agent',
        name: 'Special Agent',
        title: 'Special Agent Title',
        department: 'ENGINEERING',
        role: 'DEVELOPER',
        specialty: 'Special domain',
        personalitySummary: 'Sharp',
        responsibilities: ['Special work'],
        capabilities: ['special'],
        routingProfile: 'coding',
        status: 'ACTIVE',
      },
    ]);

    const ctxCustom = createAgentExecutionContext('special-agent', custom);
    expect(ctxCustom).not.toBeNull();
    expect(ctxCustom?.agentId).toBe('special-agent');

    const ctxDefault = createAgentExecutionContext('special-agent', defaultAgentRegistry);
    expect(ctxDefault).toBeNull();
  });
});

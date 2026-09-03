import { describe, it, expect } from 'vitest';
import { resolveAgentAssignment, type AgentAssignmentDecision } from '../src/office/assignment.js';
import { defaultAgentRegistry, AgentRegistry } from '../src/office/registry.js';
import type { Task } from '../src/domain.js';

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-test-p5710',
    project: 'pub-dev-loop',
    repository: 'https://github.com/pubcoreagencia/pub-dev-loop.git',
    objective: 'Implement new database migration and CRUD controllers',
    prompt: 'Write TypeScript backend code to build REST controller',
    status: 'QUEUED',
    priority: 1,
    worker: 'router-worker-process-daemon-01',
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
    ...overrides,
  };
}

describe('P5.7.10 — The Office: Organizational Assignment Execution', () => {
  it('1. Explicit agent assignment respects task.agentId and returns source = EXPLICIT', () => {
    const task = makeTask({ agentId: 'developer' });
    const decision = resolveAgentAssignment(task);

    expect(decision.taskId).toBe(task.id);
    expect(decision.agentId).toBe('developer');
    expect(decision.source).toBe('EXPLICIT');
    expect(decision.compatible).toBe(true);
    expect(decision.context).toBeDefined();
  });

  it('2. Explicit compatible agent yields high compatibility score', () => {
    const task = makeTask({
      agentId: 'architect',
      objective: 'Design modular microservice architecture and schema boundaries',
      prompt: 'Technical design contract specification',
    });

    const decision = resolveAgentAssignment(task);
    expect(decision.agentId).toBe('architect');
    expect(decision.source).toBe('EXPLICIT');
    expect(decision.compatible).toBe(true);
    expect(decision.score).toBeGreaterThanOrEqual(0.5);
  });

  it('3. Explicit mismatch agent preserves explicit identity and does NOT silently swap', () => {
    const task = makeTask({
      agentId: 'reviewer',
      objective: 'Design scalable microservice architecture and schema boundaries',
      prompt: 'Define technical design contracts',
    });

    const decision = resolveAgentAssignment(task);
    expect(decision.agentId).toBe('reviewer'); // must NOT be changed to architect
    expect(decision.source).toBe('EXPLICIT');
    expect(decision.compatible).toBe(false);
  });

  it('4. Invalid / unregistered agentId returns source = UNRESOLVED and agentId = null', () => {
    const task = makeTask({ agentId: 'fake-unknown-agent' });
    const decision = resolveAgentAssignment(task);

    expect(decision.agentId).toBeNull();
    expect(decision.compatible).toBe(false);
    expect(decision.source).toBe('UNRESOLVED');
  });

  it('5. CEO is rejected and produces source = UNRESOLVED', () => {
    const task = makeTask({ agentId: 'ceo' });
    const decision = resolveAgentAssignment(task);

    expect(decision.agentId).toBeNull();
    expect(decision.compatible).toBe(false);
    expect(decision.source).toBe('UNRESOLVED');
    expect(decision.reasons[0]).toContain('human operator');
  });

  it('6. Unassigned task with clear QA signals deterministically suggests qa-engineer', () => {
    const task = makeTask({
      agentId: null,
      objective: 'Write automated unit and integration tests with vitest',
      prompt: 'Create test suite for validation and regression tests',
    });

    const decision = resolveAgentAssignment(task);
    expect(decision.agentId).toBe('qa-engineer');
    expect(decision.source).toBe('ORGANIZATIONAL_SUGGESTION');
    expect(decision.compatible).toBe(true);
  });

  it('7. Unassigned task with clear architecture signals deterministically suggests architect', () => {
    const task = makeTask({
      agentId: null,
      objective: 'Design modular system architecture and technical boundary contract',
      prompt: 'Architect the domain model structure',
    });

    const decision = resolveAgentAssignment(task);
    expect(decision.agentId).toBe('architect');
    expect(decision.source).toBe('ORGANIZATIONAL_SUGGESTION');
    expect(decision.compatible).toBe(true);
  });

  it('8. Ambiguous unassigned task returns source = UNRESOLVED without guessing', () => {
    const task = makeTask({
      agentId: null,
      objective: '',
      prompt: '',
    });

    const decision = resolveAgentAssignment(task);
    expect(decision.agentId).toBeNull();
    expect(decision.source).toBe('UNRESOLVED');
  });

  it('9. task.worker (runtime daemon) and decision.agentId (organizational identity) are strictly independent', () => {
    const task = makeTask({
      worker: 'worker-daemon-pid-777',
      agentId: 'architect',
    });

    const decision = resolveAgentAssignment(task);
    expect(decision.agentId).toBe('architect');
    expect(task.worker).toBe('worker-daemon-pid-777');
    expect(decision.agentId).not.toBe(task.worker);
  });

  it('10. Decision context is cleanly derived from AgentRegistry', () => {
    const task = makeTask({ agentId: 'developer' });
    const decision = resolveAgentAssignment(task);

    expect(decision.context?.roleContext.role).toBe('DEVELOPER');
    expect(decision.context?.roleContext.department).toBe('ENGINEERING');
  });

  it('11. Custom registry can be used for resolution', () => {
    const customRegistry = new AgentRegistry([
      {
        id: 'specialist-ops',
        name: 'Ops Specialist',
        title: 'Site Reliability Specialist',
        department: 'ENGINEERING',
        role: 'DEVELOPER',
        specialty: 'Infrastructure & deployment',
        personalitySummary: 'Methodical',
        responsibilities: ['Manage deployment'],
        capabilities: ['infra', 'deployment'],
        routingProfile: 'general',
        status: 'ACTIVE',
      },
    ]);

    const task = makeTask({ agentId: 'specialist-ops' });
    const decision = resolveAgentAssignment(task, customRegistry);

    expect(decision.agentId).toBe('specialist-ops');
    expect(decision.source).toBe('EXPLICIT');
  });

  it('12. Immutability: Task object remains completely unmutated', () => {
    const originalTask = makeTask({ agentId: 'architect' });
    const snapshot = JSON.stringify(originalTask);

    resolveAgentAssignment(originalTask);

    expect(JSON.stringify(originalTask)).toBe(snapshot);
  });

  it('13. Immutability: AgentRegistry remains completely unmutated', () => {
    const before = JSON.stringify(defaultAgentRegistry.getAgent('developer'));
    const task = makeTask({ agentId: 'developer' });

    resolveAgentAssignment(task);

    const after = JSON.stringify(defaultAgentRegistry.getAgent('developer'));
    expect(after).toBe(before);
  });

  it('14. Determinism: identical task + agent produce identical decision structure', () => {
    const task = makeTask({ agentId: 'developer' });

    const d1 = resolveAgentAssignment(task);
    const d2 = resolveAgentAssignment(task);

    expect(d1.agentId).toBe(d2.agentId);
    expect(d1.score).toBe(d2.score);
    expect(d1.source).toBe(d2.source);
    expect(d1.reasons).toEqual(d2.reasons);
  });
});

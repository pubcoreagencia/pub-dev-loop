import { describe, it, expect } from 'vitest';
import {
  createAgentAssignmentDecisionContext,
  type AgentAssignmentDecisionContext,
} from '../src/office/assignment-context.js';
import { defaultAgentRegistry, AgentRegistry } from '../src/office/registry.js';
import type { Task } from '../src/domain.js';

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-decision-123',
    project: 'pub-dev-loop',
    repository: 'https://example.com/repo.git',
    objective: 'Implement new user management REST API',
    prompt: 'Write TypeScript code to implement user routes and database queries',
    status: 'QUEUED',
    priority: 1,
    worker: 'router-worker-daemon-process-01',
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

describe('P5.7.9 — The Office: Agent Assignment Decision Context', () => {
  it('1. Developer + implementation task produces valid decision context with strong compatibility', () => {
    const task = makeTask({
      objective: 'Implement payment gateway integration endpoint',
      prompt: 'Write TypeScript backend code to build webhook controller',
    });

    const ctx = createAgentAssignmentDecisionContext(task, 'developer');
    expect(ctx).not.toBeNull();
    expect(ctx?.agentId).toBe('developer');
    expect(ctx?.roleContext.role).toBe('DEVELOPER');
    expect(ctx?.compatibility.compatible).toBe(true);
    expect(ctx?.compatibility.score).toBeGreaterThanOrEqual(0.5);
  });

  it('2. Architect + architecture task produces valid decision context', () => {
    const task = makeTask({
      objective: 'Design scalable microservice architecture and schema boundaries',
      prompt: 'Define technical design contract and domain boundaries',
    });

    const ctx = createAgentAssignmentDecisionContext(task, 'architect');
    expect(ctx).not.toBeNull();
    expect(ctx?.agentId).toBe('architect');
    expect(ctx?.roleContext.role).toBe('ARCHITECT');
    expect(ctx?.compatibility.compatible).toBe(true);
  });

  it('3. Reviewer + security review task produces valid decision context', () => {
    const task = makeTask({
      objective: 'Audit code for security vulnerabilities and compliance',
      prompt: 'Review pull request for potential CVE flaws and safety issues',
    });

    const ctx = createAgentAssignmentDecisionContext(task, 'reviewer');
    expect(ctx).not.toBeNull();
    expect(ctx?.agentId).toBe('reviewer');
    expect(ctx?.roleContext.role).toBe('REVIEWER');
    expect(ctx?.compatibility.compatible).toBe(true);
  });

  it('4. QA Engineer + test task produces valid decision context', () => {
    const task = makeTask({
      objective: 'Write automated unit and integration tests with full coverage',
      prompt: 'Design vitest test suite covering edge cases and regression scenarios',
    });

    const ctx = createAgentAssignmentDecisionContext(task, 'qa-engineer');
    expect(ctx).not.toBeNull();
    expect(ctx?.agentId).toBe('qa-engineer');
    expect(ctx?.roleContext.role).toBe('QA_ENGINEER');
    expect(ctx?.compatibility.compatible).toBe(true);
  });

  it('5. Chief of Staff + planning task produces valid decision context', () => {
    const task = makeTask({
      objective: 'Plan milestone roadmap and coordinate task decomposition across squads',
      prompt: 'Decompose CEO goals, plan milestones, and coordinate delegation',
    });

    const ctx = createAgentAssignmentDecisionContext(task, 'chief-of-staff');
    expect(ctx).not.toBeNull();
    expect(ctx?.agentId).toBe('chief-of-staff');
    expect(ctx?.roleContext.role).toBe('CHIEF_OF_STAFF');
    expect(ctx?.compatibility.compatible).toBe(true);
  });

  it('6-10. Context contains taskId, project, agentId, roleContext, and compatibility', () => {
    const task = makeTask({ id: 'task-xyz-999', project: 'custom-proj' });
    const ctx = createAgentAssignmentDecisionContext(task, 'developer');

    expect(ctx).not.toBeNull();
    expect(ctx?.taskId).toBe('task-xyz-999');
    expect(ctx?.project).toBe('custom-proj');
    expect(ctx?.agentId).toBe('developer');
    expect(ctx?.roleContext).toBeDefined();
    expect(ctx?.compatibility).toBeDefined();
  });

  it('11. compatibility.agentId matches context.agentId', () => {
    const task = makeTask();
    const ctx = createAgentAssignmentDecisionContext(task, 'architect');

    expect(ctx?.compatibility.agentId).toBe('architect');
    expect(ctx?.compatibility.agentId).toBe(ctx?.agentId);
  });

  it('12. Invalid agentId returns null in default mode and throws in strict mode', () => {
    const task = makeTask();
    const ctx = createAgentAssignmentDecisionContext(task, 'non-existent-agent');
    expect(ctx).toBeNull();

    expect(() => {
      createAgentAssignmentDecisionContext(task, 'non-existent-agent', defaultAgentRegistry, { strict: true });
    }).toThrow(/Unknown agentId/);
  });

  it('13. CEO returns null in default mode and throws in strict mode', () => {
    const task = makeTask();
    const ctx = createAgentAssignmentDecisionContext(task, 'ceo');
    expect(ctx).toBeNull();

    expect(() => {
      createAgentAssignmentDecisionContext(task, 'ceo', defaultAgentRegistry, { strict: true });
    }).toThrow(/human operator/);
  });

  it('14. Task without objective or prompt handles safely without error', () => {
    const task = makeTask({ objective: '', prompt: '' });
    const ctx = createAgentAssignmentDecisionContext(task, 'developer');

    expect(ctx).not.toBeNull();
    expect(ctx?.compatibility.score).toBe(0.0);
    expect(ctx?.compatibility.compatible).toBe(false);
  });

  it('15. task.worker and context.agentId remain completely separate', () => {
    const task = makeTask({
      worker: 'router-worker-process-node-01',
      agentId: 'developer',
    });

    const ctx = createAgentAssignmentDecisionContext(task, 'architect');
    expect(ctx?.agentId).toBe('architect');
    expect(task.worker).toBe('router-worker-process-node-01');
    expect(task.worker).not.toBe(ctx?.agentId);
  });

  it('16. Original Task object remains unmutated', () => {
    const originalTask = makeTask({
      agentId: 'developer',
      status: 'QUEUED',
    });
    const frozenSnapshot = JSON.stringify(originalTask);

    createAgentAssignmentDecisionContext(originalTask, 'architect');

    expect(JSON.stringify(originalTask)).toBe(frozenSnapshot);
    expect(originalTask.agentId).toBe('developer'); // unchanged
  });

  it('17. AgentRegistry remains unmutated', () => {
    const beforeDev = JSON.stringify(defaultAgentRegistry.getAgent('developer'));
    const task = makeTask();

    createAgentAssignmentDecisionContext(task, 'developer');

    const afterDev = JSON.stringify(defaultAgentRegistry.getAgent('developer'));
    expect(afterDev).toBe(beforeDev);
  });

  it('18. Determinism: Same task + same agent returns identical data structure', () => {
    const task = makeTask();

    const ctx1 = createAgentAssignmentDecisionContext(task, 'developer');
    const ctx2 = createAgentAssignmentDecisionContext(task, 'developer');

    expect(ctx1?.taskId).toBe(ctx2?.taskId);
    expect(ctx1?.agentId).toBe(ctx2?.agentId);
    expect(ctx1?.compatibility.score).toBe(ctx2?.compatibility.score);
    expect(ctx1?.compatibility.compatible).toBe(ctx2?.compatibility.compatible);
    expect(ctx1?.compatibility.reasons).toEqual(ctx2?.compatibility.reasons);
  });

  it('19. Score is strictly within range [0.0, 1.0]', () => {
    const task = makeTask();
    for (const id of ['developer', 'architect', 'reviewer', 'qa-engineer', 'chief-of-staff']) {
      const ctx = createAgentAssignmentDecisionContext(task, id);
      expect(ctx?.compatibility.score).toBeGreaterThanOrEqual(0.0);
      expect(ctx?.compatibility.score).toBeLessThanOrEqual(1.0);
    }
  });

  it('20. agentId with surrounding whitespace is properly trimmed and resolved', () => {
    const task = makeTask();
    const ctx = createAgentAssignmentDecisionContext(task, '   developer   ');

    expect(ctx).not.toBeNull();
    expect(ctx?.agentId).toBe('developer');
  });

  it('21. Custom registry can be injected for isolated evaluations', () => {
    const customRegistry = new AgentRegistry([
      {
        id: 'security-specialist',
        name: 'Security Specialist',
        title: 'Lead Security Auditor',
        department: 'QA',
        role: 'REVIEWER',
        specialty: 'Security & Penetration Testing',
        personalitySummary: 'Vigilant',
        responsibilities: ['Audit code'],
        capabilities: ['security_audit', 'compliance_check'],
        routingProfile: 'review',
        status: 'ACTIVE',
      },
    ]);

    const task = makeTask({ objective: 'Audit security vulnerabilities' });
    const ctx = createAgentAssignmentDecisionContext(task, 'security-specialist', customRegistry);

    expect(ctx).not.toBeNull();
    expect(ctx?.agentId).toBe('security-specialist');
    expect(ctx?.compatibility.compatible).toBe(true);
  });
});

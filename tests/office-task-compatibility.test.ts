import { describe, it, expect } from 'vitest';
import { evaluateAgentTaskCompatibility } from '../src/office/task-compatibility.js';
import { createAgentRoleContext } from '../src/office/role-context.js';
import type { Task } from '../src/domain.js';

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'test-task',
    project: 'pub-dev-loop',
    repository: 'https://example.com/repo.git',
    objective: 'Test objective',
    prompt: 'Test prompt',
    status: 'QUEUED',
    priority: 1,
    worker: 'router-worker-01',
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

describe('P5.7.8 — The Office: Agent/Task Role Compatibility', () => {
  it('1. Developer + implementation task yields high compatibility (score >= 0.5, compatible = true)', () => {
    const task = makeTask({
      objective: 'Implement user authentication endpoints and fix validation bug',
      prompt: 'Write TypeScript code to implement JWT auth endpoint and refactor login controller',
    });

    const result = evaluateAgentTaskCompatibility(task, 'developer');
    expect(result.agentId).toBe('developer');
    expect(result.compatible).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(0.5);
    expect(result.reasons.some(r => r.includes('implementation') || r.includes('code'))).toBe(true);
  });

  it('2. Architect + system architecture task yields high compatibility', () => {
    const task = makeTask({
      objective: 'Design modular microservice architecture and system contract boundaries',
      prompt: 'Create technical design specification and schema contract boundaries for data layer',
    });

    const result = evaluateAgentTaskCompatibility(task, 'architect');
    expect(result.agentId).toBe('architect');
    expect(result.compatible).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(0.5);
    expect(result.reasons.some(r => r.includes('architecture') || r.includes('design'))).toBe(true);
  });

  it('3. Reviewer + security review task yields high compatibility', () => {
    const task = makeTask({
      objective: 'Perform code review and security vulnerability audit',
      prompt: 'Inspect pull request for security vulnerabilities, linter compliance, and flaws',
    });

    const result = evaluateAgentTaskCompatibility(task, 'reviewer');
    expect(result.agentId).toBe('reviewer');
    expect(result.compatible).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(0.5);
    expect(result.reasons.some(r => r.includes('security') || r.includes('code quality'))).toBe(true);
  });

  it('4. QA Engineer + test automation task yields high compatibility', () => {
    const task = makeTask({
      objective: 'Write automated unit and integration tests with full coverage',
      prompt: 'Design vitest test suite covering edge cases and regression test scenarios',
    });

    const result = evaluateAgentTaskCompatibility(task, 'qa-engineer');
    expect(result.agentId).toBe('qa-engineer');
    expect(result.compatible).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(0.5);
    expect(result.reasons.some(r => r.includes('testing') || r.includes('quality assurance'))).toBe(true);
  });

  it('5. Chief of Staff + operational planning task yields high compatibility', () => {
    const task = makeTask({
      objective: 'Plan milestone roadmap and coordinate task decomposition across squads',
      prompt: 'Break down strategic CEO goals, plan milestones, and orchestrate delegation',
    });

    const result = evaluateAgentTaskCompatibility(task, 'chief-of-staff');
    expect(result.agentId).toBe('chief-of-staff');
    expect(result.compatible).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(0.5);
    expect(result.reasons.some(r => r.includes('planning') || r.includes('orchestration'))).toBe(true);
  });

  it('6. Developer + security audit task has lower compatibility score than Reviewer', () => {
    const securityTask = makeTask({
      objective: 'Conduct security vulnerability compliance audit on repository',
      prompt: 'Review code for CVE security flaws and compliance audit guidelines',
    });

    const devResult = evaluateAgentTaskCompatibility(securityTask, 'developer');
    const reviewerResult = evaluateAgentTaskCompatibility(securityTask, 'reviewer');

    expect(reviewerResult.score).toBeGreaterThan(devResult.score);
    expect(reviewerResult.compatible).toBe(true);
  });

  it('7. Reviewer + coding/implementation task is not classified as strong match', () => {
    const devTask = makeTask({
      objective: 'Implement new database migration and build backend CRUD endpoints',
      prompt: 'Write TypeScript backend code to build REST controller and database schema',
    });

    const devResult = evaluateAgentTaskCompatibility(devTask, 'developer');
    const reviewerResult = evaluateAgentTaskCompatibility(devTask, 'reviewer');

    expect(devResult.score).toBeGreaterThan(reviewerResult.score);
    expect(devResult.compatible).toBe(true);
  });

  it('8. Determinism: Same task + same agent produces identical score and reasons', () => {
    const task = makeTask({
      objective: 'Build payment gateway integration',
      prompt: 'Implement Stripe webhook handler in TypeScript',
    });

    const result1 = evaluateAgentTaskCompatibility(task, 'developer');
    const result2 = evaluateAgentTaskCompatibility(task, 'developer');

    expect(result1.score).toBe(result2.score);
    expect(result1.compatible).toBe(result2.compatible);
    expect(result1.reasons).toEqual(result2.reasons);
  });

  it('9. Score is strictly normalized between 0.0 and 1.0', () => {
    const tasks = [
      makeTask({ objective: '', prompt: '' }),
      makeTask({ objective: 'Build implement write create fix bug code develop function endpoint', prompt: 'typescript javascript api backend frontend' }),
    ];

    for (const task of tasks) {
      for (const agentId of ['developer', 'architect', 'reviewer', 'qa-engineer', 'chief-of-staff']) {
        const result = evaluateAgentTaskCompatibility(task, agentId);
        expect(result.score).toBeGreaterThanOrEqual(0.0);
        expect(result.score).toBeLessThanOrEqual(1.0);
      }
    }
  });

  it('10. Reasons array is non-empty and frozen/immutable', () => {
    const task = makeTask({ objective: 'Refactor component', prompt: 'Code cleanup' });
    const result = evaluateAgentTaskCompatibility(task, 'developer');

    expect(result.reasons.length).toBeGreaterThan(0);
    expect(Object.isFrozen(result.reasons)).toBe(true);
  });

  it('11. Task with empty objective handles safely without error', () => {
    const task = makeTask({ objective: '', prompt: 'Implement new feature' });
    const result = evaluateAgentTaskCompatibility(task, 'developer');

    expect(result).toBeDefined();
    expect(typeof result.score).toBe('number');
  });

  it('12. Task with empty prompt handles safely without error', () => {
    const task = makeTask({ objective: 'Write automated unit tests', prompt: '' });
    const result = evaluateAgentTaskCompatibility(task, 'qa-engineer');

    expect(result).toBeDefined();
    expect(result.compatible).toBe(true);
  });

  it('13. task.worker and evaluated agentId remain completely independent', () => {
    const task = makeTask({
      worker: 'worker-daemon-pid-456',
      agentId: 'architect',
      objective: 'Design distributed database architecture',
      prompt: 'System design specification',
    });

    const result = evaluateAgentTaskCompatibility(task, 'architect');
    expect(result.agentId).toBe('architect');
    expect(task.worker).toBe('worker-daemon-pid-456');
    expect(result.agentId).not.toBe(task.worker);
  });

  it('14. Accepts AgentRoleContext instance directly as argument', () => {
    const roleCtx = createAgentRoleContext('developer');
    expect(roleCtx).not.toBeNull();

    const task = makeTask({
      objective: 'Implement React component',
      prompt: 'Write frontend UI code',
    });

    const result = evaluateAgentTaskCompatibility(task, roleCtx!);
    expect(result.agentId).toBe('developer');
    expect(result.compatible).toBe(true);
  });

  it('15. Case-insensitivity: matches uppercase, lowercase and mixed case keywords', () => {
    const task = makeTask({
      objective: 'IMPLEMENT NEW API ENDPOINTS',
      prompt: 'WRITE TYPESCRIPT CODE',
    });

    const result = evaluateAgentTaskCompatibility(task, 'developer');
    expect(result.compatible).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(0.5);
  });

  it('16. Invalid agentId returns compatible = false and score = 0.0 with explanation', () => {
    const task = makeTask({ objective: 'Implement code' });
    const result = evaluateAgentTaskCompatibility(task, 'non-existent-agent-id');

    expect(result.compatible).toBe(false);
    expect(result.score).toBe(0.0);
    expect(result.reasons[0]).toContain('could not be resolved');
  });
});

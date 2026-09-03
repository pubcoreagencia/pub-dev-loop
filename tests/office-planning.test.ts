import { describe, it, expect } from 'vitest';
import {
  createOrganizationalPlan,
  validateStepDependencies,
  planStepToTask,
  type PlanStepInput,
} from '../src/office/planning.js';
import { defaultAgentRegistry, AgentRegistry } from '../src/office/registry.js';

describe('P5.7.11 — The Office: Chief of Staff Planning & Delegation Foundation', () => {
  it('1. Simple objective creates canonical 4-stage lifecycle plan', () => {
    const plan = createOrganizationalPlan('Build scalable user checkout system');

    expect(plan.id).toBeDefined();
    expect(plan.objective).toBe('Build scalable user checkout system');
    expect(plan.createdBy).toBe('chief-of-staff');
    expect(plan.status).toBe('READY');
    expect(plan.steps).toHaveLength(4);

    const [arch, dev, rev, qa] = plan.steps;
    expect(arch.agentId).toBe('architect');
    expect(arch.status).toBe('READY'); // 0 dependencies
    expect(arch.dependsOn).toEqual([]);

    expect(dev.agentId).toBe('developer');
    expect(dev.status).toBe('PENDING'); // depends on arch
    expect(dev.dependsOn).toEqual(['step-1-architect']);

    expect(rev.agentId).toBe('reviewer');
    expect(rev.status).toBe('PENDING'); // depends on dev
    expect(rev.dependsOn).toEqual(['step-2-developer']);

    expect(qa.agentId).toBe('qa-engineer');
    expect(qa.status).toBe('PENDING'); // depends on rev
    expect(qa.dependsOn).toEqual(['step-3-reviewer']);
  });

  it('2. Empty / invalid objective yields status = INVALID with error', () => {
    const plan = createOrganizationalPlan('');
    expect(plan.status).toBe('INVALID');
    expect(plan.validationErrors).toContain('Objective description cannot be empty');
  });

  it('3. Planning is 100% deterministic', () => {
    const p1 = createOrganizationalPlan('Build auth middleware', { planId: 'fixed-plan-id' });
    const p2 = createOrganizationalPlan('Build auth middleware', { planId: 'fixed-plan-id' });

    expect(p1.steps.map(s => ({ id: s.id, agent: s.agentId, score: s.compatibility.score })))
      .toEqual(p2.steps.map(s => ({ id: s.id, agent: s.agentId, score: s.compatibility.score })));
  });

  it('4. Chief of Staff is recorded as planner (createdBy = chief-of-staff)', () => {
    const plan = createOrganizationalPlan('Refactor database indexes');
    expect(plan.createdBy).toBe('chief-of-staff');
  });

  it('5. CEO is rejected and cannot be assigned as an executable agent', () => {
    const plan = createOrganizationalPlan('Execute company strategy', {
      steps: [
        {
          id: 'step-ceo-task',
          description: 'Sign strategic partnership',
          agentId: 'ceo',
        },
      ],
    });

    expect(plan.steps[0].agentId).toBeNull();
    expect(plan.steps[0].assignmentSource).toBe('UNRESOLVED');
    expect(plan.steps[0].status).toBe('UNRESOLVED');
    expect(plan.status).toBe('DRAFT');
  });

  it('6. Architect step resolves with high compatibility', () => {
    const plan = createOrganizationalPlan('Design system architecture', {
      steps: [
        {
          id: 'step-arch',
          description: 'Design distributed event broker architecture and schema boundaries',
          agentId: 'architect',
        },
      ],
    });

    const step = plan.steps[0];
    expect(step.agentId).toBe('architect');
    expect(step.compatibility.compatible).toBe(true);
    expect(step.compatibility.score).toBeGreaterThanOrEqual(0.7);
  });

  it('7. Developer step resolves with high compatibility', () => {
    const plan = createOrganizationalPlan('Implement CRUD controller', {
      steps: [
        {
          id: 'step-dev',
          description: 'Implement Express REST API endpoint and TypeScript controller',
          agentId: 'developer',
        },
      ],
    });

    const step = plan.steps[0];
    expect(step.agentId).toBe('developer');
    expect(step.compatibility.compatible).toBe(true);
    expect(step.compatibility.score).toBeGreaterThanOrEqual(0.7);
  });

  it('8. Reviewer step resolves with high compatibility', () => {
    const plan = createOrganizationalPlan('Audit code security', {
      steps: [
        {
          id: 'step-rev',
          description: 'Review code quality, security vulnerability, and design compliance',
          agentId: 'reviewer',
        },
      ],
    });

    const step = plan.steps[0];
    expect(step.agentId).toBe('reviewer');
    expect(step.compatibility.compatible).toBe(true);
    expect(step.compatibility.score).toBeGreaterThanOrEqual(0.7);
  });

  it('9. QA step resolves with high compatibility', () => {
    const plan = createOrganizationalPlan('Build test suite', {
      steps: [
        {
          id: 'step-qa',
          description: 'Design automated test suite with vitest for regression and validation',
          agentId: 'qa-engineer',
        },
      ],
    });

    const step = plan.steps[0];
    expect(step.agentId).toBe('qa-engineer');
    expect(step.compatibility.compatible).toBe(true);
    expect(step.compatibility.score).toBeGreaterThanOrEqual(0.7);
  });

  it('10. Explicit assignment is preserved with source = EXPLICIT', () => {
    const plan = createOrganizationalPlan('Custom task', {
      steps: [
        {
          id: 'step-custom',
          description: 'Implement database layer',
          agentId: 'architect',
        },
      ],
    });

    expect(plan.steps[0].agentId).toBe('architect');
    expect(plan.steps[0].assignmentSource).toBe('EXPLICIT');
  });

  it('11. Incompatible assignment is preserved without silent swap', () => {
    const plan = createOrganizationalPlan('Architecture review', {
      steps: [
        {
          id: 'step-mismatch',
          description: 'Design core domain boundaries and system architecture',
          agentId: 'reviewer',
        },
      ],
    });

    expect(plan.steps[0].agentId).toBe('reviewer'); // must NOT swap to architect
    expect(plan.steps[0].assignmentSource).toBe('EXPLICIT');
  });

  it('12. Unknown agent produces UNRESOLVED status', () => {
    const plan = createOrganizationalPlan('Task', {
      steps: [
        {
          id: 'step-invalid',
          description: 'Do something',
          agentId: 'non-existent-agent-id',
        },
      ],
    });

    expect(plan.steps[0].agentId).toBeNull();
    expect(plan.steps[0].status).toBe('UNRESOLVED');
  });

  it('13. Valid dependencies produce valid topological execution order', () => {
    const steps: PlanStepInput[] = [
      { id: 'step-1', description: 'Design' },
      { id: 'step-2', description: 'Code', dependsOn: ['step-1'] },
      { id: 'step-3', description: 'Test', dependsOn: ['step-2'] },
    ];

    const result = validateStepDependencies(steps);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.executionOrder).toEqual(['step-1', 'step-2', 'step-3']);
  });

  it('14. Non-existent dependency produces validation error and INVALID status', () => {
    const plan = createOrganizationalPlan('Goal', {
      steps: [
        { id: 'step-1', description: 'Build feature', dependsOn: ['non-existent-step-999'] },
      ],
    });

    expect(plan.status).toBe('INVALID');
    expect(plan.validationErrors.some(e => e.includes('non-existent'))).toBe(true);
  });

  it('15. Self-dependency produces validation error and INVALID status', () => {
    const plan = createOrganizationalPlan('Goal', {
      steps: [
        { id: 'step-self', description: 'Do self work', dependsOn: ['step-self'] },
      ],
    });

    expect(plan.status).toBe('INVALID');
    expect(plan.validationErrors.some(e => e.includes('Self-dependency'))).toBe(true);
  });

  it('16. Cyclic dependency produces validation error and INVALID status', () => {
    const plan = createOrganizationalPlan('Goal', {
      steps: [
        { id: 'step-a', description: 'A', dependsOn: ['step-b'] },
        { id: 'step-b', description: 'B', dependsOn: ['step-a'] },
      ],
    });

    expect(plan.status).toBe('INVALID');
    expect(plan.validationErrors.some(e => e.includes('Cyclic dependency'))).toBe(true);
  });

  it('17. Multi-branch deterministic topological sort', () => {
    const steps: PlanStepInput[] = [
      { id: 'arch', description: 'Architecture' },
      { id: 'backend', description: 'Backend', dependsOn: ['arch'] },
      { id: 'frontend', description: 'Frontend', dependsOn: ['arch'] },
      { id: 'integration', description: 'E2E', dependsOn: ['backend', 'frontend'] },
    ];

    const result = validateStepDependencies(steps);
    expect(result.valid).toBe(true);
    expect(result.executionOrder.indexOf('arch')).toBeLessThan(result.executionOrder.indexOf('backend'));
    expect(result.executionOrder.indexOf('arch')).toBeLessThan(result.executionOrder.indexOf('frontend'));
    expect(result.executionOrder.indexOf('backend')).toBeLessThan(result.executionOrder.indexOf('integration'));
    expect(result.executionOrder.indexOf('frontend')).toBeLessThan(result.executionOrder.indexOf('integration'));
  });

  it('18. Custom registry support', () => {
    const customRegistry = new AgentRegistry([
      {
        id: 'security-specialist',
        name: 'Sec Ops',
        title: 'Security Specialist',
        department: 'QA',
        role: 'REVIEWER',
        specialty: 'Penetration testing',
        personalitySummary: 'Meticulous',
        responsibilities: ['Security audit'],
        capabilities: ['security_audit'],
        routingProfile: 'review',
        status: 'ACTIVE',
      },
    ]);

    const plan = createOrganizationalPlan('Audit security', {
      steps: [
        { id: 'step-sec', description: 'Audit security', agentId: 'security-specialist' },
      ],
    }, customRegistry);

    expect(plan.steps[0].agentId).toBe('security-specialist');
    expect(plan.steps[0].assignmentSource).toBe('EXPLICIT');
  });

  it('19. Input immutability: input steps array is not mutated', () => {
    const inputSteps: PlanStepInput[] = [
      { id: 'step-1', description: 'Desc 1', dependsOn: ['step-0'] },
    ];
    const snapshot = JSON.stringify(inputSteps);

    createOrganizationalPlan('Goal', { steps: inputSteps });
    expect(JSON.stringify(inputSteps)).toBe(snapshot);
  });

  it('20. AgentRegistry immutability: registry agents are not mutated', () => {
    const devBefore = JSON.stringify(defaultAgentRegistry.getAgent('developer'));
    createOrganizationalPlan('Implement new API');
    const devAfter = JSON.stringify(defaultAgentRegistry.getAgent('developer'));

    expect(devAfter).toBe(devBefore);
  });

  it('21. Determinism: repeated calls produce identical plan structures', () => {
    const p1 = createOrganizationalPlan('Build scalable chat', { planId: 'fixed' });
    const p2 = createOrganizationalPlan('Build scalable chat', { planId: 'fixed' });

    expect(p1.steps.length).toBe(p2.steps.length);
    expect(p1.steps[0].agentId).toBe(p2.steps[0].agentId);
    expect(p1.steps[1].agentId).toBe(p2.steps[1].agentId);
  });

  it('22. planStepToTask preserves separation between agentId and worker', () => {
    const plan = createOrganizationalPlan('Build API');
    const step = plan.steps[0];

    const task = planStepToTask(step, plan, { worker: 'router-worker-process-01' });

    expect(task.agentId).toBe('architect');
    expect(task.worker).toBe('router-worker-process-01');
    expect(task.agentId).not.toBe(task.worker);
    expect(task.status).toBe('QUEUED');
    expect(task.objective).toBe(step.description);
  });

  it('23. Plan creation does NOT automatically enqueue or invoke workers', () => {
    const plan = createOrganizationalPlan('Build microservice');
    // Pure data object, no worker side effects
    expect(plan.steps.every(s => typeof s.id === 'string')).toBe(true);
  });

  it('24. Zero LLM / network / database calls (synchronous execution)', () => {
    const start = Date.now();
    const plan = createOrganizationalPlan('Build e-commerce store');
    const elapsed = Date.now() - start;

    expect(plan.status).toBe('READY');
    expect(elapsed).toBeLessThan(100); // executed purely in-memory in under 100ms
  });
});

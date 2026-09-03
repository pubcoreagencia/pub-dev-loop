import { describe, it, expect } from 'vitest';
import {
  createAgentRoleContext,
  toRoleContext,
  type AgentRoleContext,
} from '../src/office/role-context.js';
import { createAgentExecutionContext } from '../src/office/execution-context.js';
import { defaultAgentRegistry, AgentRegistry } from '../src/office/registry.js';
import type { Task } from '../src/domain.js';

describe('P5.7.7 — The Office: Agent Persona & Role Context', () => {
  it('1. Developer generates correct RoleContext with DEVELOPER role and ENGINEERING department', () => {
    const ctx = createAgentRoleContext('developer');
    expect(ctx).not.toBeNull();
    expect(ctx?.agentId).toBe('developer');
    expect(ctx?.role).toBe('DEVELOPER');
    expect(ctx?.department).toBe('ENGINEERING');
    expect(ctx?.title).toBe('Senior Full-Stack Developer');
  });

  it('2. Architect generates correct RoleContext with ARCHITECT role and ENGINEERING department', () => {
    const ctx = createAgentRoleContext('architect');
    expect(ctx).not.toBeNull();
    expect(ctx?.agentId).toBe('architect');
    expect(ctx?.role).toBe('ARCHITECT');
    expect(ctx?.department).toBe('ENGINEERING');
    expect(ctx?.title).toBe('Principal Software Architect');
  });

  it('3. Reviewer generates correct RoleContext with REVIEWER role and QA department', () => {
    const ctx = createAgentRoleContext('reviewer');
    expect(ctx).not.toBeNull();
    expect(ctx?.agentId).toBe('reviewer');
    expect(ctx?.role).toBe('REVIEWER');
    expect(ctx?.department).toBe('QA');
    expect(ctx?.title).toBe('Code & Security Reviewer');
  });

  it('4. QA Engineer generates correct RoleContext with QA_ENGINEER role and QA department', () => {
    const ctx = createAgentRoleContext('qa-engineer');
    expect(ctx).not.toBeNull();
    expect(ctx?.agentId).toBe('qa-engineer');
    expect(ctx?.role).toBe('QA_ENGINEER');
    expect(ctx?.department).toBe('QA');
    expect(ctx?.title).toBe('Quality Assurance & Test Automation Engineer');
  });

  it('5. Chief of Staff generates correct RoleContext with CHIEF_OF_STAFF role and EXECUTIVE department', () => {
    const ctx = createAgentRoleContext('chief-of-staff');
    expect(ctx).not.toBeNull();
    expect(ctx?.agentId).toBe('chief-of-staff');
    expect(ctx?.role).toBe('CHIEF_OF_STAFF');
    expect(ctx?.department).toBe('EXECUTIVE');
  });

  it('6. Invalid agentId does not generate valid context (null in default, error in strict)', () => {
    const ctx = createAgentRoleContext('invalid-agent-id');
    expect(ctx).toBeNull();

    expect(() => {
      createAgentRoleContext('invalid-agent-id', defaultAgentRegistry, { strict: true });
    }).toThrow(/Unknown agentId/);
  });

  it('7. null and undefined return null (backward-compatible)', () => {
    expect(createAgentRoleContext(null)).toBeNull();
    expect(createAgentRoleContext(undefined)).toBeNull();
    expect(createAgentRoleContext('')).toBeNull();
    expect(createAgentRoleContext('   ')).toBeNull();
  });

  it('8. CEO does not generate an AgentRoleContext', () => {
    expect(createAgentRoleContext('ceo')).toBeNull();
    expect(() => {
      createAgentRoleContext('ceo', defaultAgentRegistry, { strict: true });
    }).toThrow(/human operator/);
  });

  it('9. specialty is derived from AgentDefinition', () => {
    const ctx = createAgentRoleContext('architect');
    const agent = defaultAgentRegistry.getAgent('architect');
    expect(ctx?.specialty).toBe(agent?.specialty);
    expect(ctx?.specialty).toContain('System architecture');
  });

  it('10. responsibilities are derived from AgentDefinition', () => {
    const ctx = createAgentRoleContext('developer');
    const agent = defaultAgentRegistry.getAgent('developer');
    expect(ctx?.responsibilities).toEqual(agent?.responsibilities);
    expect(ctx?.responsibilities.length).toBeGreaterThan(0);
  });

  it('11. capabilities are derived from AgentDefinition', () => {
    const ctx = createAgentRoleContext('reviewer');
    const agent = defaultAgentRegistry.getAgent('reviewer');
    expect(ctx?.capabilities).toEqual(agent?.capabilities);
    expect(ctx?.capabilities).toContain('code_review');
  });

  it('12. personalitySummary is derived from AgentDefinition', () => {
    const ctx = createAgentRoleContext('chief-of-staff');
    const agent = defaultAgentRegistry.getAgent('chief-of-staff');
    expect(ctx?.personalitySummary).toBe(agent?.personalitySummary);
    expect(ctx?.personalitySummary).toContain('Decisive');
  });

  it('13. Immutability: modifying returned array or freezing prevents mutating the Registry', () => {
    const ctx = createAgentRoleContext('developer');
    expect(ctx).not.toBeNull();

    const originalResponsibilities = [...defaultAgentRegistry.getAgent('developer')!.responsibilities];

    // Attempting to push to frozen array throws or is blocked
    expect(() => {
      (ctx!.responsibilities as any).push('fake-new-responsibility');
    }).toThrow();

    // Verify registry remains unchanged
    expect(defaultAgentRegistry.getAgent('developer')!.responsibilities).toEqual(originalResponsibilities);
  });

  it('14. Immutability: modifying capabilities on context does not mutate Registry', () => {
    const ctx = createAgentRoleContext('qa-engineer');
    expect(ctx).not.toBeNull();

    const originalCapabilities = [...defaultAgentRegistry.getAgent('qa-engineer')!.capabilities];

    expect(() => {
      (ctx!.capabilities as any).push('fake-capability');
    }).toThrow();

    expect(defaultAgentRegistry.getAgent('qa-engineer')!.capabilities).toEqual(originalCapabilities);
  });

  it('15. agentId remains separated from task.worker', () => {
    const task: Task = {
      id: 'task-test-role',
      project: 'test-project',
      repository: 'https://example.com/repo.git',
      objective: 'Run test suite',
      prompt: 'Prompt',
      status: 'QUEUED',
      priority: 1,
      worker: 'worker-daemon-pid-999',
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
      agentId: 'qa-engineer',
    };

    const roleCtx = createAgentRoleContext(task.agentId);
    expect(roleCtx?.agentId).toBe('qa-engineer');
    expect(task.worker).toBe('worker-daemon-pid-999');
    expect(roleCtx?.agentId).not.toBe(task.worker);
  });

  it('16. routingProfile and preferredModel remain decoupled from AgentRoleContext', () => {
    const ctx = createAgentRoleContext('developer') as any;
    // AgentRoleContext strictly contains persona & role metadata, leaving routing decoupled
    expect(ctx.routingProfile).toBeUndefined();
    expect(ctx.preferredModel).toBeUndefined();
  });

  it('17. toRoleContext converts an existing AgentExecutionContext into an immutable AgentRoleContext', () => {
    const execCtx = createAgentExecutionContext('architect');
    expect(execCtx).not.toBeNull();

    const roleCtx = toRoleContext(execCtx!);
    expect(roleCtx.agentId).toBe('architect');
    expect(roleCtx.name).toBe('Helena Rostova');
    expect(roleCtx.role).toBe('ARCHITECT');
    expect(roleCtx.department).toBe('ENGINEERING');
    expect(Object.isFrozen(roleCtx.responsibilities)).toBe(true);
    expect(Object.isFrozen(roleCtx.capabilities)).toBe(true);
  });

  it('18. Custom registry injection in createAgentRoleContext works in isolation', () => {
    const customRegistry = new AgentRegistry([
      {
        id: 'specialist-01',
        name: 'Specialist',
        title: 'Lead Specialist',
        department: 'ENGINEERING',
        role: 'DEVELOPER',
        specialty: 'Security & Auth',
        personalitySummary: 'Methodical',
        responsibilities: ['Auth implementation'],
        capabilities: ['oauth2', 'jwt'],
        routingProfile: 'coding',
        status: 'ACTIVE',
      },
    ]);

    const ctx = createAgentRoleContext('specialist-01', customRegistry);
    expect(ctx).not.toBeNull();
    expect(ctx?.agentId).toBe('specialist-01');
    expect(ctx?.specialty).toBe('Security & Auth');
  });
});

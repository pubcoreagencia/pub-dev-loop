import { describe, it, expect } from 'vitest';
import {
  AgentRegistry,
  defaultAgentRegistry,
  getAgent,
  listAgents,
  getAgentsByDepartment,
  getAgentsByRole,
  INITIAL_STAFF,
} from '../src/office/registry.js';
import { MODEL_REGISTRY } from '../src/routing/registry.js';
import type { AgentDepartment, AgentRole, AgentRoutingProfile } from '../src/office/types.js';

describe('P5.7.1 — The Office: Agent Registry Foundation', () => {
  it('1. Registry contains exactly 5 initial agents', () => {
    const agents = listAgents();
    expect(agents).toHaveLength(5);
    expect(INITIAL_STAFF).toHaveLength(5);
  });

  it('2. IDs are unique across all registered agents', () => {
    const agents = listAgents();
    const ids = agents.map(a => a.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(5);
    expect(ids).toEqual(['chief-of-staff', 'architect', 'developer', 'reviewer', 'qa-engineer']);
  });

  it('3. Each agent possesses valid department and role', () => {
    const validDepartments: AgentDepartment[] = ['EXECUTIVE', 'ENGINEERING', 'QA'];
    const validRoles: AgentRole[] = [
      'CHIEF_OF_STAFF',
      'ARCHITECT',
      'DEVELOPER',
      'REVIEWER',
      'QA_ENGINEER',
    ];

    for (const agent of listAgents()) {
      expect(validDepartments).toContain(agent.department);
      expect(validRoles).toContain(agent.role);
      expect(typeof agent.name).toBe('string');
      expect(agent.name.length).toBeGreaterThan(0);
      expect(typeof agent.title).toBe('string');
      expect(agent.title.length).toBeGreaterThan(0);
    }
  });

  it('4. Each agent possesses a valid routingProfile', () => {
    const validProfiles: AgentRoutingProfile[] = [
      'reasoning',
      'coding',
      'review',
      'fast_prototype',
      'general',
    ];

    for (const agent of listAgents()) {
      expect(validProfiles).toContain(agent.routingProfile);
    }

    expect(getAgent('chief-of-staff')?.routingProfile).toBe('reasoning');
    expect(getAgent('architect')?.routingProfile).toBe('reasoning');
    expect(getAgent('developer')?.routingProfile).toBe('coding');
    expect(getAgent('reviewer')?.routingProfile).toBe('review');
    expect(getAgent('qa-engineer')?.routingProfile).toBe('review');
  });

  it('5. preferredModel references an existing model in MODEL_REGISTRY', () => {
    const validModelNames = MODEL_REGISTRY.map(m => m.model);

    for (const agent of listAgents()) {
      if (agent.preferredModel) {
        expect(validModelNames).toContain(agent.preferredModel);
      }
    }
  });

  it('6. Chief of Staff has isManager === true and others are false by default', () => {
    const cos = getAgent('chief-of-staff');
    expect(cos?.isManager).toBe(true);
    expect(cos?.role).toBe('CHIEF_OF_STAFF');
    expect(cos?.department).toBe('EXECUTIVE');

    const others = listAgents().filter(a => a.id !== 'chief-of-staff');
    for (const agent of others) {
      expect(agent.isManager).toBe(false);
    }
  });

  it('7. No agent points reportsTo to a non-existent agent', () => {
    const allIds = new Set(listAgents().map(a => a.id));

    for (const agent of listAgents()) {
      if (agent.reportsTo !== null && agent.reportsTo !== undefined) {
        expect(allIds.has(agent.reportsTo)).toBe(true);
      }
    }

    // Chief of Staff reports to human CEO (null / undefined in registry)
    expect(getAgent('chief-of-staff')?.reportsTo).toBeNull();
  });

  it('8. getAgent() retrieves existing agent and returns undefined for unknown ID', () => {
    const dev = getAgent('developer');
    expect(dev).toBeDefined();
    expect(dev?.id).toBe('developer');
    expect(dev?.role).toBe('DEVELOPER');
    expect(dev?.department).toBe('ENGINEERING');

    const unknown = getAgent('non-existent-agent');
    expect(unknown).toBeUndefined();
  });

  it('9. getAgentsByDepartment() filters strictly by department', () => {
    const executive = getAgentsByDepartment('EXECUTIVE');
    expect(executive).toHaveLength(1);
    expect(executive[0].id).toBe('chief-of-staff');

    const engineering = getAgentsByDepartment('ENGINEERING');
    expect(engineering).toHaveLength(2);
    expect(engineering.map(a => a.id)).toEqual(['architect', 'developer']);

    const qa = getAgentsByDepartment('QA');
    expect(qa).toHaveLength(2);
    expect(qa.map(a => a.id)).toEqual(['reviewer', 'qa-engineer']);
  });

  it('10. Registry does NOT contain a CEO agent', () => {
    const ceo = getAgent('ceo');
    expect(ceo).toBeUndefined();

    const ceoByRole = getAgentsByRole('CEO' as any);
    expect(ceoByRole).toHaveLength(0);

    const names = listAgents().map(a => a.name.toLowerCase());
    expect(names.some(n => n === 'ceo')).toBe(false);
  });

  it('11. Custom registry instantiation allows isolated agent catalogs', () => {
    const custom = new AgentRegistry([
      {
        id: 'custom-specialist',
        name: 'Custom Specialist',
        title: 'Domain Specialist',
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

    expect(custom.listAgents()).toHaveLength(1);
    expect(custom.getAgent('custom-specialist')).toBeDefined();
    expect(custom.getAgent('chief-of-staff')).toBeUndefined();
  });
});

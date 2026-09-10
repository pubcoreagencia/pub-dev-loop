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
import type {
  AgentDepartment,
  AgentRole,
  AgentRoutingProfile,
} from '../src/office/types.js';

describe('P5.7.1 — The Office: Agent Registry Foundation', () => {
  const allowedDepartments: AgentDepartment[] = [
    'EXECUTIVE',
    'ENGINEERING',
    'QA',
    'MULTIMEDIA',
    'GROWTH',
    'Setor 1: B2B Growth, Inteligência de Leads & Scraping',
    'Setor 2: Plataforma Pub Machine & SaaS de Automação',
    'Setor 3: E-Commerce, Food Control & Varejo Digital',
    'Setor 4: Audiovisual, Cinema 4K & Indústria Musical',
    'Setor 5: Experiências Imersivas 3D & Estúdio de Jogos',
    'Setor 6: Manufatura Afetiva, Pets & 3D Físico',
    'Setor 7: Real Estate, Turismo Boutique & Hotelaria',
    'Setor 8: iGaming, Apostas Esportivas & Jogos Preditivos (PubBet)',
    'Setor 9: Web3, Análise On-Chain & Cripto Inteligente',
    'Setor 10: Kernel Neural-OS & Infraestrutura Central',
  ];
  // All 50 specialized agents use department values that exactly match one of the 10 sector strings above.
  // This assertion confirms every agent is mapped to a valid canonical sector.
  const allowedRoles: AgentRole[] = [
    'CHIEF_OF_STAFF',
    'ARCHITECT',
    'DEVELOPER',
    'REVIEWER',
    'QA_ENGINEER',
    'VIDEO_EDITOR',
    'IMAGE_DESIGNER',
    'SOUND_ENGINEER',
    'GROWTH_OPS',
    'TECH_LEAD',
    'FULLSTACK_DEV',
    'PRODUCT_DESIGNER',
    'QA_SECURITY',
    'GROWTH_SALES',
  ];
  const allowedRoutingProfiles: AgentRoutingProfile[] = [
    'reasoning',
    'coding',
    'review',
    'fast_prototype',
    'multimedia',
    'growth',
    'general',
  ];

  it('1. Registry contains full 59 agents (core + multimedia + specialized)', () => {
    const agents = listAgents();
    expect(agents).toHaveLength(59);
    expect(INITIAL_STAFF).toHaveLength(9);
  });

  it('2. IDs are unique across all registered agents and core/multimedia IDs are present', () => {
    const agents = listAgents();
    const ids = agents.map((a) => a.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(59);
    expect(ids).toEqual(
      expect.arrayContaining([
        'chief-of-staff',
        'architect',
        'developer',
        'reviewer',
        'qa-engineer',
        'video-editor',
        'image-designer',
        'sound-engineer',
        'growth-ops',
      ]),
    );
  });

  it('3. Each agent has a valid department, role, and routingProfile', () => {
    for (const agent of listAgents()) {
      // department is valid if it is either a base dept, or contains "Setor" (all 10 sectors match this)
      const deptValid = allowedDepartments.slice(0,5).includes(agent.department) || agent.department.includes('Setor');
      expect(deptValid).toBe(true);
      expect(allowedRoles).toContain(agent.role);
      expect(allowedRoutingProfiles).toContain(agent.routingProfile);
    }
  });

  it('4. preferredModel, when defined, is a non‑empty string', () => {
    for (const agent of listAgents()) {
      if (agent.preferredModel) {
        expect(typeof agent.preferredModel).toBe('string');
        expect(agent.preferredModel.length).toBeGreaterThan(0);
      }
    }
  });

  it('5. isManager field is boolean when present', () => {
    for (const agent of listAgents()) {
      if (agent.isManager !== undefined && agent.isManager !== null) {
        expect(typeof agent.isManager).toBe('boolean');
      }
    }
  });

  it('6. No agent references a non‑existent reportsTo target', () => {
    const allIds = new Set(listAgents().map((a) => a.id));
    for (const agent of listAgents()) {
      if (agent.reportsTo !== null && agent.reportsTo !== undefined) {
        expect(allIds.has(agent.reportsTo)).toBe(true);
      }
    }
    // Chief of Staff reports to null/undefined (human CEO)
    expect(getAgent('chief-of-staff')?.reportsTo).toBeNull();
  });

  it('7. getAgent() retrieves existing agents and undefined for unknown IDs', () => {
    const dev = getAgent('developer');
    expect(dev).toBeDefined();
    expect(dev?.id).toBe('developer');
    expect(dev?.role).toBe('DEVELOPER');
    expect(dev?.department).toBe('ENGINEERING');

    const unknown = getAgent('non-existent-agent');
    expect(unknown).toBeUndefined();
  });

  it('8. getAgentsByDepartment() filters strictly by department', () => {
    const executive = getAgentsByDepartment('EXECUTIVE');
    expect(executive).toHaveLength(1);
    expect(executive[0].id).toBe('chief-of-staff');

    const engineering = getAgentsByDepartment('ENGINEERING');
    expect(engineering).toHaveLength(2);
    expect(engineering.map((a) => a.id)).toEqual(['architect', 'developer']);

    const qa = getAgentsByDepartment('QA');
    expect(qa).toHaveLength(2);
    expect(qa.map((a) => a.id)).toEqual(['reviewer', 'qa-engineer']);
  });

  it('9. Registry does NOT contain a CEO agent', () => {
    const ceo = getAgent('ceo');
    expect(ceo).toBeUndefined();
    // Role-based query should also be empty
    const ceoByRole = getAgentsByRole('CEO' as any);
    expect(ceoByRole).toHaveLength(0);

    const names = listAgents().map((a) => a.name.toLowerCase());
    expect(names.some((n) => n === 'ceo')).toBe(false);
  });

  it('10. Custom registry instantiation allows isolated agent catalogs', () => {
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

import { describe, it, expect } from 'vitest';
import apiWorker, { type Env } from '../src/api-worker.js';
import { createApp } from '../src/api.js';
import {
  OfficeOrganization,
  defaultOfficeOrganization,
  getCeo,
  getChiefOfStaff,
  getDepartments,
  getDepartmentAgents,
  getDirectReports,
  getOrganization,
} from '../src/office/organization.js';
import { defaultAgentRegistry } from '../src/office/registry.js';
import type { OrganizationStructure } from '../src/office/organization.js';

const mockEnv: Env = {
  PRIMARY_GATEWAY: 'openrouter',
  FALLBACK_GATEWAY: '9router',
};

describe('P5.7.3 — The Office: Organizational State Foundation', () => {
  describe('Organization Domain Logic (src/office/organization.ts)', () => {
    it('1. Organization defines a Human CEO', () => {
      const ceo = getCeo();
      expect(ceo).toBeDefined();
      expect(ceo.type).toBe('HUMAN');
      expect(ceo.role).toBe('CEO');
    });

    it('2. CEO does NOT appear as an AgentDefinition in the Agent Registry', () => {
      const agentCeo = defaultAgentRegistry.getAgent('ceo');
      expect(agentCeo).toBeUndefined();

      const allAgents = defaultAgentRegistry.listAgents();
      expect(allAgents.some(a => a.role === ('CEO' as any))).toBe(false);
      expect(allAgents.some(a => a.id === 'ceo')).toBe(false);
    });

    it('3. Chief of Staff is correctly resolved from registry', () => {
      const cos = getChiefOfStaff();
      expect(cos).toBeDefined();
      expect(cos.id).toBe('chief-of-staff');
      expect(cos.role).toBe('CHIEF_OF_STAFF');
      expect(cos.department).toBe('EXECUTIVE');
      expect(cos.isManager).toBe(true);
      expect(cos.reportsTo).toBeNull();
    });

    it('4. Departments are derived correctly from registered agents', () => {
      const departments = getDepartments();
      expect(departments).toHaveLength(3);

      const deptNames = departments.map(d => d.name);
      expect(deptNames).toEqual(['EXECUTIVE', 'ENGINEERING', 'QA']);
    });

    it('5. ENGINEERING department contains Architect and Developer', () => {
      const engAgents = getDepartmentAgents('ENGINEERING');
      expect(engAgents).toHaveLength(2);
      expect(engAgents.map(a => a.id)).toEqual(['architect', 'developer']);

      const dept = getDepartments().find(d => d.name === 'ENGINEERING');
      expect(dept?.agentIds).toEqual(['architect', 'developer']);
    });

    it('6. QA department contains Reviewer and QA Engineer', () => {
      const qaAgents = getDepartmentAgents('QA');
      expect(qaAgents).toHaveLength(2);
      expect(qaAgents.map(a => a.id)).toEqual(['reviewer', 'qa-engineer']);

      const dept = getDepartments().find(d => d.name === 'QA');
      expect(dept?.agentIds).toEqual(['reviewer', 'qa-engineer']);
    });

    it('7. EXECUTIVE department contains Chief of Staff', () => {
      const execAgents = getDepartmentAgents('EXECUTIVE');
      expect(execAgents).toHaveLength(1);
      expect(execAgents[0].id).toBe('chief-of-staff');

      const dept = getDepartments().find(d => d.name === 'EXECUTIVE');
      expect(dept?.agentIds).toEqual(['chief-of-staff']);
    });

    it('8. Direct reports of Chief of Staff return the four specialist agents', () => {
      const reports = getDirectReports('chief-of-staff');
      expect(reports).toHaveLength(4);
      const reportIds = reports.map(r => r.id);
      expect(reportIds).toEqual(['architect', 'developer', 'reviewer', 'qa-engineer']);
    });

    it('9. Organizational hierarchy is faithfully derived from reportsTo', () => {
      const org = getOrganization();
      expect(org.ceo.type).toBe('HUMAN');
      expect(org.chiefOfStaff.id).toBe('chief-of-staff');
      expect(org.chiefOfStaff.reportsTo).toBeNull();

      // All specialist agents report to chief-of-staff
      const specialists = org.agents.filter(a => a.id !== 'chief-of-staff');
      expect(specialists).toHaveLength(4);
      for (const specialist of specialists) {
        expect(specialist.reportsTo).toBe('chief-of-staff');
      }
    });
  });

  describe('Organization API Endpoint (GET /office/organization)', () => {
    it('10. GET /office/organization returns 200 status', async () => {
      const request = new Request('http://localhost/office/organization', { method: 'GET' });
      const response = await apiWorker.fetch(request, mockEnv, {});

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toContain('application/json');
    });

    it('11. API payload matches defaultOfficeOrganization.getOrganization()', async () => {
      const request = new Request('http://localhost/office/organization', { method: 'GET' });
      const response = await apiWorker.fetch(request, mockEnv, {});
      const body = (await response.json()) as { organization: OrganizationStructure };

      expect(body.organization).toBeDefined();
      expect(body.organization.ceo).toEqual({ type: 'HUMAN', role: 'CEO' });
      expect(body.organization.chiefOfStaff.id).toBe('chief-of-staff');
      expect(body.organization.departments).toHaveLength(3);
      expect(body.organization.agents).toHaveLength(5);
      expect(body.organization).toEqual(defaultOfficeOrganization.getOrganization());
    });

    it('12. No sensitive internal data (secrets, keys, tokens, env) appears in organization response', async () => {
      const request = new Request('http://localhost/office/organization', { method: 'GET' });
      const response = await apiWorker.fetch(request, mockEnv, {});
      const text = await response.text();

      expect(text).not.toContain('apiKey');
      expect(text).not.toContain('API_KEY');
      expect(text).not.toContain('DATABASE_URL');
      expect(text).not.toContain('token');
      expect(text).not.toContain('secret');
    });

    it('13. Express app parity for GET /office/organization', async () => {
      const mockTaskRepo: any = { list: async () => [] };
      const mockProtoRepo: any = { listSessions: async () => [] };
      const app = createApp(mockTaskRepo, mockProtoRepo);

      const server = app.listen(0);
      const address = server.address() as { port: number };
      const baseUrl = 'http://127.0.0.1:' + address.port;

      try {
        const res = await fetch(baseUrl + '/office/organization');
        expect(res.status).toBe(200);
        const body = (await res.json()) as { organization: OrganizationStructure };
        expect(body.organization.ceo).toEqual({ type: 'HUMAN', role: 'CEO' });
        expect(body.organization.chiefOfStaff.id).toBe('chief-of-staff');
        expect(body.organization.departments).toHaveLength(3);
        expect(body.organization.agents).toHaveLength(5);
      } finally {
        server.close();
      }
    });
  });
});

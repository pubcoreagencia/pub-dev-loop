import { describe, it, expect } from 'vitest';
import apiWorker, { type Env } from '../src/api-worker.js';
import { createApp } from '../src/api.js';
import { defaultAgentRegistry } from '../src/office/registry.js';
import type { AgentDefinition } from '../src/office/types.js';

const mockEnv: Env = {
  PRIMARY_GATEWAY: 'openrouter',
  FALLBACK_GATEWAY: '9router',
};

describe('P5.7.2 — The Office: API & State Endpoints', () => {
  describe('Cloudflare Worker API (src/api-worker.ts)', () => {
    it('1. GET /office/agents returns 200 status', async () => {
      const request = new Request('http://localhost/office/agents', { method: 'GET' });
      const response = await apiWorker.fetch(request, mockEnv, {});

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toContain('application/json');
    });

    it('2. GET /office/agents returns exactly 5 agents', async () => {
      const request = new Request('http://localhost/office/agents', { method: 'GET' });
      const response = await apiWorker.fetch(request, mockEnv, {});
      const body = (await response.json()) as { agents: AgentDefinition[] };

      expect(body.agents).toBeDefined();
      expect(body.agents).toHaveLength(5);
    });

    it('3. GET /office/agents preserves canonical order of agent IDs', async () => {
      const request = new Request('http://localhost/office/agents', { method: 'GET' });
      const response = await apiWorker.fetch(request, mockEnv, {});
      const body = (await response.json()) as { agents: AgentDefinition[] };

      const ids = body.agents.map(a => a.id);
      expect(ids).toEqual([
        'chief-of-staff',
        'architect',
        'developer',
        'reviewer',
        'qa-engineer',
      ]);
    });

    it('4. GET /office/agents payload matches defaultAgentRegistry.listAgents()', async () => {
      const request = new Request('http://localhost/office/agents', { method: 'GET' });
      const response = await apiWorker.fetch(request, mockEnv, {});
      const body = (await response.json()) as { agents: AgentDefinition[] };

      expect(body.agents).toEqual(defaultAgentRegistry.listAgents());
    });

    it('5. GET /office/agents/chief-of-staff returns 200', async () => {
      const request = new Request('http://localhost/office/agents/chief-of-staff', { method: 'GET' });
      const response = await apiWorker.fetch(request, mockEnv, {});

      expect(response.status).toBe(200);
    });

    it('6. GET /office/agents/:id returns the correct agent object', async () => {
      const request = new Request('http://localhost/office/agents/developer', { method: 'GET' });
      const response = await apiWorker.fetch(request, mockEnv, {});
      const body = (await response.json()) as { agent: AgentDefinition };

      expect(body.agent).toBeDefined();
      expect(body.agent.id).toBe('developer');
      expect(body.agent.role).toBe('DEVELOPER');
      expect(body.agent.department).toBe('ENGINEERING');
      expect(body.agent.routingProfile).toBe('coding');
      expect(body.agent.preferredModel).toBe('minimax/minimax-m2.7:free');
    });

    it('7. GET /office/agents/does-not-exist returns 404', async () => {
      const request = new Request('http://localhost/office/agents/does-not-exist', { method: 'GET' });
      const response = await apiWorker.fetch(request, mockEnv, {});

      expect(response.status).toBe(404);
    });

    it('8. 404 error format is { error: Agent not found }', async () => {
      const request = new Request('http://localhost/office/agents/non-existent-agent-id', { method: 'GET' });
      const response = await apiWorker.fetch(request, mockEnv, {});
      const body = (await response.json()) as { error: string };

      expect(body).toEqual({ error: 'Agent not found' });
    });

    it('9. No sensitive internal data (tokens, keys, secrets, env) appears in responses', async () => {
      const listReq = new Request('http://localhost/office/agents', { method: 'GET' });
      const listRes = await apiWorker.fetch(listReq, mockEnv, {});
      const listText = await listRes.text();

      expect(listText).not.toContain('apiKey');
      expect(listText).not.toContain('API_KEY');
      expect(listText).not.toContain('token');
      expect(listText).not.toContain('DATABASE_URL');
      expect(listText).not.toContain('secret');

      const itemReq = new Request('http://localhost/office/agents/chief-of-staff', { method: 'GET' });
      const itemRes = await apiWorker.fetch(itemReq, mockEnv, {});
      const itemText = await itemRes.text();

      expect(itemText).not.toContain('apiKey');
      expect(itemText).not.toContain('API_KEY');
      expect(itemText).not.toContain('DATABASE_URL');
    });

    it('10. CORS headers are attached on /office/agents endpoints', async () => {
      const request = new Request('http://localhost/office/agents', { method: 'GET' });
      const response = await apiWorker.fetch(request, mockEnv, {});

      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(response.headers.get('Access-Control-Allow-Methods')).toContain('GET');
    });
  });

  describe('Express App Parity (src/api.ts)', () => {
    it('11. Express app handles GET /office/agents and GET /office/agents/:id with identical payload', async () => {
      const mockTaskRepo: any = { list: async () => [] };
      const mockProtoRepo: any = { listSessions: async () => [] };
      const app = createApp(mockTaskRepo, mockProtoRepo);

      // We can invoke handlers directly or verify app routes
      const server = app.listen(0);
      const address = server.address() as { port: number };
      const baseUrl = 'http://127.0.0.1:' + address.port;

      try {
        const listRes = await fetch(baseUrl + '/office/agents');
        expect(listRes.status).toBe(200);
        const listBody = await listRes.json() as any;
        expect(listBody.agents).toHaveLength(5);
        expect(listBody.agents[0].id).toBe('chief-of-staff');

        const itemRes = await fetch(baseUrl + '/office/agents/architect');
        expect(itemRes.status).toBe(200);
        const itemBody = await itemRes.json() as any;
        expect(itemBody.agent.id).toBe('architect');

        const notFoundRes = await fetch(baseUrl + '/office/agents/unknown-id');
        expect(notFoundRes.status).toBe(404);
        const notFoundBody = await notFoundRes.json() as any;
        expect(notFoundBody.error).toBe('Agent not found');
      } finally {
        server.close();
      }
    });
  });
});

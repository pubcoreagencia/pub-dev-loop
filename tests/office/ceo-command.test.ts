import { describe, it, expect, beforeEach } from 'vitest';
import apiWorker, { type Env } from '../../src/api-worker.js';
import { defaultCeoConversationStore } from '../../src/office/ceo-conversation-store.js';

const mockEnv: Env = {
  PRIMARY_GATEWAY: 'openrouter',
  FALLBACK_GATEWAY: '9router',
};

describe('CEO Command Endpoints (POST /office/ceo/command, GET /office/ceo/conversation/:id, GET /office/ceo/events/:id)', () => {
  beforeEach(() => {
    defaultCeoConversationStore.clear();
  });

  describe('1. POST /office/ceo/command', () => {
    it('returns 400 when message is missing or empty', async () => {
      const request = new Request('http://localhost/office/ceo/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: '' }),
      });

      const response = await apiWorker.fetch(request, mockEnv, {});
      expect(response.status).toBe(400);
      const data = (await response.json()) as any;
      expect(data.error).toContain('message is required');
    });

    it('returns 200 with CLARIFICATION when message is ambiguous', async () => {
      const request = new Request('http://localhost/office/ceo/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'arrume',
          project: 'pub-dev-loop',
        }),
      });

      const response = await apiWorker.fetch(request, mockEnv, {});
      expect(response.status).toBe(200);
      const data = (await response.json()) as any;
      expect(data.type).toBe('CLARIFICATION');
      expect(data.response).toContain('Esclarecimento Operacional Necessário');
      expect(data.task).toBeUndefined();
    });

    it('returns 200 with INQUIRY when message is a status check', async () => {
      const request = new Request('http://localhost/office/ceo/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Qual o status atual do git no projeto?',
          project: 'pub-rate-calculator',
        }),
      });

      const response = await apiWorker.fetch(request, mockEnv, {});
      expect(response.status).toBe(200);
      const data = (await response.json()) as any;
      expect(data.type).toBe('INQUIRY');
      expect(data.response).toContain('Status Operacional Auditado');
      expect(data.task).toBeUndefined();
      expect(data.gitState).toBeDefined();
    });

    it('returns 200 with ACTION, single specialist delegation, and sealed spec on directive', async () => {
      const request = new Request('http://localhost/office/ceo/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Implemente a validação do cálculo de taxas no arquivo src/calculator.ts',
          project: 'pub-rate-calculator',
        }),
      });

      const response = await apiWorker.fetch(request, mockEnv, {});
      expect(response.status).toBe(200);
      const data = (await response.json()) as any;
      expect(data.type).toBe('ACTION');
      expect(data.assignedSpecialist?.id).toBe('developer');
      expect(data.assignedSpecialist?.name).toBe('Lucas Silveira');
      expect(data.task).toBeDefined();
      expect(data.task.id).toMatch(/^TASK-CEO-/);
      expect(data.executionSpec).toBeDefined();
      expect(data.events).toBeDefined();
      expect(data.events.length).toBe(6);
      expect(data.task.status).toBe('QUEUED');
    });
  });

  describe('2. GET /office/ceo/conversation/:id', () => {
    it('returns 404 when conversation does not exist', async () => {
      const request = new Request('http://localhost/office/ceo/conversation/non-existent-conv-id', {
        method: 'GET',
      });

      const response = await apiWorker.fetch(request, mockEnv, {});
      expect(response.status).toBe(404);
      const data = (await response.json()) as any;
      expect(data.error).toBe('Conversation session not found');
    });

    it('returns 200 and full conversation history when session exists', async () => {
      const convId = 'session-test-e2e-api-01';

      // 1. Post a command to establish conversation
      const postReq = new Request('http://localhost/office/ceo/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: convId,
          message: 'Qual o status atual do projeto?',
          project: 'pub-rate-calculator',
        }),
      });
      await apiWorker.fetch(postReq, mockEnv, {});

      // 2. Fetch conversation
      const getReq = new Request(`http://localhost/office/ceo/conversation/${convId}`, {
        method: 'GET',
      });
      const getRes = await apiWorker.fetch(getReq, mockEnv, {});
      expect(getRes.status).toBe(200);
      const data = (await getRes.json()) as any;
      expect(data.session).toBeDefined();
      expect(data.session.id).toBe(convId);
      expect(data.session.messages.length).toBe(2);
      expect(data.session.messages[0].sender).toBe('CEO');
      expect(data.session.messages[1].sender).toBe('CHIEF_OF_STAFF');
    });
  });

  describe('3. GET /office/ceo/events/:id', () => {
    it('returns 200 and stream of operational events for a conversation', async () => {
      const convId = 'session-test-events-api-01';

      // 1. Post a command
      const postReq = new Request('http://localhost/office/ceo/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: convId,
          message: 'Defina a arquitetura do novo subsistema de mensageria',
          project: 'pub-dev-loop',
        }),
      });
      await apiWorker.fetch(postReq, mockEnv, {});

      // 2. Fetch events
      const getReq = new Request(`http://localhost/office/ceo/events/${convId}`, {
        method: 'GET',
      });
      const getRes = await apiWorker.fetch(getReq, mockEnv, {});
      expect(getRes.status).toBe(200);
      const data = (await getRes.json()) as any;
      expect(data.events).toBeDefined();
      expect(data.events.length).toBeGreaterThanOrEqual(6);

      const eventTypes = data.events.map((e: any) => e.type);
      expect(eventTypes).toContain('RECEIVED');
      expect(eventTypes).toContain('ANALYZING');
      expect(eventTypes).toContain('CONTEXT_RESOLVED');
      expect(eventTypes).toContain('PLANNING');
      expect(eventTypes).toContain('DELEGATING');
      expect(eventTypes).toContain('QUEUED');
      expect(eventTypes).not.toContain('COMPLETED');
    });
  });
});

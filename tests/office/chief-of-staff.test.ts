import { describe, it, expect, beforeEach } from 'vitest';
import { ChiefOfStaffAgent } from '../../src/office/chief-of-staff-agent.js';
import { CeoConversationStore } from '../../src/office/ceo-conversation-store.js';
import { AgentRegistry, INITIAL_STAFF } from '../../src/office/registry.js';
import { DefaultPubNeuralBridge } from '../../src/pdl/neural/neural-bridge.js';
import { CodeReviewManager } from '../../src/office/review.js';

describe('ChiefOfStaffAgent (CEO_COMMAND_02, 03, 04, 05, 06, 07, 08, 09, 10, 11)', () => {
  let conversationStore: CeoConversationStore;
  let registry: AgentRegistry;
  let agent: ChiefOfStaffAgent;

  beforeEach(() => {
    conversationStore = new CeoConversationStore();
    registry = new AgentRegistry(INITIAL_STAFF);
    agent = new ChiefOfStaffAgent(
      conversationStore,
      registry,
      new DefaultPubNeuralBridge(),
      new CodeReviewManager()
    );
  });

  describe('CEO_COMMAND_10: Status Inquiry / Informational Question', () => {
    it('answers status inquiries factually without creating execution tasks', async () => {
      const res = await agent.handleCommand({
        message: 'Qual o status atual do git no projeto?',
        project: 'pub-rate-calculator',
      });

      expect(res.type).toBe('INQUIRY');
      expect(res.task).toBeUndefined();
      expect(res.gitState).toBeDefined();
      expect(res.response).toContain('Status Operacional Auditado');
      expect(res.response).toContain('Branch Ativa');

      // Verify operational events
      const eventTypes = res.events.map((e) => e.type);
      expect(eventTypes).toEqual(['RECEIVED', 'ANALYZING', 'CONTEXT_RESOLVED', 'COMPLETED']);
    });
  });

  describe('CEO_COMMAND_11: Ambiguous / Underspecified Command', () => {
    it('requests clarification when prompt lacks scope or is overly vague', async () => {
      const res = await agent.handleCommand({
        message: 'arrume',
        project: 'pub-dev-loop',
      });

      expect(res.type).toBe('CLARIFICATION');
      expect(res.task).toBeUndefined();
      expect(res.response).toContain('Esclarecimento Operacional Necessário');
      expect(res.response).toContain('Zero Fake Activity');

      const eventTypes = res.events.map((e) => e.type);
      expect(eventTypes).toEqual(['RECEIVED', 'ANALYZING', 'CLARIFICATION_REQUESTED']);
    });
  });

  describe('CEO_COMMAND_05 & 06: Dynamic Single-Specialist Delegation', () => {
    it('delegates code implementation and bug fixes exclusively to developer (Lucas Silveira)', async () => {
      const res = await agent.handleCommand({
        message: 'Implemente a validação do cálculo de taxas no arquivo src/calculator.ts',
        project: 'pub-rate-calculator',
      });

      expect(res.type).toBe('ACTION');
      expect(res.assignedSpecialist).toBeDefined();
      expect(res.assignedSpecialist?.id).toBe('developer');
      expect(res.assignedSpecialist?.name).toBe('Lucas Silveira');
      expect(res.task?.agentId).toBe('developer');
    });

    it('delegates architecture and design exclusively to architect (Helena Rostova)', async () => {
      const res = await agent.handleCommand({
        message: 'Defina a arquitetura e contrato de API para o novo gateway de pagamentos',
        project: 'pub-dev-loop',
      });

      expect(res.type).toBe('ACTION');
      expect(res.assignedSpecialist?.id).toBe('architect');
      expect(res.assignedSpecialist?.name).toBe('Helena Rostova');
    });

    it('delegates security audit and code review exclusively to reviewer (Beatriz Mendes)', async () => {
      const res = await agent.handleCommand({
        message: 'Execute uma auditoria de segurança e code review contra vulnerabilidades OWASP',
        project: 'pub-dev-loop',
      });

      expect(res.type).toBe('ACTION');
      expect(res.assignedSpecialist?.id).toBe('reviewer');
      expect(res.assignedSpecialist?.name).toBe('Beatriz Mendes');
    });

    it('delegates test suites and validation exclusively to qa-engineer (Tiago Rocha)', async () => {
      const res = await agent.handleCommand({
        message: 'Escreva a suíte de testes unitários no Vitest para cobrir cenários de falha',
        project: 'pub-rate-calculator',
      });

      expect(res.type).toBe('ACTION');
      expect(res.assignedSpecialist?.id).toBe('qa-engineer');
      expect(res.assignedSpecialist?.name).toBe('Tiago Rocha');
    });
  });

  describe('CEO_COMMAND_07, 08, 09: Sealed Spec, Lifecycle Stream & Factual Report', () => {
    it('produces full governed event stream and sealed ExecutionSpec', async () => {
      const res = await agent.handleCommand({
        message: 'Refatore o parser de requisições para suportar idempotência de transações',
        project: 'pub-rate-calculator',
      });

      expect(res.type).toBe('ACTION');
      expect(res.task).toBeDefined();
      expect(res.task?.id).toMatch(/^TASK-CEO-/);
      expect(res.executionSpec).toBeDefined();
      expect(res.executionSpec?.metadata.specHash).toBeDefined();

      // Verify stream events progression
      const eventTypes = res.events.map((e) => e.type);
      expect(eventTypes).toContain('RECEIVED');
      expect(eventTypes).toContain('ANALYZING');
      expect(eventTypes).toContain('CONTEXT_RESOLVED');
      expect(eventTypes).toContain('PLANNING');
      expect(eventTypes).toContain('DELEGATING');
      expect(eventTypes).toContain('EXECUTING');
      expect(eventTypes).toContain('REVIEWING');
      expect(eventTypes).toContain('VALIDATING');
      expect(eventTypes).toContain('FINALIZING');
      expect(eventTypes).toContain('COMPLETED');

      // Response to CEO must be factual
      expect(res.response).toContain('Diretriz Executiva Despachada para Execução');
      expect(res.response).toContain(res.task!.id);
      expect(res.response).toContain(res.assignedSpecialist!.name);
      expect(res.response).toContain(res.executionSpec!.metadata.specHash);
    });
  });

  describe('CEO_COMMAND_03: Persistent Conversation History', () => {
    it('preserves multi-turn conversation and events across commands in same session', async () => {
      const convId = 'session-ceo-multi-turn-01';

      await agent.handleCommand({
        conversationId: convId,
        message: 'Como está o repositório?',
        project: 'pub-rate-calculator',
      });

      await agent.handleCommand({
        conversationId: convId,
        message: 'Implemente uma função de soma no arquivo src/math.ts',
        project: 'pub-rate-calculator',
      });

      const session = conversationStore.getSession(convId);
      expect(session).toBeDefined();
      expect(session?.messages.length).toBe(4); // 2 user messages + 2 chief of staff replies
      expect(session?.events.length).toBeGreaterThanOrEqual(10);
    });
  });
});

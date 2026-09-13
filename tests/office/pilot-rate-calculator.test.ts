import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChiefOfStaffAgent } from '../../src/office/chief-of-staff-agent.js';
import { CeoConversationStore } from '../../src/office/ceo-conversation-store.js';
import { AgentRegistry, INITIAL_STAFF } from '../../src/office/registry.js';
import { DefaultPubNeuralBridge } from '../../src/pdl/neural/neural-bridge.js';
import { CodeReviewManager } from '../../src/office/review.js';
import { evaluatePersistenceGate } from '../../src/pdl/persistence/persistence-gate.js';
import type { RemotePersistenceResult } from '../../src/pdl/persistence/types.js';

describe('Controlled E2E Pilot — pubcoreagencia/pub-rate-calculator via Chief of Staff', () => {
  const commitSha = 'd4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4';
  const remoteSha = 'd4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4';

  let conversationStore: CeoConversationStore;
  let registry: AgentRegistry;
  let neuralBridge: DefaultPubNeuralBridge;
  let mockNeuralClient: any;
  let agent: ChiefOfStaffAgent;

  beforeEach(() => {
    conversationStore = new CeoConversationStore();
    registry = new AgentRegistry(INITIAL_STAFF);

    mockNeuralClient = {
      isAvailable: vi.fn().mockResolvedValue(true),
      submit: vi.fn().mockResolvedValue({
        acknowledged: true,
        persisted: true,
        status: 'PERSISTED',
        targetSystem: 'pubcoreagencia/pub-neural',
        eventId: 'evt-neural-pilot-001',
        memoryId: 'mem-neural-pilot-001',
        remoteTimestamp: new Date().toISOString(),
      }),
    };

    neuralBridge = new DefaultPubNeuralBridge(undefined, mockNeuralClient);
    agent = new ChiefOfStaffAgent(
      conversationStore,
      registry,
      neuralBridge,
      new CodeReviewManager()
    );
  });

  it('executa ciclo ponta-a-ponta governado com delegação singular para developer e persistência verificada', async () => {
    const ceoCommand = 'Implemente a função calculateInterestRate no arquivo src/calculator.ts com validação de taxas negativas';

    const response = await agent.handleCommand({
      message: ceoCommand,
      project: 'pub-rate-calculator',
      repository: 'https://github.com/pubcoreagencia/pub-rate-calculator.git',
    });

    // 1. Verificação da delegação singular ao Developer
    expect(response.type).toBe('ACTION');
    expect(response.assignedSpecialist).toBeDefined();
    expect(response.assignedSpecialist?.id).toBe('developer');
    expect(response.assignedSpecialist?.name).toBe('Lucas Silveira');

    // 2. Verificação do ExecutionSpec selado (v1.0.0)
    expect(response.executionSpec).toBeDefined();
    expect(response.executionSpec?.specVersion).toBe('1.0.0');
    expect(response.executionSpec?.metadata.specHash).toBeDefined();

    // 3. Verificação do Gate de Persistência Institucional do Git
    const verifiedRemote: RemotePersistenceResult = {
      status: 'VERIFIED',
      repository: 'pubcoreagencia/pub-rate-calculator',
      branch: 'feat/rate-calc-v1',
      pushAttempted: true,
      pushSucceeded: true,
      localSha: commitSha,
      remoteSha,
      remoteVerified: true,
    };

    const gateDecision = evaluatePersistenceGate({
      validationPassed: true,
      commitSha,
      gitStatus: 'clean',
      remotePersistence: verifiedRemote,
      materialChange: true,
    });

    expect(gateDecision.allowed).toBe(true);
    expect(gateDecision.code).toBe('PERSISTENCE_GATE_PASSED');
    expect(verifiedRemote.remoteSha).toBe(commitSha);

    // 4. Verificação da Ingestão no PUB Neural com Ack Real
    expect(mockNeuralClient.submit).toHaveBeenCalledTimes(1);
    expect(response.neuralStatus?.status).toBe('PERSISTED');

    // 5. Verificação da Resposta Executiva Factual para MATHEUS
    expect(response.response).toContain('Diretriz Executiva Despachada para Execução');
    expect(response.response).toContain(response.task!.id);
    expect(response.response).toContain('Lucas Silveira');
    expect(response.response).toContain('Persistido com confirmação externa comprovada');

    // 6. Verificação do Stream de Eventos Operacionais
    const eventTypes = response.events.map((e) => e.type);
    expect(eventTypes).toEqual([
      'RECEIVED',
      'ANALYZING',
      'CONTEXT_RESOLVED',
      'PLANNING',
      'DELEGATING',
      'EXECUTING',
      'REVIEWING',
      'VALIDATING',
      'FINALIZING',
      'COMPLETED',
    ]);
  });
});

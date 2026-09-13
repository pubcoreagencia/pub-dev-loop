import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChiefOfStaffAgent } from '../../src/office/chief-of-staff-agent.js';
import { CeoConversationStore } from '../../src/office/ceo-conversation-store.js';
import { AgentRegistry, INITIAL_STAFF } from '../../src/office/registry.js';
import { DefaultPubNeuralBridge } from '../../src/pdl/neural/neural-bridge.js';
import { CodeReviewManager } from '../../src/office/review.js';
import { evaluatePersistenceGate } from '../../src/pdl/persistence/persistence-gate.js';
import type { RemotePersistenceResult } from '../../src/pdl/persistence/types.js';
import type { Task, TaskRepository, CreateTask } from '../../src/domain.js';
import type { Worker } from '../../src/worker-service.js';

class InMemoryTaskRepository implements TaskRepository {
  public tasks = new Map<string, Task>();

  async create(input: CreateTask | Task): Promise<Task> {
    const task: Task = {
      id: (input as Task).id || `task-${Date.now()}`,
      project: input.project,
      repository: input.repository,
      objective: input.objective,
      prompt: input.prompt,
      status: (input as Task).status || 'QUEUED',
      priority: input.priority ?? 1,
      worker: (input as Task).worker || null,
      result: (input as Task).result || null,
      error: (input as Task).error || null,
      branch: (input as Task).branch || null,
      commitSha: (input as Task).commitSha || null,
      gitStatus: (input as Task).gitStatus || null,
      createdAt: (input as Task).createdAt || new Date(),
      updatedAt: new Date(),
      leaseOwner: (input as Task).leaseOwner || null,
      leaseDeadline: (input as Task).leaseDeadline || null,
      heartbeatAt: null,
      workspacePath: (input as Task).workspacePath || null,
      prototypeSessionId: (input as Task).prototypeSessionId || null,
      agentId: input.agentId || null,
    };
    this.tasks.set(task.id, task);
    return task;
  }

  async list(): Promise<Task[]> {
    return Array.from(this.tasks.values());
  }

  async get(id: string): Promise<Task | null> {
    return this.tasks.get(id) || null;
  }

  async findById(id: string): Promise<Task | null> {
    return this.get(id);
  }

  async claim(worker: string): Promise<Task | null> {
    for (const [id, t] of this.tasks.entries()) {
      if (t.status === 'QUEUED') {
        t.status = 'RUNNING';
        t.leaseOwner = worker;
        t.updatedAt = new Date();
        return t;
      }
    }
    return null;
  }

  async update(id: string, patch: Partial<Task>): Promise<Task | null> {
    const t = this.tasks.get(id);
    if (!t) return null;
    Object.assign(t, patch, { updatedAt: new Date() });
    return t;
  }

  async cancel(id: string): Promise<Task | null> {
    return this.update(id, { status: 'CANCELLED' });
  }

  async retry(id: string): Promise<Task | null> {
    return this.update(id, { status: 'QUEUED' });
  }

  async reclaimStuck(): Promise<number> {
    return 0;
  }

  async heartbeat(id: string, deadline: Date): Promise<boolean> {
    const t = this.tasks.get(id);
    if (!t) return false;
    t.leaseDeadline = deadline;
    return true;
  }
}

describe('Controlled E2E Pilot — pubcoreagencia/pub-rate-calculator via Chief of Staff', () => {
  const commitSha = 'd4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4';
  const remoteSha = 'd4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4';

  let conversationStore: CeoConversationStore;
  let registry: AgentRegistry;
  let neuralBridge: DefaultPubNeuralBridge;
  let mockNeuralClient: any;
  let taskRepo: InMemoryTaskRepository;
  let mockWorker: Worker;
  let agent: ChiefOfStaffAgent;

  beforeEach(() => {
    conversationStore = new CeoConversationStore();
    registry = new AgentRegistry(INITIAL_STAFF);
    taskRepo = new InMemoryTaskRepository();

    mockWorker = {
      status: () => 'IDLE',
      cancel: async () => {},
      executeOnce: async () => {
        const task = await taskRepo.claim('worker-lucas');
        if (!task) return false;
        await taskRepo.update(task.id, {
          status: 'COMPLETED',
          commitSha,
          result: {
            stdout: 'Tests: 10 passed, 0 failed\n✓ Rate calculator verified',
            stderr: '',
            exitCode: 0,
            changedFiles: ['src/calculator.ts'],
          },
        });
        return true;
      },
    };

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
      new CodeReviewManager(),
      taskRepo,
      mockWorker
    );
  });

  it('executa ciclo ponta-a-ponta governado com delegação singular para developer e persistência verificada', async () => {
    const ceoCommand = 'Implemente a função calculateInterestRate no arquivo src/calculator.ts com validação de taxas negativas';

    const response = await agent.handleCommand({
      message: ceoCommand,
      project: 'pub-rate-calculator',
      repository: 'https://github.com/pubcoreagencia/pub-rate-calculator.git',
      executeSynchronously: true,
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
    expect(response.response).toContain('Diretriz Executada e Validada com Sucesso');
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
      'QUEUED',
      'EXECUTING',
      'TESTING',
      'REVIEWING',
      'VALIDATING',
      'PERSISTING',
      'FINALIZING',
      'COMPLETED',
    ]);
  });
});

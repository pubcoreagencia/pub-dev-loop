import { describe, it, expect, beforeEach } from 'vitest';
import { ChiefOfStaffAgent } from '../../src/office/chief-of-staff-agent.js';
import { CeoConversationStore } from '../../src/office/ceo-conversation-store.js';
import { AgentRegistry, INITIAL_STAFF } from '../../src/office/registry.js';
import { DefaultPubNeuralBridge } from '../../src/pdl/neural/neural-bridge.js';
import { CodeReviewManager } from '../../src/office/review.js';
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

class MockExecutionWorker implements Worker {
  public lastExecutedTask: Task | null = null;

  constructor(
    private readonly repo: InMemoryTaskRepository,
    private readonly behavior: 'SUCCESS' | 'TEST_FAILURE' | 'CRASH' = 'SUCCESS'
  ) {}

  status(): string {
    return 'IDLE';
  }

  async cancel(): Promise<void> {}

  async executeOnce(): Promise<boolean> {
    const task = await this.repo.claim('mock-worker');
    if (!task) return false;

    if (this.behavior === 'SUCCESS') {
      const updated = await this.repo.update(task.id, {
        status: 'COMPLETED',
        commitSha: 'a1b2c3d4e5f6',
        result: {
          stdout: 'Tests: 12 passed, 0 failed\n✓ All test suites passed',
          stderr: '',
          exitCode: 0,
          changedFiles: ['src/feature.ts'],
        },
      });
      this.lastExecutedTask = updated;
      return true;
    } else if (this.behavior === 'TEST_FAILURE') {
      const updated = await this.repo.update(task.id, {
        status: 'COMPLETED',
        result: {
          stdout: 'Tests: 8 passed, 2 failed\nTests:       failed',
          stderr: 'FAIL: tests/feature.test.ts',
          exitCode: 1,
          changedFiles: ['src/feature.ts'],
        },
      });
      this.lastExecutedTask = updated;
      return true;
    } else {
      const updated = await this.repo.update(task.id, {
        status: 'FAILED',
        error: 'Fatal worker crash: Out of memory',
        result: { stdout: '', stderr: 'Fatal worker crash: Out of memory', exitCode: 137 },
      });
      this.lastExecutedTask = updated;
      return false;
    }
  }
}

describe('AUDITORIA DE REALIDADE — CEO Command & Chief of Staff (CEO_REALITY_01 to 10)', () => {
  let conversationStore: CeoConversationStore;
  let registry: AgentRegistry;
  let neuralBridge: DefaultPubNeuralBridge;
  let reviewManager: CodeReviewManager;
  let taskRepo: InMemoryTaskRepository;

  beforeEach(() => {
    conversationStore = new CeoConversationStore();
    registry = new AgentRegistry(INITIAL_STAFF);
    neuralBridge = new DefaultPubNeuralBridge();
    reviewManager = new CodeReviewManager();
    taskRepo = new InMemoryTaskRepository();
  });

  // CEO_REALITY_01: Enqueued task MUST NOT emit fake completion or unearned lifecycle events
  it('CEO_REALITY_01: Enqueued task without worker MUST NOT emit EXECUTING, REVIEWING, VALIDATING, FINALIZING, or COMPLETED', async () => {
    const agent = new ChiefOfStaffAgent(conversationStore, registry, neuralBridge, reviewManager, taskRepo);

    const res = await agent.handleCommand({
      message: 'Adicione um validador de CPF no módulo de checkout',
      project: 'pub-rate-calculator',
    });

    const eventTypes = res.events.map((e) => e.type);

    // Forbidden unearned lifecycle events
    expect(eventTypes).not.toContain('EXECUTING');
    expect(eventTypes).not.toContain('TESTING');
    expect(eventTypes).not.toContain('REVIEWING');
    expect(eventTypes).not.toContain('VALIDATING');
    expect(eventTypes).not.toContain('PERSISTING');
    expect(eventTypes).not.toContain('FINALIZING');
    expect(eventTypes).not.toContain('COMPLETED');
  });

  // CEO_REALITY_02: Enqueued task must report status QUEUED and events halt strictly at QUEUED
  it('CEO_REALITY_02: Enqueued task reports status QUEUED and halts event stream at QUEUED', async () => {
    const agent = new ChiefOfStaffAgent(conversationStore, registry, neuralBridge, reviewManager, taskRepo);

    const res = await agent.handleCommand({
      message: 'Refatore o módulo de autenticação para JWT v2',
      project: 'pub-dev-loop',
    });

    expect(res.task).toBeDefined();
    expect(res.task?.status).toBe('QUEUED');

    const eventTypes = res.events.map((e) => e.type);
    expect(eventTypes).toEqual(['RECEIVED', 'ANALYZING', 'CONTEXT_RESOLVED', 'PLANNING', 'DELEGATING', 'QUEUED']);

    // Response explicitly declares QUEUED
    expect(res.response).toContain('QUEUED');
    expect(res.response).toContain('Aguardando execução pelo worker do PDL');
  });

  // CEO_REALITY_03: CodeReviewManager with no empirical evidence returns BLOCKED (INSUFFICIENT_EVIDENCE)
  it('CEO_REALITY_03: CodeReviewManager without test/build/diff evidence returns BLOCKED (INSUFFICIENT_EVIDENCE)', () => {
    const review = reviewManager.evaluateReview({
      taskId: 'task-no-evidence',
      developerAgentId: 'developer',
      reviewerAgentId: 'reviewer',
      // Zero testPassed, zero buildPassed, zero diff, zero changedFiles
    });

    expect(review.status).toBe('BLOCKED');
    expect(review.findings.some((f) => f.ruleId === 'INSUFFICIENT_EVIDENCE')).toBe(true);
    expect(review.summary).toContain('INSUFFICIENT_EVIDENCE');
  });

  // CEO_REALITY_04: CodeReviewManager with failed tests returns CHANGES_REQUESTED or BLOCKED
  it('CEO_REALITY_04: CodeReviewManager rejects code with failing tests', () => {
    const review1 = reviewManager.evaluateReview({
      taskId: 'task-failing-tests',
      developerAgentId: 'developer',
      reviewerAgentId: 'reviewer',
      testPassed: false,
    });

    expect(review1.status).toBe('CHANGES_REQUESTED');
    expect(review1.findings.some((f) => f.ruleId === 'TEST_SUITE_FAILURE')).toBe(true);
  });

  // CEO_REALITY_05: Capability-based delegation matches declared capabilities in AgentRegistry
  it('CEO_REALITY_05: Capability-based delegation dynamically matches declared AgentRegistry capabilities', async () => {
    const agent = new ChiefOfStaffAgent(conversationStore, registry, neuralBridge, reviewManager, taskRepo);

    // 1. 3D / Pinscher -> image-designer (Maya Lin: 3d_modeling, mesh_optimization)
    const res3d = await agent.handleCommand({
      message: 'Modelar e renderizar malha 3D e arquivo STL para pinscher',
      project: 'pub-dev-loop',
    });
    expect(res3d.assignedSpecialist?.id).toBe('image-designer');

    // 2. Video / Drone -> video-editor (Cauã Martins: video_editing, drone_cinematography)
    const resVideo = await agent.handleCommand({
      message: 'Editar tomadas de drone em 4K e produzir showreel vertical',
      project: 'pub-dev-loop',
    });
    expect(resVideo.assignedSpecialist?.id).toBe('video-editor');

    // 3. Audio / Masterização -> sound-engineer (Gabriel Costa: music_production, sound_design)
    const resAudio = await agent.handleCommand({
      message: 'Masterizar beat e sintetizar vinheta com conformidade LUFS',
      project: 'pub-dev-loop',
    });
    expect(resAudio.assignedSpecialist?.id).toBe('sound-engineer');

    // 4. Architecture -> architect (Helena Rostova: system_design, api_design)
    const resArch = await agent.handleCommand({
      message: 'Definir arquitetura e contrato de API para limites entre módulos',
      project: 'pub-dev-loop',
    });
    expect(resArch.assignedSpecialist?.id).toBe('architect');

    // 5. Security audit -> reviewer (Beatriz Mendes: code_review, security_audit)
    const resSec = await agent.handleCommand({
      message: 'Auditoria de segurança e revisão de vulnerabilidades OWASP no gateway',
      project: 'pub-dev-loop',
    });
    expect(resSec.assignedSpecialist?.id).toBe('reviewer');

    // 6. Test suite -> qa-engineer (Tiago Rocha: test_automation, quality_validation)
    const resQA = await agent.handleCommand({
      message: 'Escrever suíte de testes unitários no Vitest cobrindo cenários de borda',
      project: 'pub-dev-loop',
    });
    expect(resQA.assignedSpecialist?.id).toBe('qa-engineer');

    // 7. General code implementation -> developer (Lucas Silveira: code_implementation, debugging)
    const resDev = await agent.handleCommand({
      message: 'Implementar a função de formatação de moeda em src/currency.ts',
      project: 'pub-dev-loop',
    });
    expect(resDev.assignedSpecialist?.id).toBe('developer');
  });

  // CEO_REALITY_06: Neural bridge without endpoint returns UNAVAILABLE without claiming persistence
  it('CEO_REALITY_06: Neural bridge without configured endpoint returns UNAVAILABLE', async () => {
    const client = neuralBridge.getClient();
    const available = await client.isAvailable();
    expect(available).toBe(false);

    const submission = await client.submit({
      taskId: 'task-test-neural-unavailable',
      projectId: 'pub-rate-calculator',
      repository: 'https://github.com/pubcoreagencia/pub-rate-calculator.git',
      branch: 'feat/test',
      commitSha: '1234567890abcdef',
      remoteSha: '1234567890abcdef',
      status: 'COMPLETED',
      objective: 'Verificar status do neural',
      agentId: 'developer',
      evidence: { validationPassed: true, worktreeClean: true, remoteVerified: true, pushSucceeded: true },
      completedAt: new Date().toISOString(),
      ingestionSource: 'test',
    });

    expect(submission.status).toBe('UNAVAILABLE');
    expect(submission.error).toContain('PUB_NEURAL_ENDPOINT');
  });

  // CEO_REALITY_07: Ambiguous command triggers CLARIFICATION_REQUESTED and zero tasks are created
  it('CEO_REALITY_07: Ambiguous command requests clarification and creates zero tasks', async () => {
    const agent = new ChiefOfStaffAgent(conversationStore, registry, neuralBridge, reviewManager, taskRepo);

    const res = await agent.handleCommand({
      message: 'arrume isso',
      project: 'pub-dev-loop',
    });

    expect(res.type).toBe('CLARIFICATION');
    expect(res.task).toBeUndefined();
    expect(taskRepo.tasks.size).toBe(0);
    expect(res.response).toContain('Esclarecimento Operacional Necessário');
  });

  // CEO_REALITY_08: Status inquiries return factual Git state without task creation
  it('CEO_REALITY_08: Status inquiries return factual Git state without creating tasks', async () => {
    const agent = new ChiefOfStaffAgent(conversationStore, registry, neuralBridge, reviewManager, taskRepo);

    const res = await agent.handleCommand({
      message: 'Qual é o status atual do git no projeto?',
      project: 'pub-rate-calculator',
    });

    expect(res.type).toBe('INQUIRY');
    expect(res.task).toBeUndefined();
    expect(taskRepo.tasks.size).toBe(0);
    expect(res.gitState).toBeDefined();
    expect(res.gitState?.branch).toBeDefined();
    expect(res.gitState?.headSha).toBeDefined();
  });

  // CEO_REALITY_09: Multi-turn session memory preserves conversation messages
  it('CEO_REALITY_09: Multi-turn session memory preserves messages across turns', async () => {
    const convId = 'session-reality-audit-09';
    const agent = new ChiefOfStaffAgent(conversationStore, registry, neuralBridge, reviewManager, taskRepo);

    await agent.handleCommand({
      conversationId: convId,
      message: 'Como está o repositório?',
      project: 'pub-rate-calculator',
    });

    await agent.handleCommand({
      conversationId: convId,
      message: 'Crie uma função utilitária para arredondamento de casas decimais',
      project: 'pub-rate-calculator',
    });

    const session = conversationStore.getSession(convId);
    expect(session).toBeDefined();
    expect(session?.messages.length).toBe(4);
    expect(session?.messages[0].sender).toBe('CEO');
    expect(session?.messages[1].sender).toBe('CHIEF_OF_STAFF');
    expect(session?.messages[2].sender).toBe('CEO');
    expect(session?.messages[3].sender).toBe('CHIEF_OF_STAFF');
  });

  // CEO_REALITY_10: True E2E execution with attached real worker
  it('CEO_REALITY_10: True E2E execution transitions through genuine lifecycle based on actual worker output', async () => {
    // 1. Worker succeeds with passing tests
    const successWorker = new MockExecutionWorker(taskRepo, 'SUCCESS');
    const successAgent = new ChiefOfStaffAgent(
      conversationStore,
      registry,
      neuralBridge,
      reviewManager,
      taskRepo,
      successWorker
    );

    const successRes = await successAgent.handleCommand({
      message: 'Implemente o cálculo de spread no arquivo src/calculator.ts',
      project: 'pub-rate-calculator',
      executeSynchronously: true,
    });

    expect(successRes.task?.status).toBe('COMPLETED');
    expect(successRes.review?.status).toBe('APPROVED');

    const successEvents = successRes.events.map((e) => e.type);
    expect(successEvents).toContain('QUEUED');
    expect(successEvents).toContain('EXECUTING');
    expect(successEvents).toContain('TESTING');
    expect(successEvents).toContain('REVIEWING');
    expect(successEvents).toContain('VALIDATING');
    expect(successEvents).toContain('PERSISTING');
    expect(successEvents).toContain('COMPLETED');

    // 2. Worker completes with failing tests -> Review rejects and halts
    const failingWorker = new MockExecutionWorker(taskRepo, 'TEST_FAILURE');
    const failingAgent = new ChiefOfStaffAgent(
      conversationStore,
      registry,
      neuralBridge,
      reviewManager,
      taskRepo,
      failingWorker
    );

    const failingRes = await failingAgent.handleCommand({
      message: 'Aplique o patch que quebra os testes unitários',
      project: 'pub-rate-calculator',
      executeSynchronously: true,
    });

    expect(failingRes.task?.status).toBe('BLOCKED');
    expect(failingRes.review?.status).toBe('CHANGES_REQUESTED');
    const failingEvents = failingRes.events.map((e) => e.type);
    expect(failingEvents).toContain('EXECUTING');
    expect(failingEvents).toContain('REVIEWING');
    expect(failingEvents).toContain('FAILED');
    expect(failingEvents).not.toContain('COMPLETED');

    // 3. Worker crashes -> Marked FAILED
    const crashingWorker = new MockExecutionWorker(taskRepo, 'CRASH');
    const crashAgent = new ChiefOfStaffAgent(
      conversationStore,
      registry,
      neuralBridge,
      reviewManager,
      taskRepo,
      crashingWorker
    );

    const crashRes = await crashAgent.handleCommand({
      message: 'Processe carga que causa estouro de memória',
      project: 'pub-rate-calculator',
      executeSynchronously: true,
    });

    expect(crashRes.task?.status).toBe('FAILED');
    const crashEvents = crashRes.events.map((e) => e.type);
    expect(crashEvents).toContain('FAILED');
    expect(crashEvents).not.toContain('COMPLETED');
  });
});


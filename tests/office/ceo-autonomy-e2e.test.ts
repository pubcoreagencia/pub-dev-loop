import { describe, it, expect, beforeEach, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { Task, TaskRepository } from '../../src/domain.js';
import { ChiefOfStaffAgent } from '../../src/office/chief-of-staff-agent.js';
import { CeoConversationStore } from '../../src/office/ceo-conversation-store.js';
import { AgentRegistry, INITIAL_STAFF } from '../../src/office/registry.js';
import { CodeReviewManager } from '../../src/office/review.js';
import { DefaultPubNeuralBridge } from '../../src/pdl/neural/neural-bridge.js';
import { PdlCorrectionWorker } from '../../src/pdl/worker/correction-worker.js';
import {
  type ExecutionSpecDatabase,
  type ExecutionSpecStore,
  type ExecutionSpecRecord,
  createExecutionSpec,
  sealExecutionSpec,
  loadExecutionSpec,
  computeSpecHash,
} from '../../src/execution/execution-spec-persistence.js';
import { TaskIntakeService } from '../../src/pdl/service/task-intake-service.js';
import { DefaultFinalizationBridge } from '../../src/execution/finalization-bridge.js';
import { defaultRemotePersistence } from '../../src/pdl/persistence/remote-persistence.js';
import type { AgentProvider, ProviderTaskInput, ProviderTaskResult } from '../../src/providers/types.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

class InMemoryTaskRepository implements TaskRepository {
  public readonly tasks = new Map<string, Task>();

  async create(input: any): Promise<Task> {
    const id = input.id || randomUUID();
    const task: Task = {
      id,
      project: input.project,
      repository: input.repository,
      objective: input.objective || input.prompt,
      prompt: input.prompt || input.objective,
      status: input.status || 'QUEUED',
      priority: input.priority ?? 1,
      worker: input.worker || null,
      result: input.result || null,
      error: input.error || null,
      branch: input.branch || null,
      commitSha: input.commitSha || null,
      gitStatus: input.gitStatus || null,
      createdAt: new Date(),
      updatedAt: new Date(),
      leaseOwner: null,
      leaseDeadline: null,
      heartbeatAt: null,
      workspacePath: null,
      prototypeSessionId: input.prototypeSessionId || null,
      agentId: input.agentId || null,
    };
    this.tasks.set(id, task);
    return task;
  }

  async get(id: string): Promise<Task | null> {
    return this.tasks.get(id) || null;
  }

  async findById(id: string): Promise<Task | null> {
    return this.tasks.get(id) || null;
  }

  async list(): Promise<Task[]> {
    return Array.from(this.tasks.values());
  }

  async claim(worker: string): Promise<Task | null> {
    for (const task of this.tasks.values()) {
      if (task.status === 'QUEUED') {
        task.status = 'ASSIGNED';
        task.worker = worker;
        task.leaseOwner = worker;
        task.leaseDeadline = new Date(Date.now() + 30000);
        task.updatedAt = new Date();
        return task;
      }
    }
    return null;
  }

  async update(id: string, patch: Partial<Task>): Promise<Task | null> {
    const task = this.tasks.get(id);
    if (!task) return null;
    Object.assign(task, patch, { updatedAt: new Date() });
    return task;
  }

  async cancel(id: string): Promise<Task | null> {
    return this.update(id, { status: 'CANCELLED' });
  }

  async retry(id: string): Promise<Task | null> {
    return this.update(id, { status: 'QUEUED', retryCount: ((this.tasks.get(id)?.retryCount || 0) + 1) });
  }

  async reclaimStuck(): Promise<number> {
    return 0;
  }

  async heartbeat(id: string, deadline: Date): Promise<boolean> {
    const task = this.tasks.get(id);
    if (task) {
      task.leaseDeadline = deadline;
      task.heartbeatAt = new Date();
      return true;
    }
    return false;
  }
}

class InMemoryExecutionSpecStore implements ExecutionSpecStore {
  public readonly specs = new Map<string, ExecutionSpecRecord>();

  async create(record: ExecutionSpecRecord): Promise<ExecutionSpecRecord> {
    this.specs.set(record.task_id, record);
    return record;
  }

  async loadByTaskId(taskId: string): Promise<ExecutionSpecRecord | null> {
    return this.specs.get(taskId) || null;
  }

  async updateStatus(
    idOrTaskId: string,
    status: any,
    sealedAt?: string,
    specHash?: string,
    specContentJson?: string
  ): Promise<ExecutionSpecRecord> {
    let target = this.specs.get(idOrTaskId);
    if (!target) {
      for (const rec of this.specs.values()) {
        if (rec.id === idOrTaskId) {
          target = rec;
          break;
        }
      }
    }
    if (!target) throw new Error(`ExecutionSpec not found for ${idOrTaskId}`);

    target.status = status;
    if (sealedAt) target.sealed_at = sealedAt;
    if (specHash) target.spec_hash = specHash;
    if (specContentJson) target.spec_content_json = specContentJson;
    return target;
  }
}

function createMockProvider(executeFn?: (input: ProviderTaskInput, wsPath: string) => Promise<ProviderTaskResult>): AgentProvider {
  return {
    kind: 'mock',
    model: 'mock-free-model',
    health: async () => ({ available: true, details: 'ok' }),
    capabilities: () => ['code', 'tests'],
    metadata: () => ({ pricing: { promptPrice: 0, completionPrice: 0 } }),
    execute: executeFn || (async (_input, _wsPath) => ({
      status: 'COMPLETED',
      provider: 'mock',
      model: 'mock-free-model',
      exitCode: 0,
      stdout: 'PASS src/checkout.test.ts\nTests: 1 passed, 1 total',
      stderr: '',
      toolCalls: 1,
      toolRounds: 1,
      durationMs: 50,
      declaredChangedFiles: ['src/checkout.ts'],
    })),
  };
}

describe('E2E AUTONOMOUS EXECUTION LOOP: CEO → CHIEF OF STAFF → WORKER → PERSISTENCE → CEO', () => {
  let conversationStore: CeoConversationStore;
  let registry: AgentRegistry;
  let reviewManager: CodeReviewManager;
  let neuralBridge: DefaultPubNeuralBridge;
  let taskRepo: InMemoryTaskRepository;
  let specDb: InMemoryExecutionSpecStore;

  beforeEach(() => {
    vi.restoreAllMocks();
    conversationStore = new CeoConversationStore();
    registry = new AgentRegistry(INITIAL_STAFF);
    reviewManager = new CodeReviewManager();
    neuralBridge = new DefaultPubNeuralBridge();
    taskRepo = new InMemoryTaskRepository();
    specDb = new InMemoryExecutionSpecStore();
  });

  // =========================================================================
  // 1. HAPPY PATH: Full End-to-End Autonomous Cycle
  // =========================================================================
  it('FULL LOOP: CEO command -> UUID task -> SEALED spec -> worker claim -> tests -> review -> persistence gate -> Neural -> COMPLETED -> CEO message', async () => {
    const chiefOfStaff = new ChiefOfStaffAgent(
      conversationStore,
      registry,
      neuralBridge,
      reviewManager,
      taskRepo,
      undefined,
      specDb
    );

    // Step 1: CEO sends command
    const ceoCommandRes = await chiefOfStaff.handleCommand({
      message: 'Implemente o cálculo de alíquota ICMS com testes unitários',
      project: 'pub-rate-calculator',
      conversationId: 'ceo-session-alpha',
    });

    // Verify CEO Command Output
    expect(ceoCommandRes.type).toBe('ACTION');
    expect(ceoCommandRes.task).toBeDefined();
    expect(ceoCommandRes.task?.status).toBe('QUEUED');
    expect(ceoCommandRes.task?.id).toMatch(UUID_REGEX);
    expect(ceoCommandRes.assignedSpecialist?.id).toBe('developer');

    // Verify Persistence in Task Repository
    const createdTask = await taskRepo.get(ceoCommandRes.task!.id);
    expect(createdTask).toBeDefined();
    expect(createdTask!.status).toBe('QUEUED');
    expect(createdTask!.id).toMatch(UUID_REGEX);

    // Verify ExecutionSpec was sealed in Spec DB
    const persistedSpec = await specDb.loadByTaskId(createdTask!.id);
    expect(persistedSpec).toBeDefined();
    expect(persistedSpec!.status).toBe('SEALED');
    expect(persistedSpec!.spec_hash).toBeDefined();
    expect(persistedSpec!.spec_hash.length).toBeGreaterThan(0);

    // Verify CeoConversationStore link
    const sessionBeforeWorker = conversationStore.getSession('ceo-session-alpha');
    expect(sessionBeforeWorker).toBeDefined();
    expect(sessionBeforeWorker!.activeTaskId).toBe(createdTask!.id);
    expect(sessionBeforeWorker!.events.map((e) => e.type)).toEqual([
      'RECEIVED',
      'ANALYZING',
      'CONTEXT_RESOLVED',
      'PLANNING',
      'DELEGATING',
      'QUEUED',
    ]);

    // Step 2: Autonomous Worker picks up the task
    const mockProvider = createMockProvider();
    const worker = new PdlCorrectionWorker(
      taskRepo,
      mockProvider,
      'pdl-router',
      undefined,
      specDb,
      undefined,
      undefined,
      undefined,
      neuralBridge,
      reviewManager,
      conversationStore
    );

    // Mock bridge finalizer to simulate real test run with commit
    vi.spyOn(DefaultFinalizationBridge.prototype, 'finalize').mockResolvedValue({
      execution: {} as any,
      finalization: {
        status: 'COMPLETED',
        commitSha: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
        commitMessage: 'feat(tax): implement ICMS rate calculator',
        changedFiles: ['src/tax/icms.ts', 'tests/tax/icms.test.ts'],
        gitStatus: 'clean',
        testsPassed: true,
        testOutput: 'PASS tests/tax/icms.test.ts\n2 passed, 0 failed',
      },
      specIdentity: { specVersion: '1.0.0', intakeHash: 'intake-123' },
    });

    // Mock remote persistence to return verified SHA matching local commit
    vi.spyOn(defaultRemotePersistence, 'persist').mockResolvedValue({
      status: 'VERIFIED',
      repository: 'https://github.com/pubcoreagencia/pub-rate-calculator.git',
      branch: 'worker/pdl-router/' + createdTask!.id,
      pushAttempted: true,
      pushSucceeded: true,
      localSha: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
      remoteSha: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
      remoteVerified: true,
    });

    // Execute one autonomous tick
    const ran = await worker.executeOnce();
    expect(ran).toBe(true);

    // Step 3: Verify Task State in Repository is genuinely COMPLETED
    const completedTask = await taskRepo.get(createdTask!.id);
    expect(completedTask!.status).toBe('COMPLETED');
    expect(completedTask!.commitSha).toBe('a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2');
    expect(completedTask!.gitStatus).toBe('clean');

    // Verify Result details: Review passed, Persistence Gate passed, Remote Persistence verified
    const resultJson = completedTask!.result as any;
    expect(resultJson).toBeDefined();
    expect(resultJson.finalize.testsPassed).toBe(true);
    expect(resultJson.review.status).toBe('APPROVED');
    expect(resultJson.persistenceGate.passed).toBe(true);
    expect(resultJson.persistenceGate.code).toBe('PERSISTENCE_GATE_PASSED');
    expect(resultJson.remotePersistence.status).toBe('VERIFIED');

    // Step 4: Verify CEO Conversation received the complete autonomous stream
    const sessionAfterWorker = conversationStore.getSession('ceo-session-alpha');
    const eventTypes = sessionAfterWorker!.events.map((e) => e.type);

    expect(eventTypes).toContain('EXECUTING');
    expect(eventTypes).toContain('TESTING');
    expect(eventTypes).toContain('REVIEWING');
    expect(eventTypes).toContain('PERSISTING');
    expect(eventTypes).toContain('FINALIZING');
    expect(eventTypes).toContain('COMPLETED');

    // Verify CEO Conversation received final message from Chief of Staff
    const lastMessage = sessionAfterWorker!.messages[sessionAfterWorker!.messages.length - 1];
    expect(lastMessage.sender).toBe('CHIEF_OF_STAFF');
    expect(lastMessage.content).toContain('Missão Concluída com Sucesso');
    expect(lastMessage.content).toContain('a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2');
    expect(lastMessage.metadata?.status).toBe('COMPLETED');
  });

  // =========================================================================
  // SCENARIO A: Worker absent/not run -> Task remains strictly QUEUED
  // =========================================================================
  it('SCENARIO A: When worker does not execute, task remains strictly QUEUED without fake progress', async () => {
    const chiefOfStaff = new ChiefOfStaffAgent(
      conversationStore,
      registry,
      neuralBridge,
      reviewManager,
      taskRepo,
      undefined,
      specDb
    );

    const res = await chiefOfStaff.handleCommand({
      message: 'Crie endpoint de webhooks de pagamento',
      project: 'pub-dev-loop',
      conversationId: 'session-idle',
    });

    expect(res.task?.status).toBe('QUEUED');

    // Check task in repo
    const task = await taskRepo.get(res.task!.id);
    expect(task?.status).toBe('QUEUED');

    // Check session events: halts at QUEUED
    const session = conversationStore.getSession('session-idle');
    const eventTypes = session!.events.map((e) => e.type);
    expect(eventTypes).toEqual(['RECEIVED', 'ANALYZING', 'CONTEXT_RESOLVED', 'PLANNING', 'DELEGATING', 'QUEUED']);
    expect(eventTypes).not.toContain('EXECUTING');
    expect(eventTypes).not.toContain('COMPLETED');
  });

  // =========================================================================
  // SCENARIO B: Execution with failing tests -> Cannot become COMPLETED
  // =========================================================================
  it('SCENARIO B: When automated tests fail, task must terminate in FAILED, never COMPLETED', async () => {
    const chiefOfStaff = new ChiefOfStaffAgent(
      conversationStore,
      registry,
      neuralBridge,
      reviewManager,
      taskRepo,
      undefined,
      specDb
    );

    const res = await chiefOfStaff.handleCommand({
      message: 'Altere lógica de cálculo fiscal',
      project: 'pub-rate-calculator',
      conversationId: 'session-test-fail',
    });

    const mockProvider = createMockProvider();
    const worker = new PdlCorrectionWorker(
      taskRepo,
      mockProvider,
      'pdl-router',
      undefined,
      specDb,
      undefined,
      undefined,
      undefined,
      neuralBridge,
      reviewManager,
      conversationStore
    );

    // Simulate failing tests during finalization
    vi.spyOn(DefaultFinalizationBridge.prototype, 'finalize').mockResolvedValue({
      execution: {} as any,
      finalization: {
        status: 'FAILED',
        commitSha: null,
        changedFiles: ['src/tax.ts'],
        gitStatus: 'dirty',
        testsPassed: false,
        testOutput: 'FAIL tests/tax.test.ts: Expected 10 but received 0',
        errorCode: 'TEST_SUITE_FAILURE',
        errorMessage: 'Test suite failed',
      },
      specIdentity: { specVersion: '1.0.0', intakeHash: 'intake-123' },
    });

    // Also mock TaskFinalizer so the correction loop continues to fail
    const { TaskFinalizer } = await import('../../src/finalizer');
    vi.spyOn(TaskFinalizer.prototype, 'finalize').mockResolvedValue({
      status: 'FAILED',
      commitSha: null,
      commitMessage: null,
      changedFiles: ['src/tax.ts'],
      gitStatus: 'dirty',
      testsPassed: false,
      testOutput: 'FAIL tests/tax.test.ts: Expected 10 but received 0',
      errorCode: 'TEST_SUITE_FAILURE',
      errorMessage: 'Test suite failed',
    });

    const ran = await worker.executeOnce();
    expect(ran).toBe(true);

    // Verify task failed
    const task = await taskRepo.get(res.task!.id);
    expect(task?.status).toBe('FAILED');
    expect(task?.error).toContain('Test suite failed');

    // Verify CEO Conversation received FAILED
    const session = conversationStore.getSession('session-test-fail');
    const lastEvent = session!.events[session!.events.length - 1];
    expect(lastEvent.type).toBe('FAILED');

    const lastMsg = session!.messages[session!.messages.length - 1];
    expect(lastMsg.content).toContain('Execução Interrompida');
  });

  // =========================================================================
  // SCENARIO C: Review BLOCKED -> Push blocked, task must not become COMPLETED
  // =========================================================================
  it('SCENARIO C: When CodeReview blocks the delivery, remote push is aborted and task terminates in FAILED', async () => {
    const chiefOfStaff = new ChiefOfStaffAgent(
      conversationStore,
      registry,
      neuralBridge,
      reviewManager,
      taskRepo,
      undefined,
      specDb
    );

    const res = await chiefOfStaff.handleCommand({
      message: 'Remova validações críticas de segurança',
      project: 'pub-rate-calculator',
      conversationId: 'session-review-block',
    });

    const mockProvider = createMockProvider();
    const worker = new PdlCorrectionWorker(
      taskRepo,
      mockProvider,
      'pdl-router',
      undefined,
      specDb,
      undefined,
      undefined,
      undefined,
      neuralBridge,
      reviewManager,
      conversationStore
    );

    vi.spyOn(DefaultFinalizationBridge.prototype, 'finalize').mockResolvedValue({
      execution: {} as any,
      finalization: {
        status: 'COMPLETED',
        commitSha: 'f1e2d3c4b5a6f1e2d3c4b5a6f1e2d3c4b5a6f1e2',
        changedFiles: ['src/security.ts'],
        gitStatus: 'clean',
        testsPassed: true,
        testOutput: 'PASS tests/security.test.ts',
      },
      specIdentity: { specVersion: '1.0.0', intakeHash: 'intake-123' },
    });

    // Mock CodeReviewManager to reject
    vi.spyOn(reviewManager, 'evaluateReview').mockReturnValue({
      reviewId: 'rev-blocked',
      taskId: res.task!.id,
      status: 'BLOCKED',
      iteration: 1,
      findings: [{ ruleId: 'SECURITY_AUDIT_FAILURE', severity: 'ERROR', message: 'Security validation removal rejected' }],
      summary: 'Revisão BLOQUEADA: Remoção de validação de segurança não permitida.',
    });

    const persistSpy = vi.spyOn(defaultRemotePersistence, 'persist');

    await worker.executeOnce();

    // Verify remote persistence was NEVER called
    expect(persistSpy).not.toHaveBeenCalled();

    // Verify task failed
    const task = await taskRepo.get(res.task!.id);
    expect(task?.status).toBe('FAILED');
    expect(task?.error).toContain('Code review rejected (BLOCKED)');

    // Verify CEO Conversation event
    const session = conversationStore.getSession('session-review-block');
    expect(session!.events.some((e) => e.type === 'FAILED')).toBe(true);
  });

  // =========================================================================
  // SCENARIO D: Persistence Gate fails -> Task cannot become COMPLETED
  // =========================================================================
  it('SCENARIO D: When Persistence Gate detects SHA mismatch or dirty worktree, completion is denied', async () => {
    const chiefOfStaff = new ChiefOfStaffAgent(
      conversationStore,
      registry,
      neuralBridge,
      reviewManager,
      taskRepo,
      undefined,
      specDb
    );

    const res = await chiefOfStaff.handleCommand({
      message: 'Adicione logger de auditoria',
      project: 'pub-rate-calculator',
      conversationId: 'session-gate-fail',
    });

    const mockProvider = createMockProvider();
    const worker = new PdlCorrectionWorker(
      taskRepo,
      mockProvider,
      'pdl-router',
      undefined,
      specDb,
      undefined,
      undefined,
      undefined,
      neuralBridge,
      reviewManager,
      conversationStore
    );

    vi.spyOn(DefaultFinalizationBridge.prototype, 'finalize').mockResolvedValue({
      execution: {} as any,
      finalization: {
        status: 'COMPLETED',
        commitSha: 'a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1',
        changedFiles: ['src/audit.ts'],
        gitStatus: 'clean',
        testsPassed: true,
        testOutput: 'PASS',
      },
      specIdentity: { specVersion: '1.0.0', intakeHash: 'intake-123' },
    });

    // Remote persistence returns different remote SHA (SHA mismatch)
    vi.spyOn(defaultRemotePersistence, 'persist').mockResolvedValue({
      status: 'VERIFIED',
      repository: 'https://github.com/pubcoreagencia/pub-rate-calculator.git',
      branch: 'worker/test',
      pushAttempted: true,
      pushSucceeded: true,
      localSha: 'a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1',
      remoteSha: 'b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2', // Mismatch!
      remoteVerified: true,
    });

    await worker.executeOnce();

    const task = await taskRepo.get(res.task!.id);
    expect(task?.status).toBe('FAILED');
    expect(task?.error).toContain('Persistence Gate denied completion');
  });

  // =========================================================================
  // SCENARIO E: Neural Unavailable -> Reported factually without hallucination
  // =========================================================================
  it('SCENARIO E: When PUB Neural endpoint is unavailable, neuralStatus is reported factually as UNAVAILABLE', async () => {
    delete process.env.PUB_NEURAL_ENDPOINT;

    const chiefOfStaff = new ChiefOfStaffAgent(
      conversationStore,
      registry,
      neuralBridge,
      reviewManager,
      taskRepo,
      undefined,
      specDb
    );

    const res = await chiefOfStaff.handleCommand({
      message: 'Atualize documentação da API',
      project: 'pub-rate-calculator',
      conversationId: 'session-neural-unavailable',
    });

    const mockProvider = createMockProvider();
    const worker = new PdlCorrectionWorker(
      taskRepo,
      mockProvider,
      'pdl-router',
      undefined,
      specDb,
      undefined,
      undefined,
      undefined,
      neuralBridge,
      reviewManager,
      conversationStore
    );

    vi.spyOn(DefaultFinalizationBridge.prototype, 'finalize').mockResolvedValue({
      execution: {} as any,
      finalization: {
        status: 'COMPLETED',
        commitSha: '9999999999999999999999999999999999999999',
        changedFiles: ['docs/api.md'],
        gitStatus: 'clean',
        testsPassed: true,
        testOutput: 'PASS',
      },
      specIdentity: { specVersion: '1.0.0', intakeHash: 'intake-123' },
    });

    vi.spyOn(defaultRemotePersistence, 'persist').mockResolvedValue({
      status: 'VERIFIED',
      repository: 'https://github.com/pubcoreagencia/pub-rate-calculator.git',
      branch: 'worker/test',
      pushAttempted: true,
      pushSucceeded: true,
      localSha: '9999999999999999999999999999999999999999',
      remoteSha: '9999999999999999999999999999999999999999',
      remoteVerified: true,
    });

    await worker.executeOnce();

    const task = await taskRepo.get(res.task!.id);
    expect(task?.status).toBe('COMPLETED');

    const session = conversationStore.getSession('session-neural-unavailable');
    const compEvent = session!.events.find((e) => e.type === 'COMPLETED');
    expect(compEvent).toBeDefined();
    // Factual report: external neural client was UNAVAILABLE
    expect(compEvent?.data?.neuralStatus).toBe('UNAVAILABLE');
  });

  // =========================================================================
  // SCENARIO F: Worker crash -> Terminal FAILED with factual error
  // =========================================================================
  it('SCENARIO F: When worker crashes unexpectedly, task terminates in FAILED and CEO is notified', async () => {
    const chiefOfStaff = new ChiefOfStaffAgent(
      conversationStore,
      registry,
      neuralBridge,
      reviewManager,
      taskRepo,
      undefined,
      specDb
    );

    const res = await chiefOfStaff.handleCommand({
      message: 'Tarefa propensa a erro de tempo de execução',
      project: 'pub-rate-calculator',
      conversationId: 'session-crash',
    });

    const crashingProvider = createMockProvider(async () => {
      throw new Error('Fatal out of memory or process crash in worker execution container');
    });

    const worker = new PdlCorrectionWorker(
      taskRepo,
      crashingProvider,
      'pdl-router',
      undefined,
      specDb,
      undefined,
      undefined,
      undefined,
      neuralBridge,
      reviewManager,
      conversationStore
    );

    await worker.executeOnce();

    const task = await taskRepo.get(res.task!.id);
    expect(task?.status).toBe('FAILED');
    expect(task?.error).toContain('Fatal out of memory or process crash');

    const session = conversationStore.getSession('session-crash');
    expect(session!.events.some((e) => e.type === 'FAILED')).toBe(true);

    const lastMsg = session!.messages[session!.messages.length - 1];
    expect(lastMsg.content).toContain('Execução Interrompida');
    expect(lastMsg.content).toContain('Fatal out of memory');
  });
});

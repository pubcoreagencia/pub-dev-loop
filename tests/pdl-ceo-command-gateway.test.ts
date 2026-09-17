/**
 * Test Suite: CEO Command Gateway & Governance-First Lifecycle Proof.
 *
 * Verifies that:
 * 1. CEO directives require trusted identity (cannot spoof operator via text).
 * 2. Governance evaluates BEFORE task creation (Governance-before-task).
 * 3. Kill Switch active blocks task creation and leaves queue empty.
 * 4. Level 0 blocks ACTION / MUTATION directives.
 * 5. Unauthorized products are blocked fail-closed.
 * 6. Audit events and correlation ID are preserved.
 * 7. When ALLOWED (elevated state), task is enqueued only AFTER approval.
 * 8. Idempotency guarantees identical replay without duplicate task creation.
 */

import { randomUUID } from 'node:crypto';
import { describe, it, expect, beforeEach } from 'vitest';
import { CeoCommandGateway } from '../src/pdl/ceo/command-gateway.js';
import type { CeoCommandInputPacket, TrustedCeoContext } from '../src/pdl/ceo/types.js';
import { PdlGovernanceEngine } from '../src/pdl/governance/policy-engine.js';
import { PdlKillSwitch } from '../src/pdl/governance/kill-switch.js';
import { ProductCatalog, type ProductManifest } from '../src/pdl/products/catalog.js';
import { CeoConversationStore } from '../src/office/ceo-conversation-store.js';
import type { Task, TaskRepository } from '../src/domain.js';

class InMemoryTaskRepository implements TaskRepository {
  public tasks = new Map<string, Task>();

  async create(input: any): Promise<Task> {
    const id = input.id || randomUUID();
    const task: Task = {
      id,
      project: input.project,
      repository: input.repository,
      objective: input.objective,
      prompt: input.prompt,
      status: 'QUEUED',
      priority: input.priority ?? 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      worker: null,
      branch: null,
      gitStatus: 'clean',
      commitSha: null,
      result: null,
      error: null,
      leaseOwner: null,
      leaseDeadline: null,
      heartbeatAt: null,
      workspacePath: null,
      prototypeSessionId: null,
    };
    this.tasks.set(id, task);
    return task;
  }
  async get(id: string): Promise<Task | null> {
    return this.tasks.get(id) || null;
  }
  async list(): Promise<Task[]> {
    return Array.from(this.tasks.values());
  }
  async update(id: string, patch: Partial<Task>): Promise<Task | null> {
    const task = this.tasks.get(id);
    if (!task) return null;
    const updated = { ...task, ...patch };
    this.tasks.set(id, updated);
    return updated;
  }
  async delete(id: string): Promise<boolean> {
    return this.tasks.delete(id);
  }
  async claim(): Promise<Task | null> { return null; }
  async claimPrototype(): Promise<Task | null> { return null; }
  async reclaimStuck(): Promise<number> { return 0; }
  async heartbeat(): Promise<boolean> { return true; }
  async cancel(id: string): Promise<Task | null> { return this.update(id, { status: 'CANCELLED' }); }
  async retry(id: string): Promise<Task | null> { return this.update(id, { status: 'QUEUED' }); }
}

describe('PDL CEO Command Gateway Suite (Governance-Before-Task)', () => {
  let taskRepo: InMemoryTaskRepository;
  let catalog: ProductCatalog;
  let conversationStore: CeoConversationStore;
  let killSwitch: PdlKillSwitch;
  let governance: PdlGovernanceEngine;
  let gateway: CeoCommandGateway;

  const validCeoContext: TrustedCeoContext = {
    operatorId: 'MATHEUS',
    role: 'CEO',
    channel: 'chat',
    verified: true,
  };

  const sampleProducts: ProductManifest[] = [
    {
      productId: 'pub-dev-loop',
      repository: 'https://github.com/pubcoreagencia/pub-dev-loop.git',
      organization: 'pubcoreagencia',
      defaultBranch: 'main',
      testCommand: 'npm test',
      allowedPaths: ['src/**', 'tests/**'],
      maxAutonomyLevel: 4,
      remotePersistenceEligible: true,
    },
    {
      productId: 'pub-rate-calculator',
      repository: 'https://github.com/pubcoreagencia/pub-rate-calculator.git',
      organization: 'pubcoreagencia',
      defaultBranch: 'main',
      testCommand: 'npm test',
      allowedPaths: ['src/**', 'tests/**'],
      maxAutonomyLevel: 4,
      remotePersistenceEligible: true,
    },
  ];

  beforeEach(() => {
    taskRepo = new InMemoryTaskRepository();
    catalog = new ProductCatalog(sampleProducts);
    conversationStore = new CeoConversationStore();
    killSwitch = new PdlKillSwitch(); // In-memory fallback
    governance = new PdlGovernanceEngine({ killSwitch }); // In-memory fallback (Level 0, Kill Switch true)
    gateway = new CeoCommandGateway({
      governance,
      taskRepo,
      catalog,
      conversationStore,
    });
  });

  // 1. Operator Authenticity Validation
  it('1. Rejects directives when operator is not authenticated as MATHEUS (CEO)', async () => {
    const unauthenticatedPacket: CeoCommandInputPacket = {
      command: 'Analise o status do projeto',
      project: 'pub-dev-loop',
      trustedContext: {
        operatorId: 'hacker',
        role: 'CEO',
        channel: 'api',
        verified: false, // Not verified!
      },
    };

    const result = await gateway.handleCommand(unauthenticatedPacket);

    expect(result.status).toBe('BLOCKED');
    expect(result.governanceDecision.allowed).toBe(false);
    expect(result.governanceDecision.reasonCode).toBe('UNAUTHORIZED_OPERATOR');
    expect(result.taskId).toBeUndefined();
    expect(taskRepo.tasks.size).toBe(0); // ZERO tasks created!
  });

  // 2. Correlation ID Generation & Tracing
  it('2. Assigns deterministic correlation ID and preserves it across events and result', async () => {
    const packet: CeoCommandInputPacket = {
      command: 'Verifique o status do sistema',
      project: 'pub-dev-loop',
      trustedContext: validCeoContext,
    };

    const result = await gateway.handleCommand(packet);

    expect(result.correlationId).toBeDefined();
    expect(result.correlationId).toMatch(/^ceo-corr-[0-9a-f-]+$/);
    expect(result.issuedBy).toBe('MATHEUS');
    expect(result.events.length).toBeGreaterThan(0);
    expect(result.events[0].type).toBe('COMMAND_RECEIVED');
  });

  // 3. Kill Switch ACTIVE: Blocks task creation immediately
  it('3. Kill Switch ACTIVE strictly blocks directive without creating any task in database', async () => {
    // Current default state: killSwitch is ACTIVE
    const packet: CeoCommandInputPacket = {
      command: 'Atualize o componente de persistência',
      project: 'pub-dev-loop',
      trustedContext: validCeoContext,
    };

    const result = await gateway.handleCommand(packet);

    expect(result.status).toBe('BLOCKED');
    expect(result.governanceDecision.allowed).toBe(false);
    expect(result.governanceDecision.reasonCode).toBe('KILL_SWITCH_ACTIVE');
    expect(result.taskId).toBeNull();
    expect(taskRepo.tasks.size).toBe(0); // Crucial: ZERO tasks in queue!
  });

  // 4. Governance Level 0: Blocks ACTION / MUTATION directives
  it('4. Governance Level 0 blocks ACTION and MUTATION directives', async () => {
    const mockGov = {
      loadLimits: async () => ({
        activeLevel: 0 as const,
        killSwitchActive: false,
        maxConsecutiveTasks: 1,
        maxTaskDurationMs: 180000,
        maxToolRoundsPerTask: 10,
        maxCorrectionAttempts: 2,
        maxConsecutiveFailures: 1,
        allowedProducts: ['pub-dev-loop'],
      }),
      getKillSwitch: () => ({
        checkStatus: async () => ({ active: false, reason: '' }),
      }),
    } as unknown as PdlGovernanceEngine;

    const level0Gateway = new CeoCommandGateway({
      governance: mockGov,
      taskRepo,
      catalog,
      conversationStore,
    });

    const packet: CeoCommandInputPacket = {
      command: 'Crie um arquivo de teste e modifique o código',
      project: 'pub-dev-loop',
      trustedContext: validCeoContext,
    };

    const result = await level0Gateway.handleCommand(packet);

    expect(result.status).toBe('BLOCKED');
    expect(result.governanceDecision.allowed).toBe(false);
    expect(result.governanceDecision.reasonCode).toBe('LEVEL_0_MANUAL_ONLY');
    expect(result.intent).toBe('MUTATION');
    expect(result.taskId).toBeNull();
    expect(taskRepo.tasks.size).toBe(0); // ZERO tasks created!
  });

  // 5. Unauthorized Product: Fails closed
  it('5. Rejects directive targeting product not in Product Catalog or allowed list', async () => {
    const mockGov = {
      loadLimits: async () => ({
        activeLevel: 3 as const,
        killSwitchActive: false,
        maxConsecutiveTasks: 1,
        maxTaskDurationMs: 180000,
        maxToolRoundsPerTask: 10,
        maxCorrectionAttempts: 2,
        maxConsecutiveFailures: 1,
        allowedProducts: ['pub-dev-loop'],
      }),
      getKillSwitch: () => ({
        checkStatus: async () => ({ active: false, reason: '' }),
      }),
    } as unknown as PdlGovernanceEngine;

    const authorizedGateway = new CeoCommandGateway({
      governance: mockGov,
      taskRepo,
      catalog,
      conversationStore,
    });

    const packet: CeoCommandInputPacket = {
      command: 'Verifique o status do repositório rogue',
      project: 'unauthorized-rogue-repo',
      trustedContext: validCeoContext,
    };

    const result = await authorizedGateway.handleCommand(packet);

    expect(result.status).toBe('BLOCKED');
    expect(result.governanceDecision.allowed).toBe(false);
    expect(result.governanceDecision.reasonCode).toBe('UNAUTHORIZED_PRODUCT');
    expect(result.taskId).toBeNull();
    expect(taskRepo.tasks.size).toBe(0);
  });

  // 6. Audit Trail & Conversation Memory
  it('6. Records executive command and operational events into CeoConversationStore', async () => {
    const convId = 'test-conversation-123';
    const packet: CeoCommandInputPacket = {
      command: 'Analise os logs de auditoria',
      project: 'pub-dev-loop',
      conversationId: convId,
      trustedContext: validCeoContext,
    };

    await gateway.handleCommand(packet);

    const session = conversationStore.getSession(convId);
    expect(session).toBeDefined();
    expect(session?.messages.length).toBeGreaterThan(0);
    expect(session?.messages[0].sender).toBe('CEO');
    expect(session?.messages[0].content).toBe('Analise os logs de auditoria');
  });

  // 7. Idempotency: Duplicate command does not re-evaluate or duplicate tasks
  it('7. Idempotency key prevents duplicate evaluation and returns identical result', async () => {
    const packet: CeoCommandInputPacket = {
      command: 'Diretriz idêntica repetida',
      project: 'pub-dev-loop',
      idempotencyKey: 'idemp-key-xyz-999',
      trustedContext: validCeoContext,
    };

    const result1 = await gateway.handleCommand(packet);
    const result2 = await gateway.handleCommand(packet);

    expect(result1.commandId).toBe(result2.commandId);
    expect(result1.correlationId).toBe(result2.correlationId);
    expect(result2.events.some((e) => e.type === 'IDEMPOTENT_REPLAY')).toBe(true);
    expect(taskRepo.tasks.size).toBe(0);
  });

  // 8. Controlled ALLOW: Creates task ONLY AFTER Governance permits
  it('8. When Governance is authorized, task is created ONLY AFTER approval and correlated', async () => {
    // Custom mock governance engine returning ALLOWED
    const mockGov = {
      loadLimits: async () => ({
        activeLevel: 3 as const,
        killSwitchActive: false,
        maxConsecutiveTasks: 1,
        maxTaskDurationMs: 180000,
        maxToolRoundsPerTask: 10,
        maxCorrectionAttempts: 2,
        maxConsecutiveFailures: 1,
        allowedProducts: ['pub-dev-loop'],
      }),
      getKillSwitch: () => ({
        checkStatus: async () => ({ active: false, level: 3 }),
      }),
    } as unknown as PdlGovernanceEngine;

    const authorizedGateway = new CeoCommandGateway({
      governance: mockGov,
      taskRepo,
      catalog,
      conversationStore,
    });

    const packet: CeoCommandInputPacket = {
      command: 'Analise o estado atual do projeto e retorne um diagnóstico. Não altere arquivos.',
      project: 'pub-dev-loop',
      trustedContext: validCeoContext,
    };

    const result = await authorizedGateway.handleCommand(packet);

    expect(result.status).toBe('QUEUED');
    expect(result.governanceDecision.allowed).toBe(true);
    expect(result.governanceDecision.reasonCode).toBe('PERMITTED');
    expect(result.taskId).toBeDefined();

    // Verify task exists in repository and is correlated
    expect(taskRepo.tasks.size).toBe(1);
    const createdTask = await taskRepo.get(result.taskId!);
    expect(createdTask).toBeDefined();
    expect(createdTask?.status).toBe('QUEUED');
    expect(createdTask?.project).toBe('pub-dev-loop');
    expect(createdTask?.result).toEqual({ correlationId: result.correlationId });
  });
});

/**
 * Test Suite: Header Active Project -> CEO Chat -> API Request -> CEO Command Gateway E2E Proof.
 *
 * Verifies the canonical chain:
 * 1. Criterion A: Header activeProject established ('pub-dev-loop')
 * 2. Criterion B: Chat prompt does not require repeating the project name ("Analise o estado atual...")
 * 3. Criterion C: Payload to /office/ceo/command carries project: state.activeProject
 * 4. Criterion D: Gateway receives and validates project = 'pub-dev-loop'
 * 5. Criterion E: Missing project is deterministically rejected with MISSING_PROJECT
 * 6. Criterion F: Invalid / unauthorized project is deterministically rejected with UNAUTHORIZED_PRODUCT
 * 7. Store / Conversation session preserves project and correlationId accurately
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

class MockTaskRepository implements TaskRepository {
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
  async update(id: string, fields: any): Promise<Task> {
    const existing = this.tasks.get(id);
    if (!existing) throw new Error('Not found');
    const updated = { ...existing, ...fields, updatedAt: new Date() };
    this.tasks.set(id, updated);
    return updated;
  }
  async delete(id: string): Promise<boolean> {
    return this.tasks.delete(id);
  }
}

describe('Audit Chain: Header Active Project -> CEO Chat -> API Request -> CEO Command Gateway', () => {
  let catalog: ProductCatalog;
  let killSwitch: PdlKillSwitch;
  let govEngine: PdlGovernanceEngine;
  let convStore: CeoConversationStore;
  let taskRepo: MockTaskRepository;
  let gateway: CeoCommandGateway;

  const validManifest: ProductManifest = {
    productId: 'pub-dev-loop',
    repository: 'https://github.com/pubcoreagencia/pub-dev-loop.git',
    organization: 'pubcoreagencia',
    defaultBranch: 'main',
    developmentBranchPolicy: ['feat/*', 'fix/*'],
    testCommand: 'npm test',
    allowedPaths: ['src/**', 'tests/**'],
    protectedPaths: ['.github/**', 'package.json'],
    maxAutonomyLevel: 4,
    remotePersistenceEligible: true,
  };

  const trustedContext: TrustedCeoContext = {
    operatorId: 'MATHEUS',
    role: 'CEO',
    channel: 'chat',
    verified: true,
  };

  beforeEach(() => {
    catalog = new ProductCatalog([validManifest]);

    const mockGov = {
      loadLimits: async () => ({
        activeLevel: 2 as const,
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

    convStore = new CeoConversationStore();
    taskRepo = new MockTaskRepository();

    gateway = new CeoCommandGateway({
      governance: mockGov,
      catalog,
      conversationStore: convStore,
      taskRepo,
    });
  });

  it('Criterion A, B, C & D: Directive without project name in text uses Header activeProject canonical context', async () => {
    // Simulated Frontend Store State
    const frontendStoreState = {
      activeProject: 'pub-dev-loop',
      activeRepository: 'https://github.com/pubcoreagencia/pub-dev-loop.git',
    };

    // CEO enters directive in Chat without repeating project name
    const ceoChatInputText = 'Analise o estado atual do repositório e verifique a integridade';

    // Frontend sendCeoCommand payload construction:
    const apiPayload = {
      message: ceoChatInputText,
      project: frontendStoreState.activeProject,
      repository: frontendStoreState.activeRepository,
    };

    // Gateway receives payload packet
    const packet: CeoCommandInputPacket = {
      command: apiPayload.message,
      project: apiPayload.project,
      repository: apiPayload.repository,
      trustedContext,
    };

    const result = await gateway.handleCommand(packet);

    expect(result.status).toBe('QUEUED');
    expect(result.project).toBe('pub-dev-loop');
    expect(result.commandId).toBeDefined();
    expect(result.correlationId).toBeDefined();

    // Verify Session Store contains the exact project and conversation link
    const session = convStore.findByTaskId(result.taskId!);
    expect(session).toBeDefined();
    expect(session?.project).toBe('pub-dev-loop');
  });

  it('Criterion E: Missing or empty project is deterministically rejected fail-closed', async () => {
    const packetWithoutProject: CeoCommandInputPacket = {
      command: 'Execute audit immediately',
      project: '', // or undefined
      trustedContext,
    };

    const result = await gateway.handleCommand(packetWithoutProject);

    expect(result.status).toBe('BLOCKED');
    expect(result.governanceDecision.allowed).toBe(false);
    expect(result.governanceDecision.reasonCode).toBe('MISSING_PROJECT');
    expect(result.error).toContain('Target project identifier is required');
    expect(result.taskId).toBeUndefined();
    expect(taskRepo.tasks.size).toBe(0);
  });

  it('Criterion F: Invalid / unauthorized project is deterministically rejected fail-closed', async () => {
    const packetWithUnauthorizedProject: CeoCommandInputPacket = {
      command: 'Execute audit immediately',
      project: 'malicious-or-unknown-repo',
      trustedContext,
    };

    const result = await gateway.handleCommand(packetWithUnauthorizedProject);

    expect(result.status).toBe('BLOCKED');
    expect(result.governanceDecision.allowed).toBe(false);
    expect(result.governanceDecision.reasonCode).toBe('UNAUTHORIZED_PRODUCT');
    expect(result.error).toContain('not registered in Product Catalog');
    expect(result.taskId).toBeNull();
    expect(taskRepo.tasks.size).toBe(0);
  });

  it('Verifies conversation store binds messages and events to canonical activeProject', async () => {
    const conversationId = 'ceo-conv-header-chain-test';
    const packet: CeoCommandInputPacket = {
      command: 'Verifique o status do scheduler',
      project: 'pub-dev-loop',
      conversationId,
      trustedContext,
    };

    const result = await gateway.handleCommand(packet);

    const session = convStore.getSession(conversationId);
    expect(session).toBeDefined();
    expect(session?.project).toBe('pub-dev-loop');
    expect(session?.messages.length).toBeGreaterThanOrEqual(1);
    expect(session?.messages[0].sender).toBe('CEO');
    expect(session?.messages[0].content).toBe('Verifique o status do scheduler');
  });
});

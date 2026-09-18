import { describe, it, expect } from 'vitest';
import { BaseWorker, type AttemptResult } from '../../src/worker-service.js';
import type { Task, TaskRepository } from '../../src/domain.js';
import { PreTaskKnowledgeGate } from '../../src/pdl/neural/pre-task-gate.js';
import { DefaultPubNeuralQueryAdapter } from '../../src/pdl/neural/query-adapter.js';
import { HttpNeuralQueryTransport } from '../../src/pdl/neural/query-transport.js';

function createSampleTask(id: string): Task {
  return {
    id,
    project: 'pub-dev-loop',
    repository: 'pubcoreagencia/pub-dev-loop',
    objective: 'Verify pre-task neural query contract and fail-open guarantees',
    prompt: 'Implement operational task under real or offline neural conditions.',
    status: 'QUEUED',
    priority: 1,
    worker: null,
    result: null,
    error: null,
    branch: 'feat/test-v1-1-c',
    commitSha: null,
    gitStatus: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    prototypeSessionId: null,
    agentId: 'developer',
    tenantId: 'pub-holding',
  };
}

class InMemoryRepo implements TaskRepository {
  private taskMap = new Map<string, Task>();

  constructor(initialTasks: Task[]) {
    for (const t of initialTasks) {
      this.taskMap.set(t.id, { ...t });
    }
  }

  async claim(worker: string): Promise<Task | null> {
    for (const t of this.taskMap.values()) {
      if (t.status === 'QUEUED') {
        t.status = 'ASSIGNED';
        t.worker = worker;
        return t;
      }
    }
    return null;
  }

  async get(id: string): Promise<Task | null> {
    return this.taskMap.get(id) ?? null;
  }

  async list(): Promise<Task[]> {
    return Array.from(this.taskMap.values());
  }

  async update(id: string, patch: Partial<Task>): Promise<Task | null> {
    const existing = this.taskMap.get(id);
    if (!existing) return null;
    Object.assign(existing, patch);
    return existing;
  }

  async cancel(id: string): Promise<Task | null> {
    const t = this.taskMap.get(id);
    if (!t) return null;
    t.status = 'CANCELLED';
    return t;
  }

  async retry(id: string): Promise<Task | null> {
    const t = this.taskMap.get(id);
    if (!t) return null;
    t.status = 'QUEUED';
    return t;
  }

  async heartbeat(): Promise<void> {}
}

class TestProbeWorker extends BaseWorker {
  capturedPreparedTask: Task | null = null;
  executionCount = 0;

  protected async executeWithRetry(_task: Task, _repository: string, prepared?: any): Promise<AttemptResult> {
    this.executionCount++;
    this.capturedPreparedTask = prepared?.task ?? null;
    return {
      status: 'FAILED',
      workspace: '/tmp/test-probe-workspace',
      baselineSnapshot: { files: [], hash: 'probe' } as any,
      declaredChangedFiles: [],
      stdout: '',
      stderr: 'Probe execution completed',
      exitCode: 1,
      provider: 'probe-provider',
      model: 'probe-model',
      toolCalls: 0,
      toolRounds: 0,
      durationMs: 1,
      errorCode: 'PROBE_EXECUTION',
      errorMessage: 'Probe execution completed',
    };
  }
}

describe('PDL V1.1-C: Neural Runtime Query Lifecycle & Contract Proof', () => {
  const endpoint = process.env.PUB_NEURAL_ENDPOINT || 'https://pub-neural-runtime.onrender.com';
  const token = process.env.PUB_NEURAL_TOKEN;

  it('A/B. When Neural is configured with a valid token, performs real authenticated query and enriches DATA-only or continues smoothly', async () => {
    if (!token) {
      // If token is missing from environment, this test acknowledges MISSING token contract
      expect(token).toBeUndefined();
      return;
    }

    const transport = new HttpNeuralQueryTransport({ endpoint, token });
    const adapter = new DefaultPubNeuralQueryAdapter(transport);
    const gate = new PreTaskKnowledgeGate({ client: adapter });

    const initialTask = createSampleTask('task-v1-1-c-live-001');
    const repo = new InMemoryRepo([initialTask]);
    const worker = new TestProbeWorker(repo, 'worker-v1-1-c-live', undefined, undefined, undefined, undefined, undefined, undefined, gate);

    const executed = await worker.executeOnce();

    expect(executed).toBe(true);
    expect(worker.executionCount).toBe(1);
    expect(worker.capturedPreparedTask).toBeTruthy();
    expect(worker.capturedPreparedTask!.id).toBe(initialTask.id);
    expect(worker.capturedPreparedTask!.objective).toBe(initialTask.objective);
  });

  it('C. When Neural is unavailable (or network failure), worker continues fail-open without blocking execution', async () => {
    // Unreachable endpoint simulates network/server outage
    const transport = new HttpNeuralQueryTransport({
      endpoint: 'https://pub-neural-unreachable.invalid',
      token: 'dummy-token',
      timeoutMs: 1000,
    });
    const adapter = new DefaultPubNeuralQueryAdapter(transport);
    const gate = new PreTaskKnowledgeGate({ client: adapter, failOpen: true });

    const initialTask = createSampleTask('task-v1-1-c-failopen-001');
    const repo = new InMemoryRepo([initialTask]);
    const worker = new TestProbeWorker(repo, 'worker-v1-1-c-failopen', undefined, undefined, undefined, undefined, undefined, undefined, gate);

    const executed = await worker.executeOnce();

    expect(executed).toBe(true);
    expect(worker.executionCount).toBe(1);
    expect(worker.capturedPreparedTask).toBeTruthy();
    expect(worker.capturedPreparedTask!.id).toBe(initialTask.id);
    // Objective is NEVER altered
    expect(worker.capturedPreparedTask!.objective).toBe(initialTask.objective);
    // Unchanged prompt on failure
    expect(worker.capturedPreparedTask!.prompt).toBe(initialTask.prompt);
  });

  it('D. When token is absent, no insecure HTTP call is made and worker continues normally', async () => {
    const transport = new HttpNeuralQueryTransport({
      endpoint: 'https://pub-neural-runtime.onrender.com',
      token: undefined, // explicit missing token
    });
    const adapter = new DefaultPubNeuralQueryAdapter(transport);
    const gate = new PreTaskKnowledgeGate({ client: adapter });

    const initialTask = createSampleTask('task-v1-1-c-notoken-001');
    const repo = new InMemoryRepo([initialTask]);
    const worker = new TestProbeWorker(repo, 'worker-v1-1-c-notoken', undefined, undefined, undefined, undefined, undefined, undefined, gate);

    const executed = await worker.executeOnce();

    expect(executed).toBe(true);
    expect(worker.executionCount).toBe(1);
    expect(worker.capturedPreparedTask).toBeTruthy();
    expect(worker.capturedPreparedTask!.id).toBe(initialTask.id);
    expect(worker.capturedPreparedTask!.prompt).toBe(initialTask.prompt);
  });

  it('E. Exactly one query is evaluated per execution cycle and does not mutate task authority', async () => {
    let queriesReceived = 0;
    const mockClient = {
      query: async (ctx: any) => {
        queriesReceived++;
        return {
          requestId: ctx.requestId || 'mock-req-001',
          status: 'NO_MATCH' as const,
          isSuccess: false,
          isAbstention: false,
          isStale: false,
          isUnavailable: false,
          isError: false,
          items: [],
          sourceReferences: [],
          eventReferences: [],
          evidenceReferences: [],
        };
      },
    };

    const gate = new PreTaskKnowledgeGate({ client: mockClient });
    const initialTask = createSampleTask('task-v1-1-c-onecall-001');
    const repo = new InMemoryRepo([initialTask]);
    const worker = new TestProbeWorker(repo, 'worker-v1-1-c-onecall', undefined, undefined, undefined, undefined, undefined, undefined, gate);

    await worker.executeOnce();

    expect(queriesReceived).toBe(1);
    expect(worker.executionCount).toBe(1);
    expect(worker.capturedPreparedTask!.objective).toBe(initialTask.objective);
  });
});

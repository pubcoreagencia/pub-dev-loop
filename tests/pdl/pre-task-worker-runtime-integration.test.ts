import { describe, it, expect, vi } from 'vitest';
import { BaseWorker, type AttemptResult } from '../../src/worker-service.js';
import type { Task, TaskRepository } from '../../src/domain.js';
import { PreTaskKnowledgeGate } from '../../src/pdl/neural/pre-task-gate.js';
import type { PubNeuralQueryClient } from '../../src/pdl/neural/query-adapter.js';

function task(): Task {
  return {
    id: 'task-pre-task-runtime-001',
    project: 'pub-dev-loop',
    repository: 'pubcoreagencia/pub-dev-loop',
    objective: 'Verify pre-task Neural context reaches provider execution',
    prompt: 'Implement the requested change.',
    status: 'QUEUED',
    priority: 1,
    worker: null,
    result: null,
    error: null,
    branch: 'feat/test',
    commitSha: null,
    gitStatus: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    prototypeSessionId: null,
    agentId: 'developer',
    tenantId: 'pub-holding',
  };
}

class Repo implements TaskRepository {
  private readonly value = task();
  async claim(worker: string): Promise<Task | null> {
    if (this.value.status !== 'QUEUED') return null;
    this.value.status = 'ASSIGNED';
    this.value.worker = worker;
    return this.value;
  }
  async get(): Promise<Task | null> { return this.value; }
  async list(): Promise<Task[]> { return [this.value]; }
  async update(id: string, patch: Partial<Task>): Promise<Task | null> {
    if (id !== this.value.id) return null;
    Object.assign(this.value, patch);
    return this.value;
  }
  async cancel(): Promise<Task | null> { this.value.status = 'CANCELLED'; return this.value; }
  async retry(): Promise<Task | null> { this.value.status = 'QUEUED'; return this.value; }
  async heartbeat(): Promise<void> {}
}

class ProbeWorker extends BaseWorker {
  capturedTask: Task | null = null;
  protected async executeWithRetry(_task: Task, _repository: string, prepared?: any): Promise<AttemptResult> {
    this.capturedTask = prepared?.task ?? null;
    return {
      status: 'FAILED',
      workspace: '/tmp/nonexistent-probe-workspace',
      baselineSnapshot: { files: [], hash: 'probe' } as any,
      declaredChangedFiles: [],
      stdout: '',
      stderr: 'probe',
      exitCode: 1,
      provider: 'probe',
      model: 'probe',
      toolCalls: 0,
      toolRounds: 0,
      durationMs: 1,
      errorCode: 'PROBE',
      errorMessage: 'probe',
    };
  }
}

describe('PDL → PUB Neural pre-task runtime boundary', () => {
  it('executes exactly one pre-task query and passes DATA-only context into provider preparation', async () => {
    const client: PubNeuralQueryClient = {
      query: vi.fn().mockResolvedValue({
        requestId: 'runtime-query-001',
        status: 'SUCCESS',
        isSuccess: true,
        isAbstention: false,
        isStale: false,
        isUnavailable: false,
        isError: false,
        items: [{
          id: 'lesson-runtime-001',
          knowledgeClass: 'LESSON',
          title: 'Runtime Query Lesson',
          content: 'Use the canonical Runtime Query endpoint.',
          scope: 'PROJECT',
          projectId: 'pub-dev-loop',
          relevanceScore: 0.9,
          confidenceScore: 0.95,
          promotionState: 'VALIDATED',
          conflictState: 'RESOLVED',
          authority: { level: 'VALIDATED_KNOWLEDGE', rank: 2, isDataOnly: true, description: 'test' },
          provenance: { sourceId: 'src-1', originatingEventId: 'evt-1', evidenceId: 'evi-1', repository: 'pubcoreagencia/pub-neural', commitSha: 'abc' },
          freshness: { state: 'VALID', isStale: false },
        }],
        sourceReferences: ['src-1'],
        eventReferences: ['evt-1'],
        evidenceReferences: ['evi-1'],
      }),
    };

    const gate = new PreTaskKnowledgeGate({ client });
    const repo = new Repo();
    const worker = new ProbeWorker(repo, 'probe', undefined, undefined, undefined, undefined, undefined, undefined, gate);

    await worker.executeOnce();

    expect(client.query).toHaveBeenCalledTimes(1);
    expect(worker.capturedTask).toBeTruthy();
    expect(worker.capturedTask!.objective).toBe('Verify pre-task Neural context reaches provider execution');
    expect(worker.capturedTask!.prompt).toContain('[PUB NEURAL KNOWLEDGE - GOVERNED DATA ONLY]');
    expect(worker.capturedTask!.prompt).toContain('Runtime Query Lesson');
  });
});

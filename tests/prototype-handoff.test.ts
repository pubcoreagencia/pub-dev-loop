import { describe, it, expect, beforeEach } from 'vitest';
import type { Task } from '../src/domain.js';
import type { PrototypeSession, PrototypePromotion } from '../src/prototype/domain.js';
import { PrototypeHandoffService } from '../src/prototype/handoff.js';
import type { PrototypeEventPublisher } from '../src/prototype/events.js';
import type { TaskRepository, PrototypeRepository } from '../src/domain.js';

class InMemoryTaskRepository implements TaskRepository {
  private tasks = new Map<string, Task>();
  async create(input: any): Promise<Task> {
    const id = `task-${this.tasks.size + 1}`;
    const task: Task = {
      id,
      project: input.project,
      repository: input.repository,
      objective: input.objective,
      prompt: input.prompt,
      status: 'QUEUED',
      priority: input.priority ?? 0,
      worker: null,
      result: null,
      error: null,
      branch: null,
      commitSha: null,
      gitStatus: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      leaseOwner: null,
      leaseDeadline: null,
      heartbeatAt: null,
      workspacePath: null,
      prototypeSessionId: input.prototypeSessionId ?? null,
    };
    this.tasks.set(id, task);
    return { ...task };
  }
  async list(): Promise<Task[]> { return Array.from(this.tasks.values()); }
  async get(id: string): Promise<Task | null> { return this.tasks.get(id) ?? null; }
  async claim(_worker: string): Promise<Task | null> {
    for (const t of this.tasks.values()) {
      if (t.status === 'QUEUED' && t.prototypeSessionId === null) {
        t.status = 'ASSIGNED';
        t.worker = _worker;
        return { ...t };
      }
    }
    return null;
  }
  async update(id: string, patch: Partial<Task>): Promise<Task | null> {
    const t = this.tasks.get(id);
    if (!t) return null;
    Object.assign(t, patch);
    this.tasks.set(id, t);
    return { ...t };
  }
  async cancel(id: string): Promise<Task | null> { return this.update(id, { status: 'CANCELLED' }); }
  async retry(id: string): Promise<Task | null> { return this.update(id, { status: 'QUEUED', worker: null }); }
  async reclaimStuck(): Promise<number> { return 0; }
  async heartbeat(): Promise<boolean> { return true; }
}

class InMemoryPrototypeRepository implements PrototypeRepository {
  private sessions = new Map<string, PrototypeSession>();
  private promotions: PrototypePromotion[] = [];
  async createSession(input: any): Promise<PrototypeSession> {
    const session: PrototypeSession = {
      id: `session-${this.sessions.size + 1}`,
      project: input.project,
      repository: input.repository,
      branch: input.branch ?? `prototype/${input.project}/${this.sessions.size + 1}`,
      mode: 'PROTOTYPE',
      status: 'CREATING',
      previewUrl: null,
      previewRuntime: null,
      workspacePath: null,
      lastCheckpointSha: null,
      promptCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.sessions.set(session.id, session);
    return { ...session };
  }
  async getSession(id: string): Promise<PrototypeSession | null> {
    const s = this.sessions.get(id);
    return s ? { ...s } : null;
  }
  async listSessions(): Promise<PrototypeSession[]> { return Array.from(this.sessions.values()).map(s => ({ ...s })); }
  async updateSession(id: string, patch: any): Promise<PrototypeSession | null> {
    const s = this.sessions.get(id);
    if (!s) return null;
    Object.assign(s, patch);
    this.sessions.set(id, s);
    return { ...s };
  }
  async incrementPromptCount(id: string): Promise<PrototypeSession | null> {
    const s = this.sessions.get(id);
    if (!s) return null;
    s.promptCount += 1;
    s.status = 'BUILDING';
    return { ...s };
  }
  async promoteSession(id: string): Promise<PrototypeSession | null> {
    const s = this.sessions.get(id);
    if (!s || !['READY', 'APPROVED'].includes(s.status) || !s.lastCheckpointSha) return null;
    s.mode = 'DEVELOPMENT';
    s.status = 'PROMOTED';
    s.updatedAt = new Date();
    return { ...s };
  }
  async createCheckpoint(_input: any): Promise<any> { return { id: 'checkpoint-1', ..._input }; }
  async listCheckpoints(_sessionId: string): Promise<any[]> { return []; }
  async createPromotion(input: any): Promise<PrototypePromotion> {
    const promotion: PrototypePromotion = {
      id: `promo-${this.promotions.length + 1}`,
      sessionId: input.sessionId,
      fromMode: input.fromMode,
      toMode: input.toMode,
      repository: input.repository,
      branch: input.branch,
      checkpointSha: input.checkpointSha,
      promotedAt: input.promotedAt ?? new Date(),
    };
    this.promotions.push(promotion);
    return { ...promotion };
  }
  async getPromotion(sessionId: string): Promise<PrototypePromotion | null> {
    const found = [...this.promotions].reverse().find(p => p.sessionId === sessionId);
    return found ? { ...found } : null;
  }
}

class FakeEventPublisher implements PrototypeEventPublisher {
  readonly events: any[] = [];
  emit(event: any) { this.events.push(event); }
}

describe('PrototypeHandoffService', () => {
  let tasks: InMemoryTaskRepository;
  let prototypes: InMemoryPrototypeRepository;
  let events: FakeEventPublisher;
  let service: PrototypeHandoffService;

  beforeEach(() => {
    tasks = new InMemoryTaskRepository();
    prototypes = new InMemoryPrototypeRepository();
    events = new FakeEventPublisher();
    service = new PrototypeHandoffService(tasks as any, prototypes as any, events as any);
  });

  it('promotes READY session and creates Development Task', async () => {
    const session = await prototypes.createSession({ project: 'app', repository: 'repo', branch: 'prototype/app/1' });
    await prototypes.updateSession(session.id, { status: 'READY', lastCheckpointSha: 'sha123', branch: session.branch, repository: session.repository });

    const result = await service.execute({ sessionId: session.id });

    expect(result.session.status).toBe('PROMOTED');
    expect(result.session.mode).toBe('DEVELOPMENT');
    expect(result.task.prototypeSessionId).toBeNull();
    expect(result.task.branch).toBe(session.branch);
    expect(result.task.repository).toBe(session.repository);
    expect(result.promotion.fromMode).toBe('PROTOTYPE');
    expect(result.promotion.toMode).toBe('DEVELOPMENT');
    expect(events.events.some(e => e.type === 'PROMOTED_TO_DEVELOPMENT')).toBe(true);
  });

  it('promotes APPROVED session and creates Development Task', async () => {
    const session = await prototypes.createSession({ project: 'app', repository: 'repo', branch: 'prototype/app/2' });
    await prototypes.updateSession(session.id, { status: 'APPROVED', lastCheckpointSha: 'sha456', branch: session.branch, repository: session.repository });

    const result = await service.execute({ sessionId: session.id });

    expect(result.session.status).toBe('PROMOTED');
    expect(result.session.mode).toBe('DEVELOPMENT');
    expect(result.task.prototypeSessionId).toBeNull();
  });

  it('rejects invalid session status', async () => {
    const session = await prototypes.createSession({ project: 'app', repository: 'repo', branch: 'prototype/app/3' });
    await prototypes.updateSession(session.id, { status: 'BUILDING', lastCheckpointSha: 'sha123' });

    await expect(service.execute({ sessionId: session.id })).rejects.toThrow('cannot be promoted');
  });

  it('rejects missing session', async () => {
    await expect(service.execute({ sessionId: 'missing' })).rejects.toThrow('NOT_FOUND');
  });

  it('is idempotent when already promoted', async () => {
    const session = await prototypes.createSession({ project: 'app', repository: 'repo', branch: 'prototype/app/4' });
    await prototypes.updateSession(session.id, { status: 'READY', lastCheckpointSha: 'sha123', branch: session.branch, repository: session.repository });

    const first = await service.execute({ sessionId: session.id });
    const second = await service.execute({ sessionId: session.id, objective: 'Retry handoff' });

    expect(second.task.id).toBe(first.task.id);
    expect(events.events.filter(e => e.type === 'PROMOTED_TO_DEVELOPMENT').length).toBe(1);
  });
});

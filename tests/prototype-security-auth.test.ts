import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import http from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../src/api.js';
import { validateWorkspacePath, ValidationError } from '../src/prototype/validation.js';
import type { Task } from '../src/domain.js';
import type { PrototypeSession, PrototypeCheckpoint } from '../src/prototype/domain.js';
import type { PostgresTaskRepository } from '../src/repository.js';
import type { PostgresPrototypeRepository } from '../src/prototype/repository.js';

async function withServer(app: any, fn: (baseUrl: string) => Promise<void>): Promise<void> {
  const server = http.createServer(app);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', () => resolve()));
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;
  try {
    await fn(baseUrl);
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
}

describe('P1-SEC-01: Autenticação de Rotas /prototype/*', () => {
  const originalKey = process.env.PUB_DEV_LOOP_API_KEY;
  const taskStore = new Map<string, Task>();
  const sessionStore = new Map<string, PrototypeSession>();
  const checkpointStore: PrototypeCheckpoint[] = [];

  const mockTasks = {
    async create(input: any): Promise<Task> {
      const id = `task-${taskStore.size + 1}`;
      const t: Task = {
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
        prototypeSessionId: input.prototypeSessionId ?? null,
      };
      taskStore.set(id, t);
      return { ...t };
    },
    async update(id: string, patch: Partial<Task>): Promise<Task | null> {
      const t = taskStore.get(id);
      if (!t) return null;
      Object.assign(t, patch);
      return { ...t };
    },
    async get(id: string) { return taskStore.get(id) ?? null; },
    async list() { return Array.from(taskStore.values()); },
    async cancel(id: string) { const t = taskStore.get(id); if (!t) return null; t.status = 'CANCELLED'; return t; },
    async retry(id: string) { const t = taskStore.get(id); if (!t) return null; t.status = 'QUEUED'; return t; },
  } as unknown as PostgresTaskRepository;

  const mockPrototypes = {
    async createSession(input: any): Promise<PrototypeSession> {
      const id = '00000000-0000-0000-0000-000000000001';
      const s: PrototypeSession = {
        id,
        project: input.project,
        repository: input.repository,
        branch: input.branch ?? `prototype/${input.project}/${id}`,
        mode: 'PROTOTYPE',
        status: 'INITIALIZING',
        previewUrl: null,
        previewRuntime: null,
        workspacePath: null,
        lastCheckpointSha: null,
        promptCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      sessionStore.set(id, s);
      return { ...s };
    },
    async getSession(id: string): Promise<PrototypeSession | null> {
      return sessionStore.get(id) ?? null;
    },
    async listSessions(): Promise<PrototypeSession[]> {
      return Array.from(sessionStore.values());
    },
    async listCheckpoints(sessionId: string): Promise<PrototypeCheckpoint[]> {
      return checkpointStore.filter(c => c.sessionId === sessionId);
    },
    async updateSession(id: string, patch: any): Promise<PrototypeSession | null> {
      const s = sessionStore.get(id);
      if (!s) return null;
      Object.assign(s, patch);
      return { ...s };
    },
    async incrementPromptCount(id: string): Promise<PrototypeSession | null> {
      const s = sessionStore.get(id);
      if (!s) return null;
      s.promptCount++;
      s.status = 'BUILDING';
      return { ...s };
    },
    async createCheckpoint(input: any): Promise<PrototypeCheckpoint> {
      const cp: PrototypeCheckpoint = {
        id: `cp-${checkpointStore.length + 1}`,
        sessionId: input.sessionId,
        promptIndex: input.promptIndex,
        prompt: input.prompt,
        commitSha: input.commitSha,
        previewUrl: input.previewUrl,
        buildPassed: input.buildPassed,
        createdAt: new Date(),
      };
      checkpointStore.push(cp);
      return cp;
    },
    async promoteSession(id: string): Promise<PrototypeSession | null> {
      const s = sessionStore.get(id);
      if (!s || s.status === 'PROMOTED') return null;
      s.status = 'PROMOTED';
      s.mode = 'DEVELOPMENT';
      return { ...s };
    },
    async createPromotion(input: any) {
      return { id: 'promo-1', ...input };
    },
  } as unknown as PostgresPrototypeRepository;

  beforeEach(() => {
    process.env.PUB_DEV_LOOP_API_KEY = 'test-secret-key-42';
    taskStore.clear();
    sessionStore.clear();
    checkpointStore.length = 0;
  });

  afterEach(() => {
    if (originalKey !== undefined) {
      process.env.PUB_DEV_LOOP_API_KEY = originalKey;
    } else {
      delete process.env.PUB_DEV_LOOP_API_KEY;
    }
  });

  it('1. /prototype/* sem API key retorna 401 Unauthorized', async () => {
    const app = createApp(mockTasks, mockPrototypes);
    await withServer(app, async (baseUrl) => {
      // POST /prototype/sessions
      const resPostSession = await fetch(`${baseUrl}/prototype/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project: 'test-app' }),
      });
      expect(resPostSession.status).toBe(401);
      const json1 = (await resPostSession.json()) as any;
      expect(json1.error).toContain('Unauthorized');

      // GET /prototype/sessions
      const resGetSessions = await fetch(`${baseUrl}/prototype/sessions`);
      expect(resGetSessions.status).toBe(401);

      // GET /prototype/sessions/:id
      const resGetSession = await fetch(`${baseUrl}/prototype/sessions/any-id`);
      expect(resGetSession.status).toBe(401);

      // POST /prototype/sessions/:id/prompts
      const resPostPrompt = await fetch(`${baseUrl}/prototype/sessions/any-id/prompts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'test' }),
      });
      expect(resPostPrompt.status).toBe(401);

      // GET /prototype/sessions/:id/diff
      const resDiff = await fetch(`${baseUrl}/prototype/sessions/any-id/diff?from=cp1&to=cp2`);
      expect(resDiff.status).toBe(401);

      // POST /prototype/sessions/:id/promote
      const resPromote = await fetch(`${baseUrl}/prototype/sessions/any-id/promote`, {
        method: 'POST',
      });
      expect(resPromote.status).toBe(401);
    });
  });

  it('2. /prototype/* com API key inválida retorna 401 Unauthorized', async () => {
    const app = createApp(mockTasks, mockPrototypes);
    await withServer(app, async (baseUrl) => {
      const res = await fetch(`${baseUrl}/prototype/sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer wrong-secret',
        },
        body: JSON.stringify({ project: 'test-app' }),
      });
      expect(res.status).toBe(401);
    });
  });

  it('3. /prototype/* com API key correta (Bearer ou X-API-Key) é permitido em todas as rotas', async () => {
    const app = createApp(mockTasks, mockPrototypes);
    await withServer(app, async (baseUrl) => {
      // 1. Create Session with Bearer token
      const resCreate = await fetch(`${baseUrl}/prototype/sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-secret-key-42',
        },
        body: JSON.stringify({ project: 'test-app' }),
      });
      expect(resCreate.status).toBe(201);
      const session = (await resCreate.json()) as any;
      expect(session.id).toBeDefined();

      // 2. List sessions with X-API-Key
      const resList = await fetch(`${baseUrl}/prototype/sessions`, {
        headers: { 'X-API-Key': 'test-secret-key-42' },
      });
      expect(resList.status).toBe(200);
      const list = (await resList.json()) as any[];
      expect(list).toHaveLength(1);

      // 3. Post prompt with Bearer
      const resPrompt = await fetch(`${baseUrl}/prototype/sessions/${session.id}/prompts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-secret-key-42',
        },
        body: JSON.stringify({ prompt: 'Build landing page' }),
      });
      expect(resPrompt.status).toBe(202);
      const promptResult = (await resPrompt.json()) as any;
      expect(promptResult.task).toBeDefined();
    });
  });

  it('4. SSE /prototype/sessions/:id/events aceita autenticação via query param apiKey', async () => {
    const app = createApp(mockTasks, mockPrototypes);
    await withServer(app, async (baseUrl) => {
      // Create session first
      const createRes = await fetch(`${baseUrl}/prototype/sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': 'test-secret-key-42',
        },
        body: JSON.stringify({ project: 'sse-test' }),
      });
      const session = (await createRes.json()) as any;

      // Without key -> 401
      const resWithoutKey = await fetch(`${baseUrl}/prototype/sessions/${session.id}/events`);
      expect(resWithoutKey.status).toBe(401);

      // With query param -> 200 SSE
      const controller = new AbortController();
      const resWithKey = await fetch(`${baseUrl}/prototype/sessions/${session.id}/events?apiKey=test-secret-key-42`, {
        signal: controller.signal,
      });
      expect(resWithKey.status).toBe(200);
      expect(resWithKey.headers.get('content-type')).toContain('text/event-stream');
      controller.abort();
    });
  });
});

describe('P2-SEC-02: Prevenção de Path Traversal no Workspace', () => {
  let rootDir: string;

  beforeEach(async () => {
    rootDir = await mkdtemp(join(tmpdir(), 'sec-workspaces-'));
  });

  afterEach(async () => {
    await rm(rootDir, { recursive: true, force: true }).catch(() => undefined);
  });

  it('5. Workspace válido dentro do root é aprovado e canonicalizado', () => {
    const validPath = join(rootDir, 'session-123');
    const result = validateWorkspacePath(validPath, rootDir);
    expect(result).toBe(validPath);
  });

  it('6. Workspace fora do root é bloqueado', () => {
    expect(() => {
      validateWorkspacePath('/etc/passwd', rootDir);
    }).toThrow(ValidationError);

    expect(() => {
      validateWorkspacePath('C:\\Windows\\System32', rootDir);
    }).toThrow(ValidationError);
  });

  it('7. Path com ../ traversal é bloqueado', () => {
    const traversalPath = join(rootDir, '..', 'other-dir');
    expect(() => {
      validateWorkspacePath(traversalPath, rootDir);
    }).toThrow(ValidationError);

    const deepTraversal = join(rootDir, 'session-1', '..', '..', 'secret');
    expect(() => {
      validateWorkspacePath(deepTraversal, rootDir);
    }).toThrow(ValidationError);
  });

  it('8. Caminho vazio ou tipo inválido é bloqueado', () => {
    expect(() => {
      validateWorkspacePath('', rootDir);
    }).toThrow(ValidationError);

    expect(() => {
      validateWorkspacePath(null as any, rootDir);
    }).toThrow(ValidationError);
  });
});

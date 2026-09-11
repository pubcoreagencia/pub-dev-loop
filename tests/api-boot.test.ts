import { describe, it, expect } from 'vitest';
import { createPpApp } from '../src/pp/api/entry.js';
import { createPdlApp } from '../src/pdl/api/entry.js';

describe('FASE 3 — Testes de Inicialização e Rotas das APIs Desacopladas', () => {
  const mockTasks: any = {
    create: async () => ({ id: 'mock-task-1' }),
    list: async () => [],
    get: async () => null,
    update: async () => null,
    cancel: async () => null,
    retry: async () => null,
  };

  const mockPrototypes: any = {
    listSessions: async () => [{ id: 'mock-sess-1', project: 'test-proj' }],
    getSession: async () => ({ id: 'mock-sess-1', project: 'test-proj' }),
    listCheckpoints: async () => [],
    createSession: async () => ({ id: 'mock-sess-new' }),
    updateSession: async () => ({ id: 'mock-sess-updated' }),
    incrementPromptCount: async () => ({ id: 'mock-sess-1', promptCount: 1 }),
  };

  it('1. createPpApp() instancia app Express com rotas do Prototype sem crashar', () => {
    const app = createPpApp({} as any, mockTasks, mockPrototypes);
    expect(app).toBeDefined();
    expect(typeof app.listen).toBe('function');
  });

  it('2. createPdlApp() instancia app Express com rotas do The Office e Tarefas sem crashar', () => {
    const app = createPdlApp({} as any, mockTasks);
    expect(app).toBeDefined();
    expect(typeof app.listen).toBe('function');
  });
});

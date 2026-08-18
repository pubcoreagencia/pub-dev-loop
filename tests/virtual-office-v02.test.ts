import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ROOM_MAPPING,
  ROOM_COORDINATES,
  STATE_LABELS_PT,
  mapTaskToEvent,
  deriveAgentsFromTasks,
} from '../frontend/src/services/agentAdapter';
import type { Task, TaskState } from '../frontend/src/types/task';

describe('PUB DEV LOOP V0.2 — Virtual Office Control & Adapter', () => {
  const sampleTask: Task = {
    id: 'task-test-1234-5678',
    project: 'pub-dev-loop',
    repository: 'https://github.com/pubcoreagencia/pub-dev-loop.git',
    objective: 'Implementar controles operacionais',
    prompt: 'Criar painel de acoes do operador',
    status: 'RUNNING',
    priority: 10,
    worker: '9router',
    result: {
      provider: '9Router',
      model: 'gemini-3.7-flash',
      durationMs: 45000,
      stdout: 'Executing tool calls...',
    },
    error: null,
    branch: 'worker/9router/task-test-1234-5678',
    commitSha: 'a1b2c3d4e5f6',
    gitStatus: 'clean',
    createdAt: '2026-08-18T12:00:00.000Z',
    updatedAt: '2026-08-18T12:00:45.000Z',
  };

  describe('1. Mapeamento de Estados para Salas', () => {
    it('mapeia QUEUED e ASSIGNED para PLANEJAMENTO', () => {
      expect(ROOM_MAPPING.QUEUED).toBe('PLANEJAMENTO');
      expect(ROOM_MAPPING.ASSIGNED).toBe('PLANEJAMENTO');
    });

    it('mapeia RUNNING para DESENVOLVIMENTO', () => {
      expect(ROOM_MAPPING.RUNNING).toBe('DESENVOLVIMENTO');
    });

    it('mapeia TESTING para TESTES', () => {
      expect(ROOM_MAPPING.TESTING).toBe('TESTES');
    });

    it('mapeia NEEDS_REVIEW para REVISÃO', () => {
      expect(ROOM_MAPPING.NEEDS_REVIEW).toBe('REVISÃO');
    });

    it('mapeia COMPLETED e CANCELLED para LOUNGE', () => {
      expect(ROOM_MAPPING.COMPLETED).toBe('LOUNGE');
      expect(ROOM_MAPPING.CANCELLED).toBe('LOUNGE');
    });

    it('mapeia FAILED e BLOCKED para BLOQUEADOS', () => {
      expect(ROOM_MAPPING.FAILED).toBe('BLOQUEADOS');
      expect(ROOM_MAPPING.BLOCKED).toBe('BLOQUEADOS');
    });

    it('possui coordenadas 3D para todas as salas', () => {
      const rooms = ['PLANEJAMENTO', 'DESENVOLVIMENTO', 'TESTES', 'REVISÃO', 'LOUNGE', 'BLOQUEADOS'] as const;
      for (const room of rooms) {
        expect(ROOM_COORDINATES[room]).toBeDefined();
        expect(ROOM_COORDINATES[room].length).toBe(3);
      }
    });
  });

  describe('2. Derivação de Agentes Reais a partir de Tarefas', () => {
    it('deriva agente com todos os campos necessários', () => {
      const agents = deriveAgentsFromTasks([sampleTask]);
      expect(agents).toHaveLength(1);

      const agent = agents[0];
      expect(agent.id).toBe('agent-9router');
      expect(agent.name).toBe('9Router Worker');
      expect(agent.role).toBe('Engenheiro de Software Autônomo');
      expect(agent.state).toBe('RUNNING');
      expect(agent.room).toBe('DESENVOLVIMENTO');
      expect(agent.provider).toBe('9Router');
      expect(agent.model).toBe('gemini-3.7-flash');
      expect(agent.taskId).toBe('task-test-1234-5678');
      expect(agent.project).toBe('pub-dev-loop');
      expect(agent.repository).toBe('https://github.com/pubcoreagencia/pub-dev-loop.git');
      expect(agent.duration).toBe('45s');
      expect(agent.commitSha).toBe('a1b2c3d4e5f6');
    });

    it('retorna array vazio quando nao ha tarefas', () => {
      const agents = deriveAgentsFromTasks([]);
      expect(agents).toEqual([]);
    });

    it('prioriza tarefas ativas em relacao a tarefas concluidas', () => {
      const tasks: Task[] = [
        { ...sampleTask, id: 'completed-1', status: 'COMPLETED' },
        { ...sampleTask, id: 'running-1', status: 'RUNNING' },
      ];
      const agents = deriveAgentsFromTasks(tasks);
      expect(agents).toHaveLength(1);
      expect(agents[0].taskId).toBe('running-1');
      expect(agents[0].room).toBe('DESENVOLVIMENTO');
    });
  });

  describe('3. Textos e Eventos em PT-BR', () => {
    it('traduz todos os status para rotulos em PT-BR', () => {
      const statuses: TaskState[] = [
        'QUEUED', 'ASSIGNED', 'RUNNING', 'TESTING',
        'COMPLETED', 'FAILED', 'BLOCKED', 'CANCELLED', 'NEEDS_REVIEW',
      ];
      for (const st of statuses) {
        expect(STATE_LABELS_PT[st]).toBeDefined();
        expect(typeof STATE_LABELS_PT[st]).toBe('string');
      }
    });

    it('gera evento contextual em PT-BR para cada status', () => {
      expect(mapTaskToEvent({ ...sampleTask, status: 'QUEUED' })).toContain('fila');
      expect(mapTaskToEvent({ ...sampleTask, status: 'RUNNING' })).toContain('Executando');
      expect(mapTaskToEvent({ ...sampleTask, status: 'TESTING' })).toContain('testes');
      expect(mapTaskToEvent({ ...sampleTask, status: 'COMPLETED' })).toContain('sucesso');
      expect(mapTaskToEvent({ ...sampleTask, status: 'FAILED', error: 'Erro de conexao' })).toContain('Falha');
    });
  });

  describe('4. Seguranca Operacional', () => {
    it('nao expoem API keys, tokens ou DATABASE_URL no agente derivado', () => {
      const taskWithSecret: Task = {
        ...sampleTask,
        result: {
          ...sampleTask.result,
          ROUTER_API_KEY: 'sk-secret-key-1234',
          DATABASE_URL: 'postgres://user:pass@host/db',
        },
      };
      const agents = deriveAgentsFromTasks([taskWithSecret]);
      const serialized = JSON.stringify(agents);

      expect(serialized).not.toContain('sk-secret-key-1234');
      expect(serialized).not.toContain('postgres://user:pass@host/db');
    });
  });
});

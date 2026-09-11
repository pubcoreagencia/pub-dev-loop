import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { PostgresPpTaskRepository } from '../src/pp/persistence/task-repository.js';
import { PostgresTaskRepository } from '../src/repository.js';

describe('FASE 4.2 — Testes Comportamentais Fortes de Isolamento de Banco PP × PDL', () => {
  const rootDir = resolve(process.cwd(), 'src');

  it('1. PpTaskRepository executa queries estritamente contra prototype_tasks', async () => {
    const executedQueries: string[] = [];
    const mockPool: any = {
      query: async (sql: string) => {
        executedQueries.push(sql);
        return { rows: [{ id: 'mock-pp-1', prototype_session_id: 's-1', status: 'QUEUED', priority: 0 }] };
      },
    };

    const ppRepo = new PostgresPpTaskRepository(mockPool);
    await ppRepo.create({
      prototypeSessionId: 's-1',
      project: 'p',
      repository: 'r',
      objective: 'obj',
      prompt: 'prm',
    });
    await ppRepo.list('s-1');
    await ppRepo.claim('worker-pp');

    expect(executedQueries.length).toBeGreaterThan(0);
    for (const q of executedQueries) {
      expect(q).toContain('prototype_tasks');
      expect(q).not.toMatch(/\btasks\b/);
    }
  });

  it('2. PdlTaskRepository executa queries contra tasks e não contra prototype_tasks', async () => {
    const executedQueries: string[] = [];
    const mockPool: any = {
      query: async (sql: string) => {
        executedQueries.push(sql);
        return { rows: [{ id: 'mock-pdl-1', status: 'QUEUED', priority: 0 }] };
      },
    };

    const pdlRepo = new PostgresTaskRepository(mockPool);
    await pdlRepo.create({
      project: 'p',
      repository: 'r',
      objective: 'obj',
      prompt: 'prm',
    });
    await pdlRepo.list();
    await pdlRepo.claim('worker-pdl');

    expect(executedQueries.length).toBeGreaterThan(0);
    for (const q of executedQueries) {
      expect(q).toContain('tasks');
      expect(q).not.toContain('prototype_tasks');
    }
  });

  it('3. PP Worker e Entrypoint usam PpTaskRepository e não importam repository.ts do PDL', () => {
    const ppWorkerPath = resolve(rootDir, 'pp', 'worker', 'prototype-worker.ts');
    const ppWorkerContent = readFileSync(ppWorkerPath, 'utf8');
    expect(ppWorkerContent).not.toMatch(/PostgresTaskRepository/);
    expect(ppWorkerContent).not.toMatch(/claimPrototype/);

    const ppEntryPath = resolve(rootDir, 'pp', 'worker', 'entry.ts');
    const ppEntryContent = readFileSync(ppEntryPath, 'utf8');
    expect(ppEntryContent).not.toMatch(/from '\.\/repository\.js'/);
    expect(ppEntryContent).toContain('PostgresPpTaskRepository');
  });

  it('4. PP API Entrypoint não importa repository.ts do PDL', () => {
    const ppApiPath = resolve(rootDir, 'pp', 'api', 'entry.ts');
    const ppApiContent = readFileSync(ppApiPath, 'utf8');
    expect(ppApiContent).not.toMatch(/from '\.\/repository\.js'/);
    expect(ppApiContent).toContain('PostgresPpTaskRepository');
  });
});

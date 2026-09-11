import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

describe('FASE 2 — Testes de Isolamento Arquitetural entre Workers', () => {
  const rootDir = resolve(process.cwd(), 'src');

  it('1. PrototypeWorker não importa AgentRegistry nem The Office', () => {
    const protoWorkerPath = resolve(rootDir, 'pp', 'worker', 'prototype-worker.ts');
    expect(existsSync(protoWorkerPath)).toBe(true);
    const content = readFileSync(protoWorkerPath, 'utf8');

    expect(content).not.toMatch(/office\/registry/);
    expect(content).not.toMatch(/AgentRegistry/);
    expect(content).not.toMatch(/squads/);
    expect(content).not.toMatch(/RouterWorker/);
    expect(content).not.toMatch(/ModeAwareWorker/);
  });

  it('2. RouterWorker (PDL) não importa PrototypeWorker nem runtimes do PP', () => {
    const routerWorkerPath = resolve(rootDir, 'router-worker.ts');
    expect(existsSync(routerWorkerPath)).toBe(true);
    const content = readFileSync(routerWorkerPath, 'utf8');

    expect(content).not.toMatch(/prototype-worker/);
    expect(content).not.toMatch(/preview-runtime/);
    expect(content).not.toMatch(/local-preview-runtime/);
    expect(content).not.toMatch(/public-preview-runtime/);
    expect(content).not.toMatch(/ModeAwareWorker/);
  });

  it('3. BaseWorker e worker-service (PDL) não importam PrototypeWorker nem runtimes do PP', () => {
    const workerServicePath = resolve(rootDir, 'worker-service.ts');
    expect(existsSync(workerServicePath)).toBe(true);
    const content = readFileSync(workerServicePath, 'utf8');

    expect(content).not.toMatch(/prototype-worker/);
    expect(content).not.toMatch(/preview-runtime/);
    expect(content).not.toMatch(/ModeAwareWorker/);
  });
});

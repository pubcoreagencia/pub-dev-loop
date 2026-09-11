import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

describe('FASE 2 — Testes de Isolamento Arquitetural entre Workers', () => {
  const rootDir = resolve(process.cwd(), 'src');

  it('1. PrototypeWorker e ModeAwareWorker foram completamente removidos do PDL', () => {
    const protoWorkerPath = resolve(rootDir, 'pp', 'worker', 'prototype-worker.ts');
    expect(existsSync(protoWorkerPath)).toBe(false);
    expect(existsSync(resolve(rootDir, 'mode-aware-worker.ts'))).toBe(false);
    expect(existsSync(resolve(rootDir, 'pp'))).toBe(false);
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

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

describe('FASE 3 — Testes de Isolamento Arquitetural entre APIs', () => {
  const rootDir = resolve(process.cwd(), 'src');

  it('1. src/pp-api-entry.ts não importa The Office, AgentRegistry, nem Task Pipeline do PDL', () => {
    const ppApiPath = resolve(rootDir, 'pp', 'api', 'entry.ts');
    expect(existsSync(ppApiPath)).toBe(true);
    const content = readFileSync(ppApiPath, 'utf8');

    expect(content).not.toMatch(/office\/registry/);
    expect(content).not.toMatch(/AgentRegistry/);
    expect(content).not.toMatch(/office\/organization/);
    expect(content).not.toMatch(/office\/intent/);
    expect(content).not.toMatch(/office\/planning/);
    expect(content).not.toMatch(/office\/memory/);
    expect(content).not.toMatch(/RouterWorker/);
    expect(content).not.toMatch(/ModeAwareWorker/);
    expect(content).not.toMatch(/src\/task\//);
  });

  it('2. src/pdl-api-entry.ts não importa Prototype UI, Preview Runtimes, nem SSE do PP', () => {
    const pdlApiPath = resolve(rootDir, 'pdl', 'api', 'entry.ts');
    expect(existsSync(pdlApiPath)).toBe(true);
    const content = readFileSync(pdlApiPath, 'utf8');

    expect(content).not.toMatch(/prototype\/ui/);
    expect(content).not.toMatch(/prototype\/history-ui/);
    expect(content).not.toMatch(/prototype\/local-preview-runtime/);
    expect(content).not.toMatch(/prototype\/public-preview-runtime/);
    expect(content).not.toMatch(/prototype\/comparison-preview/);
    expect(content).not.toMatch(/prototype\/sse/);
    expect(content).not.toMatch(/PrototypeWorker/);
    expect(content).not.toMatch(/ModeAwareWorker/);
  });
});

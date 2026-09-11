import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

describe('FASE 3 — Testes de Isolamento Arquitetural entre APIs', () => {
  const rootDir = resolve(process.cwd(), 'src');

  it('1. src/pp-api-entry.ts foi completamente removido do PDL', () => {
    const ppApiPath = resolve(rootDir, 'pp', 'api', 'entry.ts');
    expect(existsSync(ppApiPath)).toBe(false);
    expect(existsSync(resolve(rootDir, 'pp'))).toBe(false);
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

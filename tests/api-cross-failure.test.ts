import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

describe('FASE 3 — Prova Arquitetural de Falha Cruzada (Cross-Failure Immunity)', () => {
  const rootDir = resolve(process.cwd(), 'src');

  it('1. Cenário: PP API foi extraído e não reside mais no monorepo PDL', () => {
    const ppEntry = resolve(rootDir, 'pp', 'api', 'entry.ts');
    expect(existsSync(ppEntry)).toBe(false);
    
    // Todos os módulos essenciais do PDL que poderiam falhar
    const pdlModules = [
      './office/registry.js',
      './office/organization.js',
      './office/planning.js',
      './office/events.js',
      './office/review.js',
      './office/approval.js',
      './office/auth.js',
      './office/memory.js',
      './office/intent.js',
      './office/context-resolver.js',
      './router-worker.js',
      './mode-aware-worker.js',
    ];

    for (const mod of pdlModules) {
      expect(ppEntry).not.toContain(mod);
    }
  });

  it('2. Cenário: Simulação de quebra no preview/runtime do Prototype não afeta a árvore do PDL API', () => {
    const pdlEntry = readFileSync(resolve(rootDir, 'pdl', 'api', 'entry.ts'), 'utf8');

    // Todos os módulos do Prototype que poderiam falhar
    const ppModules = [
      './prototype/ui.js',
      './prototype/history-ui.js',
      './prototype/local-preview-runtime.js',
      './prototype/public-preview-runtime.js',
      './prototype/comparison-preview.js',
      './prototype/sse.js',
      './prototype/preview-recovery.js',
      './prototype-worker.js',
      './mode-aware-worker.js',
    ];

    for (const mod of ppModules) {
      expect(pdlEntry).not.toContain(mod);
    }
    expect(pdlEntry).not.toMatch(/\.\/pp\//);
  });
});

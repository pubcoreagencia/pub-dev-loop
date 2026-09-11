import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

describe('FASE 4 — Testes de Isolamento de Banco e Repositórios PP × PDL', () => {
  const rootDir = resolve(process.cwd(), 'src');

  it('1. PpTaskRepository opera sobre prototype_tasks e NÃO sobre a tabela tasks', () => {
    const ppRepoPath = resolve(rootDir, 'pp', 'persistence', 'task-repository.ts');
    expect(existsSync(ppRepoPath)).toBe(true);
    const content = readFileSync(ppRepoPath, 'utf8');

    expect(content).toContain('prototype_tasks');
    // Não pode fazer queries diretamente na tabela `tasks`
    expect(content).not.toMatch(/FROM tasks\b/i);
    expect(content).not.toMatch(/INTO tasks\b/i);
    expect(content).not.toMatch(/UPDATE tasks\b/i);
  });

  it('2. PdlTaskRepository opera sobre tasks e NÃO sobre prototype_tasks', () => {
    const pdlRepoPath = resolve(rootDir, 'repository.ts');
    expect(existsSync(pdlRepoPath)).toBe(true);
    const content = readFileSync(pdlRepoPath, 'utf8');

    expect(content).toContain('tasks');
    expect(content).not.toContain('prototype_tasks');
  });

  it('3. Migration 019_prototype_tasks.sql existe e define schema e migração segura', () => {
    const migrationPath = resolve(process.cwd(), 'db', 'migrations', '019_prototype_tasks.sql');
    expect(existsSync(migrationPath)).toBe(true);
    const sql = readFileSync(migrationPath, 'utf8');

    expect(sql).toContain('CREATE TABLE IF NOT EXISTS prototype_tasks');
    expect(sql).toContain('prototype_session_id');
    expect(sql).toContain('INSERT INTO prototype_tasks');
  });

  it('4. Domínio PP possui contratos canônicos PrototypeTask e PpTaskRepository', () => {
    const ppDomainPath = resolve(rootDir, 'pp', 'domain', 'domain.ts');
    const content = readFileSync(ppDomainPath, 'utf8');

    expect(content).toContain('export interface PrototypeTask');
    expect(content).toContain('export interface PpTaskRepository');
    expect(content).toContain('export type PrototypeTaskStatus');
  });

  it('5. handoff.ts NÃO importa src/domain.ts nem a entidade Task do PDL', () => {
    const handoffPath = resolve(rootDir, 'pp', 'handoff', 'handoff.ts');
    const content = readFileSync(handoffPath, 'utf8');

    expect(content).not.toMatch(/from\s+['"]\.\.\/domain(\.js)?['"]/);
    expect(content).not.toMatch(/import\s+.*?\bTask\b.*?from/);
  });

  it('6. PdlTaskIngestionPort expõe apenas ingest() e NÃO expõe create/list/get/update nem retorna Task', () => {
    const handoffPath = resolve(rootDir, 'pp', 'handoff', 'handoff.ts');
    const content = readFileSync(handoffPath, 'utf8');

    // Isola o trecho da interface PdlTaskIngestionPort
    const portMatch = content.match(/export interface PdlTaskIngestionPort\s*\{([\s\S]*?)\}/);
    expect(portMatch).not.toBeNull();
    const portBody = portMatch![1];

    expect(portBody).toContain('ingest(');
    expect(portBody).not.toMatch(/\b(create|list|get|update)\b/);
    expect(portBody).not.toMatch(/:\s*Promise<\s*Task\s*>/);
    expect(portBody).not.toMatch(/:\s*Task\b/);
  });

  it('7. PdlTaskIngestionAdapter reside no PDL, conhece PostgresTaskRepository e implementa PdlTaskIngestionPort', () => {
    const adapterPath = resolve(rootDir, 'pdl', 'handoff', 'adapter.ts');
    expect(existsSync(adapterPath)).toBe(true);
    const content = readFileSync(adapterPath, 'utf8');

    expect(content).toContain('class PdlTaskIngestionAdapter implements PdlTaskIngestionPort');
    expect(content).toContain('PostgresTaskRepository');
    expect(content).toContain("from '../../domain.js'");
  });
});

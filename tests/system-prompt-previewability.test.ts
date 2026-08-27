import { describe, expect, it } from 'vitest';
import { SHARED_SYSTEM_INSTRUCTIONS, PREVIEW_SYSTEM_INSTRUCTIONS, isPrototypeTask } from '../src/providers/shared.js';

/**
 * These tests verify the conditional previewability instructions that are
 * added to the system prompt when a task objective indicates a Prototype
 * session (web app, site, dashboard, SaaS, etc.).
 *
 * They do NOT test the providers' execute() path directly — they test the
 * shared helpers that both providers use to build their system prompt.
 */

// ── Helper: minimal Task-like object ─────────────────────────────────────

function makeTask(objective: string) {
  return { id: 'TASK-TEST', project: 'p', repository: 'r', objective, prompt: 'do it', status: 'RUNNING' as const, priority: 0, worker: null, result: null, error: null, branch: null, commitSha: null, gitStatus: null, createdAt: new Date(), updatedAt: new Date() } as any;
}

// ── isPrototypeTask: prototype / web / SaaS detection ───────────────────

describe('isPrototypeTask', () => {
  it('returns true for objectives containing "prototype"', () => {
    expect(isPrototypeTask(makeTask('Prototype MVP iteration'))).toBe(true);
    expect(isPrototypeTask(makeTask('Prototype dashboard for analytics'))).toBe(true);
  });

  it('returns true for objectives containing "preview"', () => {
    expect(isPrototypeTask(makeTask('Preview app for client'))).toBe(true);
  });

  it('returns true for objectives containing "web"', () => {
    expect(isPrototypeTask(makeTask('Create a web application'))).toBe(true);
  });

  it('returns true for objectives containing "site"', () => {
    expect(isPrototypeTask(makeTask('Build a landing site'))).toBe(true);
  });

  it('returns true for objectives containing "SaaS"', () => {
    expect(isPrototypeTask(makeTask('Create a SaaS dashboard'))).toBe(true);
  });

  it('returns true for objectives containing "dashboard"', () => {
    expect(isPrototypeTask(makeTask('Build a dashboard'))).toBe(true);
  });

  it('returns true for objectives containing Portuguese "prototipo"/"protótipo"', () => {
    expect(isPrototypeTask(makeTask('prototipo web'))).toBe(true);
    expect(isPrototypeTask(makeTask('protótipo SaaS'))).toBe(true);
  });

  it('returns false for non-web objectives (Python CLI, API, etc.)', () => {
    expect(isPrototypeTask(makeTask('Crie uma API Python'))).toBe(false);
    expect(isPrototypeTask(makeTask('Crie uma ferramenta CLI em Python'))).toBe(false);
    expect(isPrototypeTask(makeTask('Implement feature'))).toBe(false);
    expect(isPrototypeTask(makeTask('Test openrouter provider'))).toBe(false);
    expect(isPrototypeTask(makeTask('Refactor backend services'))).toBe(false);
  });

  it('returns false for empty/null objective', () => {
    expect(isPrototypeTask(makeTask(''))).toBe(false);
    expect(isPrototypeTask({...makeTask('test'), objective: null})).toBe(false);
    expect(isPrototypeTask({...makeTask('test'), objective: undefined})).toBe(false);
  });
});

// ── PREVIEW_SYSTEM_INSTRUCTIONS content ──────────────────────────────────

describe('PREVIEW_SYSTEM_INSTRUCTIONS', () => {
  it('contains STATIC guidance (index.html)', () => {
    const text = PREVIEW_SYSTEM_INSTRUCTIONS.join('\n');
    expect(text).toContain('STATIC');
    expect(text).toContain('index.html');
    expect(text).toContain('styles.css');
    expect(text).toContain('script.js');
  });

  it('contains NODE guidance (package.json + dev script)', () => {
    const text = PREVIEW_SYSTEM_INSTRUCTIONS.join('\n');
    expect(text).toContain('NODE');
    expect(text).toContain('package.json');
    expect(text.toLowerCase()).toContain('script "dev"');
    expect(text).toContain('index.js');
    expect(text).toContain('server.js');
  });

  it('explicitly says NOT to generate non-previewable projects for web requests', () => {
    const text = PREVIEW_SYSTEM_INSTRUCTIONS.join('\n');
    expect(text.toLowerCase()).toMatch(/não.*previewáveis|not.*previewable/i);
  });

  it('says to verify the project can be started/served after generating', () => {
    const text = PREVIEW_SYSTEM_INSTRUCTIONS.join('\n');
    expect(text).toMatch(/verifique|verify/i);
    expect(text).toContain('npm run dev');
  });
});

// ── SHARED_SYSTEM_INSTRUCTIONS regression ──────────────────────────────────

describe('SHARED_SYSTEM_INSTRUCTIONS regression', () => {
  it('does NOT contain preview/web-specific instructions', () => {
    const text = SHARED_SYSTEM_INSTRUCTIONS.join('\n');
    expect(text).not.toContain('STATIC');
    expect(text).not.toContain('package.json');
    expect(text).not.toContain('index.html');
    expect(text).not.toContain('npm run dev');
  });

  it('still contains all original generic instructions', () => {
    const text = SHARED_SYSTEM_INSTRUCTIONS.join('\n');
    expect(text).toContain('PUB DEV LOOP');
    expect(text).toContain('workspace');
    expect(text).toContain('git_commit');
    expect(text).toContain('git operations');
  });
});

// ── Integration: system prompt should include/exclude preview instructions ─

describe('System prompt previewability integration', () => {
  // We test the logic by simulating what buildSystemPrompt does.
  // Both router.ts and openrouter.ts use the same pattern:
  //   instructions = [provider-specific first line, ...SHARED_SYSTEM_INSTRUCTIONS.slice(1)]
  //   if (isPrototypeTask(task)) instructions.push(...PREVIEW_SYSTEM_INSTRUCTIONS)

  function buildSystemPromptContent(task: Task) {
    const instructions = [
      `You are a coding agent for PUB DEV LOOP.`,
      ...SHARED_SYSTEM_INSTRUCTIONS.slice(1),
    ];
    if (isPrototypeTask(task)) {
      instructions.push(...PREVIEW_SYSTEM_INSTRUCTIONS);
    }
    return instructions.join('\n');
  }

  it('includes previewability instructions when objective is "Prototype MVP iteration"', () => {
    const prompt = buildSystemPromptContent(makeTask('Prototype MVP iteration'));
    expect(prompt).toContain('STATIC');
    expect(prompt).toContain('package.json');
    expect(prompt).toContain('index.html');
  });

  it('includes previewability instructions for web site requests', () => {
    const prompt = buildSystemPromptContent(makeTask('Crie um site de lista de tarefas'));
    expect(prompt).toContain('previewável');
    expect(prompt).toContain('package.json');
  });

  it('includes previewability instructions for SaaS dashboard requests', () => {
    const prompt = buildSystemPromptContent(makeTask('Crie um dashboard SaaS para uma oficina'));
    expect(prompt).toContain('STATIC');
    expect(prompt).toContain('NODE');
    expect(prompt).toContain('package.json');
  });

  it('does NOT include previewability instructions for non-web tasks (Python CLI)', () => {
    const prompt = buildSystemPromptContent(makeTask('Crie uma ferramenta CLI em Python para organizar arquivos'));
    expect(prompt).not.toContain('STATIC');
    expect(prompt).not.toContain('package.json');
    expect(prompt).not.toContain('index.html');
  });

  it('does NOT include previewability instructions for generic tasks', () => {
    const prompt = buildSystemPromptContent(makeTask('Test openrouter provider'));
    expect(prompt).not.toContain('STATIC');
    expect(prompt).not.toContain('package.json');
  });
});

// ── Type import for the helper ─────────────────────────────────────────────
type Task = { id: string; objective: string; prompt: string };

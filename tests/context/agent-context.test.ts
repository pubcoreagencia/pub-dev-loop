import { describe, it, expect } from 'vitest';
import { AgentContext, findAgentDir } from '../../src/context/agent-context.js';
import { join } from 'node:path';
import { writeFileSync, mkdirSync, rmSync, existsSync, mkdirSync as mkdirSyncCb } from 'node:fs';

describe('AgentContext — Context Loading', () => {
  it('loads complete context from .agent/ directory', async () => {
    const ctx = await AgentContext.load();
    expect(ctx.agentDir).toContain('.agent');
    expect(ctx.loaded.masterContext).toContain('PUB DEV LOOP');
    expect(ctx.loaded.currentState).toContain('main');
    expect(ctx.loaded.tasks).toContain('TASK-');
    expect(ctx.loaded.decisions).toContain('Decisions');
    expect(ctx.loaded.handoff).toContain('Handoff');
  });

  it('parses current task from HANDOFF.md', async () => {
    const ctx = await AgentContext.load();
    // HANDOFF.md has CURRENT_TASK
    expect(ctx.getCurrentTask()).toBeDefined();
  });

  it('parses next task from HANDOFF.md', async () => {
    const ctx = await AgentContext.load();
    expect(ctx.getNextTask()).toBeDefined();
  });

  it('parses known limitations from context', async () => {
    const ctx = await AgentContext.load();
    const lims = ctx.getKnownLimitations();
    expect(Array.isArray(lims)).toBe(true);
    // Deve ter pelo menos as limitations documentadas
    expect(lims.some(l => l.includes('CODEX_CLI_UNAVAILABLE') || l.includes('Codex'))).toBe(true);
  });

  it('finds last completed task from TASKS.md', async () => {
    const ctx = await AgentContext.load();
    const last = ctx.getLastCompletedTask();
    // TASK-000025 foi a última COMPLETE
    expect(last).toBeDefined();
    expect(last).toMatch(/TASK-0000(24|25)/);
  });

  it('throws when .agent/ directory does not exist', async () => {
    // Point to a temp dir that doesn't have .agent/
    const tmp = join(process.cwd(), 'tmp-no-agent-test');
    mkdirSync(tmp, { recursive: true });
    try {
      await expect(AgentContext.load(tmp)).rejects.toThrow(/CONTEXT NOT FOUND/);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('throws when required file is missing', async () => {
    const badDir = join(process.cwd(), 'tmp-partial-agent');
    const agentDir = join(badDir, '.agent');
    mkdirSync(agentDir, { recursive: true });
    writeFileSync(join(agentDir, 'MASTER_CONTEXT.md'), '# test');
    writeFileSync(join(agentDir, 'CURRENT_STATE.md'), '# test');
    // Deliberately NOT creating TASKS.md, DECISIONS.md, HANDOFF.md
    try {
      await expect(AgentContext.load(badDir)).rejects.toThrow(/CONTEXT INCOMPLETE/);
      expect(await AgentContext.load(badDir).catch(() => null)).toBeNull();
    } finally {
      rmSync(badDir, { recursive: true, force: true });
    }
  });

  it('getSummary returns consolidated context', async () => {
    const ctx = await AgentContext.load();
    const s = ctx.getSummary();
    expect(s).toHaveProperty('currentTask');
    expect(s).toHaveProperty('nextTask');
    expect(s).toHaveProperty('lastCompletedTask');
    expect(s).toHaveProperty('limitations');
    expect(s).toHaveProperty('agentDir');
    expect(s.limitations.length).toBeGreaterThan(0);
  });
});

describe('AgentContext — findAgentDir', () => {
  it('finds .agent/ in project root', () => {
    const dir = findAgentDir();
    expect(dir).not.toBeNull();
    expect(dir).toContain('.agent');
  });

  it('returns null for directory without .agent/', () => {
    const tmp = join(process.cwd(), 'tmp-no-agent-find');
    mkdirSync(tmp, { recursive: true });
    try {
      const dir = findAgentDir(tmp);
      expect(dir).toBeNull();
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});

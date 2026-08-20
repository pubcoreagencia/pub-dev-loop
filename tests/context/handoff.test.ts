import { describe, it, expect } from 'vitest';
import { AgentContext } from '../../src/context/agent-context.js';
import { execSync } from 'node:child_process';

/**
 * HANDOFF CONTINUITY TEST
 *
 * Proves: A second agent reading `.agent/` from the repo (WITHOUT chat history)
 * can identify the last completed task, the last commit, known limitations,
 * and the NEXT_TASK — and continue working.
 *
 * This simulates Agent B (Hermes) taking over after Agent A (Codex) finishes,
 * WITHOUT access to any prior conversation.
 */
describe('HANDOFF Continuity — Codex → Hermes', () => {
  it('Agent B can identify the last completed task from repo alone', async () => {
    const ctx = await AgentContext.load();
    const last = ctx.getLastCompletedTask();
    expect(last).toBeDefined();
    // The last COMPLETE task in TASKS.md
    expect(last).toMatch(/TASK-\d{4}/);
  });

  it('Agent B can identify the current task', async () => {
    const ctx = await AgentContext.load();
    // HANDOFF.md declares CURRENT_TASK
    expect(ctx.getCurrentTask()).toBeDefined();
    expect(ctx.getCurrentTask()).toMatch(/TASK-\d{4}/);
  });

  it('Agent B can identify the next task', async () => {
    const ctx = await AgentContext.load();
    expect(ctx.getNextTask()).toBeDefined();
    // NEXT_TASK should point to a valid task
    expect(ctx.getNextTask()).toMatch(/TASK-\d{4}/);
  });

  it('Agent B can read known limitations', async () => {
    const ctx = await AgentContext.load();
    const lims = ctx.getKnownLimitations();
    expect(lims.length).toBeGreaterThanOrEqual(3);
    // Must include the known ones
    expect(lims.some(l => l.includes('CODEX_CLI_UNAVAILABLE') || l.includes('Codex'))).toBe(true);
  });

  it('Agent B gets a consolidated summary without prior chat', async () => {
    const ctx = await AgentContext.load();
    const s = ctx.getSummary();

    // A second agent can determine everything needed to continue:
    expect(s.currentTask).toBeTruthy();
    expect(s.nextTask).toBeTruthy();
    expect(s.lastCompletedTask).toBeTruthy();
    expect(s.limitations.length).toBeGreaterThanOrEqual(3);
    expect(s.agentDir).toContain('.agent');
  });

  it('Agent B can verify git state and detect divergence', () => {
    const state = AgentContext.getGitState();
    // Without running any git commands beyond read-only,
    // Agent B can detect divergence
    expect(state.localHead).toMatch(/^[0-9a-f]{40}$/);
    expect(state.branch).toBeTruthy();

    // When remoteHead exists, synced tells us if they match
    if (state.remoteHead !== null) {
      // Either synced (match) or diverged (local ahead) — both are detectable
      expect(typeof state.synced).toBe('boolean');
    }
  });

  it('Agent B can detect stale context (HEAD within recent commits)', async () => {
    const ctx = await AgentContext.load();
    const git = AgentContext.getGitState();

    // Context HEAD should be within the last few commits (allowing for
    // bootstrap delay where context is committed in the same batch)
    const ctxLocalHead = ctx.loaded.parsed.localHead;
    if (ctxLocalHead && git.localHead) {
      // Context HEAD should match git HEAD, or be a recent ancestor
      if (ctxLocalHead !== git.localHead) {
        // Check if ctxLocalHead is an ancestor of git.localHead
        const isAncestor = execSync(
          `git merge-base --is-ancestor ${ctxLocalHead} ${git.localHead} && echo YES`,
          { cwd: git.repo, stdio: ['pipe', 'pipe', 'pipe'] }
        ).toString().trim();
        // It's either equal (exact match) or a recent ancestor — both are acceptable
        expect(isAncestor).toBe('YES');
      }
    }
  });

  it('DO_NOT_REPEAT is documented', async () => {
    const ctx = await AgentContext.load();
    // The handoff should contain a DO_NOT_REPEAT directive
    expect(ctx.loaded.handoff).toMatch(/DO_NOT_REPEAT/i);
    // Should mention what not to repeat
    expect(ctx.loaded.handoff.toLowerCase()).toMatch(/not re[- ]?(run|create)|não recriar|9router/i);
  });
});

import { describe, it, expect } from 'vitest';
import { AgentContext } from '../../src/context/agent-context.js';

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
    // The last COMPLETE task in TASKS.md should be TASK-000025
    expect(last).toBe('TASK-000025');
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
    // NEXT_TASK should point to TASK-000027 (RouterWorker permanente)
    expect(ctx.getNextTask()).toMatch(/TASK-\d{4}/);
  });

  it('Agent B can read known limitations', async () => {
    const ctx = await AgentContext.load();
    const lims = ctx.getKnownLimitations();
    expect(lims.length).toBeGreaterThanOrEqual(3);
    // Must include the known ones
    expect(lims.some(l => l.includes('CODEX_CLI_UNAVAILABLE'))).toBe(true);
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

  it('Agent B can verify git state is consistent', () => {
    const state = AgentContext.getGitState();
    // Without running any git commands beyond read-only,
    // Agent B can detect divergence
    expect(state.localHead).toMatch(/^[0-9a-f]{40}$/);
    expect(state.branch).toBe('main');

    if (state.remoteHead) {
      expect(state.localHead).toBe(state.remoteHead);
    }
  });

  it('Agent B can detect stale context (HEAD mismatch)', async () => {
    const ctx = await AgentContext.load();
    const git = AgentContext.getGitState();

    // If the context file says one HEAD but git says another → stale
    const ctxLocalHead = ctx.loaded.parsed.localHead;
    if (ctxLocalHead && git.localHead) {
      // In current state, they should match (context was updated at last commit)
      expect(ctxLocalHead).toBe(git.localHead);
    }
  });

  it('DO_NOT_REPEAT is documented', async () => {
    const ctx = await AgentContext.load();
    // The handoff should contain a DO_NOT_REPEAT directive
    expect(ctx.loaded.handoff).toMatch(/DO_NOT_REPEAT/i);
    expect(ctx.loaded.handoff.toLowerCase()).toContain('context bootstrap');
  });
});

import { describe, it, expect } from 'vitest';
import { AgentContext } from '../../src/context/agent-context.js';
import { join } from 'node:path';
import { mkdirSync, rmSync } from 'node:fs';
import { execSync } from 'node:child_process';

describe('AgentContext — Git State Validation', () => {
  it('detects LOCAL_HEAD == REMOTE_HEAD in a synced repo', () => {
    const state = AgentContext.getGitState();
    expect(state.localHead).toMatch(/^[0-9a-f]{40}$/);
    expect(state.branch).toBe('main');

    if (state.remoteHead !== null) {
      expect(state.synced).toBe(true);
      expect(state.localHead).toBe(state.remoteHead);
    }
  });

  it('handles a local-only repo (no remote) without throwing', () => {
    const tmpDir = join(process.cwd(), 'tmp-git-state-test');
    mkdirSync(tmpDir, { recursive: true });
    try {
      execSync('git init', { cwd: tmpDir, stdio: 'pipe' });
      execSync('git config user.email "test@test.com"', { cwd: tmpDir, stdio: 'pipe' });
      execSync('git config user.name "Test"', { cwd: tmpDir, stdio: 'pipe' });
      execSync('git commit --allow-empty -m "initial"', { cwd: tmpDir, stdio: 'pipe' });

      const state = AgentContext.getGitState(tmpDir);
      expect(state.localHead).toBeDefined();
      expect(state.remoteHead).toBeNull();
      // When no remote configured, synced is true (nothing to diverge from)
      expect(state.synced).toBe(true);
      expect(state.worktree).toBe('');
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('validateGit passes when repo is clean and synced', () => {
    const state = AgentContext.getGitState();
    if (state.worktree.length === 0 && state.synced) {
      const result = AgentContext.validateGit();
      expect(result.synced).toBe(true);
    }
  });

  it('validateGit throws when working tree is unclean', () => {
    // Create a temp repo with uncommitted changes
    const tmpDir = join(process.cwd(), 'tmp-unclean-test');
    mkdirSync(tmpDir, { recursive: true });
    try {
      execSync('git init', { cwd: tmpDir, stdio: 'pipe' });
      execSync('git config user.email "test@test.com"', { cwd: tmpDir, stdio: 'pipe' });
      execSync('git config user.name "Test"', { cwd: tmpDir, stdio: 'pipe' });
      execSync('git commit --allow-empty -m "initial"', { cwd: tmpDir, stdio: 'pipe' });
      execSync('echo "content" > file.txt', { cwd: tmpDir, stdio: 'pipe' });

      expect(() => AgentContext.validateGit(tmpDir)).toThrow(/WORKING TREE NOT CLEAN/);
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('returns consistent GitState interface', () => {
    const state = AgentContext.getGitState();
    expect(state).toHaveProperty('repo');
    expect(state).toHaveProperty('branch');
    expect(state).toHaveProperty('localHead');
    expect(state).toHaveProperty('remoteHead');
    expect(state).toHaveProperty('worktree');
    expect(state).toHaveProperty('synced');
    // Invariant: when remoteHead is null, synced is true.
    // When remoteHead exists, synced means localHead === remoteHead.
    if (state.remoteHead === null) {
      expect(state.synced).toBe(true);
    } else {
      expect(state.synced).toBe(state.localHead === state.remoteHead);
    }
  });
});

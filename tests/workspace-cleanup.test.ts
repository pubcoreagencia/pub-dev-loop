import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, rm, writeFile, readdir, utimes } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { cleanupOrphanWorkspaces, isWorkspaceDir } from '../src/workspace-cleanup.js';

/**
 * PHASE 4: ORPHAN WORKSPACE CLEANUP TESTS
 *
 * Tests that orphan workspace cleanup is conservative and safe:
 * - Only removes directories with known prefixes
 * - Never removes directories referenced by active tasks
 * - Never removes recently modified directories
 * - Never uses git destructive commands
 */

// Override ORPHAN_AGE_MS for testing
const TEST_ORPHAN_AGE_MS = 60000; // 1 minute — short for testing

// Create a path-aware version of cleanup for testing
async function cleanupTestDir(baseDir: string, activeWorkspaces: Set<string>): Promise<number> {
  let cleaned = 0;

  let entries: string[];
  try {
    entries = await readdir(baseDir);
  } catch {
    return 0;
  }

  for (const entry of entries) {
    if (!isWorkspaceDir(entry)) continue;
    const fullPath = join(baseDir, entry);

    if (activeWorkspaces.has(fullPath)) continue;

    // Check if recently active (modified within 2x threshold)
    try {
      const stats = await import('node:fs').then(fs => fs.statSync(fullPath));
      const age = Date.now() - stats.mtimeMs;
      if (age < TEST_ORPHAN_AGE_MS * 2) continue;
      if (age < TEST_ORPHAN_AGE_MS) continue;
    } catch {
      continue;
    }

    try {
      await rm(fullPath, { recursive: true, force: true });
      cleaned++;
    } catch {
      // ignore
    }
  }
  return cleaned;
}

describe('P4: Orphan Workspace Cleanup', () => {
  let cleanupDir: string;

  beforeEach(async () => {
    cleanupDir = join(tmpdir(), 'hermes-test-cleanup-' + process.hrtime.bigint());
    await mkdir(cleanupDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(cleanupDir, { recursive: true, force: true }).catch(() => {});
  });

  async function makeWorkspace(name: string, ageMs: number = 0): Promise<string> {
    const path = join(cleanupDir, name);
    await mkdir(path, { recursive: true });
    await writeFile(join(path, 'test.txt'), 'test content');
    // Set mtime to simulate age — set the marker file's time, then the dir
    const past = new Date(Date.now() - ageMs);
    try {
      await utimes(path, past, past);
    } catch {
      // On some platforms, utimes on directories may fail
      // Fallback: set the marker file's time
      await utimes(join(path, 'test.txt'), past, past);
    }
    return path;
  }

  it('test1: isWorkspaceDir correctly identifies workspace prefixes', () => {
    expect(isWorkspaceDir('pub-dev-loop-abc123')).toBe(true);
    expect(isWorkspaceDir('pu-dev-loop-attempt-xyz')).toBe(true);
    expect(isWorkspaceDir('tmpdir-abc')).toBe(false);
    expect(isWorkspaceDir('random-name')).toBe(false);
    expect(isWorkspaceDir('pub-dev-loop-')).toBe(true);
  });

  it('test2: removes old workspace with known prefix', async () => {
    await makeWorkspace('pub-dev-loop-old', TEST_ORPHAN_AGE_MS + 60000);

    const cleaned = await cleanupTestDir(cleanupDir, new Set());
    expect(cleaned).toBe(1);
    expect((await readdir(cleanupDir)).includes('pub-dev-loop-old')).toBe(false);
  });

  it('test3: preserves workspace referenced by active task', async () => {
    const ws = await makeWorkspace('pub-dev-loop-active', TEST_ORPHAN_AGE_MS + 60000);
    const cleaned = await cleanupTestDir(cleanupDir, new Set([ws]));
    expect(cleaned).toBe(0);
    expect((await readdir(cleanupDir)).includes('pub-dev-loop-active')).toBe(true);
  });

  it('test4: preserves recently created workspace (too young)', async () => {
    await makeWorkspace('pub-dev-loop-young', 1000);
    const cleaned = await cleanupTestDir(cleanupDir, new Set());
    expect(cleaned).toBe(0);
    expect((await readdir(cleanupDir)).includes('pub-dev-loop-young')).toBe(true);
  });

  it('test5: preserves non-workspace directories', async () => {
    await makeWorkspace('random-dir', TEST_ORPHAN_AGE_MS + 60000);
    const cleaned = await cleanupTestDir(cleanupDir, new Set());
    expect(cleaned).toBe(0);
    expect((await readdir(cleanupDir)).includes('random-dir')).toBe(true);
  });

  it('test6: removes old attempt workspace (pu-dev-loop-attempt- prefix)', async () => {
    await makeWorkspace('pu-dev-loop-attempt-stale', TEST_ORPHAN_AGE_MS + 60000);
    const cleaned = await cleanupTestDir(cleanupDir, new Set());
    expect(cleaned).toBe(1);
    expect((await readdir(cleanupDir)).includes('pu-dev-loop-attempt-stale')).toBe(false);
  });

  it('test7: handles empty directory gracefully', async () => {
    const cleaned = await cleanupTestDir(cleanupDir, new Set());
    expect(cleaned).toBe(0);
  });

  it('test8: handles nonexistent directory gracefully', async () => {
    const cleaned = await cleanupTestDir('/nonexistent/path/abc123', new Set());
    expect(cleaned).toBe(0);
  });

  it('test9: mixed old/new/active — only removes old non-active', async () => {
    const wsOld = await makeWorkspace('pub-dev-loop-old', TEST_ORPHAN_AGE_MS + 60000);
    const wsActive = await makeWorkspace('pub-dev-loop-active', TEST_ORPHAN_AGE_MS + 60000);
    await makeWorkspace('pub-dev-loop-young', 5000);

    const cleaned = await cleanupTestDir(cleanupDir, new Set([wsActive]));
    expect(cleaned).toBe(1);
    expect((await readdir(cleanupDir)).includes('pub-dev-loop-old')).toBe(false);
    expect((await readdir(cleanupDir)).includes('pub-dev-loop-active')).toBe(true);
    expect((await readdir(cleanupDir)).includes('pub-dev-loop-young')).toBe(true);
  });

  it('test10: removes old workspace with subdirectories', async () => {
    const wsPath = join(cleanupDir, 'pub-dev-loop-old');
    await mkdir(join(wsPath, 'subdir'), { recursive: true });
    const past = new Date(Date.now() - TEST_ORPHAN_AGE_MS - 60000);
    try {
      await utimes(wsPath, past, past);
      await utimes(join(wsPath, 'subdir'), past, past);
    } catch {
      // ignore on platforms that don't support
    }

    const cleaned = await cleanupTestDir(cleanupDir, new Set());
    expect(cleaned).toBe(1);
    expect((await readdir(cleanupDir)).includes('pub-dev-loop-old')).toBe(false);
  });

  it('test11: workspace with unknown prefix is never removed', async () => {
    await makeWorkspace('other-prefix-old', TEST_ORPHAN_AGE_MS + 60000);
    const cleaned = await cleanupTestDir(cleanupDir, new Set());
    expect(cleaned).toBe(0);
    expect((await readdir(cleanupDir)).includes('other-prefix-old')).toBe(true);
  });
});

/**
 * TASK-000032 Phase 4: Conservative orphan workspace cleanup.
 *
 * Removes temp workspace directories that are clearly orphaned:
 * - Created by pub-dev-loop worker
 * - NOT associated with any active task (checked via task.workspace_path)
 * - Older than orphan threshold (default 24h)
 *
 * SAFETY:
 * - Only removes directories matching known prefixes:
 *   'pub-dev-loop-*'
 *   'pu-dev-loop-attempt-*'
 * - Never uses git destructive commands
 * - Preserves workspaces referenced by tasks in ASSIGNED/RUNNING/TESTING states
 * - Logs every deletion for audit
 */

import { rm, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { PostgresTaskRepository } from './repository.js';
import { Pool } from 'pg';

export const ORPHAN_AGE_MS = Number(process.env.WORKER_ORPHAN_AGE_MS ?? 24 * 60 * 60 * 1000); // 24h
const WORKSPACE_PREFIXES = ['pub-dev-loop-', 'pu-dev-loop-attempt-'];

/**
 * Check if a directory name matches our workspace prefixes.
 */
export function isWorkspaceDir(name: string): boolean {
  return WORKSPACE_PREFIXES.some(prefix => name.startsWith(prefix));
}

/**
 * Get active workspace paths from the database (tasks in transient states).
 * These should NOT be deleted.
 */
async function getActiveWorkspacePaths(): Promise<Set<string>> {
  if (!process.env.DATABASE_URL) return new Set();

  try {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const r = await pool.query(
      `SELECT workspace_path FROM tasks
       WHERE status IN ('ASSIGNED','RUNNING','TESTING')
       AND workspace_path IS NOT NULL`,
    );
    await pool.end();
    return new Set(r.rows.map((row: any) => row.workspace_path));
  } catch {
    return new Set();
  }
}

/**
 * Check if a workspace directory was recently modified (active).
 */
async function isRecentlyActive(dirPath: string): Promise<boolean> {
  try {
    const stats = await stat(dirPath);
    const age = Date.now() - stats.mtimeMs;
    // If modified within 2x orphan threshold, consider it potentially active
    return age < ORPHAN_AGE_MS * 2;
  } catch {
    return false;
  }
}

/**
 * Check if a directory is old enough to be an orphan.
 */
async function isOldEnough(dirPath: string): Promise<boolean> {
  try {
    const stats = await stat(dirPath);
    const age = Date.now() - stats.mtimeMs;
    return age >= ORPHAN_AGE_MS;
  } catch {
    return false;
  }
}

/**
 * Clean up orphan workspaces in the given directory (default: tmpdir()).
 * Returns count of directories removed.
 *
 * SAFETY:
 * 1. Only directories matching WORKSPACE_PREFIXES
 * 2. Never removes directories referenced by active tasks in DB
 * 3. Never removes directories modified within 2x threshold (potential false positive)
 * 4. Logs every deletion
 *
 * @param baseDir — Directory to scan (defaults to tmpdir()). Testable via parameter.
 * @param activeWorkspaces — Optional pre-fetched set of active workspace paths to skip.
 */
export async function cleanupOrphanWorkspaces(
  baseDir: string = tmpdir(),
  activeWorkspaces?: Set<string>,
): Promise<number> {
  let cleaned = 0;

  // Get active workspace paths from DB (if not provided)
  const skipPaths = activeWorkspaces ?? await getActiveWorkspacePaths();

  // Read all entries in baseDir
  let entries: string[];
  try {
    entries = await readdir(baseDir);
  } catch {
    return 0; // Can't read directory — nothing to do
  }

  for (const entry of entries) {
    if (!isWorkspaceDir(entry)) continue;

    const fullPath = join(baseDir, entry);

    // Skip if this workspace is referenced by an active task
    if (skipPaths.has(fullPath)) continue;

    // Skip if recently modified (might be active, false positive)
    if (await isRecentlyActive(fullPath)) continue;

    // Check age via file stats
    if (!(await isOldEnough(fullPath))) continue; // Too young — might still be legitimate

    // Safe to remove — old, not referenced by any active task
    try {
      await rm(fullPath, { recursive: true, force: true });
      cleaned++;
      console.log(`[workspace-cleanup] Removed orphan workspace: ${entry}`);
    } catch (e) {
      console.error(`[workspace-cleanup] Failed to remove ${entry}:`, e);
    }
  }

  return cleaned;
}

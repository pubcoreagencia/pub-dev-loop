/**
 * AgentContext: Bootstrap module for loading and validating operational context
 * from the `.agent/` directory in the repository.
 *
 * GITHUB = source of truth for code.
 * `.agent/` = source of truth for operational context.
 *
 * Usage:
 *   const ctx = await AgentContext.load();
 *   AgentContext.validateGit();  // throws if LOCAL_HEAD != REMOTE_HEAD
 *   ctx.getCurrentTask();  // "TASK-000026"
 *   ctx.getNextTask();     // "TASK-000027"
 */

import { readFile } from 'node:fs/promises';
import { existsSync, readdirSync, readdir } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const REQUIRED_FILES = [
  'MASTER_CONTEXT.md',
  'CURRENT_STATE.md',
  'TASKS.md',
  'DECISIONS.md',
  'HANDOFF.md',
] as const;

export interface ParsedState {
  lastCommitStable?: string;
  branch?: string;
  localHead?: string;
  remoteHead?: string;
  sync?: boolean;
  currentTask?: string;
  currentAgent?: string;
  nextTask?: string;
  limitations?: string[];
}

export interface LoadedContext {
  agentDir: string;
  masterContext: string;
  currentState: string;
  tasks: string;
  decisions: string;
  handoff: string;
  parsed: ParsedState;
}

export interface GitState {
  repo: string;
  branch: string;
  localHead: string;
  remoteHead: string | null;
  worktree: string;
  synced: boolean;
}

/**
 * Locate the `.agent/` directory.
 * When startDir is provided, ONLY check that directory (no walking up).
 * When omitted, walk up from this module's location.
 */
export function findAgentDir(startDir?: string): string | null {
  if (startDir) {
    const candidate = join(startDir, '.agent');
    if (existsSync(candidate) && readdirSync(candidate).length > 0) {
      return candidate;
    }
    return null;
  }

  // Walk up from this file's location
  let dir = dirname(fileURLToPath(import.meta.url));
  while (true) {
    const candidate = join(dir, '.agent');
    if (existsSync(candidate) && readdirSync(candidate).length > 0) {
      return candidate;
    }
    const parent = dirname(dir);
    if (parent === dir) {
      return null;
    }
    dir = parent;
  }
}

/**
 * Extract a value from a markdown table row: `| **KEY** | VALUE |`
 */
function tableValue(md: string, key: string): string | undefined {
  const pattern = new RegExp(`\\|\\s*\\*\\*${key}\\*\\*\\s*\\|\\s*(.*?)\\s*\\|`);
  const m = md.match(pattern);
  if (m) {
    let val = m[1]
      .replace(/<[^>]+>/g, '')         // strip <br>, <tag>
      .replace(/`([^`]+)`/g, '$1')     // strip backticks
      .trim();
    return val || undefined;
  }
  return undefined;
}

/** Parse key-value fields from .md files (both table and inline formats). */
function parseState(md: string): ParsedState {
  const result: ParsedState = {};

  // HEAD from inline format: LOCAL: `abc123`
  const localMatch = md.match(/LOCAL:\s*`([0-9a-f]{7,40})`/i);
  if (localMatch) result.localHead = localMatch[1];

  const remoteMatch = md.match(/REMOTE:\s*`([0-9a-f]{7,40})`/i);
  if (remoteMatch) result.remoteHead = remoteMatch[1];

  // HEAD from table format: | **CURRENT_HEAD** | `abc123` |
  const tableLocal = tableValue(md, 'CURRENT_HEAD') ?? tableValue(md, 'LAST_KNOWN_STABLE_COMMIT') ?? tableValue(md, 'LOCAL');
  if (tableLocal) {
    const m = tableLocal.match(/([0-9a-f]{7,40})/);
    if (m) result.localHead = m[1];
  }

  const tableRemote = tableValue(md, 'REMOTE_HEAD') ?? tableValue(md, 'REMOTE');
  if (tableRemote) {
    const m = tableRemote.match(/([0-9a-f]{7,40})/);
    if (m) result.remoteHead = m[1];
  }

  // Branch
  const branchMatch = md.match(/## Branch\s*\n(\w+)/i);
  if (branchMatch && branchMatch[1]) {
    result.branch = branchMatch[1];
  } else {
    const fromTable = tableValue(md, 'CURRENT_BRANCH') ?? tableValue(md, 'BRANCH');
    if (fromTable) result.branch = fromTable;
  }

  // Last commit
  const commitMatch = md.match(/commit [`\\]([0-9a-f]{7,40})[`\\]/i);
  if (commitMatch) result.lastCommitStable = commitMatch[1];

  // Sync status
  if (/Sync:\s*YES/i.test(md)) result.sync = true;
  if (/Sync:\s*NO/i.test(md)) result.sync = false;
  const syncFromTable = tableValue(md, 'SYNC');
  if (syncFromTable !== undefined) {
    result.sync = /yes/i.test(syncFromTable);
  }

  // Current/NEXT task — from table or inline
  const ctxTask = tableValue(md, 'CURRENT_TASK');
  if (ctxTask) {
    const m = ctxTask.match(/(TASK-\d{4,})/i);
    if (m) result.currentTask = m[1];
  }
  const ctxNext = tableValue(md, 'NEXT_TASK');
  if (ctxNext) {
    const m = ctxNext.match(/(TASK-\d{4,})/i);
    if (m) result.nextTask = m[1];
  }
  const ctxAgent = tableValue(md, 'CURRENT_AGENT');
  if (ctxAgent) result.currentAgent = ctxAgent;

  // Limitations — from table KNOWN_LIMITATIONS
  const tableLim = tableValue(md, 'KNOWN_LIMITATIONS');
  if (tableLim) {
    result.limitations = tableLim
      .split(/<br>|\d+\.\s+/)
      .map(s => s.trim())
      .filter(s => s.length > 0);
  }

  // Fallback: from section "## Limitations" or "## Known Limitations"
  if (!result.limitations || result.limitations.length === 0) {
    const limSection = md.match(/## (?:Known )?Limitations\s*\n([\s\S]*?)(?=\n##|\Z)/i);
    if (limSection && limSection[1]) {
      const lines = limSection[1].split('\n').filter(l => /^\d+\./.test(l.trim()));
      if (lines.length > 0) {
        result.limitations = lines;
      }
    }
  }

  return result;
}

/**
 * AgentContext: loads and validates the operational context from `.agent/`.
 */
export class AgentContext {
  readonly agentDir: string;
  readonly loaded: LoadedContext;

  private constructor(agentDir: string, loaded: LoadedContext) {
    this.agentDir = agentDir;
    this.loaded = loaded;
  }

  /**
   * Load the operational context from `.agent/`.
   * Fails if any required file is missing.
   */
  static async load(startDir?: string): Promise<AgentContext> {
    const agentDir = findAgentDir(startDir);
    if (!agentDir) {
      throw new Error(
        'CONTEXT NOT FOUND: `.agent/` directory not found in project root.\n' +
        'Expected files: MASTER_CONTEXT.md, CURRENT_STATE.md, TASKS.md, DECISIONS.md, HANDOFF.md\n' +
        'Run this from within the pub-dev-loop repository.'
      );
    }

    const loaded: LoadedContext = {
      agentDir,
      masterContext: '',
      currentState: '',
      tasks: '',
      decisions: '',
      handoff: '',
      parsed: {},
    };

    const missing: string[] = [];

    for (const file of REQUIRED_FILES) {
      const path = join(agentDir, file);
      if (!existsSync(path)) {
        missing.push(file);
      } else {
        const content = await readFile(path, 'utf8');
        switch (file) {
          case 'MASTER_CONTEXT.md': loaded.masterContext = content; break;
          case 'CURRENT_STATE.md': loaded.currentState = content; break;
          case 'TASKS.md': loaded.tasks = content; break;
          case 'DECISIONS.md': loaded.decisions = content; break;
          case 'HANDOFF.md': loaded.handoff = content; break;
        }
      }
    }

    if (missing.length > 0) {
      throw new Error(
        `CONTEXT INCOMPLETE: Missing required files in ${agentDir}:\n` +
        missing.map(f => `  - ${f}`).join('\n') +
        '\n\nAll 5 files are required before executing a task.'
      );
    }

    // Parse state from CURRENT_STATE.md and HANDOFF.md
    loaded.parsed = parseState(loaded.currentState);
    const handoffParsed = parseState(loaded.handoff);
    Object.assign(loaded.parsed, handoffParsed);

    return new AgentContext(agentDir, loaded);
  }

  getCurrentTask(): string | undefined {
    return this.loaded.parsed.currentTask;
  }

  getNextTask(): string | undefined {
    return this.loaded.parsed.nextTask;
  }

  /**
   * Find last COMPLETE task from TASKS.md.
   * Handles both "- **Status**: COMPLETE ✅" and "**Status**: COMPLETE" formats.
   */
  getLastCompletedTask(): string | undefined {
    const tasks = this.loaded.tasks.match(/## (TASK-\d{4,})/g);
    if (!tasks) return undefined;

    // Find last task that has COMPLETE status
    for (let i = tasks.length - 1; i >= 0; i--) {
      const taskName = tasks[i].substring('## '.length);
      // Check if this task section contains COMPLETE
      const idx = this.loaded.tasks.indexOf(tasks[i]);
      const sectionText = this.loaded.tasks.substring(idx, idx + 500);
      if (/COMPLETE/i.test(sectionText)) {
        return taskName;
      }
    }
    return undefined;
  }

  getKnownLimitations(): string[] {
    return this.loaded.parsed.limitations ?? [];
  }

  /**
   * Get git state of the repository. Does NOT modify anything.
   */
  static getGitState(repoDir?: string): GitState {
    const cwd = repoDir ?? process.cwd();

    const branch = execSync('git rev-parse --abbrev-ref HEAD', {
      cwd, stdio: ['pipe', 'pipe', 'pipe'],
    }).toString().trim();

    const localHead = execSync('git rev-parse HEAD', {
      cwd, stdio: ['pipe', 'pipe', 'pipe'],
    }).toString().trim();

    let remoteHead: string | null = null;
    try {
      remoteHead = execSync('git rev-parse origin/main', {
        cwd, stdio: ['pipe', 'pipe', 'pipe'],
      }).toString().trim();
    } catch {
      remoteHead = null;
    }

    const worktree = execSync('git status --short', {
      cwd, stdio: ['pipe', 'pipe', 'pipe'],
    }).toString().trim();

    return {
      repo: cwd,
      branch,
      localHead,
      remoteHead,
      worktree,
      synced: remoteHead === null ? true : localHead === remoteHead,
    };
  }

  /**
   * Validate git state. Throws if diverged or working tree unclean.
   */
  static validateGit(repoDir?: string): GitState {
    const state = AgentContext.getGitState(repoDir);

    if (state.remoteHead !== null && !state.synced) {
      throw new Error(
        `GIT DIVERGENCE DETECTED:\n` +
        `  LOCAL HEAD:   ${state.localHead}\n` +
        `  REMOTE HEAD:  ${state.remoteHead}\n` +
        `  Branch:       ${state.branch}\n\n` +
        `Run 'git fetch origin' and resolve the difference before proceeding.\n` +
        `DO NOT run git reset --hard, git clean, or git pull --rebase automatically.`
      );
    }

    if (state.worktree && state.worktree.length > 0) {
      throw new Error(
        `WORKING TREE NOT CLEAN:\n${state.worktree}\n\n` +
        `Please commit or stash changes before proceeding.`
      );
    }

    return state;
  }

  /**
   * Get a consolidated summary of the operational context.
   */
  getSummary(): {
    currentTask: string | undefined;
    nextTask: string | undefined;
    lastCompletedTask: string | undefined;
    limitations: string[];
    agentDir: string;
  } {
    return {
      currentTask: this.getCurrentTask(),
      nextTask: this.getNextTask(),
      lastCompletedTask: this.getLastCompletedTask(),
      limitations: this.getKnownLimitations(),
      agentDir: this.agentDir,
    };
  }
}

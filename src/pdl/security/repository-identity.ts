/**
 * Hard Repository Identity Invariant & Scope Verification (CEO RECOVERY PROTOCOL).
 *
 * Invariants Enforced:
 * 1. canonical(TASK.repository) === canonical(GIT_REMOTE.origin)
 * 2. Physical workspace identity is derived exclusively from real Git commands:
 *    - git rev-parse --show-toplevel
 *    - git remote get-url origin
 *    - git rev-parse --abbrev-ref HEAD
 *    - git rev-parse HEAD
 * 3. Never trust UI, activeProject, metadata, memory variables, or folder paths.
 * 4. Active project cannot substitute the explicit task target.
 * 5. Fails closed (PROJECT_SCOPE_MISMATCH / EXECUTION_BLOCKED) before any agent action.
 */

import { execSync } from 'node:child_process';
import { existsSync, realpathSync } from 'node:fs';
import { resolve } from 'node:path';

export interface RealGitWorkspaceIdentity {
  topLevel: string;
  remoteOrigin: string;
  canonicalRemote: string;
  branch: string;
  headSha: string;
}

export interface VerifyRepositoryIdentityParams {
  taskRepository?: string | null;
  workspacePath: string;
  gate: 'Gate 1 (Post-Provisioning)' | 'Gate 2 (Pre-Agent-Execution)' | string;
  activeProject?: string | null;
}

export class RepositoryIdentityError extends Error {
  public readonly code: string;
  constructor(code: string, message: string) {
    super(`[${code}] ${message}`);
    this.name = 'RepositoryIdentityError';
    this.code = code;
  }
}

/**
 * Deterministically canonicalizes any git remote URI, GitHub URL, or owner/repo string into:
 * owner/repo (lowercased, trimmed, without trailing slashes or .git suffix).
 *
 * Examples:
 * - git@github.com:pubcoreagencia/pub-dev-loop.git -> pubcoreagencia/pub-dev-loop
 * - https://github.com/pubcoreagencia/pub-dev-loop.git -> pubcoreagencia/pub-dev-loop
 * - https://github.com/pubcoreagencia/pub-dev-loop -> pubcoreagencia/pub-dev-loop
 * - pubcoreagencia/pub-dev-loop -> pubcoreagencia/pub-dev-loop
 */
export function canonicalizeRepository(input: string): string {
  if (!input || typeof input !== 'string') {
    throw new RepositoryIdentityError(
      'TARGET_REPOSITORY_MISSING',
      'Repository identifier cannot be null, undefined, or empty'
    );
  }

  let s = input.trim();
  if (s.length === 0) {
    throw new RepositoryIdentityError(
      'TARGET_REPOSITORY_MISSING',
      'Repository identifier cannot be blank'
    );
  }

  // Strip trailing slashes
  s = s.replace(/\/+$/, '');

  // Strip .git suffix
  if (s.toLowerCase().endsWith('.git')) {
    s = s.slice(0, -4);
  }

  // Handle SSH format: git@github.com:owner/repo or ssh://git@github.com/owner/repo
  const sshMatch = s.match(/^(?:ssh:\/\/)?(?:[^@]+@)?[a-zA-Z0-9_.\-]+[:/]([^/]+\/[^/]+)$/i);
  if (sshMatch) {
    return sshMatch[1].toLowerCase();
  }

  // Handle HTTP/HTTPS format: https://github.com/owner/repo
  const httpMatch = s.match(/^https?:\/\/[^/]+\/([^/]+\/[^/]+)$/i);
  if (httpMatch) {
    return httpMatch[1].toLowerCase();
  }

  // Handle simple owner/repo: pubcoreagencia/pub-dev-loop
  const simpleMatch = s.match(/^([a-zA-Z0-9_\-.]+)\/([a-zA-Z0-9_\-.]+)$/);
  if (simpleMatch) {
    return `${simpleMatch[1].toLowerCase()}/${simpleMatch[2].toLowerCase()}`;
  }

  // If input doesn't match standard patterns, lower and return trimmed
  return s.toLowerCase();
}

function canonicalizePath(p: string): string {
  try {
    const fn = (realpathSync as any).native ?? realpathSync;
    return resolve(fn(p));
  } catch {
    return resolve(p);
  }
}

/**
 * Inspects the real physical Git state of a workspace directory using authoritative Git CLI commands.
 * Fails closed if the path does not exist, is not a valid git repository, lacks an origin remote,
 * or contains corrupt/inconsistent git metadata.
 */
export function inspectGitWorkspace(workspacePath: string): RealGitWorkspaceIdentity {
  if (!workspacePath || typeof workspacePath !== 'string' || workspacePath.trim().length === 0) {
    throw new RepositoryIdentityError(
      'WORKSPACE_IDENTITY_UNVERIFIED',
      'Workspace path cannot be null, empty, or blank'
    );
  }

  const resolvedPath = canonicalizePath(workspacePath.trim());
  if (!existsSync(resolvedPath)) {
    throw new RepositoryIdentityError(
      'WORKSPACE_IDENTITY_UNVERIFIED',
      `Workspace path does not exist on filesystem: '${resolvedPath}'`
    );
  }

  // 1. git rev-parse --show-toplevel
  let topLevel: string;
  try {
    topLevel = execSync('git rev-parse --show-toplevel', {
      cwd: resolvedPath,
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 5000,
      encoding: 'utf8',
    }).trim();
  } catch (err: any) {
    throw new RepositoryIdentityError(
      'WORKSPACE_IDENTITY_UNVERIFIED',
      `Path is not a valid git repository or git metadata is corrupt: ${resolvedPath}`
    );
  }

  if (!topLevel) {
    throw new RepositoryIdentityError(
      'WORKSPACE_IDENTITY_UNVERIFIED',
      'git rev-parse --show-toplevel returned empty output'
    );
  }

  // 2. git remote get-url origin
  let remoteOrigin: string;
  try {
    remoteOrigin = execSync('git remote get-url origin', {
      cwd: resolvedPath,
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 5000,
      encoding: 'utf8',
    }).trim();
  } catch (err: any) {
    throw new RepositoryIdentityError(
      'WORKSPACE_MISSING_REMOTE',
      `Workspace has no 'origin' remote configured: ${resolvedPath}`
    );
  }

  if (!remoteOrigin) {
    throw new RepositoryIdentityError(
      'WORKSPACE_MISSING_REMOTE',
      'Workspace origin remote URL is empty'
    );
  }

  // 3. git rev-parse --abbrev-ref HEAD
  let branch: string;
  try {
    branch = execSync('git rev-parse --abbrev-ref HEAD', {
      cwd: resolvedPath,
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 5000,
      encoding: 'utf8',
    }).trim();
  } catch (err: any) {
    throw new RepositoryIdentityError(
      'WORKSPACE_IDENTITY_UNVERIFIED',
      `Cannot determine current git branch: ${resolvedPath}`
    );
  }

  // 4. git rev-parse HEAD
  let headSha: string;
  try {
    headSha = execSync('git rev-parse HEAD', {
      cwd: resolvedPath,
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 5000,
      encoding: 'utf8',
    }).trim();
  } catch {
    headSha = 'UNCOMMITTED_HEAD';
  }

  const canonicalRemote = canonicalizeRepository(remoteOrigin);
  const canonicalTopLevel = canonicalizePath(topLevel);

  return {
    topLevel: canonicalTopLevel,
    remoteOrigin,
    canonicalRemote,
    branch: branch || 'HEAD',
    headSha,
  };
}

/**
 * Hard Repository Identity Gate:
 * Verifies that the physical Git workspace's remote origin matches the task's explicit target repository.
 *
 * Enforces:
 * 1. canonical(TASK.repository) === canonical(GIT_REMOTE.origin)
 * 2. Active project CANNOT substitute the explicit task target.
 * 3. Fails closed with PROJECT_SCOPE_MISMATCH / EXECUTION_BLOCKED.
 */
export function verifyRepositoryIdentity(params: VerifyRepositoryIdentityParams): RealGitWorkspaceIdentity {
  const { taskRepository, workspacePath, gate, activeProject } = params;

  if (!taskRepository || typeof taskRepository !== 'string' || taskRepository.trim().length === 0) {
    throw new RepositoryIdentityError(
      'TARGET_REPOSITORY_MISSING',
      `EXECUTION_BLOCKED: TARGET_REPOSITORY_MISSING at ${gate}. Task has no explicit repository target.`
    );
  }

  const canonicalTarget = canonicalizeRepository(taskRepository);
  const identity = inspectGitWorkspace(workspacePath);

  // Invariant 1: Physical Git remote origin MUST match explicit task target
  if (identity.canonicalRemote !== canonicalTarget) {
    throw new RepositoryIdentityError(
      'PROJECT_SCOPE_MISMATCH',
      `PROJECT_SCOPE_MISMATCH: ${gate} failed. Task target repository '${canonicalTarget}' does not match workspace git remote origin '${identity.canonicalRemote}' (${identity.remoteOrigin}). EXECUTION_BLOCKED.`
    );
  }

  // Invariant 2: Active project cannot substitute explicit target.
  // If workspace matches target (A == A), activeProject (even if B) is not permitted to redirect execution.
  // If workspace was provisioned from activeProject B instead of target A, Invariant 1 already blocks it.

  return identity;
}

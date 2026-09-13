import { resolve, isAbsolute, relative, sep } from 'node:path';
import { realpathSync } from 'node:fs';

/**
 * WorkspaceSecurity: validates and resolves file paths within a workspace root.
 *
 * Blocks:
 * - Path traversal (../)
 * - Absolute paths outside the workspace
 * - Access to HOME, .env, secrets, CODEX_HOME
 * - Any path that resolves outside workspaceRoot
 */
export class WorkspaceSecurity {
  private readonly workspaceRoot: string;

  constructor(workspaceRoot: string) {
    // Normalize and resolve without requiring the directory to exist
    this.workspaceRoot = resolve(workspaceRoot);
  }

  /**
   * Resolve a user-provided path and ensure it stays within the workspace.
   * Returns the absolute, normalized path if safe.
   * Throws Error if the path escapes the workspace.
   */
  resolvePath(userPath: string): string {
    // Reject null/undefined/empty
    if (!userPath || typeof userPath !== 'string') {
      throw new Error('Invalid path: path is required');
    }

    // Never allow paths containing null bytes
    if (userPath.includes('\0')) {
      throw new Error('Invalid path: null bytes not allowed');
    }

    // Block known sensitive names anywhere in the path
    const sensitivePatterns = [
      '.env',
      '.env.local',
      '.env.production',
      '.env.development',
      '.env.test',
      'auth.json',
      'credentials',
      'secret',
      'secrets',
    ];

    for (const pattern of sensitivePatterns) {
      if (userPath.includes(pattern)) {
        throw new Error(`Access denied: path contains sensitive pattern '${pattern}'`);
      }
    }

    // Resolve the path: if absolute, use as-is; if relative, resolve against workspace
    let resolved: string;
    if (isAbsolute(userPath)) {
      resolved = resolve(userPath);
    } else {
      resolved = resolve(this.workspaceRoot, userPath);
    }

    // Normalize for comparison
    resolved = resolve(resolved);

    // Check if resolved path is within workspace
    if (resolved === this.workspaceRoot) {
      return resolved;
    }
    if (resolved.startsWith(this.workspaceRoot + sep)) {
      return resolved;
    }

    // Path escaped the workspace
    const rel = relative(this.workspaceRoot, resolved);
    throw new Error(`Path traversal blocked: '${rel}' resolves outside workspace`);
  }

  /**
   * Validate that a path is inside the workspace (without resolving).
   * Returns true if safe.
   */
  isSafePath(userPath: string): boolean {
    try {
      this.resolvePath(userPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if a resolved path is within the workspace root.
   */
  isWithinWorkspace(absolutePath: string): boolean {
    const resolved = resolve(absolutePath);
    if (resolved === this.workspaceRoot) return true;
    return resolved.startsWith(this.workspaceRoot + sep);
  }

  get root(): string {
    return this.workspaceRoot;
  }
}

/**
 * Phase 5.5: Fail-closed invariant violation error when an unprivileged workspace process
 * is found to possess database connection strings, administrative tokens, or governance keys.
 */
export class GovernanceSelfElevationViolationError extends Error {
  constructor(message: string, readonly detectedKey?: string) {
    super(`[SELF_ELEVATION_INVARIANT_VIOLATION] ${message}`);
    this.name = 'GovernanceSelfElevationViolationError';
  }
}

/**
 * Phase 5.5: Anti-Self-Elevation Security Boundary.
 *
 * Enforces the core invariant:
 * "Agent-executed workspace processes cannot modify PDL governance."
 *
 * Ensures that child processes spawned for tool execution, test commands, or git operations
 * in the workspace receive a stripped environment with zero database credentials, zero governance
 * administrative keys, zero cloud tokens, and zero provider secrets.
 */
export class WorkspaceEnvironmentSecurity {
  public static readonly BLOCKED_KEY_PREFIXES = [
    'DATABASE_',
    'POSTGRES_',
    'PG',
    'SUPABASE_',
    'NEON_',
    'HYPERDRIVE_',
    'REDIS_',
    'MONGODB_',
    'PDL_GOVERNANCE_',
    'PDL_ADMIN_',
    'GOVERNANCE_',
    'KILL_SWITCH',
    'KILLSWITCH',
    'GITHUB_',
    'GH_',
    'PDL_GITHUB_',
    'ROUTER_',
    'OPENROUTER_',
    'CODEX_',
    'OPENAI_',
    'ANTHROPIC_',
    'GEMINI_',
    'PUB_NEURAL_',
    'PUB_MCP_',
  ];

  public static readonly BLOCKED_KEY_EXACT = new Set([
    'DATABASE_URL',
    'POSTGRES_URL',
    'SUPABASE_DB_URL',
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'SUPABASE_ANON_KEY',
    'NEON_DATABASE_URL',
    'DATABASE_PRIVATE_URL',
    'DB_URL',
    'CONNECTION_STRING',
    'HYPERDRIVE_URL',
    'PGPASSWORD',
    'PGUSER',
    'PGDATABASE',
    'PGHOST',
    'PGPORT',
    'PGSSLMODE',
    'PGOPTIONS',
    'PDL_GOVERNANCE_ADMIN_KEY',
    'PDL_GOVERNANCE_READ_KEY',
    'PDL_ADMIN_KEY',
    'GITHUB_TOKEN',
    'GH_TOKEN',
    'PDL_GITHUB_TOKEN',
    'ROUTER_API_KEY',
    'ROUTER_BASE_URL',
    'OPENROUTER_API_KEY',
    'OPENROUTER_BASE_URL',
    'PUB_NEURAL_ENDPOINT',
    'PUB_NEURAL_TOKEN',
    'PUB_MCP_AUTH_TOKEN',
  ]);

  public static readonly SENSITIVE_KEY_PATTERN =
    /(api[_-]?key|token|password|secret|credential|private[_-]?key|database|postgres|supabase|neural|governance|kill[_-]?switch)/i;

  public static readonly SENSITIVE_VALUE_PATTERN =
    /(?:postgres(?:ql)?:\/\/|mysql:\/\/|redis:\/\/|mongodb:\/\/|ghp_[A-Za-z0-9_]{10,}|github_pat_[A-Za-z0-9_]{10,}|Bearer\s+[A-Za-z0-9._-]{10,})/i;

  /**
   * Sanitizes environment for workspace subprocesses:
   * Completely strips database credentials, governance keys, provider tokens, and cloud secrets.
   */
  public static sanitizeWorkspaceEnv(baseEnv: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
    const safeEnv: NodeJS.ProcessEnv = {};

    for (const [key, val] of Object.entries(baseEnv)) {
      if (val === undefined) continue;

      const upperKey = key.toUpperCase();

      // Check exact blocked keys
      if (this.BLOCKED_KEY_EXACT.has(upperKey)) {
        continue;
      }

      // Check blocked prefixes
      if (this.BLOCKED_KEY_PREFIXES.some(p => upperKey.startsWith(p))) {
        continue;
      }

      // Check sensitive key regex
      if (this.SENSITIVE_KEY_PATTERN.test(key)) {
        continue;
      }

      // Check sensitive value regex (e.g. connection strings in non-standard keys)
      if (this.SENSITIVE_VALUE_PATTERN.test(val)) {
        continue;
      }

      safeEnv[key] = val;
    }

    return safeEnv;
  }

  /**
   * Fail-closed invariant gate:
   * "Agent-executed workspace processes cannot modify PDL governance."
   * Throws GovernanceSelfElevationViolationError if ANY prohibited credential or pattern exists.
   */
  public static assertNoGovernanceCredentials(env: NodeJS.ProcessEnv): void {
    for (const [key, val] of Object.entries(env)) {
      if (val === undefined) continue;

      const upperKey = key.toUpperCase();

      if (this.BLOCKED_KEY_EXACT.has(upperKey)) {
        throw new GovernanceSelfElevationViolationError(
          `Subprocess environment contains prohibited credential: "${key}". Agent-executed workspace processes cannot modify PDL governance.`,
          key
        );
      }

      if (this.BLOCKED_KEY_PREFIXES.some(p => upperKey.startsWith(p))) {
        throw new GovernanceSelfElevationViolationError(
          `Subprocess environment contains prohibited credential with prefix: "${key}". Agent-executed workspace processes cannot modify PDL governance.`,
          key
        );
      }

      if (this.SENSITIVE_KEY_PATTERN.test(key)) {
        throw new GovernanceSelfElevationViolationError(
          `Subprocess environment contains sensitive key: "${key}". Agent-executed workspace processes cannot modify PDL governance.`,
          key
        );
      }

      if (this.SENSITIVE_VALUE_PATTERN.test(val)) {
        throw new GovernanceSelfElevationViolationError(
          `Subprocess environment key "${key}" contains sensitive URI or secret value pattern. Agent-executed workspace processes cannot modify PDL governance.`,
          key
        );
      }
    }
  }
}

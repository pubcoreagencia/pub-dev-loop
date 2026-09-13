import { resolve, isAbsolute, relative, sep } from 'node:path';
import { realpathSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';

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
    'GH_ENTERPRISE_TOKEN',
    'GITHUB_ENTERPRISE_TOKEN',
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

  private static isolatedGhConfigDir: string | null = null;

  /**
   * Provides a clean, isolated directory for GitHub CLI configuration.
   * Completely neutralizes the host keyring and Windows Credential Manager
   * by providing an explicit inert hosts.yml and config.yml.
   */
  public static getIsolatedGhConfigDir(): string {
    if (!this.isolatedGhConfigDir) {
      const dir = resolve(tmpdir(), 'pdl-sandbox-gh-isolated');
      try {
        if (!existsSync(dir)) {
          mkdirSync(dir, { recursive: true });
        }
        const hostsFile = resolve(dir, 'hosts.yml');
        const inertHosts =
          'github.com:\n' +
          '    user: pdl-unauthenticated-sandbox\n' +
          '    oauth_token: pdl-invalid-dummy-token\n' +
          '    git_protocol: https\n';
        writeFileSync(hostsFile, inertHosts, 'utf8');

        const configFile = resolve(dir, 'config.yml');
        const inertConfig = 'git_protocol: https\neditor: \nprompt: disabled\n';
        writeFileSync(configFile, inertConfig, 'utf8');
      } catch {}
      this.isolatedGhConfigDir = dir;
    }
    return this.isolatedGhConfigDir;
  }

  /**
   * Sanitizes environment for workspace subprocesses:
   * Completely strips database credentials, governance keys, provider tokens, and cloud secrets.
   * Enforces an isolated GH_CONFIG_DIR with inert dummy tokens and sanitizes PATH to eliminate gh/gh.exe.
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

    // P0.4.1-A1: Sanitize PATH to remove directories exposing gh, gh.exe, or credential tools
    const pathKey = Object.keys(safeEnv).find(k => k.toUpperCase() === 'PATH') || 'PATH';
    const rawPath = safeEnv[pathKey] || '';
    if (rawPath) {
      const pathSep = process.platform === 'win32' ? ';' : ':';
      const cleanParts = rawPath
        .split(pathSep)
        .filter(part => {
          const trimmed = part.trim();
          if (!trimmed) return false;
          const lower = trimmed.toLowerCase();
          // Exclude GitHub CLI directories
          if (lower.includes('github cli') || lower.includes('github-cli')) {
            return false;
          }
          // Exclude any directory containing gh.exe or gh
          try {
            if (existsSync(resolve(trimmed, 'gh.exe')) || existsSync(resolve(trimmed, 'gh'))) {
              return false;
            }
          } catch {}
          return true;
        });
      safeEnv[pathKey] = cleanParts.join(pathSep);
    }

    // P0.4.1-A2 & A3: Force isolated GitHub CLI configuration with inert dummy credentials
    safeEnv['GH_CONFIG_DIR'] = this.getIsolatedGhConfigDir();

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

      // GH_CONFIG_DIR is permitted ONLY when pointing to the isolated sandbox;
      // if it points to host user profiles or credential stores, it fails closed.
      if (upperKey === 'GH_CONFIG_DIR') {
        const isolatedDir = resolve(this.getIsolatedGhConfigDir()).toLowerCase();
        const incomingDir = resolve(String(val)).toLowerCase();
        if (incomingDir !== isolatedDir) {
          throw new GovernanceSelfElevationViolationError(
            `Subprocess environment points GH_CONFIG_DIR to unapproved directory: "${val}". Agent-executed workspace processes cannot access host GitHub credentials.`,
            'GH_CONFIG_DIR'
          );
        }
        continue;
      }

      // Permitted ONLY if strictly containing the inert sandbox dummy token
      if (upperKey === 'GH_TOKEN' || upperKey === 'GITHUB_TOKEN' || upperKey === 'PDL_GITHUB_TOKEN') {
        if (val === 'pdl-invalid-dummy-token') {
          continue;
        }
        throw new GovernanceSelfElevationViolationError(
          `Subprocess environment contains unauthorized or real GitHub token in "${key}". Agent-executed workspace processes cannot modify PDL governance or access host credentials.`,
          key
        );
      }

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

/**
 * Phase 5.5 / P0.3.1: Workspace Command & Host Credential Escape Security Gate.
 *
 * Enforces executable boundaries preventing autonomous workspace agents from invoking:
 * - GitHub CLI (`gh`, `gh.exe`) directly, via relative/absolute paths, or wrapped in quotes.
 * - Shell wrappers (`cmd`, `powershell`, `pwsh`, `bash`, `sh`) that execute `gh` or invoke GitHub administration.
 * - Direct HTTP/CLI attacks against GitHub repository governance (protection, rulesets).
 */
export class WorkspaceCommandSecurity {
  public static readonly PROHIBITED_EXECUTABLE_NAMES = new Set([
    'gh',
    'gh.exe',
    'cmdkey',
    'cmdkey.exe',
  ]);

  public static readonly SHELL_NAMES = new Set([
    'cmd',
    'cmd.exe',
    'powershell',
    'powershell.exe',
    'pwsh',
    'pwsh.exe',
    'bash',
    'bash.exe',
    'sh',
    'sh.exe',
    'zsh',
    'wscript',
    'wscript.exe',
    'cscript',
    'cscript.exe',
  ]);

  /**
   * Normalize an executable name or path to its bare command name (lowercased, no quotes, no path, no extension).
   */
  public static extractBasename(cmd: string): string {
    if (!cmd) return '';
    let clean = cmd.trim();
    if ((clean.startsWith('"') && clean.endsWith('"')) || (clean.startsWith("'") && clean.endsWith("'"))) {
      clean = clean.slice(1, -1).trim();
    }
    const parts = clean.split(/[\\/]/);
    const filename = parts[parts.length - 1].toLowerCase();
    return filename.replace(/\.(exe|cmd|bat|ps1|sh)$/i, '');
  }

  /**
   * Check if a command string or executable + args represents a prohibited GitHub CLI execution or governance bypass.
   */
  public static validateCommand(command: string, args: string[] = []): { allowed: boolean; reason?: string } {
    if (!command || typeof command !== 'string') {
      return { allowed: true };
    }

    const trimmed = command.trim();
    const baseExe = this.extractBasename(trimmed);

    // 1. Direct executable check (gh, gh.exe, cmdkey, cmdkey.exe, or paths ending in them)
    if (this.PROHIBITED_EXECUTABLE_NAMES.has(baseExe) || /(?:^|[\\/])(gh|cmdkey)(?:\.exe)?$/i.test(trimmed.replace(/^['"]|['"]$/g, ''))) {
      return {
        allowed: false,
        reason: `[SECURITY_VIOLATION] Direct execution of prohibited tool ('${baseExe}') is strictly prohibited in autonomous workspace to prevent host credential escape.`,
      };
    }

    // 2. Full command line text inspection
    const fullCommandLine = [trimmed, ...args.map(a => String(a))].join(' ');

    // 3. Detect any invocation of gh or gh.exe as a command or token
    // Matches: gh, gh.exe, .\gh, "gh", 'gh', C:\...\gh.exe, & gh, Start-Process gh, etc.
    const ghPattern = /(?:^|[;&|`\s("'])(?:[\w:.-]*[\\/])?gh(?:\.exe)?(?:$|[;&|`\s)"'])/i;
    if (ghPattern.test(fullCommandLine)) {
      return {
        allowed: false,
        reason: `[SECURITY_VIOLATION] Execution of GitHub CLI ('gh' / 'gh.exe') is strictly prohibited across all workspace execution surfaces.`,
      };
    }

    // 3.1 Detect any invocation of cmdkey as a command or token
    const cmdkeyPattern = /(?:^|[;&|`\s("'])(?:[\w:.-]*[\\/])?cmdkey(?:\.exe)?(?:$|[;&|`\s)"'])/i;
    if (cmdkeyPattern.test(fullCommandLine)) {
      return {
        allowed: false,
        reason: `[SECURITY_VIOLATION] Execution of credential management tool ('cmdkey') is strictly prohibited in autonomous workspace.`,
      };
    }

    // 4. Detect shell wrapper escapes targeting gh subcommands or APIs
    if (this.SHELL_NAMES.has(baseExe)) {
      const shellSubcommand = args.join(' ');
      if (ghPattern.test(shellSubcommand) || /\bgh\s+(?:api|auth|repo|ruleset|rulesets|pr|workflow|secret|variable|release)\b/i.test(shellSubcommand)) {
        return {
          allowed: false,
          reason: `[SECURITY_VIOLATION] Shell invocation of GitHub CLI ('gh') is strictly prohibited.`,
        };
      }
      if (cmdkeyPattern.test(shellSubcommand)) {
        return {
          allowed: false,
          reason: `[SECURITY_VIOLATION] Shell invocation of credential tool ('cmdkey') is strictly prohibited.`,
        };
      }
    }

    // 5. Detect direct curl/web requests attempting to access or manipulate GitHub governance endpoints
    if (/(?:curl|invoke-webrequest|invoke-restmethod|wget)\s+[^\n\r]*?(?:api\.github\.com[^\n\r]*?(?:protection|rulesets|collaborators|hooks))/i.test(fullCommandLine)) {
      return {
        allowed: false,
        reason: `[SECURITY_VIOLATION] Direct API invocation targeting GitHub governance endpoints (protection/rulesets) is strictly prohibited.`,
      };
    }

    return { allowed: true };
  }
}

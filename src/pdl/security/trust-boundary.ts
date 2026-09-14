/**
 * PHASE 5.5: PDL Canonical Trust Boundary & Protected Paths Enforcement.
 *
 * Defines and enforces strict, tamper-proof boundaries separating:
 * - ZONE A (Trust Root & Security Critical — HUMAN-ONLY)
 * - ZONE B (Execution Engine — Bounded Autonomy)
 * - ZONE C (Output Workspace — Ephemeral Feature Branches)
 *
 * Provides three-layer defense:
 * 1. Runtime Write Gate: blocks write_file before touching disk
 * 2. Pre-Commit Gate: inspects real Git diff before any git add/commit
 * 3. Pre-Push Gate: inspects commit changesets before remote persistence
 */

import { resolve, relative, isAbsolute, normalize, sep, win32 } from 'node:path';
import { existsSync, readFileSync, realpathSync } from 'node:fs';

export type PathClassification =
  | 'TRUST_ROOT'
  | 'SECURITY_CRITICAL'
  | 'EXECUTION_ENGINE'
  | 'NORMAL_CONFIG'
  | 'TESTS';

export interface PathValidationResult {
  allowed: boolean;
  classification: PathClassification;
  normalizedPath: string;
  reason?: string;
  violatedPaths?: string[];
}

/**
 * Phase 5.5: Fail-closed violation error when an autonomous agent attempts
 * to write to, modify, delete, or commit Zone A protected paths.
 */
export class GovernanceProtectedPathViolationError extends Error {
  constructor(message: string, readonly violatedPath?: string) {
    super(`[PROTECTED_PATH_VIOLATION] ${message}`);
    this.name = 'GovernanceProtectedPathViolationError';
  }
}

/**
 * Canonical patterns defining Zone A (TRUST_ROOT + SECURITY_CRITICAL).
 * All patterns are matched case-insensitively using normalized forward slashes.
 */
export const TRUST_ROOT_PATTERNS = [
  'src/pdl/governance/**',
  'src/pdl/products/catalog.ts',
  'src/pdl/security/**',
  'AGENTS.md',
  'PDL_OPERATIONAL_STATE.md',
];

export const SECURITY_CRITICAL_PATTERNS = [
  'src/pdl/persistence/persistence-gate.ts',
  'src/pdl/persistence/remote-persistence.ts',
  'src/tools/security.ts',
  'src/tools/runtime.ts',
  'src/executor.ts',
  'src/finalizer.ts',
  'src/office/review.ts',
  'tests/anti-self-elevation.test.ts',
  'tests/security/**',
  'tests/pdl-governance-*.test.ts',
  '.github/**',
  '.env*',
  '**/.env*',
  'secrets/**',
  '**/secrets/**',
  'auth.json',
  '**/auth.json',
  'credentials*',
  '**/credentials*',
  '**/*_rsa*',
  '**/*.pem',
];

export class TrustBoundary {
  /**
   * Normalize an incoming file path to a canonical relative path from workspace root.
   * Handles:
   * - Absolute paths (resolves and strips workspace root)
   * - Relative paths with ./ or ../ traversal
   * - Windows drive letters and case insensitivity
   * - UNC paths (//?/C:/...)
   * - Forward vs backslashes
   */
  public static normalizePath(filePath: string, workspaceRoot: string = process.cwd()): string {
    if (!filePath || typeof filePath !== 'string') {
      throw new GovernanceProtectedPathViolationError('Invalid path: path must be a non-empty string');
    }

    if (filePath.includes('\0')) {
      throw new GovernanceProtectedPathViolationError('Path contains null bytes');
    }

    // Clean UNC prefix if present
    let clean = filePath.replace(/^[\\/]{2}\?[\\/]/, '');

    // Multiplatform check: Explicitly detect UNC paths (\\\\ or //) or Windows drive letters.
    // On POSIX platforms, backslashes are treated as ordinary filename characters by node's isAbsolute,
    // so UNC paths like \\server\share\evil.txt would otherwise be treated as relative filenames.
    const isUncOrWindowsAbsolute =
      filePath.startsWith('\\\\') ||
      filePath.startsWith('//') ||
      /^[a-zA-Z]:[\\/]/.test(filePath);

    if (isUncOrWindowsAbsolute && process.platform !== 'win32') {
      throw new GovernanceProtectedPathViolationError(
        `Path traversal detected: '${filePath}' resolves outside workspace root '${workspaceRoot}'. Paths outside workspace root are strictly prohibited from classification as permissive paths.`,
        filePath
      );
    }

    const resolvedRoot = resolve(workspaceRoot);
    let resolvedTarget: string;

    if (isAbsolute(clean)) {
      resolvedTarget = resolve(clean);
    } else {
      resolvedTarget = resolve(resolvedRoot, clean);
    }

    // Resolve realpath if file exists on disk to catch symlink attacks
    if (existsSync(resolvedTarget)) {
      try {
        resolvedTarget = realpathSync(resolvedTarget);
      } catch {
        // Fall back to resolved path if realpath fails
      }
    }

    // Traversal check: target must be inside workspace root or match workspace root
    const rel = relative(resolvedRoot, resolvedTarget);
    if (rel.startsWith('..') || isAbsolute(rel)) {
      throw new GovernanceProtectedPathViolationError(
        `Path traversal detected: '${filePath}' resolves outside workspace root '${workspaceRoot}'. Paths outside workspace root are strictly prohibited from classification as permissive paths.`,
        filePath
      );
    }

    const normalized = rel.replace(/\\/g, '/').replace(/^\.\//, '');
    return normalized || '.';
  }

  /**
   * Classifies any path within the PDL architecture.
   */
  public static classifyPath(filePath: string, workspaceRoot: string = process.cwd()): PathClassification {
    const norm = this.normalizePath(filePath, workspaceRoot).toLowerCase();

    // 1. Check TRUST_ROOT
    if (TRUST_ROOT_PATTERNS.some(p => this.matchGlob(norm, p.toLowerCase()))) {
      return 'TRUST_ROOT';
    }

    // 2. Check SECURITY_CRITICAL
    if (SECURITY_CRITICAL_PATTERNS.some(p => this.matchGlob(norm, p.toLowerCase()))) {
      return 'SECURITY_CRITICAL';
    }

    // 3. Check TESTS (non-security tests)
    if (norm.startsWith('tests/') || norm.startsWith('test/')) {
      return 'TESTS';
    }

    // 4. Check NORMAL_CONFIG
    if (
      norm === 'package.json' ||
      norm === 'package-lock.json' ||
      norm === 'tsconfig.json' ||
      norm.startsWith('tsconfig.') ||
      norm === 'vitest.config.ts' ||
      norm === '.gitignore' ||
      norm === '.npmrc'
    ) {
      return 'NORMAL_CONFIG';
    }

    // 5. Everything else under src/ is EXECUTION_ENGINE
    if (norm.startsWith('src/')) {
      return 'EXECUTION_ENGINE';
    }

    return 'NORMAL_CONFIG';
  }

  /**
   * Determines if a path belongs to ZONE A (Immutable by autonomous agents).
   */
  public static isZoneAPath(filePath: string, workspaceRoot: string = process.cwd()): boolean {
    const classification = this.classifyPath(filePath, workspaceRoot);
    return classification === 'TRUST_ROOT' || classification === 'SECURITY_CRITICAL';
  }

  /**
   * Layer 1: Runtime Write Gate.
   * Throws GovernanceProtectedPathViolationError if an autonomous agent attempts
   * to write to any Zone A protected path.
   */
  public static assertProtectedPathWriteAllowed(
    filePath: string,
    context?: { isAutonomousAgent?: boolean; workspaceRoot?: string }
  ): void {
    const root = context?.workspaceRoot || process.cwd();
    const isAutonomous = context?.isAutonomousAgent !== false; // Default: fail-closed (treat as autonomous)

    if (!isAutonomous) {
      return; // Human operator execution permitted
    }

    if (this.isZoneAPath(filePath, root)) {
      const norm = this.normalizePath(filePath, root);
      const classification = this.classifyPath(filePath, root);
      console.error(`[PDL Security:BLOCK] Write denied for ${classification} protected path: "${norm}"`);
      throw new GovernanceProtectedPathViolationError(
        `Autonomous write to Zone A protected path '${norm}' (${classification}) is strictly prohibited. Agent cannot modify its own governance or trust root.`,
        norm
      );
    }
  }

  /**
   * Layer 2 & 3: Pre-Commit and Pre-Push Changeset Validation.
   * Scans all changed, added, modified, renamed, or deleted files.
   * Fails closed if ANY file belongs to Zone A.
   */
  public static validateChangesetAgainstTrustBoundary(
    changedFiles: string[],
    workspaceRoot: string = process.cwd()
  ): { allowed: boolean; violatedPaths: string[]; reason?: string } {
    const violatedPaths: string[] = [];

    for (const f of changedFiles) {
      if (!f || typeof f !== 'string') continue;

      try {
        const norm = this.normalizePath(f, workspaceRoot);
        if (this.isZoneAPath(norm, workspaceRoot)) {
          violatedPaths.push(norm);
        }
      } catch (err: any) {
        // Fail-closed: any path that cannot be resolved within workspace is treated as a security violation
        violatedPaths.push(f);
      }
    }

    if (violatedPaths.length > 0) {
      const reason = `Changeset contains Zone A protected paths: [${violatedPaths.join(', ')}]. Autonomous commit or persistence of trust root modifications is strictly prohibited.`;
      return { allowed: false, violatedPaths, reason };
    }

    return { allowed: true, violatedPaths: [] };
  }

  /**
   * Layer 4: Configuration Integrity Gate.
   * Inspects configuration files (e.g. tsconfig.json, package.json) to detect
   * subtle bypass attempts such as path aliases remapping Zone A or tampering with test scripts.
   */
  public static validateConfigurationIntegrity(
    changedFiles: string[],
    workspaceRoot: string = process.cwd()
  ): { allowed: boolean; reason?: string } {
    for (const f of changedFiles) {
      let norm: string;
      try {
        norm = this.normalizePath(f, workspaceRoot).toLowerCase();
      } catch (err: any) {
        return {
          allowed: false,
          reason: `Configuration integrity violation: changed file '${f}' resolves outside workspace root.`,
        };
      }

      // Inspect tsconfig for path alias remappings targeting Zone A
      if (norm === 'tsconfig.json' || norm.startsWith('tsconfig.')) {
        const fullPath = resolve(workspaceRoot, f);
        if (existsSync(fullPath)) {
          try {
            const content = readFileSync(fullPath, 'utf8');
            // Remove comments for JSON parsing
            const cleanContent = content.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
            const parsed = JSON.parse(cleanContent);
            const paths = parsed.compilerOptions?.paths;

            if (paths && typeof paths === 'object') {
              for (const [alias, targets] of Object.entries(paths)) {
                const aliasLower = alias.toLowerCase();
                const targetsStr = JSON.stringify(targets).toLowerCase();

                if (
                  aliasLower.includes('governance') ||
                  aliasLower.includes('security') ||
                  aliasLower.includes('persistence') ||
                  aliasLower.includes('catalog') ||
                  aliasLower.includes('review') ||
                  targetsStr.includes('governance') ||
                  targetsStr.includes('security') ||
                  targetsStr.includes('persistence') ||
                  targetsStr.includes('catalog') ||
                  targetsStr.includes('review')
                ) {
                  return {
                    allowed: false,
                    reason: `Configuration integrity violation: tsconfig.json introduces alias '${alias}' targeting Zone A trust boundary.`,
                  };
                }
              }
            }
          } catch {
            // Unparseable tsconfig or read failure
            return {
              allowed: false,
              reason: 'Configuration integrity violation: tsconfig.json contains invalid syntax or cannot be verified.',
            };
          }
        }
      }

      // Inspect package.json for script tampering
      if (norm === 'package.json') {
        const fullPath = resolve(workspaceRoot, f);
        if (existsSync(fullPath)) {
          try {
            const content = readFileSync(fullPath, 'utf8');
            const parsed = JSON.parse(content);
            const scripts = parsed.scripts || {};

            // Critical scripts that must never be hollowed out or bypassed
            const criticalScripts = ['test', 'typecheck', 'build'];
            for (const s of criticalScripts) {
              const cmd = String(scripts[s] || '').trim().toLowerCase();
              if (cmd === '' || cmd === 'exit 0' || cmd.startsWith('true') || cmd === 'echo ok') {
                return {
                  allowed: false,
                  reason: `Configuration integrity violation: package.json hollows out critical verification script '${s}' with dummy command: '${cmd}'.`,
                };
              }
            }
          } catch {
            return {
              allowed: false,
              reason: 'Configuration integrity violation: package.json cannot be parsed or verified.',
            };
          }
        }
      }
    }

    return { allowed: true };
  }

  private static matchGlob(val: string, pattern: string): boolean {
    const v = val.trim().replace(/\\/g, '/');
    const p = pattern.trim().replace(/\\/g, '/');
    if (p === v) return true;

    // Direct prefix match for /**
    if (p.endsWith('/**')) {
      const prefix = p.slice(0, -3);
      if (v === prefix || v.startsWith(prefix + '/')) return true;
    }

    // Direct suffix match for **/
    if (p.startsWith('**/')) {
      const suffix = p.slice(3);
      if (!suffix.includes('*')) {
        if (v === suffix || v.endsWith('/' + suffix)) return true;
      }
    }

    // Direct prefix match for * at the end
    if (p.endsWith('*') && !p.slice(0, -1).includes('*')) {
      const prefix = p.slice(0, -1);
      if (v.startsWith(prefix)) return true;
    }

    // Robust Glob to RegExp converter
    let regexStr = '';
    let i = 0;
    while (i < p.length) {
      if (p[i] === '*' && p[i + 1] === '*') {
        // Double star **
        if (p[i + 2] === '/') {
          // **/ matches zero or more directories
          regexStr += '(?:.+/)?';
          i += 3;
        } else {
          regexStr += '.*';
          i += 2;
        }
      } else if (p[i] === '*') {
        // Single star * matches anything within a path segment
        regexStr += '[^/]*';
        i++;
      } else if (p[i] === '?') {
        regexStr += '[^/]';
        i++;
      } else {
        // Escape character if it is a regex special character
        if ('.+^${}()|[]/\\'.includes(p[i])) {
          regexStr += '\\' + p[i];
        } else {
          regexStr += p[i];
        }
        i++;
      }
    }

    try {
      const re = new RegExp('^' + regexStr + '$', 'i');
      return re.test(v);
    } catch {
      return false;
    }
  }
}

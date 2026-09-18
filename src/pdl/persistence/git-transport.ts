import { execFileSync } from 'node:child_process';
import { existsSync, appendFileSync } from 'node:fs';
import type { GitExecutor } from './remote-persistence.js';
import { defaultGitExecutor } from './remote-persistence.js';

export interface GitTransportMapping {
  /** Canonical remote URL that is authorized (e.g. https://github.com/pubcoreagencia/pub-dev-loop-template.git) */
  canonicalUrl: string;
  /** Physical target path to a local bare repository */
  physicalTarget: string;
}

export interface TransportAuditEvent {
  command: string;
  canonicalUrl: string;
  resolvedTarget: string;
  isLocalBare: boolean;
  timestamp: string;
}

/**
 * Normalizes git remote URL for strict comparison:
 * - strips trailing slashes and .git suffix
 * - strips credentials (e.g. x-access-token:...@ or user:pass@)
 * - lowercases
 */
export function normalizeTransportUrl(url: string): string {
  if (!url || typeof url !== 'string') return '';
  let clean = url.trim();
  // Strip credentials: https://user:token@github.com/... -> https://github.com/...
  clean = clean.replace(/^(https?:\/\/)[^/@]+@/i, '$1');
  // Strip trailing slashes
  clean = clean.replace(/\/+$/, '');
  // Strip .git suffix
  if (clean.toLowerCase().endsWith('.git')) {
    clean = clean.slice(0, -4);
  }
  return clean.toLowerCase();
}

/**
 * Validates that physical target exists and is a valid bare git repository.
 * Fails closed if invalid.
 */
export function assertValidBareRepository(targetPath: string): void {
  if (!targetPath || typeof targetPath !== 'string' || !targetPath.trim()) {
    throw new Error('[AIR_GAP_BREACH] Invalid physicalTarget: path cannot be empty');
  }
  if (!existsSync(targetPath)) {
    throw new Error(`[AIR_GAP_BREACH] Physical target does not exist: ${targetPath}`);
  }
  try {
    const isBare = execFileSync('git', ['rev-parse', '--is-bare-repository'], {
      cwd: targetPath,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 5000,
    }).trim();
    if (isBare !== 'true') {
      throw new Error(`[AIR_GAP_BREACH] Physical target is not a bare git repository: ${targetPath}`);
    }
  } catch (err: any) {
    throw new Error(`[AIR_GAP_BREACH] Failed to verify bare git repository at ${targetPath}: ${err.message}`);
  }
}

/**
 * Creates an isolated GitExecutor that intercepts remote Git commands (ls-remote, fetch, push)
 * and safely maps authorized canonical URLs to local bare repositories.
 *
 * Enforces strict fail-closed air-gap security:
 * - Local Git commands execute normally on local workspace cwd.
 * - Remote commands MUST target an explicitly mapped canonicalUrl.
 * - Any unknown, unmapped, or public remote access attempt immediately throws AIR_GAP_BREACH.
 * - Redacts all tokens and credentials from audit trails and error logs.
 */
export function createIsolatedGitExecutor(
  mappings: GitTransportMapping[],
  baseExecutor: GitExecutor = defaultGitExecutor,
  auditLogPath?: string,
): GitExecutor {
  if (!mappings || !Array.isArray(mappings) || mappings.length === 0) {
    throw new Error('[AIR_GAP_BREACH] No transport mappings provided to isolated Git executor');
  }

  // Pre-validate all mappings fail-closed
  const validatedMappings: { normalizedCanonical: string; canonicalUrl: string; physicalTarget: string }[] = [];
  for (const m of mappings) {
    if (!m.canonicalUrl || !m.physicalTarget) {
      throw new Error('[AIR_GAP_BREACH] Transport mapping missing canonicalUrl or physicalTarget');
    }
    assertValidBareRepository(m.physicalTarget);
    validatedMappings.push({
      normalizedCanonical: normalizeTransportUrl(m.canonicalUrl),
      canonicalUrl: m.canonicalUrl,
      physicalTarget: m.physicalTarget,
    });
  }

  return (cmd: string, args: string[], cwd: string, env?: Record<string, string>): string => {
    // Only inspect git binary calls
    if (cmd !== 'git') {
      return baseExecutor(cmd, args, cwd, env);
    }

    const subCmd = args[0];

    // Remote operations that accept a remote destination
    if (subCmd === 'ls-remote' || subCmd === 'fetch' || subCmd === 'push') {
      // Remote URL is at args[1]
      const rawRemote = args[1];
      if (!rawRemote || rawRemote.startsWith('-')) {
        throw new Error(`[AIR_GAP_BREACH] Git ${subCmd} called without explicit remote URL argument`);
      }

      const normalizedRequest = normalizeTransportUrl(rawRemote);
      const matched = validatedMappings.find(m => m.normalizedCanonical === normalizedRequest);

      if (!matched) {
        // Redact any credentials if present in rawRemote before reporting
        const sanitizedRemote = rawRemote.replace(/^(https?:\/\/)[^/@]+@/i, '$1[REDACTED]@');
        throw new Error(
          `[AIR_GAP_BREACH] Unauthorized remote network access attempted: ${subCmd} -> ${sanitizedRemote}. Remote is not authorized by transport mapping.`
        );
      }

      // Safe substitution: replace ONLY args[1] with matched physicalTarget
      const isolatedArgs = [...args];
      isolatedArgs[1] = matched.physicalTarget;

      // Record secure audit event (zero tokens, canonical URL only)
      const auditEvent: TransportAuditEvent = {
        command: subCmd,
        canonicalUrl: matched.canonicalUrl,
        resolvedTarget: matched.physicalTarget,
        isLocalBare: true,
        timestamp: new Date().toISOString(),
      };

      if (auditLogPath) {
        try {
          appendFileSync(auditLogPath, JSON.stringify(auditEvent) + '\n', 'utf8');
        } catch {
          // In fail-closed test environment, audit file write failure throws
          throw new Error(`[AIR_GAP_BREACH] Failed to write transport audit log to ${auditLogPath}`);
        }
      }

      return baseExecutor(cmd, isolatedArgs, cwd, env);
    }

    // All local operations (rev-parse, status, diff, log, cat-file, merge-base, etc.) execute directly
    return baseExecutor(cmd, args, cwd, env);
  };
}

/**
 * Resolves isolated GitExecutor from environment variable if present.
 * Format of PDL_ISOLATED_GIT_TRANSPORT:
 * JSON string of Record<canonicalUrl, physicalTargetBarePath>
 * Example:
 * '{"https://github.com/pubcoreagencia/pub-dev-loop-template.git":"/tmp/.../upstream.git"}'
 *
 * Returns undefined if environment variable is not configured (production mode).
 */
export function resolveIsolatedGitExecutorFromEnv(): GitExecutor | undefined {
  const envConfig = process.env.PDL_ISOLATED_GIT_TRANSPORT;
  if (!envConfig || !envConfig.trim()) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(envConfig);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new Error('PDL_ISOLATED_GIT_TRANSPORT must be a JSON object mapping canonical URL to bare path');
    }

    const mappings: GitTransportMapping[] = Object.entries(parsed).map(([canonicalUrl, physicalTarget]) => ({
      canonicalUrl,
      physicalTarget: String(physicalTarget),
    }));

    if (mappings.length === 0) {
      throw new Error('PDL_ISOLATED_GIT_TRANSPORT JSON object cannot be empty');
    }

    const auditPath = process.env.PDL_GIT_TRANSPORT_AUDIT_LOG;
    return createIsolatedGitExecutor(mappings, defaultGitExecutor, auditPath);
  } catch (err: any) {
    console.error(`[PDL Worker] FATAL: Invalid PDL_ISOLATED_GIT_TRANSPORT configuration: ${err.message}`);
    throw err;
  }
}

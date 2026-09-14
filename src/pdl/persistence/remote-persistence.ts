import { execFileSync } from 'node:child_process';
import {
  defaultProductCatalog,
  type ProductCatalog,
  type ProductManifest,
} from '../products/catalog.js';
import { TrustBoundary } from '../security/trust-boundary.js';
import type {
  RemotePersistenceOptions,
  RemotePersistenceResult,
  RemotePersistenceStatus,
} from './types.js';

export const CANONICAL_PROTECTED_BRANCHES = [
  'main',
  'master',
  'production',
  'release/*',
];

export type GitExecutor = (
  cmd: string,
  args: string[],
  cwd: string,
  env?: Record<string, string>,
) => string;

export const defaultGitExecutor: GitExecutor = (cmd, args, cwd, env) => {
  return execFileSync(cmd, args, {
    cwd,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    timeout: 30000,
    env: env ? { ...process.env, ...env } : process.env,
  }).toString();
};

export function redactToken(text: string, token?: string): string {
  if (!text) return '';
  let sanitized = text;
  if (token && token.length >= 6) {
    sanitized = sanitized.split(token).join('[REDACTED]');
  }
  sanitized = sanitized.replace(/ghp_[A-Za-z0-9]+/g, '[REDACTED]');
  sanitized = sanitized.replace(/github_pat_[A-Za-z0-9_]+/g, '[REDACTED]');
  sanitized = sanitized.replace(/x-access-token:[^@]+@/g, 'x-access-token:[REDACTED]@');
  return sanitized;
}

export function matchGlobPattern(value: string, pattern: string): boolean {
  if (pattern === '*' || pattern === '**') return true;
  if (pattern.endsWith('/*')) {
    const prefix = pattern.slice(0, -2);
    return value.startsWith(prefix + '/') || value === prefix;
  }
  if (pattern.endsWith('*')) {
    const prefix = pattern.slice(0, -1);
    return value.startsWith(prefix);
  }
  return value === pattern;
}

export function normalizeRepoPath(repo: string): string {
  if (!repo || typeof repo !== 'string') return '';
  const clean = repo.trim().replace(/\.git$/, '').replace(/\/$/, '');
  const match = clean.match(/(?:github\.com\/|^)([a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+)$/i);
  return match ? match[1].toLowerCase() : clean.toLowerCase();
}

export function getGitHubToken(explicitToken?: string): string {
  if (explicitToken && explicitToken.trim()) {
    return explicitToken.trim();
  }
  const envToken = process.env.PDL_GITHUB_TOKEN || process.env.GITHUB_TOKEN;
  if (envToken && envToken.trim()) {
    return envToken.trim();
  }
  if (process.env.PROD === 'true' || process.env.NODE_ENV === 'production') {
    return '';
  }
  try {
    const result = execFileSync('gh', ['auth', 'token'], {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 5000,
    });
    return result.trim();
  } catch {
    return '';
  }
}

/**
 * PdlRemotePersistence — Canonical, PP-independent remote finalization layer.
 *
 * Responsibilities:
 * - Product Catalog is the sole authority for repository, branch policy, and persistence eligibility.
 * - Enforces fail-closed security across credentials, branch protection, fast-forward checks, and verification.
 * - Strictly prohibits force push under all conditions.
 * - Distinguishes LOCAL_COMMITTED, REMOTE_PUSHED, and REMOTE_VERIFIED.
 * - Guarantees credential redaction and zero credential persistence in repository config or logs.
 */
export class PdlRemotePersistence {
  constructor(
    private readonly catalog: ProductCatalog = defaultProductCatalog,
    private readonly executor: GitExecutor = defaultGitExecutor,
  ) {}

  /**
   * Complete remote persistence pipeline: validation -> fast-forward check -> push -> verification.
   */
  async persist(options: RemotePersistenceOptions): Promise<RemotePersistenceResult> {
    if (options.requested === false) {
      return {
        status: 'NOT_REQUESTED',
        repository: typeof options.product === 'string' ? options.product : options.product.repository,
        branch: options.branch,
        pushAttempted: false,
        pushSucceeded: false,
        localSha: options.localSha,
        remoteSha: null,
        remoteVerified: false,
      };
    }

    // 1. Resolve & Validate Product from Catalog
    const manifest = typeof options.product === 'string'
      ? this.catalog.get(options.product)
      : options.product;

    if (!manifest) {
      return {
        status: 'FAILED',
        repository: typeof options.product === 'string' ? options.product : 'unknown',
        branch: options.branch,
        pushAttempted: false,
        pushSucceeded: false,
        localSha: options.localSha,
        remoteSha: null,
        remoteVerified: false,
        errorCode: 'UNAUTHORIZED_PRODUCT',
        errorMessage: `Product '${typeof options.product === 'string' ? options.product : 'unknown'}' is not registered in the Product Catalog.`,
      };
    }

    // 2. Check Remote Persistence Eligibility
    if (manifest.remotePersistenceEligible !== true) {
      return {
        status: 'FAILED',
        repository: manifest.repository,
        branch: options.branch,
        pushAttempted: false,
        pushSucceeded: false,
        localSha: options.localSha,
        remoteSha: null,
        remoteVerified: false,
        errorCode: 'PERSISTENCE_INELIGIBLE',
        errorMessage: `Product '${manifest.productId}' is not eligible for autonomous remote persistence (remotePersistenceEligible=false).`,
      };
    }

    // 3. Verify Target Repository matches Catalog Authority (Anti-Hijacking / Anti-Cross-Product Contamination)
    if (options.targetRepository) {
      const normTarget = normalizeRepoPath(options.targetRepository);
      const normCatalog = normalizeRepoPath(manifest.repository);
      if (normTarget !== normCatalog) {
        return {
          status: 'FAILED',
          repository: manifest.repository,
          branch: options.branch,
          pushAttempted: false,
          pushSucceeded: false,
          localSha: options.localSha,
          remoteSha: null,
          remoteVerified: false,
          errorCode: 'REPOSITORY_MISMATCH',
          errorMessage: `Target repository '${options.targetRepository}' does not match authorized Product Catalog repository '${manifest.repository}'.`,
        };
      }
    }

    // 4. Branch Protection Guard (main, master, production, release/* can never be pushed to)
    const protectedBranches = [
      ...CANONICAL_PROTECTED_BRANCHES,
      ...(manifest.protectedBranches || []),
    ];
    const isProtected = protectedBranches.some((p) => matchGlobPattern(options.branch, p));
    if (isProtected) {
      return {
        status: 'FAILED',
        repository: manifest.repository,
        branch: options.branch,
        pushAttempted: false,
        pushSucceeded: false,
        localSha: options.localSha,
        remoteSha: null,
        remoteVerified: false,
        errorCode: 'PROTECTED_BRANCH_PROHIBITED',
        errorMessage: `Autonomous push to protected branch '${options.branch}' is strictly prohibited.`,
      };
    }

    // 5. Branch Policy Guard
    const branchPolicy = manifest.developmentBranchPolicy ?? ['feat/*', 'feature/*', 'fix/*'];
    const isBranchAllowed = branchPolicy.some((p) => matchGlobPattern(options.branch, p));
    if (!isBranchAllowed) {
      return {
        status: 'FAILED',
        repository: manifest.repository,
        branch: options.branch,
        pushAttempted: false,
        pushSucceeded: false,
        localSha: options.localSha,
        remoteSha: null,
        remoteVerified: false,
        errorCode: 'BRANCH_POLICY_VIOLATION',
        errorMessage: `Branch '${options.branch}' does not conform to development branch policy for product '${manifest.productId}' ([${branchPolicy.join(', ')}]).`,
      };
    }

    // 6. Validate Workspace Git Integrity & Commit Match
    try {
      const isWorkTree = this.executor('git', ['rev-parse', '--is-inside-work-tree'], options.workspace).trim();
      if (isWorkTree !== 'true') {
        throw new Error('Not inside a valid git working tree');
      }

      const headSha = this.executor('git', ['rev-parse', 'HEAD'], options.workspace).trim();
      if (!headSha || headSha !== options.localSha) {
        return {
          status: 'FAILED',
          repository: manifest.repository,
          branch: options.branch,
          pushAttempted: false,
          pushSucceeded: false,
          localSha: options.localSha,
          remoteSha: null,
          remoteVerified: false,
          errorCode: 'LOCAL_SHA_MISMATCH',
          errorMessage: `Workspace HEAD '${headSha}' does not match expected localSha '${options.localSha}'.`,
        };
      }

      // Check workspace origin URL if configured
      try {
        const originUrl = this.executor('git', ['remote', 'get-url', 'origin'], options.workspace).trim();
        if (originUrl) {
          const normOrigin = normalizeRepoPath(originUrl);
          const normManifest = normalizeRepoPath(manifest.repository);
          if (normOrigin !== normManifest) {
            return {
              status: 'FAILED',
              repository: manifest.repository,
              branch: options.branch,
              pushAttempted: false,
              pushSucceeded: false,
              localSha: options.localSha,
              remoteSha: null,
              remoteVerified: false,
              errorCode: 'WORKSPACE_ORIGIN_MISMATCH',
              errorMessage: `Workspace git origin '${originUrl}' points to a different repository than authorized '${manifest.repository}'.`,
            };
          }
        }
      } catch {
        // Origin not set; allowed since we use explicit remote URL for push
      }
    } catch (wsErr: any) {
      return {
        status: 'FAILED',
        repository: manifest.repository,
        branch: options.branch,
        pushAttempted: false,
        pushSucceeded: false,
        localSha: options.localSha,
        remoteSha: null,
        remoteVerified: false,
        errorCode: 'WORKSPACE_INVALID',
        errorMessage: `Workspace validation failed: ${wsErr.message}`,
      };
    }

    // 7. Resolve Authentication Token (PDL_GITHUB_TOKEN > GITHUB_TOKEN for GitHub remotes)
    const isGitHub = manifest.repository.includes('github.com');
    const token = getGitHubToken(options.gitToken);
    if (isGitHub && !token) {
      return {
        status: 'FAILED',
        repository: manifest.repository,
        branch: options.branch,
        pushAttempted: false,
        pushSucceeded: false,
        localSha: options.localSha,
        remoteSha: null,
        remoteVerified: false,
        errorCode: 'MISSING_GITHUB_TOKEN',
        errorMessage: 'No authorized GitHub token available for PDL remote persistence (PDL_GITHUB_TOKEN required).',
      };
    }

    const repoPath = normalizeRepoPath(manifest.repository);
    const remoteUrl = isGitHub
      ? `https://x-access-token:${token}@github.com/${repoPath}.git`
      : manifest.repository;

    // 8. Remote Inspection & Trusted Baseline Resolution (REMOTE-FIRST)
    let existingRemoteSha: string | null = null;
    try {
      const lsOutput = this.executor(
        'git',
        ['ls-remote', remoteUrl, `refs/heads/${options.branch}`],
        options.workspace,
      ).trim();

      if (lsOutput) {
        const match = lsOutput.match(/^([0-9a-f]{40})\s+/m);
        if (match) {
          existingRemoteSha = match[1];
        }
      }
    } catch (lsErr: any) {
      return {
        status: 'FAILED',
        repository: manifest.repository,
        branch: options.branch,
        pushAttempted: false,
        pushSucceeded: false,
        localSha: options.localSha,
        remoteSha: null,
        remoteVerified: false,
        errorCode: 'REMOTE_INSPECTION_FAILED',
        errorMessage: redactToken(`Failed to inspect remote repository: ${lsErr.message}`, token),
      };
    }

    // If remote already contains this exact commit, it's already verified
    if (existingRemoteSha && existingRemoteSha === options.localSha) {
      return {
        status: 'VERIFIED',
        repository: manifest.repository,
        branch: options.branch,
        pushAttempted: false,
        pushSucceeded: true,
        localSha: options.localSha,
        remoteSha: existingRemoteSha,
        remoteVerified: true,
      };
    }

    // Determine the single trusted base SHA from remote
    let trustedBaseSha: string;
    const defaultBranch = manifest.defaultBranch || 'main';

    if (existingRemoteSha) {
      // Branch already exists on remote: baseline is the remote branch SHA
      trustedBaseSha = existingRemoteSha;
    } else {
      // First push: query remote default branch directly
      let remoteDefaultSha: string | null = null;
      try {
        const defaultLsOutput = this.executor(
          'git',
          ['ls-remote', remoteUrl, `refs/heads/${defaultBranch}`],
          options.workspace,
        ).trim();

        if (defaultLsOutput) {
          const match = defaultLsOutput.match(/^([0-9a-f]{40})\s+/m);
          if (match) {
            remoteDefaultSha = match[1];
          }
        }
      } catch (defaultLsErr: any) {
        return {
          status: 'FAILED',
          repository: manifest.repository,
          branch: options.branch,
          pushAttempted: false,
          pushSucceeded: false,
          localSha: options.localSha,
          remoteSha: null,
          remoteVerified: false,
          errorCode: 'REMOTE_INSPECTION_FAILED',
          errorMessage: redactToken(`Failed to inspect remote default branch '${defaultBranch}': ${defaultLsErr.message}`, token),
        };
      }

      if (!remoteDefaultSha) {
        return {
          status: 'FAILED',
          repository: manifest.repository,
          branch: options.branch,
          pushAttempted: false,
          pushSucceeded: false,
          localSha: options.localSha,
          remoteSha: null,
          remoteVerified: false,
          errorCode: 'UNRESOLVED_REMOTE_BASELINE',
          errorMessage: `Remote persistence blocked: failed to resolve trusted remote baseline for default branch '${defaultBranch}'. Autonomous first-push requires a verified remote baseline.`,
        };
      }

      trustedBaseSha = remoteDefaultSha;
    }

    // 8.1 Advisory baseSha validation: caller-supplied baseSha must match trustedBaseSha
    if (options.baseSha && options.baseSha !== trustedBaseSha) {
      return {
        status: 'FAILED',
        repository: manifest.repository,
        branch: options.branch,
        pushAttempted: false,
        pushSucceeded: false,
        localSha: options.localSha,
        remoteSha: existingRemoteSha,
        remoteVerified: false,
        errorCode: 'BASE_SHA_MISMATCH',
        errorMessage: `Provided baseSha '${options.baseSha}' does not match trusted remote baseline '${trustedBaseSha}'. Caller-supplied baseSha override is strictly prohibited.`,
      };
    }

    // 8.2 Ensure trustedBaseSha is available in local object database (fetch if necessary)
    let isObjectAvailable = false;
    try {
      this.executor('git', ['cat-file', '-e', `${trustedBaseSha}^{commit}`], options.workspace);
      isObjectAvailable = true;
    } catch {
      isObjectAvailable = false;
    }

    if (!isObjectAvailable) {
      try {
        const refToFetch = existingRemoteSha
          ? `refs/heads/${options.branch}:refs/remotes/origin/${options.branch}`
          : `refs/heads/${defaultBranch}:refs/remotes/origin/${defaultBranch}`;
        this.executor('git', ['fetch', remoteUrl, refToFetch], options.workspace);
        this.executor('git', ['cat-file', '-e', `${trustedBaseSha}^{commit}`], options.workspace);
      } catch (fetchErr: any) {
        return {
          status: 'FAILED',
          repository: manifest.repository,
          branch: options.branch,
          pushAttempted: false,
          pushSucceeded: false,
          localSha: options.localSha,
          remoteSha: existingRemoteSha,
          remoteVerified: false,
          errorCode: 'REMOTE_OBJECT_UNAVAILABLE',
          errorMessage: redactToken(`Trusted remote baseline commit '${trustedBaseSha}' could not be fetched into local repository: ${fetchErr.message}`, token),
        };
      }
    }

    // 8.3 Validate Ancestry / Fast-Forward
    let isAncestor = false;
    try {
      this.executor('git', ['merge-base', '--is-ancestor', trustedBaseSha, options.localSha], options.workspace);
      isAncestor = true;
    } catch {
      isAncestor = false;
    }

    if (!isAncestor) {
      if (existingRemoteSha) {
        return {
          status: 'FAILED',
          repository: manifest.repository,
          branch: options.branch,
          pushAttempted: false,
          pushSucceeded: false,
          localSha: options.localSha,
          remoteSha: existingRemoteSha,
          remoteVerified: false,
          errorCode: 'NON_FAST_FORWARD_REJECTED',
          errorMessage: `Remote branch '${options.branch}' has diverged (remote commit ${existingRemoteSha} is not ancestor of local ${options.localSha}). Force push is strictly prohibited.`,
        };
      } else {
        return {
          status: 'FAILED',
          repository: manifest.repository,
          branch: options.branch,
          pushAttempted: false,
          pushSucceeded: false,
          localSha: options.localSha,
          remoteSha: null,
          remoteVerified: false,
          errorCode: 'DIVERGED_FROM_REMOTE_BASE',
          errorMessage: `Local branch does not originate from trusted remote default branch '${defaultBranch}' (${trustedBaseSha}). Force push is strictly prohibited.`,
        };
      }
    }

    // 8.4 Historical Changeset Security Gate (Single trusted baseline scan)
    try {
      const touchedFiles = this.collectRangeTouchedFiles(options.workspace, options.localSha, trustedBaseSha);
      const check = this.validateChangesetSecurity(touchedFiles, options.workspace);
      if (!check.allowed) {
        return {
          status: 'FAILED',
          repository: manifest.repository,
          branch: options.branch,
          pushAttempted: false,
          pushSucceeded: false,
          localSha: options.localSha,
          remoteSha: existingRemoteSha,
          remoteVerified: false,
          errorCode: 'PROTECTED_PATH_VIOLATION',
          errorMessage: check.reason || 'Remote persistence blocked: push range touches Zone A protected paths',
        };
      }
    } catch (gateErr: any) {
      return {
        status: 'FAILED',
        repository: manifest.repository,
        branch: options.branch,
        pushAttempted: false,
        pushSucceeded: false,
        localSha: options.localSha,
        remoteSha: existingRemoteSha,
        remoteVerified: false,
        errorCode: 'CHANGESET_INSPECTION_FAILED',
        errorMessage: `Failed to inspect changeset for protected paths: ${gateErr.message}`,
      };
    }

    // 9. Execute Safe Push (Normal push only, strictly fast-forward, NO --force, NO --force-with-lease)
    try {
      this.executor(
        'git',
        ['push', remoteUrl, `HEAD:refs/heads/${options.branch}`],
        options.workspace,
      );
    } catch (pushErr: any) {
      return {
        status: 'FAILED',
        repository: manifest.repository,
        branch: options.branch,
        pushAttempted: true,
        pushSucceeded: false,
        localSha: options.localSha,
        remoteSha: existingRemoteSha,
        remoteVerified: false,
        errorCode: 'PUSH_FAILED',
        errorMessage: redactToken(`Push to remote repository failed: ${pushErr.message}`, token),
      };
    }

    // 10. Remote Verification Post-Push (Inspect remote to prove SHA exists)
    let verifiedRemoteSha: string | null = null;
    try {
      const verifyOutput = this.executor(
        'git',
        ['ls-remote', remoteUrl, `refs/heads/${options.branch}`],
        options.workspace,
      ).trim();

      if (verifyOutput) {
        const match = verifyOutput.match(/^([0-9a-f]{40})\s+/m);
        if (match) {
          verifiedRemoteSha = match[1];
        }
      }
    } catch (verifyErr: any) {
      return {
        status: 'FAILED',
        repository: manifest.repository,
        branch: options.branch,
        pushAttempted: true,
        pushSucceeded: true,
        localSha: options.localSha,
        remoteSha: null,
        remoteVerified: false,
        errorCode: 'REMOTE_VERIFICATION_FAILED',
        errorMessage: redactToken(`Failed to verify remote SHA after push: ${verifyErr.message}`, token),
      };
    }

    if (!verifiedRemoteSha || verifiedRemoteSha !== options.localSha) {
      return {
        status: 'FAILED',
        repository: manifest.repository,
        branch: options.branch,
        pushAttempted: true,
        pushSucceeded: true,
        localSha: options.localSha,
        remoteSha: verifiedRemoteSha,
        remoteVerified: false,
        errorCode: 'REMOTE_SHA_MISMATCH',
        errorMessage: `Remote SHA '${verifiedRemoteSha || 'unknown'}' does not match expected local SHA '${options.localSha}'. Remote verification failed.`,
      };
    }

    return {
      status: 'VERIFIED',
      repository: manifest.repository,
      branch: options.branch,
      pushAttempted: true,
      pushSucceeded: true,
      localSha: options.localSha,
      remoteSha: verifiedRemoteSha,
      remoteVerified: true,
    };
  }

  /**
   * Parse git --name-status output into a unique list of paths.
   * Handles renames (R<score> old new) and copies (C<score> old new) by extracting both paths.
   */
  private parseNameStatusOutput(output: string): string[] {
    const files = new Set<string>();
    const lines = output.split(/\r?\n/);
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;
      const parts = line.split(/\t+/);
      if (parts.length >= 2) {
        for (let i = 1; i < parts.length; i++) {
          let f = parts[i].trim();
          if (f.startsWith('"') && f.endsWith('"')) {
            f = f.slice(1, -1);
          }
          if (f) files.add(f);
        }
      } else {
        const spaceParts = line.split(/\s+/);
        if (spaceParts.length >= 2) {
          for (let i = 1; i < spaceParts.length; i++) {
            let f = spaceParts[i].trim();
            if (f.startsWith('"') && f.endsWith('"')) {
              f = f.slice(1, -1);
            }
            if (f) files.add(f);
          }
        }
      }
    }
    return Array.from(files);
  }

  /**
   * Collect all files touched in the push range (historical commits, net diff, and HEAD commit).
   * Incorporates -m (merges), -M (renames), -C (copies), and --name-status.
   * Fail-Closed: Any error in git log, git diff, or git diff-tree throws immediately.
   */
  private collectRangeTouchedFiles(workspace: string, localSha: string, baseCommit: string): string[] {
    const fileSet = new Set<string>();

    // 1. All files touched in ANY commit in baseCommit..localSha
    const logOutput = this.executor(
      'git',
      ['log', `${baseCommit}..${localSha}`, '-m', '-M', '-C', '--name-status', '--format='],
      workspace,
    );
    for (const f of this.parseNameStatusOutput(logOutput)) {
      fileSet.add(f);
    }

    // 2. Net diff between baseCommit and localSha
    const diffOutput = this.executor(
      'git',
      ['diff', baseCommit, localSha, '-M', '-C', '--name-status'],
      workspace,
    );
    for (const f of this.parseNameStatusOutput(diffOutput)) {
      fileSet.add(f);
    }

    // 3. Always inspect HEAD commit itself
    const headOutput = this.executor(
      'git',
      ['diff-tree', '--no-commit-id', '-m', '-M', '-C', '--name-status', '-r', localSha],
      workspace,
    );
    for (const f of this.parseNameStatusOutput(headOutput)) {
      fileSet.add(f);
    }

    return Array.from(fileSet);
  }

  /**
   * Validate a list of touched files against TrustBoundary Zone A and configuration integrity gates.
   */
  private validateChangesetSecurity(touchedFiles: string[], workspace: string): { allowed: boolean; reason?: string } {
    const boundaryCheck = TrustBoundary.validateChangesetAgainstTrustBoundary(
      touchedFiles,
      workspace
    );
    if (!boundaryCheck.allowed) {
      return boundaryCheck;
    }

    const configCheck = TrustBoundary.validateConfigurationIntegrity(
      touchedFiles,
      workspace
    );
    if (!configCheck.allowed) {
      return configCheck;
    }

    return { allowed: true };
  }
}

export const defaultRemotePersistence = new PdlRemotePersistence();

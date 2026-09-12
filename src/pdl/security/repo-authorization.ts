/**
 * PHASE 4F.5: Strict Repository Authorization Policy for PUB DEV LOOP.
 * Enforces 'deny by default' on all repository ingestion targets.
 */

export interface RepositoryAuthorizationResult {
  authorized: boolean;
  reason?: string;
  owner?: string;
  name?: string;
  branch?: string;
}

export interface RepositoryAuthorizationPolicyOptions {
  allowedOrganizations?: string[];
  allowedRepositories?: string[];
  allowedBranches?: string[];
  protectedBranches?: string[];
  allowAnyPubCoreOrgRepo?: boolean;
}

export class RepositoryAuthorizationPolicy {
  private readonly allowedOrganizations: Set<string>;
  private readonly allowedRepositories: Set<string>;
  private readonly allowedBranches: string[];
  private readonly protectedBranches: string[];
  private readonly allowAnyPubCoreOrgRepo: boolean;

  constructor(options?: RepositoryAuthorizationPolicyOptions) {
    this.allowedOrganizations = new Set(
      (options?.allowedOrganizations ?? ['pubcoreagencia']).map(o => o.toLowerCase())
    );
    this.allowedRepositories = new Set(
      (options?.allowedRepositories ?? []).map(r => r.toLowerCase())
    );
    this.allowedBranches = options?.allowedBranches ?? ['main', 'develop', 'feature/*', 'feat/*'];
    this.protectedBranches = options?.protectedBranches ?? ['production', 'release/*'];
    this.allowAnyPubCoreOrgRepo = options?.allowAnyPubCoreOrgRepo ?? true;
  }

  /**
   * Parse git repository URL into owner and repository name.
   */
  parseRepositoryUrl(repoUrl: string): { owner: string; name: string } | null {
    if (!repoUrl || typeof repoUrl !== 'string') return null;
    const clean = repoUrl.trim().replace(/\.git$/, '');

    // HTTPS GitHub URL: https://github.com/owner/repo
    const httpsMatch = clean.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)$/i);
    if (httpsMatch) {
      return { owner: httpsMatch[1], name: httpsMatch[2] };
    }

    // SSH GitHub URL: git@github.com:owner/repo
    const sshMatch = clean.match(/^git@github\.com:([^/]+)\/([^/]+)$/i);
    if (sshMatch) {
      return { owner: sshMatch[1], name: sshMatch[2] };
    }

    // Simple owner/repo
    const simpleMatch = clean.match(/^([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_.-]+)$/);
    if (simpleMatch) {
      return { owner: simpleMatch[1], name: simpleMatch[2] };
    }

    return null;
  }

  /**
   * Authorize a repository target and branch.
   */
  authorize(target: { repository?: string | null; branch?: string | null }): RepositoryAuthorizationResult {
    const rawRepo = target.repository?.trim();
    if (!rawRepo) {
      return { authorized: false, reason: 'Repository target is missing or empty' };
    }

    const parsed = this.parseRepositoryUrl(rawRepo);
    if (!parsed) {
      return {
        authorized: false,
        reason: `Invalid repository URL format: '${rawRepo}'. Must be a valid GitHub repository URI.`,
      };
    }

    const ownerLower = parsed.owner.toLowerCase();
    const fullNameLower = `${parsed.owner}/${parsed.name}`.toLowerCase();

    // Check Organization Whitelist
    if (!this.allowedOrganizations.has(ownerLower)) {
      return {
        authorized: false,
        reason: `Organization '${parsed.owner}' is not authorized. Allowed organizations: [${Array.from(this.allowedOrganizations).join(', ')}]`,
      };
    }

    // Check specific repo permissions if allowAnyPubCoreOrgRepo is false
    if (!this.allowAnyPubCoreOrgRepo && !this.allowedRepositories.has(fullNameLower)) {
      return {
        authorized: false,
        reason: `Repository '${parsed.owner}/${parsed.name}' is not in the explicit whitelist.`,
      };
    }

    // Check branch permissions if specified
    const branch = target.branch?.trim() || 'main';
    const isProtected = this.protectedBranches.some(pattern => this.matchGlob(branch, pattern));
    if (isProtected) {
      return {
        authorized: false,
        reason: `Direct execution on protected branch '${branch}' is prohibited without explicit release bypass.`,
      };
    }

    const isBranchAllowed = this.allowedBranches.some(pattern => this.matchGlob(branch, pattern));
    if (!isBranchAllowed) {
      return {
        authorized: false,
        reason: `Branch '${branch}' is not authorized. Allowed branch patterns: [${this.allowedBranches.join(', ')}]`,
      };
    }

    return {
      authorized: true,
      owner: parsed.owner,
      name: parsed.name,
      branch,
    };
  }

  private matchGlob(val: string, pattern: string): boolean {
    if (pattern === val) return true;
    if (pattern.endsWith('*')) {
      const prefix = pattern.slice(0, -1);
      return val.startsWith(prefix);
    }
    return false;
  }
}

export const defaultRepositoryAuthorizationPolicy = new RepositoryAuthorizationPolicy();

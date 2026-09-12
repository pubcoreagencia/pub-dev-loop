/**
 * PHASE 5.5 & 5.6: Strict Repository Governance & Autonomy Level Policy.
 *
 * Enforces multi-layer deny-by-default security across:
 * - Organization authorization (allowedOrganizations)
 * - Product catalog validation (ProductManifest)
 * - Branch authorization (developmentBranchPolicy vs protectedBranches)
 * - Path authorization (allowedPaths vs protectedPaths)
 * - Explicit Autonomy Levels (Level 0 through Level 5)
 */

import { defaultProductCatalog, type ProductManifest, type AutonomyLevel } from '../products/catalog.js';

export interface RepositoryAuthorizationResult {
  authorized: boolean;
  reason?: string;
  owner?: string;
  name?: string;
  branch?: string;
  product?: ProductManifest;
}

export interface PathAuthorizationResult {
  authorized: boolean;
  violatedPaths?: string[];
  reason?: string;
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

  parseRepositoryUrl(repoUrl: string): { owner: string; name: string } | null {
    if (!repoUrl || typeof repoUrl !== 'string') return null;
    const clean = repoUrl.trim().replace(/\.git$/, '');

    const httpsMatch = clean.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)$/i);
    if (httpsMatch) {
      return { owner: httpsMatch[1], name: httpsMatch[2] };
    }

    const sshMatch = clean.match(/^git@github\.com:([^/]+)\/([^/]+)$/i);
    if (sshMatch) {
      return { owner: sshMatch[1], name: sshMatch[2] };
    }

    const simpleMatch = clean.match(/^([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_.-]+)$/);
    if (simpleMatch) {
      return { owner: simpleMatch[1], name: simpleMatch[2] };
    }

    return null;
  }

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

    // 1. Organization Check
    if (!this.allowedOrganizations.has(ownerLower)) {
      return {
        authorized: false,
        reason: `Organization '${parsed.owner}' is not authorized. Allowed organizations: [${Array.from(this.allowedOrganizations).join(', ')}]`,
      };
    }

    // 2. Product Catalog Check
    const catalogProduct = defaultProductCatalog.get(parsed.name) || defaultProductCatalog.get(rawRepo);

    // 3. Whitelist check if general org access disabled
    if (!this.allowAnyPubCoreOrgRepo && !this.allowedRepositories.has(fullNameLower)) {
      return {
        authorized: false,
        reason: `Repository '${parsed.owner}/${parsed.name}' is not in the explicit whitelist.`,
      };
    }

    // 4. Branch Protection Check
    const branch = target.branch?.trim() || 'main';
    const isProtected = this.protectedBranches.some(pattern => this.matchGlob(branch, pattern));
    if (isProtected) {
      return {
        authorized: false,
        reason: `Direct execution on protected branch '${branch}' is prohibited without explicit release bypass.`,
      };
    }

    // 5. Allowed Branch Patterns (Product-specific or global)
    const allowedPatterns = catalogProduct?.developmentBranchPolicy ?? this.allowedBranches;
    const isBranchAllowed = allowedPatterns.some(pattern => this.matchGlob(branch, pattern));
    if (!isBranchAllowed) {
      return {
        authorized: false,
        reason: `Branch '${branch}' is not authorized. Allowed branch patterns: [${allowedPatterns.join(', ')}]`,
      };
    }

    return {
      authorized: true,
      owner: parsed.owner,
      name: parsed.name,
      branch,
      product: catalogProduct,
    };
  }

  /**
   * Phase 5.6: Enforce Autonomy Level boundaries.
   * Action requirements:
   * - READ: Level 0+
   * - MODIFY: Level 2+
   * - TEST: Level 3+
   * - COMMIT: Level 4+
   * - PUSH: Level 5
   */
  authorizeAutonomy(
    currentLevel: AutonomyLevel = 5,
    requiredAction: 'READ' | 'MODIFY' | 'TEST' | 'COMMIT' | 'PUSH'
  ): { permitted: boolean; reason?: string } {
    const minLevels: Record<string, AutonomyLevel> = {
      READ: 0,
      MODIFY: 2,
      TEST: 3,
      COMMIT: 4,
      PUSH: 5,
    };

    const needed = minLevels[requiredAction] ?? 5;
    if (currentLevel < needed) {
      return {
        permitted: false,
        reason: `Action '${requiredAction}' requires autonomy level ${needed}, but task was sealed with level ${currentLevel}.`,
      };
    }

    return { permitted: true };
  }

  /**
   * Phase 5.5: Validate that modified files respect allowed and protected paths.
   */
  validateModifiedPaths(
    changedFiles: string[],
    options?: { allowedPaths?: string[]; protectedPaths?: string[] }
  ): PathAuthorizationResult {
    const forbiddenPatterns = [
      '.github/**',
      '.env*',
      '**/.env*',
      '**/*_rsa*',
      '**/*.pem',
      'secrets/**',
      '**/credentials*',
      ...(options?.protectedPaths || []),
    ];

    const violated: string[] = [];
    for (const f of changedFiles) {
      const cleanPath = f.replace(/^[\\/]+/, '').replace(/\\/g, '/');

      // Check forbidden / protected paths
      const isForbidden = forbiddenPatterns.some(pattern => this.matchGlob(cleanPath, pattern));
      if (isForbidden) {
        violated.push(cleanPath);
      }
    }

    if (violated.length > 0) {
      return {
        authorized: false,
        violatedPaths: violated,
        reason: `Modification of protected files detected: [${violated.join(', ')}]. Autonomous edits to sensitive/governance paths are blocked.`,
      };
    }

    return { authorized: true };
  }

  private matchGlob(val: string, pattern: string): boolean {
    const v = val.trim().replace(/\\/g, '/');
    const p = pattern.trim().replace(/\\/g, '/');
    if (p === v) return true;

    if (p.endsWith('/**')) {
      const prefix = p.slice(0, -3);
      return v === prefix || v.startsWith(prefix + '/');
    }

    if (p.endsWith('*')) {
      const prefix = p.slice(0, -1);
      return v.startsWith(prefix);
    }

    return false;
  }
}

export const defaultRepositoryAuthorizationPolicy = new RepositoryAuthorizationPolicy();

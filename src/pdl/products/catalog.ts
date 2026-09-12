/**
 * Phase 5.4: Formal Product Onboarding Contract & Catalog.
 *
 * Defines explicit configuration for every product admitted into the
 * PUB Autonomous Product Factory. The PDL never silently infers critical
 * product rules or paths; everything must be declared and validated.
 */

export type AutonomyLevel = 0 | 1 | 2 | 3 | 4 | 5;

export interface ProductManifest {
  /** Canonical unique identifier of the product */
  productId: string;
  /** HTTPS clone / origin repository URL */
  repository: string;
  /** Authorized organization */
  organization: string;
  /** Protected default branch */
  defaultBranch: string;
  /** Allowed patterns for autonomous working branches */
  developmentBranchPolicy: string[];
  /** Command to execute automated unit/integration test suite */
  testCommand: string;
  /** Command to build the project */
  buildCommand?: string;
  /** Command to run static analysis or linter */
  validationCommand?: string;
  /** Allowed path patterns for worker modifications (glob) */
  allowedPaths: string[];
  /** Strictly protected path patterns that autonomous workers can NEVER modify */
  protectedPaths: string[];
  /** Model / gateway policy allowed for this product */
  providerPolicy?: {
    allowedGateways: string[];
    allowedModels: string[];
  };
  /** Maximum autonomy level authorized for this product */
  maxAutonomyLevel: AutonomyLevel;
  /** Whether remote git persistence is authorized and eligible for this product (Phase 5.4 fail-closed) */
  remotePersistenceEligible?: boolean;
  /** Protected branches that cannot receive autonomous pushes */
  protectedBranches?: string[];
}

export const CANONICAL_PUB_PRODUCTS: Record<string, ProductManifest> = {
  'pub-rate-calculator': {
    productId: 'pub-rate-calculator',
    repository: 'https://github.com/pubcoreagencia/pub-rate-calculator.git',
    organization: 'pubcoreagencia',
    defaultBranch: 'main',
    developmentBranchPolicy: ['feat/*', 'feature/*', 'fix/*', 'rate-calculator-*', 'worker/*'],
    testCommand: 'node test/validate.mjs',
    validationCommand: 'node test/validate.mjs',
    allowedPaths: ['src/**', 'test/**', 'public/**', 'config/**'],
    protectedPaths: ['.github/**', 'package.json', 'package-lock.json', '.env*'],
    maxAutonomyLevel: 5,
    remotePersistenceEligible: true,
  },
  'pub-dev-loop-template': {
    productId: 'pub-dev-loop-template',
    repository: 'https://github.com/pubcoreagencia/pub-dev-loop-template.git',
    organization: 'pubcoreagencia',
    defaultBranch: 'main',
    developmentBranchPolicy: ['feat/*', 'feature/*', 'fix/*', 'template-*', 'worker/*'],
    testCommand: 'node -e "const fs = require(\'fs\'); if (!fs.existsSync(\'AUTONOMOUS_CYCLE.md\')) process.exit(1); console.log(\'[Validate] Template baseline OK\');"',
    allowedPaths: ['*.md', 'devloop-*', 'docs/**', 'src/**'],
    protectedPaths: ['.github/**', '.env*', 'secrets/**'],
    maxAutonomyLevel: 5,
    remotePersistenceEligible: true,
  },
  'pub-shopee-scraper': {
    productId: 'pub-shopee-scraper',
    repository: 'https://github.com/pubcoreagencia/pub-shopee-scraper.git',
    organization: 'pubcoreagencia',
    defaultBranch: 'main',
    developmentBranchPolicy: ['feat/*', 'feature/*', 'fix/*', 'shopee-*', 'worker/*'],
    testCommand: 'node -e "const fs = require(\'fs\'); if (!fs.existsSync(\'src\')) process.exit(1); console.log(\'[Validate] Shopee scraper structure OK\');"',
    allowedPaths: ['src/**', 'docs/**', 'tests/**', '*.md'],
    protectedPaths: ['.github/**', '.env*', 'wrangler.*', 'package*.json'],
    maxAutonomyLevel: 5,
    remotePersistenceEligible: true,
  },
  'pub-github-mcp': {
    productId: 'pub-github-mcp',
    repository: 'https://github.com/pubcoreagencia/pub-github-mcp.git',
    organization: 'pubcoreagencia',
    defaultBranch: 'main',
    developmentBranchPolicy: ['feat/*', 'feature/*', 'fix/*'],
    testCommand: 'npm test',
    buildCommand: 'npm run build',
    allowedPaths: ['src/**', 'tests/**'],
    protectedPaths: ['.github/**', '.env*'],
    maxAutonomyLevel: 5,
    remotePersistenceEligible: false,
  },
  'pubcore': {
    productId: 'pubcore',
    repository: 'https://github.com/pubcoreagencia/pubcore.git',
    organization: 'pubcoreagencia',
    defaultBranch: 'main',
    developmentBranchPolicy: ['feat/*', 'feature/*', 'fix/*'],
    testCommand: 'npm test',
    buildCommand: 'npm run build',
    allowedPaths: ['src/**', 'public/**'],
    protectedPaths: ['.github/**', '.env*'],
    maxAutonomyLevel: 4, // Frontend core requires human release approval before push
    remotePersistenceEligible: false,
  },
  'pub-neural': {
    productId: 'pub-neural',
    repository: 'https://github.com/pubcoreagencia/pub-neural.git',
    organization: 'pubcoreagencia',
    defaultBranch: 'main',
    developmentBranchPolicy: ['feat/*', 'feature/*', 'fix/*', 'worker/*', 'neural-*'],
    testCommand: 'bash tests/ingestion/run_ingestion_tests.sh',
    validationCommand: 'python3 -m compileall -q src',
    allowedPaths: ['src/**', 'tests/**', 'docs/**', 'migrations/**', '*.md'],
    protectedPaths: ['.github/**', '.env*'],
    maxAutonomyLevel: 4,
    remotePersistenceEligible: true,
  },
};

export class ProductCatalog {
  private readonly products = new Map<string, ProductManifest>();

  constructor(initialProducts: ProductManifest[] = Object.values(CANONICAL_PUB_PRODUCTS)) {
    for (const p of initialProducts) {
      this.register(p);
    }
  }

  register(manifest: ProductManifest): void {
    this.products.set(manifest.productId, manifest);
    const normUrl = this.normalizeRepoUrl(manifest.repository);
    this.products.set(normUrl, manifest);
  }

  get(productIdOrRepo: string): ProductManifest | undefined {
    return this.products.get(productIdOrRepo) || this.products.get(this.normalizeRepoUrl(productIdOrRepo));
  }

  list(): ProductManifest[] {
    const seen = new Set<string>();
    const list: ProductManifest[] = [];
    for (const m of this.products.values()) {
      if (!seen.has(m.productId)) {
        seen.add(m.productId);
        list.push(m);
      }
    }
    return list;
  }

  private normalizeRepoUrl(url: string): string {
    return url.trim().toLowerCase().replace(/\.git$/, '').replace(/\/$/, '');
  }
}

export const defaultProductCatalog = new ProductCatalog();

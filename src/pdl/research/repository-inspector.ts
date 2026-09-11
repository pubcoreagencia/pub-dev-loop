import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { TaskIntake } from '../../task/intake.js';
import type { ContextBundle } from '../../task/context-discovery.js';
import type { RepositoryInspector, PreflightFinding } from '../../task/preflight.js';

export interface RepositoryInspectorOptions {
  workspaceRoot?: string;
}

/**
 * PdlRepositoryInspector — Inspects project repository structure, package metadata,
 * and build/test toolchain without mutating workspace state.
 */
export class PdlRepositoryInspector implements RepositoryInspector {
  private readonly workspaceRoot: string;

  constructor(options: RepositoryInspectorOptions = {}) {
    this.workspaceRoot = options.workspaceRoot ?? process.cwd();
  }

  async inspect(intake: TaskIntake, _context: ContextBundle): Promise<PreflightFinding[]> {
    const findings: PreflightFinding[] = [];
    const root = this.workspaceRoot;

    // 1. Inspect package.json if present
    const pkgPath = join(root, 'package.json');
    if (existsSync(pkgPath)) {
      try {
        const pkgContent = readFileSync(pkgPath, 'utf8');
        const pkg = JSON.parse(pkgContent);

        if (pkg.name) {
          findings.push({
            category: 'REPOSITORY_INSPECTION',
            key: 'package:name',
            value: String(pkg.name),
            source: 'package.json',
            confidence: 'HIGH',
          });
        }

        if (pkg.scripts && typeof pkg.scripts === 'object') {
          const scriptKeys = Object.keys(pkg.scripts);
          findings.push({
            category: 'REPOSITORY_INSPECTION',
            key: 'package:scripts',
            value: scriptKeys.slice(0, 15).join(', '),
            source: 'package.json',
            confidence: 'HIGH',
          });

          if (pkg.scripts.test) {
            findings.push({
              category: 'REPOSITORY_INSPECTION',
              key: 'test:command',
              value: String(pkg.scripts.test),
              source: 'package.json',
              confidence: 'HIGH',
            });
          }

          if (pkg.scripts.build) {
            findings.push({
              category: 'REPOSITORY_INSPECTION',
              key: 'build:command',
              value: String(pkg.scripts.build),
              source: 'package.json',
              confidence: 'HIGH',
            });
          }
        }

        const deps = Object.keys(pkg.dependencies || {});
        const devDeps = Object.keys(pkg.devDependencies || {});
        const allDeps = [...deps, ...devDeps];

        if (allDeps.includes('typescript')) {
          findings.push({
            category: 'REPOSITORY_INSPECTION',
            key: 'toolchain:typescript',
            value: 'present',
            source: 'package.json',
            confidence: 'HIGH',
          });
        }

        if (allDeps.some((d) => d.includes('jest') || d.includes('vitest') || d.includes('mocha'))) {
          const framework = allDeps.find((d) => d.includes('jest') || d.includes('vitest') || d.includes('mocha'));
          findings.push({
            category: 'REPOSITORY_INSPECTION',
            key: 'toolchain:test-framework',
            value: framework || 'unknown',
            source: 'package.json',
            confidence: 'HIGH',
          });
        }
      } catch (err: any) {
        findings.push({
          category: 'REPOSITORY_INSPECTION',
          key: 'package:parse_error',
          value: err?.message || 'Failed to parse package.json',
          source: 'package.json',
          confidence: 'LOW',
        });
      }
    }

    // 2. Inspect tsconfig.json
    const tsconfigPath = join(root, 'tsconfig.json');
    if (existsSync(tsconfigPath)) {
      findings.push({
        category: 'REPOSITORY_INSPECTION',
        key: 'config:tsconfig',
        value: 'present',
        source: 'tsconfig.json',
        confidence: 'HIGH',
      });
    }

    // 3. Fallback finding if empty
    if (findings.length === 0) {
      findings.push({
        category: 'REPOSITORY_INSPECTION',
        key: 'repository:baseline',
        value: `Inspected ${root}; standard project structure assumed`,
        source: 'filesystem',
        confidence: 'MEDIUM',
      });
    }

    return findings;
  }
}

import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { TaskIntake } from '../../task/intake.js';
import type { ContextBundle, ContextReference } from '../../task/context-discovery.js';
import type { DocumentationLookup, PreflightFinding } from '../../task/preflight.js';

export interface DocumentationLookupOptions {
  workspaceRoot?: string;
  maxFiles?: number;
}

/**
 * PdlDocumentationLookup — Discovers project documentation files (README, docs/*.md, specifications)
 * and produces preflight findings and context references.
 */
export class PdlDocumentationLookup implements DocumentationLookup {
  private readonly workspaceRoot: string;
  private readonly maxFiles: number;

  constructor(options: DocumentationLookupOptions = {}) {
    this.workspaceRoot = options.workspaceRoot ?? process.cwd();
    this.maxFiles = options.maxFiles ?? 10;
  }

  async lookup(intake: TaskIntake, _context: ContextBundle): Promise<PreflightFinding[]> {
    const references = this.discoverReferences();
    const findings: PreflightFinding[] = [];

    for (const ref of references) {
      findings.push({
        category: 'DOCUMENTATION_LOOKUP',
        key: `doc:${ref.title}`,
        value: `${ref.path} — ${ref.relevance}`,
        source: ref.path,
        confidence: 'HIGH',
      });
    }

    if (findings.length === 0) {
      findings.push({
        category: 'DOCUMENTATION_LOOKUP',
        key: 'doc:standard',
        value: 'Standard codebase documentation structure',
        source: 'filesystem',
        confidence: 'MEDIUM',
      });
    }

    return findings;
  }

  /**
   * Discovers ContextReference items to attach to ContextBundle.relevantDocumentation
   */
  discoverReferences(): ContextReference[] {
    const root = this.workspaceRoot;
    const references: ContextReference[] = [];

    // 1. Check root README
    const candidateReadmes = ['README.md', 'readme.md', 'README'];
    for (const readme of candidateReadmes) {
      const readmePath = join(root, readme);
      if (existsSync(readmePath)) {
        references.push({
          title: 'Project README',
          path: readme,
          relevance: 'Primary project overview and setup guidelines',
        });
        break;
      }
    }

    // 2. Check docs directory if present
    const docsDir = join(root, 'docs');
    if (existsSync(docsDir)) {
      try {
        const files = readdirSync(docsDir);
        for (const file of files) {
          if (references.length >= this.maxFiles) break;
          if (file.endsWith('.md')) {
            references.push({
              title: file.replace('.md', ''),
              path: `docs/${file}`,
              relevance: `Project documentation file in docs/`,
            });
          }
        }
      } catch {
        // Best effort inspection
      }
    }

    return references;
  }
}

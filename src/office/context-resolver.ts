import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import type { EngineeringTask } from './intent.js';
import { PUB_HOLDING_SECTORS } from './squads.js';

export interface ContextProvenance {
  source: 'REPOSITORY_FILE' | 'GIT_STATE' | 'ENGINEERING_TASK' | 'PACKAGE_MANIFEST' | 'OFFICE_CATALOG';
  path?: string;
  detail?: string;
  evidence?: string;
}

export interface ResolvedUnknown {
  unknown: string;
  status: 'RESOLVED' | 'DISCOVERED' | 'UNRESOLVED';
  discoveredPaths: string[];
  evidenceSnippet?: string;
  rationale: string;
}

export interface ResolvedGitState {
  branch: string;
  headSha: string;
  isClean: boolean;
  changedFiles: string[];
}

export interface ResolvedContext {
  taskId: string;
  project: string;
  repository: string;
  git_state: ResolvedGitState;
  relevant_files: string[];
  relevant_directories: string[];
  dependencies: Record<string, string>;
  existing_tests: string[];
  known_context: string[];
  resolved_unknowns: ResolvedUnknown[];
  unresolved_unknowns: string[];
  constraints: string[];
  assumptions: string[];
  provenance: ContextProvenance[];
  resolvedAt: string;
}

/**
 * Safely inspects the real Git state of the workspace using strictly read-only commands.
 */
function getRealGitState(workspaceDir: string): ResolvedGitState {
  try {
    const branch = execSync('git rev-parse --abbrev-ref HEAD', {
      cwd: workspaceDir,
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 5000,
    }).toString().trim();

    const headSha = execSync('git rev-parse HEAD', {
      cwd: workspaceDir,
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 5000,
    }).toString().trim();

    const statusOutput = execSync('git status --porcelain', {
      cwd: workspaceDir,
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 5000,
    }).toString().trim();

    const changedFiles = statusOutput
      ? statusOutput
          .split('\n')
          .map(line => line.trim().slice(3).trim())
          .filter(Boolean)
      : [];

    return {
      branch: branch || 'unknown',
      headSha: headSha || 'unknown',
      isClean: changedFiles.length === 0,
      changedFiles,
    };
  } catch {
    return {
      branch: 'main',
      headSha: 'untracked',
      isClean: true,
      changedFiles: [],
    };
  }
}

/**
 * Scans directories recursively (up to maxDepth) to locate matching files without overwhelming memory.
 */
function scanMatchingFiles(dir: string, keywords: string[], maxDepth = 4, currentDepth = 0): string[] {
  if (currentDepth > maxDepth || !existsSync(dir)) return [];

  const matched: string[] = [];
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (['node_modules', '.git', 'dist', '.wrangler', 'coverage'].includes(entry.name)) {
        continue;
      }

      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        matched.push(...scanMatchingFiles(fullPath, keywords, maxDepth, currentDepth + 1));
      } else if (entry.isFile()) {
        const lowerName = entry.name.toLowerCase();
        for (const kw of keywords) {
          if (lowerName.includes(kw.toLowerCase())) {
            matched.push(fullPath.replace(/\\/g, '/'));
            break;
          }
        }
      }
    }
  } catch {
    // Ignore read errors gracefully
  }

  return matched;
}

/**
 * Reads a candidate file to locate concrete code evidence matching search keywords.
 */
function inspectCandidateForEvidence(
  filePath: string,
  keywords: string[]
): { snippet?: string; lineNumber?: number } {
  try {
    if (!existsSync(filePath)) return {};
    const stat = statSync(filePath);
    if (stat.size > 500 * 1024) return {}; // Skip huge files (>500KB)

    const content = readFileSync(filePath, 'utf8');
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lower = line.toLowerCase();
      for (const kw of keywords) {
        if (lower.includes(kw.toLowerCase())) {
          const trimmed = line.trim();
          // Skip trivial comment-only lines
          if (trimmed.length > 5 && !trimmed.startsWith('//') && !trimmed.startsWith('*')) {
            return {
              snippet: `Line ${i + 1}: ${trimmed.slice(0, 120)}`,
              lineNumber: i + 1,
            };
          }
        }
      }
    }
  } catch {}
  return {};
}

/**
 * Attempts to resolve an unknown requirement by querying repository workspace files
 * and verifying concrete code evidence within candidate files.
 * Semantics:
 * UNKNOWN -> SEARCH -> CANDIDATES -> INSPECTION -> EVIDENCE -> RESOLVED (or DISCOVERED / UNRESOLVED)
 */
function attemptResolveUnknown(unknownText: string, baseDir: string): ResolvedUnknown {
  const uLower = unknownText.toLowerCase();

  // Extract search tokens from the unknown statement
  const keywords: string[] = [];
  if (uLower.includes('checkout')) keywords.push('checkout', 'cart', 'order', 'payment');
  if (uLower.includes('rpc')) keywords.push('rpc', 'api', 'route', 'endpoint');
  if (uLower.includes('worker')) keywords.push('worker', 'router', 'queue');
  if (uLower.includes('test')) keywords.push('test', 'spec');
  if (uLower.includes('database') || uLower.includes('banco')) keywords.push('db', 'schema', 'repository', 'migrate');

  if (keywords.length === 0) {
    // Generic tokens
    const words = unknownText.split(/\s+/).filter(w => w.length > 4);
    keywords.push(...words.slice(0, 3));
  }

  const discovered = scanMatchingFiles(baseDir, keywords, 3);

  if (discovered.length === 0) {
    return {
      unknown: unknownText,
      status: 'UNRESOLVED',
      discoveredPaths: [],
      rationale: 'No matching files found for keywords [' + keywords.join(', ') + '] in workspace',
    };
  }

  // Inspect candidates for concrete code evidence
  for (const candidate of discovered.slice(0, 5)) {
    const { snippet } = inspectCandidateForEvidence(candidate, keywords);
    if (snippet) {
      return {
        unknown: unknownText,
        status: 'RESOLVED',
        discoveredPaths: discovered.slice(0, 10),
        evidenceSnippet: snippet,
        rationale: 'Resolved with verified code evidence from ' + candidate + ' (' + snippet + ')',
      };
    }
  }

  // Found candidate files by filename, but no direct code lines verified inside
  return {
    unknown: unknownText,
    status: 'DISCOVERED',
    discoveredPaths: discovered.slice(0, 10),
    rationale: 'Discovered ' + discovered.length + ' candidate files matching keywords, pending code evidence extraction',
  };
}

/**
 * Resolves repository context deterministically based on EngineeringTask, real Git state, and target workspace.
 */
export function resolveContext(
  task: EngineeringTask,
  workspaceDir: string = process.cwd()
): ResolvedContext {
  const provenances: ContextProvenance[] = [];
  const relevant_files: string[] = [];
  const relevant_directories: string[] = [];
  const existing_tests: string[] = [];
  let dependencies: Record<string, string> = {};

  provenances.push({
    source: 'ENGINEERING_TASK',
    detail: 'Intent: ' + task.intent + ' | TaskType: ' + task.task_type,
  });

  // 1. Inspect real Git State (read-only)
  const realGit = getRealGitState(workspaceDir);
  provenances.push({
    source: 'GIT_STATE',
    detail: `Branch: ${realGit.branch} | HEAD: ${realGit.headSha} | isClean: ${realGit.isClean} | Changed files: ${realGit.changedFiles.length}`,
  });

  // 2. Read package.json if available
  const pkgPath = join(workspaceDir, 'package.json');
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
      dependencies = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
      provenances.push({
        source: 'PACKAGE_MANIFEST',
        path: 'package.json',
        detail: 'Extracted ' + Object.keys(dependencies).length + ' dependencies',
      });
    } catch {}
  }

  // 3. Identify relevant directories from declared scope
  for (const s of task.scope) {
    const candidateDir = join(workspaceDir, s);
    if (existsSync(candidateDir)) {
      relevant_directories.push(s);
      provenances.push({
        source: 'REPOSITORY_FILE',
        path: s,
        detail: 'Scope directory verified in workspace',
      });
    }
  }

  // 4. Identify existing test files
  const testsDir = join(workspaceDir, 'tests');
  if (existsSync(testsDir)) {
    const testFiles = scanMatchingFiles(testsDir, ['test.ts', 'spec.ts'], 2);
    existing_tests.push(...testFiles.map(f => f.replace(workspaceDir.replace(/\\/g, '/'), '').replace(/^\//, '')));
  }

  // 5. Resolve Unknowns with Evidence Inspection
  const resolved_unknowns: ResolvedUnknown[] = [];
  const unresolved_unknowns: string[] = [];

  for (const u of task.unknowns) {
    const res = attemptResolveUnknown(u, workspaceDir);
    resolved_unknowns.push(res);
    if (res.status === 'RESOLVED') {
      for (const p of res.discoveredPaths) {
        const relPath = p.replace(workspaceDir.replace(/\\/g, '/'), '').replace(/^\//, '');
        if (!relevant_files.includes(relPath)) {
          relevant_files.push(relPath);
        }
      }
      provenances.push({
        source: 'REPOSITORY_FILE',
        path: res.discoveredPaths[0]?.replace(workspaceDir.replace(/\\/g, '/'), '').replace(/^\//, ''),
        detail: 'Resolved unknown via code evidence: ' + u,
        evidence: res.evidenceSnippet,
      });
    } else if (res.status === 'DISCOVERED') {
      for (const p of res.discoveredPaths) {
        const relPath = p.replace(workspaceDir.replace(/\\/g, '/'), '').replace(/^\//, '');
        if (!relevant_files.includes(relPath)) {
          relevant_files.push(relPath);
        }
      }
      provenances.push({
        source: 'REPOSITORY_FILE',
        detail: 'Discovered candidate files for unknown: ' + u,
      });
    } else {
      unresolved_unknowns.push(u);
    }
  }

  // 6. Look up official repository from Holding Catalog if project is known
  let targetRepoUrl = 'https://github.com/pubcoreagencia/' + (task.project || 'pub-dev-loop') + '.git';
  if (task.project) {
    for (const sector of PUB_HOLDING_SECTORS) {
      if (sector.repos.includes(task.project)) {
        provenances.push({
          source: 'OFFICE_CATALOG',
          detail: 'Matched project to Holding Sector: ' + sector.id,
        });
        break;
      }
    }
  }

  return {
    taskId: task.id,
    project: task.project || 'pub-dev-loop',
    repository: targetRepoUrl,
    git_state: realGit,
    relevant_files,
    relevant_directories,
    dependencies,
    existing_tests: existing_tests.slice(0, 15),
    known_context: task.known_context,
    resolved_unknowns,
    unresolved_unknowns,
    constraints: task.constraints,
    assumptions: task.assumptions,
    provenance: provenances,
    resolvedAt: new Date().toISOString(),
  };
}

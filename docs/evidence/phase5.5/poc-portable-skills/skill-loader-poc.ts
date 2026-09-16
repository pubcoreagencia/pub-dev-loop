import * as fs from 'fs';
import * as path from 'path';

export interface SkillMetadata {
  name: string;
  description: string;
  version?: string;
  author?: string;
  compatibility?: string[];
  allowedTools?: string[];
  unknownFields?: Record<string, any>;
}

export interface SkillDiscoveryEntry {
  name: string;
  description: string;
  version?: string;
  directoryPath: string;
  manifestPath: string;
  manifestSizeBytes: number;
  metadataSizeBytes: number;
}

export interface FullSkillLoaded {
  metadata: SkillMetadata;
  instructionsBody: string;
  directoryPath: string;
  manifestPath: string;
  totalSizeBytes: number;
  referencedFiles: string[];
  scriptsDetected: string[];
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Isolated deterministic parser for YAML Frontmatter without external dependencies.
 */
export function parseFrontmatter(rawContent: string): { frontmatterText: string; bodyText: string; rawYamlLines: string[] } | null {
  const normalized = rawContent.replace(/\r\n/g, '\n');
  if (!normalized.startsWith('---\n')) {
    return null;
  }
  const closingIdx = normalized.indexOf('\n---\n', 4);
  if (closingIdx === -1) {
    return null;
  }
  const frontmatterText = normalized.substring(4, closingIdx);
  const bodyText = normalized.substring(closingIdx + 5);
  return {
    frontmatterText,
    bodyText,
    rawYamlLines: frontmatterText.split('\n')
  };
}

/**
 * Parses simple key-value and list structures typical in agentskills.io SKILL.md.
 */
export function parseYamlDict(yamlLines: string[]): { data: Record<string, any>; parseError?: string } {
  const data: Record<string, any> = {};
  let currentKey: string | null = null;
  let currentList: string[] | null = null;

  for (let i = 0; i < yamlLines.length; i++) {
    const rawLine = yamlLines[i];
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    // Check for list item under currentKey
    if (line.startsWith('- ')) {
      if (!currentKey) {
        return { data: {}, parseError: `List item without parent key at line ${i + 1}` };
      }
      const itemVal = line.substring(2).trim().replace(/^["']|["']$/g, '');
      if (!currentList) {
        currentList = [];
        data[currentKey] = currentList;
      }
      currentList.push(itemVal);
      continue;
    }

    // Key-Value pair
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) {
      return { data: {}, parseError: `Malformed YAML line (missing colon): "${line}" at line ${i + 1}` };
    }

    const key = line.substring(0, colonIdx).trim();
    const val = line.substring(colonIdx + 1).trim();

    // Check for unclosed brackets or unmatched quotes
    if (val.includes('[') && !val.includes(']')) {
      return { data: {}, parseError: `Unmatched opening bracket on line ${i + 1}: "${line}"` };
    }
    if ((val.startsWith('"') && !val.endsWith('"')) || (val.startsWith("'") && !val.endsWith("'"))) {
      if (val.length === 1 || (!val.endsWith('"') && !val.endsWith("'"))) {
        return { data: {}, parseError: `Unmatched quote on line ${i + 1}: "${line}"` };
      }
    }

    // Reset current list pointer
    currentKey = key;
    currentList = null;

    if (val === '' || val === '[]') {
      data[key] = val === '[]' ? [] : null;
    } else if (val.startsWith('[') && val.endsWith(']')) {
      const items = val.substring(1, val.length - 1).split(',').map(s => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
      data[key] = items;
    } else {
      // String or scalar
      data[key] = val.replace(/^["']|["']$/g, '');
    }
  }

  return { data };
}

/**
 * Validates skill metadata against strict specification rules.
 */
export function validateSkillMetadata(metadata: Record<string, any>, skillDir: string, bodyText: string = ''): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required: name
  if (!metadata.name || typeof metadata.name !== 'string') {
    errors.push('Missing required string property: name');
  } else {
    // 1-64 chars, lowercase alphanumeric and hyphens, cannot start or end with hyphen
    const nameRegex = /^[a-z0-9]([a-z0-9-]{0,62}[a-z0-9])?$/;
    if (!nameRegex.test(metadata.name)) {
      errors.push(`Invalid name format: "${metadata.name}". Must be 1-64 lowercase alphanumeric chars with optional middle hyphens.`);
    }
  }

  // Required: description
  if (!metadata.description || typeof metadata.description !== 'string') {
    errors.push('Missing required string property: description');
  } else if (metadata.description.length < 10) {
    errors.push(`Description too short (${metadata.description.length} chars). Minimum is 10 characters.`);
  } else if (metadata.description.length > 1024) {
    errors.push(`Description too long (${metadata.description.length} chars). Maximum is 1024 characters.`);
  }

  // Optional: allowed-tools (or allowedTools)
  const tools = metadata['allowed-tools'] || metadata.allowedTools;
  if (tools) {
    const toolList = Array.isArray(tools) ? tools : String(tools).split(/\s+/);
    for (const tool of toolList) {
      if (/[^a-zA-Z0-9_\-:]/.test(tool)) {
        errors.push(`Invalid tool identifier: "${tool}"`);
      }
    }
  }

  // Body checks: Reference link and path traversal validation
  if (bodyText) {
    // Find all relative references like (./references/...) or Reference: ...
    const rawMatches = bodyText.match(/(?:\.\/|references\/|\.\.\/)[^\s\)\],]+/g) || [];
    for (const raw of rawMatches) {
      const ref = raw.replace(/[`'"]/g, '');
      const pathCheck = assertPathSafe(skillDir, ref);
      if (!pathCheck.isSafe) {
        errors.push(`Security violation: ${pathCheck.error}`);
      } else if (!fs.existsSync(pathCheck.resolvedPath)) {
        errors.push(`Missing referenced file: "${ref}" cannot be found in skill package`);
      }
    }
  }

  // Unknown fields detection
  const standardFields = new Set(['name', 'description', 'version', 'author', 'license', 'compatibility', 'metadata', 'allowed-tools', 'allowedTools']);
  const unknownFields: Record<string, any> = {};
  for (const [k, v] of Object.entries(metadata)) {
    if (!standardFields.has(k)) {
      unknownFields[k] = v;
      warnings.push(`Unknown/custom frontmatter field encountered: "${k}"`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Path Traversal & Boundary Safety Guard
 */
export function assertPathSafe(baseDir: string, relativePath: string): { isSafe: boolean; resolvedPath: string; error?: string } {
  // Normalize both
  const normalizedRelative = path.normalize(relativePath);
  if (path.isAbsolute(normalizedRelative)) {
    return { isSafe: false, resolvedPath: '', error: `Absolute paths are strictly forbidden: "${relativePath}"` };
  }
  if (normalizedRelative.startsWith('..') || normalizedRelative.includes(path.sep + '..') || normalizedRelative.includes('..' + path.sep)) {
    return { isSafe: false, resolvedPath: '', error: `Path traversal sequence detected: "${relativePath}"` };
  }
  const resolved = path.resolve(baseDir, normalizedRelative);
  if (!resolved.startsWith(path.resolve(baseDir) + path.sep) && resolved !== path.resolve(baseDir)) {
    return { isSafe: false, resolvedPath: '', error: `Path escapes root directory: "${relativePath}"` };
  }
  return { isSafe: true, resolvedPath: resolved };
}

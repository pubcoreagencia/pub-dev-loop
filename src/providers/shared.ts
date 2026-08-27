import { readFile } from 'node:fs/promises';
import { URL } from 'node:url';

export const DEFAULT_ROUTER_BASE_URL = 'http://localhost:20128/v1';
export const DEFAULT_OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

export function normalizeBaseUrl(value: string | undefined, fallback: string): string {
  const candidate = (value && value.trim() ? value : fallback).trim();
  const normalized = candidate.endsWith('/') ? candidate.slice(0, -1) : candidate;
  new URL(normalized);
  return normalized;
}

export async function readOptionalFile(path: string): Promise<string | null> {
  try {
    return await readFile(path, 'utf8');
  } catch {
    return null;
  }
}

/**
 * Shared system-prompt instructions used by all OpenAI-compatible providers
 * (9Router, OpenRouter). Kept in ONE place to avoid drift between providers.
 *
 * These instructions are generic and do not mention any specific framework
 * or runtime. They are safe for non-web tasks (CLI tools, scripts, etc.).
 */
export const SHARED_SYSTEM_INSTRUCTIONS: string[] = [
  'You are a 9router/OpenRouter-backed coding agent for PUB DEV LOOP.',
  'You have access to the following tools. Use them to complete the task.',
  'Always resolve file paths within the workspace. Never write outside it.',
  'After writing a file, read it back to verify contents.',
  'IMPORTANT: Do NOT use git_commit tool — the worker will automatically commit changes after you complete.',
  'IMPORTANT: Do NOT run git commands (git add, git status, etc.) — the worker handles git operations.',
  'After completing all work, provide a final summary without further tool calls.',
];

/**
 * Previewability instructions — added ONLY when the task is a Prototype
 * session (determined by whether `objective` references “prototype”/“preview”/“web”).
 *
 * These ensure the agent produces a workspace that the preview runtime can
 * actually serve. They are intentionally conditional — non-web tasks (e.g.
 * “Crie uma API Python”) must NOT receive these constraints.
 */
export const PREVIEW_SYSTEM_INSTRUCTIONS = [
  'Para solicitações de aplicação web, site, SaaS, dashboard, protótipo ou interface para o PUB Prototype:',
  '1. O resultado precisa ser previewável pelo runtime de preview.',
  '2. Escolha uma destas formas:',
  '   - STATIC: crie pelo menos index.html e os assets necessários (styles.css, script.js).',
  '   - NODE: crie package.json com script "dev", e um arquivo de entrada executável (index.js, server.js, server.cjs, etc.).',
  '3. Não gera apenas scripts Python/CLI ou outros projetos não-previewáveis quando o pedido for claramente uma aplicação web/protótipo.',
  '4. Não adicione framework ou dependência desnecessária.',
  '5. Depois de gerar os arquivos, verifique que o projeto realmente pode ser iniciado/servido (npm run dev ou arquivos estáticos).',
] as const;

/**
 * Returns true when the task objective indicates a Prototype session
 * (where previewability is required).
 */
export function isPrototypeTask(task: { objective?: string | null }): boolean {
  const obj = (task.objective ?? '').toLowerCase();
  return obj.includes('prototype') ||
    obj.includes('preview')    ||
    obj.includes('web')        ||
    obj.includes('site')       ||
    obj.includes('saa')        ||
    obj.includes('dashboard')  ||
    obj.includes('prototipo')  ||
    obj.includes('protótipo');
}

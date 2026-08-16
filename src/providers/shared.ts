import { readFile } from 'node:fs/promises';
import { URL } from 'node:url';

export const DEFAULT_ROUTER_BASE_URL = 'http://localhost:20128/v1';

export function normalizeBaseUrl(value: string | undefined, fallback: string): string {
  const candidate = (value ?? fallback).trim();
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

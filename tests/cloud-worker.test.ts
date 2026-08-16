import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { getCodexAuthStatus } from '../src/auth.js';
describe('cloud Codex worker configuration',()=>{
  it('uses a Linux non-root image with Git and the official Codex installer',async()=>{const dockerfile=await readFile('Dockerfile.worker','utf8');expect(dockerfile).toContain('node:22-bookworm-slim');expect(dockerfile).toContain('git');expect(dockerfile).toContain('chatgpt.com/codex/install.sh');expect(dockerfile).toContain('USER codex');});
  it('reports missing and configured secret-manager references without reading a secret',()=>{expect(getCodexAuthStatus({})).toBe('MISSING');expect(getCodexAuthStatus({CODEX_AUTH_SECRET_REF:'secret-manager://codex'})).toBe('REFERENCE_CONFIGURED');});
});

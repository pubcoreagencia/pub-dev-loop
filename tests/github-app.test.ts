import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockExecFileSync = vi.hoisted(() => vi.fn());

vi.mock('node:child_process', () => ({
  execFileSync: mockExecFileSync,
}));

import {
  PROTOTYPE_REPOSITORY,
  getGitHubToken,
  getPrototypesRepo,
  pushBranch,
  verifyRemoteSha,
} from '../src/github-app.js';

describe('github-app — PAT authentication', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.PROTOTYPE_BOT_TOKEN;
    delete process.env.PROD;
    delete process.env.NODE_ENV;
  });

  describe('PROTOTYPE_REPOSITORY (whitelist)', () => {
    it('deve ser fixo em pubcoreagencia/pub-dev-loop-prototypes', () => {
      expect(PROTOTYPE_REPOSITORY).toBe('pubcoreagencia/pub-dev-loop-prototypes');
    });

    it('não pode ser alterado por env var', () => {
      process.env.PROTOTYPE_PROTOTYPES_REPO = 'attacker/repo';
      // Mesmo com env, retorna o fixo
      expect(getPrototypesRepo()).toBe('pubcoreagencia/pub-dev-loop-prototypes');
    });
  });

  describe('getGitHubToken', () => {
    it('retorna PROTOTYPE_BOT_TOKEN quando presente', () => {
      process.env.PROTOTYPE_BOT_TOKEN = 'ghp_test1234567890abcdef';
      expect(getGitHubToken()).toBe('ghp_test1234567890abcdef');
    });

    it('retorna vazio se não há token em produção', () => {
      process.env.PROD = 'true';
      expect(getGitHubToken()).toBe('');
    });

    it('usa gh auth token como fallback em dev', () => {
      mockExecFileSync.mockReturnValue('ghp_fallback123');
      const token = getGitHubToken();
      expect(token).toBe('ghp_fallback123');
    });

    it('retorna vazio se gh auth token falha', () => {
      mockExecFileSync.mockImplementation(() => {
        throw new Error('gh not authenticated');
      });
      expect(getGitHubToken()).toBe('');
    });
  });

  describe('pushBranch', () => {
    it('retorna erro se não há token', () => {
      process.env.PROD = 'true'; // disable gh fallback
      const result = pushBranch('/workspace', 'main');
      expect(result.ok).toBe(false);
      expect(result.error).toContain('PROTOTYPE_BOT_TOKEN');
    });

    it('empurra para o repository whitelisted (não aceita outro)', () => {
      process.env.PROTOTYPE_BOT_TOKEN = 'ghp_secret';
      mockExecFileSync.mockReturnValue('');

      pushBranch('/workspace', 'main');

      // Verificar que o remote adicionado foi para o repo whitelisted
      const calls = mockExecFileSync.mock.calls;
      const addOriginCall = calls.find(c => c[0] === 'git' && c[1]?.[0] === 'remote' && c[1]?.[1] === 'add');
      expect(addOriginCall).toBeDefined();
      // c[1] is the args array: ['remote', 'add', 'origin', <url>]
      const remoteUrl = addOriginCall[1][3];
      expect(remoteUrl).toContain('pubcoreagencia/pub-dev-loop-prototypes');
      expect(remoteUrl).not.toContain('attacker');
    });

    it('sanitiza token em mensagens de erro', () => {
      process.env.PROTOTYPE_BOT_TOKEN = 'ghp_supersecret123';
      mockExecFileSync.mockImplementation((cmd: string, args: any) => {
        if (cmd === 'git' && args?.[0] === 'push') {
          throw new Error('push failed: ghp_supersecret123 is invalid');
        }
        return '';
      });

      const result = pushBranch('/workspace', 'main');
      expect(result.ok).toBe(false);
      expect(result.error).not.toContain('ghp_supersecret123');
      expect(result.error).toContain('[REDACTED]');
    });

    it('remove o remote após push bem-sucedido', () => {
      process.env.PROTOTYPE_BOT_TOKEN = 'ghp_test';
      mockExecFileSync.mockReturnValue('');

      pushBranch('/workspace', 'main');

      const calls = mockExecFileSync.mock.calls;
      const removeCalls = calls.filter(c => c[0] === 'git' && c[1]?.[0] === 'remote' && c[1]?.[1] === 'remove');
      expect(removeCalls.length).toBeGreaterThanOrEqual(2); // remove before + after
    });

    it('remove o remote mesmo em caso de erro', () => {
      process.env.PROTOTYPE_BOT_TOKEN = 'ghp_test';
      mockExecFileSync.mockImplementation((cmd: string, args: any) => {
        if (cmd === 'git' && args?.[0] === 'push') throw new Error('network error');
        return '';
      });

      pushBranch('/workspace', 'main');

      const calls = mockExecFileSync.mock.calls;
      const removeCalls = calls.filter(c => c[0] === 'git' && c[1]?.[0] === 'remote' && c[1]?.[1] === 'remove');
      expect(removeCalls.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('verifyRemoteSha', () => {
    it('retorna true se SHA está no output de ls-remote', () => {
      process.env.PROTOTYPE_BOT_TOKEN = 'ghp_test';
      mockExecFileSync.mockReturnValue('abc123def456\trefs/heads/main\n');

      expect(verifyRemoteSha('main', 'abc123def456')).toBe(true);
    });

    it('retorna false se SHA não está presente', () => {
      process.env.PROTOTYPE_BOT_TOKEN = 'ghp_test';
      mockExecFileSync.mockReturnValue('different_sha\trefs/heads/main\n');

      expect(verifyRemoteSha('main', 'expected_sha')).toBe(false);
    });

    it('retorna false se não há token', () => {
      process.env.PROD = 'true';
      expect(verifyRemoteSha('main', 'any')).toBe(false);
    });

    it('retorna false em caso de erro de rede', () => {
      process.env.PROTOTYPE_BOT_TOKEN = 'ghp_test';
      mockExecFileSync.mockImplementation(() => {
        throw new Error('network error');
      });

      expect(verifyRemoteSha('main', 'any')).toBe(false);
    });
  });
});

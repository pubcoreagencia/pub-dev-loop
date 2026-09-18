import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { execFileSync, execSync } from 'node:child_process';
import {
  createIsolatedGitExecutor,
  resolveIsolatedGitExecutorFromEnv,
  normalizeTransportUrl,
  assertValidBareRepository,
  type GitTransportMapping,
} from '../../src/pdl/persistence/git-transport.js';
import { PdlRemotePersistence } from '../../src/pdl/persistence/remote-persistence.js';
import { ProductCatalog, type ProductManifest } from '../../src/pdl/products/catalog.js';

describe('PDL Isolated Git Transport', () => {
  const canonicalUrl = 'https://github.com/pubcoreagencia/pub-dev-loop-template.git';
  let tempDir: string;
  let bareRepoPath: string;
  let auditLogPath: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'git-transport-test-'));
    bareRepoPath = path.join(tempDir, 'upstream.git').replace(/\\/g, '/');
    auditLogPath = path.join(tempDir, 'audit.jsonl').replace(/\\/g, '/');

    // Create a real bare repo for tests
    execFileSync('git', ['init', '--bare', '--initial-branch=main', bareRepoPath]);
    execFileSync('git', ['-C', bareRepoPath, 'symbolic-ref', 'HEAD', 'refs/heads/main']);
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  });

  describe('normalizeTransportUrl', () => {
    it('normalizes https URLs by stripping trailing slash and .git', () => {
      expect(normalizeTransportUrl('https://github.com/pubcoreagencia/pub-dev-loop-template.git/')).toBe(
        'https://github.com/pubcoreagencia/pub-dev-loop-template'
      );
    });

    it('strips credentials from authenticated URLs', () => {
      expect(
        normalizeTransportUrl('https://x-access-token:ghp_secret@github.com/pubcoreagencia/pub-dev-loop-template.git')
      ).toBe('https://github.com/pubcoreagencia/pub-dev-loop-template');
    });

    it('handles empty or non-string inputs safely', () => {
      expect(normalizeTransportUrl('')).toBe('');
      expect(normalizeTransportUrl(undefined as any)).toBe('');
    });
  });

  describe('assertValidBareRepository', () => {
    it('succeeds on a valid bare repository', () => {
      expect(() => assertValidBareRepository(bareRepoPath)).not.toThrow();
    });

    it('fails closed if path does not exist', () => {
      expect(() => assertValidBareRepository(path.join(tempDir, 'nonexistent.git'))).toThrow('AIR_GAP_BREACH');
    });

    it('fails closed if path is not a bare repository', () => {
      const nonBare = path.join(tempDir, 'nonbare');
      fs.mkdirSync(nonBare);
      expect(() => assertValidBareRepository(nonBare)).toThrow('AIR_GAP_BREACH');
    });
  });

  describe('createIsolatedGitExecutor', () => {
    it('fails closed when no mappings are provided', () => {
      expect(() => createIsolatedGitExecutor([])).toThrow('AIR_GAP_BREACH');
    });

    it('passes through local git commands to baseExecutor without modifying arguments', () => {
      const baseMock = vi.fn().mockReturnValue('mock-output');
      const executor = createIsolatedGitExecutor(
        [{ canonicalUrl, physicalTarget: bareRepoPath }],
        baseMock
      );

      const res = executor('git', ['rev-parse', 'HEAD'], tempDir);
      expect(res).toBe('mock-output');
      expect(baseMock).toHaveBeenCalledWith('git', ['rev-parse', 'HEAD'], tempDir, undefined);
    });

    it('substitutes canonical URL with bare repository path on remote operations', () => {
      const baseMock = vi.fn().mockReturnValue('mock-ls-remote');
      const executor = createIsolatedGitExecutor(
        [{ canonicalUrl, physicalTarget: bareRepoPath }],
        baseMock,
        auditLogPath
      );

      const res = executor('git', ['ls-remote', canonicalUrl, 'refs/heads/main'], tempDir);
      expect(res).toBe('mock-ls-remote');
      // Destination replaced with bareRepoPath
      expect(baseMock).toHaveBeenCalledWith('git', ['ls-remote', bareRepoPath, 'refs/heads/main'], tempDir, undefined);

      // Verify audit log recorded canonical URL, NOT physical target, and zero credentials
      const auditLines = fs.readFileSync(auditLogPath, 'utf8').trim().split('\n');
      expect(auditLines.length).toBe(1);
      const audit = JSON.parse(auditLines[0]);
      expect(audit.command).toBe('ls-remote');
      expect(audit.canonicalUrl).toBe(canonicalUrl);
      expect(audit.resolvedTarget).toBe(bareRepoPath);
      expect(audit.isLocalBare).toBe(true);
    });

    it('substitutes authenticated canonical URL with bare repository path without leaking token into audit', () => {
      const baseMock = vi.fn().mockReturnValue('mock-push');
      const executor = createIsolatedGitExecutor(
        [{ canonicalUrl, physicalTarget: bareRepoPath }],
        baseMock,
        auditLogPath
      );

      const authenticatedUrl = 'https://x-access-token:ghp_super_secret_token@github.com/pubcoreagencia/pub-dev-loop-template.git';
      const res = executor('git', ['push', authenticatedUrl, 'HEAD:refs/heads/feat/test'], tempDir);
      expect(res).toBe('mock-push');
      expect(baseMock).toHaveBeenCalledWith('git', ['push', bareRepoPath, 'HEAD:refs/heads/feat/test'], tempDir, undefined);

      const auditContent = fs.readFileSync(auditLogPath, 'utf8');
      expect(auditContent).not.toContain('ghp_super_secret_token');
      expect(auditContent).not.toContain('x-access-token');
    });

    it('fails closed (AIR_GAP_BREACH) when remote command targets an unmapped or public URL', () => {
      const baseMock = vi.fn();
      const executor = createIsolatedGitExecutor(
        [{ canonicalUrl, physicalTarget: bareRepoPath }],
        baseMock
      );

      expect(() => {
        executor('git', ['ls-remote', 'https://github.com/unknown/repo.git', 'refs/heads/main'], tempDir);
      }).toThrow('AIR_GAP_BREACH');

      expect(baseMock).not.toHaveBeenCalled();
    });

    it('redacts credentials if an unmapped remote attempt is rejected', () => {
      const baseMock = vi.fn();
      const executor = createIsolatedGitExecutor(
        [{ canonicalUrl, physicalTarget: bareRepoPath }],
        baseMock
      );

      expect(() => {
        executor('git', ['push', 'https://x-access-token:secret123@github.com/other/repo.git', 'HEAD'], tempDir);
      }).toThrowError(/\[AIR_GAP_BREACH\].*\[REDACTED\]@github\.com\/other\/repo\.git/);

      expect(baseMock).not.toHaveBeenCalled();
    });
  });

  describe('resolveIsolatedGitExecutorFromEnv', () => {
    it('returns undefined if PDL_ISOLATED_GIT_TRANSPORT is not set', () => {
      const oldEnv = process.env.PDL_ISOLATED_GIT_TRANSPORT;
      delete process.env.PDL_ISOLATED_GIT_TRANSPORT;
      try {
        expect(resolveIsolatedGitExecutorFromEnv()).toBeUndefined();
      } finally {
        if (oldEnv) process.env.PDL_ISOLATED_GIT_TRANSPORT = oldEnv;
      }
    });

    it('instantiates executor when valid JSON mapping is provided', () => {
      const oldEnv = process.env.PDL_ISOLATED_GIT_TRANSPORT;
      process.env.PDL_ISOLATED_GIT_TRANSPORT = JSON.stringify({
        [canonicalUrl]: bareRepoPath,
      });
      try {
        const executor = resolveIsolatedGitExecutorFromEnv();
        expect(executor).toBeDefined();
        expect(typeof executor).toBe('function');
      } finally {
        if (oldEnv) process.env.PDL_ISOLATED_GIT_TRANSPORT = oldEnv;
        else delete process.env.PDL_ISOLATED_GIT_TRANSPORT;
      }
    });

    it('fails closed when JSON mapping is invalid or malformed', () => {
      const oldEnv = process.env.PDL_ISOLATED_GIT_TRANSPORT;
      process.env.PDL_ISOLATED_GIT_TRANSPORT = 'not-valid-json';
      try {
        expect(() => resolveIsolatedGitExecutorFromEnv()).toThrow();
      } finally {
        if (oldEnv) process.env.PDL_ISOLATED_GIT_TRANSPORT = oldEnv;
        else delete process.env.PDL_ISOLATED_GIT_TRANSPORT;
      }
    });
  });

  describe('End-to-End Real Git Execution against Bare Repository', () => {
    it('performs full persist() cycle: ls-remote -> push -> post-verification into bare repo', async () => {
      // 1. Seed bare repository with baseline commit on main
      const seedDir = path.join(tempDir, 'seed').replace(/\\/g, '/');
      execFileSync('git', ['clone', bareRepoPath, seedDir]);
      execFileSync('git', ['-C', seedDir, 'checkout', '-B', 'main']);
      execFileSync('git', ['-C', seedDir, 'config', 'user.name', 'PDL Test']);
      execFileSync('git', ['-C', seedDir, 'config', 'user.email', 'test@pdl.internal']);
      fs.writeFileSync(path.join(seedDir, 'README.md'), '# Baseline\n');
      execFileSync('git', ['-C', seedDir, 'add', 'README.md']);
      execFileSync('git', ['-C', seedDir, 'commit', '-m', 'test: initial baseline']);
      execFileSync('git', ['-C', seedDir, 'push', 'origin', 'main']);
      fs.rmSync(seedDir, { recursive: true, force: true });

      // 2. Create worker workspace cloned from bare repo but with canonical origin URL
      const workspaceDir = path.join(tempDir, 'workspace').replace(/\\/g, '/');
      execFileSync('git', ['clone', bareRepoPath, workspaceDir]);
      execFileSync('git', ['-C', workspaceDir, 'remote', 'set-url', 'origin', canonicalUrl]);
      execFileSync('git', ['-C', workspaceDir, 'checkout', '-b', 'feat/governed-proof']);
      execFileSync('git', ['-C', workspaceDir, 'config', 'user.name', 'PDL Test']);
      execFileSync('git', ['-C', workspaceDir, 'config', 'user.email', 'test@pdl.internal']);
      fs.writeFileSync(path.join(workspaceDir, 'PROOF.md'), 'PDL OPERATIONAL PROOF\n');
      execFileSync('git', ['-C', workspaceDir, 'add', 'PROOF.md']);
      execFileSync('git', ['-C', workspaceDir, 'commit', '-m', 'feat: add proof file']);
      const localSha = execFileSync('git', ['-C', workspaceDir, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();

      // 3. Setup PdlRemotePersistence with isolated executor
      const catalog = new ProductCatalog([
        {
          productId: 'pub-dev-loop-template',
          repository: canonicalUrl,
          organization: 'pubcoreagencia',
          defaultBranch: 'main',
          developmentBranchPolicy: ['feat/*', 'feature/*'],
          testCommand: 'true',
          allowedPaths: ['*'],
          protectedPaths: [],
          maxAutonomyLevel: 5,
          remotePersistenceEligible: true,
        },
      ]);

      const isolatedExecutor = createIsolatedGitExecutor(
        [{ canonicalUrl, physicalTarget: bareRepoPath }],
        undefined, // defaultGitExecutor
        auditLogPath
      );

      const persistence = new PdlRemotePersistence(catalog, isolatedExecutor);

      // 4. Run persist()
      const result = await persistence.persist({
        workspace: workspaceDir,
        product: 'pub-dev-loop-template',
        branch: 'feat/governed-proof',
        localSha,
        requested: true,
        gitToken: 'dummy-token-for-test',
      });

      // 5. Assertions
      expect(result.status).toBe('VERIFIED');
      expect(result.pushAttempted).toBe(true);
      expect(result.pushSucceeded).toBe(true);
      expect(result.remoteVerified).toBe(true);
      expect(result.remoteSha).toBe(localSha);

      // 6. Verify physical bare repo received commit object directly
      const commitObj = execFileSync('git', ['-C', bareRepoPath, 'cat-file', '-p', `${localSha}^{commit}`], { encoding: 'utf8' });
      expect(commitObj).toContain('feat: add proof file');

      // 7. Verify audit log integrity
      const auditLog = fs.readFileSync(auditLogPath, 'utf8').trim().split('\n');
      expect(auditLog.length).toBeGreaterThanOrEqual(3); // ls-remote (branch), ls-remote (main), push, ls-remote (verify)
      for (const line of auditLog) {
        const entry = JSON.parse(line);
        expect(entry.canonicalUrl).toBe(canonicalUrl);
        expect(entry.resolvedTarget).toBe(bareRepoPath);
        expect(entry.isLocalBare).toBe(true);
      }
    });
  });
});

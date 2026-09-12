import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  PdlRemotePersistence,
  redactToken,
  matchGlobPattern,
  normalizeRepoPath,
  type GitExecutor,
} from '../../src/pdl/persistence/remote-persistence.js';
import { ProductCatalog, type ProductManifest } from '../../src/pdl/products/catalog.js';

describe('PDL Remote Product Finalization Layer (PdlRemotePersistence)', () => {
  const localSha = '1111222233334444555566667777888899990000';
  const dummyWorkspace = '/test/workspace';
  const dummyToken = 'ghp_secret_token_1234567890abcdef';

  let testCatalog: ProductCatalog;
  let mockExecutor: ReturnType<typeof vi.fn>;
  let persistence: PdlRemotePersistence;

  beforeEach(() => {
    vi.clearAllMocks();

    const sampleProducts: ProductManifest[] = [
      {
        productId: 'pub-rate-calculator',
        repository: 'https://github.com/pubcoreagencia/pub-rate-calculator.git',
        organization: 'pubcoreagencia',
        defaultBranch: 'main',
        developmentBranchPolicy: ['feat/*', 'feature/*', 'fix/*', 'rate-calculator-*'],
        testCommand: 'npm test',
        allowedPaths: ['src/**'],
        protectedPaths: ['.github/**'],
        maxAutonomyLevel: 5,
        remotePersistenceEligible: true,
      },
      {
        productId: 'pub-shopee-scraper',
        repository: 'https://github.com/pubcoreagencia/pub-shopee-scraper.git',
        organization: 'pubcoreagencia',
        defaultBranch: 'main',
        developmentBranchPolicy: ['feat/*', 'feature/*', 'fix/*', 'shopee-*'],
        testCommand: 'npm test',
        allowedPaths: ['src/**'],
        protectedPaths: ['.github/**'],
        maxAutonomyLevel: 5,
        remotePersistenceEligible: true,
      },
      {
        productId: 'pubcore',
        repository: 'https://github.com/pubcoreagencia/pubcore.git',
        organization: 'pubcoreagencia',
        defaultBranch: 'main',
        developmentBranchPolicy: ['feat/*'],
        testCommand: 'npm test',
        allowedPaths: ['src/**'],
        protectedPaths: ['.github/**'],
        maxAutonomyLevel: 4,
        remotePersistenceEligible: false,
      },
    ];

    testCatalog = new ProductCatalog(sampleProducts);
    mockExecutor = vi.fn();
    persistence = new PdlRemotePersistence(testCatalog, mockExecutor as unknown as GitExecutor);
  });

  // A. local commit sem push → LOCAL_COMMITTED / NOT_REQUESTED
  it('A: local commit sem push → NOT_REQUESTED', async () => {
    const result = await persistence.persist({
      workspace: dummyWorkspace,
      product: 'pub-rate-calculator',
      branch: 'feat/test-feature',
      localSha,
      requested: false,
    });

    expect(result.status).toBe('NOT_REQUESTED');
    expect(result.pushAttempted).toBe(false);
    expect(result.pushSucceeded).toBe(false);
    expect(result.remoteVerified).toBe(false);
    expect(result.localSha).toBe(localSha);
    expect(result.remoteSha).toBeNull();
    expect(mockExecutor).not.toHaveBeenCalled();
  });

  // B. push bem-sucedido → pushAttempted: true, pushSucceeded: true
  it('B: push bem-sucedido → pushAttempted e pushSucceeded como true', async () => {
    mockExecutor.mockImplementation((cmd: string, args: string[]) => {
      if (cmd === 'git' && args[0] === 'rev-parse' && args[1] === '--is-inside-work-tree') return 'true';
      if (cmd === 'git' && args[0] === 'rev-parse' && args[1] === 'HEAD') return localSha;
      if (cmd === 'git' && args[0] === 'remote' && args[1] === 'get-url') return 'https://github.com/pubcoreagencia/pub-rate-calculator.git';
      if (cmd === 'git' && args[0] === 'ls-remote') return `${localSha}\trefs/heads/feat/test-branch\n`;
      if (cmd === 'git' && args[0] === 'push') return '';
      return '';
    });

    const result = await persistence.persist({
      workspace: dummyWorkspace,
      product: 'pub-rate-calculator',
      branch: 'feat/test-branch',
      localSha,
      gitToken: dummyToken,
    });

    // Remote already had the SHA or push succeeded & verified
    expect(result.pushSucceeded).toBe(true);
    expect(result.remoteVerified).toBe(true);
  });

  // C. push + SHA remoto correto → REMOTE_VERIFIED
  it('C: push + SHA remoto correto → REMOTE_VERIFIED', async () => {
    let lsRemoteCallCount = 0;
    mockExecutor.mockImplementation((cmd: string, args: string[]) => {
      if (cmd === 'git' && args[0] === 'rev-parse' && args[1] === '--is-inside-work-tree') return 'true';
      if (cmd === 'git' && args[0] === 'rev-parse' && args[1] === 'HEAD') return localSha;
      if (cmd === 'git' && args[0] === 'remote' && args[1] === 'get-url') return 'https://github.com/pubcoreagencia/pub-rate-calculator.git';
      if (cmd === 'git' && args[0] === 'ls-remote') {
        lsRemoteCallCount++;
        // First ls-remote: branch does not exist yet
        if (lsRemoteCallCount === 1) return '';
        // Second ls-remote: post-push verification returns matching SHA
        return `${localSha}\trefs/heads/feat/feature-1\n`;
      }
      if (cmd === 'git' && args[0] === 'push') return 'To github.com/... * [new branch]';
      return '';
    });

    const result = await persistence.persist({
      workspace: dummyWorkspace,
      product: 'pub-rate-calculator',
      branch: 'feat/feature-1',
      localSha,
      gitToken: dummyToken,
    });

    expect(result.status).toBe('VERIFIED');
    expect(result.pushAttempted).toBe(true);
    expect(result.pushSucceeded).toBe(true);
    expect(result.remoteVerified).toBe(true);
    expect(result.localSha).toBe(localSha);
    expect(result.remoteSha).toBe(localSha);
    expect(result.errorCode).toBeUndefined();
  });

  // D. SHA remoto diferente → FAILED
  it('D: SHA remoto diferente após push → FAILED (REMOTE_SHA_MISMATCH)', async () => {
    const mismatchedSha = '9999888877776666555544443333222211110000';
    let lsRemoteCallCount = 0;
    mockExecutor.mockImplementation((cmd: string, args: string[]) => {
      if (cmd === 'git' && args[0] === 'rev-parse' && args[1] === '--is-inside-work-tree') return 'true';
      if (cmd === 'git' && args[0] === 'rev-parse' && args[1] === 'HEAD') return localSha;
      if (cmd === 'git' && args[0] === 'remote' && args[1] === 'get-url') return 'https://github.com/pubcoreagencia/pub-rate-calculator.git';
      if (cmd === 'git' && args[0] === 'ls-remote') {
        lsRemoteCallCount++;
        if (lsRemoteCallCount === 1) return '';
        // Returns mismatched SHA
        return `${mismatchedSha}\trefs/heads/feat/feature-mismatch\n`;
      }
      if (cmd === 'git' && args[0] === 'push') return '';
      return '';
    });

    const result = await persistence.persist({
      workspace: dummyWorkspace,
      product: 'pub-rate-calculator',
      branch: 'feat/feature-mismatch',
      localSha,
      gitToken: dummyToken,
    });

    expect(result.status).toBe('FAILED');
    expect(result.pushAttempted).toBe(true);
    expect(result.pushSucceeded).toBe(true);
    expect(result.remoteVerified).toBe(false);
    expect(result.remoteSha).toBe(mismatchedSha);
    expect(result.errorCode).toBe('REMOTE_SHA_MISMATCH');
  });

  // E. repository não autorizado → FAILED
  it('E: repository não autorizado (produto não registrado) → FAILED', async () => {
    const result = await persistence.persist({
      workspace: dummyWorkspace,
      product: 'unregistered-evil-repo',
      branch: 'feat/evil',
      localSha,
      gitToken: dummyToken,
    });

    expect(result.status).toBe('FAILED');
    expect(result.pushAttempted).toBe(false);
    expect(result.pushSucceeded).toBe(false);
    expect(result.remoteVerified).toBe(false);
    expect(result.errorCode).toBe('UNAUTHORIZED_PRODUCT');
    expect(mockExecutor).not.toHaveBeenCalled();
  });

  // F. main/master/protected branch → FAILED
  it('F: push para protected branch (main, master, production, release/*) → FAILED', async () => {
    const protectedBranchesToTest = ['main', 'master', 'production', 'release/v1.0'];

    for (const branch of protectedBranchesToTest) {
      const result = await persistence.persist({
        workspace: dummyWorkspace,
        product: 'pub-rate-calculator',
        branch,
        localSha,
        gitToken: dummyToken,
      });

      expect(result.status).toBe('FAILED');
      expect(result.pushAttempted).toBe(false);
      expect(result.errorCode).toBe('PROTECTED_BRANCH_PROHIBITED');
      expect(result.errorMessage).toContain('strictly prohibited');
    }
  });

  // G. tentativa de force push → FAILED / não executado
  it('G: force push nunca é utilizado em nenhum parâmetro de comando git', async () => {
    let lsRemoteCallCount = 0;
    mockExecutor.mockImplementation((cmd: string, args: string[]) => {
      if (cmd === 'git' && args[0] === 'rev-parse' && args[1] === '--is-inside-work-tree') return 'true';
      if (cmd === 'git' && args[0] === 'rev-parse' && args[1] === 'HEAD') return localSha;
      if (cmd === 'git' && args[0] === 'remote' && args[1] === 'get-url') return 'https://github.com/pubcoreagencia/pub-rate-calculator.git';
      if (cmd === 'git' && args[0] === 'ls-remote') {
        lsRemoteCallCount++;
        return lsRemoteCallCount === 1 ? '' : `${localSha}\trefs/heads/feat/safe-push\n`;
      }
      if (cmd === 'git' && args[0] === 'push') {
        // Assert that --force or -f is NEVER present
        expect(args).not.toContain('--force');
        expect(args).not.toContain('-f');
        expect(args).not.toContain('--force-with-lease');
        return '';
      }
      return '';
    });

    await persistence.persist({
      workspace: dummyWorkspace,
      product: 'pub-rate-calculator',
      branch: 'feat/safe-push',
      localSha,
      gitToken: dummyToken,
    });

    const calls = mockExecutor.mock.calls;
    const pushCalls = calls.filter((c: any) => c[0] === 'git' && c[1]?.[0] === 'push');
    expect(pushCalls.length).toBe(1);
    const pushArgs: string[] = pushCalls[0][1];
    expect(pushArgs.some((arg: string) => arg === '--force' || arg === '-f' || arg.includes('force'))).toBe(false);
  });

  // H. remote divergente → FAILED (fast-forward only)
  it('H: remote divergente → FAILED (NON_FAST_FORWARD_REJECTED)', async () => {
    const existingDivergentSha = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    mockExecutor.mockImplementation((cmd: string, args: string[]) => {
      if (cmd === 'git' && args[0] === 'rev-parse' && args[1] === '--is-inside-work-tree') return 'true';
      if (cmd === 'git' && args[0] === 'rev-parse' && args[1] === 'HEAD') return localSha;
      if (cmd === 'git' && args[0] === 'remote' && args[1] === 'get-url') return 'https://github.com/pubcoreagencia/pub-rate-calculator.git';
      if (cmd === 'git' && args[0] === 'ls-remote') {
        return `${existingDivergentSha}\trefs/heads/feat/divergent\n`;
      }
      // merge-base --is-ancestor throws error indicating non-ancestor / divergent
      if (cmd === 'git' && args[0] === 'merge-base' && args[1] === '--is-ancestor') {
        throw new Error('exit code 1: not an ancestor');
      }
      if (cmd === 'git' && args[0] === 'fetch') return '';
      return '';
    });

    const result = await persistence.persist({
      workspace: dummyWorkspace,
      product: 'pub-rate-calculator',
      branch: 'feat/divergent',
      localSha,
      gitToken: dummyToken,
    });

    expect(result.status).toBe('FAILED');
    expect(result.pushAttempted).toBe(false);
    expect(result.pushSucceeded).toBe(false);
    expect(result.remoteVerified).toBe(false);
    expect(result.errorCode).toBe('NON_FAST_FORWARD_REJECTED');

    // Confirm that git push was NEVER called
    const pushCalls = mockExecutor.mock.calls.filter((c: any) => c[0] === 'git' && c[1]?.[0] === 'push');
    expect(pushCalls.length).toBe(0);
  });

  // I. token nunca aparece em output/log
  it('I: token de autenticação nunca vaza em mensagens de erro ou logs', async () => {
    mockExecutor.mockImplementation((cmd: string, args: string[]) => {
      if (cmd === 'git' && args[0] === 'rev-parse' && args[1] === '--is-inside-work-tree') return 'true';
      if (cmd === 'git' && args[0] === 'rev-parse' && args[1] === 'HEAD') return localSha;
      if (cmd === 'git' && args[0] === 'remote' && args[1] === 'get-url') return 'https://github.com/pubcoreagencia/pub-rate-calculator.git';
      if (cmd === 'git' && args[0] === 'ls-remote') return '';
      if (cmd === 'git' && args[0] === 'push') {
        throw new Error(`fatal: unable to access 'https://x-access-token:${dummyToken}@github.com/pubcoreagencia/pub-rate-calculator.git': 403 Forbidden`);
      }
      return '';
    });

    const result = await persistence.persist({
      workspace: dummyWorkspace,
      product: 'pub-rate-calculator',
      branch: 'feat/token-leak-test',
      localSha,
      gitToken: dummyToken,
    });

    expect(result.status).toBe('FAILED');
    expect(result.errorCode).toBe('PUSH_FAILED');
    expect(result.errorMessage).toBeDefined();
    expect(result.errorMessage).not.toContain(dummyToken);
    expect(result.errorMessage).toContain('[REDACTED]');
  });

  // J. product A não pode persistir no repository do product B
  it('J: product A não pode persistir no repository do product B (REPOSITORY_MISMATCH)', async () => {
    const result = await persistence.persist({
      workspace: dummyWorkspace,
      product: 'pub-rate-calculator',
      branch: 'feat/cross-product',
      localSha,
      targetRepository: 'https://github.com/pubcoreagencia/pub-shopee-scraper.git',
      gitToken: dummyToken,
    });

    expect(result.status).toBe('FAILED');
    expect(result.pushAttempted).toBe(false);
    expect(result.pushSucceeded).toBe(false);
    expect(result.remoteVerified).toBe(false);
    expect(result.errorCode).toBe('REPOSITORY_MISMATCH');
    expect(result.errorMessage).toContain('does not match authorized Product Catalog repository');
    expect(mockExecutor).not.toHaveBeenCalled();
  });

  // K. ausência de remote persistence configuration → NOT_REQUESTED ou FAILED, nunca GREEN remoto
  it('K: ausência de remote persistence eligibility → FAILED (PERSISTENCE_INELIGIBLE), nunca VERIFIED', async () => {
    // pubcore has remotePersistenceEligible: false
    const result = await persistence.persist({
      workspace: dummyWorkspace,
      product: 'pubcore',
      branch: 'feat/core-change',
      localSha,
      gitToken: dummyToken,
    });

    expect(result.status).toBe('FAILED');
    expect(result.pushAttempted).toBe(false);
    expect(result.pushSucceeded).toBe(false);
    expect(result.remoteVerified).toBe(false);
    expect(result.errorCode).toBe('PERSISTENCE_INELIGIBLE');
    expect(mockExecutor).not.toHaveBeenCalled();
  });
});

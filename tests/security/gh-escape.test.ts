import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import { ToolRuntime } from '../../src/tools/runtime.js';
import { AgentExecutor } from '../../src/executor.js';
import {
  WorkspaceEnvironmentSecurity,
  WorkspaceCommandSecurity,
  GovernanceSelfElevationViolationError,
} from '../../src/tools/security.js';
import { PdlRemotePersistence } from '../../src/pdl/persistence/remote-persistence.js';
import { ProductCatalog, type ProductManifest } from '../../src/pdl/products/catalog.js';

describe('P0.3.1: Host GitHub CLI (gh) & Governance Escape Neutralization', () => {
  let tempDir: string;
  let remoteDir: string;
  let savedEnv: NodeJS.ProcessEnv;

  const mockProduct: ProductManifest = {
    productId: 'test-product',
    repository: '',
    organization: 'pubcoreagencia',
    defaultBranch: 'main',
    developmentBranchPolicy: ['feat/*', 'fix/*'],
    testCommand: 'npm test',
    allowedPaths: ['src/**', 'tests/**', 'feature.txt'],
    protectedPaths: ['.github/**', 'AGENTS.md'],
    maxAutonomyLevel: 5,
    remotePersistenceEligible: true,
  };

  beforeEach(() => {
    savedEnv = { ...process.env };
    tempDir = mkdtempSync(join(tmpdir(), 'pdl-gh-escape-test-'));
    remoteDir = mkdtempSync(join(tmpdir(), 'pdl-gh-escape-remote-'));

    execSync('git init --bare -b main', { cwd: remoteDir, stdio: 'ignore' });

    execSync('git init -b main', { cwd: tempDir, stdio: 'ignore' });
    execSync('git checkout -B main', { cwd: tempDir, stdio: 'ignore' });
    execSync('git config user.name "PDL Security Invariant"', { cwd: tempDir, stdio: 'ignore' });
    execSync('git config user.email "security@pdl.internal"', { cwd: tempDir, stdio: 'ignore' });
    writeFileSync(join(tempDir, 'README.md'), '# P0.3.1 GH Escape Test Sandbox\n');
    execSync('git add README.md && git commit -m "init"', { cwd: tempDir, stdio: 'ignore' });

    execSync(`git remote add origin "${remoteDir}"`, { cwd: tempDir, stdio: 'ignore' });
    execSync('git push origin main', { cwd: tempDir, stdio: 'ignore' });

    mockProduct.repository = remoteDir;
  });

  afterEach(() => {
    process.env = savedEnv;
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {}
    try {
      rmSync(remoteDir, { recursive: true, force: true });
    } catch {}
  });

  describe('Layer 1: ToolRuntime Command Security Gate', () => {
    it('1. blocks ToolRuntime executing "gh api ..."', async () => {
      const rt = new ToolRuntime({
        workspaceRoot: tempDir,
        commandTimeoutMs: 10000,
        redactSecrets: true,
      });

      const res = await (rt as any).runCommand('test-1', {
        command: 'gh api repos/pubcoreagencia/pub-dev-loop/rulesets',
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain('[SECURITY_VIOLATION]');
      expect(res.error).toContain('gh');
    });

    it('2. blocks ToolRuntime executing "gh.exe api ..."', async () => {
      const rt = new ToolRuntime({
        workspaceRoot: tempDir,
        commandTimeoutMs: 10000,
        redactSecrets: true,
      });

      const res = await (rt as any).runCommand('test-2', {
        command: 'gh.exe api repos/pubcoreagencia/pub-dev-loop/rulesets',
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain('[SECURITY_VIOLATION]');
    });

    it('3. blocks PowerShell execution: powershell -c "gh api ..."', async () => {
      const rt = new ToolRuntime({
        workspaceRoot: tempDir,
        commandTimeoutMs: 10000,
        redactSecrets: true,
      });

      const res = await (rt as any).runCommand('test-3', {
        command: 'powershell -c "gh api repos/pubcoreagencia/pub-dev-loop/rulesets"',
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain('[SECURITY_VIOLATION]');
    });

    it('4. blocks PowerShell invocation: powershell -Command "& gh api ..."', async () => {
      const rt = new ToolRuntime({
        workspaceRoot: tempDir,
        commandTimeoutMs: 10000,
        redactSecrets: true,
      });

      const res = await (rt as any).runCommand('test-4', {
        command: 'powershell -Command "& gh api repos/pubcoreagencia/pub-dev-loop/branches/main/protection"',
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain('[SECURITY_VIOLATION]');
    });

    it('5. blocks CMD execution: cmd /c gh api ...', async () => {
      const rt = new ToolRuntime({
        workspaceRoot: tempDir,
        commandTimeoutMs: 10000,
        redactSecrets: true,
      });

      const res = await (rt as any).runCommand('test-5', {
        command: 'cmd /c gh api repos/pubcoreagencia/pub-dev-loop/rulesets',
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain('[SECURITY_VIOLATION]');
    });

    it('6. blocks absolute path to gh.exe: "C:\\Program Files\\GitHub CLI\\gh.exe api ..."', async () => {
      const rt = new ToolRuntime({
        workspaceRoot: tempDir,
        commandTimeoutMs: 10000,
        redactSecrets: true,
      });

      const res = await (rt as any).runCommand('test-6', {
        command: '"C:\\Program Files\\GitHub CLI\\gh.exe" api repos/pubcoreagencia/pub-dev-loop/rulesets',
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain('[SECURITY_VIOLATION]');
    });

    it('7. blocks gh auth status', async () => {
      const rt = new ToolRuntime({
        workspaceRoot: tempDir,
        commandTimeoutMs: 10000,
        redactSecrets: true,
      });

      const res = await (rt as any).runCommand('test-7', {
        command: 'gh auth status',
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain('[SECURITY_VIOLATION]');
    });

    it('8. blocks gh auth token', async () => {
      const rt = new ToolRuntime({
        workspaceRoot: tempDir,
        commandTimeoutMs: 10000,
        redactSecrets: true,
      });

      const res = await (rt as any).runCommand('test-8', {
        command: 'gh auth token',
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain('[SECURITY_VIOLATION]');
    });

    it('9. blocks direct curl attack against GitHub governance endpoints', async () => {
      const rt = new ToolRuntime({
        workspaceRoot: tempDir,
        commandTimeoutMs: 10000,
        redactSecrets: true,
      });

      const res = await (rt as any).runCommand('test-9', {
        command: 'curl -X DELETE https://api.github.com/repos/pubcoreagencia/pub-dev-loop/branches/main/protection',
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain('[SECURITY_VIOLATION]');
    });
  });

  describe('Layer 2: AgentExecutor Executable Boundary', () => {
    it('10. blocks AgentExecutor direct spawn of gh', async () => {
      const executor = new AgentExecutor();
      const res = await executor.execute({
        command: 'gh',
        args: ['api', 'repos/pubcoreagencia/pub-dev-loop/rulesets'],
        cwd: tempDir,
        timeoutMs: 10000,
      });

      expect(res.status).toBe('FAILED');
      expect(res.exitCode).toBe(1);
      expect(res.stderr).toContain('[SECURITY_VIOLATION]');
    });

    it('11. blocks AgentExecutor direct spawn of gh.exe with full path', async () => {
      const executor = new AgentExecutor();
      const res = await executor.execute({
        command: 'C:\\Program Files\\GitHub CLI\\gh.exe',
        args: ['auth', 'status'],
        cwd: tempDir,
        timeoutMs: 10000,
      });

      expect(res.status).toBe('FAILED');
      expect(res.exitCode).toBe(1);
      expect(res.stderr).toContain('[SECURITY_VIOLATION]');
    });

    it('12. blocks AgentExecutor spawn of shell wrapping gh', async () => {
      const executor = new AgentExecutor();
      const res = await executor.execute({
        command: 'cmd.exe',
        args: ['/c', 'gh api repos/pubcoreagencia/pub-dev-loop/rulesets'],
        cwd: tempDir,
        timeoutMs: 10000,
      });

      expect(res.status).toBe('FAILED');
      expect(res.exitCode).toBe(1);
      expect(res.stderr).toContain('[SECURITY_VIOLATION]');
    });
  });

  describe('Layer 3: Environment Isolation & GH_CONFIG_DIR Invariant', () => {
    it('13. automatically injects isolated GH_CONFIG_DIR into sanitized environment', () => {
      const sanitized = WorkspaceEnvironmentSecurity.sanitizeWorkspaceEnv(process.env);
      expect(sanitized.GH_CONFIG_DIR).toBeDefined();
      expect(sanitized.GH_CONFIG_DIR).toContain('pdl-sandbox-gh-isolated');
    });

    it('14. fails closed when environment attempts to point GH_CONFIG_DIR to host user credential store', () => {
      expect(() => {
        WorkspaceEnvironmentSecurity.assertNoGovernanceCredentials({
          PATH: process.env.PATH,
          GH_CONFIG_DIR: 'C:\\Users\\Operator\\AppData\\Roaming\\GitHub CLI',
        });
      }).toThrow(GovernanceSelfElevationViolationError);

      expect(() => {
        WorkspaceEnvironmentSecurity.assertNoGovernanceCredentials({
          PATH: process.env.PATH,
          GH_CONFIG_DIR: '/home/user/.config/gh',
        });
      }).toThrow(GovernanceSelfElevationViolationError);
    });
  });

  describe('Layer 4: Benign Autonomous Workflow Preservation', () => {
    it('15. allows benign development commands (node, git status, git diff)', async () => {
      const rt = new ToolRuntime({
        workspaceRoot: tempDir,
        commandTimeoutMs: 10000,
        redactSecrets: true,
      }, new AgentExecutor(undefined, { allowHostExecution: true }));

      const res = await (rt as any).runCommand('test-safe', {
        command: 'node -v',
      });

      expect(res.success).toBe(true);
      expect(res.content).toMatch(/^v\d+/);
    });

    it('16. allows PdlRemotePersistence to publish legitimate feature branch to remote', async () => {
      execSync('git checkout -b feat/autonomous-pdl-safe', { cwd: tempDir, stdio: 'ignore' });
      writeFileSync(join(tempDir, 'feature.txt'), 'Autonomous feature content\n');
      execSync('git add feature.txt && git commit -m "feat: safe autonomous feature"', { cwd: tempDir, stdio: 'ignore' });
      const localSha = execSync('git rev-parse HEAD', { cwd: tempDir, encoding: 'utf8' }).trim();

      const catalog = new ProductCatalog([mockProduct]);
      const persistence = new PdlRemotePersistence(catalog);

      const result = await persistence.persist({
        product: mockProduct,
        workspace: tempDir,
        branch: 'feat/autonomous-pdl-safe',
        localSha,
      });

      expect(result.status).toBe('VERIFIED');
      expect(result.pushSucceeded).toBe(true);
      expect(result.remoteVerified).toBe(true);

      const remoteSha = execSync(`git ls-remote "${remoteDir}" refs/heads/feat/autonomous-pdl-safe`, { encoding: 'utf8' }).split(/\s+/)[0];
      expect(remoteSha).toBe(localSha);
    });
  });

  describe('P0.4.1-A / B: Invariant Defense-in-Depth & Credential Neutralization', () => {
    it('17. sanitizeWorkspaceEnv completely strips GitHub CLI from PATH', () => {
      const mockPath = [
        'C:\\Windows\\system32',
        'C:\\Program Files\\GitHub CLI',
        'C:\\Users\\Operator\\AppData\\Local\\Programs\\GitHub-CLI',
        'C:\\Program Files\\nodejs',
      ].join(';');

      const sanitized = WorkspaceEnvironmentSecurity.sanitizeWorkspaceEnv({
        PATH: mockPath,
      });

      const pathVal = sanitized.PATH || '';
      expect(pathVal).not.toContain('GitHub CLI');
      expect(pathVal).not.toContain('GitHub-CLI');
      expect(pathVal).toContain('system32');
      expect(pathVal).toContain('nodejs');
    });

    it('18. getIsolatedGhConfigDir populates inert hosts.yml and config.yml with dummy tokens', () => {
      const dir = WorkspaceEnvironmentSecurity.getIsolatedGhConfigDir();
      const fs = require('node:fs');
      const hostsPath = join(dir, 'hosts.yml');
      const configPath = join(dir, 'config.yml');

      expect(fs.existsSync(hostsPath)).toBe(true);
      expect(fs.existsSync(configPath)).toBe(true);

      const hostsContent = fs.readFileSync(hostsPath, 'utf8');
      expect(hostsContent).toContain('pdl-unauthenticated-sandbox');
      expect(hostsContent).toContain('pdl-invalid-dummy-token');

      const configContent = fs.readFileSync(configPath, 'utf8');
      expect(configContent).toContain('git_protocol: https');
    });

    it('19. sanitizeWorkspaceEnv strips real tokens and isolates GH_CONFIG_DIR', () => {
      const sanitized = WorkspaceEnvironmentSecurity.sanitizeWorkspaceEnv({
        ...process.env,
        GITHUB_TOKEN: 'ghp_secret_real_token',
        GH_TOKEN: 'ghp_secret_real_token_2',
      });
      expect(sanitized.GITHUB_TOKEN).toBeUndefined();
      expect(sanitized.GH_TOKEN).toBeUndefined();
      expect(sanitized.PDL_GITHUB_TOKEN).toBeUndefined();
      expect(sanitized.GH_CONFIG_DIR).toBeDefined();
    });

    it('20. assertNoGovernanceCredentials permits dummy sandbox tokens but rejects real tokens', () => {
      // Dummy token is allowed
      expect(() => {
        WorkspaceEnvironmentSecurity.assertNoGovernanceCredentials({
          GH_TOKEN: 'pdl-invalid-dummy-token',
          GITHUB_TOKEN: 'pdl-invalid-dummy-token',
          GH_CONFIG_DIR: WorkspaceEnvironmentSecurity.getIsolatedGhConfigDir(),
        });
      }).not.toThrow();

      // Real or unknown token is strictly rejected
      expect(() => {
        WorkspaceEnvironmentSecurity.assertNoGovernanceCredentials({
          GH_TOKEN: 'ghp_real_secret_token_1234567890',
          GH_CONFIG_DIR: WorkspaceEnvironmentSecurity.getIsolatedGhConfigDir(),
        });
      }).toThrow(GovernanceSelfElevationViolationError);
    });

    it('21. blocks direct cmdkey and cmdkey.exe execution', () => {
      expect(WorkspaceCommandSecurity.validateCommand('cmdkey /list').allowed).toBe(false);
      expect(WorkspaceCommandSecurity.validateCommand('cmdkey.exe /list').allowed).toBe(false);
      expect(WorkspaceCommandSecurity.validateCommand('cmd.exe', ['/c', 'cmdkey /list']).allowed).toBe(false);
      expect(WorkspaceCommandSecurity.validateCommand('powershell', ['-c', 'cmdkey /list']).allowed).toBe(false);
    });

    it('22. child node process attempting "gh auth token" fails because gh is stripped from PATH', async () => {
      const rt = new ToolRuntime({
        workspaceRoot: tempDir,
        commandTimeoutMs: 10000,
        redactSecrets: false,
      }, new AgentExecutor(undefined, { allowHostExecution: true }));

      const script = `
        const { execSync } = require('child_process');
        try {
          execSync('gh auth token');
          console.log('UNEXPECTED_SUCCESS');
        } catch (err) {
          console.log('EXPECTED_NOT_FOUND: ' + err.message);
        }
      `;
      writeFileSync(join(tempDir, 'test-gh-path.js'), script);

      const res = await (rt as any).runCommand('test-node-gh', {
        command: 'node test-gh-path.js',
      });

      expect(res.success).toBe(true);
      expect(res.content).toContain('EXPECTED_NOT_FOUND');
      expect(res.content).not.toContain('UNEXPECTED_SUCCESS');
    });

    it('23. gh in dedicated directory is stripped from PATH on Windows and POSIX', () => {
      const sanitized = WorkspaceEnvironmentSecurity.sanitizeWorkspaceEnv({
        PATH: ['/opt/homebrew/Cellar/gh/bin', '/usr/bin', '/bin'].join(process.platform === 'win32' ? ';' : ':'),
      });
      const pathVal = sanitized.PATH || '';
      expect(pathVal).not.toContain('Cellar/gh');
    });

    it('24. gh in /usr/bin does not strip /usr/bin on POSIX and injects shadow bin', () => {
      const sanitized = WorkspaceEnvironmentSecurity.sanitizeWorkspaceEnv({
        PATH: '/usr/local/bin:/usr/bin:/bin',
      });
      const pathVal = sanitized.PATH || '';
      expect(pathVal).toContain('/usr/bin');
      expect(pathVal).toContain('/bin');
      expect(pathVal).toContain('pdl-sandbox-gh-isolated');
    });

    it('25. git remains fully executable in sanitized environment', () => {
      const safeEnv = WorkspaceEnvironmentSecurity.sanitizeWorkspaceEnv(process.env);
      const res = execSync('git --version', { env: safeEnv, encoding: 'utf8' });
      expect(res).toContain('git version');
    });

    it('26. node remains fully executable in sanitized environment', () => {
      const safeEnv = WorkspaceEnvironmentSecurity.sanitizeWorkspaceEnv(process.env);
      const res = execSync(`"${process.execPath}" -v`, { env: safeEnv, encoding: 'utf8' });
      expect(res.trim()).toMatch(/^v\d+\./);
    });

    it('27. fail-closed invariant policy remains intact against gh execution', () => {
      const safeEnv = WorkspaceEnvironmentSecurity.sanitizeWorkspaceEnv(process.env);
      expect(safeEnv.GH_TOKEN).toBeUndefined();
      expect(safeEnv.GITHUB_TOKEN).toBeUndefined();
      expect(safeEnv.GH_CONFIG_DIR).toBeDefined();
      expect(safeEnv.GH_CONFIG_DIR).toContain('pdl-sandbox-gh-isolated');
    });
  });
});

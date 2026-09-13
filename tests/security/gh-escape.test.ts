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

    execSync('git init --bare', { cwd: remoteDir, stdio: 'ignore' });

    execSync('git init', { cwd: tempDir, stdio: 'ignore' });
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
      });

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
});

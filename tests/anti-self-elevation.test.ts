import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import { ToolRuntime } from '../src/tools/runtime.js';
import { AgentExecutor } from '../src/executor.js';
import { TaskFinalizer } from '../src/finalizer.js';
import {
  WorkspaceEnvironmentSecurity,
  GovernanceSelfElevationViolationError,
} from '../src/tools/security.js';

describe('Anti-Self-Elevation Security Boundary (Phase 5.5 P0)', () => {
  let tempDir: string;
  let savedEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    savedEnv = { ...process.env };
    tempDir = mkdtempSync(join(tmpdir(), 'pdl-security-test-'));

    // Initialize git repository in sandbox
    execSync('git init', { cwd: tempDir, stdio: 'ignore' });
    execSync('git config user.name "PDL Security Invariant"', { cwd: tempDir, stdio: 'ignore' });
    execSync('git config user.email "security@pdl.internal"', { cwd: tempDir, stdio: 'ignore' });
    writeFileSync(join(tempDir, 'README.md'), '# Sandbox for Security Invariant Testing\n');
    execSync('git add README.md && git commit -m "init"', { cwd: tempDir, stdio: 'ignore' });

    // Set privileged governance and database credentials in parent process.env
    process.env.DATABASE_URL = 'postgresql://postgres:pdl_secret_pw@127.0.0.1:5432/pubdevloop';
    process.env.POSTGRES_URL = 'postgres://admin:secret@localhost:5432/prod_db';
    process.env.PDL_GOVERNANCE_ADMIN_KEY = 'pdl-gov-admin-secret-token-xyz';
    process.env.PDL_GOVERNANCE_READ_KEY = 'pdl-gov-read-secret-token-123';
    process.env.KILL_SWITCH_ACTIVE = 'true';
    process.env.PUB_NEURAL_TOKEN = 'pub-neural-bearer-token-abc';
    process.env.GITHUB_TOKEN = 'ghp_mocktokenforgithubaccess1234567890';
  });

  afterEach(() => {
    process.env = savedEnv;
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  describe('Invariant Gate: WorkspaceEnvironmentSecurity.assertNoGovernanceCredentials', () => {
    it('throws GovernanceSelfElevationViolationError when DATABASE_URL is present', () => {
      expect(() => {
        WorkspaceEnvironmentSecurity.assertNoGovernanceCredentials({
          PATH: process.env.PATH,
          DATABASE_URL: 'postgresql://postgres:secret@localhost:5432/pdl',
        });
      }).toThrow(GovernanceSelfElevationViolationError);
    });

    it('throws GovernanceSelfElevationViolationError when PDL_GOVERNANCE_ADMIN_KEY is present', () => {
      expect(() => {
        WorkspaceEnvironmentSecurity.assertNoGovernanceCredentials({
          PATH: process.env.PATH,
          PDL_GOVERNANCE_ADMIN_KEY: 'admin-secret',
        });
      }).toThrow(GovernanceSelfElevationViolationError);
    });

    it('throws GovernanceSelfElevationViolationError when arbitrary key contains postgresql URI', () => {
      expect(() => {
        WorkspaceEnvironmentSecurity.assertNoGovernanceCredentials({
          CUSTOM_DB: 'postgres://user:pass@localhost:5432/db',
        });
      }).toThrow(GovernanceSelfElevationViolationError);
    });

    it('throws GovernanceSelfElevationViolationError when KILL_SWITCH is present', () => {
      expect(() => {
        WorkspaceEnvironmentSecurity.assertNoGovernanceCredentials({
          KILL_SWITCH_OVERRIDE: 'false',
        });
      }).toThrow(GovernanceSelfElevationViolationError);
    });

    it('passes for safe workspace environment (e.g. PATH, NODE_ENV)', () => {
      expect(() => {
        WorkspaceEnvironmentSecurity.assertNoGovernanceCredentials({
          PATH: process.env.PATH,
          NODE_ENV: 'test',
          HOME: process.env.HOME,
        });
      }).not.toThrow();
    });
  });

  describe('Workspace Environment Sanitizer: WorkspaceEnvironmentSecurity.sanitizeWorkspaceEnv', () => {
    it('removes all database, governance, neural, and provider credentials', () => {
      const sanitized = WorkspaceEnvironmentSecurity.sanitizeWorkspaceEnv(process.env);

      expect(sanitized.DATABASE_URL).toBeUndefined();
      expect(sanitized.POSTGRES_URL).toBeUndefined();
      expect(sanitized.PDL_GOVERNANCE_ADMIN_KEY).toBeUndefined();
      expect(sanitized.PDL_GOVERNANCE_READ_KEY).toBeUndefined();
      expect(sanitized.KILL_SWITCH_ACTIVE).toBeUndefined();
      expect(sanitized.PUB_NEURAL_TOKEN).toBeUndefined();
      expect(sanitized.GITHUB_TOKEN).toBeUndefined();

      // Assert that sanitized env strictly satisfies the invariant
      expect(() => {
        WorkspaceEnvironmentSecurity.assertNoGovernanceCredentials(sanitized);
      }).not.toThrow();
    });
  });

  describe('ToolRuntime: run_command Isolation', () => {
    it('executes node command and verifies process.env.DATABASE_URL is undefined', async () => {
      const runtime = new ToolRuntime({
        workspaceRoot: tempDir,
        maxRounds: 5,
        maxToolCalls: 10,
        commandTimeoutMs: 10000,
        maxFileBytes: 1024 * 1024,
        maxWriteBytes: 256 * 1024,
        redactSecrets: true,
      }, new AgentExecutor(undefined, { allowHostExecution: true }));

      const result = await runtime.executeTool('test-call-1', 'run_command', {
        command: `"${process.execPath}" -e "console.log('DB_URL:' + process.env.DATABASE_URL)"`,
      });

      expect(result.success).toBe(true);
      expect(result.content).toContain('DB_URL:undefined');
      expect(result.content).not.toContain('pdl_secret_pw');
    });

    it('executes node command and verifies process.env.PDL_GOVERNANCE_ADMIN_KEY is undefined', async () => {
      const runtime = new ToolRuntime({
        workspaceRoot: tempDir,
        maxRounds: 5,
        maxToolCalls: 10,
        commandTimeoutMs: 10000,
        maxFileBytes: 1024 * 1024,
        maxWriteBytes: 256 * 1024,
        redactSecrets: true,
      }, new AgentExecutor(undefined, { allowHostExecution: true }));

      const result = await runtime.executeTool('test-call-2', 'run_command', {
        command: `"${process.execPath}" -e "console.log('GOV_KEY:' + process.env.PDL_GOVERNANCE_ADMIN_KEY)"`,
      });

      expect(result.success).toBe(true);
      expect(result.content).toContain('GOV_KEY:undefined');
      expect(result.content).not.toContain('pdl-gov-admin-secret-token-xyz');
    });

    it('proves that workspace command cannot connect to postgres due to missing credentials', async () => {
      const runtime = new ToolRuntime({
        workspaceRoot: tempDir,
        maxRounds: 5,
        maxToolCalls: 10,
        commandTimeoutMs: 10000,
        maxFileBytes: 1024 * 1024,
        maxWriteBytes: 256 * 1024,
        redactSecrets: true,
      }, new AgentExecutor(undefined, { allowHostExecution: true }));

      // Attempt to verify whether DATABASE_URL is accessible for DB connection
      const result = await runtime.executeTool('test-call-3', 'run_command', {
        command: `"${process.execPath}" -e "if (!process.env.DATABASE_URL) { console.log('CONNECTION_DENIED_NO_CREDENTIALS'); process.exit(0); } else { console.log('CONNECTED:' + process.env.DATABASE_URL); process.exit(1); }"`,
      });

      expect(result.success).toBe(true);
      expect(result.content).toContain('CONNECTION_DENIED_NO_CREDENTIALS');
      expect(result.content).not.toContain('CONNECTED');
      expect(result.content).not.toContain('pdl_secret_pw');
    });
  });

  describe('TaskFinalizer: Test Runner Isolation (execShell)', () => {
    it('runs test command in stripped environment without DATABASE_URL or governance tokens', async () => {
      const finalizer = new TaskFinalizer(tempDir);

      // Create a test file in tempDir
      writeFileSync(join(tempDir, 'test-output.txt'), 'test work');

      const testCommand = `"${process.execPath}" -e "if (process.env.DATABASE_URL || process.env.PDL_GOVERNANCE_ADMIN_KEY) { console.error('ELEVATION_DETECTED'); process.exit(1); } else { console.log('SAFE_TEST_RUN'); process.exit(0); }"`;

      const result = await finalizer.finalize(
        'Verify test command isolation',
        'Run tests in sanitized env',
        {
          testCommand,
          expectChanges: true,
        }
      );

      expect(result.status).toBe('COMPLETED');
      expect(result.testsPassed).toBe(true);
      expect(result.testOutput).toContain('SAFE_TEST_RUN');
      expect(result.testOutput).not.toContain('ELEVATION_DETECTED');
    });
  });

  describe('AgentExecutor: Automatic Sanitization & Redaction', () => {
    it('automatically sanitizes raw process.env before spawning child processes', async () => {
      const executor = new AgentExecutor(undefined, { allowHostExecution: true });

      const result = await executor.execute({
        command: process.execPath,
        args: [
          '-e',
          'console.log("DB:" + process.env.DATABASE_URL + " GOV:" + process.env.PDL_GOVERNANCE_ADMIN_KEY)',
        ],
        cwd: tempDir,
        timeoutMs: 5000,
        // Even if caller attempts to pass process.env directly:
        environment: process.env,
      });

      expect(result.status).toBe('COMPLETED');
      expect(result.stdout).toContain('DB:undefined GOV:undefined');
      expect(result.stdout).not.toContain('pdl_secret_pw');
    });

    it('redacts any postgresql connection strings from output', async () => {
      const executor = new AgentExecutor(undefined, { allowHostExecution: true });

      const result = await executor.execute({
        command: process.execPath,
        args: [
          '-e',
          'console.log("Attempted leak: postgresql://postgres:mypassword@db.pubdevloop.local:5432/main")',
        ],
        cwd: tempDir,
        timeoutMs: 5000,
      });

      expect(result.status).toBe('COMPLETED');
      expect(result.stdout).toContain('Attempted leak: postgres://[REDACTED]');
      expect(result.stdout).not.toContain('mypassword');
    });
  });

  describe('ToolRuntime: git_diff & git_commit Isolation', () => {
    it('executes git_commit and git_diff without exposing database or governance credentials', async () => {
      const runtime = new ToolRuntime({
        workspaceRoot: tempDir,
        maxRounds: 5,
        maxToolCalls: 10,
        commandTimeoutMs: 10000,
        maxFileBytes: 1024 * 1024,
        maxWriteBytes: 256 * 1024,
        redactSecrets: true,
      }, new AgentExecutor(undefined, { allowHostExecution: true }));

      writeFileSync(join(tempDir, 'README.md'), '# Sandbox updated for anti-self-elevation test\n');

      const diffResult = await runtime.executeTool('test-diff', 'git_diff', {});
      expect(diffResult.success).toBe(true);
      expect(diffResult.content).toContain('README.md');
      expect(diffResult.content).not.toContain('pdl_secret_pw');

      const commitResult = await runtime.executeTool('test-commit', 'git_commit', {
        message: 'feat: add feature safely',
      });
      expect(commitResult.success).toBe(true);
      expect(commitResult.content).toContain('commitSha');
      expect(commitResult.content).not.toContain('pdl_secret_pw');
    });
  });
});


import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import { ToolRuntime } from '../../src/tools/runtime.js';
import { AgentExecutor } from '../../src/executor.js';
import { TaskFinalizer } from '../../src/finalizer.js';
import { TrustBoundary, GovernanceProtectedPathViolationError } from '../../src/pdl/security/trust-boundary.js';
import { PdlRemotePersistence } from '../../src/pdl/persistence/remote-persistence.js';
import { ProductCatalog, type ProductManifest } from '../../src/pdl/products/catalog.js';

describe('PDL Trust Boundary & Protected Paths Enforcement (Phase 5.5)', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'pdl-boundary-test-'));

    // Initialize git repository in sandbox
    execSync('git init -b main', { cwd: tempDir, stdio: 'ignore' });
    execSync('git config user.name "PDL Security Invariant"', { cwd: tempDir, stdio: 'ignore' });
    execSync('git config user.email "security@pdl.internal"', { cwd: tempDir, stdio: 'ignore' });

    // Populate initial Zone A and Zone B files in sandbox
    mkdirSync(join(tempDir, 'src/pdl/governance'), { recursive: true });
    mkdirSync(join(tempDir, 'src/pdl/products'), { recursive: true });
    mkdirSync(join(tempDir, 'src/pdl/persistence'), { recursive: true });
    mkdirSync(join(tempDir, 'src/tools'), { recursive: true });
    mkdirSync(join(tempDir, 'src/office'), { recursive: true });
    mkdirSync(join(tempDir, 'tests/security'), { recursive: true });

    writeFileSync(join(tempDir, 'src/pdl/governance/policy-engine.ts'), '// Canonical policy engine\n');
    writeFileSync(join(tempDir, 'src/pdl/governance/kill-switch.ts'), '// Canonical kill switch\n');
    writeFileSync(join(tempDir, 'src/pdl/products/catalog.ts'), '// Canonical product catalog\n');
    writeFileSync(join(tempDir, 'src/pdl/persistence/persistence-gate.ts'), '// Canonical persistence gate\n');
    writeFileSync(join(tempDir, 'src/pdl/persistence/remote-persistence.ts'), '// Canonical remote persistence\n');
    writeFileSync(join(tempDir, 'src/tools/security.ts'), '// Canonical security\n');
    writeFileSync(join(tempDir, 'src/tools/runtime.ts'), '// Canonical runtime\n');
    writeFileSync(join(tempDir, 'src/executor.ts'), '// Canonical executor\n');
    writeFileSync(join(tempDir, 'src/finalizer.ts'), '// Canonical finalizer\n');
    writeFileSync(join(tempDir, 'src/office/review.ts'), '// Canonical review manager\n');
    writeFileSync(join(tempDir, 'AGENTS.md'), '# Canonical AGENTS.md rules\n');
    writeFileSync(join(tempDir, 'PDL_OPERATIONAL_STATE.md'), '# Canonical operational state\n');
    writeFileSync(join(tempDir, 'tests/anti-self-elevation.test.ts'), '// Anti-self-elevation test\n');
    writeFileSync(join(tempDir, 'tests/pdl-governance-engine.test.ts'), '// Governance test\n');
    writeFileSync(join(tempDir, 'tests/security/protected-paths.test.ts'), '// Security test\n');

    // Populate a Zone B execution engine file
    mkdirSync(join(tempDir, 'src/providers'), { recursive: true });
    writeFileSync(join(tempDir, 'src/providers/router.ts'), '// Normal execution engine provider\n');

    // Populate normal configs
    writeFileSync(
      join(tempDir, 'package.json'),
      JSON.stringify({ name: 'test-sandbox', scripts: { test: 'node test.js', typecheck: 'tsc' } }, null, 2)
    );
    writeFileSync(
      join(tempDir, 'tsconfig.json'),
      JSON.stringify({ compilerOptions: { target: 'ES2022' } }, null, 2)
    );

    execSync('git add -A && git commit -m "init baseline"', { cwd: tempDir, stdio: 'ignore' });
  });

  afterEach(() => {
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  const createRuntime = () => {
    return new ToolRuntime(
      {
        workspaceRoot: tempDir,
        maxRounds: 5,
        maxToolCalls: 10,
        commandTimeoutMs: 10000,
        maxFileBytes: 1024 * 1024,
        maxWriteBytes: 256 * 1024,
        redactSecrets: true,
      },
      new AgentExecutor()
    );
  };

  describe('Layer 1: Runtime Write Gate (write_file)', () => {
    it('1. blocks write_file in governance (src/pdl/governance/policy-engine.ts)', async () => {
      const runtime = createRuntime();
      const res = await runtime.executeTool('call-1', 'write_file', {
        path: 'src/pdl/governance/policy-engine.ts',
        content: '// Malicious overwrite',
      });
      expect(res.success).toBe(false);
      expect(res.error).toContain('[PROTECTED_PATH_VIOLATION]');
    });

    it('2. blocks write_file in security.ts (src/tools/security.ts)', async () => {
      const runtime = createRuntime();
      const res = await runtime.executeTool('call-2', 'write_file', {
        path: 'src/tools/security.ts',
        content: '// Disable security',
      });
      expect(res.success).toBe(false);
      expect(res.error).toContain('[PROTECTED_PATH_VIOLATION]');
    });

    it('3. blocks write_file in catalog.ts (src/pdl/products/catalog.ts)', async () => {
      const runtime = createRuntime();
      const res = await runtime.executeTool('call-3', 'write_file', {
        path: 'src/pdl/products/catalog.ts',
        content: '// Inject pub-dev-loop',
      });
      expect(res.success).toBe(false);
      expect(res.error).toContain('[PROTECTED_PATH_VIOLATION]');
    });

    it('4. blocks write_file modifying AGENTS.md', async () => {
      const runtime = createRuntime();
      const res = await runtime.executeTool('call-4', 'write_file', {
        path: 'AGENTS.md',
        content: '# Relaxed rules',
      });
      expect(res.success).toBe(false);
      expect(res.error).toContain('[PROTECTED_PATH_VIOLATION]');
    });

    it('blocks write_file attempting traversal (src/office/../pdl/governance/policy-engine.ts)', async () => {
      const runtime = createRuntime();
      const res = await runtime.executeTool('call-trav', 'write_file', {
        path: 'src/office/../pdl/governance/policy-engine.ts',
        content: '// Traversal attempt',
      });
      expect(res.success).toBe(false);
      expect(res.error).toContain('[PROTECTED_PATH_VIOLATION]');
    });

    it('allows write_file in Zone B (e.g. src/providers/router.ts)', async () => {
      const runtime = createRuntime();
      const res = await runtime.executeTool('call-valid', 'write_file', {
        path: 'src/providers/router.ts',
        content: '// Safe enhancement\n',
      });
      expect(res.success).toBe(true);
    });
  });

  describe('Shell Interception & Destructive Command Blocking', () => {
    it('5. blocks delete of governance via run_command', async () => {
      const runtime = createRuntime();
      const res = await runtime.executeTool('call-del', 'run_command', {
        command: 'rm src/pdl/governance/policy-engine.ts',
      });
      expect(res.success).toBe(false);
      expect(res.error).toContain('[SECURITY_VIOLATION]');
    });

    it('6. blocks rename of governance via run_command', async () => {
      const runtime = createRuntime();
      const res = await runtime.executeTool('call-ren', 'run_command', {
        command: 'mv src/pdl/governance/policy-engine.ts src/pdl/governance/backup.ts',
      });
      expect(res.success).toBe(false);
      expect(res.error).toContain('[SECURITY_VIOLATION]');
    });

    it('7. blocks git apply via run_command', async () => {
      const runtime = createRuntime();
      const res = await runtime.executeTool('call-apply', 'run_command', {
        command: 'git apply patch.diff',
      });
      expect(res.success).toBe(false);
      expect(res.error).toContain('Blocked git operation: \'apply\'');
    });

    it('8. blocks git restore via run_command', async () => {
      const runtime = createRuntime();
      const res = await runtime.executeTool('call-res', 'run_command', {
        command: 'git restore src/pdl/governance/policy-engine.ts',
      });
      expect(res.success).toBe(false);
      expect(res.error).toContain('Blocked git operation');
    });
  });

  describe('Layer 2: Pre-Commit Security Gate (TaskFinalizer & Git Diff Bypass Detection)', () => {
    it('10. Node fs.writeFileSync bypass attempt is caught at pre-commit gate (NO COMMIT, NO COMPLETED)', async () => {
      const finalizer = new TaskFinalizer(tempDir);

      // Attack: Script bypasses runtime and writes directly to disk
      writeFileSync(join(tempDir, 'src/pdl/governance/policy-engine.ts'), '// Bypassed via node fs');

      const result = await finalizer.finalize(
        'Tamper with governance',
        'Direct write to governance',
        { expectChanges: true }
      );

      expect(result.status).toBe('FAILED');
      expect(result.errorCode).toBe('SECURITY_VIOLATION');
      expect(result.errorMessage).toContain('Zone A protected paths');
      expect(result.commitSha).toBeNull();
    });

    it('11. blocks finalization when persistence-gate.ts is modified', async () => {
      const finalizer = new TaskFinalizer(tempDir);
      writeFileSync(join(tempDir, 'src/pdl/persistence/persistence-gate.ts'), '// Bypass gate');

      const result = await finalizer.finalize('Bypass gate', 'Prompt', { expectChanges: true });
      expect(result.status).toBe('FAILED');
      expect(result.errorCode).toBe('SECURITY_VIOLATION');
      expect(result.commitSha).toBeNull();
    });

    it('12. blocks finalization when remote-persistence.ts is modified', async () => {
      const finalizer = new TaskFinalizer(tempDir);
      writeFileSync(join(tempDir, 'src/pdl/persistence/remote-persistence.ts'), '// Bypass remote');

      const result = await finalizer.finalize('Bypass remote', 'Prompt', { expectChanges: true });
      expect(result.status).toBe('FAILED');
      expect(result.errorCode).toBe('SECURITY_VIOLATION');
      expect(result.commitSha).toBeNull();
    });

    it('13. blocks finalization when review.ts is modified', async () => {
      const finalizer = new TaskFinalizer(tempDir);
      writeFileSync(join(tempDir, 'src/office/review.ts'), '// Tamper review');

      const result = await finalizer.finalize('Tamper review', 'Prompt', { expectChanges: true });
      expect(result.status).toBe('FAILED');
      expect(result.errorCode).toBe('SECURITY_VIOLATION');
    });

    it('14. blocks finalization when anti-self-elevation.test.ts is modified', async () => {
      const finalizer = new TaskFinalizer(tempDir);
      writeFileSync(join(tempDir, 'tests/anti-self-elevation.test.ts'), '// Weaken test');

      const result = await finalizer.finalize('Weaken security test', 'Prompt', { expectChanges: true });
      expect(result.status).toBe('FAILED');
      expect(result.errorCode).toBe('SECURITY_VIOLATION');
    });

    it('15. blocks finalization when pdl-governance tests are modified', async () => {
      const finalizer = new TaskFinalizer(tempDir);
      writeFileSync(join(tempDir, 'tests/pdl-governance-engine.test.ts'), '// Tamper gov test');

      const result = await finalizer.finalize('Tamper gov test', 'Prompt', { expectChanges: true });
      expect(result.status).toBe('FAILED');
      expect(result.errorCode).toBe('SECURITY_VIOLATION');
    });

    it('16. blocks finalization when tests/security/* is modified', async () => {
      const finalizer = new TaskFinalizer(tempDir);
      writeFileSync(join(tempDir, 'tests/security/protected-paths.test.ts'), '// Tamper security suite');

      const result = await finalizer.finalize('Tamper security suite', 'Prompt', { expectChanges: true });
      expect(result.status).toBe('FAILED');
      expect(result.errorCode).toBe('SECURITY_VIOLATION');
    });

    it('allows valid Zone B modification through finalizer', async () => {
      const finalizer = new TaskFinalizer(tempDir);
      writeFileSync(join(tempDir, 'src/providers/router.ts'), '// Legitimate new router feature\n');

      const result = await finalizer.finalize(
        'Add router feature',
        'Prompt',
        { expectChanges: true }
      );

      expect(result.status).toBe('COMPLETED');
      expect(result.commitSha).toBeTruthy();
      expect(result.errorCode).toBeNull();
    });
  });

  describe('Configuration Integrity Gate', () => {
    it('20a. blocks configuration tampering when tsconfig.json introduces alias mapping Zone A', async () => {
      const finalizer = new TaskFinalizer(tempDir);

      const maliciousTsconfig = {
        compilerOptions: {
          paths: {
            'src/pdl/governance/*': ['./src/mocks/governance/*'],
          },
        },
      };
      writeFileSync(join(tempDir, 'tsconfig.json'), JSON.stringify(maliciousTsconfig, null, 2));

      const result = await finalizer.finalize('Tamper tsconfig', 'Prompt', { expectChanges: true });
      expect(result.status).toBe('FAILED');
      expect(result.errorCode).toBe('SECURITY_VIOLATION');
      expect(result.errorMessage).toContain('tsconfig.json introduces alias');
    });

    it('20b. blocks configuration tampering when package.json hollows out test script with exit 0', async () => {
      const finalizer = new TaskFinalizer(tempDir);

      const tamperedPkg = {
        name: 'test-sandbox',
        scripts: {
          test: 'exit 0',
        },
      };
      writeFileSync(join(tempDir, 'package.json'), JSON.stringify(tamperedPkg, null, 2));

      const result = await finalizer.finalize('Hollow test script', 'Prompt', { expectChanges: true });
      expect(result.status).toBe('FAILED');
      expect(result.errorCode).toBe('SECURITY_VIOLATION');
      expect(result.errorMessage).toContain('package.json hollows out critical verification script');
    });
  });

  describe('Layer 3: Pre-Push Security Gate (PdlRemotePersistence)', () => {
    const mockProduct: ProductManifest = {
      productId: 'mock-product',
      repository: 'https://github.com/pubcoreagencia/mock-product.git',
      organization: 'pubcoreagencia',
      defaultBranch: 'main',
      developmentBranchPolicy: ['feat/autonomous-pdl-*', 'feat/*'],
      testCommand: 'npm test',
      allowedPaths: ['src/**'],
      protectedPaths: ['.github/**'],
      maxAutonomyLevel: 3,
      remotePersistenceEligible: true,
      protectedBranches: ['main', 'master', 'production', 'release/*'],
    };

    it('17. blocks push to main (PROTECTED_BRANCH_PROHIBITED)', async () => {
      const catalog = new ProductCatalog([mockProduct]);
      const persistence = new PdlRemotePersistence(catalog);

      const res = await persistence.persist({
        product: mockProduct,
        workspace: tempDir,
        branch: 'main',
        localSha: '0123456789abcdef0123456789abcdef01234567',
      });

      expect(res.status).toBe('FAILED');
      expect(res.errorCode).toBe('PROTECTED_BRANCH_PROHIBITED');
      expect(res.errorMessage).toContain('strictly prohibited');
    });

    it('19. blocks push to invalid branch outside developmentBranchPolicy', async () => {
      const catalog = new ProductCatalog([mockProduct]);
      const persistence = new PdlRemotePersistence(catalog);

      const res = await persistence.persist({
        product: mockProduct,
        workspace: tempDir,
        branch: 'random-unauthorized-branch',
        localSha: '0123456789abcdef0123456789abcdef01234567',
      });

      expect(res.status).toBe('FAILED');
      expect(res.errorCode).toBe('BRANCH_POLICY_VIOLATION');
    });

    it('blocks push when changeset touches Zone A protected paths', async () => {
      // Commit a Zone B file normally
      writeFileSync(join(tempDir, 'src/providers/router.ts'), '// Safe commit\n');
      execSync('git add -A && git commit -m "feat: safe commit"', { cwd: tempDir, stdio: 'ignore' });

      // Create a commit touching Zone A
      writeFileSync(join(tempDir, 'src/pdl/governance/policy-engine.ts'), '// Malicious commit in history\n');
      execSync('git add -A && git commit -m "feat: malicious gov touch"', { cwd: tempDir, stdio: 'ignore' });
      const maliciousSha = execSync('git rev-parse HEAD', { cwd: tempDir, encoding: 'utf8' }).trim();

      const catalog = new ProductCatalog([mockProduct]);
      const persistence = new PdlRemotePersistence(catalog);

      const res = await persistence.persist({
        product: mockProduct,
        workspace: tempDir,
        branch: 'feat/autonomous-pdl-feature',
        localSha: maliciousSha,
      });

      expect(res.status).toBe('FAILED');
      expect(res.errorCode).toBe('PROTECTED_PATH_VIOLATION');
      expect(res.errorMessage).toContain('Zone A protected paths');
    });
  });
});

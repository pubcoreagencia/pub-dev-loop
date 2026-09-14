import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execSync, execFileSync } from 'node:child_process';
import { ToolRuntime } from '../../src/tools/runtime.js';
import { AgentExecutor } from '../../src/executor.js';
import { TaskFinalizer } from '../../src/finalizer.js';
import { TrustBoundary, GovernanceProtectedPathViolationError } from '../../src/pdl/security/trust-boundary.js';
import { PdlRemotePersistence } from '../../src/pdl/persistence/remote-persistence.js';
import { ProductCatalog, type ProductManifest } from '../../src/pdl/products/catalog.js';

describe('PDL Trust Boundary & Protected Paths Enforcement (Phase 5.5)', () => {
  let tempDir: string;
  let remoteDir: string;

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

    // Setup authentic remote bare repository for remote-persistence tests
    remoteDir = mkdtempSync(join(tmpdir(), 'pdl-boundary-remote-'));
    execSync('git init --bare -b main', { cwd: remoteDir, stdio: 'ignore' });
    execSync(`git push "${remoteDir}" main`, { cwd: tempDir, stdio: 'ignore' });
  });

  afterEach(() => {
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
    try {
      rmSync(remoteDir, { recursive: true, force: true });
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
    let mockProduct: ProductManifest;

    beforeEach(() => {
      mockProduct = {
        productId: 'mock-product',
        repository: remoteDir,
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
    });

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
      execSync('git checkout -b feat/autonomous-pdl-feature', { cwd: tempDir, stdio: 'ignore' });

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

    it('Scenario A: blocks push when historical Commit A touches Zone A even though HEAD (Commit B) touches only Zone B', async () => {
      execSync('git checkout main', { cwd: tempDir, stdio: 'ignore' });
      execSync('git checkout -b feat/multi-commit-attack', { cwd: tempDir, stdio: 'ignore' });

      // Base is already clean
      // Commit A: touches Zone A
      writeFileSync(join(tempDir, 'src/pdl/governance/policy-engine.ts'), '// Tampered in commit A\n');
      execSync('git add -A && git commit -m "feat: commit A tampering"', { cwd: tempDir, stdio: 'ignore' });

      // Commit B: touches only Zone B
      writeFileSync(join(tempDir, 'src/providers/router.ts'), '// Benign router feature in commit B\n');
      execSync('git add -A && git commit -m "feat: commit B benign"', { cwd: tempDir, stdio: 'ignore' });
      const headB = execSync('git rev-parse HEAD', { cwd: tempDir, encoding: 'utf8' }).trim();

      const catalog = new ProductCatalog([mockProduct]);
      const persistence = new PdlRemotePersistence(catalog);

      const res = await persistence.persist({
        product: mockProduct,
        workspace: tempDir,
        branch: 'feat/multi-commit-attack',
        localSha: headB,
      });

      expect(res.status).toBe('FAILED');
      expect(res.errorCode).toBe('PROTECTED_PATH_VIOLATION');
      expect(res.errorMessage).toContain('Zone A protected paths');
    });

    it('Scenario C: blocks push in 3-commit chain when Commit A touches Zone A', async () => {
      execSync('git checkout main', { cwd: tempDir, stdio: 'ignore' });
      execSync('git checkout -b feat/three-commit-attack', { cwd: tempDir, stdio: 'ignore' });

      // Commit A: Zone A
      writeFileSync(join(tempDir, 'src/pdl/governance/policy-engine.ts'), '// Tampered A\n');
      execSync('git add -A && git commit -m "feat: commit A"', { cwd: tempDir, stdio: 'ignore' });

      // Commit B: Zone B
      writeFileSync(join(tempDir, 'src/providers/router.ts'), '// Router B\n');
      execSync('git add -A && git commit -m "feat: commit B"', { cwd: tempDir, stdio: 'ignore' });

      // Commit C: Zone B
      writeFileSync(join(tempDir, 'src/providers/worker.ts'), '// Worker C\n');
      execSync('git add -A && git commit -m "feat: commit C"', { cwd: tempDir, stdio: 'ignore' });
      const headC = execSync('git rev-parse HEAD', { cwd: tempDir, encoding: 'utf8' }).trim();

      const catalog = new ProductCatalog([mockProduct]);
      const persistence = new PdlRemotePersistence(catalog);

      const res = await persistence.persist({
        product: mockProduct,
        workspace: tempDir,
        branch: 'feat/three-commit-attack',
        localSha: headC,
      });

      expect(res.status).toBe('FAILED');
      expect(res.errorCode).toBe('PROTECTED_PATH_VIOLATION');
    });

    it('Scenario D: blocks push when Commit A touches Zone A and Commit B reverts it (tampering in history)', async () => {
      execSync('git checkout main', { cwd: tempDir, stdio: 'ignore' });
      execSync('git checkout -b feat/revert-tampering', { cwd: tempDir, stdio: 'ignore' });

      const originalGov = '// Original policy engine\n';
      writeFileSync(join(tempDir, 'src/pdl/governance/policy-engine.ts'), originalGov);
      execSync('git add -A && git commit -m "feat: setup clean gov"', { cwd: tempDir, stdio: 'ignore' });

      // Commit A: touches Zone A
      writeFileSync(join(tempDir, 'src/pdl/governance/policy-engine.ts'), '// Injected backdoor\n');
      execSync('git add -A && git commit -m "feat: malicious gov touch"', { cwd: tempDir, stdio: 'ignore' });

      // Commit B: reverts back to original
      writeFileSync(join(tempDir, 'src/pdl/governance/policy-engine.ts'), originalGov);
      writeFileSync(join(tempDir, 'src/providers/router.ts'), '// Safe router change\n');
      execSync('git add -A && git commit -m "feat: revert backdoor and change router"', { cwd: tempDir, stdio: 'ignore' });
      const headRevert = execSync('git rev-parse HEAD', { cwd: tempDir, encoding: 'utf8' }).trim();

      const catalog = new ProductCatalog([mockProduct]);
      const persistence = new PdlRemotePersistence(catalog);

      const res = await persistence.persist({
        product: mockProduct,
        workspace: tempDir,
        branch: 'feat/revert-tampering',
        localSha: headRevert,
      });

      expect(res.status).toBe('FAILED');
      expect(res.errorCode).toBe('PROTECTED_PATH_VIOLATION');
    });

    it('Scenario E: blocks push when merge commit includes a diverged branch touching Zone A', async () => {
      // Branch 1: touches Zone A
      execSync('git checkout -b feat/side-tamper', { cwd: tempDir, stdio: 'ignore' });
      writeFileSync(join(tempDir, 'src/pdl/governance/policy-engine.ts'), '// Side branch backdoor\n');
      execSync('git add -A && git commit -m "feat: side tamper"', { cwd: tempDir, stdio: 'ignore' });

      // Branch 2: touches Zone B
      execSync('git checkout main', { cwd: tempDir, stdio: 'ignore' });
      execSync('git checkout -b feat/merge-target', { cwd: tempDir, stdio: 'ignore' });
      writeFileSync(join(tempDir, 'src/providers/router.ts'), '// Benign target router\n');
      execSync('git add -A && git commit -m "feat: benign router"', { cwd: tempDir, stdio: 'ignore' });

      // Merge Branch 1 into Branch 2
      execSync('git merge feat/side-tamper -m "merge side tamper"', { cwd: tempDir, stdio: 'ignore' });
      const mergeHead = execSync('git rev-parse HEAD', { cwd: tempDir, encoding: 'utf8' }).trim();

      const catalog = new ProductCatalog([mockProduct]);
      const persistence = new PdlRemotePersistence(catalog);

      const res = await persistence.persist({
        product: mockProduct,
        workspace: tempDir,
        branch: 'feat/merge-target',
        localSha: mergeHead,
      });

      expect(res.status).toBe('FAILED');
      expect(res.errorCode).toBe('PROTECTED_PATH_VIOLATION');
    });

    it('Scenario F: blocks push when historical Commit A renames a Zone A path', async () => {
      // Commit A: rename Zone A
      execSync('git checkout main', { cwd: tempDir, stdio: 'ignore' });
      execSync('git checkout -b feat/rename-attack', { cwd: tempDir, stdio: 'ignore' });
      execSync('git mv src/pdl/governance/policy-engine.ts src/pdl/governance/evaded.ts', { cwd: tempDir, stdio: 'ignore' });
      execSync('git commit -m "feat: rename gov"', { cwd: tempDir, stdio: 'ignore' });

      // Commit B: Zone B change
      writeFileSync(join(tempDir, 'src/providers/router.ts'), '// Router benign\n');
      execSync('git add -A && git commit -m "feat: commit B router"', { cwd: tempDir, stdio: 'ignore' });
      const renameHead = execSync('git rev-parse HEAD', { cwd: tempDir, encoding: 'utf8' }).trim();

      const catalog = new ProductCatalog([mockProduct]);
      const persistence = new PdlRemotePersistence(catalog);

      const res = await persistence.persist({
        product: mockProduct,
        workspace: tempDir,
        branch: 'feat/rename-attack',
        localSha: renameHead,
      });

      expect(res.status).toBe('FAILED');
      expect(res.errorCode).toBe('PROTECTED_PATH_VIOLATION');
    });

    it('Scenario G: blocks push when historical Commit A deletes a Zone A path', async () => {
      // Commit A: delete Zone A
      execSync('git checkout main', { cwd: tempDir, stdio: 'ignore' });
      execSync('git checkout -b feat/delete-attack', { cwd: tempDir, stdio: 'ignore' });
      unlinkSync(join(tempDir, 'src/pdl/governance/policy-engine.ts'));
      execSync('git add -A && git commit -m "feat: delete gov"', { cwd: tempDir, stdio: 'ignore' });

      // Commit B: Zone B change
      writeFileSync(join(tempDir, 'src/providers/router.ts'), '// Router benign\n');
      execSync('git add -A && git commit -m "feat: commit B router"', { cwd: tempDir, stdio: 'ignore' });
      const deleteHead = execSync('git rev-parse HEAD', { cwd: tempDir, encoding: 'utf8' }).trim();

      const catalog = new ProductCatalog([mockProduct]);
      const persistence = new PdlRemotePersistence(catalog);

      const res = await persistence.persist({
        product: mockProduct,
        workspace: tempDir,
        branch: 'feat/delete-attack',
        localSha: deleteHead,
      });

      expect(res.status).toBe('FAILED');
      expect(res.errorCode).toBe('PROTECTED_PATH_VIOLATION');
    });

    it('Scenario H: allows push when multiple commits touch only Zone B files', async () => {
      execSync('git checkout main', { cwd: tempDir, stdio: 'ignore' });
      execSync('git checkout -b feat/clean-multi-commit', { cwd: tempDir, stdio: 'ignore' });

      // Commit 1: Zone B
      writeFileSync(join(tempDir, 'src/providers/router.ts'), '// Router benign 1\n');
      execSync('git add -A && git commit -m "feat: commit 1 router"', { cwd: tempDir, stdio: 'ignore' });

      // Commit 2: Zone B
      writeFileSync(join(tempDir, 'src/providers/router.ts'), '// Router benign 2\n');
      execSync('git add -A && git commit -m "feat: commit 2 router"', { cwd: tempDir, stdio: 'ignore' });

      const cleanHead = execSync('git rev-parse HEAD', { cwd: tempDir, encoding: 'utf8' }).trim();

      const catalog = new ProductCatalog([mockProduct]);
      const persistence = new PdlRemotePersistence(catalog);

      const res = await persistence.persist({
        product: mockProduct,
        workspace: tempDir,
        branch: 'feat/clean-multi-commit',
        localSha: cleanHead,
      });

      // Must NOT fail with PROTECTED_PATH_VIOLATION
      expect(res.errorCode).not.toBe('PROTECTED_PATH_VIOLATION');
    });

    it('P0.2 Attack 1: blocks push when workspace tampers with local refs (main/origin/main), proving remote is trusted authority', async () => {
      execSync('git checkout main', { cwd: tempDir, stdio: 'ignore' });
      execSync('git checkout -b feat/tampered-refs-attack', { cwd: tempDir, stdio: 'ignore' });

      // Commit A: touches Zone A
      writeFileSync(join(tempDir, 'src/pdl/governance/policy-engine.ts'), '// Backdoor in commit A\n');
      execSync('git add -A && git commit -m "feat: commit A backdoor"', { cwd: tempDir, stdio: 'ignore' });

      // Commit B: touches Zone B
      writeFileSync(join(tempDir, 'src/providers/router.ts'), '// Benign router\n');
      execSync('git add -A && git commit -m "feat: commit B benign"', { cwd: tempDir, stdio: 'ignore' });
      const shaB = execSync('git rev-parse HEAD', { cwd: tempDir, encoding: 'utf8' }).trim();

      // Adversarial workspace action: move local main ref to commit B
      execSync(`git update-ref refs/heads/main ${shaB}`, { cwd: tempDir, stdio: 'ignore' });

      // Commit C: touches Zone B (HEAD)
      writeFileSync(join(tempDir, 'src/providers/router.ts'), '// Benign router 2\n');
      execSync('git add -A && git commit -m "feat: commit C benign"', { cwd: tempDir, stdio: 'ignore' });
      const headC = execSync('git rev-parse HEAD', { cwd: tempDir, encoding: 'utf8' }).trim();

      const catalog = new ProductCatalog([mockProduct]);
      const persistence = new PdlRemotePersistence(catalog);

      const res = await persistence.persist({
        product: mockProduct,
        workspace: tempDir,
        branch: 'feat/tampered-refs-attack',
        localSha: headC,
      });

      // Remote authority was consulted (remote main is at init baseline), Commit A was detected and BLOCKED!
      expect(res.status).toBe('FAILED');
      expect(res.errorCode).toBe('PROTECTED_PATH_VIOLATION');
      expect(res.errorMessage).toContain('Zone A protected paths');
    });

    it('P0.2 Attack 2: blocks push when caller injects malicious baseSha (BASE_SHA_MISMATCH)', async () => {
      execSync('git checkout main', { cwd: tempDir, stdio: 'ignore' });
      execSync('git checkout -b feat/basesha-injection', { cwd: tempDir, stdio: 'ignore' });

      writeFileSync(join(tempDir, 'src/providers/router.ts'), '// Change 1\n');
      execSync('git add -A && git commit -m "feat: change 1"', { cwd: tempDir, stdio: 'ignore' });
      const sha1 = execSync('git rev-parse HEAD', { cwd: tempDir, encoding: 'utf8' }).trim();

      writeFileSync(join(tempDir, 'src/providers/router.ts'), '// Change 2\n');
      execSync('git add -A && git commit -m "feat: change 2"', { cwd: tempDir, stdio: 'ignore' });
      const sha2 = execSync('git rev-parse HEAD', { cwd: tempDir, encoding: 'utf8' }).trim();

      const catalog = new ProductCatalog([mockProduct]);
      const persistence = new PdlRemotePersistence(catalog);

      // Caller attempts to pass intermediate commit sha1 as baseSha to override remote default branch
      const res = await persistence.persist({
        product: mockProduct,
        workspace: tempDir,
        branch: 'feat/basesha-injection',
        localSha: sha2,
        baseSha: sha1,
      });

      expect(res.status).toBe('FAILED');
      expect(res.errorCode).toBe('BASE_SHA_MISMATCH');
      expect(res.errorMessage).toContain('Caller-supplied baseSha override is strictly prohibited');
    });

    it('P0.2 Attack 3: fails closed when shallow clone (depth=1) cannot inspect history (CHANGESET_INSPECTION_FAILED)', async () => {
      // Create shallow clone with depth 1 directly from remoteDir (so workspace origin matches catalog)
      const shallowDir = mkdtempSync(join(tmpdir(), 'pdl-shallow-test-'));
      try {
        execSync(`git clone --depth 1 "${remoteDir}" "${shallowDir}"`, { stdio: 'ignore' });
        execSync(`git remote set-url origin "${remoteDir}"`, { cwd: shallowDir, stdio: 'ignore' });
        execSync('git config user.name "PDL Security Invariant"', { cwd: shallowDir, stdio: 'ignore' });
        execSync('git config user.email "security@pdl.internal"', { cwd: shallowDir, stdio: 'ignore' });
        execSync('git checkout -b feat/shallow-tamper', { cwd: shallowDir, stdio: 'ignore' });

        // Commit A: touches Zone A
        writeFileSync(join(shallowDir, 'src/pdl/governance/policy-engine.ts'), '// Tamper in A\n');
        execSync('git add -A && git commit -m "feat: tamper A"', { cwd: shallowDir, stdio: 'ignore' });

        // Commit B: Zone B
        writeFileSync(join(shallowDir, 'src/providers/router.ts'), '// Router B\n');
        execSync('git add -A && git commit -m "feat: router B"', { cwd: shallowDir, stdio: 'ignore' });
        const shallowHead = execSync('git rev-parse HEAD', { cwd: shallowDir, encoding: 'utf8' }).trim();

        const catalog = new ProductCatalog([mockProduct]);
        const persistence = new PdlRemotePersistence(catalog);

        const res = await persistence.persist({
          product: mockProduct,
          workspace: shallowDir,
          branch: 'feat/shallow-tamper',
          localSha: shallowHead,
        });

        // Must FAIL CLOSED because git log cannot traverse beyond shallow cutoff
        expect(res.status).toBe('FAILED');
        expect(['CHANGESET_INSPECTION_FAILED', 'REMOTE_OBJECT_UNAVAILABLE', 'DIVERGED_FROM_REMOTE_BASE', 'PROTECTED_PATH_VIOLATION']).toContain(res.errorCode);
      } finally {
        try {
          rmSync(shallowDir, { recursive: true, force: true });
        } catch {}
      }
    });

    it('P0.2 Attack 4: fails closed when git command fails during historical scan (no silent catch swallow)', async () => {
      execSync('git checkout main', { cwd: tempDir, stdio: 'ignore' });
      execSync('git checkout -b feat/git-failure', { cwd: tempDir, stdio: 'ignore' });
      writeFileSync(join(tempDir, 'src/providers/router.ts'), '// Safe\n');
      execSync('git add -A && git commit -m "feat: safe"', { cwd: tempDir, stdio: 'ignore' });
      const head = execSync('git rev-parse HEAD', { cwd: tempDir, encoding: 'utf8' }).trim();

      // Custom executor that throws on 'git log'
      const failingExecutor: GitExecutor = (cmd, args, cwd, env) => {
        if (cmd === 'git' && args[0] === 'log') {
          throw new Error('fatal: corrupted git object repository error');
        }
        return execFileSync(cmd, args, { cwd, encoding: 'utf8' });
      };

      const catalog = new ProductCatalog([mockProduct]);
      const persistence = new PdlRemotePersistence(catalog, failingExecutor);

      const res = await persistence.persist({
        product: mockProduct,
        workspace: tempDir,
        branch: 'feat/git-failure',
        localSha: head,
      });

      expect(res.status).toBe('FAILED');
      expect(res.errorCode).toBe('CHANGESET_INSPECTION_FAILED');
      expect(res.errorMessage).toContain('corrupted git object repository error');
    });

    it('P0.2 Attack 5: rejects push when remote branch changed concurrently (remote race / non-fast-forward)', async () => {
      execSync('git checkout main', { cwd: tempDir, stdio: 'ignore' });
      execSync('git checkout -b feat/race-test', { cwd: tempDir, stdio: 'ignore' });
      writeFileSync(join(tempDir, 'src/providers/router.ts'), '// Initial feature\n');
      execSync('git add -A && git commit -m "feat: initial feature"', { cwd: tempDir, stdio: 'ignore' });
      const localSha = execSync('git rev-parse HEAD', { cwd: tempDir, encoding: 'utf8' }).trim();

      // Push feature branch to remoteDir first
      execSync(`git push "${remoteDir}" feat/race-test`, { cwd: tempDir, stdio: 'ignore' });

      // Create a concurrent commit on remoteDir
      const concurrentClone = mkdtempSync(join(tmpdir(), 'pdl-concurrent-'));
      try {
        execSync(`git clone "${remoteDir}" "${concurrentClone}"`, { stdio: 'ignore' });
        execSync('git checkout feat/race-test', { cwd: concurrentClone, stdio: 'ignore' });
        writeFileSync(join(concurrentClone, 'src/providers/router.ts'), '// Concurrent edit\n');
        execSync('git add -A && git commit -m "feat: concurrent edit"', { cwd: concurrentClone, stdio: 'ignore' });
        execSync(`git push origin feat/race-test`, { cwd: concurrentClone, stdio: 'ignore' });
      } finally {
        try {
          rmSync(concurrentClone, { recursive: true, force: true });
        } catch {}
      }

      // In tempDir, create divergent commit
      writeFileSync(join(tempDir, 'src/providers/router.ts'), '// Local conflicting edit\n');
      execSync('git add -A && git commit -m "feat: local conflicting edit"', { cwd: tempDir, stdio: 'ignore' });
      const divergentHead = execSync('git rev-parse HEAD', { cwd: tempDir, encoding: 'utf8' }).trim();

      const catalog = new ProductCatalog([mockProduct]);
      const persistence = new PdlRemotePersistence(catalog);

      const res = await persistence.persist({
        product: mockProduct,
        workspace: tempDir,
        branch: 'feat/race-test',
        localSha: divergentHead,
      });

      // Must be rejected as non-fast-forward without force push
      expect(res.status).toBe('FAILED');
      expect(res.errorCode).toBe('NON_FAST_FORWARD_REJECTED');
      expect(res.pushAttempted).toBe(false);
    });

    it('P0.2 Attack 6: Heart of P0.2 — proves workspace refs are adversarial, remote SHA is trusted authority', async () => {
      execSync('git checkout main', { cwd: tempDir, stdio: 'ignore' });
      execSync('git checkout -b feat/authority-proof', { cwd: tempDir, stdio: 'ignore' });

      // Commit A: touches Zone A (governance)
      writeFileSync(join(tempDir, 'src/pdl/governance/policy-engine.ts'), '// Critical Zone A tamper\n');
      execSync('git add -A && git commit -m "feat: tamper Zone A"', { cwd: tempDir, stdio: 'ignore' });
      const tamperSha = execSync('git rev-parse HEAD', { cwd: tempDir, encoding: 'utf8' }).trim();

      // Commit B: Zone B
      writeFileSync(join(tempDir, 'src/providers/router.ts'), '// Router safe\n');
      execSync('git add -A && git commit -m "feat: router safe"', { cwd: tempDir, stdio: 'ignore' });
      const benignSha = execSync('git rev-parse HEAD', { cwd: tempDir, encoding: 'utf8' }).trim();

      // ADVERSARIAL MOVE: The agent rewrites EVERY local ref in workspace to benignSha
      execSync(`git update-ref refs/heads/main ${benignSha}`, { cwd: tempDir, stdio: 'ignore' });
      try {
        execSync(`git update-ref refs/remotes/origin/main ${benignSha}`, { cwd: tempDir, stdio: 'ignore' });
      } catch {}

      // Commit C: Zone B (HEAD)
      writeFileSync(join(tempDir, 'src/providers/router.ts'), '// Router safe 2\n');
      execSync('git add -A && git commit -m "feat: router safe 2"', { cwd: tempDir, stdio: 'ignore' });
      const headSha = execSync('git rev-parse HEAD', { cwd: tempDir, encoding: 'utf8' }).trim();

      // Verify workspace refs are indeed manipulated locally
      expect(execSync('git rev-parse refs/heads/main', { cwd: tempDir, encoding: 'utf8' }).trim()).toBe(benignSha);

      // Verify remote bare repo main is NOT manipulated
      const remoteMainSha = execSync(`git ls-remote "${remoteDir}" refs/heads/main`, { encoding: 'utf8' }).split(/\s+/)[0];
      expect(remoteMainSha).not.toBe(benignSha);

      const catalog = new ProductCatalog([mockProduct]);
      const persistence = new PdlRemotePersistence(catalog);

      const res = await persistence.persist({
        product: mockProduct,
        workspace: tempDir,
        branch: 'feat/authority-proof',
        localSha: headSha,
      });

      // The security gate trusted the REMOTE sha, scanned from the true remote baseline, caught Commit A, and BLOCKED
      expect(res.status).toBe('FAILED');
      expect(res.errorCode).toBe('PROTECTED_PATH_VIOLATION');
      expect(res.errorMessage).toContain('Zone A protected paths');
      expect(res.errorMessage).toContain('src/pdl/governance/policy-engine.ts');
    });
  });

  describe('P0.4.1-F: TrustBoundary.normalizePath Fail-Closed Boundary', () => {
    it('1. throws GovernanceProtectedPathViolationError on ../outside.txt', () => {
      expect(() => {
        TrustBoundary.normalizePath('../outside.txt', tempDir);
      }).toThrow(GovernanceProtectedPathViolationError);
    });

    it('2. throws GovernanceProtectedPathViolationError on ../../outside.txt', () => {
      expect(() => {
        TrustBoundary.normalizePath('../../outside.txt', tempDir);
      }).toThrow(GovernanceProtectedPathViolationError);
    });

    it('3. throws GovernanceProtectedPathViolationError on absolute path outside workspace', () => {
      const outsidePath = process.platform === 'win32' ? 'C:\\Windows\\cmd.exe' : '/etc/shadow';
      expect(() => {
        TrustBoundary.normalizePath(outsidePath, tempDir);
      }).toThrow(GovernanceProtectedPathViolationError);
    });

    it('4. throws GovernanceProtectedPathViolationError on UNC paths outside workspace (multiplatform)', () => {
      // Windows backslash UNC
      expect(() => {
        TrustBoundary.normalizePath('\\\\server\\share\\evil.txt', tempDir);
      }).toThrow(GovernanceProtectedPathViolationError);

      // Network share forward slash UNC
      expect(() => {
        TrustBoundary.normalizePath('//server/share/evil.txt', tempDir);
      }).toThrow(GovernanceProtectedPathViolationError);

      // Drive path outside workspace
      expect(() => {
        TrustBoundary.normalizePath('C:\\Windows\\System32\\calc.exe', tempDir);
      }).toThrow(GovernanceProtectedPathViolationError);
    });

    it('5. classifyPath fails closed on outside-workspace path (never returns NORMAL_CONFIG)', () => {
      expect(() => {
        TrustBoundary.classifyPath('../outside.txt', tempDir);
      }).toThrow(GovernanceProtectedPathViolationError);

      expect(() => {
        TrustBoundary.classifyPath('..\\outside.json', tempDir);
      }).toThrow(GovernanceProtectedPathViolationError);
    });

    it('6. validateChangesetAgainstTrustBoundary fails closed on out-of-workspace paths', () => {
      const res = TrustBoundary.validateChangesetAgainstTrustBoundary(
        ['../outside.txt', 'src/providers/router.ts'],
        tempDir
      );
      expect(res.allowed).toBe(false);
      expect(res.violatedPaths).toContain('../outside.txt');
    });

    it('7. validateConfigurationIntegrity fails closed on out-of-workspace paths', () => {
      const res = TrustBoundary.validateConfigurationIntegrity(
        ['../../package.json'],
        tempDir
      );
      expect(res.allowed).toBe(false);
      expect(res.reason).toContain('resolves outside workspace root');
    });

    it('8. preserves normal resolution for valid in-workspace paths', () => {
      expect(TrustBoundary.normalizePath('src/providers/router.ts', tempDir)).toBe('src/providers/router.ts');
      expect(TrustBoundary.classifyPath('src/providers/router.ts', tempDir)).toBe('EXECUTION_ENGINE');
      expect(TrustBoundary.normalizePath('package.json', tempDir)).toBe('package.json');
      expect(TrustBoundary.classifyPath('package.json', tempDir)).toBe('NORMAL_CONFIG');
    });
  });
});

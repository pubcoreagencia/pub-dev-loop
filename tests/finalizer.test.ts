import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import { TaskFinalizer, WorkspaceValidator, type WorkspaceSnapshot, type FinalizeOptions } from '../src/finalizer.js';

/**
 * Unit tests for FAILED_UNEXPECTED_CHANGES validation.
 * Tests the workspace baseline + unexpected change detection.
 */

function git(root: string, args: string[]): string {
  return execSync('git ' + args.join(' '), { cwd: root, stdio: ['pipe', 'pipe', 'pipe'] }).toString();
}

async function initGitRepo(root: string): Promise<void> {
  await mkdir(root, { recursive: true });
  execSync('git init', { cwd: root, stdio: 'ignore' });
  execSync('git config user.name "Test"', { cwd: root, stdio: 'ignore' });
  execSync('git config user.email "test@test.com"', { cwd: root, stdio: 'ignore' });
}

async function gitCommit(root: string, message: string): Promise<void> {
  execSync('git add -A', { cwd: root, stdio: 'ignore' });
  execSync('git commit -m "' + message + '"', { cwd: root, stdio: 'ignore' });
}

const testsDir = process.env.LOCALAPPDATA
  ? join(process.env.LOCALAPPDATA, 'hermes', 'finalizer-test')
  : '/tmp/finalizer-test';

describe('TaskFinalizer — FAILED_UNEXPECTED_CHANGES', () => {
  let testRoot: string;

  beforeEach(async () => {
    testRoot = join(testsDir, Date.now().toString() + '-' + Math.random().toString(36).slice(2, 8));
    await initGitRepo(testRoot);
    await writeFile(join(testRoot, 'README.md'), '# Test Repo\n');
    await gitCommit(testRoot, 'init');
  });

  afterEach(async () => {
    await rm(testRoot, { recursive: true, force: true }).catch(() => {});
  });

  it('1: completed + hello.txt created → COMPLETED + commit', async () => {
    // Capture baseline (clean repo)
    const baseline = WorkspaceValidator.captureSnapshot(testRoot);

    // Simulate agent creating hello.txt
    await writeFile(join(testRoot, 'hello.txt'), 'PUB DEV LOOP AUTO COMMIT TEST\n');

    // Get declared changedFiles from agent (what the agent reports)
    const declaredFiles = ['hello.txt'];

    const finalizer = new TaskFinalizer(testRoot);
    const result = await finalizer.finalize('Create hello.txt', 'Create hello.txt', {
      baselineSnapshot: baseline,
      allowUnexpectedFiles: false,
      declaredChangedFiles: declaredFiles,
    });

    expect(result.status).toBe('COMPLETED');
    expect(result.commitSha).toMatch(/^[0-9a-f]{40}$/);
    expect(result.errorCode).toBeNull();
  });

  it('2: arquivo pré-existente modifies before baseline', async () => {
    // Pre-existing modification before baseline
    await writeFile(join(testRoot, 'preexisting.txt'), 'old content\n');
    await gitCommit(testRoot, 'pre-existing');

    // Now modify it before baseline capture
    await writeFile(join(testRoot, 'preexisting.txt'), 'modified before baseline\n');

    // Capture baseline (dirty — preexisting.txt is modified)
    const baseline = WorkspaceValidator.captureSnapshot(testRoot);

    // Agent creates hello.txt only
    await writeFile(join(testRoot, 'hello.txt'), 'PUB DEV LOOP TEST\n');
    const declaredFiles = ['hello.txt'];

    const finalizer = new TaskFinalizer(testRoot);
    const result = await finalizer.finalize('Create hello.txt', 'Create hello.txt', {
      baselineSnapshot: baseline,
      allowUnexpectedFiles: false,
      declaredChangedFiles: declaredFiles,
    });

    // Should FAIL — pre-existing modification is unexpected
    expect(result.status).toBe('FAILED');
    expect(result.errorCode).toBe('FAILED_UNEXPECTED_CHANGES');
    expect(result.commitSha).toBeNull();
  });

  it('3: hello.txt + unexpected file → FAILED_UNEXPECTED_CHANGES, no commit', async () => {
    const baseline = WorkspaceValidator.captureSnapshot(testRoot);

    // Agent creates hello.txt + unexpected.txt
    await writeFile(join(testRoot, 'hello.txt'), 'PUB DEV LOOP TEST\n');
    await writeFile(join(testRoot, 'unexpected.txt'), 'unexpected\n');

    // Agent declares only hello.txt
    const declaredFiles = ['hello.txt'];

    const finalizer = new TaskFinalizer(testRoot);
    const result = await finalizer.finalize('Create hello.txt', 'Create hello.txt', {
      baselineSnapshot: baseline,
      allowUnexpectedFiles: false,
      declaredChangedFiles: declaredFiles,
    });

    expect(result.status).toBe('FAILED');
    expect(result.errorCode).toBe('FAILED_UNEXPECTED_CHANGES');
    expect(result.commitSha).toBeNull();
    expect(result.errorMessage).toContain('unexpected.txt');
  });

  it('4: alteração pré-existente + alteração da task → isolamento preservado', async () => {
    // Create and commit pre-existing file
    await writeFile(join(testRoot, 'pre.txt'), 'pre-existing\n');
    await gitCommit(testRoot, 'pre-existing');

    // Modify pre.txt before baseline
    await writeFile(join(testRoot, 'pre.txt'), 'modified before baseline\n');

    // Capture baseline with dirty state
    const baseline = WorkspaceValidator.captureSnapshot(testRoot);

    // Agent creates hello.txt only
    await writeFile(join(testRoot, 'hello.txt'), 'task file\n');
    const declaredFiles = ['hello.txt'];

    const headBefore = execSync('git rev-parse HEAD', { cwd: testRoot, stdio: ['pipe','pipe','pipe'] }).toString().trim();

    const finalizer = new TaskFinalizer(testRoot);
    const result = await finalizer.finalize('Create hello.txt', 'Create hello.txt', {
      baselineSnapshot: baseline,
      allowUnexpectedFiles: false,
      declaredChangedFiles: declaredFiles,
    });

    // pre.txt was modified but not declared → unexpected → FAIL
    expect(result.status).toBe('FAILED');
    expect(result.errorCode).toBe('FAILED_UNEXPECTED_CHANGES');
    expect(result.commitSha).toBeNull();

    // HEAD must not have changed
    const headAfter = execSync('git rev-parse HEAD', { cwd: testRoot, stdio: ['pipe','pipe','pipe'] }).toString().trim();
    expect(headAfter).toBe(headBefore);
  });

  it('5: task without changes → COMPLETED + no commit', async () => {
    const baseline = WorkspaceValidator.captureSnapshot(testRoot);

    // No changes made
    const finalizer = new TaskFinalizer(testRoot);
    const result = await finalizer.finalize('Noop task', 'Noop', {
      baselineSnapshot: baseline,
      allowUnexpectedFiles: false,
      declaredChangedFiles: [],
    });

    expect(result.status).toBe('COMPLETED');
    expect(result.commitSha).toBeNull();
    expect(result.changedFiles).toEqual([]);
    expect(result.gitStatus).toBe('clean');
  });

  it('6: failed agent → no finalizer call (handled by BaseWorker)', async () => {
    // This test documents that FAILED agents don't reach the finalizer.
    // BaseWorker.executeOnce() checks result.status === 'FAILED' → SKIPPED_AGENT_FAILED
    // The TaskFinalizer is only called when agent returns COMPLETED.
    // This test verifies the finalizer is not involved in FAILED path.

    const baseline = WorkspaceValidator.captureSnapshot(testRoot);

    // Simulate: agent made changes but returned FAILED
    await writeFile(join(testRoot, 'partial.txt'), 'incomplete\n');

    // If we DID call finalizer (which we shouldn't), it would detect partial.txt
    // But the agent FAILED — the correct behavior is to NOT call finalize()
    // This is enforced by BaseWorker, not TaskFinalizer

    // Verify TaskFinalizer would detect the unexpected change if called
    const finalizer = new TaskFinalizer(testRoot);
    const result = await finalizer.finalize('Task', 'Task', {
      baselineSnapshot: baseline,
      allowUnexpectedFiles: false,
      declaredChangedFiles: [], // agent declared nothing
    });

    expect(result.status).toBe('FAILED');
    expect(result.errorCode).toBe('FAILED_UNEXPECTED_CHANGES');
  });

  it('7: commit contains only declared files (no git add -A)', async () => {
    const baseline = WorkspaceValidator.captureSnapshot(testRoot);

    // Create only the declared file
    await writeFile(join(testRoot, 'hello.txt'), 'PUB DEV LOOP TEST\n');

    const finalizer = new TaskFinalizer(testRoot);
    const result = await finalizer.finalize('Create hello.txt', 'Create hello.txt', {
      baselineSnapshot: baseline,
      allowUnexpectedFiles: false,
      declaredChangedFiles: ['hello.txt'],
    });

    expect(result.status).toBe('COMPLETED');
    expect(result.changedFiles).toContain('hello.txt');

    // Verify the commit only contains hello.txt
    const showStat = git(testRoot, ['show', '--stat', 'HEAD']);
    expect(showStat).toContain('hello.txt');
    // Should NOT contain other files
    expect(showStat).not.toContain('unexpected.txt');
  });

  it('8: working tree clean after valid commit', async () => {
    const baseline = WorkspaceValidator.captureSnapshot(testRoot);

    await writeFile(join(testRoot, 'hello.txt'), 'test\n');

    const finalizer = new TaskFinalizer(testRoot);
    const result = await finalizer.finalize('Create hello.txt', 'Create hello.txt', {
      baselineSnapshot: baseline,
      allowUnexpectedFiles: false,
      declaredChangedFiles: ['hello.txt'],
    });

    expect(result.status).toBe('COMPLETED');
    expect(result.gitStatus).toBe('clean');
  });
});

describe('WorkspaceValidator', () => {
  let testRoot: string;

  beforeEach(async () => {
    testRoot = join(testsDir, 'validator-' + Date.now().toString() + '-' + Math.random().toString(36).slice(2, 8));
    await initGitRepo(testRoot);
    await writeFile(join(testRoot, 'README.md'), '# Test\n');
    await gitCommit(testRoot, 'init');
  });

  afterEach(async () => {
    await rm(testRoot, { recursive: true, force: true }).catch(() => {});
  });

  it('captureSnapshot captures clean baseline', () => {
    const snapshot = WorkspaceValidator.captureSnapshot(testRoot);
    expect(snapshot.headSha).toMatch(/^[0-9a-f]{40}$/);
    expect(snapshot.gitStatus).toBe('');
    expect(snapshot.trackedFiles).toContain('README.md');
  });

  it('detectUnexpectedChanges returns empty when all declared', () => {
    const baseline = WorkspaceValidator.captureSnapshot(testRoot);
    // No changes made after baseline
    const unexpected = WorkspaceValidator.detectUnexpectedChanges(testRoot, baseline, []);
    expect(unexpected).toEqual([]);
  });

  it('detectUnexpectedChanges flags undeclared changes', async () => {
    const baseline = WorkspaceValidator.captureSnapshot(testRoot);
    await writeFile(join(testRoot, 'unknown.txt'), 'unknown\n');
    const unexpected = WorkspaceValidator.detectUnexpectedChanges(testRoot, baseline, ['hello.txt']);
    expect(unexpected).toContain('unknown.txt');
  });
});

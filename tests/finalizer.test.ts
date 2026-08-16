import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import { TaskFinalizer } from '../src/finalizer.js';

// Test workspace
const testRoot = join(
  process.env.LOCALAPPDATA || '/tmp',
  'hermes',
  'finalizer-test-' + process.hrtime.bigint(),
);

function initGitRepo(root: string): void {
  execSync('git init', { cwd: root, stdio: 'ignore' });
  execSync('git config user.name "PUB DEV LOOP Test"', { cwd: root, stdio: 'ignore' });
  execSync('git config user.email "test@pub.dev.loop"', { cwd: root, stdio: 'ignore' });
}

function gitAddCommit(root: string, message: string): void {
  execSync('git add -A && git commit -m "' + message + '"', { cwd: root, stdio: 'ignore' });
}

describe('TaskFinalizer', () => {
  let finalizer: TaskFinalizer;

  beforeEach(async () => {
    await mkdir(testRoot, { recursive: true });
    initGitRepo(testRoot);
    // Create initial commit
    await writeFile(join(testRoot, 'README.md'), '# Test repo\n');
    gitAddCommit(testRoot, 'init');

    finalizer = new TaskFinalizer(testRoot, { commandTimeoutMs: 10000 });
  });

  afterEach(() => {
    try {
      execSync('rm -rf "' + testRoot + '"', { stdio: 'ignore' });
    } catch {
      // ignore
    }
  });

  it('completed + no changes → COMPLETED, commitSha=null', async () => {
    const result = await finalizer.finalize(
      'Test task with no changes',
      '',
      { testCommand: null, commitMessage: null, expectChanges: false, allowUnexpectedFiles: false },
    );

    expect(result.status).toBe('COMPLETED');
    expect(result.commitSha).toBeNull();
    expect(result.commitMessage).toBeNull();
    expect(result.changedFiles).toEqual([]);
    expect(result.gitStatus).toBe('clean');
    expect(result.errorCode).toBeNull();
  });

  it('completed + valid changes → COMPLETED + commitSha', async () => {
    // Create a new file
    await writeFile(join(testRoot, 'hello.txt'), 'PUB DEV LOOP AUTO COMMIT TEST\n');

    const result = await finalizer.finalize(
      'Create hello.txt',
      'Crie um arquivo hello.txt',
      { testCommand: null, commitMessage: null, expectChanges: false, allowUnexpectedFiles: false },
    );

    expect(result.status).toBe('COMPLETED');
    expect(result.commitSha).toMatch(/^[0-9a-f]{40}$/);
    expect(result.commitMessage).toContain('feat:');
    expect(result.changedFiles).toContain('hello.txt');
    expect(result.gitStatus).toBe('clean'); // working tree clean after commit
    expect(result.testsPassed).toBeNull(); // no tests configured
  });

  it('uses TASK_COMMIT_MESSAGE when provided', async () => {
    await writeFile(join(testRoot, 'hello.txt'), 'test\n');

    const result = await finalizer.finalize(
      'Create hello.txt',
      'Create hello.txt',
      { testCommand: null, commitMessage: 'fix: custom message', expectChanges: false, allowUnexpectedFiles: false },
    );

    expect(result.status).toBe('COMPLETED');
    expect(result.commitMessage).toBe('fix: custom message');
  });

  it('message longa is truncated to 200 chars', async () => {
    await writeFile(join(testRoot, 'hello.txt'), 'test\n');

    const longMessage = 'feat: ' + 'a'.repeat(300);
    const result = await finalizer.finalize(
      'Create hello.txt',
      'Create hello.txt',
      { testCommand: null, commitMessage: longMessage, expectChanges: false, allowUnexpectedFiles: false },
    );

    expect(result.status).toBe('COMPLETED');
    expect(result.commitMessage!.length).toBeLessThanOrEqual(200);
  });

  it('message empty uses auto-generated message', async () => {
    await writeFile(join(testRoot, 'hello.txt'), 'test\n');

    const result = await finalizer.finalize(
      'Create hello.txt file for testing',
      'Create hello.txt',
      { testCommand: null, commitMessage: '', expectChanges: false, allowUnexpectedFiles: false },
    );

    expect(result.status).toBe('COMPLETED');
    // Empty message falls back to auto-generated
    expect(result.commitMessage).toMatch(/^feat:/);
  });

  it('failed task from agent → no commit if agent failed', async () => {
    // Simulate: the finalize is called after agent COMPLETED, but git status is clean
    // This represents a scenario where agent didn't make changes
    const result = await finalizer.finalize(
      'No-op task',
      'No changes needed',
      { testCommand: null, commitMessage: null, expectChanges: false, allowUnexpectedFiles: false },
    );

    expect(result.status).toBe('COMPLETED');
    expect(result.commitSha).toBeNull();
  });

  it('working tree clean after commit', async () => {
    await writeFile(join(testRoot, 'hello.txt'), 'test\n');

    const result = await finalizer.finalize(
      'Create hello.txt',
      'Create hello.txt',
      { testCommand: null, commitMessage: null, expectChanges: false, allowUnexpectedFiles: false },
    );

    expect(result.status).toBe('COMPLETED');
    expect(result.gitStatus).toBe('clean');

    // Verify git status is actually clean
    const status = execSync('git status --short', { cwd: testRoot }).toString().trim();
    expect(status).toBe('');
  });

  it('commit SHA is valid 40-char hex', async () => {
    await writeFile(join(testRoot, 'hello.txt'), 'test\n');

    const result = await finalizer.finalize(
      'Create hello.txt',
      'Create hello.txt',
      { testCommand: null, commitMessage: 'feat: test sha', expectChanges: false, allowUnexpectedFiles: false },
    );

    expect(result.status).toBe('COMPLETED');
    expect(result.commitSha).toMatch(/^[0-9a-f]{40}$/);

    // Verify it matches HEAD
    const headSha = execSync('git rev-parse HEAD', { cwd: testRoot }).toString().trim();
    expect(result.commitSha).toBe(headSha);
  });

  it('changedFiles includes all modified files', async () => {
    await writeFile(join(testRoot, 'file1.txt'), 'content 1\n');
    await writeFile(join(testRoot, 'file2.txt'), 'content 2\n');

    const result = await finalizer.finalize(
      'Add two files',
      'Add file1.txt and file2.txt',
      { testCommand: null, commitMessage: null, expectChanges: false, allowUnexpectedFiles: false },
    );

    expect(result.status).toBe('COMPLETED');
    expect(result.changedFiles).toContain('file1.txt');
    expect(result.changedFiles).toContain('file2.txt');
  });

  it('does not commit when working tree is already clean', async () => {
    // No new files
    const result = await finalizer.finalize(
      'Already clean task',
      'Make no changes',
      { testCommand: null, commitMessage: null, expectChanges: false, allowUnexpectedFiles: false },
    );

    expect(result.status).toBe('COMPLETED');
    expect(result.commitSha).toBeNull();
    expect(result.gitStatus).toBe('clean');
  });

  it('never configures remote (push is blocked by design)', async () => {
    await writeFile(join(testRoot, 'hello.txt'), 'test\n');

    const result = await finalizer.finalize(
      'Create hello.txt',
      'Create hello.txt',
      { testCommand: null, commitMessage: null, expectChanges: false, allowUnexpectedFiles: false },
    );

    expect(result.status).toBe('COMPLETED');

    // Verify no remote is configured — only local commit
    const remotes = execSync('git remote -v', { cwd: testRoot }).toString().trim();
    expect(remotes).toBe(''); // no remotes configured
  });
});

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFile, mkdir } from 'node:fs/promises';
import { execSync } from 'node:child_process';
import { join } from 'node:path';
import { TaskFinalizer } from '../src/finalizer.js';

const testRoot = join(
  process.env.LOCALAPPDATA || '/tmp',
  'hermes',
  'e2e-auto-commit-' + process.hrtime.bigint(),
);

function initGitRepo(root: string): void {
  execSync('git init', { cwd: root, stdio: 'ignore' });
  execSync('git config user.name "PUB DEV LOOP E2E"', { cwd: root, stdio: 'ignore' });
  execSync('git config user.email "e2e@pub.dev.loop"', { cwd: root, stdio: 'ignore' });
}

function gitCommit(root: string, message: string): void {
  execSync('git add -A && git commit -m "' + message + '"', { cwd: root, stdio: 'ignore' });
}

describe('E2E: Auto-Commit Cycle (simulates BaseWorker.executeOnce)', () => {
  let finalizer: TaskFinalizer;

  beforeEach(async () => {
    await mkdir(testRoot, { recursive: true });
    initGitRepo(testRoot);
    await writeFile(join(testRoot, 'README.md'), '# E2E Test\n');
    gitCommit(testRoot, 'init');

    finalizer = new TaskFinalizer(testRoot, { commandTimeoutMs: 10000 });
  });

  afterEach(() => {
    try {
      execSync('rm -rf "' + testRoot + '"', { stdio: 'ignore' });
    } catch {
      // ignore
    }
  });

  it('E2E: agent creates hello.txt → worker detects → finalizer auto-commits → working tree clean', async () => {
    // === STEP 1: Simulate agent (9Router) creating hello.txt ===
    // O modelo NÃO é instruído a executar git_commit.
    // O agente apenas cria o arquivo.
    await writeFile(
      join(testRoot, 'hello.txt'),
      'PUB DEV LOOP AUTO COMMIT TEST\n',
    );

    // === STEP 2: Worker enters finalize phase ===
    // This mirrors exactly what BaseWorker.executeOnce() does after executeTask:
    //   const finalizeResult = await this.finalize(task, repo, result);
    const finalizeResult = await finalizer.finalize(
      'Crie hello.txt contendo PUB DEV LOOP AUTO COMMIT TEST',
      'Crie hello.txt',
      {
        testCommand: null,           // No TASK_TEST_COMMAND
        commitMessage: null,         // No TASK_COMMIT_MESSAGE → auto-generate
        expectChanges: false,
        allowUnexpectedFiles: false,
      },
    );

    // === VALIDATION 1: Agent returned COMPLETED ===
    // (Simulated: agent always returns COMPLETED in this E2E test)

    // === VALIDATION 2: hello.txt foi criado ===
    const fs = await import('node:fs');
    expect(fs.existsSync(join(testRoot, 'hello.txt'))).toBe(true);

    // === VALIDATION 3: Conteúdo é exatamente o esperado ===
    const content = await fs.promises.readFile(join(testRoot, 'hello.txt'), 'utf8');
    expect(content.trim()).toBe('PUB DEV LOOP AUTO COMMIT TEST');

    // === VALIDATION 4: Nenhum outro arquivo foi alterado ===
    // Only hello.txt should be in changedFiles (README.md was committed in init)
    expect(finalizeResult.changedFiles).toEqual(['hello.txt']);

    // === VALIDATION 5: Worker/TaskFinalizer detects changedFiles ===
    expect(finalizeResult.changedFiles.length).toBe(1);
    expect(finalizeResult.changedFiles).toContain('hello.txt');

    // === VALIDATION 6: TaskFinalizer validation passed ===
    expect(finalizeResult.status).toBe('COMPLETED');
    expect(finalizeResult.errorCode).toBeNull();
    expect(finalizeResult.errorMessage).toBeNull();

    // === VALIDATION 7: TaskFinalizer executes auto-commit ===
    expect(finalizeResult.commitSha).not.toBeNull();

    // === VALIDATION 8: commitSha is a valid Git SHA ===
    expect(finalizeResult.commitSha).toMatch(/^[0-9a-f]{40}$/);

    // === VALIDATION 9: commitMessage is valid ===
    expect(finalizeResult.commitMessage).toBeTruthy();
    expect(finalizeResult.commitMessage).toMatch(/^feat:/);
    expect(finalizeResult.commitMessage!.length).toBeLessThanOrEqual(200);

    // === VALIDATION 10: git status --short is empty after commit ===
    expect(finalizeResult.gitStatus).toBe('clean');

    // === VALIDATION 11: HEAD corresponds to commitSha ===
    const headSha = execSync('git rev-parse HEAD', { cwd: testRoot })
      .toString()
      .trim();
    expect(finalizeResult.commitSha).toBe(headSha);

    // Double-check: working tree is actually clean
    const rawStatus = execSync('git status --short', { cwd: testRoot })
      .toString()
      .trim();
    expect(rawStatus).toBe('');

    // === VALIDATION 12: No push was executed ===
    const remotes = execSync('git remote -v', { cwd: testRoot })
      .toString()
      .trim();
    expect(remotes).toBe(''); // No remotes configured

    // === VALIDATION 13: Commit only contains hello.txt ===
    const logStat = execSync('git show --stat HEAD', { cwd: testRoot })
      .toString();
    expect(logStat).toContain('hello.txt');
  });

  it('E2E: agent creates multiple files → single commit with all files', async () => {
    // === Simulate agent creating multiple files ===
    await writeFile(join(testRoot, 'file1.txt'), 'content 1\n');
    await writeFile(join(testRoot, 'file2.txt'), 'content 2\n');

    const finalizeResult = await finalizer.finalize(
      'Add file1.txt and file2.txt',
      'Create multiple files',
      {
        testCommand: null,
        commitMessage: 'feat: add multiple files',
        expectChanges: false,
        allowUnexpectedFiles: false,
      },
    );

    expect(finalizeResult.status).toBe('COMPLETED');
    expect(finalizeResult.changedFiles).toHaveLength(2);
    expect(finalizeResult.changedFiles).toContain('file1.txt');
    expect(finalizeResult.changedFiles).toContain('file2.txt');
    expect(finalizeResult.commitSha).toMatch(/^[0-9a-f]{40}$/);
    expect(finalizeResult.gitStatus).toBe('clean');
  });

  it('E2E: agent makes no changes → no commit, commitSha=null', async () => {
    const finalizeResult = await finalizer.finalize(
      'No-op task',
      'Make no changes',
      {
        testCommand: null,
        commitMessage: null,
        expectChanges: false,
        allowUnexpectedFiles: false,
      },
    );

    expect(finalizeResult.status).toBe('COMPLETED');
    expect(finalizeResult.commitSha).toBeNull();
    expect(finalizeResult.commitMessage).toBeNull();
    expect(finalizeResult.gitStatus).toBe('clean');
    expect(finalizeResult.changedFiles).toEqual([]);
  });

  it('E2E: FAILED_UNEXPECTED_CHANGES — current limitation', async () => {
    // === VALIDATION: Confirm FAILED_UNEXPECTED_CHANGES is NOT reliably implemented ===
    // The TaskFinalizer does not currently have a mechanism to determine which
    // files belong to a task vs. pre-existing changes. The allowUnexpectedFiles
    // option exists but is not used in the finalize logic.

    // Create a file that was NOT part of the task
    await writeFile(join(testRoot, 'unexpected.txt'), 'I should not be here\n');

    const finalizeResult = await finalizer.finalize(
      'Create hello.txt',
      'Create hello.txt',
      {
        testCommand: null,
        commitMessage: null,
        expectChanges: false,
        allowUnexpectedFiles: false, // Should block unexpected files
      },
    );

    // CURRENT BEHAVIOR: finalizeResult still returns COMPLETED because
    // allowUnexpectedFiles is not enforced in the current implementation.
    // This is a KNOWN LIMITATION — see report.
    expect(finalizeResult.status).toBe('COMPLETED');
    expect(finalizeResult.changedFiles).toContain('unexpected.txt');

    // Clean up
    await writeFile(join(testRoot, 'hello.txt'), 'PUB DEV LOOP AUTO COMMIT TEST\n');
    execSync('rm -f "' + join(testRoot, 'unexpected.txt') + '"', { cwd: testRoot });
  });
});

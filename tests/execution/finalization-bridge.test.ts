/**
 * Phase 3A.3 — Unit tests for FinalizationBridge.
 *
 * Covers:
 * 1. COMPLETED execution → calls TaskFinalizer and attaches COMPLETED finalization
 * 2. FAILED execution → does NOT call TaskFinalizer, leaves finalization undefined
 * 3. Workspace authority → passes exactly execution.workspace to TaskFinalizer
 * 4. Declared changedFiles → passes execution.changedFiles as declaredChangedFiles
 * 5. Finalization failure propagation → propagates FAILED finalization (e.g. TASK_TESTS_FAILED)
 * 6. Unexpected files detection failure → propagates FAILED_UNEXPECTED_CHANGES
 * 7. No-op completion → clean working tree returns COMPLETED with commitSha: null
 * 8. Exception safety → catches finalizer throws and wraps in standardized FINALIZATION_ERROR FinalizeResult
 * 9. Empty/invalid workspace → returns FAILED FinalizeResult with FINALIZATION_ERROR without calling factory
 * 10. SpecIdentity invariance → preserves specIdentity intact without mutation
 * 11. Context fallback → prompt falls back to objective if prompt not provided
 * 12. Immutability → does not mutate input executionResult
 * 13. Integration with real TaskFinalizer on local git repo (auto-commit)
 * 14. Integration with real TaskFinalizer on local git repo (no-op)
 * 15. Integration with real TaskFinalizer detecting unexpected changes against baseline
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import {
  DefaultFinalizationBridge,
  type FinalizationContext,
} from '../../src/execution/finalization-bridge.js';
import type { ExecutionResult } from '../../src/execution/execution-engine.js';
import { WorkspaceValidator, type FinalizeResult } from '../../src/finalizer.js';

const testsDir = process.env.LOCALAPPDATA
  ? join(process.env.LOCALAPPDATA, 'hermes', 'finalization-bridge-test')
  : '/tmp/finalization-bridge-test';

function initGitRepo(root: string): void {
  execSync('git init', { cwd: root, stdio: 'ignore' });
  execSync('git config user.name "Test"', { cwd: root, stdio: 'ignore' });
  execSync('git config user.email "test@test.com"', { cwd: root, stdio: 'ignore' });
}

function gitCommit(root: string, message: string): void {
  execSync('git add -A', { cwd: root, stdio: 'ignore' });
  execSync('git commit -m "' + message + '"', { cwd: root, stdio: 'ignore' });
}

describe('FinalizationBridge (Phase 3A.3)', () => {
  const sampleExecutionResult: ExecutionResult = {
    execution: {
      status: 'COMPLETED',
      provider: '9router',
      model: 'anthropic/claude-3.5-haiku',
      workspace: '/tmp/workspaces/sample-ws',
      changedFiles: ['src/app.ts'],
      durationMs: 3400,
      errorCode: null,
      errorMessage: null,
    },
    finalization: undefined,
    specIdentity: {
      specVersion: '1.0.0',
      taskId: 'TASK-101',
      lineage: {
        intakeVersion: '1.0.0',
        intakeHash: 'hash-xyz',
        source: 'api-request',
        createdAt: '2026-09-11T08:00:00.000Z',
      },
    },
  };

  it('1: COMPLETED execution → calls finalizer and returns finalization with COMPLETED', async () => {
    const mockFinalize = vi.fn().mockResolvedValue({
      status: 'COMPLETED',
      commitSha: 'commit-sha-123',
      commitMessage: 'feat: implement app',
      changedFiles: ['src/app.ts'],
      gitStatus: 'clean',
      testsPassed: true,
      testOutput: 'OK',
      errorCode: null,
      errorMessage: null,
    } as FinalizeResult);

    const bridge = new DefaultFinalizationBridge(() => ({ finalize: mockFinalize }));

    const result = await bridge.finalize(sampleExecutionResult, {
      objective: 'Implement app',
      prompt: 'Write src/app.ts',
    });

    expect(mockFinalize).toHaveBeenCalledTimes(1);
    expect(result.execution.status).toBe('COMPLETED');
    expect(result.finalization).toBeDefined();
    expect(result.finalization?.status).toBe('COMPLETED');
    expect(result.finalization?.commitSha).toBe('commit-sha-123');
  });

  it('2: FAILED execution → does NOT call finalizer, leaves finalization undefined', async () => {
    const mockFinalize = vi.fn();
    const bridge = new DefaultFinalizationBridge(() => ({ finalize: mockFinalize }));

    const failedExecution: ExecutionResult = {
      ...sampleExecutionResult,
      execution: {
        ...sampleExecutionResult.execution,
        status: 'FAILED',
        errorCode: 'PROVIDER_ERROR',
        errorMessage: 'Provider failed',
      },
    };

    const result = await bridge.finalize(failedExecution, {
      objective: 'Implement app',
    });

    expect(mockFinalize).not.toHaveBeenCalled();
    expect(result.execution.status).toBe('FAILED');
    expect(result.finalization).toBeUndefined();
    expect(result.specIdentity).toEqual(sampleExecutionResult.specIdentity);
  });

  it('3: Workspace authority → passes exactly execution.workspace to finalizer factory', async () => {
    let capturedWorkspace: string | undefined;
    const bridge = new DefaultFinalizationBridge((ws) => {
      capturedWorkspace = ws;
      return {
        finalize: vi.fn().mockResolvedValue({
          status: 'COMPLETED',
          commitSha: 'sha-1',
          commitMessage: 'msg',
          changedFiles: [],
          gitStatus: 'clean',
          testsPassed: null,
          testOutput: '',
          errorCode: null,
          errorMessage: null,
        } as FinalizeResult),
      };
    });

    await bridge.finalize(sampleExecutionResult, {
      objective: 'Check workspace',
    });

    expect(capturedWorkspace).toBe(sampleExecutionResult.execution.workspace);
  });

  it('4: Declared changedFiles → passes execution.changedFiles as declaredChangedFiles in FinalizeOptions', async () => {
    const mockFinalize = vi.fn().mockResolvedValue({
      status: 'COMPLETED',
      commitSha: 'sha-2',
      commitMessage: 'msg',
      changedFiles: ['src/app.ts'],
      gitStatus: 'clean',
      testsPassed: null,
      testOutput: '',
      errorCode: null,
      errorMessage: null,
    } as FinalizeResult);

    const bridge = new DefaultFinalizationBridge(() => ({ finalize: mockFinalize }));

    await bridge.finalize(sampleExecutionResult, {
      objective: 'Test options',
      allowUnexpectedFiles: false,
    });

    expect(mockFinalize).toHaveBeenCalledWith(
      'Test options',
      'Test options',
      expect.objectContaining({
        declaredChangedFiles: ['src/app.ts'],
        allowUnexpectedFiles: false,
      }),
    );
  });

  it('5: Finalization failure propagation → propagates FAILED finalization (e.g. TASK_TESTS_FAILED)', async () => {
    const mockFinalize = vi.fn().mockResolvedValue({
      status: 'FAILED',
      commitSha: null,
      commitMessage: null,
      changedFiles: ['src/app.ts'],
      gitStatus: 'modified',
      testsPassed: false,
      testOutput: 'Test failure: 1 failed',
      errorCode: 'TASK_TESTS_FAILED',
      errorMessage: 'Tests failed (exit code 1)',
    } as FinalizeResult);

    const bridge = new DefaultFinalizationBridge(() => ({ finalize: mockFinalize }));

    const result = await bridge.finalize(sampleExecutionResult, {
      objective: 'Run failing tests',
    });

    expect(result.execution.status).toBe('COMPLETED');
    expect(result.finalization?.status).toBe('FAILED');
    expect(result.finalization?.errorCode).toBe('TASK_TESTS_FAILED');
    expect(result.finalization?.commitSha).toBeNull();
  });

  it('6: Unexpected files detection failure → propagates FAILED_UNEXPECTED_CHANGES', async () => {
    const mockFinalize = vi.fn().mockResolvedValue({
      status: 'FAILED',
      commitSha: null,
      commitMessage: null,
      changedFiles: ['src/app.ts', 'unexpected.ts'],
      gitStatus: 'modified',
      testsPassed: null,
      testOutput: '',
      errorCode: 'FAILED_UNEXPECTED_CHANGES',
      errorMessage: 'Unexpected changes detected: unexpected.ts',
    } as FinalizeResult);

    const bridge = new DefaultFinalizationBridge(() => ({ finalize: mockFinalize }));

    const result = await bridge.finalize(sampleExecutionResult, {
      objective: 'Detect unexpected files',
    });

    expect(result.finalization?.status).toBe('FAILED');
    expect(result.finalization?.errorCode).toBe('FAILED_UNEXPECTED_CHANGES');
  });

  it('7: No-op completion → clean working tree returns COMPLETED with commitSha: null', async () => {
    const mockFinalize = vi.fn().mockResolvedValue({
      status: 'COMPLETED',
      commitSha: null,
      commitMessage: null,
      changedFiles: [],
      gitStatus: 'clean',
      testsPassed: null,
      testOutput: '',
      errorCode: null,
      errorMessage: null,
    } as FinalizeResult);

    const bridge = new DefaultFinalizationBridge(() => ({ finalize: mockFinalize }));

    const noopExecution: ExecutionResult = {
      ...sampleExecutionResult,
      execution: {
        ...sampleExecutionResult.execution,
        changedFiles: [],
      },
    };

    const result = await bridge.finalize(noopExecution, {
      objective: 'Noop operation',
    });

    expect(result.finalization?.status).toBe('COMPLETED');
    expect(result.finalization?.commitSha).toBeNull();
    expect(result.finalization?.changedFiles).toEqual([]);
  });

  it('8: Exception safety → catches finalizer throws and wraps in standardized FINALIZATION_ERROR FinalizeResult', async () => {
    const bridge = new DefaultFinalizationBridge(() => ({
      finalize: vi.fn().mockRejectedValue(new Error('Git crash or spawn error')),
    }));

    const result = await bridge.finalize(sampleExecutionResult, {
      objective: 'Throwing finalizer',
    });

    expect(result.execution.status).toBe('COMPLETED');
    expect(result.finalization).toEqual({
      status: 'FAILED',
      commitSha: null,
      commitMessage: null,
      changedFiles: [],
      gitStatus: '',
      testsPassed: null,
      testOutput: '',
      errorCode: 'FINALIZATION_ERROR',
      errorMessage: 'Git crash or spawn error',
    });
  });

  it('9: Empty/invalid workspace → returns FAILED FinalizeResult with FINALIZATION_ERROR without calling factory', async () => {
    const mockFactory = vi.fn();
    const bridge = new DefaultFinalizationBridge(mockFactory);

    const invalidWsExecution: ExecutionResult = {
      ...sampleExecutionResult,
      execution: {
        ...sampleExecutionResult.execution,
        workspace: '   ',
      },
    };

    const result = await bridge.finalize(invalidWsExecution, {
      objective: 'Empty ws',
    });

    expect(mockFactory).not.toHaveBeenCalled();
    expect(result.finalization).toEqual({
      status: 'FAILED',
      commitSha: null,
      commitMessage: null,
      changedFiles: [],
      gitStatus: '',
      testsPassed: null,
      testOutput: '',
      errorCode: 'FINALIZATION_ERROR',
      errorMessage: 'ExecutionOutcome workspace is missing or empty',
    });
  });

  it('10: SpecIdentity invariance → preserves specIdentity intact without mutation', async () => {
    const bridge = new DefaultFinalizationBridge(() => ({
      finalize: vi.fn().mockResolvedValue({
        status: 'COMPLETED',
        commitSha: 'sha',
      } as FinalizeResult),
    }));

    const result = await bridge.finalize(sampleExecutionResult, {
      objective: 'Check spec identity',
    });

    expect(result.specIdentity).toEqual(sampleExecutionResult.specIdentity);
  });

  it('11: Context fallback → prompt falls back to objective if prompt not provided', async () => {
    const mockFinalize = vi.fn().mockResolvedValue({
      status: 'COMPLETED',
      commitSha: 'sha-3',
    } as FinalizeResult);

    const bridge = new DefaultFinalizationBridge(() => ({ finalize: mockFinalize }));

    await bridge.finalize(sampleExecutionResult, {
      objective: 'Only objective provided',
    });

    expect(mockFinalize).toHaveBeenCalledWith(
      'Only objective provided',
      'Only objective provided',
      expect.anything(),
    );
  });

  it('12: Immutability → does not mutate input executionResult object', async () => {
    const bridge = new DefaultFinalizationBridge(() => ({
      finalize: vi.fn().mockResolvedValue({
        status: 'COMPLETED',
        commitSha: 'sha-4',
      } as FinalizeResult),
    }));

    const frozenInput = Object.freeze({
      ...sampleExecutionResult,
      execution: Object.freeze({ ...sampleExecutionResult.execution }),
      specIdentity: Object.freeze({ ...sampleExecutionResult.specIdentity }),
    });

    const result = await bridge.finalize(frozenInput as ExecutionResult, {
      objective: 'Immutability test',
    });

    expect(result).not.toBe(frozenInput);
    expect(frozenInput.finalization).toBeUndefined();
    expect(result.finalization).toBeDefined();
  });
});

describe('FinalizationBridge — Integration with real TaskFinalizer', () => {
  let testRoot: string;

  beforeEach(async () => {
    testRoot = join(testsDir, 'bridge-' + Date.now().toString() + '-' + Math.random().toString(36).slice(2, 8));
    await mkdir(testRoot, { recursive: true });
    initGitRepo(testRoot);
    await writeFile(join(testRoot, 'README.md'), '# Initial\n');
    gitCommit(testRoot, 'initial commit');
  });

  afterEach(async () => {
    await rm(testRoot, { recursive: true, force: true }).catch(() => {});
  });

  it('13: real TaskFinalizer auto-commits modified files', async () => {
    const baseline = WorkspaceValidator.captureSnapshot(testRoot);

    // Simulate provider modifying a file
    await writeFile(join(testRoot, 'hello.txt'), 'Hello from bridge\n');

    const bridge = new DefaultFinalizationBridge(); // uses real TaskFinalizer
    const executionResult: ExecutionResult = {
      execution: {
        status: 'COMPLETED',
        provider: '9router',
        model: 'anthropic/claude-3.5-haiku',
        workspace: testRoot,
        changedFiles: ['hello.txt'],
        durationMs: 1500,
        errorCode: null,
        errorMessage: null,
      },
      specIdentity: {
        specVersion: '1.0.0',
        taskId: 'TASK-REAL-1',
        lineage: {
          intakeVersion: '1.0.0',
          intakeHash: 'intake-real-1',
          source: 'test',
          createdAt: '2026-09-11T08:00:00.000Z',
        },
      },
    };

    const result = await bridge.finalize(executionResult, {
      objective: 'Create hello file',
      baselineSnapshot: baseline,
    });

    expect(result.finalization?.status).toBe('COMPLETED');
    expect(result.finalization?.commitSha).toMatch(/^[0-9a-f]{40}$/);
    expect(result.finalization?.changedFiles).toContain('hello.txt');

    const gitLog = execSync('git log -n 1 --oneline', { cwd: testRoot }).toString();
    expect(gitLog).toContain('feat: Create hello file');
  });

  it('14: real TaskFinalizer handles clean workspace as no-op COMPLETED without commit', async () => {
    const baseline = WorkspaceValidator.captureSnapshot(testRoot);

    const bridge = new DefaultFinalizationBridge();
    const executionResult: ExecutionResult = {
      execution: {
        status: 'COMPLETED',
        provider: '9router',
        model: 'anthropic/claude-3.5-haiku',
        workspace: testRoot,
        changedFiles: [],
        durationMs: 100,
        errorCode: null,
        errorMessage: null,
      },
      specIdentity: {
        specVersion: '1.0.0',
        taskId: 'TASK-REAL-2',
        lineage: {
          intakeVersion: '1.0.0',
          intakeHash: 'intake-real-2',
          source: 'test',
          createdAt: '2026-09-11T08:00:00.000Z',
        },
      },
    };

    const result = await bridge.finalize(executionResult, {
      objective: 'No changes task',
      baselineSnapshot: baseline,
    });

    expect(result.finalization?.status).toBe('COMPLETED');
    expect(result.finalization?.commitSha).toBeNull();
    expect(result.finalization?.gitStatus).toBe('clean');
  });

  it('15: real TaskFinalizer detects unexpected file and fails closed', async () => {
    const baseline = WorkspaceValidator.captureSnapshot(testRoot);

    // Simulate provider creating two files, but only declaring one
    await writeFile(join(testRoot, 'declared.txt'), 'declared\n');
    await writeFile(join(testRoot, 'unexpected.txt'), 'unexpected\n');

    const bridge = new DefaultFinalizationBridge();
    const executionResult: ExecutionResult = {
      execution: {
        status: 'COMPLETED',
        provider: '9router',
        model: 'anthropic/claude-3.5-haiku',
        workspace: testRoot,
        changedFiles: ['declared.txt'], // unexpected.txt not declared
        durationMs: 1200,
        errorCode: null,
        errorMessage: null,
      },
      specIdentity: {
        specVersion: '1.0.0',
        taskId: 'TASK-REAL-3',
        lineage: {
          intakeVersion: '1.0.0',
          intakeHash: 'intake-real-3',
          source: 'test',
          createdAt: '2026-09-11T08:00:00.000Z',
        },
      },
    };

    const result = await bridge.finalize(executionResult, {
      objective: 'Detect unexpected file',
      baselineSnapshot: baseline,
      allowUnexpectedFiles: false,
    });

    expect(result.finalization?.status).toBe('FAILED');
    expect(result.finalization?.errorCode).toBe('FAILED_UNEXPECTED_CHANGES');
    expect(result.finalization?.commitSha).toBeNull();
  });
});

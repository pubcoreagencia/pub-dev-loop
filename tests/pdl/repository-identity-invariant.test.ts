/**
 * Comprehensive Verification Suite: Hard Repository Identity Invariant (CEO RECOVERY PROTOCOL).
 *
 * Mandatory Scenarios Tested (All with REAL Git CLI):
 * A: TASK=A, WORKSPACE=A -> ALLOW
 * B: TASK=A, WORKSPACE=B -> BLOCK (PROJECT_SCOPE_MISMATCH)
 * C: ACTIVE_PROJECT=B, TASK=A, WORKSPACE=A -> ALLOW (activeProject does not redirect)
 * D: TASK=A, WORKSPACE remote=B -> BLOCK
 * E: TASK=A, WORKSPACE without origin -> BLOCK (WORKSPACE_MISSING_REMOTE)
 * F: TASK=A, REMOTE=A -> first agent command permitted only after verification
 * G: TASK=A, ACTIVE_PROJECT=B, WORKSPACE=B -> BLOCK
 * H: TASK=A, PROJECT SCOPE MISMATCH -> BLOCK before any agent command is executed
 * I: REMOTE=A initially verified; REMOTE changed to B before execution -> BLOCK at Gate 2
 * J: workspacePath directory named B, but Git remote=A -> identity determined strictly by Git, not path
 * K: .git/config inconsistent or metadata divergent -> BLOCK
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execSync } from 'node:child_process';
import {
  canonicalizeRepository,
  inspectGitWorkspace,
  verifyRepositoryIdentity,
  RepositoryIdentityError,
} from '../../src/pdl/security/repository-identity.js';

function runGit(cmd: string, cwd: string): string {
  return execSync(cmd, {
    cwd,
    stdio: ['pipe', 'pipe', 'pipe'],
    encoding: 'utf8',
  }).trim();
}

function initRealGitRepo(path: string, remoteOrigin?: string): void {
  runGit('git init', path);
  runGit('git config user.name "PDL Security Test"', path);
  runGit('git config user.email "security@pubcore.internal"', path);
  if (remoteOrigin) {
    runGit(`git remote add origin ${remoteOrigin}`, path);
  }
  runGit('git commit --allow-empty -m "initial test commit"', path);
}

describe('CEO RECOVERY PROTOCOL — Hard Repository Identity Invariant', () => {
  let testTempDir: string;

  beforeEach(async () => {
    testTempDir = await mkdtemp(join(tmpdir(), 'pdl-repo-identity-test-'));
  });

  afterEach(async () => {
    if (testTempDir) {
      await rm(testTempDir, { recursive: true, force: true }).catch(() => {});
    }
  });

  describe('Canonicalization Subsystem', () => {
    it('canonicalizes SSH, HTTPS, HTTP, and simple strings to standard owner/repo format', () => {
      expect(canonicalizeRepository('git@github.com:pubcoreagencia/pub-dev-loop.git')).toBe('pubcoreagencia/pub-dev-loop');
      expect(canonicalizeRepository('https://github.com/pubcoreagencia/pub-dev-loop.git')).toBe('pubcoreagencia/pub-dev-loop');
      expect(canonicalizeRepository('https://github.com/pubcoreagencia/pub-dev-loop')).toBe('pubcoreagencia/pub-dev-loop');
      expect(canonicalizeRepository('pubcoreagencia/pub-dev-loop/')).toBe('pubcoreagencia/pub-dev-loop');
      expect(canonicalizeRepository('PUBCOREAGENCIA/PUB-DEV-LOOP')).toBe('pubcoreagencia/pub-dev-loop');
    });

    it('fails closed when repository string is empty or missing', () => {
      expect(() => canonicalizeRepository('')).toThrow(RepositoryIdentityError);
      expect(() => canonicalizeRepository('   ')).toThrow(RepositoryIdentityError);
      expect(() => canonicalizeRepository(null as any)).toThrow(RepositoryIdentityError);
    });
  });

  describe('Mandatory Incident Scenarios A through K', () => {
    // Scenario A: TASK=A, WORKSPACE=A -> ALLOW
    it('Scenario A: TASK=A, WORKSPACE=A -> ALLOW', async () => {
      const wsA = join(testTempDir, 'ws-a');
      await mkdir(wsA, { recursive: true });
      initRealGitRepo(wsA, 'https://github.com/pubcoreagencia/pub-dev-loop.git');

      const identity = verifyRepositoryIdentity({
        taskRepository: 'pubcoreagencia/pub-dev-loop',
        workspacePath: wsA,
        gate: 'Gate 1 (Post-Provisioning)',
      });

      expect(identity).toBeDefined();
      expect(identity.canonicalRemote).toBe('pubcoreagencia/pub-dev-loop');
      expect(identity.remoteOrigin).toBe('https://github.com/pubcoreagencia/pub-dev-loop.git');
    });

    // Scenario B: TASK=A, WORKSPACE=B -> BLOCK (PROJECT_SCOPE_MISMATCH)
    it('Scenario B: TASK=A, WORKSPACE=B -> BLOCK (PROJECT_SCOPE_MISMATCH)', async () => {
      const wsB = join(testTempDir, 'ws-b');
      await mkdir(wsB, { recursive: true });
      initRealGitRepo(wsB, 'https://github.com/pubcoreagencia/pubet.git');

      expect(() => {
        verifyRepositoryIdentity({
          taskRepository: 'pubcoreagencia/pub-dev-loop',
          workspacePath: wsB,
          gate: 'Gate 1 (Post-Provisioning)',
        });
      }).toThrowError(/PROJECT_SCOPE_MISMATCH/);
    });

    // Scenario C: ACTIVE_PROJECT=B, TASK=A, WORKSPACE=A -> ALLOW (activeProject does not redirect)
    it('Scenario C: ACTIVE_PROJECT=B, TASK=A, WORKSPACE=A -> ALLOW (activeProject cannot redirect)', async () => {
      const wsA = join(testTempDir, 'ws-a');
      await mkdir(wsA, { recursive: true });
      initRealGitRepo(wsA, 'https://github.com/pubcoreagencia/pub-dev-loop.git');

      const identity = verifyRepositoryIdentity({
        taskRepository: 'pubcoreagencia/pub-dev-loop',
        workspacePath: wsA,
        gate: 'Gate 1 (Post-Provisioning)',
        activeProject: 'buzios-de-cima', // Divergent active project
      });

      expect(identity.canonicalRemote).toBe('pubcoreagencia/pub-dev-loop');
    });

    // Scenario D: TASK=A, WORKSPACE remote=B -> BLOCK
    it('Scenario D: TASK=A, WORKSPACE remote=B -> BLOCK', async () => {
      const ws = join(testTempDir, 'ws-d');
      await mkdir(ws, { recursive: true });
      initRealGitRepo(ws, 'git@github.com:pubcoreagencia/xp-audio-lab.git');

      expect(() => {
        verifyRepositoryIdentity({
          taskRepository: 'git@github.com:pubcoreagencia/pub3d-landing.git',
          workspacePath: ws,
          gate: 'Gate 1 (Post-Provisioning)',
        });
      }).toThrowError(/PROJECT_SCOPE_MISMATCH.*xp-audio-lab.*EXECUTION_BLOCKED/);
    });

    // Scenario E: TASK=A, WORKSPACE without origin -> BLOCK (WORKSPACE_MISSING_REMOTE)
    it('Scenario E: TASK=A, WORKSPACE without origin -> BLOCK (WORKSPACE_MISSING_REMOTE)', async () => {
      const wsNoOrigin = join(testTempDir, 'ws-no-origin');
      await mkdir(wsNoOrigin, { recursive: true });
      initRealGitRepo(wsNoOrigin); // No origin added

      expect(() => {
        verifyRepositoryIdentity({
          taskRepository: 'pubcoreagencia/pub-dev-loop',
          workspacePath: wsNoOrigin,
          gate: 'Gate 1 (Post-Provisioning)',
        });
      }).toThrowError(/WORKSPACE_MISSING_REMOTE/);
    });

    // Scenario F: TASK=A, REMOTE=A -> first agent command permitted only after verification
    it('Scenario F: TASK=A, REMOTE=A -> first agent command permitted only after verification', async () => {
      const ws = join(testTempDir, 'ws-f');
      await mkdir(ws, { recursive: true });
      initRealGitRepo(ws, 'https://github.com/pubcoreagencia/pub-dev-loop.git');

      const auditSequence: string[] = [];
      const mockAgent = {
        execute: vi.fn(async () => {
          auditSequence.push('agent_executed');
          return { summary: 'ok' };
        }),
      };

      // Execution harness wrapping verification
      const runPipeline = async () => {
        auditSequence.push('gate_verification_start');
        verifyRepositoryIdentity({
          taskRepository: 'pubcoreagencia/pub-dev-loop',
          workspacePath: ws,
          gate: 'Gate 2 (Pre-Agent-Execution)',
        });
        auditSequence.push('gate_verification_success');
        return await mockAgent.execute();
      };

      await runPipeline();

      expect(auditSequence).toEqual([
        'gate_verification_start',
        'gate_verification_success',
        'agent_executed',
      ]);
      expect(mockAgent.execute).toHaveBeenCalledTimes(1);
    });

    // Scenario G: TASK=A, ACTIVE_PROJECT=B, WORKSPACE=B -> BLOCK
    it('Scenario G: TASK=A, ACTIVE_PROJECT=B, WORKSPACE=B -> BLOCK', async () => {
      const wsB = join(testTempDir, 'ws-g');
      await mkdir(wsB, { recursive: true });
      initRealGitRepo(wsB, 'https://github.com/pubcoreagencia/pub-leads.git');

      // Even if workspace matches activeProject, it violates the explicit task target A!
      expect(() => {
        verifyRepositoryIdentity({
          taskRepository: 'pubcoreagencia/pub-dev-loop',
          workspacePath: wsB,
          gate: 'Gate 1 (Post-Provisioning)',
          activeProject: 'pub-leads',
        });
      }).toThrowError(/PROJECT_SCOPE_MISMATCH.*pub-leads.*EXECUTION_BLOCKED/);
    });

    // Scenario H: TASK=A, PROJECT SCOPE MISMATCH -> BLOCK before any agent command
    it('Scenario H: TASK=A, PROJECT SCOPE MISMATCH -> BLOCK before any agent command', async () => {
      const wsWrong = join(testTempDir, 'ws-h');
      await mkdir(wsWrong, { recursive: true });
      initRealGitRepo(wsWrong, 'https://github.com/pubcoreagencia/pub-imoveis.git');

      const agentCommandSpy = vi.fn();

      const runProtectedSeam = () => {
        verifyRepositoryIdentity({
          taskRepository: 'pubcoreagencia/pub-dev-loop',
          workspacePath: wsWrong,
          gate: 'Gate 2 (Pre-Agent-Execution)',
        });
        // This command MUST NEVER execute if mismatch occurs
        agentCommandSpy();
      };

      expect(() => runProtectedSeam()).toThrowError(/PROJECT_SCOPE_MISMATCH/);
      expect(agentCommandSpy).not.toHaveBeenCalled();
    });

    // Scenario I: REMOTE=A initially verified; REMOTE changed to B before execution -> BLOCK at Gate 2
    it('Scenario I: REMOTE=A initially verified; REMOTE changed to B before execution -> BLOCK at Gate 2', async () => {
      const ws = join(testTempDir, 'ws-i');
      await mkdir(ws, { recursive: true });
      initRealGitRepo(ws, 'https://github.com/pubcoreagencia/pub-dev-loop.git');

      // Gate 1: Post-Provisioning passes on initial remote A
      const gate1Result = verifyRepositoryIdentity({
        taskRepository: 'pubcoreagencia/pub-dev-loop',
        workspacePath: ws,
        gate: 'Gate 1 (Post-Provisioning)',
      });
      expect(gate1Result.canonicalRemote).toBe('pubcoreagencia/pub-dev-loop');

      // Malicious or unauthorized drift changes origin to B before Gate 2
      runGit('git remote set-url origin https://github.com/pubcoreagencia/pub-neural.git', ws);

      const agentExecutionSpy = vi.fn();

      // Gate 2: Evaluated immediately before agent execution catches the drift
      expect(() => {
        verifyRepositoryIdentity({
          taskRepository: 'pubcoreagencia/pub-dev-loop',
          workspacePath: ws,
          gate: 'Gate 2 (Pre-Agent-Execution)',
        });
        agentExecutionSpy();
      }).toThrowError(/PROJECT_SCOPE_MISMATCH: Gate 2 \(Pre-Agent-Execution\) failed/);

      expect(agentExecutionSpy).not.toHaveBeenCalled();
    });

    // Scenario J: workspacePath directory named B, but Git remote=A -> identity determined strictly by Git, not path
    it('Scenario J: workspacePath directory named B, but Git remote=A -> identity determined strictly by Git, not path', async () => {
      // Create path misleadingly named 'buzios-de-cima'
      const wsDeceptivePath = join(testTempDir, 'buzios-de-cima');
      await mkdir(wsDeceptivePath, { recursive: true });
      initRealGitRepo(wsDeceptivePath, 'https://github.com/pubcoreagencia/pub-dev-loop.git');

      // Task targets pub-dev-loop. Despite deceptive folder path, Git remote confirms identity.
      const identity = verifyRepositoryIdentity({
        taskRepository: 'pubcoreagencia/pub-dev-loop',
        workspacePath: wsDeceptivePath,
        gate: 'Gate 1 (Post-Provisioning)',
      });

      const nativeRealpath = (realpathSync as any).native ?? realpathSync;
      expect(identity.canonicalRemote).toBe('pubcoreagencia/pub-dev-loop');
      expect(identity.topLevel).toBe(resolve(nativeRealpath(wsDeceptivePath)));
    });

    // Scenario K: .git/config inconsistent or metadata divergent -> BLOCK
    it('Scenario K: .git/config inconsistent or metadata divergent -> BLOCK', async () => {
      const wsCorrupted = join(testTempDir, 'ws-corrupted');
      await mkdir(wsCorrupted, { recursive: true });
      initRealGitRepo(wsCorrupted, 'https://github.com/pubcoreagencia/pub-dev-loop.git');

      // Corrupt .git/config with garbage bytes
      const gitConfigPath = join(wsCorrupted, '.git', 'config');
      await writeFile(gitConfigPath, '[[[CORRUPT_METADATA_HEADER@@@!!!', 'utf8');

      expect(() => {
        verifyRepositoryIdentity({
          taskRepository: 'pubcoreagencia/pub-dev-loop',
          workspacePath: wsCorrupted,
          gate: 'Gate 1 (Post-Provisioning)',
        });
      }).toThrowError(/WORKSPACE_IDENTITY_UNVERIFIED|WORKSPACE_MISSING_REMOTE/);
    });
  });

  describe('Structural Hard Stop & Multi-Repository Mutation Immunity', () => {
    it('A: direct internal call to runScheduledTick fails closed and cannot mutate any repository', async () => {
      const { defaultAutonomousOrchestrator } = await import('../../src/api-worker.js');
      const mockEnv: any = { GITHUB_TOKEN: 'fake-token' };

      await expect(
        defaultAutonomousOrchestrator.runScheduledTick(mockEnv, 'test directive', 'pubet')
      ).rejects.toThrowError(/CEO RECOVERY PROTOCOL HARD STOP: Autonomous scheduled tick execution and multi-repository code mutation are permanently removed/);
    });

    it('B: direct internal call to runMultiSectorParallelTick fails closed and cannot loop through holding sectors', async () => {
      const { defaultAutonomousOrchestrator } = await import('../../src/api-worker.js');
      const mockEnv: any = { GITHUB_TOKEN: 'fake-token' };

      await expect(
        defaultAutonomousOrchestrator.runMultiSectorParallelTick(mockEnv, 'test parallel')
      ).rejects.toThrowError(/CEO RECOVERY PROTOCOL HARD STOP: Multi-sector parallel ticks and autonomous repository mutation loops are permanently removed/);
    });

    it('C: direct internal call to rollbackBackup fails closed and cannot perform GitHub Contents PUT', async () => {
      const { defaultAutonomousOrchestrator } = await import('../../src/api-worker.js');
      const mockEnv: any = { GITHUB_TOKEN: 'fake-token' };

      await expect(
        defaultAutonomousOrchestrator.rollbackBackup(mockEnv, 'snap-any-123', null)
      ).rejects.toThrowError(/CEO RECOVERY PROTOCOL HARD STOP: Direct GitHub contents mutation \/ rollback via API Worker is permanently removed/);
    });

    it('D: API endpoints /office/autonomous/cycle and /office/autonomous/parallel-cycle return HTTP 403 Forbidden', async () => {
      const apiWorkerModule = await import('../../src/api-worker.js');
      const apiWorker = apiWorkerModule.default;
      const mockEnv: any = {};
      const mockCtx: any = { waitUntil: vi.fn() };

      const resCycle = await apiWorker.fetch(
        new Request('https://pub-dev-loop-api.test/office/autonomous/cycle', { method: 'POST' }),
        mockEnv,
        mockCtx
      );
      expect(resCycle.status).toBe(403);
      const cycleJson = await resCycle.json() as any;
      expect(cycleJson.error).toContain('CEO RECOVERY PROTOCOL HARD STOP');

      const resParallel = await apiWorker.fetch(
        new Request('https://pub-dev-loop-api.test/office/autonomous/parallel-cycle', { method: 'POST' }),
        mockEnv,
        mockCtx
      );
      expect(resParallel.status).toBe(403);
      const parallelJson = await resParallel.json() as any;
      expect(parallelJson.error).toContain('CEO RECOVERY PROTOCOL HARD STOP');
    });

    it('E: API endpoints /office/autonomous/rollback and /office/github/commit return HTTP 403 Forbidden', async () => {
      const apiWorkerModule = await import('../../src/api-worker.js');
      const apiWorker = apiWorkerModule.default;
      const mockEnv: any = {};
      const mockCtx: any = { waitUntil: vi.fn() };

      const resRollback = await apiWorker.fetch(
        new Request('https://pub-dev-loop-api.test/office/autonomous/rollback', {
          method: 'POST',
          body: JSON.stringify({ backupId: 'snap-test' }),
          headers: { 'Content-Type': 'application/json' },
        }),
        mockEnv,
        mockCtx
      );
      expect(resRollback.status).toBe(403);
      const rollbackJson = await resRollback.json() as any;
      expect(rollbackJson.error).toContain('CEO RECOVERY PROTOCOL HARD STOP');

      const resCommit = await apiWorker.fetch(
        new Request('https://pub-dev-loop-api.test/office/github/commit', {
          method: 'POST',
          body: JSON.stringify({ repo: 'pubet', path: 'src/file.ts', content: 'hello' }),
          headers: { 'Content-Type': 'application/json' },
        }),
        mockEnv,
        mockCtx
      );
      expect(resCommit.status).toBe(403);
      const commitJson = await resCommit.json() as any;
      expect(commitJson.error).toContain('CEO RECOVERY PROTOCOL HARD STOP');
    });

    it('F: direct internal call to getScheduledRepo fails closed and cannot select any repository', async () => {
      const { defaultAutonomousOrchestrator } = await import('../../src/api-worker.js');
      const mockEnv: any = {};

      await expect(
        defaultAutonomousOrchestrator.getScheduledRepo(mockEnv, 'pubet')
      ).rejects.toThrowError(/CEO RECOVERY PROTOCOL HARD STOP: Autonomous repository selection and multi-repository scheduling are permanently dismantled/);
    });

    it('G: direct internal call to createSafetyBackup fails closed and cannot record backups for mutation', async () => {
      const { defaultAutonomousOrchestrator } = await import('../../src/api-worker.js');

      await expect(
        defaultAutonomousOrchestrator.createSafetyBackup(null, {
          id: 'test-backup',
          repo: 'pubet',
          filePath: 'src/app.ts',
          directive: 'test',
        })
      ).rejects.toThrowError(/CEO RECOVERY PROTOCOL HARD STOP: Direct code backup and autonomous mutation records are permanently dismantled/);
    });
  });
});

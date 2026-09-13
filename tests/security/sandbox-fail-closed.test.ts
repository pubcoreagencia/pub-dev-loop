import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'node:events';
import { spawnSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { DockerWorkerSandboxAdapter } from '../../src/pdl/sandbox/docker-worker-sandbox-adapter.js';
import {
  SandboxUnavailableError,
  type WorkerSandboxAdapter,
} from '../../src/pdl/sandbox/types.js';
import { AgentExecutor, type ExecutionRequest } from '../../src/executor.js';
import { ToolRuntime } from '../../src/tools/runtime.js';
import type { TaskRepository } from '../../src/domain.js';
import { BaseWorker, type AttemptResult } from '../../src/worker-service.js';
import type { ExecutionSpecDatabase } from '../../src/execution/execution-spec-persistence.js';

describe('P0.4.4 Fail-Closed Sandbox Availability (Adversarial Suite)', () => {
  let tempWorkspace: string;

  beforeEach(async () => {
    tempWorkspace = await fs.mkdtemp(join(tmpdir(), 'pdl-p044-test-'));
  });

  afterEach(async () => {
    try {
      await fs.rm(tempWorkspace, { recursive: true, force: true });
    } catch {}
  });

  const sampleRequest: ExecutionRequest = {
    command: 'node',
    args: ['-e', 'console.log("PAYLOAD_EXECUTION")'],
    cwd: '',
    timeoutMs: 5000,
  };

  // --------------------------------------------------------------------------
  // 1. Docker daemon unavailable
  // --------------------------------------------------------------------------
  it('1. Docker daemon unavailable: fails closed with DOCKER_DAEMON_UNAVAILABLE and zero host execution', async () => {
    const adapter = new DockerWorkerSandboxAdapter({}, {
      spawnSync: (cmd, args, opts) => {
        if (cmd === 'docker' && Array.isArray(args) && args[0] === 'info') {
          return {
            status: 1,
            stdout: '',
            stderr: 'Cannot connect to the Docker daemon at unix:///var/run/docker.sock.',
            pid: 9999,
            output: [],
            signal: null,
          } as any;
        }
        return spawnSync(cmd, args as any, opts);
      },
    });

    const check = adapter.checkAvailability();
    expect(check.available).toBe(false);
    expect(check.reasonCode).toBe('DOCKER_DAEMON_UNAVAILABLE');
    expect(adapter.isAvailable).toBe(false);

    expect(() => adapter.assertAvailable()).toThrow(SandboxUnavailableError);

    const executor = new AgentExecutor(adapter);
    await expect(executor.execute({ ...sampleRequest, cwd: tempWorkspace })).rejects.toThrow(SandboxUnavailableError);
  });

  // --------------------------------------------------------------------------
  // 2. Docker CLI unavailable
  // --------------------------------------------------------------------------
  it('2. Docker CLI unavailable: fails closed with DOCKER_CLI_UNAVAILABLE and zero host execution', async () => {
    const adapter = new DockerWorkerSandboxAdapter({}, {
      spawnSync: (cmd, args, opts) => {
        if (cmd === 'docker' && Array.isArray(args) && args[0] === '--version') {
          throw new Error('spawnSync docker ENOENT');
        }
        return spawnSync(cmd, args as any, opts);
      },
    });

    const check = adapter.checkAvailability();
    expect(check.available).toBe(false);
    expect(check.reasonCode).toBe('DOCKER_CLI_UNAVAILABLE');
    expect(adapter.isAvailable).toBe(false);

    const executor = new AgentExecutor(adapter);
    await expect(executor.execute({ ...sampleRequest, cwd: tempWorkspace })).rejects.toThrow(SandboxUnavailableError);
  });

  // --------------------------------------------------------------------------
  // 3. Docker image unavailable
  // --------------------------------------------------------------------------
  it('3. Image unavailable: fails closed with DOCKER_IMAGE_UNAVAILABLE without falling back to host or another image', async () => {
    const adapter = new DockerWorkerSandboxAdapter({}, {
      spawnSync: (cmd, args, opts) => {
        if (cmd === 'docker' && Array.isArray(args) && args[0] === 'image' && args[1] === 'inspect') {
          return {
            status: 1,
            stdout: '',
            stderr: 'Error response from daemon: No such image: pdl-sandbox:latest',
            pid: 9999,
            output: [],
            signal: null,
          } as any;
        }
        return spawnSync(cmd, args as any, opts);
      },
    });

    const check = adapter.checkAvailability();
    expect(check.available).toBe(false);
    expect(check.reasonCode).toBe('DOCKER_IMAGE_UNAVAILABLE');
    expect(adapter.isAvailable).toBe(false);

    const executor = new AgentExecutor(adapter);
    await expect(executor.execute({ ...sampleRequest, cwd: tempWorkspace })).rejects.toThrow(SandboxUnavailableError);
  });

  // --------------------------------------------------------------------------
  // 4. Container creation failure
  // --------------------------------------------------------------------------
  it('4. Container creation failure: spawn rejection throws SandboxUnavailableError with CONTAINER_CREATION_FAILED', async () => {
    const adapter = new DockerWorkerSandboxAdapter({}, {
      spawn: (cmd, args) => {
        if (cmd === 'docker' && Array.isArray(args) && args[0] === 'run') {
          throw new Error('Docker daemon failed to create container: out of memory');
        }
        throw new Error('Unexpected call');
      },
    });

    expect(adapter.isAvailable).toBe(true);

    const executor = new AgentExecutor(adapter);
    try {
      await executor.execute({ ...sampleRequest, cwd: tempWorkspace });
      expect.fail('Should have thrown SandboxUnavailableError');
    } catch (err: any) {
      expect(err).toBeInstanceOf(SandboxUnavailableError);
      expect(err.reasonCode).toBe('CONTAINER_CREATION_FAILED');
      expect(err.message).toContain('out of memory');
    }
  });

  // --------------------------------------------------------------------------
  // 5. Container startup failure (OCI / Daemon exit code 125)
  // --------------------------------------------------------------------------
  it('5. Container startup failure: Docker exit 125 fails closed with CONTAINER_STARTUP_FAILED', async () => {
    const adapter = new DockerWorkerSandboxAdapter({}, {
      spawn: (cmd, args) => {
        if (cmd === 'docker' && Array.isArray(args) && args[0] === 'run') {
          const fakeChild = new EventEmitter() as any;
          fakeChild.stdout = new EventEmitter();
          fakeChild.stderr = new EventEmitter();
          fakeChild.pid = 9999;
          fakeChild.kill = vi.fn();

          setTimeout(() => {
            fakeChild.stderr.emit('data', Buffer.from('docker: Error response from daemon: OCI runtime create failed\n'));
            fakeChild.emit('close', 125);
          }, 20);

          return fakeChild;
        }
        throw new Error('Unexpected call');
      },
    });

    const executor = new AgentExecutor(adapter);
    const result = await executor.execute({ ...sampleRequest, cwd: tempWorkspace });

    expect(result.status).toBe('FAILED');
    expect(result.exitCode).toBe(125);
    expect(result.stderr).toContain('[SANDBOX_UNAVAILABLE] CONTAINER_STARTUP_FAILED');
    expect(result.status).not.toBe('COMPLETED');
  });

  // --------------------------------------------------------------------------
  // 6. Adapter initialization failure
  // --------------------------------------------------------------------------
  it('6. Adapter initialization failure: unconfigured adapter fails closed with SANDBOX_ADAPTER_INIT_FAILED', async () => {
    // When executor has no sandbox adapter and host execution is disabled (default)
    const executor = new AgentExecutor(null as any, { allowHostExecution: false });

    await expect(executor.execute({ ...sampleRequest, cwd: tempWorkspace })).rejects.toThrow(
      /No sandbox adapter configured and host execution is disabled/,
    );
  });

  // --------------------------------------------------------------------------
  // 7. Sandbox execution failure before agent launch
  // --------------------------------------------------------------------------
  it('7. Execution failure before agent launch: custom missing image fails closed before spawn', async () => {
    const adapter = new DockerWorkerSandboxAdapter();
    const executor = new AgentExecutor(adapter);

    // Specify a non-existent image in configOverride
    await expect(
      adapter.execute(
        { ...sampleRequest, cwd: tempWorkspace },
        undefined,
        { image: 'nonexistent-agent-image:p044' },
      ),
    ).rejects.toThrow(SandboxUnavailableError);
  });

  // --------------------------------------------------------------------------
  // 8. Sandbox execution timeout
  // --------------------------------------------------------------------------
  it('8. Sandbox execution timeout: enforces strict TIMED_OUT status and triggers container kill', async () => {
    const adapter = new DockerWorkerSandboxAdapter();
    const executor = new AgentExecutor(adapter);

    const timeoutScript = join(tempWorkspace, 'hang.js');
    await fs.writeFile(timeoutScript, 'setInterval(() => {}, 1000);', 'utf8');

    const result = await executor.execute({
      command: 'node',
      args: ['hang.js'],
      cwd: tempWorkspace,
      timeoutMs: 500, // Short timeout to test kill
    });

    expect(result.status).toBe('TIMED_OUT');
    expect(result.status).not.toBe('COMPLETED');
  }, 10000);

  // --------------------------------------------------------------------------
  // 9. Container killed before completion (SIGKILL / 137)
  // --------------------------------------------------------------------------
  it('9. Container killed before completion: exit code 137 returns FAILED, never COMPLETED', async () => {
    const adapter = new DockerWorkerSandboxAdapter({}, {
      spawn: (cmd, args) => {
        if (cmd === 'docker' && Array.isArray(args) && args[0] === 'run') {
          const fakeChild = new EventEmitter() as any;
          fakeChild.stdout = new EventEmitter();
          fakeChild.stderr = new EventEmitter();
          fakeChild.pid = 9999;
          fakeChild.kill = vi.fn();

          setTimeout(() => {
            fakeChild.emit('close', 137); // Killed by SIGKILL
          }, 20);

          return fakeChild;
        }
        throw new Error('Unexpected call');
      },
    });

    const executor = new AgentExecutor(adapter);
    const result = await executor.execute({ ...sampleRequest, cwd: tempWorkspace });

    expect(result.status).toBe('FAILED');
    expect(result.exitCode).toBe(137);
    expect(result.status).not.toBe('COMPLETED');
  });

  // --------------------------------------------------------------------------
  // 10. Simulated Docker command failure
  // --------------------------------------------------------------------------
  it('10. Simulated Docker command failure: non-zero exit code preserves error, produces no fake COMPLETED', async () => {
    const adapter = new DockerWorkerSandboxAdapter({}, {
      spawn: (cmd, args) => {
        if (cmd === 'docker' && Array.isArray(args) && args[0] === 'run') {
          const fakeChild = new EventEmitter() as any;
          fakeChild.stdout = new EventEmitter();
          fakeChild.stderr = new EventEmitter();
          fakeChild.pid = 9999;
          fakeChild.kill = vi.fn();

          setTimeout(() => {
            fakeChild.stderr.emit('data', Buffer.from('container process exited with failure\n'));
            fakeChild.emit('close', 1);
          }, 20);

          return fakeChild;
        }
        throw new Error('Unexpected call');
      },
    });

    const adapterExecutor = new AgentExecutor(adapter);
    const result = await adapterExecutor.execute({ ...sampleRequest, cwd: tempWorkspace });

    expect(result.status).toBe('FAILED');
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('container process exited with failure');
    expect(result.status).not.toBe('COMPLETED');
  });

  // --------------------------------------------------------------------------
  // 11. ToolRuntime arbitrary run_command fails closed without host execution
  // --------------------------------------------------------------------------
  it('11. ToolRuntime run_command: fails closed with [SANDBOX_UNAVAILABLE] when Docker is down', async () => {
    const unavailableAdapter: WorkerSandboxAdapter = {
      isAvailable: false,
      checkAvailability: () => ({
        available: false,
        reasonCode: 'DOCKER_DAEMON_UNAVAILABLE',
        error: 'Docker daemon offline.',
      }),
      assertAvailable: () => {
        throw new SandboxUnavailableError('Docker daemon offline.', 'DOCKER_DAEMON_UNAVAILABLE');
      },
      execute: vi.fn(),
    };

    const executor = new AgentExecutor(unavailableAdapter);
    const runtime = new ToolRuntime(
      {
        workspaceRoot: tempWorkspace,
        commandTimeoutMs: 5000,
        redactSecrets: true,
      },
      executor,
    );

    const toolRes = await (runtime as any).runCommand('call-1', {
      command: 'node -e "console.log(\'MALICIOUS_HOST_COMMAND\')"',
    });

    expect(toolRes.success).toBe(false);
    expect(toolRes.error).toContain('[SANDBOX_UNAVAILABLE]');
    expect(toolRes.error).toContain('DOCKER_DAEMON_UNAVAILABLE');
  });

  // --------------------------------------------------------------------------
  // 12. BaseWorker Task Lifecycle: Failure Semantics & Zero Persistence Invariant
  // --------------------------------------------------------------------------
  it('12. BaseWorker: sandbox acquisition failure sets task to FAILED, skips finalize, zero persistence', async () => {
    const fakeTasks: TaskRepository = {
      claim: vi.fn().mockResolvedValue({
        id: 'TASK-P044-FAIL-CLOSED',
        project: 'pub-rate-calculator',
        repository: tempWorkspace,
        objective: 'Test sandbox fail-closed lifecycle',
        prompt: 'Do something',
        status: 'PENDING',
        priority: 1,
        worker: 'test-worker',
        result: null,
        error: null,
        branch: null,
        commitSha: null,
        gitStatus: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
      update: vi.fn().mockResolvedValue(undefined),
      heartbeat: vi.fn().mockResolvedValue(undefined),
      get: vi.fn(),
      list: vi.fn(),
      save: vi.fn(),
    } as any;

    const records = new Map<string, any>();
    const fakeSpecStore = {
      create: async (r: any) => {
        const rec = { ...r, id: 'spec-1' };
        records.set(rec.id, rec);
        records.set(rec.task_id, rec);
        return rec;
      },
      loadByTaskId: async (taskId: string) => records.get(taskId) ?? null,
      updateStatus: async (idOrTaskId: string, status: any, sealedAt: any, specHash: any, specContentJson: any) => {
        const r = records.get(idOrTaskId);
        if (r) {
          r.status = status;
          r.sealed_at = sealedAt;
          if (specHash) r.spec_hash = specHash;
          if (specContentJson) r.spec_content_json = specContentJson;
        }
        return r;
      },
    };

    const { createExecutionSpec, sealExecutionSpec } = await import('../../src/execution/execution-spec-persistence.js');
    const { EXECUTION_SPEC_VERSION } = await import('../../src/task/execution-spec.js');

    const baseSpec: any = {
      specVersion: EXECUTION_SPEC_VERSION,
      objective: 'Test objective',
      context: {
        version: '1.0.0',
        authoritativeContext: [],
        repositoryContext: [],
        operationalContext: [],
        relevantDocumentation: [],
        knownConstraints: [],
        limitations: [],
      },
      constraints: ['test'],
      acceptanceCriteria: ['done'],
      validationPlan: ['check'],
      executionInstructions: ['run'],
      executionSteps: [{ id: 'step-1', description: 'test', critical: true }],
      risks: ['none'],
      escalationConditions: ['test-condition'],
      lineage: {
        intakeVersion: '1.0.0',
        intakeHash: 'hash-abc',
        source: 'test',
        createdAt: '2026-09-11T07:00:00.000Z',
      },
      metadata: {
        generatedAt: '2026-09-11T07:00:00.000Z',
        specHash: '',
      },
    };

    await createExecutionSpec(fakeSpecStore as any, 'TASK-P044-FAIL-CLOSED', baseSpec);
    await sealExecutionSpec(fakeSpecStore as any, 'TASK-P044-FAIL-CLOSED');

    class FailingSandboxWorker extends BaseWorker {
      protected async executeWithRetry(): Promise<AttemptResult> {
        // Simulates provider failing due to SANDBOX_UNAVAILABLE
        return {
          status: 'FAILED',
          workspace: tempWorkspace,
          baselineSnapshot: { gitStatus: '', treeSha: 'empty' },
          declaredChangedFiles: [],
          stdout: '',
          stderr: '[SANDBOX_UNAVAILABLE] DOCKER_DAEMON_UNAVAILABLE: Docker daemon offline.',
          exitCode: null,
          provider: 'test-provider',
          model: null,
          toolCalls: 0,
          toolRounds: 0,
          durationMs: 10,
          errorCode: 'SANDBOX_UNAVAILABLE',
          errorMessage: 'Docker daemon offline.',
        };
      }
      protected async executeTask(): Promise<any> {
        throw new Error('Not used');
      }
    }

    const worker = new FailingSandboxWorker(fakeTasks, 'test-worker', fakeSpecStore as any);
    const executed = await worker.executeOnce();

    expect(executed).toBe(true);
    expect(worker.lastFinalizeStatus).toBe('SKIPPED_AGENT_FAILED');
    expect(worker.finalizeWasCalled).toBe(false);

    // Verify task updated to FAILED with SANDBOX_UNAVAILABLE error
    expect(fakeTasks.update).toHaveBeenCalledWith(
      'TASK-P044-FAIL-CLOSED',
      expect.objectContaining({
        status: 'FAILED',
        error: expect.stringContaining('SANDBOX_UNAVAILABLE'),
      }),
    );
  });
});

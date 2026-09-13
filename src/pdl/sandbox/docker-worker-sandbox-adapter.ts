import { spawn, spawnSync, execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import type { ExecutionRequest, ExecutionResult, ExecutionStatus } from '../../executor.js';
import { redact } from '../../executor.js';
import { WorkspaceEnvironmentSecurity } from '../../tools/security.js';
import type { SandboxSecurityConfig, WorkerSandboxAdapter } from './types.js';

export const DEFAULT_SANDBOX_CONFIG: Required<SandboxSecurityConfig> = {
  image: 'pdl-sandbox:latest',
  user: '1000:1000',
  memoryLimit: '2g',
  cpuLimit: '2.0',
  pidsLimit: 100,
  network: 'none', // Strict airgap by default
  securityOpts: ['no-new-privileges'],
  capDrop: ['ALL'],
  readOnlyRoot: false,
};

// Forbidden environment keys that must NEVER enter the container
const FORBIDDEN_ENV_KEYS = new Set([
  'GITHUB_TOKEN',
  'GH_TOKEN',
  'PDL_GITHUB_TOKEN',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_ANON_KEY',
  'DATABASE_URL',
  'POSTGRES_PASSWORD',
  'PGPASSWORD',
  'PDL_GOVERNANCE_ADMIN_KEY',
  'USERPROFILE',
  'APPDATA',
  'LOCALAPPDATA',
  'SSH_AUTH_SOCK',
  'DOCKER_HOST',
]);

/**
 * DockerWorkerSandboxAdapter: Executes arbitrary LLM-generated agent code
 * inside an ephemeral, strictly isolated Docker/OCI container.
 *
 * Implements P0.4.3 Capability Boundary:
 * - One ephemeral container per execution attempt (--rm)
 * - Non-root user (1000:1000)
 * - Container PID namespace & private IPC
 * - Strict airgapped network by default (--network none)
 * - Dropped Linux capabilities (--cap-drop ALL)
 * - No-new-privileges flag
 * - PIDs limit (100) to block fork-bombs
 * - Memory (2g) and CPU (2.0) limits
 * - Only task workspace mounted (-v <workspace>:/workspace:rw)
 * - Zero governance credentials or host profile mounted
 * - Guaranteed container destruction on timeout or abort
 */
export class DockerWorkerSandboxAdapter implements WorkerSandboxAdapter {
  private readonly config: Required<SandboxSecurityConfig>;
  private _isAvailable: boolean | null = null;
  private _lastCheckTime: number = 0;

  constructor(customConfig?: Partial<SandboxSecurityConfig>) {
    this.config = { ...DEFAULT_SANDBOX_CONFIG, ...customConfig };
  }

  get isAvailable(): boolean {
    const now = Date.now();
    // Cache availability check for 10 seconds
    if (this._isAvailable !== null && now - this._lastCheckTime < 10000) {
      return this._isAvailable;
    }
    this._lastCheckTime = now;
    try {
      const res = spawnSync('docker', ['info', '--format', '{{.OSType}}'], {
        encoding: 'utf8',
        timeout: 3000,
        shell: false,
      });
      this._isAvailable = res.status === 0 && Boolean(res.stdout?.trim());
    } catch {
      this._isAvailable = false;
    }
    return this._isAvailable;
  }

  /**
   * Normalize Windows command names to container-compatible names.
   * Host-specific absolute paths (like C:\...) are left untouched so they fail-closed.
   */
  private normalizeCommand(cmd: string): string {
    const lower = cmd.toLowerCase();
    if (lower === 'node.exe' || lower === 'node') return 'node';
    if (lower === 'python.exe' || lower === 'python' || lower === 'python3') return 'python3';
    if (lower === 'git.exe' || lower === 'git') return 'git';
    if (lower === 'npm.cmd' || lower === 'npm') return 'npm';
    if (lower === 'sh' || lower === 'bash') return lower;
    return cmd;
  }

  async execute(
    request: ExecutionRequest,
    sanitizedEnv?: NodeJS.ProcessEnv,
    configOverride?: Partial<SandboxSecurityConfig>,
  ): Promise<ExecutionResult> {
    const started = Date.now();
    const effectiveConfig = { ...this.config, ...configOverride };

    // Build unique ephemeral container name
    const containerName = `pdl-sandbox-${Date.now()}-${randomUUID().slice(0, 8)}`;

    // Normalize Windows workspace path to forward slashes for Docker volume mount
    const normalizedWs = resolve(request.cwd).replace(/\\/g, '/');

    // Build environment variables array for Docker (-e KEY=VALUE)
    const rawEnv = sanitizedEnv ?? WorkspaceEnvironmentSecurity.sanitizeWorkspaceEnv(request.environment ?? process.env);
    WorkspaceEnvironmentSecurity.assertNoGovernanceCredentials(rawEnv);

    const envArgs: string[] = [];
    const HOST_SYSTEM_KEYS = new Set([
      'PATH',
      'HOMEDRIVE',
      'HOMEPATH',
      'PROGRAMFILES',
      'PROGRAMFILES(X86)',
      'PROGRAMDATA',
      'SYSTEMROOT',
      'SYSTEMDRIVE',
      'WINDIR',
      'COMSPEC',
      'PATHEXT',
      'PSMODULEPATH',
    ]);

    for (const [key, val] of Object.entries(rawEnv)) {
      const upper = key.toUpperCase();
      if (val === undefined || FORBIDDEN_ENV_KEYS.has(upper) || HOST_SYSTEM_KEYS.has(upper)) continue;
      envArgs.push('-e', `${key}=${val}`);
    }

    // Explicitly inject safe container defaults
    envArgs.push('-e', 'HOME=/home/node');
    envArgs.push('-e', 'USER=node');
    envArgs.push('-e', 'PDL_ISOLATED_SANDBOX=1');

    // Assemble docker run command arguments
    const dockerArgs = [
      'run',
      '--rm',
      `--name=${containerName}`,
      `--user=${effectiveConfig.user}`,
      `--network=${effectiveConfig.network}`,
      `--pids-limit=${effectiveConfig.pidsLimit}`,
      `--memory=${effectiveConfig.memoryLimit}`,
      `--cpus=${effectiveConfig.cpuLimit}`,
      ...effectiveConfig.securityOpts.map(opt => `--security-opt=${opt}`),
      ...effectiveConfig.capDrop.map(cap => `--cap-drop=${cap}`),
      '--entrypoint=',
      '-v', `${normalizedWs}:/workspace:rw`,
      '-w', '/workspace',
      ...envArgs,
      effectiveConfig.image,
      this.normalizeCommand(request.command),
      ...request.args,
    ];

    if (effectiveConfig.readOnlyRoot) {
      dockerArgs.splice(1, 0, '--read-only', '--tmpfs', '/tmp:rw,noexec,nosuid,size=64m');
    }

    return new Promise(resolvePromise => {
      let stdout = '';
      let stderr = '';
      let settled = false;
      let timedOut = false;

      const finish = (exitCode: number | null, status: ExecutionStatus) => {
        if (settled) return;
        settled = true;
        resolvePromise({
          exitCode,
          stdout: redact(stdout, rawEnv),
          stderr: redact(stderr, rawEnv),
          durationMs: Date.now() - started,
          status,
        });
      };

      let child: ReturnType<typeof spawn>;

      try {
        child = spawn('docker', dockerArgs, {
          shell: false,
          stdio: ['ignore', 'pipe', 'pipe'],
        });
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unable to start container sandbox process';
        finish(null, 'START_ERROR');
        return;
      }

      // Cleanup function to guarantee container destruction
      const killContainer = () => {
        try {
          spawnSync('docker', ['kill', containerName], { stdio: 'ignore', timeout: 5000 });
        } catch {}
        try {
          child.kill('SIGKILL');
        } catch {}
      };

      const timer = setTimeout(() => {
        timedOut = true;
        killContainer();
      }, request.timeoutMs);

      child.stdout?.on('data', data => (stdout += data.toString()));
      child.stderr?.on('data', data => (stderr += data.toString()));

      child.on('error', error => {
        stderr += error.message;
        clearTimeout(timer);
        killContainer();
        finish(null, 'START_ERROR');
      });

      child.on('close', code => {
        clearTimeout(timer);
        // If timed out, ensure status is TIMED_OUT regardless of exit code
        finish(code, timedOut ? 'TIMED_OUT' : code === 0 ? 'COMPLETED' : 'FAILED');
      });
    });
  }
}

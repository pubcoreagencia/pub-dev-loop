import type { ExecutionRequest, ExecutionResult } from '../../executor.js';

export interface SandboxSecurityConfig {
  /** Container image to execute inside (defaults to pdl-sandbox:latest) */
  image?: string;
  /** Non-root UID:GID for the container process (defaults to '1000:1000') */
  user?: string;
  /** Memory limit for the container (e.g. '2g') */
  memoryLimit?: string;
  /** CPU limit for the container (e.g. '2.0') */
  cpuLimit?: string;
  /** PIDs limit to prevent fork bombs (defaults to 100) */
  pidsLimit?: number;
  /** Network isolation mode: 'none' (airgapped, default) or custom */
  network?: string;
  /** Extra security options (e.g. ['no-new-privileges']) */
  securityOpts?: string[];
  /** Linux capabilities to drop (defaults to ['ALL']) */
  capDrop?: string[];
  /** Whether the container root filesystem is read-only */
  readOnlyRoot?: boolean;
}

export interface WorkerSandboxAdapter {
  /** Whether the sandbox runtime (e.g. Docker daemon) is currently operational */
  readonly isAvailable: boolean;
  /**
   * Execute an execution request inside an ephemeral, isolated container sandbox.
   *
   * Invariants:
   * - Ephemeral: container is created with --rm and uniquely named
   * - Unprivileged: runs as non-root user
   * - No host network, no host PID namespace, no Docker socket
   * - No governance credentials or host profile mounted
   * - Only the task workspace is mounted
   */
  execute(
    request: ExecutionRequest,
    sanitizedEnv?: NodeJS.ProcessEnv,
    configOverride?: Partial<SandboxSecurityConfig>,
  ): Promise<ExecutionResult>;
}

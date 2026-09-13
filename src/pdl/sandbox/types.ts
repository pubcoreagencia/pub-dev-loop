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

export type SandboxUnavailableReasonCode =
  | 'DOCKER_DAEMON_UNAVAILABLE'
  | 'DOCKER_CLI_UNAVAILABLE'
  | 'DOCKER_IMAGE_UNAVAILABLE'
  | 'CONTAINER_CREATION_FAILED'
  | 'CONTAINER_STARTUP_FAILED'
  | 'SANDBOX_ADAPTER_INIT_FAILED'
  | 'SANDBOX_BOUNDARY_FAILED';

export class SandboxUnavailableError extends Error {
  readonly code = 'SANDBOX_UNAVAILABLE' as const;
  readonly reasonCode: SandboxUnavailableReasonCode;

  constructor(message: string, reasonCode: SandboxUnavailableReasonCode = 'SANDBOX_BOUNDARY_FAILED') {
    super(`[SANDBOX_UNAVAILABLE] ${reasonCode}: ${message}`);
    this.name = 'SandboxUnavailableError';
    this.reasonCode = reasonCode;
  }
}

export interface SandboxAvailabilityCheck {
  available: boolean;
  reasonCode?: SandboxUnavailableReasonCode;
  error?: string;
}

export interface SandboxSpawner {
  spawnSync: (command: string, args: readonly string[], options?: any) => any;
  spawn: (command: string, args: readonly string[], options?: any) => any;
}

export interface WorkerSandboxAdapter {
  /** Whether the sandbox runtime (Docker CLI, daemon, and image) is currently operational */
  readonly isAvailable: boolean;
  /** Detailed availability check with diagnostic reason */
  checkAvailability(): SandboxAvailabilityCheck;
  /** Asserts availability or throws SandboxUnavailableError */
  assertAvailable(): void;
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

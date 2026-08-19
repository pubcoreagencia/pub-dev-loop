export const PREVIEW_RUNTIME_STATUSES = [
  'CREATING',
  'STARTING',
  'READY',
  'STOPPING',
  'STOPPED',
  'FAILED',
] as const;
export type PreviewRuntimeStatus = typeof PREVIEW_RUNTIME_STATUSES[number];

export interface PreviewRuntimeConfig {
  workspace: string;
  command: string;
  args: string[];
  port: number;
  startupTimeoutMs?: number;
  environment?: NodeJS.ProcessEnv;
}

export interface PreviewRuntimeInfo {
  id: string;
  status: PreviewRuntimeStatus;
  url: string | null;
  port: number;
  pid: number | null;
  startedAt: Date | null;
  stoppedAt: Date | null;
  error: string | null;
}

export interface PreviewLogEvent {
  runtimeId: string;
  stream: 'stdout' | 'stderr' | 'system';
  line: string;
  timestamp: Date;
}

export interface PreviewRuntime {
  create(config: PreviewRuntimeConfig): Promise<PreviewRuntimeInfo>;
  start(runtimeId: string): Promise<PreviewRuntimeInfo>;
  get(runtimeId: string): Promise<PreviewRuntimeInfo | null>;
  stop(runtimeId: string): Promise<PreviewRuntimeInfo | null>;
  destroy(runtimeId: string): Promise<void>;
  subscribe(runtimeId: string, listener: (event: PreviewLogEvent) => void): () => void;
}

import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createServer } from 'node:net';

import type {
  PreviewLogEvent,
  PreviewRuntime,
  PreviewRuntimeConfig,
  PreviewRuntimeInfo,
  PreviewRuntimeStatus,
} from './preview-runtime.js';

interface RuntimeRecord {
  config: PreviewRuntimeConfig;
  info: PreviewRuntimeInfo;
  child: ChildProcessWithoutNullStreams | null;
  listeners: Set<(event: PreviewLogEvent) => void>;
}

const DEFAULT_STARTUP_TIMEOUT_MS = 30_000;
const HEALTHCHECK_INTERVAL_MS = 250;

function createId(): string {
  return `preview_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function emit(record: RuntimeRecord, stream: PreviewLogEvent['stream'], line: string): void {
  const event: PreviewLogEvent = {
    runtimeId: record.info.id,
    stream,
    line,
    timestamp: new Date(),
  };
  for (const listener of record.listeners) listener(event);
}

function setStatus(record: RuntimeRecord, status: PreviewRuntimeStatus, error: string | null = null): void {
  record.info = {
    ...record.info,
    status,
    error,
    stoppedAt: status === 'STOPPED' || status === 'FAILED' ? new Date() : record.info.stoppedAt,
  };
  emit(record, 'system', `status:${status}`);
}

async function allocatePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close();
        reject(new Error('failed to allocate preview port'));
        return;
      }
      const port = address.port;
      server.close(error => error ? reject(error) : resolve(port));
    });
  });
}

function resolveUrl(config: PreviewRuntimeConfig, port: number): string {
  const base = (config.publicBaseUrl ?? `http://127.0.0.1:${port}`).replace(/\/$/, '');
  if (base.includes('{PORT}')) return base.replaceAll('{PORT}', String(port));
  if (config.publicBaseUrl) return base;
  return `http://127.0.0.1:${port}`;
}

function resolveArgs(args: string[], port: number): string[] {
  return args.map(arg => arg.replaceAll('{PORT}', String(port)));
}

async function waitForHttp(url: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastError = 'preview health check did not succeed';

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(Math.min(1000, Math.max(100, deadline - Date.now()))) });
      if (response.ok || response.status < 500) return;
      lastError = `preview returned HTTP ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await new Promise(resolve => setTimeout(resolve, HEALTHCHECK_INTERVAL_MS));
  }

  throw new Error(lastError);
}

export class LocalPreviewRuntime implements PreviewRuntime {
  private readonly runtimes = new Map<string, RuntimeRecord>();

  async create(config: PreviewRuntimeConfig): Promise<PreviewRuntimeInfo> {
    if (!config.workspace) throw new Error('workspace is required');
    if (!config.command) throw new Error('command is required');
    if (!Number.isInteger(config.port) || config.port < 0 || config.port > 65535) {
      throw new Error('port must be 0 or an integer between 1 and 65535');
    }

    const port = config.port === 0 ? await allocatePort() : config.port;
    const id = createId();
    const record: RuntimeRecord = {
      config: { ...config, port },
      info: {
        id,
        status: 'CREATING',
        url: resolveUrl(config, port),
        port,
        pid: null,
        startedAt: null,
        stoppedAt: null,
        error: null,
      },
      child: null,
      listeners: new Set(),
    };

    this.runtimes.set(id, record);
    emit(record, 'system', `runtime:created port=${port}`);
    return { ...record.info };
  }

  async start(runtimeId: string): Promise<PreviewRuntimeInfo> {
    const record = this.runtimes.get(runtimeId);
    if (!record) throw new Error(`preview runtime not found: ${runtimeId}`);
    if (record.info.status === 'READY' || record.info.status === 'STARTING') return { ...record.info };
    if (record.info.status === 'STOPPING') throw new Error('preview runtime is stopping');

    setStatus(record, 'STARTING', null);

    const env = { ...process.env, ...(record.config.environment ?? {}), PORT: String(record.config.port) };
    const child = spawn(record.config.command, resolveArgs(record.config.args, record.config.port), {
      cwd: record.config.workspace,
      env,
      shell: false,
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    }) as unknown as ChildProcessWithoutNullStreams;
    record.child = child;

    record.info = { ...record.info, pid: child.pid ?? null, startedAt: new Date(), error: null };

    child.stdout.on('data', (chunk: Buffer) => {
      for (const line of chunk.toString().split(/\r?\n/).filter(Boolean)) emit(record, 'stdout', line);
    });
    child.stderr.on('data', (chunk: Buffer) => {
      for (const line of chunk.toString().split(/\r?\n/).filter(Boolean)) emit(record, 'stderr', line);
    });

    const onExit = (code: number | null, signal: NodeJS.Signals | null) => {
      if (record.info.status === 'STOPPING' || record.info.status === 'STOPPED') {
        setStatus(record, 'STOPPED', null);
        return;
      }
      setStatus(record, code === 0 ? 'STOPPED' : 'FAILED', code === 0 ? null : `preview process exited with code=${String(code)} signal=${String(signal)}`);
    };

    child.on('exit', onExit);
    child.on('error', (error: Error) => setStatus(record, 'FAILED', error.message));


    try {
      const healthUrl = `http://127.0.0.1:${record.config.port}`;
      await waitForHttp(healthUrl, record.config.startupTimeoutMs ?? DEFAULT_STARTUP_TIMEOUT_MS);
      if (record.info.status === 'FAILED') throw new Error(record.info.error ?? 'preview process failed');
      setStatus(record, 'READY', null);
      return { ...record.info };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.stop(runtimeId).catch(() => undefined);
      setStatus(record, 'FAILED', message);
      throw new Error(`preview failed to become ready: ${message}`);
    }
  }

  async get(runtimeId: string): Promise<PreviewRuntimeInfo | null> {
    const record = this.runtimes.get(runtimeId);
    return record ? { ...record.info } : null;
  }

  async stop(runtimeId: string): Promise<PreviewRuntimeInfo | null> {
    const record = this.runtimes.get(runtimeId);
    if (!record) return null;
    if (!record.child || record.info.status === 'STOPPED' || record.info.status === 'FAILED') {
      if (record.info.status !== 'FAILED') setStatus(record, 'STOPPED', null);
      return { ...record.info };
    }

    setStatus(record, 'STOPPING', null);
    const child = record.child;
    try {
      if (child.pid) process.kill(-child.pid, 'SIGTERM');
      else child.kill('SIGTERM');
    } catch {
      child.kill('SIGTERM');
    }

    await new Promise<void>(resolve => {
      const timeout = setTimeout(() => {
        try {
          if (child.pid) process.kill(-child.pid, 'SIGKILL');
          else child.kill('SIGKILL');
        } catch {
          child.kill('SIGKILL');
        }
        resolve();
      }, 1_500);
      child.once('exit', () => { clearTimeout(timeout); resolve(); });
    });

    record.child = null;
    record.info = { ...record.info, pid: null, stoppedAt: new Date() };
    if (record.info.status !== 'FAILED') setStatus(record, 'STOPPED', null);
    return { ...record.info };
  }

  async destroy(runtimeId: string): Promise<void> {
    await this.stop(runtimeId);
    this.runtimes.delete(runtimeId);
  }

  subscribe(runtimeId: string, listener: (event: PreviewLogEvent) => void): () => void {
    const record = this.runtimes.get(runtimeId);
    if (!record) throw new Error(`preview runtime not found: ${runtimeId}`);
    record.listeners.add(listener);
    return () => record.listeners.delete(listener);
  }
}

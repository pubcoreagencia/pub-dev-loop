import { spawn, type ChildProcess } from 'node:child_process';

import type {
  PreviewLogEvent,
  PreviewRuntime,
  PreviewRuntimeConfig,
  PreviewRuntimeInfo,
} from './preview-runtime.js';
import { LocalPreviewRuntime } from './local-preview-runtime.js';

const DEFAULT_TUNNEL_TIMEOUT_MS = 30_000;
const QUICK_TUNNEL_RE = /https:\/\/[-a-z0-9]+\.trycloudflare\.com/i;

interface PublicRecord {
  localRuntimeId: string;
  tunnel: ChildProcess | null;
  info: PreviewRuntimeInfo;
  listeners: Set<(event: PreviewLogEvent) => void>;
}

export class PublicPreviewRuntime implements PreviewRuntime {
  private readonly local = new LocalPreviewRuntime();
  private readonly records = new Map<string, PublicRecord>();
  private readonly cloudflared = process.env.CLOUDFLARED_COMMAND ?? 'cloudflared';

  async create(config: PreviewRuntimeConfig): Promise<PreviewRuntimeInfo> {
    const local = await this.local.create({ ...config, publicBaseUrl: undefined });
    const info: PreviewRuntimeInfo = { ...local, url: null };
    this.records.set(local.id, {
      localRuntimeId: local.id,
      tunnel: null,
      info,
      listeners: new Set(),
    });
    return { ...info };
  }

  async start(runtimeId: string): Promise<PreviewRuntimeInfo> {
    const record = this.require(runtimeId);
    const local = await this.local.start(record.localRuntimeId);
    record.info = { ...local, url: null };
    this.emit(record, 'system', `local-preview:ready port=${local.port}`);

    const tunnel = spawn(
      this.cloudflared,
      ['tunnel', '--url', `http://127.0.0.1:${local.port}`, '--no-autoupdate'],
      { stdio: ['ignore', 'pipe', 'pipe'], shell: false, detached: true },
    );
    record.tunnel = tunnel;

    const timeoutMs = Number(process.env.PROTOTYPE_TUNNEL_STARTUP_TIMEOUT_MS ?? DEFAULT_TUNNEL_TIMEOUT_MS);
    const deadline = Date.now() + timeoutMs;
    let buffer = '';

    return await new Promise<PreviewRuntimeInfo>((resolve, reject) => {
      let settled = false;

      const fail = async (error: Error) => {
        if (settled) return;
        settled = true;
        await this.stop(runtimeId).catch(() => undefined);
        record.info = { ...record.info, status: 'FAILED', error: error.message };
        this.emit(record, 'system', `public-preview:failed ${error.message}`);
        reject(error);
      };

      const handleChunk = (stream: 'stdout' | 'stderr', chunk: Buffer) => {
        const text = chunk.toString();
        this.emit(record, stream, text.trimEnd());
        buffer += text;
        const match = buffer.match(QUICK_TUNNEL_RE);
        if (match && !settled) {
          settled = true;
          record.info = {
            ...record.info,
            status: 'READY',
            url: match[0],
            error: null,
          };
          this.emit(record, 'system', `public-preview:ready url=${match[0]}`);
          resolve({ ...record.info });
        }
        if (buffer.length > 16_384) buffer = buffer.slice(-8_192);
      };

      tunnel.stdout?.on('data', chunk => handleChunk('stdout', chunk));
      tunnel.stderr?.on('data', chunk => handleChunk('stderr', chunk));
      tunnel.once('error', error => void fail(error));
      tunnel.once('exit', (code, signal) => {
        if (!settled) {
          void fail(new Error(`cloudflared exited before preview URL was available (code=${String(code)} signal=${String(signal)})`));
        }
      });

      const timer = setInterval(() => {
        if (Date.now() >= deadline && !settled) {
          clearInterval(timer);
          void fail(new Error('cloudflared did not produce a public preview URL before timeout'));
        }
      }, 250);

      const cleanup = () => clearInterval(timer);
      tunnel.once('exit', cleanup);
    });
  }

  async get(runtimeId: string): Promise<PreviewRuntimeInfo | null> {
    const record = this.records.get(runtimeId);
    if (!record) return null;
    // If the tunnel process died, the URL is dead too - mark as EXPIRED
    if (record.tunnel && record.tunnel.exitCode !== null) {
      record.info = { ...record.info, status: 'EXPIRED', error: 'Tunnel expired' };
      return { ...record.info };
    }
    const local = await this.local.get(record.localRuntimeId);
    if (local) {
      const isFailed = record.info.status === 'FAILED';
      record.info = {
        ...record.info,
        ...local,
        status: isFailed ? 'FAILED' : local.status,
        error: isFailed ? record.info.error : local.error,
        url: record.info.url,
      };
    }
    return { ...record.info };
  }

  async stop(runtimeId: string): Promise<PreviewRuntimeInfo | null> {
    const record = this.records.get(runtimeId);
    if (!record) return null;

    if (record.tunnel?.pid) {
      try { process.kill(-record.tunnel.pid, 'SIGTERM'); } catch { record.tunnel.kill('SIGTERM'); }
      record.tunnel = null;
    }

    const isFailed = record.info.status === 'FAILED';
    const local = await this.local.stop(record.localRuntimeId);
    record.info = {
      ...(local ?? record.info),
      status: isFailed ? 'FAILED' : (local?.status ?? record.info.status),
      error: isFailed ? record.info.error : (local?.error ?? record.info.error),
      url: record.info.url,
    };
    return { ...record.info };
  }

  async destroy(runtimeId: string): Promise<void> {
    await this.stop(runtimeId);
    const record = this.records.get(runtimeId);
    if (!record) return;
    await this.local.destroy(record.localRuntimeId);
    this.records.delete(runtimeId);
  }

  subscribe(runtimeId: string, listener: (event: PreviewLogEvent) => void): () => void {
    const record = this.require(runtimeId);
    record.listeners.add(listener);
    return () => record.listeners.delete(listener);
  }

  private require(runtimeId: string): PublicRecord {
    const record = this.records.get(runtimeId);
    if (!record) throw new Error(`public preview runtime not found: ${runtimeId}`);
    return record;
  }

  private emit(record: PublicRecord, stream: PreviewLogEvent['stream'], line: string): void {
    const event: PreviewLogEvent = {
      runtimeId: record.info.id,
      stream,
      line,
      timestamp: new Date(),
    };
    for (const listener of record.listeners) listener(event);
  }
}

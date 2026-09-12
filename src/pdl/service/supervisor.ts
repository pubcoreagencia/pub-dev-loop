/**
 * Phase 5.1: Production Service Supervisor & Daemon Manager.
 *
 * Implements continuous sovereign service management:
 * - Automatic startup of 4 daemons (PP API, PP Worker, PDL API, PDL Worker)
 * - PID file management & duplicate process prevention
 * - Health / Readiness monitoring probes
 * - Crash detection & automatic restart with exponential backoff
 * - Graceful shutdown forwarding (SIGTERM / SIGINT)
 * - Structured logging to disk
 */

import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';

export interface ServiceDescriptor {
  name: string;
  cwd: string;
  script: string;
  port: number;
  healthPath: string;
  readyPath: string;
  env: Record<string, string>;
  maxRestarts?: number;
}

export interface ServiceState {
  descriptor: ServiceDescriptor;
  process: ChildProcess | null;
  pid: number | null;
  status: 'STOPPED' | 'STARTING' | 'RUNNING' | 'CRASHED' | 'RESTARTING';
  restarts: number;
  lastStartedAt: Date | null;
  lastCrashAt: Date | null;
  logPath: string;
  pidPath: string;
}

export class ProductionServiceSupervisor {
  private readonly states = new Map<string, ServiceState>();
  private isShuttingDown = false;
  private readonly pidsDir: string;
  private readonly logsDir: string;

  constructor(options?: { pidsDir?: string; logsDir?: string }) {
    this.pidsDir = options?.pidsDir ?? path.resolve(process.cwd(), '.pids');
    this.logsDir = options?.logsDir ?? path.resolve(process.cwd(), 'logs');

    fs.mkdirSync(this.pidsDir, { recursive: true });
    fs.mkdirSync(this.logsDir, { recursive: true });
  }

  register(descriptor: ServiceDescriptor): void {
    const logPath = path.join(this.logsDir, `${descriptor.name.toLowerCase().replace(/_/g, '-')}.log`);
    const pidPath = path.join(this.pidsDir, `${descriptor.name.toLowerCase().replace(/_/g, '-')}.pid`);

    this.states.set(descriptor.name, {
      descriptor,
      process: null,
      pid: null,
      status: 'STOPPED',
      restarts: 0,
      lastStartedAt: null,
      lastCrashAt: null,
      logPath,
      pidPath,
    });
  }

  async startAll(): Promise<void> {
    this.isShuttingDown = false;
    for (const name of this.states.keys()) {
      await this.startService(name);
    }
  }

  async startService(name: string): Promise<boolean> {
    const state = this.states.get(name);
    if (!state) return false;

    // Check duplicate process via PID file
    if (fs.existsSync(state.pidPath)) {
      try {
        const existingPid = parseInt(fs.readFileSync(state.pidPath, 'utf8').trim(), 10);
        if (existingPid && this.isPidAlive(existingPid)) {
          console.warn(`[Supervisor] Service ${name} already running on PID ${existingPid}. Preventing duplicate process.`);
          state.pid = existingPid;
          state.status = 'RUNNING';
          return true;
        }
      } catch {}
    }

    state.status = 'STARTING';
    const tsxCli = path.join(state.descriptor.cwd, 'node_modules', 'tsx', 'dist', 'cli.mjs');
    const logStream = fs.createWriteStream(state.logPath, { flags: 'a' });

    const fullEnv = {
      ...process.env,
      ...state.descriptor.env,
      PORT: String(state.descriptor.port),
    };

    const child = spawn(process.execPath, [tsxCli, state.descriptor.script], {
      cwd: state.descriptor.cwd,
      env: fullEnv,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const pid = child.pid ?? 0;
    state.process = child;
    state.pid = pid;
    state.lastStartedAt = new Date();
    fs.writeFileSync(state.pidPath, String(pid), 'utf8');

    child.stdout?.on('data', (data) => {
      const line = `[${new Date().toISOString()}] [INFO] [${name}] ${data.toString()}`;
      logStream.write(line);
    });

    child.stderr?.on('data', (data) => {
      const line = `[${new Date().toISOString()}] [ERROR] [${name}] ${data.toString()}`;
      logStream.write(line);
    });

    child.on('exit', (code, signal) => {
      logStream.write(`[${new Date().toISOString()}] [WARN] [${name}] Process exited with code ${code}, signal ${signal}\n`);
      this.cleanupPid(state.pidPath);

      if (!this.isShuttingDown) {
        state.status = 'CRASHED';
        state.lastCrashAt = new Date();
        state.restarts++;

        const maxRestarts = state.descriptor.maxRestarts ?? 5;
        if (state.restarts <= maxRestarts) {
          const backoffMs = Math.min(1000 * Math.pow(2, state.restarts - 1), 10000);
          console.log(`[Supervisor] Service ${name} crashed (restart ${state.restarts}/${maxRestarts}). Auto-restarting in ${backoffMs}ms...`);
          state.status = 'RESTARTING';
          setTimeout(() => {
            if (!this.isShuttingDown) {
              void this.startService(name);
            }
          }, backoffMs);
        } else {
          console.error(`[Supervisor] Service ${name} exceeded max restart limit (${maxRestarts}). Left in CRASHED state.`);
        }
      } else {
        state.status = 'STOPPED';
      }
    });

    state.status = 'RUNNING';
    return true;
  }

  async stopAll(): Promise<void> {
    this.isShuttingDown = true;
    for (const name of this.states.keys()) {
      await this.stopService(name);
    }
  }

  async stopService(name: string): Promise<void> {
    const state = this.states.get(name);
    if (!state) return;

    if (state.process && state.pid) {
      try {
        state.process.kill('SIGINT');
      } catch {}
    }
    this.cleanupPid(state.pidPath);
    state.status = 'STOPPED';
    state.process = null;
    state.pid = null;
  }

  async probeService(name: string): Promise<{ liveness: boolean; readiness: boolean; latencyMs: number }> {
    const state = this.states.get(name);
    if (!state) return { liveness: false, readiness: false, latencyMs: 0 };

    const start = Date.now();
    let liveness = false;
    let readiness = false;

    try {
      const liveRes = await this.httpGet(`http://127.0.0.1:${state.descriptor.port}${state.descriptor.healthPath}`);
      liveness = liveRes.statusCode >= 200 && liveRes.statusCode < 500;
    } catch {}

    try {
      const readyRes = await this.httpGet(`http://127.0.0.1:${state.descriptor.port}${state.descriptor.readyPath}`);
      readiness = readyRes.statusCode === 200;
    } catch {}

    return {
      liveness,
      readiness,
      latencyMs: Date.now() - start,
    };
  }

  getStatus(): Record<string, any> {
    const result: Record<string, any> = {};
    for (const [name, state] of this.states.entries()) {
      result[name] = {
        name,
        status: state.status,
        pid: state.pid,
        port: state.descriptor.port,
        restarts: state.restarts,
        lastStartedAt: state.lastStartedAt,
        lastCrashAt: state.lastCrashAt,
        logPath: state.logPath,
      };
    }
    return result;
  }

  private isPidAlive(pid: number): boolean {
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  }

  private cleanupPid(pidPath: string): void {
    try {
      if (fs.existsSync(pidPath)) {
        fs.unlinkSync(pidPath);
      }
    } catch {}
  }

  private httpGet(url: string, timeoutMs = 2000): Promise<{ statusCode: number; body: string }> {
    return new Promise((resolve, reject) => {
      const parsed = new URL(url);
      const req = http.request({
        hostname: parsed.hostname,
        port: parsed.port,
        path: parsed.pathname + parsed.search,
        method: 'GET',
        timeout: timeoutMs,
      }, (res) => {
        let raw = '';
        res.on('data', c => { raw += c; });
        res.on('end', () => resolve({ statusCode: res.statusCode ?? 500, body: raw }));
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
      req.end();
    });
  }
}

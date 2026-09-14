/**
 * Controlled Transports for Phase F — Controlled End-to-End Gate Integration.
 *
 * Implements NeuralQueryTransport and NeuralExperienceTransport by executing
 * the real PUB Neural domain services via the Python Bridge Runner (src.gate.bridge_runner).
 *
 * This achieves real cross-repository behavioral integration between PDL and PUB Neural
 * without any TCP listener, HTTP server, REST daemon, or MCP server.
 */

import { spawnSync } from 'child_process';
import { existsSync, unlinkSync, readFileSync } from 'fs';
import { resolve } from 'path';
import type {
  NeuralQueryTransport,
} from '../../../src/pdl/neural/query-transport.js';
import type {
  NeuralQueryRequestPayload,
  NeuralQueryResponsePayload,
} from '../../../src/pdl/neural/query-types.js';
import type {
  NeuralExperienceTransport,
} from '../../../src/pdl/neural/experience-transport.js';
import type {
  ExperienceWritebackResponsePayload,
  NeuralExperienceRecordPayload,
} from '../../../src/pdl/neural/experience-types.js';

export const PUB_NEURAL_DIR =
  process.env.PUB_NEURAL_DIR ||
  resolve(process.cwd(), '../PUB NEURAL');

export interface ProcessQueryTransportOptions {
  neuralDir?: string;
  mode?: 'pilot' | 'empty' | 'abstain' | 'unavailable';
  timeoutMs?: number;
}

export class ControlledProcessNeuralQueryTransport implements NeuralQueryTransport {
  private readonly neuralDir: string;
  private mode: string;
  private readonly timeoutMs: number;
  private callCount = 0;

  constructor(options: ProcessQueryTransportOptions = {}) {
    this.neuralDir = options.neuralDir || PUB_NEURAL_DIR;
    this.mode = options.mode || 'pilot';
    this.timeoutMs = options.timeoutMs || 10000;
  }

  setMode(mode: 'pilot' | 'empty' | 'abstain' | 'unavailable'): void {
    this.mode = mode;
  }

  getCallCount(): number {
    return this.callCount;
  }

  async sendQuery(payload: NeuralQueryRequestPayload): Promise<NeuralQueryResponsePayload> {
    this.callCount++;

    if (this.mode === 'unavailable') {
      return {
        request_id: payload.request_id,
        status: 'UNAVAILABLE',
        results: [],
        reason: 'Controlled transport simulated offline / unreachable backend',
      };
    }

    const args = ['-B', '-m', 'src.gate.bridge_runner', '--query', '--mode', this.mode];
    const proc = spawnSync('python', args, {
      cwd: this.neuralDir,
      input: JSON.stringify(payload),
      encoding: 'utf8',
      timeout: this.timeoutMs,
      env: { ...process.env, PYTHONUNBUFFERED: '1' },
    });

    if (proc.error) {
      throw new Error(`Failed to spawn Python bridge runner: ${proc.error.message}`);
    }

    if (proc.status !== 0) {
      const stderr = proc.stderr?.trim() || `Process exited with code ${proc.status}`;
      throw new Error(`Python bridge runner failed: ${stderr}`);
    }

    try {
      return JSON.parse(proc.stdout.trim()) as NeuralQueryResponsePayload;
    } catch (parseErr: any) {
      throw new Error(`Failed to parse bridge runner output: ${parseErr.message}. Stdout was: ${proc.stdout}`);
    }
  }
}

export interface ProcessExperienceTransportOptions {
  neuralDir?: string;
  sinkFile?: string;
  simulateUnavailable?: boolean;
  timeoutMs?: number;
}

export class ControlledProcessNeuralExperienceTransport implements NeuralExperienceTransport {
  private readonly neuralDir: string;
  private readonly sinkFile?: string;
  private simulateUnavailable: boolean;
  private readonly timeoutMs: number;
  private callCount = 0;

  constructor(options: ProcessExperienceTransportOptions = {}) {
    this.neuralDir = options.neuralDir || PUB_NEURAL_DIR;
    this.sinkFile = options.sinkFile;
    this.simulateUnavailable = Boolean(options.simulateUnavailable);
    this.timeoutMs = options.timeoutMs || 10000;
  }

  setSimulateUnavailable(val: boolean): void {
    this.simulateUnavailable = val;
  }

  getCallCount(): number {
    return this.callCount;
  }

  async sendExperience(
    record: NeuralExperienceRecordPayload
  ): Promise<ExperienceWritebackResponsePayload> {
    this.callCount++;

    if (this.simulateUnavailable) {
      return {
        status: 'UNAVAILABLE',
        taskId: record.taskId,
        reason: 'Controlled transport simulated offline / unreachable experience sink',
      };
    }

    const args = ['-B', '-m', 'src.gate.bridge_runner', '--experience'];
    if (this.sinkFile) {
      args.push('--sink-file', this.sinkFile);
    }

    const proc = spawnSync('python', args, {
      cwd: this.neuralDir,
      input: JSON.stringify(record),
      encoding: 'utf8',
      timeout: this.timeoutMs,
      env: { ...process.env, PYTHONUNBUFFERED: '1' },
    });

    if (proc.error) {
      throw new Error(`Failed to spawn Python bridge runner: ${proc.error.message}`);
    }

    if (proc.status !== 0) {
      const stderr = proc.stderr?.trim() || `Process exited with code ${proc.status}`;
      throw new Error(`Python bridge runner failed: ${stderr}`);
    }

    try {
      return JSON.parse(proc.stdout.trim()) as ExperienceWritebackResponsePayload;
    } catch (parseErr: any) {
      throw new Error(`Failed to parse bridge runner experience output: ${parseErr.message}. Stdout was: ${proc.stdout}`);
    }
  }
}

/**
 * Inspection utility to read events recorded in the file-backed sink.
 */
export function dumpSinkEvents(sinkFile: string, neuralDir: string = PUB_NEURAL_DIR): {
  events: Record<string, any>;
  idempotency_records: Record<string, any>;
  count: number;
} {
  if (!existsSync(sinkFile)) {
    return { events: {}, idempotency_records: {}, count: 0 };
  }

  const args = ['-B', '-m', 'src.gate.bridge_runner', '--dump-events', sinkFile];
  const proc = spawnSync('python', args, {
    cwd: neuralDir,
    encoding: 'utf8',
  });

  if (proc.status === 0 && proc.stdout.trim()) {
    try {
      return JSON.parse(proc.stdout.trim());
    } catch {
      // Fallback to direct read
    }
  }

  try {
    const raw = JSON.parse(readFileSync(sinkFile, 'utf8'));
    return {
      events: raw.events || {},
      idempotency_records: raw.idempotency_records || {},
      count: Object.keys(raw.events || {}).length,
    };
  } catch {
    return { events: {}, idempotency_records: {}, count: 0 };
  }
}

export function cleanSinkFile(sinkFile: string): void {
  if (existsSync(sinkFile)) {
    try {
      unlinkSync(sinkFile);
    } catch {
      // Ignore cleanup error on windows locks
    }
  }
}

/**
 * Phase 5.5 Step 1: Persistent Fail-Closed Emergency Kill Switch.
 *
 * Implements deterministic emergency stop evaluation:
 * - Database state (pdl_governance_state.kill_switch_active)
 * - Local file override (.pdl-killswitch or custom path)
 * - Process environment override (PDL_EMERGENCY_STOP=true)
 *
 * Precedence Rule: Fail-Closed OR Logic.
 * If ANY stop signal is active or if database read fails, effective state is STOP.
 */

import fs from 'node:fs';
import path from 'node:path';
import type { Pool } from 'pg';

export interface KillSwitchStatus {
  active: boolean;
  reason: string;
  sources: {
    db: boolean | 'error';
    file: boolean;
    env: boolean;
  };
}

export interface KillSwitchOptions {
  pool?: Pool;
  filePath?: string;
}

export class PdlKillSwitch {
  private pool?: Pool;
  private filePath: string;

  constructor(options?: KillSwitchOptions) {
    this.pool = options?.pool;
    this.filePath =
      options?.filePath ||
      process.env.PDL_KILL_SWITCH_FILE ||
      path.resolve(process.cwd(), '.pdl-killswitch');
  }

  public setPool(pool: Pool): void {
    this.pool = pool;
  }

  public getFilePath(): string {
    return this.filePath;
  }

  /**
   * Evaluates the local emergency file override.
   * File presence indicating stop is checked safely.
   */
  public isLocalFileActive(): boolean {
    try {
      if (fs.existsSync(this.filePath)) {
        const content = fs.readFileSync(this.filePath, 'utf8').trim().toLowerCase();
        // If file exists and doesn't explicitly declare "run" or "false", it triggers STOP
        if (content === 'run' || content === 'false' || content === '0' || content === 'disabled') {
          return false;
        }
        return true;
      }
      // Check secondary legacy filename fallback if primary does not exist
      const altPath = path.resolve(process.cwd(), '.killswitch');
      if (fs.existsSync(altPath)) {
        const content = fs.readFileSync(altPath, 'utf8').trim().toLowerCase();
        return !(content === 'run' || content === 'false' || content === '0' || content === 'disabled');
      }
      return false;
    } catch {
      // Fail closed on filesystem error
      return true;
    }
  }

  /**
   * Evaluates process environment override.
   */
  public isEnvActive(): boolean {
    const val = (process.env.PDL_EMERGENCY_STOP || process.env.PDL_KILL_SWITCH || '').trim().toLowerCase();
    return val === 'true' || val === '1' || val === 'on' || val === 'active' || val === 'stop';
  }

  /**
   * Reads persistent database kill switch state from pdl_governance_state table.
   * Fail closed: returns 'error' if unreadable or disconnected.
   */
  public async getDatabaseState(): Promise<boolean | 'error'> {
    if (!this.pool) {
      return 'error';
    }
    try {
      const res = await this.pool.query(
        'SELECT kill_switch_active FROM pdl_governance_state WHERE id = $1 LIMIT 1',
        ['canonical']
      );
      if (!res.rows || res.rows.length === 0) {
        return 'error';
      }
      return Boolean(res.rows[0].kill_switch_active);
    } catch {
      return 'error';
    }
  }

  /**
   * Evaluates effective kill switch state across all sources.
   * Fail-Closed Precedence:
   * - If DB read errors -> STOP
   * - If DB is active -> STOP
   * - If Local file is active -> STOP
   * - If Environment is active -> STOP
   * - Only if DB=inactive AND File=inactive AND Env=inactive -> RUN
   */
  public async checkStatus(): Promise<KillSwitchStatus> {
    const envActive = this.isEnvActive();
    const fileActive = this.isLocalFileActive();
    const dbActive = await this.getDatabaseState();

    if (envActive) {
      return {
        active: true,
        reason: 'Emergency stop activated via environment variable (PDL_EMERGENCY_STOP=true)',
        sources: { db: dbActive, file: fileActive, env: true },
      };
    }

    if (fileActive) {
      return {
        active: true,
        reason: `Emergency stop activated via local override file (${this.filePath})`,
        sources: { db: dbActive, file: true, env: false },
      };
    }

    if (dbActive === 'error') {
      return {
        active: true,
        reason: 'Emergency stop active: Database governance state unreadable or disconnected (Fail-Closed)',
        sources: { db: 'error', file: fileActive, env: envActive },
      };
    }

    if (dbActive === true) {
      return {
        active: true,
        reason: 'Emergency stop active: Persistent database governance state has kill_switch_active = true',
        sources: { db: true, file: fileActive, env: envActive },
      };
    }

    return {
      active: false,
      reason: 'Kill switch is clear (All stop sources inactive)',
      sources: { db: false, file: false, env: false },
    };
  }

  /**
   * Synchronously checks if emergency stop is active without async database query.
   * Useful in high-frequency tight synchronous execution loops.
   */
  public isFastStopActive(): boolean {
    return this.isEnvActive() || this.isLocalFileActive();
  }

  /**
   * Updates database persistent kill switch state.
   */
  public async setDatabaseState(
    active: boolean,
    updatedBy = 'operator',
    reason = 'Manual operator update'
  ): Promise<void> {
    if (!this.pool) {
      throw new Error('Database pool not configured on PdlKillSwitch');
    }
    await this.pool.query(
      `INSERT INTO pdl_governance_state (id, kill_switch_active, updated_at, updated_by, reason)
       VALUES ('canonical', $1, now(), $2, $3)
       ON CONFLICT (id) DO UPDATE SET
         kill_switch_active = EXCLUDED.kill_switch_active,
         updated_at = now(),
         updated_by = EXCLUDED.updated_by,
         reason = EXCLUDED.reason`,
      [active, updatedBy, reason]
    );
  }

  /**
   * Creates emergency local file stop.
   */
  public createLocalFile(reason = 'Emergency stop file created'): void {
    fs.writeFileSync(this.filePath, `STOP: ${reason}\n${new Date().toISOString()}`, 'utf8');
  }

  /**
   * Removes emergency local file stop.
   */
  public removeLocalFile(): void {
    if (fs.existsSync(this.filePath)) {
      fs.unlinkSync(this.filePath);
    }
    const altPath = path.resolve(process.cwd(), '.killswitch');
    if (fs.existsSync(altPath)) {
      fs.unlinkSync(altPath);
    }
  }
}

export const defaultKillSwitch = new PdlKillSwitch();

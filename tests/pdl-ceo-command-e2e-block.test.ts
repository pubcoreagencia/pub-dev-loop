/**
 * E2E Proof: CEO Command Gateway against Real PostgreSQL pdl_governance_state.
 *
 * Strictly demonstrates the core requirement:
 * With canonical database state (Level 0, Kill Switch ACTIVE):
 * CEO Command -> Gateway -> Real Database Governance -> BLOCK -> CEO Result
 *
 * PROVES FACTUALLY:
 * 1. Zero tasks are created or enqueued in PostgreSQL.
 * 2. Governance limits in PostgreSQL are NOT modified or bypassed.
 * 3. Kill Switch remains ACTIVE.
 * 4. Status returned to CEO is BLOCKED with audit events and correlationId.
 */

import { describe, it, expect, afterAll } from 'vitest';
import pg from 'pg';
import { CeoCommandGateway } from '../src/pdl/ceo/command-gateway.js';
import type { CeoCommandInputPacket, TrustedCeoContext } from '../src/pdl/ceo/types.js';
import { PdlGovernanceEngine } from '../src/pdl/governance/policy-engine.js';
import { PostgresTaskRepository } from '../src/repository.js';
import { TaskIntakeService } from '../src/pdl/service/task-intake-service.js';

describe('PDL CEO Command Proof V1 — Real Database Canonical BLOCK E2E', () => {
  const pool = new pg.Pool({
    connectionString: 'postgres://pubdevloop:pubdevloop@localhost:5432/pubdevloop',
  });

  const validCeoContext: TrustedCeoContext = {
    operatorId: 'MATHEUS',
    role: 'CEO',
    channel: 'chat',
    verified: true,
  };

  afterAll(async () => {
    await pool.end();
  });

  it('CEO Command E2E: Real canonical PostgreSQL state (Level 0, Kill Switch ACTIVE) blocks execution without creating tasks', async () => {
    // 1. Verify canonical DB state before test
    const govRes = await pool.query('SELECT * FROM pdl_governance_state WHERE id = $1', ['canonical']);
    expect(govRes.rows.length).toBe(1);
    const govState = govRes.rows[0];
    expect(govState.active_level).toBe(0);
    expect(govState.kill_switch_active).toBe(true);

    const initialTasksRes = await pool.query('SELECT count(*) FROM tasks');
    const initialTaskCount = Number(initialTasksRes.rows[0].count);

    // 2. Instantiate Gateway wiring REAL PostgreSQL governance and intake
    const governance = new PdlGovernanceEngine({ pool });
    const taskRepo = new PostgresTaskRepository(pool);
    const intakeService = new TaskIntakeService(pool);

    const gateway = new CeoCommandGateway({
      governance,
      taskRepo,
      intakeService,
      pool,
    });

    // 3. Issue CEO Directive
    const ceoPacket: CeoCommandInputPacket = {
      command: 'PDL, analise o estado atual do projeto e retorne um diagnóstico. Não altere arquivos.',
      project: 'pub-dev-loop',
      trustedContext: validCeoContext,
    };

    const result = await gateway.handleCommand(ceoPacket);

    // 4. Assertions on CEO Result
    expect(result.status).toBe('BLOCKED');
    expect(result.issuedBy).toBe('MATHEUS');
    expect(result.correlationId).toBeDefined();
    expect(result.correlationId).toMatch(/^ceo-corr-/);
    expect(result.governanceDecision.allowed).toBe(false);
    expect(result.governanceDecision.reasonCode).toBe('KILL_SWITCH_ACTIVE');
    expect(result.governanceDecision.killSwitchActive).toBe(true);
    expect(result.governanceDecision.activeLevel).toBe(0);
    expect(result.taskId).toBeNull();

    // 5. Verify Database Invariant: ZERO tasks were created!
    const finalTasksRes = await pool.query('SELECT count(*) FROM tasks');
    const finalTaskCount = Number(finalTasksRes.rows[0].count);
    expect(finalTaskCount).toBe(initialTaskCount);

    // 6. Verify Database Invariant: Governance remains Level 0 / Kill Switch active
    const postGovRes = await pool.query('SELECT * FROM pdl_governance_state WHERE id = $1', ['canonical']);
    const postGovState = postGovRes.rows[0];
    expect(postGovState.active_level).toBe(0);
    expect(postGovState.kill_switch_active).toBe(true);

    // 7. Verify Audit Events recorded in result
    expect(result.events.some((e) => e.type === 'COMMAND_RECEIVED')).toBe(true);
    expect(result.events.some((e) => e.type === 'GOVERNANCE_EVALUATED')).toBe(true);
    expect(result.events.some((e) => e.type === 'COMMAND_BLOCKED')).toBe(true);
  });
});

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import { execSync } from 'node:child_process';
import { PostgresTaskRepository } from '../src/repository.js';

function getPgPassword(): string {
  if (process.env.PGPASSWORD) return process.env.PGPASSWORD;
  try {
    const out = execSync('powershell -Command "(Get-ItemProperty -Path \'HKCU:\\Environment\' -Name \'PGPASSWORD\').PGPASSWORD"', { encoding: 'utf8' }).trim();
    if (out) return out;
  } catch {}
  return '';
}

describe('PostgresTaskRepository — Canonical Task Claim Semantics (Phase 4B)', () => {
  let pool: Pool;
  let repo: PostgresTaskRepository;

  beforeAll(() => {
    const pass = getPgPassword();
    const connStr = process.env.DATABASE_URL ||
      `postgres://postgres:${encodeURIComponent(pass)}@127.0.0.1:5432/pub_dev_loop_e2e`;
    pool = new Pool({ connectionString: connStr });
    repo = new PostgresTaskRepository(pool);
  });

  afterAll(async () => {
    await pool.end().catch(() => {});
  });

  it('claims an ordinary PDL task with prototype_session_id = NULL', async () => {
    const task = await repo.create({
      project: 'claim-test-null',
      repository: 'https://github.com/pubcoreagencia/pub-dev-loop.git',
      objective: 'Claim ordinary task',
      prompt: 'Execute ordinary task',
      priority: 10,
    });
    expect(task.prototypeSessionId).toBeNull();
    expect(task.status).toBe('QUEUED');

    const workerName = `worker-claim-null-${Date.now()}`;
    const claimed = await repo.claim(workerName);

    expect(claimed).not.toBeNull();
    expect(claimed?.id).toBe(task.id);
    expect(claimed?.status).toBe('ASSIGNED');
    expect(claimed?.worker).toBe(workerName);
    expect(claimed?.leaseOwner).toBe(workerName);
    expect(claimed?.leaseDeadline).toBeDefined();
    expect(new Date(claimed!.leaseDeadline!).getTime()).toBeGreaterThan(Date.now());
  });

  it('claims a promoted PDL task with prototype_session_id != NULL (external UUID)', async () => {
    const externalSessionId = randomUUID();
    const task = await repo.create({
      project: 'claim-test-promoted',
      repository: 'https://github.com/pubcoreagencia/pub-dev-loop.git',
      objective: 'Claim promoted task',
      prompt: 'Execute promoted task from PP',
      priority: 20,
      prototypeSessionId: externalSessionId,
    });
    expect(task.prototypeSessionId).toBe(externalSessionId);
    expect(task.status).toBe('QUEUED');

    const workerName = `worker-claim-ext-${Date.now()}`;
    const claimed = await repo.claim(workerName);

    expect(claimed).not.toBeNull();
    expect(claimed?.id).toBe(task.id);
    expect(claimed?.prototypeSessionId).toBe(externalSessionId);
    expect(claimed?.status).toBe('ASSIGNED');
    expect(claimed?.worker).toBe(workerName);
    expect(claimed?.leaseOwner).toBe(workerName);
    expect(claimed?.leaseDeadline).toBeDefined();
  });

  it('guarantees atomic claim with no duplicate claim under concurrent workers', async () => {
    const externalSessionId = randomUUID();
    const task = await repo.create({
      project: 'claim-test-concurrent',
      repository: 'https://github.com/pubcoreagencia/pub-dev-loop.git',
      objective: 'Claim under contention',
      prompt: 'Ensure atomic claim',
      priority: 30,
      prototypeSessionId: externalSessionId,
    });

    const [claimA, claimB, claimC] = await Promise.all([
      repo.claim('worker-alpha'),
      repo.claim('worker-beta'),
      repo.claim('worker-gamma'),
    ]);

    const claims = [claimA, claimB, claimC].filter((c) => c !== null && c.id === task.id);
    expect(claims).toHaveLength(1);

    const claimedTask = claims[0];
    expect(['worker-alpha', 'worker-beta', 'worker-gamma']).toContain(claimedTask.worker);
    expect(claimedTask.status).toBe('ASSIGNED');
  });

  it('preserves lease semantics and prevents re-claim while lease is active', async () => {
    const task = await repo.create({
      project: 'claim-test-lease',
      repository: 'https://github.com/pubcoreagencia/pub-dev-loop.git',
      objective: 'Test lease semantics',
      prompt: 'Keep lease intact',
      priority: 5,
    });

    const firstClaim = await repo.claim('worker-first');
    expect(firstClaim?.id).toBe(task.id);
    expect(firstClaim?.status).toBe('ASSIGNED');

    const secondClaim = await repo.claim('worker-second');
    if (secondClaim) {
      expect(secondClaim.id).not.toBe(task.id);
    } else {
      expect(secondClaim).toBeNull();
    }
  });
});

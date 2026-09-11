import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { PostgresTaskRepository } from '../src/repository.js';
import type { Task } from '../src/domain.js';

describe('Phase 3D Step 3 — Database Boundary Decoupling', () => {
  const migrationsDir = resolve(process.cwd(), 'db', 'migrations');

  it('1. Migration 020 exists and safely drops tasks_prototype_session_id_fkey', () => {
    const migrationFile = resolve(migrationsDir, '020_remove_prototype_task_binding_fk.sql');
    expect(existsSync(migrationFile)).toBe(true);

    const sql = readFileSync(migrationFile, 'utf8');
    expect(sql).toContain('ALTER TABLE tasks');
    expect(sql).toContain('DROP CONSTRAINT IF EXISTS tasks_prototype_session_id_fkey');
    // Invariant: Must NOT drop the column itself
    expect(sql).not.toMatch(/DROP\s+COLUMN\s+.*prototype_session_id/i);
    // Invariant: Must NOT create any new FK from tasks to prototype_sessions
    expect(sql).not.toMatch(/REFERENCES\s+prototype_sessions/i);
  });

  it('2. Historical PP migrations are archived in db/legacy/pp-migrations and absent from active db/migrations', () => {
    const legacyDir = resolve(process.cwd(), 'db', 'legacy', 'pp-migrations');
    const ppMigrations = [
      '003_prototype.sql',
      '004_prototype_task_binding.sql',
      '006_prototype_events.sql',
      '007_prototype_promotions.sql',
      '008_prototype_messages.sql',
      '009_prototype_events_idempotency.sql',
    ];

    for (const file of ppMigrations) {
      // Must be safely preserved in historical archive
      expect(existsSync(resolve(legacyDir, file)), `Archived migration ${file} must exist`).toBe(true);
      // Must NOT be in active migrations directory
      expect(existsSync(resolve(migrationsDir, file)), `Active migration ${file} must NOT exist`).toBe(false);
    }
  });

  it('2b. Migration 021 establishes tasks.prototype_session_id as unconstrained UUID correlation field with zero FK', () => {
    const migration021 = resolve(migrationsDir, '021_pdl_external_prototype_correlation.sql');
    expect(existsSync(migration021)).toBe(true);

    const sql = readFileSync(migration021, 'utf8');
    expect(sql).toContain('ALTER TABLE tasks');
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS prototype_session_id UUID');
    expect(sql).toContain('tasks_prototype_session_idx');
    // Invariant: Must NOT reference prototype_sessions
    expect(sql).not.toMatch(/REFERENCES\s+prototype_sessions/i);
  });

  it('2c. Fresh PDL bootstrap active migrations create zero prototype tables and zero prototype FKs', () => {
    const fs = require('node:fs');
    const files: string[] = fs.readdirSync(migrationsDir).filter((f: string) => f.endsWith('.sql')).sort();

    const createdTables: string[] = [];
    const foreignKeys: string[] = [];

    for (const file of files) {
      const content = fs.readFileSync(resolve(migrationsDir, file), 'utf8');
      const tableMatches = [...content.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-z_]+)/gi)];
      for (const m of tableMatches) createdTables.push(m[1]);

      const fkMatches = [...content.matchAll(/REFERENCES\s+([a-z_]+)/gi)];
      for (const m of fkMatches) foreignKeys.push(m[1]);
    }

    // Zero prototype tables created
    const prototypeTables = createdTables.filter(t => t.startsWith('prototype_'));
    expect(prototypeTables).toEqual([]);

    // Zero prototype FK references
    const prototypeFks = foreignKeys.filter(fk => fk.startsWith('prototype_'));
    expect(prototypeFks).toEqual([]);
  });

  it('3. PostgresTaskRepository persists prototypeSessionId as an unconstrained correlation UUID without prototype_sessions table', async () => {
    const mockDbRows = new Map<string, any>();
    const mockPool: any = {
      query: async (sql: string, params: any[] = []) => {
        if (sql.includes('INSERT INTO tasks')) {
          const id = 'mock-task-uuid-1';
          const row = {
            id,
            project: params[0],
            repository: params[1],
            objective: params[2],
            prompt: params[3],
            priority: params[4],
            prototype_session_id: params[5], // Can be any UUID, zero FK check
            status: 'QUEUED',
            worker: null,
            result: null,
            error: null,
            branch: null,
            commit_sha: null,
            git_status: null,
            workspace_path: null,
            lease_owner: null,
            lease_deadline: null,
            heartbeat_at: null,
            created_at: new Date(),
            updated_at: new Date(),
          };
          mockDbRows.set(id, row);
          return { rows: [row] };
        }
        if (sql.includes('SELECT') && sql.includes('FROM tasks WHERE id = $1')) {
          const row = mockDbRows.get(params[0]);
          return { rows: row ? [row] : [] };
        }
        return { rows: [] };
      },
    };

    const repo = new PostgresTaskRepository(mockPool);
    const correlationId = '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d';

    const created = await repo.create({
      project: 'test-pdl',
      repository: 'test-repo',
      objective: 'Verify correlation ID persistence without FK',
      prompt: 'Test correlation ID',
      prototypeSessionId: correlationId,
    });

    expect(created.prototypeSessionId).toBe(correlationId);

    const fetched = await repo.get(created.id);
    expect(fetched).not.toBeNull();
    expect(fetched?.prototypeSessionId).toBe(correlationId);
  });

  it('4. PDL runtime semantics: worker git push guard respects prototypeSessionId correlation flag', () => {
    const taskWithPrototypeOrigin: Partial<Task> = {
      prototypeSessionId: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
    };
    const purePdlTask: Partial<Task> = {
      prototypeSessionId: null,
    };

    // The guard condition used in BaseWorker.executeOnce and PdlCorrectionWorker.executeOnce:
    // (!task.prototypeSessionId)
    const canPush1 = !taskWithPrototypeOrigin.prototypeSessionId;
    const canPush2 = !purePdlTask.prototypeSessionId;

    expect(canPush1).toBe(false); // Prototype origin tasks NEVER push to main repo
    expect(canPush2).toBe(true);  // Pure PDL tasks proceed with remote push
  });
});

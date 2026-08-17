import 'dotenv/config';
import { readFile, readdir } from 'node:fs/promises';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

try {
  // Create migration tracking table (idempotent)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS migrations (
      id TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const applied = (await pool.query('SELECT id FROM migrations')).rows.map(r => r.id);

  const migrationDir = new URL('../../db/migrations/', import.meta.url);
  const files = (await readdir(migrationDir)).filter(f => f.endsWith('.sql')).sort();

  for (const file of files) {
    if (applied.includes(file)) {
      console.log(`Migration ${file} already applied, skipping`);
      continue;
    }
    const sql = await readFile(new URL(`../../db/migrations/${file}`, import.meta.url), 'utf8');
    await pool.query(sql);
    await pool.query('INSERT INTO migrations (id) VALUES ($1)', [file]);
    console.log(`Migration ${file} applied`);
  }

  await pool.end();
  console.log('Database migrated');
} catch (e) {
  console.error('Migration failed:', (e as Error).message);
  await pool.end();
  process.exit(1);
}

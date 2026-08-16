import 'dotenv/config'; import { readFile } from 'node:fs/promises'; import { Pool } from 'pg';
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const sql = await readFile(new URL('../../db/migrations/001_initial.sql', import.meta.url), 'utf8');
await pool.query(sql); await pool.end(); console.log('Database migrated');

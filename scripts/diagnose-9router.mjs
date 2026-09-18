import { Pool } from 'pg';
import { DEFAULT_ROUTER_BASE_URL, normalizeBaseUrl } from '../dist/providers/shared.js';

const PG_URL = process.env.DATABASE_URL || 'postgres://pubdevloop:pubdevloop@localhost:5432/pubdevloop';
const baseUrl = normalizeBaseUrl(process.env.ROUTER_BASE_URL, DEFAULT_ROUTER_BASE_URL);

function log(label, value) {
  console.log(label + ':', typeof value === 'string' ? value : JSON.stringify(value, null, 2));
}

async function main() {
  console.log('PDL 9ROUTER DIAGNOSTIC');
  console.log('======================');
  console.log('Base URL:', baseUrl);
  console.log('API key configured:', Boolean(process.env.ROUTER_API_KEY));

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(baseUrl + '/models', {
      method: 'GET',
      headers: process.env.ROUTER_API_KEY
        ? { Authorization: 'Bearer ' + process.env.ROUTER_API_KEY }
        : {},
      signal: controller.signal,
    });
    const body = await response.text().catch(() => '');
    log('HTTP status', response.status);
    log('HTTP body preview', body.slice(0, 500));
    if (!response.ok) {
      process.exitCode = 2;
    }
  } catch (error) {
    log('NETWORK ERROR', error instanceof Error ? error.message : String(error));
    process.exitCode = 2;
  } finally {
    clearTimeout(timer);
  }

  const pool = new Pool({ connectionString: PG_URL });
  try {
    const result = await pool.query(
      'SELECT active_level, kill_switch_active, allowed_products, max_consecutive_tasks, max_consecutive_failures, max_correction_attempts FROM pdl_governance_state WHERE id = $1',
      ['canonical'],
    );
    const row = result.rows[0];
    log('Governance', row || null);
    if (
      !row ||
      Number(row.active_level) !== 0 ||
      row.kill_switch_active !== true
    ) {
      console.log('Governance canonical baseline: FAIL');
      process.exitCode = 3;
    } else {
      console.log('Governance canonical baseline: PASS');
    }
  } finally {
    await pool.end();
  }

  process.exit(process.exitCode || 0);
}

main().catch((error) => {
  console.error('FATAL:', error);
  process.exit(1);
});

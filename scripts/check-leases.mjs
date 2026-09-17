import { Pool } from 'pg';

const pool = new Pool({
  connectionString: 'postgres://pubdevloop:pubdevloop@localhost:5432/pubdevloop',
});

async function main() {
  const gov = await pool.query('SELECT active_level, kill_switch_active FROM pdl_governance_state WHERE id = $1', ['canonical']);
  const leases = await pool.query("SELECT count(*) FROM tasks WHERE status = 'RUNNING'");
  console.log('GOV:', JSON.stringify(gov.rows[0]));
  console.log('ACTIVE_LEASES:', leases.rows[0].count);
  await pool.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

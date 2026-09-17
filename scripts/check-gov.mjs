import { Pool } from 'pg';

const pool = new Pool({
  connectionString: 'postgres://pubdevloop:pubdevloop@localhost:5432/pubdevloop',
});

async function main() {
  const gov = await pool.query('SELECT * FROM pdl_governance_state');
  console.log('GOVERNANCE_ROWS:', gov.rows);
  await pool.end();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});

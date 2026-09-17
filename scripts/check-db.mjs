import { Pool } from 'pg';

const pool = new Pool({
  connectionString: 'postgres://pubdevloop:pubdevloop@localhost:5432/pubdevloop',
});

async function main() {
  const res = await pool.query("SELECT id, project, repository, branch, commit_sha, status, prototype_session_id, result FROM tasks WHERE status = 'COMPLETED' LIMIT 3");
  console.log('COMPLETED TASKS DETAILS:', JSON.stringify(res.rows, null, 2));
  await pool.end();
}

main().catch(err => {
  console.error('ERROR:', err);
  process.exit(1);
});

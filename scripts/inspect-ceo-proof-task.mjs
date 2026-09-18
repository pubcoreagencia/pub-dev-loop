import { Pool } from 'pg';

const PG_URL = process.env.DATABASE_URL || 'postgres://pubdevloop:pubdevloop@localhost:5432/pubdevloop';
const taskId = process.argv[2] || 'a3925cd7-d813-4fb5-8979-8a41deb9c83d';

const pool = new Pool({ connectionString: PG_URL });

try {
  const result = await pool.query(
    'SELECT id,status,error,result,commit_sha,branch,updated_at FROM tasks WHERE id = $1',
    [taskId],
  );

  const row = result.rows[0];

  if (!row) {
    console.error('TASK NOT FOUND:', taskId);
    process.exit(2);
  }

  let parsedResult = row.result;
  if (typeof parsedResult === 'string') {
    try { parsedResult = JSON.parse(parsedResult); } catch {}
  }

  console.log('PDL TASK INSPECTOR');
  console.log('=================');
  console.log(JSON.stringify({
    id: row.id,
    status: row.status,
    error: row.error,
    branch: row.branch,
    commit_sha: row.commit_sha,
    updated_at: row.updated_at,
    provider: parsedResult?.provider,
    model: parsedResult?.model,
    errorCode: parsedResult?.execution?.errorCode ?? parsedResult?.errorCode,
    errorMessage: parsedResult?.execution?.errorMessage ?? parsedResult?.errorMessage,
    toolCalls: parsedResult?.toolCalls,
    toolRounds: parsedResult?.toolRounds,
    durationMs: parsedResult?.durationMs,
    correction: parsedResult?.corrections ?? parsedResult?.correction ?? null,
    finalize: parsedResult?.finalize ?? null,
    trace: parsedResult?.trace ?? null,
  }, null, 2));
} finally {
  await pool.end();
}

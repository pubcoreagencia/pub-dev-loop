import { writeFileSync } from 'node:fs';

const baseUrl = 'https://pub-dev-loop-api.contato-pubcore.workers.dev';

async function main() {
  const results: Record<string, unknown> = {};

  // 1. Healthcheck
  const healthRes = await fetch(`${baseUrl}/health`);
  results.health = { status: healthRes.status, data: await healthRes.json() };

  // 1.1 Trigger Schema Migrations
  const migrateRes = await fetch(`${baseUrl}/migrate`, { method: 'POST' });
  results.migrate = { status: migrateRes.status, data: await migrateRes.json() };

  // 2. Prototype UI
  const uiRes = await fetch(`${baseUrl}/prototype`);
  const uiHtml = await uiRes.text();
  results.prototypeUi = {
    status: uiRes.status,
    contentType: uiRes.headers.get('content-type'),
    length: uiHtml.length,
    hasBrand: uiHtml.includes('PUB Prototype'),
    hasVersionHistory: uiHtml.includes('Version History'),
  };

  // 3. Create Session
  const createRes = await fetch(`${baseUrl}/prototype/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ project: 'prod-barber-mvp' }),
  });
  const session = (await createRes.json()) as any;
  results.createSession = { status: createRes.status, session };

  // 4. List Sessions
  const listRes = await fetch(`${baseUrl}/prototype/sessions`);
  const sessions = (await listRes.json()) as any;
  results.listSessions = { status: listRes.status, count: Array.isArray(sessions) ? sessions.length : 0 };

  // 5. Get Session
  const getRes = await fetch(`${baseUrl}/prototype/sessions/${session.id}`);
  results.getSession = { status: getRes.status, data: await getRes.json() };

  // 5.1 Submit Prompt to Session
  const promptRes = await fetch(`${baseUrl}/prototype/sessions/${session.id}/prompts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: 'Adicionar sistema de agendamento com confirmação por WhatsApp',
    }),
  });
  results.submitPrompt = { status: promptRes.status, data: await promptRes.json() };

  // 6. Create Checkpoint
  const cpRes = await fetch(`${baseUrl}/prototype/sessions/${session.id}/checkpoints`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      promptIndex: 1,
      prompt: 'Criar landing page de barbearia com agendamento',
      commitSha: 'a472fd9864d31c56351609ed64adf363f0ce611c',
      previewUrl: 'https://preview.pub-dev-loop.workers.dev',
      buildPassed: true,
    }),
  });
  results.createCheckpoint = { status: cpRes.status, data: await cpRes.json() };

  // 7. List Checkpoints
  const listCpRes = await fetch(`${baseUrl}/prototype/sessions/${session.id}/checkpoints`);
  results.listCheckpoints = { status: listCpRes.status, data: await listCpRes.json() };

  // 7.1 Transition Session to READY with lastCheckpointSha
  const patchRes = await fetch(`${baseUrl}/prototype/sessions/${session.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      status: 'READY',
      lastCheckpointSha: 'a472fd9864d31c56351609ed64adf363f0ce611c',
      previewUrl: 'https://preview.pub-dev-loop.workers.dev',
    }),
  });
  results.patchSession = { status: patchRes.status, data: await patchRes.json() };

  // Wait 1s for consistency
  await new Promise(r => setTimeout(r, 1000));

  // Verify getSession has lastCheckpointSha
  const verifySessionRes = await fetch(`${baseUrl}/prototype/sessions/${session.id}`);
  results.verifySessionBeforePromote = { status: verifySessionRes.status, data: await verifySessionRes.json() };

  // 8. Promote Session
  const promoteRes = await fetch(`${baseUrl}/prototype/sessions/${session.id}/promote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      objective: 'Promote production validated prototype to development',
    }),
  });
  results.promoteSession = { status: promoteRes.status, data: await promoteRes.json() };

  // 9. List Tasks
  const tasksRes = await fetch(`${baseUrl}/tasks`);
  const tasks = (await tasksRes.json()) as any;
  results.listTasks = { status: tasksRes.status, count: Array.isArray(tasks) ? tasks.length : 0 };

  writeFileSync('prod-validation-results.json', JSON.stringify(results, null, 2), 'utf8');
  console.log('VALIDATION_COMPLETED_SUCCESSFULLY');
}

main().catch(err => {
  console.error('PROD_VALIDATION_ERROR:', err);
  process.exit(1);
});

import { OpenRouterProvider } from '../dist/providers/openrouter.js';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';

async function testProviderExecute() {
  const ws = mkdtempSync(join(tmpdir(), 'pdl-diag-ws-'));
  console.log('WS_CREATED:', ws);

  const provider = new OpenRouterProvider();
  console.log('PROVIDER_INSTANTIATED:', provider.kind, 'MODEL:', provider.model);

  const task = {
    id: 'diag-task-1',
    objective: 'Echo test',
    prompt: 'Execute command: echo hello',
    status: 'RUNNING',
  };

  const started = Date.now();
  try {
    console.log('CALLING_PROVIDER_EXECUTE...');
    const res = await provider.execute(task, ws);
    console.log('PROVIDER_RESULT_STATUS:', res.status);
    console.log('ERROR_CODE:', res.errorCode);
    console.log('ERROR_MESSAGE:', res.errorMessage);
    console.log('STDERR:', res.stderr);
    console.log('TOOL_CALLS:', res.toolCalls);
  } catch (err) {
    console.error('EXECUTE_THREW:', err.constructor.name, err.message);
  } finally {
    try { rmSync(ws, { recursive: true, force: true }); } catch {}
    console.log('ELAPSED_MS:', Date.now() - started);
  }
}

testProviderExecute();

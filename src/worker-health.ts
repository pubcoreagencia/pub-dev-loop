import 'dotenv/config';
import { AgentExecutor } from './executor.js';
import { commandExists } from './agent.js';
import { getCodexAuthStatus } from './auth.js';

const timeoutMs=5_000;
const agentMode = process.env.AGENT_MODE || 'mock';
const validMode=[agentMode].every(m => ['mock','codex'].includes(m));
// When AGENT_PROVIDER is set, the worker uses RouterWorker (not CodexWorker).
// The health check should recognize this mode as valid too.
const providerMode = Boolean(process.env.AGENT_PROVIDER);
const validProviderMode = providerMode || validMode;
const validTimeout=Number.isFinite(Number(process.env.AGENT_TIMEOUT_MS ?? 900000)) && Number(process.env.AGENT_TIMEOUT_MS ?? 900000)>0;
const executor=new AgentExecutor();
const [gitAvailable,codexAvailable,gitProbe,codexProbe]=await Promise.all([
  commandExists('git'), commandExists(process.env.CODEX_COMMAND ?? 'codex'),
  executor.execute({command:'git',args:['--version'],cwd:process.cwd(),timeoutMs}),
  executor.execute({command:process.env.CODEX_COMMAND ?? 'codex',args:['--version'],cwd:process.cwd(),timeoutMs})
]);
const healthy=Boolean(process.env.DATABASE_URL)&&validProviderMode&&validTimeout&&gitAvailable&&codexAvailable&&gitProbe.status==='COMPLETED'&&codexProbe.status==='COMPLETED';
const workerType = process.env.AGENT_PROVIDER ? 'router' : (agentMode === 'codex' ? 'codex' : 'mock');
console.log(JSON.stringify({
  status: healthy ? 'ok' : 'error',
  worker: workerType,
  mode: agentMode,
  provider: process.env.AGENT_PROVIDER || null,
  model: process.env.ROUTER_MODEL || null,
  git: gitProbe.status,
  codex: codexAvailable ? codexProbe.status : 'UNAVAILABLE',
  authReference: providerMode ? 'ROUTER_PROVIDER' : getCodexAuthStatus(),
  configuration: {
    databaseUrl: Boolean(process.env.DATABASE_URL),
    agentMode: agentMode,
    agentProvider: process.env.AGENT_PROVIDER || null,
    timeout: validTimeout,
  }
}));
process.exitCode = healthy ? 0 : 1;
import 'dotenv/config';
import { AgentExecutor } from './executor.js';
import { commandExists } from './agent.js';
import { getCodexAuthStatus } from './auth.js';

const timeoutMs=5_000;
const validMode=['mock','codex'].includes(process.env.AGENT_MODE ?? 'mock');
const validTimeout=Number.isFinite(Number(process.env.AGENT_TIMEOUT_MS ?? 900000)) && Number(process.env.AGENT_TIMEOUT_MS ?? 900000)>0;
const executor=new AgentExecutor();
const [gitAvailable,codexAvailable,gitProbe,codexProbe]=await Promise.all([
  commandExists('git'), commandExists(process.env.CODEX_COMMAND ?? 'codex'),
  executor.execute({command:'git',args:['--version'],cwd:process.cwd(),timeoutMs}),
  executor.execute({command:process.env.CODEX_COMMAND ?? 'codex',args:['--version'],cwd:process.cwd(),timeoutMs})
]);
const healthy=Boolean(process.env.DATABASE_URL)&&validMode&&validTimeout&&gitAvailable&&codexAvailable&&gitProbe.status==='COMPLETED'&&codexProbe.status==='COMPLETED';
console.log(JSON.stringify({status:healthy?'ok':'error',worker:'codex',git:gitProbe.status,codex:codexProbe.status,authReference:getCodexAuthStatus(),configuration:{databaseUrl:Boolean(process.env.DATABASE_URL),agentMode:validMode,timeout:validTimeout}}));
process.exitCode=healthy?0:1;

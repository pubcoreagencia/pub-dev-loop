import { describe, expect, it } from 'vitest';
import { AgentExecutor } from '../src/executor.js';
import { CodexCliAgent } from '../src/agent.js';
import type { Task } from '../src/domain.js';
const cwd=process.cwd();
const task:Task={id:'TASK-000002',project:'test',repository:'none',objective:'test',prompt:'write hello',status:'RUNNING',priority:0,worker:'codex',result:null,error:null,branch:null,commitSha:null,gitStatus:null,createdAt:new Date(),updatedAt:new Date()};
describe('AgentExecutor',()=>{
  it('captures stdout, stderr and exit code',async()=>{const result=await new AgentExecutor().execute({command:process.execPath,args:['-e',"console.log('out'); console.error('err')"],cwd,timeoutMs:1000});expect(result).toMatchObject({exitCode:0,stdout:'out\n',stderr:'err\n',status:'COMPLETED'});expect(result.durationMs).toBeGreaterThanOrEqual(0);});
  it('reports process errors',async()=>{const result=await new AgentExecutor().execute({command:process.execPath,args:['-e',"console.error('bad'); process.exit(2)"],cwd,timeoutMs:1000});expect(result).toMatchObject({exitCode:2,stderr:'bad\n',status:'FAILED'});});
  it('terminates timed out processes',async()=>{const result=await new AgentExecutor().execute({command:process.execPath,args:['-e','setInterval(()=>{},1000)'],cwd,timeoutMs:30});expect(result.status).toBe('TIMED_OUT');});
  it('redacts secrets from captured output',async()=>{const secret='super-secret-value';const result=await new AgentExecutor().execute({command:process.execPath,args:['-e',`console.log('OPENAI_API_KEY=${secret}')`],cwd,timeoutMs:1000,environment:{...process.env,OPENAI_API_KEY:secret}});expect(result.stdout).not.toContain(secret);expect(result.stdout).toContain('[REDACTED]');});
});
describe('CodexCliAgent',()=>{it('returns a structured unavailable-cli error',async()=>{const agent=new CodexCliAgent(new AgentExecutor(),'definitely-missing-codex-command',1000);await expect(agent.execute(task,cwd)).rejects.toMatchObject({message:'CODEX_CLI_UNAVAILABLE',execution:{status:'START_ERROR'}});});});

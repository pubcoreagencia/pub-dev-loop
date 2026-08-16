import { access } from 'node:fs/promises';
import { delimiter } from 'node:path';
import { AgentExecutor, type ExecutionResult } from './executor.js';
import type { Task } from './domain.js';
export interface AgentOutcome { summary: string; execution?: ExecutionResult; }
export interface CodingAgent { execute(task: Task, workspace: string): Promise<AgentOutcome>; }
export class AgentExecutionError extends Error { constructor(message: string, readonly execution: ExecutionResult) { super(message); } }
export class MockCodingAgent implements CodingAgent { async execute(task: Task) { return { summary: `Mock agent completed task ${task.id}; no source changes were made.` }; } }
export async function commandExists(command:string, environment:NodeJS.ProcessEnv=process.env) { if(command.includes('/')||command.includes('\\')) { try { await access(command); return true; } catch { return false; } } for(const directory of (environment.PATH??'').split(delimiter)) for(const extension of process.platform==='win32'?['','.exe','.cmd','.bat']:['']) { try { await access(`${directory}/${command}${extension}`);return true; } catch { /* continue */ } } return false; }
export class CodexCliAgent implements CodingAgent {
  constructor(private executor=new AgentExecutor(),private command=process.env.CODEX_COMMAND??'codex',private timeoutMs=Number(process.env.AGENT_TIMEOUT_MS??900000)) {}
  async execute(task:Task,workspace:string):Promise<AgentOutcome> {
    if(!(await commandExists(this.command))) {
      const execution:ExecutionResult={exitCode:null,stdout:'',stderr:`Codex CLI is unavailable: ${this.command}`,durationMs:0,status:'START_ERROR'};
      throw new AgentExecutionError('CODEX_CLI_UNAVAILABLE',execution);
    }

    const execution=await this.executor.execute({
      command:this.command,
      args:['exec','--sandbox','workspace-write','--ask-for-approval','never',task.prompt],
      cwd:workspace,
      timeoutMs:this.timeoutMs
    });

    if(execution.status!=='COMPLETED') throw new AgentExecutionError(`CODEX_EXECUTION_${execution.status}`,execution);
    return {summary:execution.stdout.slice(-8000),execution};
  }
}
export const createAgent=():CodingAgent=>process.env.AGENT_MODE==='codex'?new CodexCliAgent():new MockCodingAgent();

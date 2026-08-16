import { spawn } from 'node:child_process'; import type { Task } from './domain.js';
export interface CodingAgent { execute(task: Task, workspace: string): Promise<{ summary: string }>; }
export class MockCodingAgent implements CodingAgent { async execute(task:Task) { return { summary: `Mock agent completed task ${task.id}; no source changes were made.` }; } }
export class CodexCliAgent implements CodingAgent {
  async execute(task: Task, workspace: string) { return new Promise<{summary:string}>((resolve,reject)=>{ const child=spawn(process.env.CODEX_COMMAND ?? 'codex',['exec',task.prompt],{cwd:workspace,stdio:['ignore','pipe','pipe'],shell:false}); let out=''; let err=''; child.stdout.on('data',d=>out+=d); child.stderr.on('data',d=>err+=d); child.on('error',reject); child.on('close',code=>code===0?resolve({summary:out.slice(-8000)}):reject(new Error(`Codex exited ${code}: ${err.slice(-1000)}`))); }); }
}
export const createAgent = (): CodingAgent => process.env.AGENT_MODE === 'codex' ? new CodexCliAgent() : new MockCodingAgent();

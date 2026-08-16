import { describe, expect, it } from 'vitest';
import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { AgentExecutor } from '../../src/executor.js';

const enabled=process.env.RUN_CODEX_INTEGRATION==='1';
const repository=process.env.CODEX_INTEGRATION_REPOSITORY;
describe.skipIf(!enabled)('real Codex hello integration',()=>{
  it('creates only hello.txt in the supplied disposable repository',async()=>{
    if(!repository) throw new Error('CODEX_INTEGRATION_REPOSITORY is required when RUN_CODEX_INTEGRATION=1');
    const cwd=repository; const result=await new AgentExecutor().execute({command:'codex',args:['exec','--full-auto','Create a file hello.txt containing exactly:\nPUB DEV LOOP TEST\nDo not change any other file.'],cwd,timeoutMs:Number(process.env.AGENT_TIMEOUT_MS??900000),environment:process.env});
    expect(result.status).toBe('COMPLETED'); await access(join(cwd,'hello.txt')); expect((await readFile(join(cwd,'hello.txt'),'utf8')).trim()).toBe('PUB DEV LOOP TEST');
  }, 1_000_000);
});

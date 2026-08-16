import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AgentExecutor, redact } from '../../src/executor.js';

const enabled = process.env.RUN_CODEX_INTEGRATION === '1';
const repository = process.env.CODEX_INTEGRATION_REPOSITORY;
const timeoutMs = Number(process.env.AGENT_TIMEOUT_MS ?? 900000);
const executor = new AgentExecutor();
const run = (args: string[]) =>
  executor.execute({
    command: 'git',
    args,
    cwd: repository!,
    timeoutMs: 10_000,
    environment: process.env,
  });
const safe = (value: string) =>
  redact(value, process.env)
    .replaceAll(/\bOPENAI_API_KEY\b/gi, '[REDACTED]')
    .replaceAll(/\bAuthorization\b/gi, '[REDACTED]')
    .replaceAll(/\bBearer\b/gi, '[REDACTED]')
    .replaceAll(/\b(secrets?|credentials?)\b/gi, '[REDACTED]');

describe.skipIf(!enabled)('real Codex hello integration', () => {
  it(
    'creates and locally commits only hello.txt on an isolated task branch',
    async () => {
      if (!repository) {
        throw new Error('CODEX_INTEGRATION_REPOSITORY is required when RUN_CODEX_INTEGRATION=1');
      }

      const branch = 'worker/codex/TASK-000005';
      const prompt = [
        'Crie um arquivo hello.txt contendo exatamente:',
        '',
        'PUB DEV LOOP TEST',
        '',
        'Não altere nenhum outro arquivo.',
      ].join('\n');

      expect((await run(['status', '--porcelain'])).stdout).toBe('');
      expect((await run(['checkout', '-b', branch])).status).toBe('COMPLETED');

      const result = await executor.execute({
        command: 'codex',
        args: ['exec', '--sandbox', 'workspace-write', '--ask-for-approval', 'never', prompt],
        cwd: repository,
        timeoutMs,
        environment: process.env,
      });

      const gitStatus = await run(['status', '--short']);
      const gitDiffStat = await run(['diff', '--stat']);
      const gitDiffHello = await run(['diff', '--', 'hello.txt']);

      console.log(
        JSON.stringify(
          {
            codexVersion: (await executor.execute({
              command: 'codex',
              args: ['--version'],
              cwd: repository,
              timeoutMs: 10_000,
              environment: process.env,
            })).stdout.trim(),
            commandArgs: ['exec', '--sandbox', 'workspace-write', '--ask-for-approval', 'never', prompt],
            exitCode: result.exitCode,
            durationMs: result.durationMs,
            stdout: safe(result.stdout),
            stderr: safe(result.stderr),
            workspace: repository,
            branch,
            gitStatus: safe(gitStatus.stdout),
            gitDiffStat: safe(gitDiffStat.stdout),
            gitDiffHello: safe(gitDiffHello.stdout),
            resultStatus: result.status,
          },
          null,
          2,
        ),
      );

      expect(result.status).toBe('COMPLETED');

      await access(join(repository, 'hello.txt'));
      expect((await readFile(join(repository, 'hello.txt'), 'utf8')).trim()).toBe('PUB DEV LOOP TEST');

      const changed = gitStatus.stdout.trim().split('\n').filter(Boolean);
      expect(changed).toEqual(['?? hello.txt']);
      expect(gitDiffStat.stdout).toContain('hello.txt');

      await run(['config', 'user.name', 'PUB DEV LOOP Worker']);
      await run(['config', 'user.email', 'worker@pub.dev.loop']);
      expect((await run(['add', 'hello.txt'])).status).toBe('COMPLETED');
      expect((await run(['commit', '-m', 'worker: complete TASK-000005'])).status).toBe('COMPLETED');

      const commit = await run(['rev-parse', 'HEAD']);
      expect(commit.status).toBe('COMPLETED');

      console.log(
        JSON.stringify(
          {
            result: result.status,
            branch,
            commit: commit.stdout.trim(),
            changed,
          },
          null,
          2,
        ),
      );
    },
    1_000_000,
  );
});

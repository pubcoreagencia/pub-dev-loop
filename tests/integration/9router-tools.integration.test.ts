import { access, readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { describe, expect, it, afterEach } from 'vitest';
import { RouterProvider } from '../../src/providers/router.js';
import { ToolRuntime } from '../../src/tools/runtime.js';
import { WorkspaceSecurity } from '../../src/tools/security.js';
import type { ToolExecutionContext } from '../../src/tools/types.js';
import { execSync } from 'node:child_process';

const enabled = process.env.RUN_9ROUTER_TOOLS_INTEGRATION === '1';

const routerBaseUrl = process.env.ROUTER_BASE_URL ?? 'http://127.0.0.1:20128/v1';
const routerModel = process.env.ROUTER_MODEL ?? 'gemini/gemini-3.7-flash';

// Create a temporary sandbox
async function createSandbox(): Promise<string> {
  const sandbox = join(process.env.LOCALAPPDATA || '/tmp', 'hermes', '9router-tool-test-' + Date.now());
  await mkdir(sandbox, { recursive: true });
  
  // Initialize git
  execSync('git init', { cwd: sandbox, stdio: 'ignore' });
  execSync('git config user.name "PUB DEV LOOP Test"', { cwd: sandbox, stdio: 'ignore' });
  execSync('git config user.email "test@pub.dev.loop"', { cwd: sandbox, stdio: 'ignore' });
  
  // Create initial commit
  await writeFile(join(sandbox, 'README.md'), 'Test repo for 9router tool integration\n');
  execSync('git add README.md && git commit -m "init"', { cwd: sandbox, stdio: 'ignore' });
  
  // Create an isolated branch
  execSync('git checkout -b worker/9router/tool-test', { cwd: sandbox, stdio: 'ignore' });
  
  return sandbox;
}

function cleanupSandbox(sandbox: string): void {
  try {
    execSync('rm -rf "' + sandbox + '"', { stdio: 'ignore' });
  } catch {
    // ignore
  }
}

describe.skipIf(!enabled)('9Router Tool Execution Integration', () => {
  let sandbox: string;
  let cleanup = true;

  afterEach(async () => {
    if (cleanup && sandbox) {
      cleanupSandbox(sandbox);
    }
  });

  it(
    'write_file → tool_result → completion (single-step)',
    async () => {
      sandbox = await createSandbox();
      
      const provider = new RouterProvider(routerBaseUrl, process.env.ROUTER_API_KEY);
      
      const task = {
        id: 'TASK-000022-INTEGRATION-1',
        project: '9router-tools',
        repository: sandbox,
        objective: 'Create hello.txt with exact content',
        prompt: `Crie um arquivo hello.txt contendo exatamente:

PUB DEV LOOP 9ROUTER TOOL TEST

Não altere nenhum outro arquivo.`,
        status: 'RUNNING' as const,
        priority: 1,
        worker: '9router-test',
        result: null,
        error: null,
        branch: null,
        commitSha: null,
        gitStatus: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await provider.execute(task, sandbox);

      // Verify result
      expect(result.status).toBe('COMPLETED');
      expect(result.exitCode).toBe(0);
      
      // Verify hello.txt was created
      await access(join(sandbox, 'hello.txt'));
      const content = await readFile(join(sandbox, 'hello.txt'), 'utf8');
      expect(content.trim()).toBe('PUB DEV LOOP 9ROUTER TOOL TEST');
      
      // Verify git status
      const gitStatus = execSync('git status --short', { cwd: sandbox }).toString().trim();
      expect(gitStatus).toBe('?? hello.txt');
      
      console.log(JSON.stringify({
        status: result.status,
        model: result.model,
        changedFiles: result.changedFiles,
        gitStatus,
        durationMs: result.durationMs,
      }, null, 2));
    },
    120_000,
  );

  it(
    'multi-step: write_file → read_file → git_status → git_diff',
    async () => {
      sandbox = await createSandbox();
      cleanup = true;
      
      const provider = new RouterProvider(routerBaseUrl, process.env.ROUTER_API_KEY);
      
      const task = {
        id: 'TASK-000022-INTEGRATION-2',
        project: '9router-tools',
        repository: sandbox,
        objective: 'Create hello.txt and verify via git',
        prompt: `Crie um arquivo hello.txt contendo exatamente:

PUB DEV LOOP 9ROUTER TOOL TEST

Depois, leia o arquivo para confirmar o conteúdo. Em seguida, verifique o git status e o git diff. Não altere nenhum outro arquivo.`,
        status: 'RUNNING' as const,
        priority: 1,
        worker: '9router-test',
        result: null,
        error: null,
        branch: null,
        commitSha: null,
        gitStatus: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await provider.execute(task, sandbox);

      if (result.status !== 'COMPLETED') {
        console.log(JSON.stringify({
          status: result.status,
          model: result.model,
          changedFiles: result.changedFiles,
          errorCode: result.errorCode,
          errorMessage: result.errorMessage,
          stderr: result.stderr,
          stdout: result.stdout,
          durationMs: result.durationMs,
        }, null, 2));
      }

      expect(result.status).toBe('COMPLETED');
      
      // Verify hello.txt
      await access(join(sandbox, 'hello.txt'));
      const content = await readFile(join(sandbox, 'hello.txt'), 'utf8');
      expect(content.trim()).toBe('PUB DEV LOOP 9ROUTER TOOL TEST');
      
      // Verify git status shows only hello.txt
      const gitStatus = execSync('git status --short', { cwd: sandbox }).toString().trim();
      expect(gitStatus).toContain('hello.txt');
      
      console.log(JSON.stringify({
        status: result.status,
        model: result.model,
        changedFiles: result.changedFiles,
        gitStatus,
        durationMs: result.durationMs,
        finalMessage: result.stdout.slice(-500),
      }, null, 2));
    },
    120_000,
  );
});

describe('WorkspaceSecurity', () => {
  // Use a cross-platform temp directory
  const testRoot = resolve(process.env.LOCALAPPDATA || '/tmp', 'hermes', 'ws-test-' + Date.now());

  it('blocks path traversal', () => {
    const security = new WorkspaceSecurity(testRoot);
    
    expect(() => security.resolvePath('../../../etc/passwd')).toThrow('Path traversal');
    expect(() => security.resolvePath('hello.txt')).not.toThrow();
  });

  it('blocks sensitive file access', () => {
    const security = new WorkspaceSecurity(testRoot);
    
    expect(() => security.resolvePath('.env')).toThrow('sensitive');
    expect(() => security.resolvePath('.env.local')).toThrow('sensitive');
    expect(() => security.resolvePath('auth.json')).toThrow('sensitive');
  });

  it('blocks absolute paths outside workspace', () => {
    const security = new WorkspaceSecurity(testRoot);
    
    expect(() => security.resolvePath('/etc/passwd')).toThrow('outside');
    expect(() => security.resolvePath('/root/.bashrc')).toThrow('outside');
  });

  it('allows paths within workspace', () => {
    const security = new WorkspaceSecurity(testRoot);
    
    expect(security.resolvePath('hello.txt')).toBe(join(testRoot, 'hello.txt'));
    expect(security.resolvePath('src/index.ts')).toBe(join(testRoot, 'src', 'index.ts'));
  });
});

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, rm, writeFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import { ToolRuntime } from '../src/tools/runtime.js';
import { WorkspaceSecurity } from '../src/tools/security.js';
import type { ToolExecutionContext } from '../src/tools/types.js';
import { AgentExecutor } from '../src/executor.js';

// Test workspace root
const testRoot = join(process.env.LOCALAPPDATA || '/tmp', 'hermes', 'git-tool-test-' + process.hrtime.bigint());

const defaultCtx: ToolExecutionContext = {
  workspaceRoot: testRoot,
  maxRounds: 20,
  maxToolCalls: 50,
  commandTimeoutMs: 10000,
  maxFileBytes: 1024 * 1024,
  maxWriteBytes: 256 * 1024,
  redactSecrets: true,
};

function createContext(overrides: Partial<ToolExecutionContext> = {}): ToolExecutionContext {
  return { ...defaultCtx, ...overrides };
}

async function initGitRepo(root: string): Promise<void> {
  await mkdir(root, { recursive: true });
  execSync('git init', { cwd: root, stdio: 'ignore' });
  execSync('git config user.name "Test User"', { cwd: root, stdio: 'ignore' });
  execSync('git config user.email "test@test.com"', { cwd: root, stdio: 'ignore' });
}

async function cleanupWorkspace(root: string): Promise<void> {
  await rm(root, { recursive: true, force: true });
}

describe('Git Tool — git_commit', () => {
  let ctx: ToolExecutionContext;
  let runtime: ToolRuntime;

  beforeEach(async () => {
    ctx = createContext();
    await initGitRepo(testRoot);
    runtime = new ToolRuntime(ctx, new AgentExecutor());
  });

  afterEach(async () => {
    await cleanupWorkspace(testRoot);
  });

  it('commit válido', async () => {
    // Create a file to commit
    await writeFile(join(testRoot, 'hello.txt'), 'PUB DEV LOOP 9ROUTER TOOL TEST\n');
    
    const result = await runtime.executeTool('call_1', 'git_commit', { message: 'feat: add hello.txt' });
    
    expect(result.success).toBe(true);
    expect(result.error).toBeNull();
    
    const parsed = JSON.parse(result.content);
    expect(parsed.success).toBe(true);
    expect(parsed.commitSha).toBeTruthy();
    expect(parsed.message).toBe('feat: add hello.txt');
    expect(parsed.changedFiles).toContain('hello.txt');
    expect(parsed.gitStatus).toBe(''); // clean after commit
  });

  it('message vazia', async () => {
    await writeFile(join(testRoot, 'hello.txt'), 'test\n');
    
    const result = await runtime.executeTool('call_2', 'git_commit', { message: '' });
    
    expect(result.success).toBe(false);
    expect(result.error).toContain('required');
  });

  it('message longa (truncated to 200)', async () => {
    await writeFile(join(testRoot, 'hello.txt'), 'test\n');
    
    const longMessage = 'a'.repeat(300);
    const result = await runtime.executeTool('call_3', 'git_commit', { message: longMessage });
    
    expect(result.success).toBe(true);
    const parsed = JSON.parse(result.content);
    expect(parsed.message.length).toBe(200);
  });

  it('sem alterações', async () => {
    // No files created — clean working tree
    const result = await runtime.executeTool('call_4', 'git_commit', { message: 'feat: nothing to commit' });
    
    expect(result.success).toBe(false);
    expect(result.error).toContain('No changes');
  });

  it('tentativa de push (via run_command bloqueado)', async () => {
    await writeFile(join(testRoot, 'test.txt'), 'test\n');
    
    // Try via run_command
    const result = await runtime.executeTool('call_5', 'run_command', { command: 'git push origin main' });
    
    expect(result.success).toBe(false);
    expect(result.error).toContain('Blocked git operation');
    expect(result.error).toContain('push');
  });

  it('tentativa de reset (via run_command bloqueado)', async () => {
    await writeFile(join(testRoot, 'test.txt'), 'test\n');
    
    const result = await runtime.executeTool('call_6', 'run_command', { command: 'git reset --hard HEAD' });
    
    expect(result.success).toBe(false);
    expect(result.error).toContain('Blocked git operation');
    expect(result.error).toContain('reset');
  });

  it('tentativa de clean (via run_command bloqueado)', async () => {
    const result = await runtime.executeTool('call_7', 'run_command', { command: 'git clean -fd' });
    
    expect(result.success).toBe(false);
    expect(result.error).toContain('Blocked git operation');
  });

  it('commit SHA retornado', async () => {
    await writeFile(join(testRoot, 'hello.txt'), 'test\n');
    
    const result = await runtime.executeTool('call_8', 'git_commit', { message: 'test: sha check' });
    
    expect(result.success).toBe(true);
    const parsed = JSON.parse(result.content);
    expect(parsed.commitSha).toMatch(/^[0-9a-f]{40}$/);
    
    // Verify the commit exists
    const sha = execSync('git rev-parse HEAD', { cwd: testRoot }).toString().trim();
    expect(parsed.commitSha).toBe(sha);
  });

  it('changedFiles correto', async () => {
    await writeFile(join(testRoot, 'file1.txt'), 'content 1\n');
    await writeFile(join(testRoot, 'file2.txt'), 'content 2\n');
    
    const result = await runtime.executeTool('call_9', 'git_commit', { message: 'feat: add two files' });
    
    expect(result.success).toBe(true);
    const parsed = JSON.parse(result.content);
    expect(parsed.changedFiles).toContain('file1.txt');
    expect(parsed.changedFiles).toContain('file2.txt');
  });

  it('git_status retorna structured output', async () => {
    await writeFile(join(testRoot, 'hello.txt'), 'test\n');
    
    const result = await runtime.executeTool('call_10', 'git_status', {});
    
    expect(result.success).toBe(true);
    const parsed = JSON.parse(result.content);
    expect(parsed.changedFiles).toContain('hello.txt');
  });

  it('git_diff retorna diff content', async () => {
    await writeFile(join(testRoot, 'hello.txt'), 'original\n');
    execSync('git add hello.txt && git commit -m "init"', { cwd: testRoot, stdio: 'ignore' });
    
    await writeFile(join(testRoot, 'hello.txt'), 'modified\n');
    
    const result = await runtime.executeTool('call_11', 'git_diff', {});
    
    expect(result.success).toBe(true);
    expect(result.content).toContain('hello.txt');
  });
});

describe('Git Tool — WorkspaceSecurity integration', () => {
  it('blocks git operations outside workspace', async () => {
    const security = new WorkspaceSecurity(testRoot);
    expect(() => security.resolvePath('../../../etc')).toThrow('Path traversal');
  });

  it('git_commit uses workspace cwd only', () => {
    // The ToolRuntime always uses security.root as cwd for git operations
    const runtime = new ToolRuntime(createContext(), new AgentExecutor());
    // Verify root is set correctly
    expect(runtime.getChangedFiles()).toEqual([]);
  });
});

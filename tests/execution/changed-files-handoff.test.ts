import { describe, it, expect } from 'vitest';
import { CodexWorker } from '../../src/worker-service.js';
import type { Task } from '../../src/domain.js';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

class MockAgent {
  async execute(task: Task, repo: string) {
    // Simulate a file change
    const filePath = join(repo, 'src', 'calculator.js');
    execSync(`echo "// changed" >> "${filePath}"`);
    return { summary: 'agent done', execution: {} };
  }
}

function createTask(): Task {
  return {
    id: 'test-task',
    repository: '',
    objective: 'test',
    prompt: 'test',
    priority: 0,
    status: 'QUEUED',
    worker: null,
    result: null,
    error: null,
    branch: null,
    commit_sha: null,
    git_status: null,
    created_at: new Date(),
    updated_at: new Date(),
    lease_owner: null,
    lease_deadline: null,
    heartbeat_at: null,
    workspace_path: null,
    prototype_session_id: null,
  } as any;
}

describe('execution.changedFiles handoff', () => {
  it('identifies a single changed file', async () => {
    // Set up temporary git repo
    const tempDir = await mkdtemp(join(process.cwd(), 'tmp-repo-'));
    execSync('git init', { cwd: tempDir });
    execSync('git config user.email "test@example.com"', { cwd: tempDir });
    execSync('git config user.name "Test User"', { cwd: tempDir });
    execSync('mkdir src', { cwd: tempDir });
    execSync('echo "// initial" > src/calculator.js', { cwd: tempDir });
    execSync('git add .', { cwd: tempDir });
    execSync('git commit -m "init"', { cwd: tempDir });

    const task = createTask();
    task.repository = tempDir;
    const worker = new CodexWorker({} as any, new MockAgent());
    const result = await (worker as any).executeWithRetry(task, tempDir);
    expect(result.declaredChangedFiles).toContain('src/calculator.js');
    await rm(tempDir, { recursive: true, force: true });
  });
});

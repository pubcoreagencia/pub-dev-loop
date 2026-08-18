import { RouterProvider } from './src/providers/router.js';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import os from 'node:os';

async function testRealRouterProvider() {
  const sandbox = join(os.tmpdir(), 'pub-dev-loop-router-test-' + Date.now());
  await fs.mkdir(sandbox, { recursive: true });

  execSync('git init', { cwd: sandbox });
  execSync('git config user.name "Test Worker"', { cwd: sandbox });
  execSync('git config user.email "worker@test.internal"', { cwd: sandbox });
  await fs.writeFile(join(sandbox, 'README.md'), '# Test\n');
  execSync('git add . && git commit -m "init"', { cwd: sandbox });

  const provider = new RouterProvider(
    'http://127.0.0.1:20128/v1',
    undefined,
    120000,
    'gemini/gemini-3.6-flash'
  );

  const task = {
    id: 'TASK-REAL-9ROUTER-001',
    project: 'test-project',
    repository: sandbox,
    objective: 'Create a file named hello.txt containing "PUB DEV LOOP 9ROUTER VERIFIED"',
    prompt: 'Please create a file named hello.txt with exact content "PUB DEV LOOP 9ROUTER VERIFIED". Do not modify other files.',
    status: 'RUNNING' as const,
    priority: 1,
    worker: '9router',
    result: null,
    error: null,
    branch: null,
    commitSha: null,
    gitStatus: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  console.log('Executing RouterProvider against 9Router...');
  const result = await provider.execute(task, sandbox);
  console.log('RouterProvider Result:');
  console.log(JSON.stringify(result, null, 2));

  const helloFile = join(sandbox, 'hello.txt');
  const exists = await fs.access(helloFile).then(() => true).catch(() => false);
  console.log('hello.txt exists in workspace:', exists);
  if (exists) {
    const content = await fs.readFile(helloFile, 'utf8');
    console.log('hello.txt content:', content);
  }

  // Cleanup
  try {
    await fs.rm(sandbox, { recursive: true, force: true });
  } catch {}
}

testRealRouterProvider().catch(console.error);

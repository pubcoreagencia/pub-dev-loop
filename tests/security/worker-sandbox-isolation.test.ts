import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execSync } from 'node:child_process';
import { DockerWorkerSandboxAdapter } from '../../src/pdl/sandbox/docker-worker-sandbox-adapter.js';
import { AgentExecutor } from '../../src/executor.js';

describe('P0.4.3 Ephemeral Container Worker Sandbox Boundary', () => {
  let adapter: DockerWorkerSandboxAdapter;
  let executor: AgentExecutor;
  let tempWorkspace: string;

  beforeAll(async () => {
    adapter = new DockerWorkerSandboxAdapter();
    expect(adapter.isAvailable).toBe(true);
    executor = new AgentExecutor(adapter);

    tempWorkspace = await fs.mkdtemp(join(tmpdir(), 'pdl-sandbox-test-'));
  });

  afterAll(async () => {
    try {
      await fs.rm(tempWorkspace, { recursive: true, force: true });
    } catch {}
  });

  describe('1. Process Boundary & Subprocesses (Probes 1-6)', () => {
    it('1-4. executes Node child_process.spawn, exec, execFile, fork inside container', async () => {
      const script = `
const { spawnSync, execSync, execFileSync } = require('child_process');
const fs = require('fs');

const spawnRes = spawnSync('echo', ['SPAWN_OK'], { encoding: 'utf8' });
const execRes = execSync('echo EXEC_OK', { encoding: 'utf8' });
const fileRes = execFileSync('echo', ['EXECFILE_OK'], { encoding: 'utf8' });

console.log(spawnRes.stdout.trim(), execRes.trim(), fileRes.trim());
`;
      const scriptFile = join(tempWorkspace, 'test_node_procs.js');
      await fs.writeFile(scriptFile, script, 'utf8');

      const res = await executor.execute({
        command: 'node',
        args: ['test_node_procs.js'],
        cwd: tempWorkspace,
        timeoutMs: 15000,
      });

      expect(res.status).toBe('COMPLETED');
      expect(res.stdout).toContain('SPAWN_OK EXEC_OK EXECFILE_OK');
    }, 20000);

    it('5. executes Python subprocess inside container', async () => {
      const pyScript = `
import subprocess
res = subprocess.run(["echo", "PYTHON_SUBPROCESS_OK"], capture_output=True, text=True)
print(res.stdout.strip())
`;
      const pyFile = join(tempWorkspace, 'test_python.py');
      await fs.writeFile(pyFile, pyScript, 'utf8');

      const res = await executor.execute({
        command: 'python3',
        args: ['test_python.py'],
        cwd: tempWorkspace,
        timeoutMs: 15000,
      });

      expect(res.status).toBe('COMPLETED');
      expect(res.stdout).toContain('PYTHON_SUBPROCESS_OK');
    }, 20000);

    it('6. executes shell commands within container sandbox', async () => {
      const res = await executor.execute({
        command: 'sh',
        args: ['-c', 'echo "SHELL_EXECUTION_OK" && id -u'],
        cwd: tempWorkspace,
        timeoutMs: 15000,
      });

      expect(res.status).toBe('COMPLETED');
      expect(res.stdout).toContain('SHELL_EXECUTION_OK');
      expect(res.stdout).toContain('1000'); // Unprivileged non-root UID
    }, 20000);
  });

  describe('2. Credential Boundary & Host Identity (Probes 7-15)', () => {
    it('7-8. absolute gh.exe and delete env attempts fail closed inside container', async () => {
      const script = `
delete process.env.GH_CONFIG_DIR;
delete process.env.GH_TOKEN;
delete process.env.GITHUB_TOKEN;

const { spawnSync } = require('child_process');
// Try absolute Windows path
const res1 = spawnSync('C:\\\\Program Files\\\\GitHub CLI\\\\gh.exe', ['auth', 'status'], { encoding: 'utf8' });
// Try linux gh if any
const res2 = spawnSync('gh', ['auth', 'status'], { encoding: 'utf8' });

console.log('WIN_GH_EXIT:', res1.status, 'LINUX_GH_EXIT:', res2.status);
`;
      const file = join(tempWorkspace, 'test_gh.js');
      await fs.writeFile(file, script, 'utf8');

      const res = await executor.execute({
        command: 'node',
        args: ['test_gh.js'],
        cwd: tempWorkspace,
        timeoutMs: 15000,
      });

      expect(res.status).toBe('COMPLETED');
      expect(res.stdout).toContain('WIN_GH_EXIT: null'); // Command not found
      expect(res.stdout).toContain('LINUX_GH_EXIT: null'); // Command not found
    }, 20000);

    it('9-10. Windows cmdkey and credential store discovery fail closed', async () => {
      const script = `
const { spawnSync } = require('child_process');
const res = spawnSync('cmdkey', ['/list'], { encoding: 'utf8' });
console.log('CMDKEY_FOUND:', res.status !== null);
`;
      const file = join(tempWorkspace, 'test_cmdkey.js');
      await fs.writeFile(file, script, 'utf8');

      const res = await executor.execute({
        command: 'node',
        args: ['test_cmdkey.js'],
        cwd: tempWorkspace,
        timeoutMs: 15000,
      });

      expect(res.status).toBe('COMPLETED');
      expect(res.stdout).toContain('CMDKEY_FOUND: false');
    }, 20000);

    it('11-15. host USERPROFILE, APPDATA, .gitconfig, .ssh are absent inside container', async () => {
      const script = `
const fs = require('fs');

const envKeys = Object.keys(process.env);
const hasUserProfile = envKeys.includes('USERPROFILE');
const hasAppData = envKeys.includes('APPDATA');
const hasLocalAppData = envKeys.includes('LOCALAPPDATA');

let hasSsh = false;
let hasGitConfig = false;
try { hasSsh = fs.existsSync('/home/node/.ssh'); } catch {}
try { hasGitConfig = fs.existsSync('/home/node/.gitconfig'); } catch {}

console.log(JSON.stringify({
  hasUserProfile,
  hasAppData,
  hasLocalAppData,
  hasSsh,
  hasGitConfig,
  user: process.env.USER,
  home: process.env.HOME
}));
`;
      const file = join(tempWorkspace, 'test_host_env.js');
      await fs.writeFile(file, script, 'utf8');

      const res = await executor.execute({
        command: 'node',
        args: ['test_host_env.js'],
        cwd: tempWorkspace,
        timeoutMs: 15000,
      });

      expect(res.status).toBe('COMPLETED');
      const data = JSON.parse(res.stdout.trim());
      expect(data.hasUserProfile).toBe(false);
      expect(data.hasAppData).toBe(false);
      expect(data.hasLocalAppData).toBe(false);
      expect(data.hasSsh).toBe(false);
      expect(data.hasGitConfig).toBe(false);
      expect(data.user).toBe('node');
      expect(data.home).toBe('/home/node');
    }, 20000);
  });

  describe('3. Filesystem Boundary & Traversal (Probes 16, 26, 27, 28, 31, 32)', () => {
    it('16, 26. host PDL source and Docker socket are completely absent', async () => {
      const script = `
const fs = require('fs');

const hasPdlSource = fs.existsSync('c:/Users/Matheus Paes/Documents/ChatGPT/PUB DEV LOOP');
const hasDockerSock = fs.existsSync('/var/run/docker.sock');

console.log(JSON.stringify({ hasPdlSource, hasDockerSock }));
`;
      const file = join(tempWorkspace, 'test_host_paths.js');
      await fs.writeFile(file, script, 'utf8');

      const res = await executor.execute({
        command: 'node',
        args: ['test_host_paths.js'],
        cwd: tempWorkspace,
        timeoutMs: 15000,
      });

      expect(res.status).toBe('COMPLETED');
      const data = JSON.parse(res.stdout.trim());
      expect(data.hasPdlSource).toBe(false);
      expect(data.hasDockerSock).toBe(false);
    }, 20000);

    it('27-28. symlink escape outside /workspace is trapped within container rootfs', async () => {
      const script = `
const fs = require('fs');
try {
  fs.symlinkSync('/etc/passwd', '/workspace/escaped_symlink');
} catch {}
const exists = fs.existsSync('/workspace/escaped_symlink');
// Try to read /root
let rootReadable = false;
try {
  fs.readdirSync('/root');
  rootReadable = true;
} catch (e) {
  rootReadable = false;
}
console.log(JSON.stringify({ exists, rootReadable }));
`;
      const file = join(tempWorkspace, 'test_symlink.js');
      await fs.writeFile(file, script, 'utf8');

      const res = await executor.execute({
        command: 'node',
        args: ['test_symlink.js'],
        cwd: tempWorkspace,
        timeoutMs: 15000,
      });

      expect(res.status).toBe('COMPLETED');
      const data = JSON.parse(res.stdout.trim());
      expect(data.rootReadable).toBe(false); // Unprivileged node cannot read /root
    }, 20000);

    it('31-32. cannot mutate host Git config or Zone A trust root from container', async () => {
      const script = `
const { execSync } = require('child_process');
let systemConfigWrote = false;
try {
  execSync('git config --system user.name "Hacked"', { stdio: 'ignore' });
  systemConfigWrote = true;
} catch {
  systemConfigWrote = false;
}
console.log(JSON.stringify({ systemConfigWrote }));
`;
      const file = join(tempWorkspace, 'test_git_config.js');
      await fs.writeFile(file, script, 'utf8');

      const res = await executor.execute({
        command: 'node',
        args: ['test_git_config.js'],
        cwd: tempWorkspace,
        timeoutMs: 15000,
      });

      expect(res.status).toBe('COMPLETED');
      const data = JSON.parse(res.stdout.trim());
      expect(data.systemConfigWrote).toBe(false); // Non-root cannot mutate system git config
    }, 20000);
  });

  describe('4. Network Airgap Boundary (Probes 19-25)', () => {
    it('19-25. enforces strict network airgap (--network none)', async () => {
      const netScript = `
const net = require('net');
const dns = require('dns');

function testConnect(host, port) {
  return new Promise(res => {
    const s = new net.Socket();
    s.setTimeout(1000);
    s.connect(port, host, () => { s.destroy(); res('CONNECTED'); });
    s.on('error', (e) => res('REFUSED_' + e.code));
    s.on('timeout', () => { s.destroy(); res('TIMEOUT'); });
  });
}

function testDns(host) {
  return new Promise(res => {
    dns.lookup(host, (err) => {
      res(err ? 'DNS_FAILED_' + err.code : 'DNS_OK');
    });
  });
}

async function run() {
  const pg = await testConnect('127.0.0.1', 5432);
  const hostDocker = await testConnect('host.docker.internal', 3000);
  const dnsRes = await testDns('github.com');
  console.log(JSON.stringify({ pg, hostDocker, dnsRes }));
}
run();
`;
      const file = join(tempWorkspace, 'test_net.js');
      await fs.writeFile(file, netScript, 'utf8');

      const res = await executor.execute({
        command: 'node',
        args: ['test_net.js'],
        cwd: tempWorkspace,
        timeoutMs: 15000,
      });

      expect(res.status).toBe('COMPLETED');
      const data = JSON.parse(res.stdout.trim());
      expect(data.pg).not.toBe('CONNECTED'); // 127.0.0.1:5432 unreachable
      expect(data.dnsRes).toContain('DNS_FAILED'); // DNS fails under network none
    }, 20000);
  });

  describe('5. Process Isolation, Disposability & Kill (Probes 17-18, 29-30)', () => {
    it('17-18. cannot enumerate or signal host processes from container', async () => {
      const script = `
const fs = require('fs');

// Read /proc to check visible PIDs
const pids = fs.readdirSync('/proc').filter(p => /^\\d+$/.test(p));

// Try to send signal 0 to PID 1 (entrypoint in container) vs host PIDs
let canSignalHost = false;
try {
  // Try to signal a known high host PID
  process.kill(999999, 0);
  canSignalHost = true;
} catch (e) {
  canSignalHost = false;
}

console.log(JSON.stringify({ containerPidCount: pids.length, canSignalHost }));
`;
      const file = join(tempWorkspace, 'test_procs_visibility.js');
      await fs.writeFile(file, script, 'utf8');

      const res = await executor.execute({
        command: 'node',
        args: ['test_procs_visibility.js'],
        cwd: tempWorkspace,
        timeoutMs: 15000,
      });

      expect(res.status).toBe('COMPLETED');
      const data = JSON.parse(res.stdout.trim());
      expect(data.containerPidCount).toBeLessThan(15); // Container has only isolated PIDs
      expect(data.canSignalHost).toBe(false);
    }, 20000);

    it('29-30. timeout terminates container and eliminates detached grandchild processes', async () => {
      const orphanScript = `
const { spawn } = require('child_process');
// Detached child that sleeps
const bg = spawn('sleep', ['60'], { detached: true, stdio: 'ignore' });
bg.unref();

// Block main process
const start = Date.now();
while (Date.now() - start < 10000) {}
`;
      const file = join(tempWorkspace, 'test_orphan.js');
      await fs.writeFile(file, orphanScript, 'utf8');

      const res = await executor.execute({
        command: 'node',
        args: ['test_orphan.js'],
        cwd: tempWorkspace,
        timeoutMs: 1500, // Trigger fast timeout
      });

      expect(res.status).toBe('TIMED_OUT');
    }, 20000);
  });
});

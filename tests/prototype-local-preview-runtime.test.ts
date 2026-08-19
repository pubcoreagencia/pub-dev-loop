import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { LocalPreviewRuntime } from '../src/prototype/local-preview-runtime.js';

const PORT = 34671;
const runningRuntimes: Array<{ runtime: LocalPreviewRuntime; id: string }> = [];

async function makeWorkspace(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'pub-prototype-preview-test-'));
}

afterEach(async () => {
  for (const item of runningRuntimes.splice(0)) {
    await item.runtime.destroy(item.id).catch(() => undefined);
  }
});

describe('LocalPreviewRuntime', () => {
  it('starts a dev server, exposes localhost preview, streams logs, and stops it', async () => {
    const runtime = new LocalPreviewRuntime();
    const workspace = await makeWorkspace();
    const info = await runtime.create({
      workspace,
      command: process.execPath,
      args: ['-e', `require('http').createServer((req,res)=>{res.writeHead(200,{'content-type':'text/plain'});res.end('PUB PREVIEW OK')}).listen(${PORT},'127.0.0.1'); console.log('PREVIEW_STARTED')`],
      port: PORT,
      startupTimeoutMs: 5_000,
    });
    runningRuntimes.push({ runtime, id: info.id });

    const logs: string[] = [];
    const unsubscribe = runtime.subscribe(info.id, event => logs.push(`${event.stream}:${event.line}`));

    const ready = await runtime.start(info.id);
    expect(ready.status).toBe('READY');
    expect(ready.url).toBe(`http://127.0.0.1:${PORT}`);

    const response = await fetch(ready.url!);
    expect(await response.text()).toBe('PUB PREVIEW OK');
    expect(logs.some(line => line.includes('PREVIEW_STARTED'))).toBe(true);

    unsubscribe();
    const stopped = await runtime.stop(info.id);
    expect(stopped?.status).toBe('STOPPED');
    expect((await runtime.get(info.id))?.pid).toBeNull();

    await rm(workspace, { recursive: true, force: true });
  });
});

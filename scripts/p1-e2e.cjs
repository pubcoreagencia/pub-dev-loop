// E2E: open PP, create project, send prompt, capture states
const WebSocket = require('ws');
const fs = require('fs');

const TAB_ID = process.argv[2] || 'F196DECC9046D3DF26977DDDE74CB9DE';
const WS_URL = `ws://localhost:9224/devtools/page/${TAB_ID}`;

let id = 1;
const pending = {};
const ws = new WebSocket(WS_URL);

ws.on('message', (data) => {
  const m = JSON.parse(data);
  if (m.id && pending[m.id]) {
    pending[m.id](m);
    delete pending[m.id];
  }
});

async function send(method, params = {}) {
  return new Promise((resolve) => {
    const myId = id++;
    pending[myId] = resolve;
    ws.send(JSON.stringify({ id: myId, method, params }));
  });
}

async function evalJS(expr, awaitPromise = false) {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise });
  return r.result?.result?.value;
}

async function screenshot(name) {
  const ss = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(`C:/Users/Matheus Paes/Documents/ChatGPT/PUB DEV LOOP/p1-${name}.png`, Buffer.from(ss.result.data, 'base64'));
  console.log('Saved p1-' + name + '.png');
}

async function run() {
  await new Promise(r => ws.once('open', r));
  console.log('[1] Connected');

  // Clear localStorage and reload to see empty state
  await evalJS(`localStorage.clear()`);
  await send('Page.reload');
  await new Promise(r => setTimeout(r, 5000));
  console.log('[2] Empty state');
  await screenshot('01-empty');

  // Click "Novo" project
  await evalJS(`document.getElementById('newProject').click()`);
  await new Promise(r => setTimeout(r, 1000));
  console.log('[3] Modal open');
  await screenshot('02-modal');

  // Fill and submit
  await evalJS(`
    const input = document.getElementById('newProjectName');
    input.value = 'P1 E2E Test';
    document.getElementById('confirmNewProject').click();
  `);
  await new Promise(r => setTimeout(r, 5000));
  console.log('[4] Project created');
  await screenshot('03-project-created');

  // Send a prompt
  await evalJS(`
    const p = document.getElementById('prompt');
    p.value = 'Crie uma landing page para um café com menu, horário e endereço';
    p.dispatchEvent(new Event('input'));
  `);
  await new Promise(r => setTimeout(r, 500));
  await evalJS(`document.getElementById('send').click()`);
  console.log('[5] Prompt sent');
  await new Promise(r => setTimeout(r, 5000));
  await screenshot('04-building');

  // Wait for agent to finish (up to 2 minutes)
  console.log('[6] Waiting for agent (max 120s)...');
  for (let i = 0; i < 24; i++) {
    await new Promise(r => setTimeout(r, 5000));
    const status = await evalJS(`document.getElementById('previewStatusLabel')?.textContent`);
    console.log('  Status:', status);
    if (status === 'Preview pronto' || status === 'Pronto') break;
  }
  await screenshot('05-ready');

  // Get final state
  const finalState = await evalJS(`JSON.stringify({
    previewUrl: document.getElementById('previewUrl')?.textContent,
    previewStatus: document.getElementById('previewStatusLabel')?.textContent,
    projectName: document.getElementById('chatHeaderTitle')?.textContent,
  })`);
  console.log('[7] Final state:', finalState);

  ws.close();
}

run().catch(e => { console.error('Error:', e.message); process.exit(1); });

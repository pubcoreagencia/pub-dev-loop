// F5 final test - browser real
const WebSocket = require('ws');

const WS_URL = 'ws://localhost:9223/devtools/page/BBEECBA5B985697535B3B5C73FC3C053';
let msgId = 1;
const pending = {};
let ws;

function connect() {
  return new Promise((resolve) => {
    ws = new WebSocket(WS_URL);
    ws.on('message', (data) => {
      const msg = JSON.parse(data);
      if (msg.id && pending[msg.id]) {
        pending[msg.id](msg);
        delete pending[msg.id];
      }
    });
    ws.on('open', () => resolve());
  });
}

function send(method, params = {}) {
  return new Promise((resolve) => {
    const id = msgId++;
    pending[id] = resolve;
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function evalJS(expr) {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
  return r.result?.result?.value;
}

async function run() {
  await connect();
  console.log('[1] Connected');

  // Get current state
  const s0 = await evalJS(`JSON.stringify({
    iframe: document.querySelector('iframe')?.src,
    project: document.querySelector('#projectName')?.textContent,
    status: document.querySelector('#status')?.textContent,
    session: localStorage.getItem('pub-prototype:last-session')
  })`);
  console.log('[2] Current state:', s0);

  // Do F5
  console.log('[3] Doing F5...');
  await send('Page.reload');
  await new Promise(r => setTimeout(r, 8000));

  const s1 = await evalJS(`JSON.stringify({
    iframe: document.querySelector('iframe')?.src,
    project: document.querySelector('#projectName')?.textContent,
    status: document.querySelector('#status')?.textContent
  })`);
  console.log('[4] After F5 (8s):', s1);

  // Wait for auto-recovery
  await new Promise(r => setTimeout(r, 90000));
  console.log('[5] Waited 90s for auto-recovery');

  const s2 = await evalJS(`JSON.stringify({
    iframe: document.querySelector('iframe')?.src,
    project: document.querySelector('#projectName')?.textContent,
    status: document.querySelector('#status')?.textContent
  })`);
  console.log('[6] After auto-recovery:', s2);

  // Screenshot
  const ss = await send('Page.captureScreenshot', { format: 'png' });
  const fs = require('fs');
  fs.writeFileSync('C:/Users/Matheus Paes/Documents/ChatGPT/PUB DEV LOOP/f5-DONE.png', Buffer.from(ss.result?.data, 'base64'));
  console.log('[7] Screenshot saved as f5-DONE.png');

  ws.close();
}

run().catch(e => { console.error(e.message); process.exit(1); });

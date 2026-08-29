// Capture console logs from page
const WebSocket = require('ws');

const WS_URL = 'ws://localhost:9223/devtools/page/BBEECBA5B985697535B3B5C73FC3C053';
let msgId = 1;
const pending = {};
let ws;
const logs = [];

function connect() {
  return new Promise((resolve) => {
    ws = new WebSocket(WS_URL);
    ws.on('message', (data) => {
      const msg = JSON.parse(data);
      if (msg.id && pending[msg.id]) {
        pending[msg.id](msg);
        delete pending[msg.id];
      }
      if (msg.method === 'Runtime.consoleAPICalled') {
        const text = msg.params.args.map(a => a.value || a.description).join(' ');
        logs.push(`[${msg.params.type}] ${text}`);
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

  // Enable console capture
  await send('Runtime.enable');
  await send('Log.enable');

  // Clear localStorage and set the correct session
  await evalJS(`localStorage.clear()`);
  await evalJS(`localStorage.setItem('pub-prototype:last-session', 'be439c50-5670-4425-8378-bf5ad7c11a5e')`);

  // Reload
  await send('Page.reload');
  await new Promise(r => setTimeout(r, 10000));

  // Print captured logs
  console.log('[2] Captured logs:');
  logs.forEach(l => console.log('  ', l));

  // Check final state
  const state = await evalJS(`JSON.stringify({
    iframe: document.querySelector('iframe')?.src,
    project: document.querySelector('#projectName')?.textContent
  })`);
  console.log('[3] Final state:', state);

  ws.close();
}

run().catch(e => { console.error(e.message); process.exit(1); });

// Simple debug
const WebSocket = require('ws');

const WS_URL = 'ws://localhost:9223/devtools/page/04D1E76B9DBDE6900D09DA07321799F8';
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

function send(method, params = {}, awaitPromise = false) {
  return new Promise((resolve) => {
    const id = msgId++;
    pending[id] = resolve;
    ws.send(JSON.stringify({ id, method, params, ...(awaitPromise ? { awaitPromise: true } : {}) }));
  });
}

async function run() {
  await connect();
  console.log('[1] Connected');

  await send('Page.enable');
  await send('Network.enable');
  await new Promise(r => setTimeout(r, 2000));

  // Enable Network loading to see all requests
  await send('Page.navigate', { url: 'https://pub-dev-loop-api.contato-pubcore.workers.dev/prototype' });
  await new Promise(r => setTimeout(r, 6000));

  // Set session and reload
  await send('Runtime.evaluate', { expression: `localStorage.setItem('pub-prototype:last-session', 'be439c50-5670-4425-8378-bf5ad7c11a5e')` });

  // Get iframe info
  const result = await send('Runtime.evaluate', {
    expression: `JSON.stringify({
      iframe: document.querySelector('iframe')?.src,
      status: document.querySelector('#status')?.textContent,
      project: document.querySelector('#projectName')?.textContent
    })`,
    returnByValue: true,
  });
  console.log('[2] State:', result.result?.result?.value);

  ws.close();
}

run().catch(e => { console.error(e.message); process.exit(1); });

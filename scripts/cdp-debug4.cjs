// Get raw API response
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

function send(method, params = {}) {
  return new Promise((resolve) => {
    const id = msgId++;
    pending[id] = resolve;
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function run() {
  await connect();

  const r = await send('Runtime.evaluate', {
    expression: `fetch('/prototype/sessions/be439c50-5670-4425-8378-bf5ad7c11a5e').then(r => r.json()).then(d => d.session.previewUrl)`,
    awaitPromise: true,
  });
  console.log('[API previewUrl]:', r.result?.result?.value);

  ws.close();
}

run().catch(e => { console.error(e.message); process.exit(1); });

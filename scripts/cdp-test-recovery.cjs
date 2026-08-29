// Test recovery by calling /preview/refresh
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

  // Manually click on the P01 Second Task session in the sidebar
  await send('Runtime.evaluate', { expression: `
    (() => {
      const items = Array.from(document.querySelectorAll('.project-item'));
      const target = items.find(p => p.textContent.includes('P01 Second Task'));
      if (target) { target.click(); return 'clicked'; }
      return 'not found: ' + items.length;
    })()
  `, returnByValue: true }).then(r => console.log('[Click]:', r.result?.result?.value));

  await new Promise(r => setTimeout(r, 3000));

  // Now call the recovery endpoint
  const r1 = await send('Runtime.evaluate', {
    expression: `fetch('/prototype/sessions/be439c50-5670-4425-8378-bf5ad7c11a5e/preview/refresh', { method: 'POST' }).then(r => r.json())`,
    awaitPromise: true,
  });
  console.log('[Refresh result]:', JSON.stringify(r1.result?.result?.value).substring(0, 500));

  await new Promise(r => setTimeout(r, 5000));

  // Check iframe after refresh
  const r2 = await send('Runtime.evaluate', { expression: `JSON.stringify({
    iframe: document.querySelector('iframe')?.src,
    status: document.querySelector('#status')?.textContent
  })`, returnByValue: true });
  console.log('[After refresh]:', r2.result?.result?.value);

  // Test preview HTTP
  const iframe = JSON.parse(r2.result?.result?.value || '{}').iframe;
  if (iframe) {
    console.log('[Iframe URL]:', iframe);
  }

  ws.close();
}

run().catch(e => { console.error(e.message); process.exit(1); });

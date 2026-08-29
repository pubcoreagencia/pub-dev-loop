// Final recovery test
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

async function evalJS(expr) {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
  return r.result?.result?.value;
}

async function run() {
  await connect();

  // Click on P01 Second Task
  await evalJS(`(() => { const items = Array.from(document.querySelectorAll('.project-item')); const t = items.find(p => p.textContent.includes('P01 Second Task')); if (t) t.click(); })()`);
  console.log('[1] Clicked P01');
  await new Promise(r => setTimeout(r, 3000));

  // State after click
  const s1 = await evalJS(`JSON.stringify({iframe: document.querySelector('iframe')?.src, project: document.querySelector('#projectName')?.textContent, status: document.querySelector('#status')?.textContent})`);
  console.log('[2] After click:', s1);

  // Call refresh
  await evalJS(`fetch('/prototype/sessions/be439c50-5670-4425-8378-bf5ad7c11a5e/preview/refresh', { method: 'POST' }).then(r => r.json().then(d => window._refreshResult = d))`);
  await new Promise(r => setTimeout(r, 3000));
  const refreshResult = await evalJS(`JSON.stringify(window._refreshResult)`);
  console.log('[3] Refresh result:', refreshResult?.substring(0, 500));

  // Wait for new preview
  await new Promise(r => setTimeout(r, 10000));
  const s2 = await evalJS(`JSON.stringify({iframe: document.querySelector('iframe')?.src, status: document.querySelector('#status')?.textContent})`);
  console.log('[4] After 10s:', s2);

  // Test preview HTTP
  const iframeUrl = JSON.parse(s2 || '{}').iframe;
  console.log('[5] Iframe URL:', iframeUrl);

  // Screenshot
  const ss = await send('Page.captureScreenshot', { format: 'png' });
  const fs = require('fs');
  fs.writeFileSync('C:/Users/Matheus Paes/Documents/ChatGPT/PUB DEV LOOP/f5-recovery-final.png', Buffer.from(ss.result?.data, 'base64'));

  ws.close();
}

run().catch(e => { console.error(e.message); process.exit(1); });

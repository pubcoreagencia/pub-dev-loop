// Simplified CDP F5 test
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
  const r = await send('Runtime.evaluate', { expression: expr });
  return r.result?.result?.value;
}

async function run() {
  await connect();
  console.log('[1] Connected');

  // Set the session
  await evalJS(`localStorage.setItem('pub-prototype:last-session', 'be439c50-5670-4425-8378-bf5ad7c11a5e')`);
  console.log('[2] Session set');

  // Reload
  await send('Page.reload');
  await new Promise(r => setTimeout(r, 5000));
  console.log('[3] Reloaded, waiting 5s');

  const s1 = await evalJS(`JSON.stringify({iframe: document.querySelector('iframe')?.src, status: document.querySelector('#status')?.textContent, project: document.querySelector('#projectName')?.textContent, session: localStorage.getItem('pub-prototype:last-session')})`);
  console.log('[4] State:', s1);

  // Wait for recovery
  await new Promise(r => setTimeout(r, 30000));
  console.log('[5] Waited 30s');

  const s2 = await evalJS(`JSON.stringify({iframe: document.querySelector('iframe')?.src, status: document.querySelector('#status')?.textContent, project: document.querySelector('#projectName')?.textContent})`);
  console.log('[6] Final state:', s2);

  // Test preview HTTP
  const iframe = JSON.parse(s2 || '{}').iframe;
  if (iframe) {
    console.log('[7] Testing iframe URL:', iframe);
  }

  // Screenshot
  const ss = await send('Page.captureScreenshot', { format: 'png' });
  const fs = require('fs');
  fs.writeFileSync('C:/Users/Matheus Paes/Documents/ChatGPT/PUB DEV LOOP/f5-final.png', Buffer.from(ss.result?.data, 'base64'));
  console.log('[8] Screenshot saved');

  ws.close();
}

run().catch(e => { console.error(e.message); process.exit(1); });

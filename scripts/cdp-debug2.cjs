// Deep debug
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

  // Force the session
  await evalJS(`localStorage.setItem('pub-prototype:last-session', 'be439c50-5670-4425-8378-bf5ad7c11a5e')`);

  // Reload
  await send('Page.reload');
  await new Promise(r => setTimeout(r, 6000));

  // Check what the iframe is and the actual API response
  const check = await evalJS(`
    (async () => {
      const resp = await fetch('/prototype/sessions/be439c50-5670-4425-8378-bf5ad7c11a5e');
      const data = await resp.json();
      return JSON.stringify({
        apiPreviewUrl: data.session?.previewUrl,
        apiStatus: data.session?.status,
        iframeCurrent: document.querySelector('iframe')?.src,
        iframeStyle: document.querySelector('iframe')?.style.display,
        projectName: document.querySelector('#projectName')?.textContent
      });
    })()
  `);
  console.log('[Check]:', check);

  ws.close();
}

run().catch(e => { console.error(e.message); process.exit(1); });

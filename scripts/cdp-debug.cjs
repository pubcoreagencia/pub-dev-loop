// Debug: check what's happening in loadSession
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

  // Intercept the fetch to loadSession
  await evalJS(`
    (() => {
      window._origFetch = window.fetch;
      window._fetchLog = [];
      window.fetch = async function(url, opts) {
        if (typeof url === 'string' && url.includes('/prototype/sessions/')) {
          const resp = await window._origFetch(url, opts);
          const cloned = resp.clone();
          try {
            const data = await cloned.json();
            window._fetchLog.push({ url, sessionId: data?.session?.id, previewUrl: data?.session?.previewUrl });
          } catch {}
          return resp;
        }
        return window._origFetch(url, opts);
      };
    })()
  `);

  // Force reload with the correct session
  await evalJS(`localStorage.setItem('pub-prototype:last-session', 'be439c50-5670-4425-8378-bf5ad7c11a5e')`);

  await send('Page.reload');
  await new Promise(r => setTimeout(r, 8000));

  const log = await evalJS(`JSON.stringify(window._fetchLog)`);
  console.log('[Fetch log]:', log);

  const state = await evalJS(`JSON.stringify({
    session: localStorage.getItem('pub-prototype:last-session'),
    project: document.querySelector('#projectName')?.textContent,
    status: document.querySelector('#status')?.textContent,
    iframe: document.querySelector('iframe')?.src,
    currentUrl: window.currentUrl
  })`);
  console.log('[State]:', state);

  ws.close();
}

run().catch(e => { console.error(e.message); process.exit(1); });

// Intercept loadSession
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

  // Override fetch to log
  await send('Runtime.evaluate', { expression: `
    window._fetchLog = [];
    const origFetch = window.fetch;
    window.fetch = async function(...args) {
      const url = args[0];
      if (typeof url === 'string' && url.includes('/prototype/sessions/') && !url.includes('/messages') && !url.includes('/preview/refresh') && !url.includes('/prompts') && !url.includes('/events')) {
        window._fetchLog.push(url);
      }
      return origFetch.apply(this, args);
    };
  ` });

  // Force reload with correct session
  await send('Runtime.evaluate', { expression: `localStorage.setItem('pub-prototype:last-session', 'be439c50-5670-4425-8378-bf5ad7c11a5e')` });
  await send('Page.reload');
  await new Promise(r => setTimeout(r, 6000));

  // Check the log
  const r = await send('Runtime.evaluate', { expression: `JSON.stringify(window._fetchLog)`, returnByValue: true });
  console.log('[Fetch log]:', r.result?.result?.value);

  ws.close();
}

run().catch(e => { console.error(e.message); process.exit(1); });

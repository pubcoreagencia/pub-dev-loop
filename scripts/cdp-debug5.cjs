// Check if loadSession is being called
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

  // Force the session and reload
  await send('Runtime.evaluate', { expression: `localStorage.setItem('pub-prototype:last-session', 'be439c50-5670-4425-8378-bf5ad7c11a5e')` });
  await send('Page.reload');
  await new Promise(r => setTimeout(r, 5000));

  // Check what the iframe src was set to
  const r1 = await send('Runtime.evaluate', { expression: `document.querySelector('iframe').src` });
  console.log('[1] iframe src:', r1.result?.result?.value);

  // Manually call loadSession and watch
  const r2 = await send('Runtime.evaluate', {
    expression: `localStorage.getItem('pub-prototype:last-session')`,
  });
  console.log('[2] lastSession:', r2.result?.result?.value);

  // Check if the page is actually showing PP
  const r3 = await send('Runtime.evaluate', {
    expression: `JSON.stringify({
      title: document.title,
      hasIframe: !!document.querySelector('iframe'),
      iframeSrc: document.querySelector('iframe')?.src,
      allIframes: Array.from(document.querySelectorAll('iframe')).map(f => f.src)
    })`,
    returnByValue: true,
  });
  console.log('[3] Page state:', r3.result?.result?.value);

  ws.close();
}

run().catch(e => { console.error(e.message); process.exit(1); });

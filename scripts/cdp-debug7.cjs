// Just check the iframe
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

  // Get current state
  const r = await send('Runtime.evaluate', { expression: `JSON.stringify({
    lastSession: localStorage.getItem('pub-prototype:last-session'),
    iframeSrc: document.querySelector('iframe')?.src,
    projectName: document.querySelector('#projectName')?.textContent
  })`, returnByValue: true });
  console.log('[State]:', r.result?.result?.value);

  // Manually set iframe src
  const r2 = await send('Runtime.evaluate', {
    expression: `(() => {
      const iframe = document.querySelector('iframe');
      if (iframe) {
        const newSrc = 'https://previews-checklist-concrete-dare.trycloudflare.com';
        iframe.src = newSrc;
        return newSrc;
      }
      return 'no iframe';
    })()`,
    returnByValue: true,
  });
  console.log('[Manual set]:', r2.result?.result?.value);

  await new Promise(r => setTimeout(r, 3000));

  const r3 = await send('Runtime.evaluate', { expression: `document.querySelector('iframe')?.src`, returnByValue: true });
  console.log('[After manual set]:', r3.result?.result?.value);

  ws.close();
}

run().catch(e => { console.error(e.message); process.exit(1); });

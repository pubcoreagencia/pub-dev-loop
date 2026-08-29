// Final F5 test - click on session then F5
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

  // Click on the be439c50 session in sidebar
  const clickResult = await evalJS(`
    (() => {
      const items = Array.from(document.querySelectorAll('.project-item'));
      const target = items.find(p => p.textContent.includes('be439c50'));
      if (target) {
        target.click();
        return 'clicked: ' + target.querySelector('.project-name')?.textContent;
      }
      return 'not found in ' + items.length + ' items';
    })()
  `);
  console.log('[2] Click:', clickResult);

  await new Promise(r => setTimeout(r, 3000));

  const s1 = await evalJS(`JSON.stringify({
    session: localStorage.getItem('pub-prototype:last-session'),
    project: document.querySelector('#projectName')?.textContent,
    status: document.querySelector('#status')?.textContent,
    iframe: document.querySelector('iframe')?.src
  })`);
  console.log('[3] After click:', s1);

  // Now do F5
  await send('Page.reload');
  await new Promise(r => setTimeout(r, 5000));
  console.log('[4] F5 done, waiting 5s');

  const s2 = await evalJS(`JSON.stringify({
    session: localStorage.getItem('pub-prototype:last-session'),
    project: document.querySelector('#projectName')?.textContent,
    status: document.querySelector('#status')?.textContent,
    iframe: document.querySelector('iframe')?.src
  })`);
  console.log('[5] After F5:', s2);

  // Wait for recovery
  await new Promise(r => setTimeout(r, 60000));
  console.log('[6] Waited 60s for recovery');

  const s3 = await evalJS(`JSON.stringify({
    session: localStorage.getItem('pub-prototype:last-session'),
    project: document.querySelector('#projectName')?.textContent,
    status: document.querySelector('#status')?.textContent,
    iframe: document.querySelector('iframe')?.src
  })`);
  console.log('[7] After recovery:', s3);

  // Test iframe HTTP
  const iframe = JSON.parse(s3 || '{}').iframe;
  if (iframe && iframe !== 'undefined') {
    console.log('[8] Iframe URL:', iframe);
  }

  // Screenshot
  const ss = await send('Page.captureScreenshot', { format: 'png' });
  const fs = require('fs');
  fs.writeFileSync('C:/Users/Matheus Paes/Documents/ChatGPT/PUB DEV LOOP/f5-final2.png', Buffer.from(ss.result?.data, 'base64'));

  ws.close();
}

run().catch(e => { console.error(e.message); process.exit(1); });

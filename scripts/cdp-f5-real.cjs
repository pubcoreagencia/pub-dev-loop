// Click on session then F5
const WebSocket = require('ws');
const http = require('http');

const WS_URL = 'ws://localhost:9223/devtools/page/BBEECBA5B985697535B3B5C73FC3C053';
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

function get(url) {
  return new Promise((resolve) => {
    http.get(url, (res) => { let d=''; res.on('data',c=>d+=c); res.on('end',()=>resolve(d)); }).on('error', (e) => resolve('error:'+e.message));
  });
}

async function run() {
  await connect();
  console.log('[1] Connected');

  // Get the list of projects to find P01 Second Task
  const projects = await evalJS(`
    Array.from(document.querySelectorAll('.project-item')).map(p => ({
      name: p.querySelector('.project-name')?.textContent,
      active: p.classList.contains('active')
    }))
  `);
  console.log('[2] Projects:', JSON.stringify(projects));

  // Click on P01 Second Task
  const clickResult = await evalJS(`
    (() => {
      const items = Array.from(document.querySelectorAll('.project-item'));
      const target = items.find(p => p.textContent.includes('P01 Second Task'));
      if (target) {
        target.click();
        return 'clicked';
      }
      return 'not found';
    })()
  `);
  console.log('[3] Click:', clickResult);

  await new Promise(r => setTimeout(r, 5000));

  // State after click
  const s1 = await evalJS(`JSON.stringify({
    iframe: document.querySelector('iframe')?.src,
    project: document.querySelector('#projectName')?.textContent,
    status: document.querySelector('#status')?.textContent
  })`);
  console.log('[4] After click:', s1);

  // Confirm preview is dead
  const iframe1 = JSON.parse(s1).iframe;
  if (iframe1) {
    const httpResult = await get(iframe1);
    console.log('[5] Preview HTTP (before F5):', httpResult.substring(0, 80));
  }

  // Now do F5
  console.log('[6] Doing F5...');
  await send('Page.reload');
  await new Promise(r => setTimeout(r, 5000));

  const s2 = await evalJS(`JSON.stringify({
    iframe: document.querySelector('iframe')?.src,
    project: document.querySelector('#projectName')?.textContent,
    status: document.querySelector('#status')?.textContent
  })`);
  console.log('[7] After F5:', s2);

  // Wait for auto-recovery
  await new Promise(r => setTimeout(r, 120000));
  console.log('[8] Waited 120s for auto-recovery');

  const s3 = await evalJS(`JSON.stringify({
    iframe: document.querySelector('iframe')?.src,
    project: document.querySelector('#projectName')?.textContent,
    status: document.querySelector('#status')?.textContent
  })`);
  console.log('[9] After auto-recovery:', s3);

  const iframe3 = JSON.parse(s3).iframe;
  if (iframe3 && iframe3 !== iframe1) {
    console.log('[10] NEW previewUrl:', iframe3);
    const httpResult = await get(iframe3);
    console.log('[11] NEW preview HTTP:', httpResult.substring(0, 80));
  }

  // Screenshot
  const ss = await send('Page.captureScreenshot', { format: 'png' });
  const fs = require('fs');
  fs.writeFileSync('C:/Users/Matheus Paes/Documents/ChatGPT/PUB DEV LOOP/f5-final-real.png', Buffer.from(ss.result?.data, 'base64'));
  console.log('[12] Screenshot saved');

  ws.close();
}

run().catch(e => { console.error(e.message); process.exit(1); });

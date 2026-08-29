// Kill preview then F5
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

  // Get current iframe URL (previewUrl)
  const before = await evalJS(`JSON.stringify({
    iframe: document.querySelector('iframe')?.src,
    session: localStorage.getItem('pub-prototype:last-session')
  })`);
  console.log('[2] BEFORE F5:', before);
  const beforeIframe = JSON.parse(before).iframe;

  // Confirm preview is dead
  if (beforeIframe) {
    const httpResult = await get(beforeIframe);
    console.log('[3] Preview HTTP (BEFORE):', httpResult.substring(0, 100));
  }

  // Now do F5 (reload)
  console.log('[4] Doing F5 (reload)...');
  await send('Page.reload');
  await new Promise(r => setTimeout(r, 5000));

  // State right after F5
  const s1 = await evalJS(`JSON.stringify({
    iframe: document.querySelector('iframe')?.src,
    status: document.querySelector('#status')?.textContent
  })`);
  console.log('[5] Right after F5:', s1);

  // Wait for auto-recovery (verifyAndRefreshPreview will detect dead preview and trigger refresh)
  // The refresh involves: container.stop() + startAndWaitForPorts() + git clone + preview start
  // This can take 60-90 seconds
  await new Promise(r => setTimeout(r, 120000));
  console.log('[6] Waited 120s for auto-recovery');

  const after = await evalJS(`JSON.stringify({
    iframe: document.querySelector('iframe')?.src,
    status: document.querySelector('#status')?.textContent,
    project: document.querySelector('#projectName')?.textContent
  })`);
  console.log('[7] AFTER F5 (auto-recovery):', after);

  const afterIframe = JSON.parse(after).iframe;
  if (afterIframe && afterIframe !== beforeIframe) {
    console.log('[8] NEW previewUrl:', afterIframe);
    const httpResult = await get(afterIframe);
    console.log('[9] NEW preview HTTP:', httpResult.substring(0, 100));
  } else if (afterIframe === beforeIframe) {
    console.log('[8] Iframe URL unchanged (preview still dead or same URL)');
  }

  // Screenshot
  const ss = await send('Page.captureScreenshot', { format: 'png' });
  const fs = require('fs');
  fs.writeFileSync('C:/Users/Matheus Paes/Documents/ChatGPT/PUB DEV LOOP/f5-after.png', Buffer.from(ss.result?.data, 'base64'));
  console.log('[10] Screenshot saved');

  ws.close();
}

run().catch(e => { console.error(e.message); process.exit(1); });

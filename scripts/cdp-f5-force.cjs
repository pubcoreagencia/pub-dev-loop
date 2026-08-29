// Force loadSession and verify iframe update
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

async function evalJS(expr, awaitPromise = false) {
  const r = await send('Runtime.evaluate', {
    expression: expr,
    returnByValue: true,
    awaitPromise: awaitPromise
  });
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

  // First, let's see what the API returns for the active session
  const apiCheck = await evalJS(`
    fetch('/prototype/sessions/be439c50-5670-4425-8378-bf5ad7c11a5e').then(r => r.json()).then(d => JSON.stringify({
      id: d.session.id,
      previewUrl: d.session.previewUrl,
      lastCheckpointSha: d.session.lastCheckpointSha
    }))
  `, true);
  console.log('[2] API response for be439c50:', apiCheck);

  // Now force the iframe to the correct URL
  const forceResult = await evalJS(`
    (() => {
      const iframe = document.querySelector('iframe');
      const newUrl = 'https://indianapolis-genuine-curve-copyrighted.trycloudflare.com';
      iframe.src = newUrl;
      return iframe.src;
    })()
  `);
  console.log('[3] Forced iframe:', forceResult);

  // Test if the new URL is alive
  await new Promise(r => setTimeout(r, 3000));
  const httpResult = await get(forceResult);
  console.log('[4] NEW preview HTTP:', httpResult.substring(0, 100));

  // Now do F5 to test auto-recovery
  console.log('[5] Doing F5...');
  // Set the session in localStorage first to ensure it loads be439c50
  await evalJS(`localStorage.setItem('pub-prototype:last-session', 'be439c50-5670-4425-8378-bf5ad7c11a5e')`);
  await send('Page.reload');
  await new Promise(r => setTimeout(r, 8000));

  const s1 = await evalJS(`JSON.stringify({
    iframe: document.querySelector('iframe')?.src,
    project: document.querySelector('#projectName')?.textContent,
    status: document.querySelector('#status')?.textContent
  })`);
  console.log('[6] After F5:', s1);

  // Wait for auto-recovery
  await new Promise(r => setTimeout(r, 120000));
  console.log('[7] Waited 120s for auto-recovery');

  const s2 = await evalJS(`JSON.stringify({
    iframe: document.querySelector('iframe')?.src,
    project: document.querySelector('#projectName')?.textContent,
    status: document.querySelector('#status')?.textContent
  })`);
  console.log('[8] After auto-recovery:', s2);

  const finalIframe = JSON.parse(s2).iframe;
  if (finalIframe) {
    const httpFinal = await get(finalIframe);
    console.log('[9] FINAL preview HTTP:', httpFinal.substring(0, 100));
  }

  // Screenshot
  const ss = await send('Page.captureScreenshot', { format: 'png' });
  const fs = require('fs');
  fs.writeFileSync('C:/Users/Matheus Paes/Documents/ChatGPT/PUB DEV LOOP/f5-real-final.png', Buffer.from(ss.result?.data, 'base64'));
  console.log('[10] Screenshot saved');

  ws.close();
}

run().catch(e => { console.error(e.message); process.exit(1); });

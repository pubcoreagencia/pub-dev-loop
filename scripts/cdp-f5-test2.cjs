// CDP script to click on the session and trigger F5
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
  console.log('[1] Connected');

  // List all projects and find be439c50
  const projects = await send('Runtime.evaluate', {
    expression: `Array.from(document.querySelectorAll('.project-item')).map(p => ({
      name: p.querySelector('.project-name')?.textContent,
      active: p.classList.contains('active'),
      click: p.outerHTML.substring(0, 200)
    }))`,
  });
  console.log('[2] Projects:', JSON.stringify(projects.result?.result?.value, null, 2).substring(0, 2000));

  // Click on the be439c50 session
  const clickResult = await send('Runtime.evaluate', {
    expression: `
      const items = Array.from(document.querySelectorAll('.project-item'));
      const target = items.find(p => p.textContent.includes('be439c50'));
      if (target) {
        target.click();
        'clicked';
      } else {
        'not found';
      }
    `,
  });
  console.log('[3] Click result:', clickResult.result?.result?.value);

  await new Promise(r => setTimeout(r, 2000));

  // Check state after click
  const stateAfterClick = await send('Runtime.evaluate', {
    expression: `JSON.stringify({
      lastSession: localStorage.getItem('pub-prototype:last-session'),
      iframeSrc: document.querySelector('iframe')?.src,
      statusText: document.querySelector('#status')?.textContent,
      projectName: document.querySelector('#projectName')?.textContent,
      activeItem: Array.from(document.querySelectorAll('.project-item')).find(p => p.classList.contains('active'))?.querySelector('.project-name')?.textContent,
    })`,
  });
  console.log('[4] After click:', stateAfterClick.result?.result?.value);

  // Now simulate F5 (reload)
  console.log('[5] F5 (reload)...');
  await send('Page.reload');
  await new Promise(r => setTimeout(r, 8000));

  // Check if recovery happened
  const stateAfterF5 = await send('Runtime.evaluate', {
    expression: `JSON.stringify({
      lastSession: localStorage.getItem('pub-prototype:last-session'),
      iframeSrc: document.querySelector('iframe')?.src,
      statusText: document.querySelector('#status')?.textContent,
      projectName: document.querySelector('#projectName')?.textContent,
    })`,
  });
  console.log('[6] After F5 (8s):', stateAfterF5.result?.result?.value);

  // Wait more for recovery
  await new Promise(r => setTimeout(r, 30000));
  const stateAfterRecovery = await send('Runtime.evaluate', {
    expression: `JSON.stringify({
      lastSession: localStorage.getItem('pub-prototype:last-session'),
      iframeSrc: document.querySelector('iframe')?.src,
      statusText: document.querySelector('#status')?.textContent,
      projectName: document.querySelector('#projectName')?.textContent,
    })`,
  });
  console.log('[7] After F5 + 30s (recovery):', stateAfterRecovery.result?.result?.value);

  // Test if preview is working
  const iframeSrc = JSON.parse(stateAfterRecovery.result?.result?.value || '{}').iframeSrc;
  if (iframeSrc) {
    console.log('[8] Testing preview HTTP:', iframeSrc);
    // Can't test from here, but log it

    // Take screenshot
    const screenshot = await send('Page.captureScreenshot', { format: 'png' });
    const fs = require('fs');
    fs.writeFileSync('C:/Users/Matheus Paes/Documents/ChatGPT/PUB DEV LOOP/f5-after-recovery.png', Buffer.from(screenshot.result?.data, 'base64'));
    console.log('[9] Screenshot saved');
  }

  ws.close();
}

run().catch(console.error);

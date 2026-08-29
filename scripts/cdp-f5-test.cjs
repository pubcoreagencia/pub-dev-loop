// CDP script to test F5 recovery in PP
const WebSocket = require('ws');
const http = require('http');

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
  console.log('[1] Connected to CDP');

  // Wait for page to load
  await send('Page.enable');
  await new Promise(r => setTimeout(r, 3000));

  // Evaluate JS to get current state
  const state1 = await send('Runtime.evaluate', {
    expression: `JSON.stringify({
      url: location.href,
      title: document.title,
      hasProjects: document.querySelectorAll('.project-item').length,
      hasModal: !!document.querySelector('.modal-overlay.show'),
      localStorage: localStorage.getItem('pub-prototype:last-session'),
    })`,
  });
  console.log('[2] Initial state:', state1.result?.result?.value);

  // Set the session in localStorage
  await send('Runtime.evaluate', {
    expression: `localStorage.setItem('pub-prototype:last-session', 'be439c50-5670-4425-8378-bf5ad7c11a5e')`,
  });
  console.log('[3] Set session in localStorage');

  // Reload to load the session
  await send('Page.reload');
  await new Promise(r => setTimeout(r, 5000));

  const state2 = await send('Runtime.evaluate', {
    expression: `JSON.stringify({
      url: location.href,
      title: document.title,
      hasProjects: document.querySelectorAll('.project-item').length,
      hasModal: !!document.querySelector('.modal-overlay.show'),
      iframeSrc: document.querySelector('iframe')?.src,
      statusText: document.querySelector('#status')?.textContent,
      lastSession: localStorage.getItem('pub-prototype:last-session'),
    })`,
  });
  console.log('[4] After reload:', state2.result?.result?.value);

  // Wait for recovery to happen (if needed)
  await new Promise(r => setTimeout(r, 30000));

  const state3 = await send('Runtime.evaluate', {
    expression: `JSON.stringify({
      url: location.href,
      title: document.title,
      hasProjects: document.querySelectorAll('.project-item').length,
      iframeSrc: document.querySelector('iframe')?.src,
      statusText: document.querySelector('#status')?.textContent,
    })`,
  });
  console.log('[5] After 30s wait:', state3.result?.result?.value);

  // Take screenshot
  const screenshot = await send('Page.captureScreenshot', { format: 'png' });
  const fs = require('fs');
  fs.writeFileSync('C:/Users/Matheus Paes/Documents/ChatGPT/PUB DEV LOOP/f5-test-screenshot.png', Buffer.from(screenshot.result?.data, 'base64'));
  console.log('[6] Screenshot saved');

  ws.close();
}

run().catch(console.error);

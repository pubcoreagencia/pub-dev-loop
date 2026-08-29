// P1.1 Full E2E
const WebSocket = require('ws');
const fs = require('fs');
const TAB = process.argv[2] || fs.readFileSync('/tmp/chrome-tab-p11.txt', 'utf8').trim();
const WS_URL = `ws://localhost:9225/devtools/page/${TAB}`;

let id = 1;
const pending = {};
const ws = new WebSocket(WS_URL);
ws.on('message', (data) => {
  const m = JSON.parse(data);
  if (m.id && pending[m.id]) { pending[m.id](m); delete pending[m.id]; }
});
async function send(method, params = {}) {
  return new Promise((resolve) => {
    const myId = id++;
    pending[myId] = resolve;
    ws.send(JSON.stringify({ id: myId, method, params }));
  });
}
async function evalJS(expr, awaitPromise = false) {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise });
  return r.result?.result?.value;
}
async function screenshot(name) {
  const ss = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(`C:/Users/Matheus Paes/Documents/ChatGPT/PUB DEV LOOP/p11-${name}.png`, Buffer.from(ss.result.data, 'base64'));
  console.log('  📸 p11-' + name + '.png');
}

async function waitFor(checkFn, label, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const result = await checkFn();
    if (result) { console.log('  ✅', label, '→', JSON.stringify(result)); return result; }
    await new Promise(r => setTimeout(r, 1000));
  }
  console.log('  ⏱️  timeout:', label);
  return null;
}

async function run() {
  await new Promise(r => ws.once('open', r));
  console.log('=== E2E-1: Empty state ===');
  await evalJS(`localStorage.clear()`);
  await send('Page.reload');
  await new Promise(r => setTimeout(r, 4000));
  const empty = await evalJS(`JSON.stringify({status: document.getElementById('previewStatusLabel')?.textContent, title: document.getElementById('previewEmptyTitle')?.textContent, hasProject: !!sessionId})`);
  console.log('  State:', empty);
  await screenshot('01-empty');

  console.log('\n=== E2E-2: Create project A ===');
  await evalJS(`document.getElementById('newProject').click()`);
  await new Promise(r => setTimeout(r, 500));
  await evalJS(`document.getElementById('newProjectName').value = 'P11 Project A'; document.getElementById('confirmNewProject').click()`);
  await waitFor(async () => {
    const t = await evalJS(`document.getElementById('chatHeaderTitle')?.textContent`);
    return t === 'P11 Project A' ? {project: t} : null;
  }, 'Project A created');
  await screenshot('02-project-A');

  console.log('\n=== E2E-3: Send prompt in project A ===');
  await evalJS(`
    const p = document.getElementById('prompt');
    p.value = 'Create a calculator with basic operations';
    p.dispatchEvent(new Event('input'));
  `);
  await evalJS(`document.getElementById('send').click()`);
  await waitFor(async () => {
    const s = await evalJS(`document.getElementById('previewStatusLabel')?.textContent`);
    return s === 'Preview pronto' || s === 'Carregando preview' ? {status: s} : null;
  }, 'Preview building/ready', 180000);
  await new Promise(r => setTimeout(r, 2000));
  const readyA = await evalJS(`JSON.stringify({status: document.getElementById('previewStatusLabel')?.textContent, previewUrl: document.getElementById('previewUrl')?.textContent})`);
  console.log('  Project A ready:', readyA);
  await screenshot('03-A-ready');

  console.log('\n=== E2E-4: Create project B ===');
  await evalJS(`document.getElementById('newProject').click()`);
  await new Promise(r => setTimeout(r, 500));
  await evalJS(`document.getElementById('newProjectName').value = 'P11 Project B'; document.getElementById('confirmNewProject').click()`);
  await waitFor(async () => {
    const t = await evalJS(`document.getElementById('chatHeaderTitle')?.textContent`);
    return t === 'P11 Project B' ? {project: t} : null;
  }, 'Project B created');
  await screenshot('04-project-B');

  console.log('\n=== E2E-5: Send prompt in project B ===');
  await evalJS(`
    const p = document.getElementById('prompt');
    p.value = 'Create a simple todo list';
    p.dispatchEvent(new Event('input'));
  `);
  await evalJS(`document.getElementById('send').click()`);
  await waitFor(async () => {
    const s = await evalJS(`document.getElementById('previewStatusLabel')?.textContent`);
    return s === 'Preview pronto' || s === 'Carregando preview' ? {status: s} : null;
  }, 'Preview B building/ready', 180000);
  await new Promise(r => setTimeout(r, 2000));
  await screenshot('05-B-ready');

  console.log('\n=== E2E-6: Switch back to project A ===');
  await evalJS(`
    const items = Array.from(document.querySelectorAll('.project-item'));
    const a = items.find(p => p.textContent.includes('P11 Project A'));
    if (a) a.click();
  `);
  await waitFor(async () => {
    const t = await evalJS(`document.getElementById('chatHeaderTitle')?.textContent`);
    return t === 'P11 Project A' ? {project: t} : null;
  }, 'Back to Project A');
  await new Promise(r => setTimeout(r, 2000));
  const backToA = await evalJS(`JSON.stringify({status: document.getElementById('previewStatusLabel')?.textContent, project: document.getElementById('chatHeaderTitle')?.textContent})`);
  console.log('  Back to A:', backToA);
  await screenshot('06-A-after-switch');

  console.log('\n=== E2E-7: F5 ===');
  await send('Page.reload');
  await new Promise(r => setTimeout(r, 5000));
  const f5 = await evalJS(`JSON.stringify({status: document.getElementById('previewStatusLabel')?.textContent, project: document.getElementById('chatHeaderTitle')?.textContent})`);
  console.log('  After F5:', f5);
  await screenshot('07-F5');

  console.log('\n=== E2E-8: Mobile viewport ===');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await new Promise(r => setTimeout(r, 2000));
  await screenshot('08-mobile');
  const mobile = await evalJS(`JSON.stringify({chatVisible: getComputedStyle(document.getElementById('conversation')).display, previewVisible: getComputedStyle(document.getElementById('preview')).display, mobileBtn: getComputedStyle(document.getElementById('mobilePreviewShowBtn')).display})`);
  console.log('  Mobile state:', mobile);

  ws.close();
  console.log('\n=== E2E COMPLETE ===');
}

run().catch(e => { console.error('Error:', e.message); process.exit(1); });

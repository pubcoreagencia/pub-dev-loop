// Capture after screenshots
const WebSocket = require('ws');
const fs = require('fs');

const TAB_ID = process.argv[2] || 'F196DECC9046D3DF26977DDDE74CB9DE';
const WS_URL = `ws://localhost:9224/devtools/page/${TAB_ID}`;

let id = 1;
const pending = {};
const ws = new WebSocket(WS_URL);

ws.on('message', (data) => {
  const m = JSON.parse(data);
  if (m.id && pending[m.id]) {
    pending[m.id](m);
    delete pending[m.id];
  }
});

ws.on('open', async () => {
  function send(method, params = {}) {
    const myId = id++;
    return new Promise((resolve) => {
      pending[myId] = resolve;
      ws.send(JSON.stringify({ id: myId, method, params }));
    });
  }

  await new Promise(r => setTimeout(r, 5000));

  // Screenshot main view
  const ss = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('C:/Users/Matheus Paes/Documents/ChatGPT/PUB DEV LOOP/after-main.png', Buffer.from(ss.result.data, 'base64'));
  console.log('Saved after-main.png');

  // Mobile view
  await send('Emulation.setDeviceMetricsOverride', {
    width: 390, height: 844, deviceScaleFactor: 2, mobile: true,
  });
  await new Promise(r => setTimeout(r, 2000));
  const ssMobile = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('C:/Users/Matheus Paes/Documents/ChatGPT/PUB DEV LOOP/after-mobile.png', Buffer.from(ssMobile.result.data, 'base64'));
  console.log('Saved after-mobile.png');

  ws.close();
});

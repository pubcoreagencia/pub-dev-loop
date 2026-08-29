// Capture baseline screenshot
const WebSocket = require('ws');
const fs = require('fs');

const TAB_ID = 'DD3AD82F155C59D99C45730178D6029C';
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

  // Wait for page to fully load
  await new Promise(r => setTimeout(r, 5000));

  // Screenshot main view
  const ss = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('C:/Users/Matheus Paes/Documents/ChatGPT/PUB DEV LOOP/baseline-main.png', Buffer.from(ss.result.data, 'base64'));
  console.log('Saved baseline-main.png');

  // Mobile view
  await send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true,
  });
  await new Promise(r => setTimeout(r, 2000));
  const ssMobile = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('C:/Users/Matheus Paes/Documents/ChatGPT/PUB DEV LOOP/baseline-mobile.png', Buffer.from(ssMobile.result.data, 'base64'));
  console.log('Saved baseline-mobile.png');

  ws.close();
});

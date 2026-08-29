// Check if the container has the new code
// We can't directly access the container, but we can check via the API Worker
const WebSocket = require('ws');
const http = require('http');

function get(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, data }));
    }).on('error', reject);
  });
}

async function run() {
  // Check health
  const health = await get('https://pub-dev-loop-api.contato-pubcore.workers.dev/health');
  console.log('[Health]:', health.data.substring(0, 300));

  // Try to trigger container
  const trigger = await get('https://pub-dev-loop-api.contato-pubcore.workers.dev/debug/trigger-worker');
  console.log('[Trigger]:', trigger.status, trigger.data.substring(0, 500));
}

run().catch(console.error);

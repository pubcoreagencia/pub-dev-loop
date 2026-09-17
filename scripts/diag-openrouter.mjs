import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

function resolveKey() {
  const candidatePaths = [
    process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'hermes', '.env') : null,
    path.join(os.homedir(), '.hermes', '.env'),
  ].filter(Boolean);

  for (const p of candidatePaths) {
    if (p && fs.existsSync(p)) {
      const content = fs.readFileSync(p, 'utf8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (trimmed.startsWith('OPENROUTER_API_KEY=')) {
          const val = trimmed.slice('OPENROUTER_API_KEY='.length).trim().replace(/^["']|["']$/g, '');
          if (val && val.length > 20) {
            return val;
          }
        }
      }
    }
  }
  return undefined;
}

async function run() {
  const key = resolveKey();
  console.log('STEP_A_KEY_RESOLVED:', Boolean(key), 'LENGTH:', key ? key.length : 0);
  if (!key) {
    console.error('FAIL: No key found');
    process.exit(1);
  }

  const payload = {
    model: 'cohere/north-mini-code:free',
    messages: [{ role: 'user', content: 'Say hello in 1 word' }],
  };

  const started = Date.now();
  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'authorization': `Bearer ${key}`,
        'HTTP-Referer': 'https://github.com/pubcoreagencia/pub-dev-loop',
        'X-Title': 'PUB DEV LOOP Diagnostic',
      },
      body: JSON.stringify(payload),
    });

    console.log('STEP_B_HTTP_STATUS:', res.status, 'DURATION_MS:', Date.now() - started);
    const text = await res.text();
    console.log('STEP_C_RESPONSE_PREVIEW:', text.substring(0, 300));
  } catch (err) {
    console.error('STEP_B_NETWORK_ERROR:', err.message);
  }
}

run();

async function testModels() {
  const models = [
    'gemini/gemini-3.7-flash',
    'gemini/gemini-3.6-flash',
    'ag/gemini-3-flash',
    'kimi/kimi-k2.7-code',
    'nvidia/minimaxai/minimax-m2.7',
    'cx/gpt-5.5'
  ];

  for (const m of models) {
    console.log('Testing model:', m);
    try {
      const res = await fetch('http://127.0.0.1:20128/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: m,
          messages: [{ role: 'user', content: 'Say hello in 3 words' }],
          stream: false
        })
      });
      console.log('Status:', res.status);
      const body = await res.text();
      console.log('Body:', body.slice(0, 300));
      if (res.ok) {
        console.log('SUCCESS with model:', m);
        break;
      }
    } catch(e) {
      console.log('Error:', e.message);
    }
  }
}

testModels();

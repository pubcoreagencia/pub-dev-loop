async function testChatAndTools() {
  const model = 'ag/gemini-3.7-flash-medium';
  console.log('1. Testing Chat Completion on 9Router with model:', model);
  const chatRes = await fetch('http://127.0.0.1:20128/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: model,
      messages: [{ role: 'user', content: 'Say hello in 3 words' }],
      stream: false
    })
  });
  console.log('Chat status:', chatRes.status);
  const chatJson = await chatRes.json();
  console.log('Chat response:', chatJson.choices?.[0]?.message?.content);

  console.log('\n2. Testing Tool Calling on 9Router...');
  const tools = [{
    type: 'function',
    function: {
      name: 'write_file',
      description: 'Write text to a file in workspace',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'relative path' },
          content: { type: 'string', description: 'file content' }
        },
        required: ['path', 'content']
      }
    }
  }];

  const toolRes = await fetch('http://127.0.0.1:20128/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: model,
      messages: [{
        role: 'user',
        content: 'Please use the write_file tool to write "hello world" to file "greeting.txt". Do not reply with text only.'
      }],
      tools: tools,
      tool_choice: 'auto',
      stream: false
    })
  });

  console.log('Tool status:', toolRes.status);
  const toolJson = await toolRes.json();
  console.log('Tool message structure:');
  console.log(JSON.stringify(toolJson.choices?.[0]?.message, null, 2));
}

testChatAndTools().catch(console.error);

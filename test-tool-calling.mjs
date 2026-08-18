async function testToolCalling() {
  const model = 'gemini/gemini-3.6-flash';
  console.log('Testing Tool Calling with model:', model);

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

  const res = await fetch('http://127.0.0.1:20128/v1/chat/completions', {
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

  console.log('Status:', res.status);
  const json = await res.json();
  console.log('Response Message:');
  console.log(JSON.stringify(json.choices?.[0]?.message, null, 2));

  const message = json.choices?.[0]?.message;
  if (message?.tool_calls && message.tool_calls.length > 0) {
    console.log('SUCCESS: tool_calls generated correctly!');
    console.log('Tool Call Name:', message.tool_calls[0].function.name);
    console.log('Tool Call Arguments:', message.tool_calls[0].function.arguments);
  } else {
    console.log('No tool_calls in message.');
  }
}

testToolCalling().catch(console.error);

import { Pool } from 'pg';
import { AgentExecutor } from '../dist/executor.js';
import { ToolRuntime } from '../dist/tools/runtime.js';
import { DEFAULT_ROUTER_BASE_URL, normalizeBaseUrl } from '../dist/providers/shared.js';

const PG_URL = process.env.DATABASE_URL || 'postgres://pubdevloop:pubdevloop@localhost:5432/pubdevloop';
const MODEL_ID = 'kc/cohere/north-mini-code:free';
const baseUrl = normalizeBaseUrl(process.env.ROUTER_BASE_URL, DEFAULT_ROUTER_BASE_URL);

function log(label, value) {
  console.log(label + ':', typeof value === 'string' ? value : JSON.stringify(value, null, 2));
}

async function requestJson(path, body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(baseUrl + path, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(process.env.ROUTER_API_KEY ? { authorization: 'Bearer ' + process.env.ROUTER_API_KEY } : {}),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const text = await response.text().catch(() => '');
    return { status: response.status, ok: response.ok, text };
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  console.log('PDL 9ROUTER DIAGNOSTIC V2');
  console.log('=========================');
  log('Base URL', baseUrl);
  log('API key configured', Boolean(process.env.ROUTER_API_KEY));
  log('Canonical model', MODEL_ID);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  let models = [];
  try {
    const response = await fetch(baseUrl + '/models', {
      method: 'GET',
      headers: process.env.ROUTER_API_KEY
        ? { Authorization: 'Bearer ' + process.env.ROUTER_API_KEY }
        : {},
      signal: controller.signal,
    });
    const body = await response.text().catch(() => '');
    log('GET /models status', response.status);
    if (!response.ok) throw new Error('HTTP ' + response.status + ': ' + body.slice(0, 500));
    const payload = JSON.parse(body);
    models = Array.isArray(payload.data) ? payload.data : [];
    log('Model count', models.length);
    log('Canonical model present', models.some(m => String(m?.id || '').toLowerCase() === MODEL_ID.toLowerCase()));
    const matches = models.filter(m => String(m?.id || '').toLowerCase().includes('north-mini-code'));
    log('north-mini-code matches', matches.map(m => m.id));
  } catch (error) {
    log('GET /models error', error instanceof Error ? error.message : String(error));
    process.exitCode = 2;
  } finally {
    clearTimeout(timer);
  }

  try {
    const executor = new AgentExecutor(undefined, { allowHostExecution: true });
    const runtime = new ToolRuntime({
      workspaceRoot: process.cwd(),
      maxRounds: 20,
      maxToolCalls: 50,
      commandTimeoutMs: 60000,
      maxFileBytes: 1024 * 1024,
      maxWriteBytes: 256 * 1024,
      redactSecrets: true,
    }, executor);
    const tools = runtime.getToolDefinitions().map(def => ({
      type: 'function',
      function: {
        name: def.name,
        description: def.description,
        parameters: def.parameters,
      },
    }));

    const response = await requestJson('/chat/completions', {
      model: MODEL_ID,
      messages: [
        { role: 'system', content: 'PDL router diagnostic. Reply with one short sentence.' },
        { role: 'user', content: 'Return the word READY.' },
      ],
      stream: false,
      tools,
      tool_choice: 'auto',
    });

    log('POST /chat/completions status', response.status);
    log('POST body preview', response.text.slice(0, 1200));

    if (!response.ok) {
      process.exitCode = 4;
    } else {
      try {
        const payload = JSON.parse(response.text);
        log('POST response model', payload?.model || null);
        log('POST finish reason', payload?.choices?.[0]?.finish_reason || null);
        log('POST message preview', payload?.choices?.[0]?.message?.content || '');
      } catch {
        process.exitCode = 5;
      }
    }
  } catch (error) {
    log('POST /chat/completions NETWORK ERROR', error instanceof Error ? error.message : String(error));
    process.exitCode = 4;
  }


  try {
    const executor = new AgentExecutor(undefined, { allowHostExecution: true });
    const runtime = new ToolRuntime({
      workspaceRoot: process.cwd(),
      maxRounds: 20,
      maxToolCalls: 50,
      commandTimeoutMs: 60000,
      maxFileBytes: 1024 * 1024,
      maxWriteBytes: 256 * 1024,
      redactSecrets: true,
    }, executor);
    const toolDefs = runtime.getToolDefinitions().map(def => ({
      type: 'function',
      function: {
        name: def.name,
        description: def.description,
        parameters: def.parameters,
      },
    }));

    const realisticResponse = await requestJson('/chat/completions', {
      model: MODEL_ID,
      messages: [
        {
          role: 'system',
          content:
            'Workspace: ' + process.cwd() + '\n' +
            'You are an autonomous coding agent. Use the available tools to inspect the workspace. ' +
            'Read src/api/validation.ts first, then stop and report what you found.'
        },
        {
          role: 'user',
          content:
            'Inspect src/api/validation.ts. Do not modify files. Use read_file on that exact path, then provide a one-sentence summary.'
        }
      ],
      stream: false,
      tools: toolDefs,
      tool_choice: 'required',
    });

    log('REALISTIC TOOL-CALL status', realisticResponse.status);
    log('REALISTIC TOOL-CALL body preview', realisticResponse.text.slice(0, 2500));

    if (!realisticResponse.ok) {
      process.exitCode = 6;
    } else {
      try {
        const payload = JSON.parse(realisticResponse.text);
        const message = payload?.choices?.[0]?.message;
        log('REALISTIC tool name', message?.tool_calls?.[0]?.function?.name || null);
        log('REALISTIC finish reason', payload?.choices?.[0]?.finish_reason || null);

        if (!message?.tool_calls?.length) {
          console.log('REALISTIC TOOL-CALL: model did not return a tool call');
          process.exitCode = 6;
        } else {
          const tc = message.tool_calls[0];
          const args = JSON.parse(tc.function.arguments);
          const toolResult = await runtime.executeTool(tc.id, tc.function.name, args);
          log('LOCAL TOOL RESULT', toolResult);

          const followupMessages = [
            {
              role: 'system',
              content:
                'Workspace: ' + process.cwd() + '\n' +
                'You are an autonomous coding agent. Continue using tools as needed.'
            },
            {
              role: 'user',
              content:
                'Inspect src/api/validation.ts. Do not modify files. Use read_file on that exact path, then provide a one-sentence summary.'
            },
            {
              role: 'assistant',
              content: message.content ?? null,
              tool_calls: message.tool_calls,
            },
            {
              role: 'tool',
              content: toolResult.success ? (toolResult.content || '(no output)') : ('Error: ' + (toolResult.error || 'Tool execution failed')),
              tool_call_id: toolResult.toolCallId,
            },
          ];

          const secondResponse = await requestJson('/chat/completions', {
            model: MODEL_ID,
            messages: followupMessages,
            stream: false,
            tools: toolDefs,
            tool_choice: 'auto',
          });

          log('REALISTIC FOLLOW-UP status', secondResponse.status);
          log('REALISTIC FOLLOW-UP body preview', secondResponse.text.slice(0, 2500));
          if (!secondResponse.ok) {
            process.exitCode = 7;
          }
        }
      } catch (error) {
        log('REALISTIC TOOL-CALL parse/execution error', error instanceof Error ? error.message : String(error));
        process.exitCode = 6;
      }
    }
  } catch (error) {
    log('REALISTIC TOOL-CALL NETWORK ERROR', error instanceof Error ? error.message : String(error));
    process.exitCode = 6;
  }

  const pool = new Pool({ connectionString: PG_URL });
  try {
    const result = await pool.query(
      'SELECT active_level, kill_switch_active, allowed_products, max_consecutive_tasks, max_consecutive_failures, max_correction_attempts FROM pdl_governance_state WHERE id = $1',
      ['canonical'],
    );
    const row = result.rows[0];
    log('Governance', row || null);
    if (!row || Number(row.active_level) !== 0 || row.kill_switch_active !== true) {
      console.log('Governance canonical baseline: FAIL');
      process.exitCode = 3;
    } else {
      console.log('Governance canonical baseline: PASS');
    }
  } finally {
    await pool.end();
  }

  console.log('Diagnostic exit code:', process.exitCode || 0);
  process.exit(process.exitCode || 0);
}

main().catch(error => {
  console.error('FATAL:', error);
  process.exit(1);
});

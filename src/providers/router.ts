import type { Task } from '../domain.js';
import type { AgentProvider, ProviderTaskResult } from './types.js';
import { DEFAULT_ROUTER_BASE_URL, normalizeBaseUrl } from './shared.js';
import { ToolRuntime } from '../tools/runtime.js';
import { AgentExecutor } from '../executor.js';
import type { ToolCall, ToolResult, ToolExecutionContext, ToolDefinition } from '../tools/types.js';

interface OpenAIChatMessage {
  role: string;
  content?: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

interface OpenAIChatResponse {
  choices?: Array<{
    message?: OpenAIChatMessage;
    finish_reason?: string;
  }>;
  model?: string;
  error?: { message?: string; type?: string; code?: string };
}

/**
 * Build the system + user prompt for the 9Router.
 * Instructs the model to use tools for file/workspace operations.
 */
function buildSystemPrompt(workspace: string, task: Task): OpenAIChatMessage {
  return {
    role: 'system',
    content: [
      'You are a 9router-backed coding agent for PUB DEV LOOP.',
      'You have access to the following tools. Use them to complete the task.',
      'Always resolve file paths within the workspace. Never write outside it.',
      'After writing a file, read it back to verify contents.',
      'After completing all work, provide a final summary without further tool calls.',
      `Workspace: ${workspace}`,
      `Task ID: ${task.id}`,
      `Objective: ${task.objective}`,
    ].join('\n'),
  };
}

function buildUserPrompt(task: Task): OpenAIChatMessage {
  return {
    role: 'user',
    content: task.prompt,
  };
}

/**
 * Convert ToolDefinition[] to OpenAI tools format for the chat completion request.
 */
function toOpenAITools(defs: ToolDefinition[]) {
  return defs.map(def => ({
    type: 'function' as const,
    function: {
      name: def.name,
      description: def.description,
      parameters: def.parameters,
    },
  }));
}

export class RouterProvider implements AgentProvider {
  readonly kind = '9router' as const;
  readonly model = process.env.ROUTER_MODEL ?? null;
  readonly baseUrl: string;
  readonly apiKey: string | undefined;
  readonly timeoutMs: number;
  readonly maxToolRounds: number;
  readonly maxToolCalls: number;

  constructor(
    baseUrl = process.env.ROUTER_BASE_URL ?? DEFAULT_ROUTER_BASE_URL,
    apiKey = process.env.ROUTER_API_KEY,
    timeoutMs = Number(process.env.ROUTER_TIMEOUT_MS ?? 900000),
  ) {
    this.baseUrl = normalizeBaseUrl(baseUrl, DEFAULT_ROUTER_BASE_URL);
    this.apiKey = apiKey?.trim() || undefined;
    this.timeoutMs = timeoutMs;
    this.maxToolRounds = Number(process.env.ROUTER_MAX_TOOL_ROUNDS ?? 20);
    this.maxToolCalls = Number(process.env.ROUTER_MAX_TOOL_CALLS ?? 50);
  }

  async execute(task: Task, workspace: string): Promise<ProviderTaskResult> {
    const started = Date.now();

    // Build tool execution context
    const ctx: ToolExecutionContext = {
      workspaceRoot: workspace,
      maxRounds: this.maxToolRounds,
      maxToolCalls: this.maxToolCalls,
      commandTimeoutMs: Number(process.env.ROUTER_COMMAND_TIMEOUT_MS ?? 60000),
      maxFileBytes: Number(process.env.ROUTER_MAX_FILE_BYTES ?? 1024 * 1024),
      maxWriteBytes: Number(process.env.ROUTER_MAX_WRITE_BYTES ?? 256 * 1024),
      redactSecrets: true,
    };

    const runtime = new ToolRuntime(ctx, new AgentExecutor());
    const toolDefs = runtime.getToolDefinitions();

    // Build initial messages
    const messages: OpenAIChatMessage[] = [
      buildSystemPrompt(workspace, task),
      buildUserPrompt(task),
    ];

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    let modelUsed: string | null = this.model;
    let totalToolCalls = 0;
    let toolRounds = 0;
    let finalMessage = '';
    let lastResponseText = '';

    try {
      // Tool execution loop
      let round = 0;
      // eslint-disable-next-line no-constant-condition
      while (round < this.maxToolRounds) {
        round++;
        toolRounds++;

        // Build request
        const requestBody: Record<string, unknown> = {
          model: this.model ?? 'auto',
          messages: this.messagesToApi(messages),
          stream: false,
          tools: toOpenAITools(toolDefs),
          tool_choice: 'auto',
        };

        const response = await fetch(`${this.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            ...(this.apiKey ? { authorization: `Bearer ${this.apiKey}` } : {}),
          },
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        });

        const text = await response.text();

        if (!response.ok) {
          const errPayload = this.parseError(text);
          return {
            status: 'FAILED',
            provider: this.kind,
            model: modelUsed,
            exitCode: response.status,
            durationMs: Date.now() - started,
            stdout: lastResponseText || '',
            stderr: errPayload.message || text,
            changedFiles: runtime.getChangedFiles(),
            commit: null,
            errorCode: 'ROUTER_HTTP_ERROR',
            errorMessage: `HTTP ${response.status}: ${errPayload.message || ''}`,
          };
        }

        const payload = JSON.parse(text) as OpenAIChatResponse & {
          choices?: Array<{ message?: OpenAIChatMessage; finish_reason?: string }>;
        };

        if (payload.model) {
          modelUsed = payload.model;
        }

        const choice = payload.choices?.[0];
        const message = choice?.message;
        const finishReason = choice?.finish_reason;

        const messageContent = message?.content ?? '';
        lastResponseText = messageContent;

        if (messageContent) {
          finalMessage = messageContent;
        }

        // Check for tool calls
        const toolCalls = message?.tool_calls;
        if (!toolCalls || toolCalls.length === 0) {
          // No more tool calls — model is done
          break;
        }

        // Execute each tool call
        const toolResults: ToolResult[] = [];
        for (const tc of toolCalls) {
          if (totalToolCalls >= this.maxToolCalls) {
            return {
              status: 'FAILED',
              provider: this.kind,
              model: modelUsed,
              exitCode: null,
              durationMs: Date.now() - started,
              stdout: finalMessage,
              stderr: '',
              changedFiles: runtime.getChangedFiles(),
              commit: null,
              errorCode: 'TOOL_LOOP_LIMIT',
              errorMessage: `Exceeded max tool calls (${this.maxToolCalls})`,
            };
          }
          totalToolCalls++;

          // Parse arguments
          let args: Record<string, unknown> = {};
          try {
            args = JSON.parse(tc.function.arguments);
          } catch {
            toolResults.push({
              toolCallId: tc.id,
              toolName: tc.function.name,
              success: false,
              content: '',
              error: 'Failed to parse tool arguments as JSON',
            });
            continue;
          }

          // Execute the tool
          const result = await runtime.executeTool(tc.id, tc.function.name, args);
          toolResults.push(result);
        }

        // Add assistant message (with tool_calls) to conversation
        messages.push({
          role: 'assistant',
          content: messageContent || null,
          tool_calls: toolCalls,
        });

        // Add tool results to conversation
        for (const tr of toolResults) {
          const content = tr.success ? tr.content : `Error: ${tr.error}`;
          messages.push({
            role: 'tool',
            content: content,
            tool_call_id: tr.toolCallId,
          });
        }

        // Check finish reason
        if (finishReason === 'stop') {
          break;
        }
      }

      // Check if we hit the round limit
      if (round >= this.maxToolRounds && messages.length > 2) {
        return {
          status: 'TIMED_OUT',
          provider: this.kind,
          model: modelUsed,
          exitCode: null,
          durationMs: Date.now() - started,
          stdout: finalMessage,
          stderr: '',
          changedFiles: runtime.getChangedFiles(),
          commit: null,
          errorCode: 'TOOL_LOOP_LIMIT',
          errorMessage: `Exceeded max tool rounds (${this.maxToolRounds})`,
        };
      }

      return {
        status: 'COMPLETED',
        provider: this.kind,
        model: modelUsed,
        exitCode: 0,
        durationMs: Date.now() - started,
        stdout: finalMessage,
        stderr: '',
        changedFiles: runtime.getChangedFiles(),
        commit: null,
        errorCode: null,
        errorMessage: null,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Router request failed';
      const isAbort = message.includes('abort') || (error as any)?.name === 'AbortError';

      return {
        status: 'FAILED',
        provider: this.kind,
        model: modelUsed,
        exitCode: null,
        durationMs: Date.now() - started,
        stdout: finalMessage || lastResponseText,
        stderr: message,
        changedFiles: runtime.getChangedFiles(),
        commit: null,
        errorCode: isAbort ? 'ROUTER_TIMEOUT' : 'ROUTER_CONNECTION_ERROR',
        errorMessage: message,
      };
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Convert internal message format to API-compatible format.
   * Always include content (null when empty) for OpenAI-compatible compliance.
   */
  private messagesToApi(messages: OpenAIChatMessage[]): Record<string, unknown>[] {
    return messages.map(msg => {
      const result: Record<string, unknown> = { role: msg.role };
      // Always include content — null when not present (required by Gemini via 9Router)
      if (msg.content !== undefined) {
        result.content = msg.content;
      } else {
        result.content = null;
      }
      if (msg.tool_calls) {
        result.tool_calls = msg.tool_calls;
      }
      if (msg.tool_call_id) {
        result.tool_call_id = msg.tool_call_id;
      }
      return result;
    });
  }

  private parseError(text: string): { message: string; type?: string; code?: string } {
    try {
      const parsed = JSON.parse(text);
      if (parsed.error) return { message: parsed.error.message, type: parsed.error.type, code: parsed.error.code };
    } catch {
      // not JSON
    }
    return { message: text };
  }

  async health() {
    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        headers: this.apiKey ? { authorization: `Bearer ${this.apiKey}` } : undefined,
      });
      return { available: response.ok, details: `GET /models -> ${response.status}` };
    } catch (error) {
      return { available: false, details: error instanceof Error ? error.message : 'unavailable' };
    }
  }

  capabilities() {
    return ['coding', 'planning', 'routing', 'tool-calling'];
  }

  metadata() {
    return { baseUrl: this.baseUrl, model: this.model };
  }
}

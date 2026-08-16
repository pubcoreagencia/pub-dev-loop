import type { Task } from '../domain.js';
import type { AgentProvider, ProviderTaskResult } from './types.js';
import { DEFAULT_ROUTER_BASE_URL, normalizeBaseUrl } from './shared.js';

interface OpenAIChatResponse {
  choices?: Array<{ message?: { content?: string } }>;
  error?: { message?: string; type?: string; code?: string };
}

function parseModelResponse(content: string): string {
  return content.trim();
}

function resultFromResponse(
  provider: '9router',
  model: string | null,
  stdout: string,
  stderr: string,
  durationMs: number,
): ProviderTaskResult {
  return {
    status: 'COMPLETED',
    provider,
    model,
    exitCode: 0,
    durationMs,
    stdout,
    stderr,
    changedFiles: [],
    commit: null,
    errorCode: null,
    errorMessage: null,
  };
}

export class RouterProvider implements AgentProvider {
  readonly kind = '9router' as const;
  readonly model = process.env.ROUTER_MODEL ?? null;
  readonly baseUrl: string;
  readonly apiKey: string | undefined;
  readonly timeoutMs: number;

  constructor(baseUrl = process.env.ROUTER_BASE_URL ?? DEFAULT_ROUTER_BASE_URL, apiKey = process.env.ROUTER_API_KEY, timeoutMs = Number(process.env.ROUTER_TIMEOUT_MS ?? 900000)) {
    this.baseUrl = normalizeBaseUrl(baseUrl, DEFAULT_ROUTER_BASE_URL);
    this.apiKey = apiKey?.trim() || undefined;
    this.timeoutMs = timeoutMs;
  }

  async execute(task: Task, workspace: string): Promise<ProviderTaskResult> {
    const prompt = [
      'You are the 9Router-backed planning brain for PUB DEV LOOP.',
      'Return a concise implementation plan for the task below.',
      'Do not execute shell commands yourself.',
      `Workspace: ${workspace}`,
      `Task ID: ${task.id}`,
      `Objective: ${task.objective}`,
      '',
      task.prompt,
    ].join('\n');

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    const started = Date.now();
    try {
      const response = await fetch(
        `${this.baseUrl}/chat/completions`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            ...(this.apiKey ? { authorization: `Bearer ${this.apiKey}` } : {}),
          },
          body: JSON.stringify({
            model: this.model ?? 'auto',
            messages: [{ role: 'user', content: prompt }],
            stream: false,
          }),
          signal: controller.signal,
        },
      );

      const text = await response.text();
      if (!response.ok) {
        return {
          status: 'FAILED',
          provider: this.kind,
          model: this.model,
          exitCode: response.status,
          durationMs: Date.now() - started,
          stdout: '',
          stderr: text,
          changedFiles: [],
          commit: null,
          errorCode: 'ROUTER_HTTP_ERROR',
          errorMessage: `HTTP ${response.status}`,
        };
      }

      const payload = JSON.parse(text) as OpenAIChatResponse;
      const content = payload.choices?.[0]?.message?.content ?? '';
      return resultFromResponse(this.kind, this.model, parseModelResponse(content), '', Date.now() - started);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Router request failed';
      return {
        status: 'FAILED',
        provider: this.kind,
        model: this.model,
        exitCode: null,
        durationMs: Date.now() - started,
        stdout: '',
        stderr: message,
        changedFiles: [],
        commit: null,
        errorCode: message.includes('abort') ? 'ROUTER_TIMEOUT' : 'ROUTER_CONNECTION_ERROR',
        errorMessage: message,
      };
    } finally {
      clearTimeout(timer);
    }
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
    return ['coding', 'planning', 'routing'];
  }

  metadata() {
    return { baseUrl: this.baseUrl, model: this.model };
  }
}

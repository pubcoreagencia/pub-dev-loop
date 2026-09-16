import * as https from 'https';
import { resolveOpenRouterApiKey } from '../../../../src/providers/shared.js';

export interface LLMRequestOptions {
  model?: string;
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  temperature?: number;
  maxTokens?: number;
}

export interface LLMResponse {
  content: string;
  model: string;
  provider: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    cost: number;
  };
  latencyMs: number;
}

/**
 * Real LLM Client communicating via verified free OpenRouter route without leaking API keys.
 */
export async function callRealLLM(options: LLMRequestOptions): Promise<LLMResponse> {
  const apiKey = resolveOpenRouterApiKey();
  if (!apiKey) {
    throw new Error('No OpenRouter API key found via secure environment bridge');
  }

  const model = options.model || 'openrouter/free';
  const postData = JSON.stringify({
    model,
    messages: options.messages,
    temperature: options.temperature ?? 0.1,
    max_tokens: options.maxTokens ?? 1024,
  });

  const startTime = performance.now();

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'openrouter.ai',
        path: '/api/v1/chat/completions',
        method: 'POST',
        timeout: 20000,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
        },
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          const latencyMs = Math.round((performance.now() - startTime) * 10) / 10;
          if (res.statusCode !== 200) {
            return reject(new Error(`OpenRouter returned status ${res.statusCode}: ${body}`));
          }
          try {
            const data = JSON.parse(body);
            const content = data.choices?.[0]?.message?.content || '';
            const usage = data.usage || {};
            resolve({
              content,
              model: data.model || model,
              provider: data.provider || 'openrouter',
              usage: {
                promptTokens: usage.prompt_tokens || 0,
                completionTokens: usage.completion_tokens || 0,
                totalTokens: usage.total_tokens || 0,
                cost: usage.cost || 0,
              },
              latencyMs,
            });
          } catch (e: any) {
            reject(new Error(`Failed to parse JSON response: ${e.message}`));
          }
        });
      }
    );

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('OpenRouter request timed out after 20000ms'));
    });
    req.on('error', (err) => reject(err));
    req.write(postData);
    req.end();
  });
}

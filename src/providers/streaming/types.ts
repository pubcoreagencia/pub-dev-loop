// src/providers/streaming/types.ts
import type { ToolCall } from '../../tools/types.js';

export type StreamEventType =
  | 'text_delta'
  | 'tool_call_delta'
  | 'tool_call_completed'
  | 'finish_reason'
  | 'usage'
  | 'error'
  | 'stream_completed';

export interface ToolCallDelta {
  index: number;
  id?: string;
  type?: 'function';
  function?: {
    name?: string;
    arguments?: string;
  };
}

export interface StreamUsageData {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  costUsd?: number;
}

export interface StreamEvent {
  type: StreamEventType;
  text?: string;
  toolCallDelta?: ToolCallDelta;
  toolCall?: ToolCall;
  finishReason?: string;
  usage?: StreamUsageData;
  error?: {
    message: string;
    code?: string;
    status?: number;
  };
}

export interface StreamConsumer {
  onEvent?: (event: StreamEvent) => void;
  onTextDelta?: (delta: string) => void;
  onToolCallDelta?: (delta: ToolCallDelta) => void;
  onToolCallCompleted?: (toolCall: ToolCall) => void;
  onUsage?: (usage: StreamUsageData) => void;
  onError?: (error: Error) => void;
}

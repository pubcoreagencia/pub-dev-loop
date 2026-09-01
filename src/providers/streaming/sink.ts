// src/providers/streaming/sink.ts
import type { StreamConsumer, StreamEvent, StreamUsageData, ToolCallDelta } from './types.js';
import type { ToolCall } from '../../tools/types.js';

export interface RuntimeStreamFeedback {
  textBuffer: string;
  toolCallsReceived: ToolCall[];
  completedEventReceived: boolean;
  finishReason?: string;
  usage?: StreamUsageData;
  error?: Error;
  eventsCount: number;
}

/**
 * StreamEventSink
 * A lightweight runtime bridge connecting provider streaming events
 * to execution observation without interfering with task execution lifecycle.
 */
export class StreamEventSink implements StreamConsumer {
  private feedback: RuntimeStreamFeedback = {
    textBuffer: '',
    toolCallsReceived: [],
    completedEventReceived: false,
    eventsCount: 0,
  };

  private readonly externalConsumer?: StreamConsumer;

  constructor(externalConsumer?: StreamConsumer) {
    this.externalConsumer = externalConsumer;
  }

  onEvent(event: StreamEvent): void {
    this.feedback.eventsCount++;

    if (event.type === 'text_delta' && event.text) {
      this.feedback.textBuffer += event.text;
      this.externalConsumer?.onTextDelta?.(event.text);
    } else if (event.type === 'tool_call_completed' && event.toolCall) {
      this.feedback.toolCallsReceived.push(event.toolCall);
      this.externalConsumer?.onToolCallCompleted?.(event.toolCall);
    } else if (event.type === 'tool_call_delta' && event.toolCallDelta) {
      this.externalConsumer?.onToolCallDelta?.(event.toolCallDelta);
    } else if (event.type === 'finish_reason' && event.finishReason) {
      this.feedback.finishReason = event.finishReason;
    } else if (event.type === 'usage' && event.usage) {
      this.feedback.usage = event.usage;
      this.externalConsumer?.onUsage?.(event.usage);
    } else if (event.type === 'stream_completed') {
      this.feedback.completedEventReceived = true;
    }

    this.externalConsumer?.onEvent?.(event);
  }

  onError(error: Error): void {
    this.feedback.error = error;
    this.externalConsumer?.onError?.(error);
  }

  getFeedback(): Readonly<RuntimeStreamFeedback> {
    return { ...this.feedback };
  }

  reset(): void {
    this.feedback = {
      textBuffer: '',
      toolCallsReceived: [],
      completedEventReceived: false,
      eventsCount: 0,
    };
  }
}

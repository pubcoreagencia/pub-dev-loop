// tests/event-bridge-compatibility.test.ts
import { describe, it, expect, vi } from 'vitest';
import { PrototypeEventStream } from '../src/prototype/events.js';
import { OperationalEventBridge } from '../src/prototype/bridge.js';

describe('P5.5 — Event Bridge: Legacy Compatibility & Non-Streaming Fallback', () => {
  it('1. coexists cleanly with direct legacy event emissions on PrototypeEventStream', async () => {
    const stream = new PrototypeEventStream();
    const bridge = new OperationalEventBridge('sess-compat-1', stream, { coalesceDeltas: false });

    const allEmitted: any[] = [];
    stream.subscribe((event) => {
      allEmitted.push(event);
    });

    // 1. Direct legacy event
    stream.emit({
      sessionId: 'sess-compat-1',
      type: 'AGENT_STARTED',
      payload: { taskId: 'task-compat-1' },
    });

    // 2. Streamed operational event via Bridge
    await bridge.handleEnvelope({
      taskId: 'task-compat-1',
      attempt: 0,
      seq: 0,
      timestamp: new Date().toISOString(),
      type: 'text_delta',
      payload: { text: 'chunk from stream' },
    });

    // 3. Direct legacy final output
    stream.emit({
      sessionId: 'sess-compat-1',
      type: 'AGENT_OUTPUT',
      payload: { summary: 'Full summary text', changedFiles: [] },
    });

    // 4. Direct build events
    stream.emit({
      sessionId: 'sess-compat-1',
      type: 'BUILD_PASSED',
      payload: { commitSha: 'abc1234' },
    });

    await bridge.close();

    expect(allEmitted.length).toBe(4);
    expect(allEmitted.map(e => e.type)).toEqual([
      'AGENT_STARTED',
      'AGENT_TEXT_DELTA',
      'AGENT_OUTPUT',
      'BUILD_PASSED',
    ]);
    expect(allEmitted.map(e => e.sequence)).toEqual([1, 2, 3, 4]);
  });
});

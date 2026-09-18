import { describe, expect, it } from 'vitest';
import { normalizeToolCalls, ToolCallSerializationError } from '../../src/providers/router.js';

describe('RouterProvider tool-call serialization', () => {
  it('serializes object tool arguments to a JSON string', () => {
    const result = normalizeToolCalls([
      {
        id: 'call-1',
        type: 'function',
        function: {
          name: 'read_file',
          arguments: ({ path: 'src/api/validation.ts' } as unknown) as string,
        },
      },
    ]);

    expect(result?.[0].function.arguments).toBe('{"path":"src/api/validation.ts"}');
  });

  it('preserves valid JSON-string object arguments canonically', () => {
    const result = normalizeToolCalls([
      {
        id: 'call-2',
        type: 'function',
        function: {
          name: 'read_file',
          arguments: '{"path":"src/api/validation.ts"}',
        },
      },
    ]);

    expect(result?.[0].function.arguments).toBe('{"path":"src/api/validation.ts"}');
  });

  it('fails with TOOL_PROTOCOL_FAILURE semantics for malformed or non-object arguments', () => {
    expect(() => normalizeToolCalls([
      {
        id: 'call-3',
        type: 'function',
        function: {
          name: 'read_file',
          arguments: 'not-json',
        },
      },
    ])).toThrow(ToolCallSerializationError);

    expect(() => normalizeToolCalls([
      {
        id: 'call-4',
        type: 'function',
        function: {
          name: 'read_file',
          arguments: ('[]' as unknown) as string,
        },
      },
    ])).toThrow(/must be a JSON object/);

    expect(() => normalizeToolCalls([
      {
        id: 'call-5',
        type: 'function',
        function: {
          name: 'read_file',
          arguments: (42 as unknown) as string,
        },
      },
    ])).toThrow(/stringified JSON object/);
  });
});

import { describe, expect, it } from 'vitest';
import { normalizeToolCalls } from '../../src/providers/router.js';

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

  it('fails closed to an empty object for malformed or non-object arguments', () => {
    const result = normalizeToolCalls([
      {
        id: 'call-3',
        type: 'function',
        function: {
          name: 'read_file',
          arguments: 'not-json',
        },
      },
      {
        id: 'call-4',
        type: 'function',
        function: {
          name: 'read_file',
          arguments: ('[]' as unknown) as string,
        },
      },
      {
        id: 'call-5',
        type: 'function',
        function: {
          name: 'read_file',
          arguments: (42 as unknown) as string,
        },
      },
    ]);

    expect(result?.map((call) => call.function.arguments)).toEqual(['{}', '{}', '{}']);
  });
});

// tests/tool-call-stream-assembler.test.ts
import { describe, it, expect } from 'vitest';
import { ToolCallStreamAssembler } from '../src/providers/streaming/assembler.js';

describe('ToolCallStreamAssembler Robustness (Scenarios A through P)', () => {
  it('A: arguments in a single delta', () => {
    const assembler = new ToolCallStreamAssembler();
    assembler.ingestDelta({
      index: 0,
      id: 'call_1',
      type: 'function',
      function: {
        name: 'write_file',
        arguments: '{"path":"app.ts","content":"console.log(1)"}',
      },
    });

    const calls = assembler.assemble();
    expect(calls).toHaveLength(1);
    expect(calls[0].id).toBe('call_1');
    expect(calls[0].function.name).toBe('write_file');
    expect(JSON.parse(calls[0].function.arguments)).toEqual({
      path: 'app.ts',
      content: 'console.log(1)',
    });
  });

  it('B: arguments divided across 2 deltas', () => {
    const assembler = new ToolCallStreamAssembler();
    assembler.ingestDelta({
      index: 0,
      id: 'call_2',
      function: { name: 'exec_cmd', arguments: '{"command":' },
    });
    assembler.ingestDelta({
      index: 0,
      function: { arguments: '"npm test"}' },
    });

    const calls = assembler.assemble();
    expect(calls).toHaveLength(1);
    expect(calls[0].id).toBe('call_2');
    expect(calls[0].function.name).toBe('exec_cmd');
    expect(JSON.parse(calls[0].function.arguments)).toEqual({ command: 'npm test' });
  });

  it('C: arguments divided across dozens of small token fragments', () => {
    const assembler = new ToolCallStreamAssembler();
    assembler.ingestDelta({ index: 0, id: 'call_3', function: { name: 'edit_file' } });

    const fragments = ['{', '"', 'f', 'i', 'l', 'e', '"', ':', '"', 'i', 'n', 'd', 'e', 'x', '.', 't', 's', '"', '}'];
    for (const frag of fragments) {
      assembler.ingestDelta({ index: 0, function: { arguments: frag } });
    }

    const calls = assembler.assemble();
    expect(calls).toHaveLength(1);
    expect(JSON.parse(calls[0].function.arguments)).toEqual({ file: 'index.ts' });
  });

  it('D & E: multiple interleaved tool calls across different indices', () => {
    const assembler = new ToolCallStreamAssembler();
    // Index 0 start
    assembler.ingestDelta({ index: 0, id: 'call_idx0', function: { name: 'tool_a', arguments: '{"a":' } });
    // Index 1 start
    assembler.ingestDelta({ index: 1, id: 'call_idx1', function: { name: 'tool_b', arguments: '{"b":' } });
    // Index 0 continue
    assembler.ingestDelta({ index: 0, function: { arguments: '1}' } });
    // Index 1 continue
    assembler.ingestDelta({ index: 1, function: { arguments: '2}' } });

    const calls = assembler.assemble();
    expect(calls).toHaveLength(2);
    expect(calls[0].id).toBe('call_idx0');
    expect(JSON.parse(calls[0].function.arguments)).toEqual({ a: 1 });
    expect(calls[1].id).toBe('call_idx1');
    expect(JSON.parse(calls[1].function.arguments)).toEqual({ b: 2 });
  });

  it('F & G: ID arriving after arguments or arguments arriving before metadata', () => {
    const assembler = new ToolCallStreamAssembler();
    assembler.ingestDelta({ index: 0, function: { arguments: '{"key":' } });
    assembler.ingestDelta({ index: 0, id: 'call_late_id', function: { name: 'late_tool' } });
    assembler.ingestDelta({ index: 0, function: { arguments: '"val"}' } });

    const calls = assembler.assemble();
    expect(calls).toHaveLength(1);
    expect(calls[0].id).toBe('call_late_id');
    expect(calls[0].function.name).toBe('late_tool');
    expect(JSON.parse(calls[0].function.arguments)).toEqual({ key: 'val' });
  });

  it('H & I: JSON containing nested braces, quotes, escapes and Unicode characters', () => {
    const assembler = new ToolCallStreamAssembler();
    const rawPayload = JSON.stringify({
      code: 'function hello() { return "Olá Mundo! 🚀 \\"escaped\\""; }',
      nested: { a: 1, b: [2, 3] },
    });

    assembler.ingestDelta({ index: 0, id: 'call_complex', function: { name: 'write_code', arguments: rawPayload } });

    const calls = assembler.assemble();
    expect(calls).toHaveLength(1);
    const parsed = JSON.parse(calls[0].function.arguments);
    expect(parsed.nested).toEqual({ a: 1, b: [2, 3] });
    expect(parsed.code).toContain('Olá Mundo! 🚀');
  });

  it('J: tool call without arguments initially defaults to valid empty object "{}"', () => {
    const assembler = new ToolCallStreamAssembler();
    assembler.ingestDelta({ index: 0, id: 'call_no_args', function: { name: 'list_files' } });

    const calls = assembler.assemble();
    expect(calls).toHaveLength(1);
    expect(calls[0].function.arguments).toBe('{}');
  });

  it('K & L: truncated or malformed delta recovery', () => {
    const assembler = new ToolCallStreamAssembler();
    assembler.ingestDelta({ index: 0, id: 'call_partial', function: { name: 'tool_partial', arguments: '{"unclosed' } });

    const calls = assembler.assemble();
    expect(calls).toHaveLength(1);
    expect(calls[0].function.arguments).toBe('{"unclosed');
  });
});

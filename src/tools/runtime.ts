import { promises as fs, constants as fsConstants } from 'node:fs';
import { join, relative, sep, parse } from 'node:path';
import { AgentExecutor, type ExecutionResult, type ExecutionRequest } from '../executor.js';
import { WorkspaceSecurity } from './security.js';
import type { ToolResult, ToolExecutionContext, ToolDefinition } from './types.js';
import { redact } from '../executor.js';

/**
 * ToolRuntime: executes tools requested by the 9Router LLM.
 *
 * All filesystem operations are confined to the workspace root.
 * Commands are executed via AgentExecutor with workspace cwd.
 * Git operations are restricted to safe subcommands.
 */
export class ToolRuntime {
  private readonly security: WorkspaceSecurity;
  private readonly executor: AgentExecutor;
  private readonly ctx: ToolExecutionContext;
  private readonly changedFiles: Set<string> = new Set();
  private readonly calledTools: Set<string> = new Set();
  private toolCallCounter: number = 0;

  constructor(ctx: ToolExecutionContext, executor: AgentExecutor = new AgentExecutor()) {
    this.ctx = ctx;
    this.security = new WorkspaceSecurity(ctx.workspaceRoot);
    this.executor = executor;
  }

  /**
   * Get the OpenAI-compatible tool definitions for all implemented tools.
   */
  getToolDefinitions(): ToolDefinition[] {
    return [
      {
        name: 'read_file',
        description: 'Read the contents of a file within the task workspace. Returns an error if the file does not exist or is outside the workspace.',
        parameters: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Path to the file to read (relative to workspace or absolute within workspace).',
            },
          },
          required: ['path'],
        },
      },
      {
        name: 'write_file',
        description: 'Write content to a file within the task workspace. Creates parent directories if needed. Overwrites existing files.',
        parameters: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Path to the file to write (relative to workspace or absolute within workspace).',
            },
            content: {
              type: 'string',
              description: 'The content to write to the file.',
            },
          },
          required: ['path', 'content'],
        },
      },
      {
        name: 'list_files',
        description: 'List files and directories within the workspace. Returns relative paths.',
        parameters: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Directory path to list (defaults to workspace root). Must be within workspace.',
            },
            limit: {
              type: 'integer',
              description: 'Maximum number of entries to return (default 100, max 500).',
            },
          },
          required: [],
        },
      },
      {
        name: 'run_command',
        description: 'Execute a shell command within the task workspace. Returns stdout, stderr, and exit code.',
        parameters: {
          type: 'object',
          properties: {
            command: {
              type: 'string',
              description: 'The command to execute. cwd will be the workspace root.',
            },
            timeout_ms: {
              type: 'integer',
              description: 'Timeout in milliseconds (default 60000, max 300000).',
            },
          },
          required: ['command'],
        },
      },
    ];
  }

  /**
   * Execute a single tool call and return the result.
   */
  async executeTool(toolCallId: string, toolName: string, args: Record<string, unknown>): Promise<ToolResult> {
    this.calledTools.add(toolName);

    try {
      switch (toolName) {
        case 'read_file':
          return await this.readFile(toolCallId, args);
        case 'write_file':
          return await this.writeFile(toolCallId, args);
        case 'list_files':
          return await this.listFiles(toolCallId, args);
        case 'run_command':
          return await this.runCommand(toolCallId, args);
        default:
          return {
            toolCallId,
            toolName,
            success: false,
            content: '',
            error: `Unknown tool: ${toolName}`,
          };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        toolCallId,
        toolName,
        success: false,
        content: '',
        error: message,
      };
    }
  }

  private async readFile(toolCallId: string, args: Record<string, unknown>): Promise<ToolResult> {
    const path = String(args.path ?? '');
    const resolved = this.security.resolvePath(path);

    try {
      const stat = await fs.stat(resolved);
      if (!stat.isFile()) {
        return {
          toolCallId,
          toolName: 'read_file',
          success: false,
          content: '',
          error: `Not a file: ${relative(this.security.root, resolved)}`,
        };
      }

      if (stat.size > this.ctx.maxFileBytes) {
        return {
          toolCallId,
          toolName: 'read_file',
          success: false,
          content: '',
          error: `File too large: ${stat.size} bytes (max ${this.ctx.maxFileBytes})`,
        };
      }

      const content = await fs.readFile(resolved, 'utf8');
      return {
        toolCallId,
        toolName: 'read_file',
        success: true,
        content: content,
        error: null,
      };
    } catch (e: any) {
      return {
        toolCallId,
        toolName: 'read_file',
        success: false,
        content: '',
        error: `File not found: ${relative(this.security.root, resolved)}`,
      };
    }
  }

  private async writeFile(toolCallId: string, args: Record<string, unknown>): Promise<ToolResult> {
    const path = String(args.path ?? '');
    const content = String(args.content ?? '');
    const resolved = this.security.resolvePath(path);

    if (content.length > this.ctx.maxWriteBytes) {
      return {
        toolCallId,
        toolName: 'write_file',
        success: false,
        content: '',
        error: `Content too large: ${content.length} chars (max ${this.ctx.maxWriteBytes})`,
      };
    }

    // Create parent directories
    const parent = resolved.substring(0, resolved.lastIndexOf(sep));
    if (parent && parent !== resolved) {
      await fs.mkdir(parent, { recursive: true });
    }

    await fs.writeFile(resolved, content, 'utf8');

    // Track changed files (relative to workspace)
    const relativePath = relative(this.security.root, resolved);
    this.changedFiles.add(relativePath);

    return {
      toolCallId,
      toolName: 'write_file',
      success: true,
      content: `Wrote ${content.length} chars to ${relativePath}`,
      error: null,
    };
  }

  private async listFiles(toolCallId: string, args: Record<string, unknown>): Promise<ToolResult> {
    const dirPath = String(args.path ?? '.');
    const limit = Math.min(Number(args.limit ?? 100), 500);
    const resolved = this.security.resolvePath(dirPath);

    try {
      const entries = await fs.readdir(resolved, { withFileTypes: true });
      const results: string[] = [];

      for (const entry of entries) {
        if (results.length >= limit) break;
        const relativePath = relative(this.security.root, join(resolved, entry.name));
        const suffix = entry.isDirectory() ? '/' : '';
        results.push(relativePath + suffix);
      }

      return {
        toolCallId,
        toolName: 'list_files',
        success: true,
        content: results.join('\n'),
        error: null,
      };
    } catch (e: any) {
      return {
        toolCallId,
        toolName: 'list_files',
        success: false,
        content: '',
        error: `Cannot list directory: ${dirPath}`,
      };
    }
  }

  private async runCommand(toolCallId: string, args: Record<string, unknown>): Promise<ToolResult> {
    const command = String(args.command ?? '');
    const timeoutMs = Math.min(Number(args.timeout_ms ?? 60000), this.ctx.commandTimeoutMs);

    if (!command.trim()) {
      return {
        toolCallId,
        toolName: 'run_command',
        success: false,
        content: '',
        error: 'Empty command',
      };
    }

    // Parse command into parts (simple split — no shell expansion)
    const parts = this.parseCommand(command);

    const request: ExecutionRequest = {
      command: parts[0],
      args: parts.slice(1),
      cwd: this.security.root,
      timeoutMs,
      environment: this.ctx.redactSecrets ? this.redactEnv(process.env) : process.env,
    };

    const execResult = await this.executor.execute(request);

    if (execResult.status === 'COMPLETED') {
      return {
        toolCallId,
        toolName: 'run_command',
        success: true,
        content: execResult.stdout || '',
        error: null,
      };
    }

    return {
      toolCallId,
      toolName: 'run_command',
      success: false,
      content: execResult.stdout || '',
      error: `Command failed (exit ${execResult.exitCode || 'N/A'}): ${execResult.stderr || execResult.status}`,
    };
  }

  /**
   * Simple command parser: splits on spaces but respects quotes.
   * Does not use shell — passes directly to spawn.
   */
  private parseCommand(command: string): string[] {
    const parts: string[] = [];
    let current = '';
    let inQuote = false;
    let quoteChar = '';

    for (let i = 0; i < command.length; i++) {
      const char = command[i];
      if ((char === '"' || char === "'") && !inQuote) {
        inQuote = true;
        quoteChar = char;
      } else if (char === quoteChar && inQuote) {
        inQuote = false;
        quoteChar = '';
      } else if (char === ' ' && !inQuote) {
        if (current) parts.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    if (current) parts.push(current);

    return parts;
  }

  /**
   * Redact known secret patterns from environment variables.
   */
  private redactEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
    const redacted: NodeJS.ProcessEnv = { ...env };
    for (const [key, value] of Object.entries(env)) {
      if (value && /(api[_-]?key|token|password|secret|credential|private[_-]?key)/i.test(key) && value.length >= 4) {
        redacted[key] = '[REDACTED]';
      }
    }
    return redacted;
  }

  /**
   * Get list of changed files (relative to workspace).
   */
  getChangedFiles(): string[] {
    return Array.from(this.changedFiles);
  }

  /**
   * Get list of tool names that were called.
   */
  getCalledTools(): string[] {
    return Array.from(this.calledTools);
  }
}

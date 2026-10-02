import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import type { AgentEvent, HookProvider } from '../../../../../core/src/provider.js';
import {
  CODEX_DISPLAY_NAME,
  CODEX_PERMISSION_EXEMPT_TOOLS,
  CODEX_PROVIDER_ID,
  CODEX_READING_TOOLS,
  CODEX_SESSION_FILE_PATTERN,
  CODEX_SUBAGENT_TOOLS,
  CODEX_TERMINAL_NAME_PREFIX,
} from './constants.js';

function getCodexHome(): string {
  return process.env.CODEX_HOME || path.join(os.homedir(), '.codex');
}

export function formatToolStatus(toolName: string, input?: unknown): string {
  const inp = (input ?? {}) as Record<string, unknown>;
  const base = (p: unknown) => (typeof p === 'string' ? path.basename(p) : '');

  switch (toolName.toLowerCase()) {
    case 'shell':
    case 'shell_command':
    case 'bash':
    case 'exec':
    case 'run_command': {
      const cmd = (inp.command as string) || (inp.cmd as string) || (inp.CommandLine as string) || '';
      return `Running: ${cmd.length > 50 ? cmd.slice(0, 50) + '…' : cmd}`;
    }
    case 'read':
    case 'read_file':
    case 'view_file':
      return `Reading ${base(inp.path ?? inp.file_path ?? inp.AbsolutePath)}`;
    case 'write':
    case 'write_file':
    case 'create_file':
      return `Writing ${base(inp.path ?? inp.file_path ?? inp.TargetFile)}`;
    case 'apply_patch':
    case 'patch':
    case 'edit':
    case 'edit_file':
      return `Patching ${base(inp.path ?? inp.file_path ?? inp.TargetFile)}`;
    case 'grep':
    case 'search':
    case 'find':
      return 'Searching codebase';
    default:
      return `Using ${toolName}`;
  }
}

function normalizeToolName(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes('shell') || lower.includes('bash') || lower.includes('exec') || lower.includes('command')) return 'Bash';
  if (lower.includes('read') || lower.includes('view')) return 'Read';
  if (lower.includes('write') || lower.includes('create')) return 'Write';
  if (lower.includes('patch') || lower.includes('edit')) return 'Edit';
  if (lower.includes('grep') || lower.includes('find')) return 'Grep';
  return name;
}

export function parseTranscriptLine(line: string): AgentEvent | null {
  try {
    const record = JSON.parse(line) as Record<string, unknown>;
    const type = String(record.type ?? record.event ?? record.role ?? '');

    // Codex rollout lines: function_call / tool_call
    if (type === 'function_call' || record.function_call || record.tool_calls) {
      const calls = (record.tool_calls as Array<Record<string, unknown>>) ?? [
        (record.function_call as Record<string, unknown>) ?? record,
      ];
      const first = calls[0];
      const fnName = String(first.name ?? (first.function as Record<string, unknown>)?.name ?? 'Bash');
      let args: Record<string, unknown> = {};
      const rawArgs = first.arguments ?? first.args ?? (first.function as Record<string, unknown>)?.arguments;
      if (typeof rawArgs === 'string') {
        try { args = JSON.parse(rawArgs); } catch { /* ignore */ }
      } else if (typeof rawArgs === 'object' && rawArgs) {
        args = rawArgs as Record<string, unknown>;
      }
      return {
        kind: 'toolStart',
        toolId: String(first.id ?? first.call_id ?? `codex-${Date.now()}`),
        toolName: normalizeToolName(fnName),
        input: args,
      };
    }

    // Function output / tool result
    if (type === 'function_output' || type === 'tool_result' || type === 'tool') {
      const toolId = String(record.call_id ?? record.tool_call_id ?? record.id ?? 'codex-tool');
      return { kind: 'toolEnd', toolId };
    }

    // Assistant response completion
    if (type === 'turn_completed' || type === 'turn_finish' || type === 'stop') {
      return { kind: 'turnEnd', awaitingInput: false };
    }

    // User message / prompt
    if (type === 'user' || type === 'user_input') {
      return { kind: 'turnEnd', awaitingInput: false };
    }

    // Session creation
    if (type === 'session_start' || type === 'turn_context') {
      return { kind: 'sessionStart', source: 'codex' };
    }

    return null;
  } catch {
    return null;
  }
}

function getSessionDirs(_workspacePath: string): string[] {
  const base = getCodexHome();
  const dirs: string[] = [];
  const sessions = path.join(base, 'sessions');
  const archived = path.join(base, 'archived_sessions');

  const addDirsRecursive = (dir: string, depth: number) => {
    if (depth > 4 || !fs.existsSync(dir)) return;
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      let hasJsonl = false;
      for (const e of entries) {
        if (e.isDirectory()) {
          addDirsRecursive(path.join(dir, e.name), depth + 1);
        } else if (e.isFile() && e.name.endsWith('.jsonl')) {
          hasJsonl = true;
        }
      }
      if (hasJsonl) {
        dirs.push(dir);
      }
    } catch {
      /* ignore */
    }
  };

  addDirsRecursive(sessions, 0);
  addDirsRecursive(archived, 0);
  return dirs;
}

function getAllSessionRoots(): string[] {
  const base = getCodexHome();
  const roots: string[] = [];
  const sessions = path.join(base, 'sessions');
  const archived = path.join(base, 'archived_sessions');

  // We return leaf folders or subfolders containing session files
  const collectLeaves = (dir: string, depth: number) => {
    if (depth > 4 || !fs.existsSync(dir)) return;
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      let hasFiles = false;
      for (const e of entries) {
        if (e.isDirectory()) {
          collectLeaves(path.join(dir, e.name), depth + 1);
        } else if (e.isFile() && e.name.endsWith('.jsonl')) {
          hasFiles = true;
        }
      }
      if (hasFiles) {
        roots.push(dir);
      }
    } catch {
      /* ignore */
    }
  };

  collectLeaves(sessions, 0);
  collectLeaves(archived, 0);

  if (roots.length === 0) {
    if (fs.existsSync(sessions)) roots.push(sessions);
    if (fs.existsSync(archived)) roots.push(archived);
  }
  return roots;
}

export const codexProvider: HookProvider = {
  kind: 'hook',
  id: CODEX_PROVIDER_ID,
  displayName: CODEX_DISPLAY_NAME,
  protocolVersion: 1,

  normalizeHookEvent(raw: Record<string, unknown>) {
    const sessionId = String(raw.sessionId ?? raw.session_id ?? 'codex-session');
    const eventType = String(raw.event ?? raw.type ?? '');

    if (eventType === 'tool_start' || eventType === 'toolStart') {
      return {
        sessionId,
        event: {
          kind: 'toolStart',
          toolId: String(raw.toolId ?? `tool-${Date.now()}`),
          toolName: normalizeToolName(String(raw.toolName ?? 'Bash')),
          input: raw.input,
        },
      };
    }
    if (eventType === 'tool_end' || eventType === 'toolEnd') {
      return {
        sessionId,
        event: {
          kind: 'toolEnd',
          toolId: String(raw.toolId ?? ''),
        },
      };
    }
    if (eventType === 'turn_end' || eventType === 'turnEnd' || eventType === 'done') {
      return {
        sessionId,
        event: {
          kind: 'turnEnd',
          awaitingInput: Boolean(raw.awaitingInput),
        },
      };
    }
    return null;
  },

  async installHooks(): Promise<void> {
    const dir = getCodexHome();
    if (!fs.existsSync(dir)) {
      console.log(`[Pixel Agents] Codex directory not found at ${dir}. Will watch when created.`);
    } else {
      console.log(`[Pixel Agents] Codex session watcher active: ${dir}`);
    }
  },

  async uninstallHooks(): Promise<void> {},

  async areHooksInstalled(): Promise<boolean> {
    return fs.existsSync(getCodexHome());
  },

  consentDisclosure() {
    return {
      headline: 'Enable Codex Provider',
      disclosure: 'Monitors OpenAI Codex CLI sessions and displays agents in the office.',
    };
  },

  formatToolStatus,
  permissionExemptTools: CODEX_PERMISSION_EXEMPT_TOOLS,
  subagentToolNames: CODEX_SUBAGENT_TOOLS,
  readingTools: CODEX_READING_TOOLS,
  terminalNamePrefix: CODEX_TERMINAL_NAME_PREFIX,

  getSessionDirs,
  getAllSessionRoots,
  sessionFilePattern: CODEX_SESSION_FILE_PATTERN,
  parseTranscriptLine,
};

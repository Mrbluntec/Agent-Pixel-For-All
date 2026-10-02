import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import type { AgentEvent, HookProvider } from '../../../../../core/src/provider.js';
import {
  OPENCODE_DISPLAY_NAME,
  OPENCODE_PERMISSION_EXEMPT_TOOLS,
  OPENCODE_PROVIDER_ID,
  OPENCODE_READING_TOOLS,
  OPENCODE_SESSION_FILE_PATTERN,
  OPENCODE_STORAGE_SUBDIR,
  OPENCODE_SUBAGENT_TOOLS,
  OPENCODE_TERMINAL_NAME_PREFIX,
} from './constants.js';

function getOpenCodeStorageDir(): string {
  return path.join(os.homedir(), OPENCODE_STORAGE_SUBDIR);
}

function formatToolStatus(toolName: string, input?: unknown): string {
  const inp = (input ?? {}) as Record<string, unknown>;
  const base = (p: unknown) => (typeof p === 'string' ? path.basename(p) : '');
  const name = toolName.toLowerCase();
  if (name.includes('bash') || name.includes('exec') || name.includes('shell')) {
    const cmd = String(inp.command ?? inp.cmd ?? '');
    return `Running: ${cmd.length > 50 ? cmd.slice(0, 50) + '\u2026' : cmd}`;
  }
  if (name.includes('read') || name.includes('view')) return `Reading ${base(inp.path ?? inp.file_path)}`;
  if (name.includes('write') || name.includes('create')) return `Writing ${base(inp.path ?? inp.file_path)}`;
  if (name.includes('edit') || name.includes('patch')) return `Editing ${base(inp.path ?? inp.file_path)}`;
  if (name.includes('glob') || name.includes('grep') || name.includes('find')) return 'Searching codebase';
  return `Using ${toolName}`;
}

export function parseTranscriptLine(line: string): AgentEvent | null {
  try {
    const record = JSON.parse(line) as Record<string, unknown>;
    const type = String(record.type ?? record.event ?? '');
    if (type === 'tool_use' || record.tool_use) {
      const tu = (record.tool_use as Record<string, unknown>) ?? record;
      return {
        kind: 'toolStart',
        toolId: String(tu.id ?? `opencode-${Date.now()}`),
        toolName: String(tu.name ?? 'Bash'),
        input: (tu.input ?? {}) as Record<string, unknown>,
      };
    }
    if (type === 'tool_result') {
      return { kind: 'toolEnd', toolId: String(record.tool_use_id ?? record.id ?? '') };
    }
    if (type === 'step_start' || type === 'session_created') {
      return { kind: 'sessionStart', source: 'opencode' };
    }
    if (type === 'turn_completed' || type === 'stop') {
      return { kind: 'turnEnd', awaitingInput: false };
    }
    return null;
  } catch { return null; }
}

function getSessionDirs(_workspacePath: string): string[] {
  const base = path.join(getOpenCodeStorageDir(), 'storage', 'session');
  if (!fs.existsSync(base)) return [];
  try {
    return fs.readdirSync(base, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => path.join(base, d.name))
      .filter(d => fs.existsSync(d));
  } catch { return []; }
}

function getAllSessionRoots(): string[] {
  const base = path.join(getOpenCodeStorageDir(), 'storage', 'session');
  return fs.existsSync(base) ? [base] : [];
}

export const openCodeProvider: HookProvider = {
  kind: 'hook',
  id: OPENCODE_PROVIDER_ID,
  displayName: OPENCODE_DISPLAY_NAME,
  protocolVersion: 1,
  normalizeHookEvent(raw: Record<string, unknown>) {
    const sessionId = String(raw.sessionId ?? raw.session_id ?? 'opencode-session');
    const type = String(raw.event ?? raw.type ?? '');
    if (type === 'tool_start') return { sessionId, event: { kind: 'toolStart', toolId: String(raw.toolId ?? ''), toolName: String(raw.toolName ?? 'Bash'), input: raw.input } };
    if (type === 'tool_end') return { sessionId, event: { kind: 'toolEnd', toolId: String(raw.toolId ?? '') } };
    if (type === 'turn_end') return { sessionId, event: { kind: 'turnEnd', awaitingInput: Boolean(raw.awaitingInput) } };
    return null;
  },
  async installHooks(): Promise<void> {
    const dir = getOpenCodeStorageDir();
    if (!fs.existsSync(dir)) { console.log(`[Pixel Agents] OpenCode dir not found at ${dir}.`); }
    else { console.log(`[Pixel Agents] OpenCode session watcher active: ${dir}`); }
  },
  async uninstallHooks(): Promise<void> {},
  async areHooksInstalled(): Promise<boolean> { return fs.existsSync(getOpenCodeStorageDir()); },
  consentDisclosure() { return { headline: 'Enable OpenCode Provider', disclosure: 'Monitors OpenCode sessions and displays agents in the office.' }; },
  formatToolStatus,
  permissionExemptTools: OPENCODE_PERMISSION_EXEMPT_TOOLS,
  subagentToolNames: OPENCODE_SUBAGENT_TOOLS,
  readingTools: OPENCODE_READING_TOOLS,
  terminalNamePrefix: OPENCODE_TERMINAL_NAME_PREFIX,
  getSessionDirs,
  getAllSessionRoots,
  sessionFilePattern: OPENCODE_SESSION_FILE_PATTERN,
  parseTranscriptLine,
};

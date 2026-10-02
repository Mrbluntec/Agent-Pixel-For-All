import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import type { AgentEvent, HookProvider } from '../../../../../core/src/provider.js';
import {
  CHATGPT_DISPLAY_NAME,
  CHATGPT_HISTORY_SUBDIRS,
  CHATGPT_PERMISSION_EXEMPT_TOOLS,
  CHATGPT_PROVIDER_ID,
  CHATGPT_READING_TOOLS,
  CHATGPT_SESSION_FILE_PATTERN,
  CHATGPT_SUBAGENT_TOOLS,
  CHATGPT_TERMINAL_NAME_PREFIX,
} from './constants.js';

function getHistoryDirs(): string[] {
  return CHATGPT_HISTORY_SUBDIRS
    .map(s => path.join(os.homedir(), s))
    .filter(d => fs.existsSync(d));
}

function formatToolStatus(toolName: string, input?: unknown): string {
  const inp = (input ?? {}) as Record<string, unknown>;
  switch (toolName.toLowerCase()) {
    case 'python': return `Running Python: ${String(inp.code ?? '').slice(0, 40)}`;
    case 'browser': return `Browsing: ${String(inp.url ?? '')}`.slice(0, 60);
    case 'bash': return `Running: ${String(inp.command ?? '').slice(0, 50)}`;
    case 'retrieval': return 'Searching knowledge';
    default: return `Using ${toolName}`;
  }
}

export function parseTranscriptLine(line: string): AgentEvent | null {
  try {
    const record = JSON.parse(line) as Record<string, unknown>;
    const role = String(record.role ?? record.type ?? '');
    if (role === 'assistant' && record.content) {
      const content = Array.isArray(record.content) ? record.content : [record.content];
      const toolCall = (content as Array<Record<string, unknown>>).find(c => c.type === 'tool_call' || c.type === 'function_call');
      if (toolCall) {
        return { kind: 'toolStart', toolId: String(toolCall.id ?? `chatgpt-${Date.now()}`), toolName: String(toolCall.name ?? (toolCall.function as Record<string, unknown>)?.name ?? 'Bash'), input: toolCall.input as Record<string, unknown> };
      }
      return { kind: 'turnEnd', awaitingInput: false };
    }
    if (role === 'tool' || role === 'function') {
      return { kind: 'toolEnd', toolId: String(record.tool_call_id ?? record.id ?? '') };
    }
    if (role === 'user' && record.content) {
      return { kind: 'sessionStart', source: 'chatgpt' };
    }
    return null;
  } catch { return null; }
}

function getSessionDirs(_workspacePath: string): string[] { return getHistoryDirs(); }
function getAllSessionRoots(): string[] { return getHistoryDirs(); }

export const chatgptProvider: HookProvider = {
  kind: 'hook',
  id: CHATGPT_PROVIDER_ID,
  displayName: CHATGPT_DISPLAY_NAME,
  protocolVersion: 1,
  normalizeHookEvent(raw: Record<string, unknown>) {
    const sessionId = String(raw.sessionId ?? raw.session_id ?? 'chatgpt-session');
    const type = String(raw.event ?? raw.type ?? '');
    if (type === 'tool_start') return { sessionId, event: { kind: 'toolStart', toolId: String(raw.toolId ?? ''), toolName: String(raw.toolName ?? 'Bash'), input: raw.input } };
    if (type === 'tool_end') return { sessionId, event: { kind: 'toolEnd', toolId: String(raw.toolId ?? '') } };
    if (type === 'turn_end') return { sessionId, event: { kind: 'turnEnd', awaitingInput: Boolean(raw.awaitingInput) } };
    return null;
  },
  async installHooks(): Promise<void> {
    const dirs = getHistoryDirs();
    if (dirs.length === 0) console.log('[Pixel Agents] ChatGPT CLI history dir not found. Will detect when created.');
    else console.log(`[Pixel Agents] ChatGPT session watcher active: ${dirs.join(', ')}`);
  },
  async uninstallHooks(): Promise<void> {},
  async areHooksInstalled(): Promise<boolean> { return getHistoryDirs().length > 0; },
  consentDisclosure() { return { headline: 'Enable ChatGPT Provider', disclosure: 'Monitors ChatGPT CLI sessions and displays agents in the office.' }; },
  formatToolStatus,
  permissionExemptTools: CHATGPT_PERMISSION_EXEMPT_TOOLS,
  subagentToolNames: CHATGPT_SUBAGENT_TOOLS,
  readingTools: CHATGPT_READING_TOOLS,
  terminalNamePrefix: CHATGPT_TERMINAL_NAME_PREFIX,
  getSessionDirs,
  getAllSessionRoots,
  sessionFilePattern: CHATGPT_SESSION_FILE_PATTERN,
  parseTranscriptLine,
};

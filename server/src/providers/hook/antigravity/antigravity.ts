/**
 * Antigravity (AGY) HookProvider for Pixel Agents.
 *
 * Architecture:
 * ─────────────
 * Claude Code uses hook SCRIPTS that POST events in real time.
 * Antigravity uses TRANSCRIPT FILE WATCHING — AGY writes JSONL transcripts
 * to disk and Pixel Agents reads them directly.
 *
 * The AGY transcript format (each line = one step):
 *   { step_index, source, type, status, created_at, content, thinking, tool_calls }
 *
 * Pixel Agents parses these via parseTranscriptLine() and normalizeHookEvent().
 *
 * Session discovery:
 *   ~/.gemini/antigravity/brain/<conv-id>/.system_generated/logs/transcript.jsonl
 *
 * There is no hook script to install. The provider uses the file-watcher
 * path (getSessionDirs / getAllSessionRoots / parseTranscriptLine).
 */

import * as path from 'path';

import type { AgentEvent, HookProvider } from '../../../../../core/src/provider.js';
import {
  areHooksInstalled as installerAreHooksInstalled,
  getAllSessionRoots,
  getSessionDirs,
  installHooks as installerInstallHooks,
  uninstallHooks as installerUninstallHooks,
} from './antigravityHookInstaller.js';
import { CONSENT_DISCLOSURE, CONSENT_INSTALL_HEADLINE } from './consentCopy.js';
import {
  AGY_DISPLAY_NAME,
  AGY_PERMISSION_EXEMPT_TOOLS,
  AGY_PROVIDER_ID,
  AGY_READING_TOOLS,
  AGY_SESSION_FILE_PATTERN,
  AGY_SUBAGENT_TOOLS,
  AGY_TERMINAL_NAME_PREFIX,
  AGY_TOOL_MAP,
} from './constants.js';

// ── Tool name normalization ────────────────────────────────────────────────────

/** Map an AGY tool name to the normalized name Pixel Agents uses for animations. */
function mapToolName(agyCname: string): string {
  return AGY_TOOL_MAP[agyCname] ?? agyCname;
}

// ── formatToolStatus ──────────────────────────────────────────────────────────

/**
 * Format a tool call into a short human-readable status string.
 * Shown in the speech bubble above the character while it's working.
 */
function formatToolStatus(toolName: string, input?: unknown): string {
  const inp = (input ?? {}) as Record<string, unknown>;
  const base = (p: unknown) => (typeof p === 'string' ? path.basename(p as string) : '');

  switch (toolName) {
    case 'Read':
      return `Reading ${base(inp['AbsolutePath'] ?? inp['file_path'])}`;
    case 'Edit':
      return `Editing ${base(inp['TargetFile'] ?? inp['file_path'])}`;
    case 'Write':
      return `Writing ${base(inp['TargetFile'] ?? inp['file_path'])}`;
    case 'Bash': {
      const cmd = typeof inp['CommandLine'] === 'string' ? inp['CommandLine'] : '';
      return `Running: ${cmd.length > 60 ? cmd.slice(0, 60) + '…' : cmd}`;
    }
    case 'Grep':
      return `Searching: ${typeof inp['Query'] === 'string' ? inp['Query'].slice(0, 40) : '…'}`;
    case 'Glob':
      return 'Searching files';
    case 'LS':
      return `Listing ${base(inp['DirectoryPath'])}`;
    case 'WebFetch':
      return 'Fetching web content';
    case 'WebSearch':
      return `Searching: ${typeof inp['query'] === 'string' ? inp['query'].slice(0, 40) : '…'}`;
    case 'Task':
    case 'Agent': {
      const role = typeof inp['Role'] === 'string' ? inp['Role'] : '';
      return role ? `Subagent: ${role.slice(0, 40)}` : 'Launching subagent';
    }
    case 'DefineAgent':
      return `Defining agent: ${typeof inp['name'] === 'string' ? inp['name'] : ''}`;
    case 'ManageAgents':
      return `Managing agents`;
    case 'ManageTask':
      return 'Managing task';
    case 'AskUserQuestion':
      return 'Waiting for your answer';
    case 'Draw':
      return 'Generating image';
    case 'MCP':
      return `MCP: ${typeof inp['ToolName'] === 'string' ? inp['ToolName'] : '…'}`;
    case 'Schedule':
      return 'Scheduling task';
    default:
      return `Using ${toolName}`;
  }
}

// ── AGY transcript step types ─────────────────────────────────────────────────

interface AgyStep {
  step_index: number;
  source: string;
  type: string;
  status?: string;
  created_at?: string;
  content?: string;
  thinking?: string;
  tool_calls?: Array<{
    name: string;
    args?: Record<string, unknown>;
  }>;
}

/** Running state for transcript line parsing (tracks pending tool IDs). */
const lineParserState = new Map<string, { pendingToolIds: string[] }>();

/**
 * Parse one line of an AGY transcript.jsonl file into an AgentEvent.
 *
 * Called by Pixel Agents' transcript file watcher for each new line appended
 * to a session's transcript.jsonl.
 *
 * AGY transcript line shapes we care about:
 *
 *  USER_INPUT:
 *    → sessionStart (first USER_INPUT seen = session beginning)
 *    → turnEnd (subsequent ones = end of agent turn, user prompted again)
 *
 *  PLANNER_RESPONSE with tool_calls:
 *    → toolStart for each tool call
 *
 *  GENERIC (tool result):
 *    → toolEnd for the oldest pending tool
 *
 *  PLANNER_RESPONSE without tool_calls, non-empty content:
 *    → turnEnd (agent finished responding)
 */
export function parseTranscriptLine(line: string): AgentEvent | null {
  let step: AgyStep;
  try {
    step = JSON.parse(line) as AgyStep;
  } catch {
    return null;
  }

  // Use step_index as a synthetic session key within this parser invocation.
  // (The real session ID is managed by the caller via the file path.)
  const stateKey = 'default';
  if (!lineParserState.has(stateKey)) {
    lineParserState.set(stateKey, { pendingToolIds: [] });
  }
  const state = lineParserState.get(stateKey)!;

  switch (step.type) {
    case 'USER_INPUT': {
      // First USER_INPUT = session starting; subsequent ones = new user turn
      if (step.step_index === 0) {
        return { kind: 'sessionStart', source: 'antigravity' };
      }
      // User sent a new message → agent turn ended (awaiting input now resolved)
      return { kind: 'turnEnd', awaitingInput: false };
    }

    case 'PLANNER_RESPONSE': {
      const toolCalls = step.tool_calls ?? [];

      if (toolCalls.length > 0) {
        // Emit toolStart for the first tool call.
        // Pixel Agents will subsequently call us again for each GENERIC result.
        const first = toolCalls[0];
        const normalizedName = mapToolName(first.name);
        const toolId = `agy-${step.step_index}-0`;

        // Register all tool IDs so subsequent GENERIC steps can close them.
        toolCalls.forEach((_tc, idx) => {
          state.pendingToolIds.push(`agy-${step.step_index}-${idx}`);
        });

        const inp = normalizeArgs(first.args ?? {});
        return {
          kind: 'toolStart',
          toolId,
          toolName: normalizedName,
          input: inp,
          runInBackground: false,
        };
      }

      // No tools → agent finished its turn with a text response
      const text = (step.content ?? '').trim();
      if (text) {
        return { kind: 'turnEnd', awaitingInput: false };
      }
      return null;
    }

    case 'GENERIC': {
      // Tool result — close the oldest pending tool call
      const id = state.pendingToolIds.shift();
      if (id) {
        return { kind: 'toolEnd', toolId: id };
      }
      return null;
    }

    default:
      return null;
  }
}

/**
 * Normalize AGY args (which sometimes double-JSON-encode string values).
 */
function normalizeArgs(args: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(args)) {
    if (typeof v === 'string') {
      try { out[k] = JSON.parse(v); } catch { out[k] = v; }
    } else {
      out[k] = v;
    }
  }
  return out;
}

// ── normalizeHookEvent ────────────────────────────────────────────────────────
//
// AGY does not send real-time hook POSTs today, but we implement this for
// future use (e.g. if AGY adds a hook API). Currently returns null — all
// session data flows through parseTranscriptLine instead.

function normalizeHookEvent(
  _raw: Record<string, unknown>,
): { sessionId: string; event: AgentEvent } | null {
  // AGY uses file-watching, not HTTP hooks. This will be wired up if AGY
  // ever adds a hooks API (similar to Claude Code's settings.json hooks).
  return null;
}

// ── Installer wrappers ─────────────────────────────────────────────────────────

async function installHooks(serverUrl: string, authToken: string): Promise<void> {
  await installerInstallHooks(serverUrl, authToken);
}

async function uninstallHooks(): Promise<void> {
  await installerUninstallHooks();
}

function areHooksInstalled(): Promise<boolean> {
  return Promise.resolve(installerAreHooksInstalled());
}

function consentDisclosure(): { headline: string; disclosure: string } {
  return { headline: CONSENT_INSTALL_HEADLINE, disclosure: CONSENT_DISCLOSURE };
}

// ── The provider ──────────────────────────────────────────────────────────────

export const antigravityProvider: HookProvider = {
  kind: 'hook',
  id: AGY_PROVIDER_ID,
  displayName: AGY_DISPLAY_NAME,
  protocolVersion: 1,

  normalizeHookEvent,

  installHooks,
  uninstallHooks,
  areHooksInstalled,
  consentDisclosure,

  formatToolStatus,
  permissionExemptTools: AGY_PERMISSION_EXEMPT_TOOLS,
  subagentToolNames: AGY_SUBAGENT_TOOLS,
  readingTools: AGY_READING_TOOLS,
  terminalNamePrefix: AGY_TERMINAL_NAME_PREFIX,

  // Session discovery via file-watching (the primary mechanism for AGY)
  getSessionDirs,
  getAllSessionRoots,
  sessionFilePattern: AGY_SESSION_FILE_PATTERN,
  parseTranscriptLine,

  // AGY doesn't have a standalone CLI to launch from the office
  // (it runs inside the AGY IDE). No buildLaunchCommand.
};

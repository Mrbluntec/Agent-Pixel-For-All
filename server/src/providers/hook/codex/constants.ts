export const CODEX_PROVIDER_ID = 'codex';
export const CODEX_DISPLAY_NAME = 'Codex';
export const CODEX_PROTOCOL_VERSION = 1;

export const CODEX_DIR = '.codex';
export const CODEX_SESSIONS_DIR = 'sessions';
export const CODEX_ARCHIVED_DIR = 'archived_sessions';
export const CODEX_SESSION_FILE_PATTERN = 'rollout-*.jsonl';
export const CODEX_TERMINAL_NAME_PREFIX = 'codex';

export const CODEX_READING_TOOLS: ReadonlySet<string> = new Set([
  'Read',
  'read_file',
  'view_file',
  'grep',
  'grep_search',
  'find_by_name',
  'list_dir',
  'ls',
  'Glob',
  'Grep',
]);

export const CODEX_PERMISSION_EXEMPT_TOOLS: ReadonlySet<string> = new Set([
  'Read',
  'read_file',
  'view_file',
  'Glob',
  'Grep',
  'ls',
  'list_dir',
]);

export const CODEX_SUBAGENT_TOOLS: ReadonlySet<string> = new Set([
  'agent',
  'task',
  'subagent',
  'spawn_agent',
]);
